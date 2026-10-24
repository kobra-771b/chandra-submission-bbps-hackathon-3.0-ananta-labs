"""Browser tests of the real page against the real host, with a scripted model (no AI service, no microphone).

They need Playwright and a Chromium it can start. If they are missing, the tests are skipped with the reason.
    pip install playwright && python -m playwright install chromium     (once, on the test machine)
    cd desktop/source && python -m unittest discover -s tests -v
Set CHANDRA_CHROMIUM to a Chromium/Chrome executable to use that browser instead.
"""
import importlib.util, json, os, tempfile, threading, time, unittest
from http.server import ThreadingHTTPServer
from pathlib import Path

SRC = Path(__file__).resolve().parents[1]
TMP = tempfile.mkdtemp(prefix="chandra-ui-")
os.environ.update(HOME=TMP, USERPROFILE=TMP, APPDATA=str(Path(TMP) / "AppData"), XDG_CONFIG_HOME=str(Path(TMP) / ".config"))
for k in ("ANTHROPIC_API_KEY", "GEMINI_API_KEY", "CHANDRA_CLAUDE_KEY"): os.environ.pop(k, None)
spec = importlib.util.spec_from_file_location("chandra_ui_test", SRC / "chandra.py")
C = importlib.util.module_from_spec(spec); spec.loader.exec_module(C)

try:
    from playwright.sync_api import sync_playwright
    PLAYWRIGHT = True
except ImportError:
    PLAYWRIGHT = False

SANDBOX_CHROMIUM = ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome"]
CLICK = "(w)=>{const b=[...document.querySelectorAll('#jvc button.chip')].find(x=>x.textContent===w);if(!b)return false;b.click();return true}"
STATE = {"script": [], "loop": None, "final": "done", "base": None, "requests": [], "on_step": None}
WINDOW = {"title": ""}
C.foreground_title = lambda: WINDOW["title"]
PHYSICAL_CALLS = []                                   # what the host would have clicked, typed or pressed
def picture(color, size=(640, 400)):
    from PIL import Image
    return Image.new("RGB", size, color)


class Patch:
    def __init__(self, obj, name, value): self.obj, self.name, self.value = obj, name, value
    def __enter__(self): self.old = getattr(self.obj, self.name); setattr(self.obj, self.name, self.value); return self
    def __exit__(self, *a): setattr(self.obj, self.name, self.old)

ORDINARY = lambda x=None, y=None: "none"              # what the picture says a step does; tests replace it
RAW_INPUT = {"_click_raw": "click", "_drag_raw": "drag", "_scroll_raw": "scroll", "_type_raw": "type", "_keys_raw": "keys"}


def fake_input(kind):
    def run(a):
        PHYSICAL_CALLS.append((kind, dict(a))); return {"ok": True}
    return run


def last_user_text(a):
    m = a["messages"][-1]["content"]
    return m if isinstance(m, str) else " ".join(x.get("text", "") for x in m if isinstance(x, dict))


def fake_brain(req):
    a = req.get("anthropic") or {}
    if not a.get("tools"):
        return {"kind": "anthropic", "data": {"content": [{"type": "text", "text": "ok"}], "stop_reason": "end_turn"}}
    idx = sum(1 for m in a["messages"] if m["role"] == "assistant")
    if STATE["base"] is None: STATE["base"] = idx
    idx -= STATE["base"]
    STATE["requests"].append(last_user_text(a))
    if STATE["on_step"]: STATE["on_step"](idx)
    if idx < len(STATE["script"]): steps = STATE["script"][idx]
    elif STATE["loop"]: steps = [STATE["loop"]]
    else: steps = [("finish", {"answer": STATE["final"]})]
    if steps == "CUT":           # a reply cut off at the length limit, half-way through a tool call
        return {"kind": "anthropic", "data": {"content": [{"type": "tool_use", "id": "cut%d" % idx, "name": "write_file",
                                                           "input": {"path": "Desktop/cut.html"}}], "stop_reason": "max_tokens"}}
    if steps == "EMPTY":
        return {"kind": "anthropic", "data": {"content": [], "stop_reason": "end_turn"}}
    return {"kind": "anthropic", "data": {"content": [{"type": "tool_use", "id": "t%d_%d" % (idx, j), "name": n, "input": i}
                                                      for j, (n, i) in enumerate(steps)], "stop_reason": "tool_use"}}


