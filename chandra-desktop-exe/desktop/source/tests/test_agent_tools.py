"""Host-side tests for the audit fixes: screen text without Tesseract, verified actions, search that survives a
changed results page, research in one step, the computer profile, Windows volume and brightness (PowerShell, stubbed
here), and plain-language messages. Standard library plus Pillow. No real clicks, no real network.

    cd desktop/source && python -m unittest discover -s tests -v
"""
import importlib.util, os, re, sys, tempfile, types, unittest
from pathlib import Path
from PIL import Image

TMP = tempfile.mkdtemp(prefix="chandra-agent-")
os.environ.update(HOME=TMP, USERPROFILE=TMP, APPDATA=str(Path(TMP) / "AppData"), XDG_CONFIG_HOME=str(Path(TMP) / ".config"))
for k in ("ANTHROPIC_API_KEY", "GEMINI_API_KEY", "CHANDRA_CLAUDE_KEY"): os.environ.pop(k, None)
SRC = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("chandra_host_agent_test", SRC / "chandra.py")
C = importlib.util.module_from_spec(spec)
spec.loader.exec_module(C)


def picture(color, size=(320, 200)):
    return Image.new("RGB", size, color)


class FakeGui:
    """Stands in for pyautogui: records what would have been clicked or typed, and does nothing on screen."""
    def __init__(self): self.calls = []
    def click(self, x, y, **kw): self.calls.append(("click", x, y))
    def moveTo(self, x, y, **kw): self.calls.append(("move", x, y))
    def dragTo(self, x, y, **kw): self.calls.append(("drag", x, y))
    def scroll(self, n): self.calls.append(("scroll", n))
    def write(self, s, **kw): self.calls.append(("write", s))
    def press(self, k): self.calls.append(("press", k))
    def hotkey(self, *k): self.calls.append(("hotkey", k))
    size = staticmethod(lambda: (1920, 1080))
    KEYBOARD_KEYS = {"enter", "tab", "esc", "ctrl", "c", "v", "shift", "alt", "win"}


class Patch:
    """Temporarily replace an attribute of a module, or an entry of a dict such as sys.modules."""
    _gone = object()
    def __init__(self, obj, name, value): self.obj, self.name, self.value = obj, name, value
    def __enter__(self):
        if isinstance(self.obj, dict):
            self.old = self.obj.get(self.name, self._gone); self.obj[self.name] = self.value
        else:
            self.old = getattr(self.obj, self.name); setattr(self.obj, self.name, self.value)
        return self
    def __exit__(self, *a):
        if isinstance(self.obj, dict):
            if self.old is self._gone: self.obj.pop(self.name, None)
            else: self.obj[self.name] = self.old
        else:
            setattr(self.obj, self.name, self.old)


class ScreenText(unittest.TestCase):
    def test_without_tesseract_the_vision_model_reads_the_screen(self):
        asked = {}
        def fake_brain(req):
            asked["text"] = req["openai"]["messages"][0]["content"][1]["text"]
            return {"kind": "openai", "data": {"choices": [{"message": {"content": "File  Edit\nSave"}}]}}
        with Patch(C, "_grab", lambda: picture("white")), Patch(C, "brain", fake_brain), \
             Patch(os, "environ", dict(os.environ, GEMINI_API_KEY="k-test-1234567890")):
            out = C.t_screen_text({})
        self.assertEqual(out["method"], "vision")
        self.assertIn("File  Edit", out["text"])
        self.assertIn("List the text", asked["text"])

    def test_without_a_key_it_says_what_is_needed(self):
        with Patch(C, "_grab", lambda: picture("white")), Patch(os, "environ", {}):
            with self.assertRaises(RuntimeError) as cm: C.t_screen_text({})
        self.assertIn("Claude or Gemini key", str(cm.exception))


