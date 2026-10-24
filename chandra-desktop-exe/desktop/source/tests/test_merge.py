"""Host-side tests for what 1.5 brought together: Setup_1's utility (safer file tools, undo checks,
everyday skills, the Gemini brain, semantic memory, diagnostics) and the natural voice. Standard library only.

    cd desktop/source && python -m unittest discover -s tests -v

Runs against a throwaway home folder and never calls a real API: every network call is replaced.
"""
import base64, importlib.util, json, os, tempfile, threading, time, unittest, urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

TMP = tempfile.mkdtemp(prefix="chandra-test-")
os.environ.update(HOME=TMP, USERPROFILE=TMP, APPDATA=str(Path(TMP) / "AppData"), XDG_CONFIG_HOME=str(Path(TMP) / ".config"))
for k in ("ANTHROPIC_API_KEY", "CHANDRA_CLAUDE_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY", "CHANDRA_BRAIN", "CHANDRA_TTS_VOICE"):
    os.environ.pop(k, None)
SRC = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("chandra_host_merge_test", SRC / "chandra.py")
C = importlib.util.module_from_spec(spec)
spec.loader.exec_module(C)


class Keys:
    """Set API keys for one test, and put the environment back afterwards."""
    def __init__(self, **kv): self.kv = kv
    def __enter__(self):
        self.old = {k: os.environ.get(k) for k in self.kv}
        os.environ.update({k: v for k, v in self.kv.items() if v is not None})
        for k, v in self.kv.items():
            if v is None: os.environ.pop(k, None)
    def __exit__(self, *a):
        for k, v in self.old.items():
            if v is None: os.environ.pop(k, None)
            else: os.environ[k] = v


class Patch:
    def __init__(self, name, fn): self.name, self.fn = name, fn
    def __enter__(self): self.old = getattr(C, self.name); setattr(C, self.name, self.fn)
    def __exit__(self, *a): setattr(C, self.name, self.old)


class FileSafety(unittest.TestCase):
    def test_data_folder_and_key_file_are_off_limits(self):
        with self.assertRaises(RuntimeError): C._safe(str(C.STORE / "chandra-data.json"))
        with self.assertRaises(RuntimeError): C._safe(str(C.STORE / "chandra.env"))
        with self.assertRaises(RuntimeError): C._safe("/etc/passwd")

    def test_move_and_delete_never_take_chandra_or_home_along(self):
        with self.assertRaises(RuntimeError): C._safe(str(C.HOME), change=True)
        parent = C.STORE.parent
        if parent != C.HOME and C.HOME in parent.parents:
            with self.assertRaises(RuntimeError): C._safe(str(parent), must_exist=False, change=True)

    def test_move_never_overwrites(self):
        a, b = Path(TMP) / "a.txt", Path(TMP) / "b.txt"
        a.write_text("a"); b.write_text("b")
        with self.assertRaises(RuntimeError): C.t_move_path({"src": str(a), "dst": str(b)})
        self.assertEqual(b.read_text(), "b")
        d = Path(TMP) / "into"; d.mkdir(exist_ok=True)
        self.assertEqual(Path(C.t_move_path({"src": str(a), "dst": str(d)})["to"]), d / "a.txt")

    def test_undo_leaves_a_file_changed_since(self):
        p = Path(TMP) / "u.txt"; p.write_text("one")
        C.t_write_file({"path": str(p), "content": "two"})
        p.write_text("edited by the person")
        out = C.t_undo_last({})
        self.assertFalse(out["ok"]); self.assertEqual(p.read_text(), "edited by the person")
        C.t_write_file({"path": str(p), "content": "three"})
        self.assertTrue(C.t_undo_last({})["ok"]); self.assertEqual(p.read_text(), "edited by the person")


