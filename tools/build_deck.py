#!/usr/bin/env python3
"""Generate the Ananta Labs submission decks (static HTML, no build step needed to view).

Every string is written once as (en-US, en-UK, en-IN); a missing variant falls back to en-US.
The pages embed all three variants and a tiny script picks one from ``?lang=``.

    python tools/build_deck.py
"""
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "deck"
LOCALES = ("en-US", "en-UK", "en-IN")
HTML_LANG = {"en-US": "en-US", "en-UK": "en-GB", "en-IN": "en-IN"}  # valid BCP 47 for <html lang>


def v(us, uk=None, ind=None):
    uk = uk if uk is not None else us
    return {"en-US": us, "en-UK": uk, "en-IN": ind if ind is not None else uk}


def t(s):
    """Render a localised string as three sibling spans; CSS shows the active one."""
    if isinstance(s, str):
        return escape(s)
    return "".join(f'<span class="l l-{k}">{escape(s[k])}</span>' for k in LOCALES)


TITLE_OWNER = "Ananta Labs"
COPY = v("© 2026 Ananta Labs. All rights reserved.")
SUB = v("BBPS Hackathon 3.0 submission")
DATE = v("October 24, 2026", "24 October 2026", "24 October 2026")

# ---------------------------------------------------------------- content
# slide = (heading, kind, payload); kind: "lead" | "list" | "cards" | "steps"
APPLICATION = {
    "slug": "application",
    "title": v("Application Slide Deck"),
    "tag": v("What Chandra Link does and how people use it"),
    "slides": [
        ("lead", v("Chandra Link"), v("Your phone and your PC, talking to each other over your own Wi-Fi. No account. No cloud.")),
        ("list", v("The problem"), [
            v("Your assistant lives on the PC, but you are often away from the keyboard."),
            v("Cloud relays add accounts, latency and a third party in the middle."),
            v("People want a quick, private way to reach the PC from the phone in their hand."),
        ]),
        ("cards", v("What it does"), [
            (v("Ask Chandra from your phone"), v("Type an instruction on the phone. Link opens Chandra on the PC, enters it, and returns the answer to your phone.")),
            (v("Remote PC actions"), v("Ping, open Chandra, lock, sleep, shut down (the PC asks first), open a link, copy text, show a notification.")),
            (v("Alerts both ways"), v("Notifications to the phone, and “ring my phone” with sound and vibration."),),
            (v("Presence"), v("Each side shows whether the other is online. Pairing survives restarts.")),
        ]),
        ("steps", v("How pairing works"), [
            v("Run start.bat on the PC. First run sets itself up."),
            v("Scan the QR code on the PC page with the phone camera."),
            v("The phone is paired. No PIN typing in the browser flow."),
            v("Add the page to the home screen, or install the Android app."),
        ]),
        ("list", v("Android app"), [
            v("Keeps the link alive in the background."),
            v("Shows real notifications even when the page is closed."),
            v("“Find my PC” discovers the PC on the network. Enter the PIN once."),
            v("Asks to stop battery saving for the app so the link is not killed."),
        ]),
        ("list", v("Privacy by design"), [
            v("Everything stays on the local network."),
            v("Shutdown and sleep need approval on the PC."),
            v("Chandra’s own approval prompts still apply."),
            v("Plain HTTP on Wi-Fi: pair at home, not on shared networks."),
        ]),
        ("lead", v("Thank you"), v("Ananta Labs · BBPS Hackathon 3.0 submission")),
    ],
}