class VerifiedActions(unittest.TestCase):
    def run_click(self, before, after):
        gui = FakeGui(); frames = iter([before, after])
        with Patch(C, "_gui", lambda: gui), Patch(C, "_grab", lambda: next(frames)), Patch(C, "VERIFY_WAIT", 0), \
             Patch(C, "_xy", lambda x, y: (x, y)):
            return C.t_click({"x": 100, "y": 50}), gui

    def test_a_click_that_changes_the_screen_is_reported_as_changed(self):
        out, gui = self.run_click(picture("white"), picture("black"))
        self.assertTrue(out["screen_changed"]); self.assertNotIn("note", out)
        self.assertEqual(gui.calls[0][0], "click")

    def test_a_click_that_changes_nothing_says_so(self):
        out, _ = self.run_click(picture("white"), picture("white"))
        self.assertFalse(out["screen_changed"])
        self.assertIn("did not visibly change", out["note"])

    def test_when_the_screen_cannot_be_read_the_result_says_unknown(self):
        gui = FakeGui(); calls = {"n": 0}
        def flaky():
            calls["n"] += 1
            if calls["n"] == 1: raise RuntimeError("no display")
            return picture("white")
        with Patch(C, "_gui", lambda: gui), Patch(C, "_grab", flaky), Patch(C, "VERIFY_WAIT", 0), Patch(C, "_xy", lambda x, y: (x, y)):
            out = C.t_click({"x": 1, "y": 1})
        self.assertIsNone(out["screen_changed"])
        self.assertEqual(gui.calls[0][0], "click")          # the action still ran

    def test_typing_and_keys_are_verified_too(self):
        gui = FakeGui(); frames = iter([picture("white"), picture("black")] * 2)
        with Patch(C, "_gui", lambda: gui), Patch(C, "_grab", lambda: next(frames)), Patch(C, "VERIFY_WAIT", 0), Patch(C, "_xy", lambda x, y: (x, y)):
            self.assertTrue(C.t_type_text({"text": "hi"})["screen_changed"])
            self.assertTrue(C.t_press_keys({"keys": "enter"})["screen_changed"])

    def test_active_window_reports_the_focused_title(self):
        with Patch(C, "foreground_title", lambda: "Inbox - Outlook"):
            self.assertEqual(C.t_active_window({})["title"], "Inbox - Outlook")


class Search(unittest.TestCase):
    OLD = ('<div class="result results_links"><h2 class="result__title"><a rel="nofollow" class="result__a" '
           'href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fen.wikipedia.org%2Fwiki%2FBicycle&amp;rut=x">Bicycle - Wikipedia</a></h2>'
           '<a class="result__snippet" href="x">A bicycle is a human-powered vehicle.</a></div>')
    LITE = ("<a rel=\"nofollow\" href=\"https://example.org/a\" class='result-link'>Example A</a></td>"
            "<td class='result-snippet'>Snippet for A.</td>")

    def test_reads_the_html_results_page(self):
        r = C._parse_search(self.OLD)
        self.assertEqual(r, [{"title": "Bicycle - Wikipedia", "url": "https://en.wikipedia.org/wiki/Bicycle",
                              "snippet": "A bicycle is a human-powered vehicle."}])

    def test_reads_the_lite_results_page(self):
        self.assertEqual(C._parse_search(self.LITE)[0]["snippet"], "Snippet for A.")

    def test_only_web_addresses_are_kept(self):
        bad = '<a class="result__a" href="javascript:alert(1)">Evil</a>'
        self.assertEqual(C._parse_search(bad), [])

    def test_falls_back_to_the_second_page_when_the_first_has_changed(self):
        def fake_get(url, timeout=20):
            if "lite." in url: return self.LITE
            return "<html>a completely different layout</html>"
        with Patch(C, "_get", fake_get):
            out = C.t_web_search({"query": "bicycles"})
        self.assertEqual(out["results"][0]["url"], "https://example.org/a")

    def test_says_when_nothing_could_be_read(self):
        with Patch(C, "_get", lambda url, timeout=20: "<html></html>"):
            out = C.t_web_search({"query": "nothing here"})
        self.assertEqual(out["results"], []); self.assertIn("No results", out["note"])


