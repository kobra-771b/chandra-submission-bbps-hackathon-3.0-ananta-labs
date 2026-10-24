"""Chandra Link: pair your phone with this PC over the same Wi-Fi.

Run it on the PC, scan the QR code with your phone, enter the PIN once. After that
the phone page can send actions to the PC and the PC can send alerts to the phone.
No cloud, no account. Everything stays on your local network.
"""
import argparse
import asyncio
import hashlib
import hmac
import io
import json
import os
import re
import secrets
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

import segno
from aiohttp import ClientSession, ClientTimeout, WSMsgType, web

HERE = Path(__file__).parent
IS_WIN = sys.platform == "win32"
DRYRUN = os.environ.get("CHANDRA_LINK_DRYRUN") == "1" or not IS_WIN
AUTOAPPROVE = os.environ.get("CHANDRA_LINK_AUTOAPPROVE") == "1"
STATE_DIR = Path(os.environ.get("CHANDRA_LINK_HOME") or
                 (Path(os.environ.get("APPDATA", Path.home())) / "ChandraLink"))
STATE_FILE = STATE_DIR / "state.json"
PIN_TTL = 300
APPROVE_ACTIONS = {"sleep", "shutdown"}  # ask on the PC before running these
PS = ["powershell.exe", "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command"]


# ---------------------------------------------------------------- state

class State:
    def __init__(self):
        self.data = {"devices": {}, "chandra_path": ""}
        try:
            self.data.update(json.loads(STATE_FILE.read_text("utf-8")))
        except (OSError, ValueError):
            pass

    def save(self):
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        tmp = STATE_FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.data, indent=2), "utf-8")
        tmp.replace(STATE_FILE)


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


# ---------------------------------------------------------------- PC side effects

async def run_ps(script, **env):
    if DRYRUN:
        return True
    e = {**os.environ, **{f"CL_{k.upper()}": v for k, v in env.items()}}
    p = await asyncio.create_subprocess_exec(*PS, script, env=e,
                                             stdout=asyncio.subprocess.DEVNULL,
                                             stderr=asyncio.subprocess.DEVNULL)
    return (await p.wait()) == 0


async def pc_notify(title, text):
    await run_ps(
        "Add-Type -AssemblyName System.Windows.Forms,System.Drawing;"
        "$n=New-Object System.Windows.Forms.NotifyIcon;"
        "$n.Icon=[System.Drawing.SystemIcons]::Information;$n.Visible=$true;"
        "$n.ShowBalloonTip(6000,$env:CL_TITLE,$env:CL_TEXT,'Info');Start-Sleep 7;$n.Dispose()",
        title=title[:60], text=text[:240])


async def pc_ask(text):
    """Yes/No popup on the PC, always on top, auto-denies after 30 s."""
    if DRYRUN:
        return AUTOAPPROVE
    p = await asyncio.create_subprocess_exec(
        *PS, "$r=(New-Object -ComObject WScript.Shell).Popup($env:CL_TEXT,30,'Chandra Link',4+32+4096);exit $r",
        env={**os.environ, "CL_TEXT": text}, stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.DEVNULL)
    return (await p.wait()) == 6


CDP_PORT = int(os.environ.get("CHANDRA_LINK_CDP_PORT") or 9222)
# Makes Chandra's built-in browser engine (WebView2) listen on a local-only debug port,
# which is how Link types into Chandra's window and reads the answer.
CHANDRA_ENV = {"WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS": f"--remote-debugging-port={CDP_PORT} --remote-allow-origins=*"}