STACK = {
    "slug": "technology-stack",
    "title": v("Technology Stack"),
    "tag": v("What Chandra Link is built with"),
    "slides": [
        ("lead", v("Technology Stack"), v("A small, local-first stack that runs on a normal Windows PC and an Android phone.")),
        ("cards", v("Architecture"), [
            (v("PC service"), v("A Python 3 asyncio program (link.py) serving the phone page, the PC page and a WebSocket API on port 8765.")),
            (v("Phone client"), v("A mobile web page installable to the home screen, plus an Android app (APK) for background delivery.")),
            (v("Transport"), v("HTTP and WebSocket on the local network, with heartbeats to track who is online.")),
        ]),
        ("cards", v("Libraries"), [
            (v("aiohttp"), v("Async HTTP server, WebSockets, and the client used to talk to Chandra.")),
            (v("segno"), v("Generates the pairing QR code as SVG.")),
            (v("zeroconf"), v("mDNS service advertisement so the Android app can “Find my PC”.")),
        ]),
        ("list", v("Windows integration"), [
            v("PowerShell for notifications, lock, sleep, shutdown prompts and app discovery."),
            v("Win32 calls (ctypes) to keep the PC awake while Link runs."),
            v("Chandra’s WebView2 engine is started with a local-only debug port, so Link can enter a prompt and read the reply."),
            v("start.bat sets up a virtual environment on first run; autostart-on.bat starts Link quietly at login."),
        ]),
        ("list", v("Security model"), [
            v("Short-lived pairing PIN (5 minutes), compared in constant time."),
            v("Per-device tokens, stored hashed on the PC."),
            v("The PC page accepts loopback clients only, and checks Host and Origin against DNS-rebinding and cross-site requests."),
            v("Risky actions (sleep, shutdown) require approval on the PC."),
        ]),
        ("list", v("Quality and portability"), [
            v("Dry-run mode records actions without executing them, used for testing on non-Windows systems."),
            v("No cloud dependency, no account, no telemetry."),
            v("Dependencies are three small, widely used open-source packages."),
        ]),
    ],
}

ROADMAP = {
    "slug": "commercialisation-roadmap",
    "title": v("Commercialization Roadmap", "Commercialisation Roadmap"),
    "tag": v("A proposed path from hackathon prototype to product"),
    "slides": [
        ("lead", v("Commercialization Roadmap", "Commercialisation Roadmap"), v("A draft plan by Ananta Labs. Phases and models are proposals to be validated, not commitments.")),
        ("steps", v("Phases"), [
            v("Phase 1 · Submit and harden: hackathon submission, bug fixes, signed installers."),
            v("Phase 2 · Closed beta: real users on home and small-office networks; collect feedback."),
            v("Phase 3 · Public launch: stable release, documentation, support channel."),
            v("Phase 4 · Expand: more PC actions, more platforms, partner integrations."),
        ]),
        ("cards", v("Who it is for"), [
            (v("Individuals"), v("People who run Chandra on a PC and want to reach it from a phone.")),
            (v("Small teams"), v("Shared office PCs that need simple, private remote access.")),
            (v("Partners"), v("Organizations that want to bundle a private phone-to-PC link.", "Organisations that want to bundle a private phone-to-PC link.")),
        ]),
        ("cards", v("Revenue models under evaluation"), [
            (v("Free core, paid extras"), v("Core link free; advanced automation and multi-PC paid.")),
            (v("Licensing"), v("Per-seat or per-organization licences for teams.", "Per-seat or per-organisation licences for teams.")),
            (v("Partnerships"), v("Co-branded or embedded distribution with hardware and software partners.")),
        ]),
        ("list", v("Pricing and market notes"), [
            v("Prices will be set per region after beta feedback (US in $, UK in £, India in ₹).",
              "Prices will be set per region after beta feedback (US in $, UK in £, India in ₹).",
              "Prices will be set per region after beta feedback (India in ₹, with USD and GBP for export)."),
            v("The local-first design avoids cloud hosting cost, keeping margins healthy at small scale."),
            v("Trust, privacy and ease of setup are the main differentiators."),
        ]),
        ("list", v("Risks and mitigations"), [
            v("Dependence on Chandra’s internals: keep the integration thin and versioned."),
            v("Plain HTTP on Wi-Fi: add encrypted transport before public launch."),
            v("Windows-only PC side: evaluate macOS and Linux after launch."),
            v("Intellectual property: all work © Ananta Labs; third-party licences tracked in LICENSES.txt."),
        ]),
    ],
}

DECKS = [APPLICATION, STACK, ROADMAP]
CHROME = {
    "home": v("All decks"), "lang": v("Language"),
    "prev": v("Previous"), "next": v("Next"),
    "index_title": v("Ananta Labs · Submission decks"),
    "index_tag": v("Pick a deck. Your language choice travels with you."),
    "open": v("Open deck"),
}