class Skills(unittest.TestCase):
    def test_unit_convert(self):
        self.assertAlmostEqual(C.t_unit_convert({"value": 10, "from": "km", "to": "mi"})["result"], 6.213712, places=5)
        self.assertEqual(C.t_unit_convert({"value": 100, "from": "celsius", "to": "f"})["result"], 212)
        with self.assertRaises(RuntimeError): C.t_unit_convert({"value": 1, "from": "kg", "to": "km"})

    def test_weather_marks_results_untrusted(self):
        calls = []
        def fake(url, timeout=15):
            calls.append(url)
            if "geocoding" in url: return {"results": [{"name": "Mumbai", "country": "India", "latitude": 19.0, "longitude": 72.8}]}
            return {"current": {"temperature_2m": 31, "weather_code": 2, "relative_humidity_2m": 70}}
        with Patch("_get_json", fake):
            w = C.t_weather({"city": "Mumbai"})
        self.assertTrue(w["untrusted"]); self.assertEqual(w["conditions"], "partly cloudy"); self.assertEqual(len(calls), 2)


class Brain(unittest.TestCase):
    def test_order_claude_then_gemini_then_engine(self):
        seen = []
        def fake_post(url, body, headers, timeout):
            seen.append(url)
            if "anthropic" in url: return {"content": [{"type": "text", "text": "hi"}]}
            return {"candidates": [{"content": {"parts": [{"text": "hello"}]}}]}
        req = {"openai": {"messages": [{"role": "user", "content": "hi"}]}, "anthropic": {"messages": []}}
        with Patch("_post_json", fake_post):
            with Keys(ANTHROPIC_API_KEY="sk-test-claude", GEMINI_API_KEY="AIza-test"):
                self.assertEqual(C.brain(req)["kind"], "anthropic")
            with Keys(ANTHROPIC_API_KEY=None, GEMINI_API_KEY="AIza-test"):
                d = C.brain(req)
                self.assertEqual(d["kind"], "openai"); self.assertEqual(d["data"]["choices"][0]["message"]["content"], "hello")
        self.assertIn("generativelanguage", seen[-1])

    def test_retired_gemini_model_falls_back_to_the_next(self):
        seen = []
        def fake_post(url, body, headers, timeout):
            seen.append((url, "thinkingConfig" in body["generationConfig"]))
            if "gemini-2.5-flash:" in url: raise RuntimeError("generativelanguage.googleapis.com answered 404: not found")
            if "thinkingConfig" in body["generationConfig"]: raise RuntimeError("generativelanguage.googleapis.com answered 400: invalid argument")
            return {"candidates": [{"content": {"parts": [{"text": "ok"}]}}]}
        with Patch("_post_json", fake_post), Keys(GEMINI_API_KEY="AIza-test", CHANDRA_GEMINI_MODEL="gemini-2.5-flash"):
            self.assertEqual(C.gemini_chat({"messages": [{"role": "user", "content": "x"}]})["choices"][0]["message"]["content"], "ok")
        self.assertEqual([("gemini-3.5-flash" in u, t) for u, t in seen[1:]], [(True, True), (True, False)])

    def test_tools_and_images_convert_to_gemini(self):
        body = {"messages": [{"role": "system", "content": "be brief"},
                             {"role": "user", "content": [{"type": "text", "text": "look"}, {"type": "image_url", "image_url": {"url": "data:image/png;base64,AAAA"}}]},
                             {"role": "assistant", "content": "", "tool_calls": [{"id": "1", "function": {"name": "weather", "arguments": "{\"city\":\"Pune\"}"}}]},
                             {"role": "tool", "name": "weather", "content": "{}"}],
                "tools": [{"type": "function", "function": {"name": "weather", "description": "d", "parameters": {"type": "object", "properties": {"city": {"type": "string"}}, "required": ["city"]}}}]}
        g = C._gemini_from_openai(body)
        self.assertEqual(g["systemInstruction"]["parts"][0]["text"], "be brief")
        self.assertEqual(g["contents"][0]["parts"][1]["inline_data"]["mime_type"], "image/png")
        self.assertEqual(g["contents"][1]["parts"][-1]["functionCall"]["args"], {"city": "Pune"})
        self.assertEqual(g["tools"][0]["functionDeclarations"][0]["parameters"]["properties"]["city"]["type"], "STRING")