JS_ASK = r"""
(async (prompt, maxWait) => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const vis = e => { const r = e.getBoundingClientRect(), c = getComputedStyle(e);
    return r.width > 20 && r.height > 10 && c.visibility !== 'hidden' && c.display !== 'none' && !e.disabled && !e.readOnly; };
  const boxes = [...document.querySelectorAll('textarea,[contenteditable=""],[contenteditable="true"],input[type="text"],input:not([type])')].filter(vis);
  if (!boxes.length) return {ok: false, error: 'Could not find the message box in Chandra'};
  boxes.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom);  // chat boxes sit at the bottom
  const box = boxes[0], text = () => document.body.innerText, before = text();
  const filled = () => (box.isContentEditable ? box.innerText : box.value) || '';
  box.focus();
  if (box.isContentEditable) { document.execCommand('selectAll'); document.execCommand('insertText', false, prompt); }
  else { const proto = box.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
         Object.getOwnPropertyDescriptor(proto, 'value').set.call(box, prompt);
         box.dispatchEvent(new Event('input', {bubbles: true})); }
  await sleep(200);
  const key = t => box.dispatchEvent(new KeyboardEvent(t, {key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true}));
  key('keydown'); key('keypress'); key('keyup');
  await sleep(1200);
  if (filled().trim() === prompt.trim()) {           // Enter did nothing: click the send button instead
    let btn = null, root = box;
    for (let i = 0; i < 6 && !btn && root.parentElement; i++) {
      root = root.parentElement;
      const bs = [...root.querySelectorAll('button,[role=button]')].filter(vis);
      btn = bs.find(b => /send|submit|ask|go\b|enter/i.test((b.innerText || '') + ' ' + (b.getAttribute('aria-label') || '') + ' ' + (b.title || '')))
         || (bs.length ? bs.sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)[0] : null);
    }
    if (!btn) return {ok: false, error: 'Could not find the send button in Chandra'};
    btn.click();
  }
  const start = Date.now(); let last = text(), stableSince = Date.now(), changed = false;
  while (Date.now() - start < maxWait) {
    await sleep(500);
    const t = text();
    if (t !== last) { last = t; stableSince = Date.now(); if (t !== before) changed = true; }
    else if (changed && Date.now() - stableSince > 3000 && Date.now() - start > 2500) break;
  }
  // New content = what changed between the page before and after; drop unchanged chrome at the end.
  const n = Math.min(before.length, last.length);
  let cp = 0; while (cp < n && before[cp] === last[cp]) cp++;
  let cs = 0; while (cs < n - cp && before[before.length - 1 - cs] === last[last.length - 1 - cs]) cs++;
  const head = prompt.slice(0, 40), i = last.indexOf(head, Math.max(0, cp - 1));
  let reply = i >= 0 ? last.slice(i + prompt.length, last.length - cs) : last.slice(cp, last.length - cs);
  reply = reply.trim().slice(0, 3000);
  return {ok: true, reply: reply || '(Chandra did not show a reply in time)'};
})
"""


async def cdp_page_ws():
    async with ClientSession(timeout=ClientTimeout(total=3)) as s:
        async with s.get(f"http://127.0.0.1:{CDP_PORT}/json") as r:
            targets = await r.json(content_type=None)
    pages = [t for t in targets if t.get("type") == "page" and t.get("webSocketDebuggerUrl")
             and not t.get("url", "").startswith("devtools:")]
    pages.sort(key=lambda t: "chandra" not in (t.get("title", "") + t.get("url", "")).lower())
    return pages[0]["webSocketDebuggerUrl"] if pages else None


async def cdp_ask(prompt, max_wait_ms=90000):
    ws_url = await cdp_page_ws()
    if not ws_url:
        raise RuntimeError("Chandra has no open window")
    expr = f"({JS_ASK})({json.dumps(prompt)},{max_wait_ms})"
    async with ClientSession() as sess:
        async with sess.ws_connect(ws_url, max_msg_size=0) as ws:
            await ws.send_json({"id": 1, "method": "Runtime.evaluate",
                                "params": {"expression": expr, "awaitPromise": True, "returnByValue": True}})

            async def wait():
                async for m in ws:
                    d = json.loads(m.data)
                    if d.get("id") == 1:
                        return d
            d = await asyncio.wait_for(wait(), max_wait_ms / 1000 + 20)
    if "error" in d or "exceptionDetails" in d.get("result", {}):
        raise RuntimeError("Chandra's window refused the request")
    return d["result"]["result"]["value"]


async def ps_out(script):
    p = await asyncio.create_subprocess_exec(*PS, script, stdout=asyncio.subprocess.PIPE,
                                             stderr=asyncio.subprocess.DEVNULL)
    out, _ = await p.communicate()
    return out.decode("utf-8", "ignore").strip()