class Research(unittest.TestCase):
    def test_reads_the_top_pages_together_and_keeps_the_addresses(self):
        results = [{"title": "A", "url": "https://a.example/x", "snippet": "sa"},
                   {"title": "B", "url": "https://b.example/y", "snippet": "sb"},
                   {"title": "C", "url": "https://c.example/z", "snippet": "sc"}]
        def fetch(a):
            if "b.example" in a["url"]: raise RuntimeError("blocked")
            return {"text": "text of " + a["url"]}
        with Patch(C, "t_web_search", lambda a: {"results": results}), Patch(C, "t_web_fetch", fetch):
            out = C.t_web_research({"query": "q", "sources": 2})
        self.assertEqual([s["url"] for s in out["sources"]], ["https://a.example/x", "https://b.example/y"])
        self.assertEqual(out["sources"][0]["text"], "text of https://a.example/x")
        self.assertIn("blocked", out["sources"][1]["error"])
        self.assertIn("Cite", out["note"])

    def test_no_results_is_said_plainly(self):
        with Patch(C, "t_web_search", lambda a: {"results": []}):
            self.assertEqual(C.t_web_research({"query": "q"})["sources"], [])


class Profile(unittest.TestCase):
    def test_folders_and_onedrive_folders_are_found(self):
        home = Path(tempfile.mkdtemp(prefix="chandra-home-"))
        (home / "Documents").mkdir(); (home / "OneDrive" / "Desktop").mkdir(parents=True)
        with Patch(C, "HOME", home):
            out = C.t_computer_profile({})
        self.assertTrue(out["folders"]["Documents"].endswith("Documents"))
        self.assertTrue(out["folders"]["Desktop"].endswith(os.path.join("OneDrive", "Desktop")))
        self.assertEqual(out["folders"]["Music"], "")

    def test_installed_apps_from_desktop_entries(self):
        home = Path(tempfile.mkdtemp(prefix="chandra-home-"))
        apps = home / ".local" / "share" / "applications"; apps.mkdir(parents=True)
        (apps / "zed-test.desktop").write_text("[Desktop Entry]\nName=Zed Test Editor\nExec=zed\n")
        with Patch(C, "HOME", home):
            self.assertIn("Zed Test Editor", C._installed_apps())

    def test_windows_uninstall_list_is_read_and_system_components_skipped(self):
        class Key: 
            def __init__(self, data): self.data = data
        tree = {"Uninstall": ["Office", "Hotfix", "Greenshot"],
                "Office": {"DisplayName": ("Microsoft Office", 1)},
                "Hotfix": {"DisplayName": ("Update KB1", 1), "SystemComponent": (1, 4)},
                "Greenshot": {"DisplayName": ("Greenshot", 1)}}
        fake = types.SimpleNamespace(HKEY_LOCAL_MACHINE=1, HKEY_CURRENT_USER=2)
        def OpenKey(hive, path):
            if path.endswith("Uninstall"): return tree["Uninstall"]
            return path.split("\\")[-1]
        def EnumKey(key, i):
            if isinstance(key, list):
                if i >= len(key): raise OSError
                return key[i]
            raise OSError
        def QueryValueEx(k, name):
            if isinstance(k, str) and k in tree:
                v = tree[k].get(name)
                if v is None: raise OSError
                return v
            raise OSError
        fake.OpenKey = OpenKey; fake.EnumKey = EnumKey; fake.QueryValueEx = QueryValueEx
        with Patch(C, "OS", "Windows"), Patch(sys.modules, "winreg", fake):
            names = C._installed_apps()
        self.assertIn("Microsoft Office", names); self.assertIn("Greenshot", names)
        self.assertNotIn("Update KB1", names)