class UIFlows(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not PLAYWRIGHT:
            raise unittest.SkipTest("Playwright is not installed (pip install playwright)")
        cls.real_input = {n: getattr(C, n) for n in RAW_INPUT}
        for n, kind in RAW_INPUT.items(): setattr(C, n, fake_input(kind))
        cls.real_judge = C.judge_screen
        C.judge_screen = lambda x=None, y=None: STATE["judge"](x, y)
        C.brain = fake_brain
        C.CFG.update(shell=False, token=C.pairing_code())
        cls.srv = ThreadingHTTPServer(("127.0.0.1", 0), C.H); cls.port = cls.srv.server_address[1]; C.CFG["port"] = cls.port
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()
        cls.url = "http://127.0.0.1:%d/app/%s" % (cls.port, C.CFG["token"])
        cls.pw = sync_playwright().start()
        exe = os.environ.get("CHANDRA_CHROMIUM") or next((p for p in SANDBOX_CHROMIUM if Path(p).exists()), None)
        kw = {"executable_path": exe} if exe else {}
        try:
            cls.browser = cls.pw.chromium.launch(args=["--no-sandbox"], **kw)
        except Exception as e:
            cls.pw.stop(); cls.srv.shutdown()
            raise unittest.SkipTest("no Chromium for Playwright (python -m playwright install chromium): " + str(e)[:120])

    @classmethod
    def tearDownClass(cls):
        for n, f in getattr(cls, "real_input", {}).items(): setattr(C, n, f)
        if hasattr(cls, "real_judge"): C.judge_screen = cls.real_judge
        if PLAYWRIGHT and hasattr(cls, "browser"):
            cls.browser.close(); cls.pw.stop(); cls.srv.shutdown()

    def setUp(self):
        bridge = {"url": "http://127.0.0.1:%d" % self.port, "code": C.CFG["token"], "on": True}
        self.ctx = self.browser.new_context(viewport={"width": 1360, "height": 880})
        # once per tab: a reload keeps what the person did (the welcome, memory, the saved task)
        self.ctx.add_init_script("try{if(!sessionStorage.getItem('chandra-test-init')){sessionStorage.setItem('chandra-test-init','1');"
                                 "localStorage.setItem('chandra-watch','0');localStorage.setItem('chandra-rt-bridge',%s);"
                                 "localStorage.setItem('chandra-state',%s)}}catch(e){}"
                                 % (json.dumps(json.dumps(bridge)), json.dumps(json.dumps({"name": "Tester", "named": True}))))
        self.page = self.ctx.new_page(); self.errors = []
        self.page.on("pageerror", lambda e: self.errors.append(str(e)))
        STATE.update(script=[], loop=None, final="done", base=None, requests=[], on_step=None, judge=ORDINARY)
        WINDOW["title"] = ""
        PHYSICAL_CALLS.clear(); self.taps = []
        self.boot()

    def tearDown(self):
        self.ctx.close()
        self.assertEqual(self.errors, [], "the page raised errors")

    def boot(self):
        self.page.goto(self.url); self.page.wait_for_timeout(2000)
        if self.page.locator("#wbYes").count(): self.page.evaluate("document.querySelector('#wbYes').click()")
        self.page.wait_for_selector("#inp", state="visible", timeout=15000)
        self.page.wait_for_timeout(3200)            # the window's own start-up cards come and go

    def ask(self, text, answers=None, timeout=45):
        """Send a request. Tap the approval card choices given in answers ({card title start: button label}).
        Returns (cards seen, the card's title when it stopped)."""
        answers = answers or {}; cards = []; STATE["base"] = None; self.taps = []
        self.page.locator("#inp").fill(text); self.page.locator("#inp").press("Enter")
        t0 = time.time(); started = False
        while time.time() - t0 < timeout:
            self.page.wait_for_timeout(200)
            busy = self.page.evaluate("ChandraUnified.busy")
            labels = self.page.evaluate("[...document.querySelectorAll('#jvc button.chip')].map(x=>x.textContent)")
            head = self.page.locator("#jvh").inner_text()
            if busy: started = True
            # a card shown before the request starts (the welcome greeting) is not this request's card
            if labels and (started or time.time() - t0 > 4):
                if not cards or cards[-1] != head: cards.append(head)
                hit = [v for k, v in answers.items() if head.startswith(k) and v in labels]
                if hit:
                    self.taps.append((head, hit[0])); self.page.evaluate(CLICK, hit[0]); self.page.wait_for_timeout(250); continue
                if not busy: break
            if started and not busy and not labels: break
            if not started and not labels and time.time() - t0 > 4: break      # nothing started: the page did not act on it
        self.page.wait_for_timeout(700)
        return cards, self.page.locator("#jvh").inner_text()

    def stored_state(self):
        return json.loads(self.page.evaluate("localStorage.getItem('chandra-state')") or "{}")

    # ------------------------------------------------------------------ the flows
    # ------------------------------------------------------------------ permissions: ordinary work runs, a workflow asks once
    def wait_for_head(self, prefix, timeout=30):
        self.page.wait_for_function("(p)=>document.querySelector('#jvh').textContent.startsWith(p)", arg=prefix,
                                    timeout=timeout * 1000)

    def wait_done(self, timeout=30):
        self.page.wait_for_timeout(300)
        self.page.wait_for_function("()=>!ChandraUnified.busy", timeout=timeout * 1000)

    def say(self, text):
        self.page.locator("#inp").fill(text); self.page.locator("#inp").press("Enter")

    def test_routine_clicks_typing_keys_and_files_run_without_asking(self):
        WINDOW["title"] = "Untitled - Notepad"
        (Path(TMP) / "notes.txt").write_text("hi")
        STATE["script"] = [[("click", {"x": 10, "y": 10})], [("type_text", {"text": "hello"})],
                           [("press_keys", {"keys": "enter"})], [("read_file", {"path": "notes.txt"})],
                           [("organize_preview", {"path": "Downloads"})], [("finish", {"answer": "typed"})]]
        cards, final = self.ask("continue in the open window as planned")
        self.assertEqual([c for c in cards if c.startswith("Allow")], [], cards)
        self.assertEqual([k for k, _ in PHYSICAL_CALLS], ["click", "type", "keys"])
        self.assertEqual(final, "typed")

    def test_making_a_file_writes_it_to_disk(self):
        STATE["script"] = [[("write_file", {"path": "Desktop/calculator.html", "content": "<!doctype html><title>Calc</title>"})],
                           [("finish", {"answer": "Saved Desktop/calculator.html"})]]
        cards, final = self.ask("make me an html calculator")
        self.assertEqual([c for c in cards if c.startswith("Allow")], [], cards)
        self.assertEqual((Path(TMP) / "Desktop" / "calculator.html").read_text(), "<!doctype html><title>Calc</title>")
        self.assertEqual(final, "Saved Desktop/calculator.html")

    def test_a_reply_cut_off_mid_file_is_retried_in_parts(self):
        STATE["script"] = ["CUT", [("write_file", {"path": "Desktop/big.html", "content": "<p>one</p>\n"})],
                           [("write_file", {"path": "Desktop/big.html", "content": "<p>two</p>\n", "append": True})],
                           [("finish", {"answer": "big.html is on your Desktop"})]]
        cards, final = self.ask("make me a big html page")
        self.assertFalse((Path(TMP) / "Desktop" / "cut.html").exists(), "a half-written call must not run")
        self.assertIn("hit the length limit", " ".join(STATE["requests"]))
        self.assertEqual((Path(TMP) / "Desktop" / "big.html").read_text(), "<p>one</p>\n<p>two</p>\n")
        self.assertEqual(final, "big.html is on your Desktop")

    def test_an_empty_reply_that_did_nothing_is_not_called_done(self):
        STATE["script"] = ["EMPTY"]
        cards, final = self.ask("make me a file")
        self.assertNotEqual(final.strip(), "Done.")
        self.assertIn("nothing was made", final)

    def test_deleting_asks_once_for_the_task(self):
        for n in ("u1.txt", "u2.txt"): (Path(TMP) / n).write_text(n)
        STATE["script"] = [[("delete_path", {"path": "u1.txt"})], [("delete_path", {"path": "u2.txt"})], [("finish", {"answer": "deleted"})]]
        cards, final = self.ask("delete u1 and u2", answers={"Allow Chandra to delete": "Allow"})
        self.assertEqual(len(self.taps), 1, self.taps)
        self.assertFalse((Path(TMP) / "u1.txt").exists() or (Path(TMP) / "u2.txt").exists())
        self.assertEqual(final, "deleted")

    def test_a_new_task_asks_about_deleting_again(self):
        for n in ("n1.txt", "n2.txt"): (Path(TMP) / n).write_text(n)
        STATE["script"] = [[("delete_path", {"path": "n1.txt"})], [("finish", {"answer": "one"})]]
        self.ask("delete n1", answers={"Allow Chandra to delete": "Allow"})
        STATE["script"] = [[("delete_path", {"path": "n2.txt"})], [("finish", {"answer": "two"})]]
        self.ask("delete n2", answers={"Allow Chandra to delete": "Allow"})
        self.assertEqual(len(self.taps), 1, "a new task must ask again")
        self.assertFalse((Path(TMP) / "n2.txt").exists())

    def test_a_checkout_asks_once_at_the_final_commit(self):
        WINDOW["title"] = "Checkout - Example Shop"
        STATE["judge"] = lambda x=None, y=None: "pay" if (x, y) == (999, 999) else "none"
        STATE["script"] = [[("click", {"x": 1, "y": 1})], [("type_text", {"text": "12 High Street"})],
                           [("click", {"x": 999, "y": 999})], [("click", {"x": 999, "y": 999})], [("finish", {"answer": "paid"})]]
        cards, final = self.ask("place the order", answers={"Allow Chandra to place the order": "Allow"})
        self.assertEqual(len(self.taps), 1, self.taps)                       # the navigation and the form were not asked
        self.assertEqual([k for k, _ in PHYSICAL_CALLS], ["click", "type", "click", "click"])
        self.assertEqual(final, "paid")

    def test_a_checkpoint_yes_covers_the_commit_that_follows_it(self):
        WINDOW["title"] = "Checkout - Example Shop"
        STATE["judge"] = lambda x=None, y=None: "pay"
        STATE["script"] = [[("submit_checkpoint", {"action": "place the order for 2 items, 24 pounds"})],
                           [("click", {"x": 999, "y": 999})], [("finish", {"answer": "placed"})]]
        cards, final = self.ask("place the order", answers={"Allow Chandra to place the order": "Allow"})
        self.assertEqual(len(self.taps), 1, "one question for the whole purchase")
        self.assertEqual([k for k, _ in PHYSICAL_CALLS], ["click"])
        self.assertEqual(final, "placed")

    def test_a_denied_purchase_is_not_placed(self):
        WINDOW["title"] = "Checkout - Example Shop"
        STATE["judge"] = lambda x=None, y=None: "pay"
        STATE["script"] = [[("click", {"x": 1, "y": 1})], [("finish", {"answer": "not placed"})]]
        cards, final = self.ask("place the order", answers={"Allow Chandra to place the order": "Deny"})
        self.assertEqual(PHYSICAL_CALLS, [])
        self.assertEqual(final, "not placed")

    def test_a_message_is_drafted_freely_and_the_send_asks_once(self):
        WINDOW["title"] = "WhatsApp"
        STATE["script"] = [[("type_text", {"text": "see you at 5"})], [("press_keys", {"keys": "enter"})],
                           [("type_text", {"text": "running late"})], [("press_keys", {"keys": "enter"})], [("finish", {"answer": "sent"})]]
        cards, final = self.ask("send my messages", answers={"Allow Chandra to send": "Allow"})
        self.assertEqual(len(self.taps), 1, self.taps)                       # one question before the first send only
        self.assertEqual([k for k, _ in PHYSICAL_CALLS], ["type", "keys", "type", "keys"])
        self.assertEqual(final, "sent")

    def test_the_send_question_shows_the_text_that_will_be_sent(self):
        WINDOW["title"] = "WhatsApp"
        STATE["script"] = [[("type_text", {"text": "meet at the gate"})], [("press_keys", {"keys": "enter"})], [("finish", {"answer": "ok"})]]
        self.say("send it")
        self.wait_for_head("Allow Chandra to send")
        self.assertIn("meet at the gate", self.page.locator("#jvt").inner_text())
        self.page.evaluate(CLICK, "Allow"); self.wait_done()

    def test_a_send_button_click_is_asked_before_it_happens(self):
        WINDOW["title"] = "WhatsApp"
        STATE["judge"] = lambda x=None, y=None: "send"
        STATE["script"] = [[("click", {"x": 300, "y": 600})], [("finish", {"answer": "sent"})]]
        cards, final = self.ask("press send", answers={"Allow Chandra to send": "Allow"})
        self.assertEqual(len(self.taps), 1)
        self.assertEqual([k for k, _ in PHYSICAL_CALLS], ["click"])
        self.assertEqual(final, "sent")

    def test_a_missing_window_title_is_judged_and_asks_when_unsure(self):
        WINDOW["title"] = ""
        STATE["judge"] = lambda x=None, y=None: "unknown"
        STATE["script"] = [[("type_text", {"text": "a"})], [("type_text", {"text": "b"})], [("finish", {"answer": "done"})]]
        cards, final = self.ask("carry on with two letters in the open window", answers={"Allow Chandra to do this step": "Allow"})
        self.assertEqual(len(self.taps), 2, "a step it cannot identify asks every time")
        self.assertEqual(final, "done")

    def test_a_missing_window_title_with_an_ordinary_picture_runs_free(self):
        WINDOW["title"] = ""
        STATE["judge"] = lambda x=None, y=None: "none"
        STATE["script"] = [[("click", {"x": 5, "y": 5})], [("type_text", {"text": "x"})], [("finish", {"answer": "ok"})]]
        cards, final = self.ask("continue")
        self.assertEqual([c for c in cards if c.startswith("Allow")], [])
        self.assertEqual([k for k, _ in PHYSICAL_CALLS], ["click", "type"])

    def test_typing_a_password_on_a_sign_in_screen_asks_once_for_the_task(self):
        WINDOW["title"] = "Sign in - Example"
        STATE["script"] = [[("type_text", {"text": "first"})], [("type_text", {"text": "second"})], [("finish", {"answer": "entered"})]]
        cards, final = self.ask("continue on the sign-in page as planned", answers={"Allow Chandra to type": "Allow"})
        self.assertEqual(len(self.taps), 1, self.taps)
        self.assertEqual([k for k, _ in PHYSICAL_CALLS], ["type", "type"])     # typed only after the yes
        self.assertEqual(final, "entered")

    def test_a_spoken_yes_answers_the_question_and_covers_the_task(self):
        for n in ("v1.txt", "v2.txt"): (Path(TMP) / n).write_text(n)
        STATE["script"] = [[("delete_path", {"path": "v1.txt"})], [("delete_path", {"path": "v2.txt"})], [("finish", {"answer": "gone"})]]
        self.say("delete v1 and v2")
        self.wait_for_head("Allow Chandra to delete")
        self.page.wait_for_timeout(1600)              # the question is spoken first; an answer comes after it
        self.assertTrue(self.page.evaluate("window.chandraAnswer('yes')"))
        self.wait_done()
        self.assertFalse((Path(TMP) / "v1.txt").exists() or (Path(TMP) / "v2.txt").exists())
        self.assertEqual(self.page.locator("#jvh").inner_text(), "gone")

    def test_a_spoken_no_keeps_the_file(self):
        (Path(TMP) / "k.txt").write_text("k")
        STATE["script"] = [[("delete_path", {"path": "k.txt"})], [("finish", {"answer": "kept"})]]
        self.say("delete k")
        self.wait_for_head("Allow Chandra to delete")
        self.page.wait_for_timeout(1600)
        self.assertTrue(self.page.evaluate("window.chandraAnswer('no thanks')"))
        self.wait_done()
        self.assertTrue((Path(TMP) / "k.txt").exists())
        self.assertEqual(self.page.locator("#jvh").inner_text(), "kept")

    def test_a_remark_that_is_not_an_answer_keeps_the_question_open(self):
        (Path(TMP) / "m.txt").write_text("m")
        STATE["script"] = [[("delete_path", {"path": "m.txt"})], [("finish", {"answer": "ok done"})]]
        self.say("delete m")
        self.wait_for_head("Allow Chandra to delete")
        self.page.wait_for_timeout(1600)
        self.assertTrue(self.page.evaluate("window.chandraAnswer('banana')"))
        self.assertTrue(self.page.evaluate("window.chandraAnswer('Say yes or no.')"))   # the question heard back: not an answer
        self.page.wait_for_timeout(400)
        self.assertTrue(self.page.locator("#jvh").inner_text().startswith("Allow Chandra to delete"))
        self.assertTrue((Path(TMP) / "m.txt").exists())
        self.assertTrue(self.page.evaluate("window.chandraAnswer('yes')"))
        self.wait_done()
        self.assertFalse((Path(TMP) / "m.txt").exists())

    def test_dismissing_the_question_is_a_no(self):
        (Path(TMP) / "d.txt").write_text("d")
        STATE["script"] = [[("delete_path", {"path": "d.txt"})], [("finish", {"answer": "left alone"})]]
        self.say("delete d")
        self.wait_for_head("Allow Chandra to delete")
        self.page.evaluate("document.querySelector('#jvc button[data-x]').click()")
        self.wait_done()                              # a dismissed question must not leave the run waiting forever
        self.assertTrue((Path(TMP) / "d.txt").exists())
        self.assertEqual(self.page.locator("#jvh").inner_text(), "left alone")

    def test_the_first_run_asks_for_no_permissions(self):
        ctx = self.browser.new_context(viewport={"width": 1360, "height": 880})
        page = ctx.new_page(); seen = []
        try:
            page.goto(self.url); page.wait_for_timeout(1500)
            for _ in range(6):
                seen.append(page.evaluate("document.querySelector('#ob')?.innerText || ''"))
                if not page.evaluate("!!document.querySelector('#nx')"): break
                page.evaluate("(()=>{const n=document.querySelector('#nm');if(n)n.value='Tester';document.querySelector('#nx').click()})()")
                page.wait_for_timeout(900)
            text = " ".join(seen)
            self.assertNotIn("Choose what Chandra can use", text)
            self.assertNotIn("Keyboard & Mouse", text)
            self.assertNotIn("Type and click for you", text)
            self.assertTrue(any("Start" in t or "ready" in t.lower() for t in seen), seen[-1:])
        finally:
            ctx.close()

    def test_screen_reads_come_from_the_computer_bridge_not_a_browser_share_prompt(self):
        with Patch(C, "_grab", lambda: picture((200, 200, 200), (1280, 800))):
            width = self.page.evaluate("(async()=>{const c=await window.chandraHostFrame();return c?c.width:0})()")
        self.assertEqual(width, 1280)

    def test_memory_suggestion_is_kept_only_when_the_person_says_yes(self):
        STATE["script"] = [[("propose_memory", {"text": "Prefers short answers"})], [("finish", {"answer": "noted"})]]
        cards, final = self.ask("how should you answer me", answers={"Remember this?": "Remember"})
        self.assertIn("Remember this?", cards)
        self.assertIn("Prefers short answers", [m[0] for m in self.stored_state().get("mem", [])])
        STATE["script"] = [[("propose_memory", {"text": "Likes green tea"})], [("finish", {"answer": "ok"})]]
        self.ask("anything else", answers={"Remember this?": "Not now"})
        self.assertNotIn("Likes green tea", [m[0] for m in self.stored_state().get("mem", [])])

    def test_a_long_task_keeps_its_plan_and_resumes_after_the_step_limit(self):
        STATE["script"] = [[("set_plan", {"steps": ["find the file", "copy it", "write the summary"]})],
                           [("update_plan", {"step": 1, "status": "done"})]]
        STATE["loop"] = ("wait", {"ms": 1})                       # never finishes on its own
        cards, final = self.ask("prepare the quarterly report folder: find, copy, summarise")
        self.assertIn("used my 120 steps", final)
        saved = json.loads(self.page.evaluate("localStorage.getItem('chandra-task')") or "null")
        self.assertIsNotNone(saved)
        self.assertEqual([p["status"] for p in saved["plan"]], ["done", "todo", "todo"])
        self.assertIn("quarterly report", saved["goal"])
        # the window offers the unfinished task again after a restart
        STATE["loop"] = None; STATE["final"] = "resumed and finished"
        self.boot()                                                # a start shows "Welcome back" first; the offer waits for it
        self.page.wait_for_function("document.querySelector('#jvh').textContent.startsWith('Unfinished task')", timeout=15000)
        self.assertTrue(self.page.locator("#jvh").inner_text().startswith("Unfinished task"))
        self.page.evaluate("[...document.querySelectorAll('#jvc button.chip')].find(x=>x.textContent==='Continue').click()")
        self.page.wait_for_timeout(4000)
        self.assertTrue(any("Continue this unfinished task" in r for r in STATE["requests"]), STATE["requests"][-1:])
        self.assertIn("[done] find the file", " ".join(STATE["requests"]))
        self.assertIsNone(self.page.evaluate("localStorage.getItem('chandra-task')"))

    def test_an_organize_request_runs_without_asking_and_undo_restores(self):
        dl = Path(TMP) / "Downloads"; dl.mkdir(exist_ok=True)
        for n in ("a.jpg", "c.pdf"): (dl / n).write_text(n)
        STATE["script"] = [[("organize_preview", {"path": "Downloads"})], [("organize_folder", {"path": "Downloads"})],
                           [("finish", {"answer": "Organized your Downloads."})]]
        cards, final = self.ask("organize my Downloads folder")
        self.assertEqual([c for c in cards if c.startswith("Allow")], [], cards)     # the answer card is not an approval
        self.assertTrue((dl / "Images" / "a.jpg").exists() and (dl / "Documents" / "c.pdf").exists())
        STATE["script"] = [[("undo_last", {})], [("finish", {"answer": "undone"})]]
        self.ask("undo")
        self.assertTrue((dl / "a.jpg").exists() and (dl / "c.pdf").exists())

    def test_the_rail_has_diagnostics_where_activity_was(self):
        navs = self.page.evaluate("[...document.querySelectorAll('#nav button')].map(b=>b.dataset.v)")
        self.assertIn("activity", navs)
        self.assertEqual(self.page.evaluate("document.querySelector('#nav button[data-v=activity]').getAttribute('aria-label')"), "Diagnostics")


if __name__ == "__main__":
    unittest.main()