async def detect_chandra(state):
    """Find Chandra.exe: saved path, usual folders, a running copy, then Start Menu / Desktop shortcuts."""
    exe = find_chandra(state)
    if exe or DRYRUN:
        return exe
    out = await ps_out(
        "$n=$null;"
        "$p=Get-Process|Where-Object{$_.ProcessName -like '*chandra*' -and $_.ProcessName -notmatch 'setup|link' -and $_.Path}|Select-Object -First 1;"
        "if($p){$n=$p.Path};"
        "if(-not $n){$sh=New-Object -ComObject WScript.Shell;"
        "foreach($d in @((Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs'),(Join-Path $env:ProgramData 'Microsoft\\Windows\\Start Menu\\Programs'),(Join-Path $env:USERPROFILE 'Desktop'),(Join-Path $env:PUBLIC 'Desktop'))){"
        "Get-ChildItem $d -Recurse -Filter '*chandra*.lnk' -ErrorAction SilentlyContinue|ForEach-Object{if(-not $n){$t=$sh.CreateShortcut($_.FullName).TargetPath;"
        "if($t -and (Test-Path $t) -and $t -notmatch 'uninstall|setup'){$n=$t}}}}};"
        "if($n){Write-Output $n}")
    if out and Path(out).is_file():
        state.data["chandra_path"] = out
        state.save()
        return out
    return None


async def chandra_running(exe):
    return await run_ps("if(Get-Process -Name $env:CL_NAME -ErrorAction SilentlyContinue){exit 0}else{exit 1}",
                        name=Path(exe).stem)


async def launch_chandra(state):
    exe = await detect_chandra(state)
    if not exe:
        return None
    if not DRYRUN:
        subprocess.Popen([exe], cwd=str(Path(exe).parent), env={**os.environ, **CHANDRA_ENV})
    return exe


async def ask_chandra(app, who, text):
    text = text.strip()[:4000]
    if not text:
        return False, "Type something to ask", None
    try:
        await cdp_page_ws()
    except Exception:
        if DRYRUN and not os.environ.get("CHANDRA_LINK_CDP_PORT"):
            return False, "Test mode: no Chandra here", None
        exe = await detect_chandra(app["state"])
        if not exe:
            return False, "Can't find Chandra. Set its path on the PC page.", None
        if await chandra_running(exe):
            return False, "Chandra is open but not linked. Close it, then tap Open Chandra.", None
        await launch_chandra(app["state"])
        for _ in range(40):
            await asyncio.sleep(0.5)
            try:
                if await cdp_page_ws():
                    await asyncio.sleep(2)
                    break
            except Exception:
                pass
        else:
            return False, "Chandra did not open in time", None
    asyncio.ensure_future(pc_notify(f"{who} asked Chandra", text))
    try:
        r = await cdp_ask(text)
    except Exception as e:
        return False, f"Could not talk to Chandra: {e}", None
    if not r.get("ok"):
        return False, r.get("error", "Chandra did not answer"), None
    return True, "Chandra answered", r["reply"]


def find_chandra(state):
    cands = [state.data.get("chandra_path"), os.environ.get("CHANDRA_PATH")]
    for base in ("LOCALAPPDATA", "ProgramFiles", "APPDATA"):
        root = os.environ.get(base)
        if root:
            cands += [Path(root) / "Programs" / "Chandra" / "Chandra.exe",
                      Path(root) / "Chandra" / "Chandra.exe"]
    return next((str(c) for c in cands if c and Path(c).is_file()), None)