class WindowsVolumeAndBrightness(unittest.TestCase):
    """These run PowerShell on Windows. Here the PowerShell call is replaced, so only the script and the messages are checked."""
    def test_volume_script_sets_the_default_speakers(self):
        seen = {}
        with Patch(C, "OS", "Windows"), Patch(C, "_powershell", lambda s, timeout=25: seen.setdefault("s", s) and ""):
            C.t_set_volume({"level": 42})
        self.assertIn("0.42", seen["s"]); self.assertIn("GetDefaultAudioEndpoint", seen["s"])
        self.assertIn("SetMasterVolumeLevelScalar", seen["s"])

    def test_volume_failure_is_said_in_plain_words(self):
        def boom(s, timeout=25): raise RuntimeError("Add-Type failed")
        with Patch(C, "OS", "Windows"), Patch(C, "_powershell", boom):
            with self.assertRaises(RuntimeError) as cm: C.t_set_volume({"level": 10})
        self.assertIn("Could not change the volume", str(cm.exception)); self.assertNotIn("pip", str(cm.exception))

    def test_brightness_on_a_desktop_monitor_says_it_is_not_supported(self):
        with Patch(C, "OS", "Windows"), Patch(C, "_powershell", lambda s, timeout=25: "none"):
            with self.assertRaises(RuntimeError) as cm: C.t_set_brightness({"level": 30})
        self.assertIn("does not support", str(cm.exception))

    def test_brightness_on_a_laptop_panel_is_set(self):
        seen = {}
        def ps(s, timeout=25):
            seen["s"] = s; return "ok"
        with Patch(C, "OS", "Windows"), Patch(C, "_powershell", ps):
            self.assertEqual(C.t_set_brightness({"level": 30})["level"], 30)
        self.assertIn("WmiSetBrightness(1, 30)", seen["s"])


class Messages(unittest.TestCase):
    def test_no_user_message_asks_people_to_run_pip(self):
        src = (SRC / "chandra.py").read_text(encoding="utf-8")
        user_lines = [ln for ln in src.splitlines() if re.search(r'(RuntimeError|raise)\(.*"', ln) and "pip" in ln]
        self.assertEqual(user_lines, [], "\n".join(user_lines))