class SetupKeys(unittest.TestCase):
    """A personal Chandra Setup ships its keys beside the app; Chandra moves them to its data folder."""
    def setUp(self):
        self.here = Path(tempfile.mkdtemp(prefix="chandra-here-")); self.store = Path(tempfile.mkdtemp(prefix="chandra-store-"))
        self.old = C.HERE, C.STORE; C.HERE, C.STORE = self.here, self.store
        self.saved = {k: os.environ.pop(k, None) for k in ("ANTHROPIC_API_KEY", "GEMINI_API_KEY")}
    def tearDown(self):
        C.HERE, C.STORE = self.old
        for k, v in self.saved.items():
            os.environ.pop(k, None)
            if v is not None: os.environ[k] = v

    def test_setup_keys_move_to_the_data_folder(self):
        (self.here / "chandra.env").write_text(C.SETUP_KEY_MARK + "\nANTHROPIC_API_KEY=keyfix-claude-setup-0000000000000000\nGEMINI_API_KEY=keyfix-gemini.setup-00000000000000000000000000\n")
        C.load_env()
        self.assertFalse((self.here / "chandra.env").exists())
        moved = (self.store / "chandra.env").read_text()
        self.assertIn(C.SETUP_KEY_MARK, moved); self.assertIn("GEMINI_API_KEY=keyfix-gemini.setup", moved)
        self.assertEqual(os.environ["ANTHROPIC_API_KEY"], "keyfix-claude-setup-0000000000000000"); self.assertEqual(C.KEY_SOURCE["source"], "setup")

    def test_a_preloaded_setup_replaces_a_stale_stored_key(self):
        (self.store / "chandra.env").write_text("ANTHROPIC_API_KEY=sk-ant-old-and-wrong-0000000000\nCHANDRA_BRAIN=auto\n")
        (self.here / "chandra.env").write_text(C.SETUP_KEY_MARK + "\nANTHROPIC_API_KEY=sk-ant-setup-0000000000000000\nGEMINI_API_KEY=AQ.setup-00000000000000000000000000\n")
        C.adopt_setup_keys()
        kept = (self.store / "chandra.env").read_text()
        self.assertIn("sk-ant-setup", kept); self.assertNotIn("old-and-wrong", kept); self.assertIn("CHANDRA_BRAIN=auto", kept)
        self.assertEqual(kept.count("ANTHROPIC_API_KEY="), 1); self.assertEqual(kept.count(C.SETUP_KEY_MARK), 1)

    def test_replacing_the_claude_key_drops_the_setup_mark(self):
        (self.store / "chandra.env").write_text(C.SETUP_KEY_MARK + "\nANTHROPIC_API_KEY=keyfix-claude-setup-0000000000000000\n")
        C.save_claude_key("keyfix-claude-mine-00000000000000000000")
        self.assertNotIn(C.SETUP_KEY_MARK, (self.store / "chandra.env").read_text())

    @unittest.skipUnless((SRC.parents[1] / "installer" / "chsetup.py").exists(), "the installer source is not part of the shipped app")
    def test_installer_packs_only_the_key_lines(self):
        cs = importlib.util.spec_from_file_location("chsetup_test", SRC.parents[1] / "installer" / "chsetup.py")
        T = importlib.util.module_from_spec(cs); cs.loader.exec_module(T)
        f = self.here / "keys.env"; f.write_text("# mine\nANTHROPIC_API_KEY=keyfix-claude-x-000000000000\nOTHER=1\nGEMINI_API_KEY='keyfix-gemini.y-0000000000'\n")
        data, names = T.keys_env(str(f))
        self.assertEqual(data.decode(), C.SETUP_KEY_MARK + "\nANTHROPIC_API_KEY=keyfix-claude-x-000000000000\nGEMINI_API_KEY=keyfix-gemini.y-0000000000\n")
        self.assertIn("chandra.env", T.SKIP_FILES)


class RuntimePatches(unittest.TestCase):
    def test_webview_skips_loader_folders_that_are_not_shipped(self):
        f = SRC.parents[1] / "runtime" / "Lib" / "site-packages" / "webview" / "platforms" / "edgechromium.py"
        if not f.exists(): self.skipTest("no bundled runtime in this checkout")
        text = f.read_text(encoding="utf-8")
        self.assertIn("except FileNotFoundError", text.split("for platform in")[1].split("logger =")[0])