async def do_action(app, dev_name, a):
    """Run one phone-requested action. Returns (ok, message)."""
    state, kind = app["state"], a.get("action")
    if kind in APPROVE_ACTIONS and not await pc_ask(f"{dev_name} wants to {kind} this PC. Allow?"):
        return False, "Denied on the PC"
    if kind == "ping":
        return True, "PC is here"
    if kind == "notify":
        await pc_notify(a.get("title") or dev_name, a.get("text") or "")
    elif kind == "open_url":
        url = (a.get("url") or "").strip()
        if urlparse(url).scheme not in ("http", "https"):
            return False, "Only http/https links"
        if not DRYRUN:
            os.startfile(url)
    elif kind == "clipboard":
        await run_ps("Set-Clipboard -Value $env:CL_TEXT", text=(a.get("text") or "")[:10000])
    elif kind == "lock":
        if not DRYRUN:
            import ctypes
            ctypes.windll.user32.LockWorkStation()
    elif kind == "sleep":
        if not DRYRUN:
            subprocess.Popen(["rundll32.exe", "powrprof.dll,SetSuspendState", "0,1,0"])
    elif kind == "shutdown":
        if not DRYRUN:
            subprocess.Popen(["shutdown", "/s", "/t", "10"])
    elif kind == "ask_chandra":
        ok, msg, reply = await ask_chandra(app, dev_name, a.get("text") or "")
        app["log"]("action", f"{dev_name}: asked Chandra")
        return ok, msg, reply
    elif kind == "launch_chandra":
        if not await launch_chandra(state):
            return False, "Can't find Chandra. Set its path on the PC page."
    else:
        return False, "Unknown action"
    app["log"]("action", f"{dev_name}: {kind}")
    return True, "Done" + (" (dry run)" if DRYRUN else "")


# ---------------------------------------------------------------- app

def make_app(port):
    app = web.Application(middlewares=[], client_max_size=64 * 1024)
    app["state"] = State()
    app["port"] = port
    app["pc_name"] = socket.gethostname()
    app["phones"] = {}   # device id -> set of websockets (phone page and Android app can both be connected)
    app["pcs"] = set()   # dashboard websockets
    app["events"] = []
    app["pin"] = {"v": "", "t": 0}
    app["fails"] = {}    # ip -> (count, locked_until)

    def new_pin():
        app["pin"].update(v=f"{secrets.randbelow(10**6):06d}", t=time.time())

    def log(kind, text):
        ev = app["events"]
        ev.append({"t": int(time.time()), "kind": kind, "text": text})
        del ev[:-50]
        asyncio.ensure_future(push_state(app))

    app["log"] = log
    app["new_pin"] = new_pin
    new_pin()

    app.router.add_get("/", phone_page)
    app.router.add_get("/pc", pc_page)
    app.router.add_get("/manifest.webmanifest", manifest)
    app.router.add_post("/api/pair", api_pair)
    app.router.add_get("/api/check", api_check)
    app.router.add_get("/ws", ws_phone)
    app.router.add_get("/pcws", ws_pc)
    app.router.add_get("/qr.svg", qr_svg)
    return app


def is_local(request):
    """PC-only pages: loopback client, loopback Host (blocks DNS rebinding), same-origin if a browser sent Origin
    (blocks other websites from talking to us through the user's own browser)."""
    if request.remote not in ("127.0.0.1", "::1"):
        return False
    if request.host.rsplit(":", 1)[0].strip("[]") not in ("127.0.0.1", "localhost", "::1"):
        return False
    origin = request.headers.get("Origin")
    return not origin or urlparse(origin).netloc == request.host


def page(name):
    async def h(request):
        if name == "pc.html" and not is_local(request):
            raise web.HTTPForbidden(text="Open this page on the PC itself")
        return web.FileResponse(HERE / "static" / name, headers={"Cache-Control": "no-store"})
    return h


phone_page, pc_page = page("phone.html"), page("pc.html")


async def manifest(request):
    return web.json_response({
        "name": "Chandra Link", "short_name": "Link", "start_url": "/", "display": "standalone",
        "background_color": "#0b1020", "theme_color": "#0b1020", "icons": []})


async def qr_svg(request):
    if not is_local(request):
        raise web.HTTPForbidden()
    pin = request.app["pin"]["v"] if time.time() - request.app["pin"]["t"] <= PIN_TTL else ""
    url = f"http://{lan_ip()}:{request.app['port']}/" + (f"?pin={pin}" if pin else "")
    buf = io.BytesIO()
    segno.make(url, error="m").save(buf, kind="svg", scale=8, dark="#0b1020", light="#ffffff", border=2)
    return web.Response(body=buf.getvalue(), content_type="image/svg+xml", headers={"Cache-Control": "no-store"})