# ---------------------------------------------------------------- templates
HEAD = """<!doctype html>
<html lang="en-US">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="Ananta Labs submission for BBPS Hackathon 3.0">
<link rel="stylesheet" href="{up}assets/deck.css">
<script defer src="{up}assets/deck.js"></script>
</head>
"""


def switcher():
    btns = "".join(f'<a class="lang-btn" data-set-lang="{k}" href="?lang={k}">{k}</a>' for k in LOCALES)
    return f'<nav class="lang" aria-label="Language"><span>{t(CHROME["lang"])}:</span>{btns}</nav>'


def footer(up):
    return (f'<footer><span>{t(COPY)}</span><span>{t(SUB)} · {t(DATE)}</span>'
            f'<a href="{up}" data-keep-lang>{t(CHROME["home"])}</a></footer>')


def slide(i, n, s):
    kind, heading, body = s
    h = f"<h2>{t(heading)}</h2>" if kind != "lead" else f"<h1>{t(heading)}</h1>"
    if kind == "lead":
        inner = f'<p class="lead">{t(body)}</p>'
    elif kind == "list":
        inner = "<ul>" + "".join(f"<li>{t(x)}</li>" for x in body) + "</ul>"
    elif kind == "steps":
        inner = "<ol>" + "".join(f"<li>{t(x)}</li>" for x in body) + "</ol>"
    else:
        inner = '<div class="cards">' + "".join(
            f'<article><h3>{t(a)}</h3><p>{t(b)}</p></article>' for a, b in body) + "</div>"
    return f'<section class="slide{" cover" if kind == "lead" else ""}" id="s{i + 1}">{h}{inner}<span class="n">{i + 1} / {n}</span></section>\n'


def deck_page(d):
    n = len(d["slides"])
    body = "".join(slide(i, n, s) for i, s in enumerate(d["slides"]))
    return (HEAD.format(title=f'{d["title"]["en-US"]} · {TITLE_OWNER}', up="../") +
            f'<body data-deck="{d["slug"]}">\n<header><strong>{TITLE_OWNER}</strong>{switcher()}</header>\n'
            f'<main>\n{body}</main>\n'
            f'<div class="nav"><button id="prev">{t(CHROME["prev"])}</button><button id="next">{t(CHROME["next"])}</button></div>\n'
            f'{footer("../")}\n</body>\n</html>\n')


def index_page():
    cards = "".join(
        f'<article><h3>{t(d["title"])}</h3><p>{t(d["tag"])}</p>'
        f'<a class="btn" href="{d["slug"]}/" data-keep-lang>{t(CHROME["open"])}</a></article>' for d in DECKS)
    return (HEAD.format(title=f'{CHROME["index_title"]["en-US"]}', up="") +
            f'<body data-deck="index">\n<header><strong>{TITLE_OWNER}</strong>{switcher()}</header>\n'
            f'<main class="home"><h1>{t(CHROME["index_title"])}</h1><p class="lead">{t(CHROME["index_tag"])}</p>'
            f'<div class="cards">{cards}</div></main>\n{footer("")}\n</body>\n</html>\n')