class DiagnosticsPage(unittest.TestCase):
    def test_report_has_the_facts_and_never_a_key(self):
        with Keys(ANTHROPIC_API_KEY="sk-ant-secretsecretsecret0000", GEMINI_API_KEY="AQ.secretsecretsecretsecretsecret0000"):
            r = C.diagnostics_report(False)
            text = json.dumps(r)
        self.assertEqual(r["system"]["version"], C.APP_VERSION); self.assertEqual(r["system"]["build"], "official")
        self.assertTrue(r["brain"]["claude_key"] and r["brain"]["gemini_key"]); self.assertEqual(r["brain"]["active"], "claude")
        self.assertNotIn("secretsecret", text)
        for k in ("system", "brain", "voice", "safety", "errors", "start_log"): self.assertIn(k, r)

    def test_probes_only_run_on_request_and_report_failures(self):
        with Patch("_probe", lambda url, headers=None, timeout=8: (False, 12, "answered 401 (key refused)")), Keys(GEMINI_API_KEY="AQ.x" * 12):
            self.assertNotIn("probes", C.diagnostics_report(False))
            r = C.diagnostics_report(True)
        self.assertFalse(r["probes"]["Gemini API"]["ok"]); self.assertIn("selfcheck", r)


class FinalRound(unittest.TestCase):
    def test_clipboard_and_log_clear_endpoints(self):
        srv = ThreadingHTTPServer(("127.0.0.1", 0), C.H); port = srv.server_address[1]
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        C.CFG["token"] = "tok"
        def call(path, method="GET"):
            rq = urllib.request.Request("http://127.0.0.1:%d%s" % (port, path), method=method, data=b"{}" if method == "POST" else None,
                                        headers={"Authorization": "Bearer tok", "Content-Type": "application/json"})
            return json.loads(urllib.request.urlopen(rq, timeout=5).read())
        try:
            with Patch("_clip_get", lambda: "sk-ant-pasted-from-the-clipboard"):
                self.assertEqual(call("/clipboard/text")["text"], "sk-ant-pasted-from-the-clipboard")
            C.log_error("test", "boom"); self.assertTrue(C.LOG_FILE.read_text())
            self.assertTrue(call("/log/clear", "POST")["ok"]); self.assertEqual(C.LOG_FILE.read_text(), "")
        finally:
            srv.shutdown()

    def test_stt_hint_for_any_language_code(self):
        seen = []
        def fake_post(url, body, headers, timeout):
            seen.append(body["contents"][0]["parts"][1]["text"]); return {"candidates": [{"content": {"parts": [{"text": '{"text":"hola","lang":"en"}'}]}}]}
        with Patch("_post_json", fake_post), Keys(GEMINI_API_KEY="AQ." + "x" * 36):
            C.STT_MODEL.clear(); C.stt("AAAA", "es-ES")
        self.assertIn("es-ES", seen[0])

    def test_language_list_and_options_label_in_the_page(self):
        ui = (SRC / "ui" / "languages.js").read_text(encoding="utf-8")
        for code in ("hi-IN", "fr-FR", "ta-IN", "sw-KE", "ja-JP", "ar-SA", "es-MX"): self.assertIn('"%s"' % code, ui)
        self.assertGreater(ui.count("-"), 100)
        page = (SRC / "app.v1.html").read_text(encoding="utf-8")
        self.assertIn("<h2>Options</h2>", page); self.assertNotIn("<h2>Settings</h2>", page)
        self.assertIn("const BASE=.20", page)


class Supervisor(unittest.TestCase):
    def run_sup(self, codes):
        import subprocess
        calls = []
        def fake_call(cmd, **kw): calls.append(cmd); return codes[len(calls) - 1] if len(calls) <= len(codes) else 0
        old_call, old_sleep, old_notify = subprocess.call, C.time.sleep, C.notify
        subprocess.call = fake_call; C.time.sleep = lambda s: None; C.notify = lambda *a, **k: None
        try: return C.supervise(), len(calls)
        finally: subprocess.call, C.time.sleep, C.notify = old_call, old_sleep, old_notify

    def test_a_crash_is_started_again_and_a_normal_close_is_not(self):
        self.assertEqual(self.run_sup([0xC0000005, 0]), (0, 2))        # access violation, then a clean close
        self.assertEqual(self.run_sup([0]), (0, 1))                    # closed by the person: no restart
        self.assertEqual(self.run_sup([1]), (1, 1))                    # End task or a plain error: no restart

    def test_it_gives_up_when_it_keeps_crashing(self):
        code, n = self.run_sup([0xC0000005] * 10)
        self.assertEqual(code, 0xC0000005); self.assertLessEqual(n, 5)

    def test_build_id_is_stable(self):
        self.assertEqual(C.build_id(), C.build_id()); self.assertEqual(len(C.build_id()), 10)