def devices_view(app):
    st = app["state"].data["devices"]
    return [{"id": i, "name": d["name"], "online": bool(app["phones"].get(i)), "last_seen": d.get("last_seen", 0)}
            for i, d in st.items()]


async def push_state(app):
    if not app["pcs"]:
        return
    if time.time() - app["pin"]["t"] > PIN_TTL:
        app["new_pin"]()
    msg = json.dumps({"t": "state", "pin": app["pin"]["v"], "url": f"http://{lan_ip()}:{app['port']}/",
                      "devices": devices_view(app), "events": app["events"][-15:][::-1],
                      "chandra_path": find_chandra(app["state"]) or "", "dry": DRYRUN})
    for ws in list(app["pcs"]):
        try:
            await ws.send_str(msg)
        except ConnectionError:
            app["pcs"].discard(ws)


async def api_pair(request):
    app, ip = request.app, request.remote
    count, until = app["fails"].get(ip, (0, 0))
    if time.time() < until:
        return web.json_response({"ok": False, "error": "Too many tries. Wait a minute."}, status=429)
    try:
        body = await request.json()
    except ValueError:
        return web.json_response({"ok": False, "error": "Bad request"}, status=400)
    pin = str(body.get("pin", "")).strip()
    name = (str(body.get("name", "")).strip() or "Phone")[:40]
    fresh = time.time() - app["pin"]["t"] <= PIN_TTL
    if not (fresh and hmac.compare_digest(pin, app["pin"]["v"])):
        count += 1
        app["fails"][ip] = (count, time.time() + 60 if count >= 5 else 0)
        return web.json_response({"ok": False, "error": "Wrong or expired PIN"}, status=403)
    app["fails"].pop(ip, None)
    token = secrets.token_urlsafe(32)
    dev_id = token_hash(token)[:12]
    app["state"].data["devices"][dev_id] = {"name": name, "token_hash": token_hash(token),
                                            "created": int(time.time()), "last_seen": int(time.time())}
    app["state"].save()
    app["new_pin"]()
    app["log"]("pair", f"Paired with {name}")
    asyncio.ensure_future(pc_notify("Chandra Link", f"Paired with {name}"))
    return web.json_response({"ok": True, "token": token, "pc": app["pc_name"]})


def device_for_token(app, token):
    h = token_hash(token or "")
    for i, d in app["state"].data["devices"].items():
        if hmac.compare_digest(d["token_hash"], h):
            return i, d
    return None, None


async def run_action(ws, app, name, a):
    try:
        ok, text, *extra = await do_action(app, name, a)
    except Exception as e:  # keep the link alive on any action error
        ok, text, extra = False, f"Failed: {e}", []
    out = {"t": "result", "id": a.get("id"), "ok": ok, "msg": text}
    if extra and extra[0] is not None:
        out["reply"] = extra[0]
    if not ws.closed:
        await ws.send_json(out)


async def api_check(request):
    _, dev = device_for_token(request.app, request.query.get("token"))
    return web.json_response({"ok": bool(dev)}, status=200 if dev else 401)


async def ws_phone(request):
    app = request.app
    dev_id, dev = device_for_token(app, request.query.get("token"))
    if not dev:
        raise web.HTTPUnauthorized()
    ws = web.WebSocketResponse(heartbeat=10, max_msg_size=64 * 1024)
    await ws.prepare(request)
    conns = app["phones"].setdefault(dev_id, set())
    first = not conns
    conns.add(ws)
    dev["last_seen"] = int(time.time())
    await ws.send_json({"t": "hello", "pc": app["pc_name"], "device": dev["name"], "chandra": bool(find_chandra(app["state"]))})
    if first:
        app["log"]("online", f"{dev['name']} connected")
        asyncio.ensure_future(pc_notify("Chandra Link", f"{dev['name']} connected"))
    try:
        async for m in ws:
            if m.type != WSMsgType.TEXT:
                continue
            try:
                a = json.loads(m.data)
            except ValueError:
                continue
            if a.get("t") == "action":
                asyncio.ensure_future(run_action(ws, app, dev["name"], a))
    finally:
        conns.discard(ws)
        if not conns and app["phones"].get(dev_id) is conns:
            del app["phones"][dev_id]
            dev["last_seen"] = int(time.time())
            app["state"].save()
            app["log"]("offline", f"{dev['name']} disconnected")
    return ws