CSS = """:root{--bg:#fff;--fg:#14213d;--mut:#5a6578;--card:#f3f5fa;--acc:#3b5bdb;--line:#d9deea}
@media (prefers-color-scheme:dark){:root{--bg:#0e1424;--fg:#e8ecf7;--mut:#9aa6c0;--card:#18213a;--acc:#8fa6ff;--line:#2a3556}}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--fg);font:17px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
header,footer{display:flex;flex-wrap:wrap;gap:.75rem 1.5rem;align-items:center;justify-content:space-between;padding:.75rem 16px;border-bottom:1px solid var(--line)}
footer{border:0;border-top:1px solid var(--line);color:var(--mut);font-size:.85rem}
a{color:var(--acc)}
.lang{display:flex;gap:.4rem;align-items:center;color:var(--mut);font-size:.9rem}
.lang-btn{padding:.2rem .6rem;border:1px solid var(--line);border-radius:999px;text-decoration:none;color:var(--fg)}
.lang-btn[aria-current=true]{background:var(--acc);color:var(--bg);border-color:var(--acc)}
.l{display:none}
html[data-lang=en-US] .l-en-US,html[data-lang=en-UK] .l-en-UK,html[data-lang=en-IN] .l-en-IN,html:not([data-lang]) .l-en-US{display:contents}
.slide{min-height:calc(100vh - 8rem);padding:3rem 16px;max-width:60rem;margin:0 auto;position:relative;border-bottom:1px dashed var(--line)}
.slide.cover{display:flex;flex-direction:column;justify-content:center}
h1{font-size:clamp(2rem,6vw,3.4rem);line-height:1.1;margin:.2em 0}h2{font-size:clamp(1.5rem,4vw,2.2rem);margin:0 0 1rem}h3{margin:.2rem 0}
.lead{font-size:1.25rem;color:var(--mut);max-width:40rem}
ul,ol{padding-left:1.3rem}li{margin:.5rem 0}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr));gap:1rem}
.cards article{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:1rem 1.2rem}
.cards p{margin:.3rem 0 0;color:var(--mut)}
.btn{display:inline-block;margin-top:.6rem;padding:.4rem .9rem;border-radius:8px;background:var(--acc);color:var(--bg);text-decoration:none}
.n{position:absolute;right:16px;bottom:1rem;color:var(--mut);font-size:.8rem}
.home{max-width:60rem;margin:0 auto;padding:3rem 16px;min-height:calc(100vh - 8rem)}
.nav{position:fixed;right:16px;bottom:3.6rem;display:flex;gap:.4rem}
.nav button{padding:.4rem .8rem;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--fg);cursor:pointer}
@media print{header,footer,.nav{display:none}.slide{page-break-after:always;border:0}}
"""

JS = """(function(){
  var OK={'en-US':'en-US','en-UK':'en-UK','en-GB':'en-UK','en-IN':'en-IN'};
  var HTML={'en-US':'en-US','en-UK':'en-GB','en-IN':'en-IN'};
  var key=(new URLSearchParams(location.search).get('lang')||'').toLowerCase();
  var lang='en-US';
  Object.keys(OK).forEach(function(k){if(k.toLowerCase()===key)lang=OK[k];});
  var root=document.documentElement;
  root.setAttribute('data-lang',lang);root.setAttribute('lang',HTML[lang]);
  function carry(){
    document.querySelectorAll('a[data-keep-lang]').forEach(function(a){
      var u=new URL(a.getAttribute('href'),location.href);u.searchParams.set('lang',lang);
      a.setAttribute('href',u.pathname+u.search+u.hash);
    });
    document.querySelectorAll('[data-set-lang]').forEach(function(b){
      var l=b.getAttribute('data-set-lang');
      b.setAttribute('aria-current',String(l===lang));
      b.setAttribute('href','?lang='+l+location.hash);
    });
  }
  document.addEventListener('DOMContentLoaded',function(){
    carry();
    var s=[].slice.call(document.querySelectorAll('.slide')),i=0;
    function go(d){if(!s.length)return;i=Math.max(0,Math.min(s.length-1,i+d));s[i].scrollIntoView({behavior:'smooth'});}
    var p=document.getElementById('prev'),n=document.getElementById('next');
    if(p)p.onclick=function(){go(-1)};if(n)n.onclick=function(){go(1)};
    document.addEventListener('keydown',function(e){
      if(e.key==='ArrowRight'||e.key==='PageDown'||e.key===' ')go(1);
      if(e.key==='ArrowLeft'||e.key==='PageUp')go(-1);
    });
  });
})();
"""


def main():
    (OUT / "assets").mkdir(parents=True, exist_ok=True)
    (OUT / "assets" / "deck.css").write_text(CSS, encoding="utf-8")
    (OUT / "assets" / "deck.js").write_text(JS, encoding="utf-8")
    (OUT / "index.html").write_text(index_page(), encoding="utf-8")
    for d in DECKS:
        (OUT / d["slug"]).mkdir(exist_ok=True)
        (OUT / d["slug"] / "index.html").write_text(deck_page(d), encoding="utf-8")
    print("wrote", OUT)


if __name__ == "__main__":
    main()