class FastInput(unittest.TestCase):
    def test_typed_text_is_sent_as_characters_so_caps_lock_cannot_change_it(self):
        self.assertEqual(C._unicode_events("Ab"), [(0, 0x41, 4), (0, 0x41, 6), (0, 0x62, 4), (0, 0x62, 6)])   # 'A' then 'b', exactly
        self.assertEqual(C._unicode_events("a\nb")[2:4], [(0x0D, 0, 0), (0x0D, 0, 2)])                         # newline is the Enter key
        self.assertEqual(len(C._unicode_events("\U0001F600")), 4)                                              # outside the BMP: two units

    def test_without_direct_input_caps_lock_is_compensated(self):
        typed = []
        class G:
            def write(self, s, interval=0): typed.append(s)
            def press(self, k): typed.append("<%s>" % k)
        old = (C._gui, C._caps_on, C.OS); C._gui = lambda: G(); C._caps_on = lambda: True; C.OS = "Linux"
        try: C._type_raw({"text": "Hello", "enter": True})
        finally: C._gui, C._caps_on, C.OS = old
        self.assertEqual(typed, ["hELLO", "<enter>"])        # with Caps Lock on the keys invert it back to "Hello"

    def test_nothing_waits_between_actions(self):
        import types, sys as _s
        fake = types.ModuleType("pyautogui"); fake.PAUSE = 1; fake.FAILSAFE = False
        old = _s.modules.get("pyautogui"); _s.modules["pyautogui"] = fake
        try: C._gui()
        finally:
            if old is None: _s.modules.pop("pyautogui", None)
            else: _s.modules["pyautogui"] = old
        self.assertEqual(fake.PAUSE, 0); self.assertLessEqual(C.VERIFY_WAIT, 0.15)

    def test_always_on_is_gone(self):
        page = (SRC / "app.v1.html").read_text(encoding="utf-8")
        for gone in ("startWakeEar", "chandraAlways", "alwaysSet"): self.assertNotIn(gone, page)
        self.assertFalse((SRC / "ui" / "always.js").exists())
        text = (SRC.parents[1] / "EULA.txt").read_text(encoding="utf-8")
        self.assertGreater(len(text.split()), 1300); self.assertNotIn("ALWAYS-ON", text.upper()); self.assertIn("Ananta Labs", text)


class Memory(unittest.TestCase):
    def test_without_a_key_the_page_falls_back(self):
        self.assertEqual(C.memory_search("trip", ["planning a trip to Japan"]), {"semantic": False})

    def test_ranks_by_meaning_and_caches(self):
        vec = {"trip": [1, 0], "planning a trip to Japan": [0.9, 0.1], "locker code is 4821": [0, 1]}
        batches = []
        def fake_embed(texts):
            batches.append(list(texts)); return [vec[t] for t in texts]
        with Patch("_gemini_embed", fake_embed), Keys(GEMINI_API_KEY="AIza-test"):
            r = C.memory_search("trip", ["locker code is 4821", "planning a trip to Japan"])
            self.assertTrue(r["semantic"]); self.assertEqual(r["results"][0]["i"], 1)
            C.memory_search("trip", ["locker code is 4821", "planning a trip to Japan"])
        self.assertEqual(batches[2], ["trip"], "memories are embedded once, then only the query")