async def ws_pc(request):
    app = request.app
    if not is_local(request):
        raise web.HTTPForbidden()
    ws = web.WebSocketResponse(heartbeat=10, max_msg_size=64 * 1024)
    await ws.prepare(request)
    app["pcs"].add(ws)
    await push_state(app)
    try:
        async for m in ws:
            if m.type != WSMsgType.TEXT:
                continue
            try:
                a = json.loads(m.data)
            except ValueError:
                continue
            t = a.get("t")
            if t == "send":
                target = a.get("device")
                out = json.dumps({"t": "msg", "kind": a.get("kind", "notify"),
                                  "title": str(a.get("title") or app["pc_name"])[:60],
                                  "text": str(a.get("text") or "")[:500], "url": str(a.get("url") or "")[:500]})
                for i, conns in list(app["phones"].items()):
                    if target in ("all", i):
                        for p in list(conns):
                            await p.send_str(out)
            elif t == "revoke":
                d = app["state"].data["devices"].pop(a.get("device"), None)
                for p in list(app["phones"].pop(a.get("device"), ())):
                    await p.close()
                app["state"].save()
                if d:
                    app["log"]("revoke", f"Removed {d['name']}")
            elif t == "newpin":
                app["new_pin"]()
            elif t == "chandra_path":
                path = str(a.get("path") or "").strip().strip('"')
                app["state"].data["chandra_path"] = path
                app["state"].save()
            await push_state(app)
    finally:
        app["pcs"].discard(ws)
    return ws


# ---------------------------------------------------------------- main

def keep_awake():
    """Wi-Fi PCs can't be woken remotely, so just stop the PC sleeping while Link runs."""
    if IS_WIN:
        import ctypes
        ctypes.windll.kernel32.SetThreadExecutionState(0x80000000 | 0x00000001)  # CONTINUOUS | SYSTEM_REQUIRED


async def presence_ticker(app):
    while True:
        await asyncio.sleep(5)
        await push_state(app)


BG = set()
MDNS = {}


async def start_mdns(app):
    """Advertise on the network so the Android app can find this PC by itself. Optional."""
    try:
        from zeroconf import IPVersion
        from zeroconf.asyncio import AsyncServiceInfo, AsyncZeroconf
        name = re.sub(r"[^A-Za-z0-9-]", "-", app["pc_name"]) or "pc"
        info = AsyncServiceInfo("_chandralink._tcp.local.", f"{name}._chandralink._tcp.local.",
                                addresses=[socket.inet_aton(lan_ip())], port=app["port"],
                                properties={"v": "1"}, server=f"{name}.local.")
        azc = AsyncZeroconf(ip_version=IPVersion.V4Only)
        await azc.async_register_service(info)
        MDNS.update(azc=azc, info=info)
    except Exception as e:  # never let discovery break the link
        print(f"Auto-discovery off ({e}). Type the PC address in the app instead.")


async def stop_mdns(app):
    if MDNS:
        await MDNS["azc"].async_unregister_service(MDNS["info"])
        await MDNS["azc"].async_close()


async def on_start(app):
    t = asyncio.create_task(presence_ticker(app))
    BG.add(t)
    t.add_done_callback(BG.discard)
    await start_mdns(app)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--no-keep-awake", action="store_true")
    ap.add_argument("--no-browser", action="store_true")
    args = ap.parse_args()
    if not args.no_keep_awake:
        keep_awake()
    app = make_app(args.port)
    app.on_startup.append(on_start)
    app.on_cleanup.append(stop_mdns)
    url = f"http://127.0.0.1:{args.port}/pc"
    print(f"Chandra Link running. PC page: {url}\nPhone page: http://{lan_ip()}:{args.port}/")
    if not args.no_browser and IS_WIN:
        os.startfile(url)
    web.run_app(app, host="0.0.0.0", port=args.port, print=None)


if __name__ == "__main__":
    main()