class RiskOfActions(unittest.TestCase):
    """Which steps run with no question, which ask once for a workflow, and what a yes covers. The window title and the
    picture judgement are stubbed here, so every case is deterministic. Real judging is tested in JudgeScreen."""
    def risk(self, title, name, args=None, judge="none"):
        calls = []
        def fake_judge(x=None, y=None):
            calls.append((x, y)); return judge
        with Patch(C, "foreground_title", lambda: title), Patch(C, "judge_screen", fake_judge):
            r = C.risk_of(name, args or {})
        self.last_calls = calls
        return r

    def test_ordinary_windows_run_without_a_question_and_are_not_judged(self):
        for title in ("Untitled - Notepad", "Calculator", "Google - Chrome", "Downloads"):
            for name, args in (("click", {"x": 1, "y": 2}), ("drag", {"x": 1, "y": 2, "x2": 3, "y2": 4}),
                               ("scroll", {"dy": 3}), ("type_text", {"text": "hello"}), ("press_keys", {"keys": "enter"})):
                self.assertEqual(self.risk(title, name, args, judge="pay")["risk"], "low", (title, name))
                self.assertEqual(self.last_calls, [], (title, name))           # no picture is read for these
        for name, args in (("open_app", {"name": "calc"}), ("read_file", {"path": "a.txt"}),
                           ("organize_folder", {"path": "Downloads"}), ("move_path", {"src": "a", "dst": "b"})):
            self.assertEqual(self.risk(None, name, args, judge="pay")["risk"], "low", name)

    def test_a_checkout_asks_only_at_the_final_commit(self):
        title = "Checkout - Example Shop"
        self.assertEqual(self.risk(title, "click", {"x": 1, "y": 2}, judge="none")["risk"], "low")      # a navigation click
        self.assertEqual(self.risk(title, "type_text", {"text": "12 High Street"})["risk"], "low")      # filling a form
        self.assertEqual(self.risk(title, "scroll", {"dy": 5}, judge="pay")["risk"], "low")             # scrolling commits nothing
        r = self.risk(title, "click", {"x": 640, "y": 500}, judge="pay")
        self.assertEqual((r["risk"], r["kind"], r["scope"]), ("sensitive", "pay", "task"))
        self.assertEqual(r["key"], "pay:checkout - example shop")
        self.assertEqual(self.last_calls, [(640, 500)])                 # the picture is read at the click point

    def test_enter_on_a_payment_page_is_judged_too(self):
        self.assertEqual(self.risk("Your Bank - Payments", "press_keys", {"keys": "enter"}, judge="none")["risk"], "low")
        self.assertEqual(self.risk("Your Bank - Payments", "press_keys", {"keys": "enter"}, judge="pay")["kind"], "pay")

    def test_a_message_is_drafted_freely_and_the_send_asks_once(self):
        self.assertEqual(self.risk("WhatsApp", "type_text", {"text": "see you at 5"})["risk"], "low")     # drafting
        r = self.risk("WhatsApp", "press_keys", {"keys": "enter"})
        self.assertEqual((r["risk"], r["kind"], r["scope"], r["key"]), ("sensitive", "send", "task", "send:whatsapp"))
        self.assertEqual(self.risk("WhatsApp", "click", {"x": 1, "y": 2}, judge="none")["risk"], "low")  # opening a chat
        self.assertEqual(self.risk("WhatsApp", "click", {"x": 1, "y": 2}, judge="send")["kind"], "send") # the Send button

    def test_typing_with_enter_in_a_mail_window_is_a_send(self):
        r = self.risk("Inbox - Gmail", "type_text", {"text": "hi", "enter": True})
        self.assertEqual((r["kind"], r["scope"]), ("send", "task"))

    def test_a_missing_window_title_is_judged_never_skipped(self):
        self.assertEqual(self.risk("", "click", {"x": 1, "y": 2}, judge="none")["risk"], "low")
        self.assertEqual(self.last_calls, [(1, 2)])                       # judged, and the picture said ordinary
        self.assertEqual(self.risk("", "click", {"x": 1, "y": 2}, judge="pay")["kind"], "pay")
        self.assertEqual(self.risk(None, "press_keys", {"keys": "enter"}, judge="send")["kind"], "send")
        self.assertEqual(self.risk(None, "type_text", {"text": "x"}, judge="password")["kind"], "credentials")
        r = self.risk("", "click", {"x": 1, "y": 2}, judge="unknown")
        self.assertEqual((r["risk"], r["kind"], r["scope"]), ("sensitive", "unknown", "every"))

    def test_sign_in_screens_ask_once_per_window_for_the_task(self):
        self.assertEqual(self.risk("Sign in - Example", "click", {"x": 1, "y": 2}, judge="none")["risk"], "low")
        r = self.risk("Sign in - Example", "type_text", {"text": "someone"})
        self.assertEqual((r["risk"], r["kind"], r["scope"], r["key"]), ("sensitive", "credentials", "task", "credentials:sign in - example"))
        self.assertEqual(self.risk("Sign in - Bank", "type_text", {"text": "me"})["kind"], "credentials")   # sign-in wins over bank
        self.assertEqual(self.risk("Windows Security", "press_keys", {"keys": "tab"})["kind"], "credentials")

    def test_deleting_asks_once_for_the_task(self):
        r = self.risk(None, "delete_path", {"path": "report.docx"})
        self.assertEqual((r["risk"], r["kind"], r["scope"], r["key"]), ("sensitive", "delete", "task", "delete"))
        self.assertIn("report.docx", r["why"])

    def test_shell_commands_that_only_look_run_without_a_question(self):
        for cmd in ("dir C:\\", "ls -la", "cat notes.txt", "git status", "git log --oneline", "whoami"):
            self.assertEqual(self.risk(None, "run_shell", {"command": cmd})["risk"], "low", cmd)
        for cmd in ("del *.txt", "rm -rf x", "git push", "echo hi > a.txt", "dir & del x", "dir | rm", "", "$(rm x)"):
            r = self.risk(None, "run_shell", {"command": cmd})
            self.assertEqual((r["risk"], r["kind"], r["scope"]), ("sensitive", "shell", "task"), cmd)
        self.assertFalse(C.read_only_command("dir; del x"))

    def test_web_requests_only_ask_when_they_send_data(self):
        self.assertEqual(self.risk(None, "http_request", {"url": "https://a.test/x"})["risk"], "low")
        self.assertEqual(self.risk(None, "http_request", {"url": "https://a.test/x", "method": "head"})["risk"], "low")
        r = self.risk(None, "http_request", {"url": "https://api.example.com/v1/items", "method": "POST"})
        self.assertEqual((r["risk"], r["kind"], r["scope"]), ("sensitive", "web-send", "task"))
        self.assertIn("api.example.com", r["why"])

    def test_submitting_a_checkpoint_always_asks(self):
        r = self.risk(None, "submit_checkpoint", {"action": "send the invoice to Sam"})
        self.assertEqual((r["risk"], r["kind"], r["scope"]), ("sensitive", "commit", "every"))

    def test_the_page_can_ask_the_host_through_the_bridge_tool(self):
        self.assertIn("assess_action", C.TOOLS)
        with Patch(C, "foreground_title", lambda: "WhatsApp"):
            out = C.run_tool("assess_action", {"tool": "press_keys", "args": {"keys": "enter"}})
        self.assertEqual(out["result"]["kind"], "send")
        self.assertEqual(C.run_tool("assess_action", {"tool": "read_file", "args": {}})["result"]["risk"], "low")