class Diagnostics(unittest.TestCase):
    def test_scrub_removes_keys_and_tokens(self):
        s = C.scrub("key sk-" "ant-abcdefghijklmnop and AIza" + "x" * 30 + " Bearer abc.def.ghi123 password=hunter2")
        for leak in ("abcdefghijklmnop", "x" * 30, "abc.def.ghi123", "hunter2"): self.assertNotIn(leak, s)

    def test_selfcheck_runs_without_a_screen(self):
        names = [c["check"] for c in C.selfcheck()["checks"]]
        self.assertIn("Natural voice", names); self.assertIn("Data folder writable", names)


class Voice(unittest.TestCase):
    PCM = b"\x01\x00\xff\xff" * 600

    def fake_tts(self, fail_first=False):
        seen = []
        def fake_post(url, body, headers, timeout):
            seen.append((url, body))
            if fail_first and len(seen) == 1: raise RuntimeError("generativelanguage.googleapis.com answered 404: no such model")
            return {"candidates": [{"content": {"parts": [{"inlineData": {"mimeType": "audio/L16;codec=pcm;rate=24000",
                                                                           "data": base64.b64encode(self.PCM).decode()}}]}}]}
        return seen, fake_post

    def setUp(self): C.TTS_CACHE.clear()

    def test_needs_a_gemini_key(self):
        with Keys(GEMINI_API_KEY=None, GOOGLE_API_KEY=None):
            with self.assertRaises(RuntimeError): C.tts("hello")

    def test_returns_a_wav_and_caches(self):
        seen, fake = self.fake_tts()
        with Patch("_post_json", fake), Keys(GEMINI_API_KEY="AIza-test"):
            wav = C.tts("Hello Sanjay.", "Kore")
            self.assertEqual(wav[:4], b"RIFF"); self.assertEqual(wav[8:12], b"WAVE"); self.assertEqual(wav[44:], self.PCM)
            self.assertEqual(int.from_bytes(wav[24:28], "little"), 24000)
            C.tts("Hello Sanjay.", "Kore")
        self.assertEqual(len(seen), 1, "a repeated phrase comes from the cache")
        cfg = seen[0][1]["generationConfig"]
        self.assertEqual(cfg["responseModalities"], ["AUDIO"])
        self.assertEqual(cfg["speechConfig"]["voiceConfig"]["prebuiltVoiceConfig"]["voiceName"], "Kore")

    def test_unknown_voice_uses_the_default_and_a_missing_model_tries_the_next(self):
        seen, fake = self.fake_tts(fail_first=True)
        with Patch("_post_json", fake), Keys(GEMINI_API_KEY="AIza-test"):
            C.tts("Hi", "NotAVoice")
        self.assertEqual(len(seen), 2)
        self.assertEqual(seen[1][1]["generationConfig"]["speechConfig"]["voiceConfig"]["prebuiltVoiceConfig"]["voiceName"], C.TTS_DEFAULT_VOICE)

    def test_http_route_needs_the_pairing_code(self):
        C.CFG["token"] = "pair-test-code"
        srv = ThreadingHTTPServer(("127.0.0.1", 0), C.H); port = srv.server_address[1]
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        try:
            def call(path, body=None, token=None):
                req = urllib.request.Request("http://127.0.0.1:%d%s" % (port, path), data=json.dumps(body).encode() if body is not None else None,
                                             headers={"Content-Type": "application/json", **({"Authorization": "Bearer " + token} if token else {})})
                try:
                    with urllib.request.urlopen(req, timeout=5) as r: return r.status, r.headers.get("Content-Type"), r.read()
                except urllib.error.HTTPError as e: return e.code, e.headers.get("Content-Type"), e.read()
            self.assertEqual(call("/tts", {"text": "hi"})[0], 401)
            seen, fake = self.fake_tts()
            with Patch("_post_json", fake), Keys(GEMINI_API_KEY="AIza-test"):
                code, ctype, data = call("/tts", {"text": "hi"}, "pair-test-code")
                self.assertEqual((code, ctype, data[:4]), (200, "audio/wav", b"RIFF"))
                code, _, data = call("/tts/voices", token="pair-test-code")
                d = json.loads(data); self.assertTrue(d["available"]); self.assertIn("Sulafat", [v["name"] for v in d["voices"]])
            with Keys(GEMINI_API_KEY=None):
                self.assertEqual(call("/tts", {"text": "hi"}, "pair-test-code")[0], 502)
            self.assertEqual(call("/selfcheck", token="pair-test-code")[0], 200)
        finally:
            srv.shutdown()


class NativeWindow(unittest.TestCase):
    """1.6: in Chandra's window the computer bridge is the window's own channel; the HTTP /act refuses."""
    def test_act_status_halt_through_the_window(self):
        api = C.JsApi()
        self.assertEqual(api.act("unit_convert", {"value": 1, "from": "km", "to": "m"})["result"]["result"], 1000)
        self.assertIn("Unknown tool", api.act("nope", {})["error"])
        self.assertTrue(api.status()["native"])
        api.halt()
        try: self.assertIn("Halted", api.act("click", {"x": 1, "y": 1})["error"])
        finally: api.resume()

    def test_brain_through_the_window_reports_errors_as_data(self):
        def boom(req): raise RuntimeError("No brain available")
        with Patch("brain", boom):
            self.assertEqual(C.JsApi().brain({"openai": {}})["error"], "No brain available")

    def test_screen_look_only_looks_when_the_screen_changed(self):
        try: from PIL import Image
        except ImportError: self.skipTest("Pillow is not installed")
        shots = [Image.new("RGB", (1600, 900), (10, 20, 30))]
        asked = []
        def fake_brain(req):
            asked.append(req)
            return {"kind": "anthropic", "data": {"content": [{"type": "text", "text": "<think>x</think>A code editor is open."}]}}
        with Patch("_grab", lambda: shots[-1]), Patch("brain", fake_brain):
            r = C.JsApi().screen_look(None, "claude-sonnet-5-5")
            self.assertEqual((r["changed"], r["text"]), (True, "A code editor is open."))
            img = asked[0]["anthropic"]["messages"][0]["content"][0]["source"]
            self.assertEqual(img["media_type"], "image/jpeg")
            again = C.JsApi().screen_look(r["sig"], "claude-sonnet-5-5")
            self.assertEqual(again["changed"], False); self.assertEqual(len(asked), 1, "an unchanged screen is not sent")
            shots.append(Image.new("RGB", (1600, 900), (240, 240, 240)))
            self.assertTrue(C.JsApi().screen_look(r["sig"], "m")["changed"]); self.assertEqual(len(asked), 2)

    def test_http_act_is_off_while_the_window_is_open(self):
        C.CFG["token"] = "pair-test-code"; C.CFG["native"] = True
        srv = ThreadingHTTPServer(("127.0.0.1", 0), C.H); port = srv.server_address[1]
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        try:
            req = urllib.request.Request("http://127.0.0.1:%d/act" % port, data=b'{"tool":"unit_convert","args":{}}',
                                         headers={"Authorization": "Bearer pair-test-code", "Content-Type": "application/json"})
            with self.assertRaises(urllib.error.HTTPError) as e: urllib.request.urlopen(req, timeout=5)
            self.assertEqual(e.exception.code, 403)
            with urllib.request.urlopen("http://127.0.0.1:%d/app/pair-test-code" % port, timeout=10) as r:
                self.assertIn(b'window.CHANDRA_NATIVE="1"==="1"', r.read())
        finally:
            C.CFG["native"] = False; srv.shutdown()