class JudgeScreen(unittest.TestCase):
    """The picture judgement itself: it reads the screen around the click, asks the vision model, and says 'unknown'
    whenever it cannot read the answer (no screen, no key, an unexpected answer)."""
    def test_the_answer_word_is_taken_from_the_model_reply(self):
        for reply, want in (("send", "send"), ("Pay.", "pay"), ("The step is a PASSWORD entry", "password"), ("none", "none")):
            with Patch(C, "_grab", lambda: picture((200, 200, 200), (1280, 800))), Patch(C, "_vision_call", lambda im, ask, reply=reply: reply):
                self.assertEqual(C.judge_screen(600, 400), want, reply)

    def test_an_unexpected_answer_is_unknown(self):
        with Patch(C, "_grab", lambda: picture((200, 200, 200))), Patch(C, "_vision_call", lambda im, ask: "maybe?"):
            self.assertEqual(C.judge_screen(10, 10), "unknown")

    def test_no_screen_or_no_key_is_unknown_not_safe(self):
        def no_screen(): raise RuntimeError("Screen capture failed")
        with Patch(C, "_grab", no_screen):
            self.assertEqual(C.judge_screen(10, 10), "unknown")
        def no_key(im, ask): raise RuntimeError("Reading the screen needs a Claude or Gemini key")
        with Patch(C, "_grab", lambda: picture((200, 200, 200))), Patch(C, "_vision_call", no_key):
            self.assertEqual(C.judge_screen(), "unknown")

    def test_the_picture_is_cut_around_the_point_and_marked(self):
        seen = {}
        def vision(im, ask):
            raw = im.convert("RGB").tobytes()
            seen["size"] = im.size; seen["red"] = sum(1 for i in range(0, len(raw), 3) if raw[i] > 200 and raw[i + 1] < 60 and raw[i + 2] < 60)
            return "none"
        with Patch(C, "_grab", lambda: picture((200, 200, 200), (1280, 800))), Patch(C, "_vision_call", vision):
            C.judge_screen(640, 400)
        self.assertEqual(seen["size"], (640, 320))
        self.assertGreater(seen["red"], 0)


class Gating(unittest.TestCase):
    def test_new_tools_are_registered(self):
        for t in ("active_window", "web_research", "computer_profile"):
            self.assertIn(t, C.TOOLS)

    def test_verified_actions_still_respect_stop_all(self):
        C.HALT.set()
        try:
            out = C.run_tool("click", {"x": 1, "y": 1})
        finally:
            C.HALT.clear()
        self.assertIn("Halted", out.get("error", ""))


if __name__ == "__main__":
    unittest.main()