class Listening(unittest.TestCase):
    """1.7: Gemini transcribes English, Hindi and Hinglish; the voice direction follows the language."""
    def setUp(self): C.STT_MODEL.clear()

    def test_needs_a_key(self):
        with Keys(GEMINI_API_KEY=None, GOOGLE_API_KEY=None):
            with self.assertRaises(RuntimeError): C.stt("UklGRg==")

    def test_transcribes_and_names_the_language(self):
        seen = []
        def fake(url, body, headers, timeout):
            seen.append((url, body))
            if "lite" in url: raise RuntimeError("generativelanguage.googleapis.com answered 404: gone")
            return {"candidates": [{"content": {"parts": [{"text": '{"text": "मुझे  Spotify खोलो", "lang": "mixed"}'}]}}]}
        with Patch("_post_json", fake), Keys(GEMINI_API_KEY="AIza-test"):
            r = C.stt("UklGRg==", "hinglish")
            self.assertEqual((r["text"], r["lang"]), ("मुझे Spotify खोलो", "mixed"))
            self.assertIn("mixes Hindi and English", seen[-1][1]["contents"][0]["parts"][1]["text"])
            self.assertEqual(seen[-1][1]["contents"][0]["parts"][0]["inline_data"]["mime_type"], "audio/wav")
            n = len(seen); C.stt("UklGRg==")
            self.assertEqual(len(seen), n + 1, "the model that worked is tried first next time")

    def test_thinking_off_falls_back_when_a_model_refuses_it(self):
        seen = []
        def fake(url, body, headers, timeout):
            seen.append(body)
            if "thinkingConfig" in body["generationConfig"]: raise RuntimeError("x answered 400: thinking not supported")
            return {"candidates": [{"content": {"parts": [{"text": '{"text": "hello", "lang": "en"}'}]}}]}
        with Patch("_post_json", fake), Keys(GEMINI_API_KEY="AIza-test"):
            self.assertEqual(C.stt("UklGRg==")["text"], "hello")
        self.assertEqual(len(seen), 2)

    def test_voice_direction_by_language(self):
        self.assertIn("Hindi", C.tts_style("नमस्ते, आज मौसम अच्छा है"))
        self.assertIn("Indian English", C.tts_style("Your meeting is at five."))
        self.assertNotIn("Indian", C.tts_style("Your meeting is at five.", accent="neutral"))
        self.assertIn("calm", C.tts_style("ok", mood="calm"))

    def test_window_channel(self):
        with Patch("stt", lambda a, l="", m="": {"text": "hi", "lang": "en"}):
            self.assertEqual(C.JsApi().stt("x")["text"], "hi")
        with Patch("tts", lambda *a: b"RIFFxxxx"):
            self.assertTrue(C.JsApi().tts("hi")["audio"].startswith("data:audio/wav;base64,"))


class Safeguards(unittest.TestCase):
    """1.0.2: small, always-on safeguards under every approval."""
    def test_wiping_commands_are_refused_and_ordinary_ones_are_not(self):
        for c in ("rm -rf /", "sudo rm -rf --no-preserve-root /", "del /s /q C:\\", "format D:", "vssadmin delete shadows /all",
                  "shutdown /s /t 0", "Remove-Item -Recurse -Force C:\\", "dd if=/dev/zero of=/dev/sda"):
            self.assertTrue(C.shell_blocked(c), c)
        for c in ("rm -rf build/", "git status", "del notes.txt", "echo halt-test", "grep shutdown log.txt"):
            self.assertFalse(C.shell_blocked(c), c)
        C.CFG["shell"] = True
        try: self.assertIn("Safeguard", C.run_tool("run_shell", {"command": "rm -rf ~"})["error"])
        finally: C.CFG["shell"] = False

    def test_secrets_are_not_typed(self):
        self.assertEqual(C.secret_in("4111 1111 1111 1111"), "a card number")
        self.assertEqual(C.secret_in("pay 4111111111111112"), "", "a number that fails the card checksum is fine")
        self.assertEqual(C.secret_in("call 9876543210"), "")
        self.assertIn("key", C.secret_in("sk-" "ant-api03-abcdefghijklmnopqrstuv"))
        self.assertIn("card number", C.run_tool("type_text", {"text": "5500-0000-0000-0004"})["error"])

    def test_runaway_clicking_pauses(self):
        old = list(C.RATE["times"]); C.RATE["times"] = [time.time()] * C.RATE["limit"]
        try: self.assertIn("paused", C.run_tool("click", {"x": 1, "y": 1})["error"])
        finally: C.RATE["times"] = old

    def test_no_looking_at_private_windows(self):
        with Patch("foreground_title", lambda: "Bitwarden"):
            self.assertIn("password manager", C.run_tool("screenshot", {})["error"])
            self.assertTrue(C.screen_look(None, "m")["private"])
        with Patch("foreground_title", lambda: "HDFC NetBanking - Edge"):
            self.assertTrue(C.screen_look([1, 2], "m")["private"])


if __name__ == "__main__":
    unittest.main()
