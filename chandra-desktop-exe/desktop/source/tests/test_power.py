"""Host-side tests for Chandra's wider toolbox: search, info, edit, copy, zip, unzip, duplicates, reading Office files,
the web tools and the shell. Standard library only; the web tests talk to a throwaway local server.

    cd desktop/source && python -m unittest discover -s tests -v
"""
import importlib.util, json, os, shutil, tempfile, threading, unittest, zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

TMP = tempfile.mkdtemp(prefix="chandra-power-")
os.environ.update(HOME=TMP, USERPROFILE=TMP, APPDATA=str(Path(TMP) / "AppData"), XDG_CONFIG_HOME=str(Path(TMP) / ".config"))
SRC = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("chandra_host_power_test", SRC / "chandra.py")
C = importlib.util.module_from_spec(spec)
spec.loader.exec_module(C)
REAL_PUBLIC_URL = C._public_url


def fresh(name, files=None):
    d = C.HOME / name
    shutil.rmtree(d, ignore_errors=True); d.mkdir(parents=True)
    for rel, text in (files or {}).items():
        f = d / rel; f.parent.mkdir(parents=True, exist_ok=True)
        f.write_bytes(text if isinstance(text, bytes) else text.encode("utf-8"))
    return d


def zipped(path, members):
    with zipfile.ZipFile(path, "w") as z:
        for n, t in members.items(): z.writestr(n, t)


class Reading(unittest.TestCase):
    def test_read_file_pages_through_a_long_file(self):
        fresh("r1", {"long.txt": "x" * 25000})
        a = C.t_read_file({"path": "r1/long.txt", "limit": 10000})
        self.assertEqual((len(a["text"]), a["more"], a["total_chars"]), (10000, True, 25000))
        b = C.t_read_file({"path": "r1/long.txt", "offset": 20000, "limit": 10000})
        self.assertEqual((len(b["text"]), b["more"]), (5000, False))

    def test_binary_and_utf16_files(self):
        fresh("r2", {"b.bin": b"\x00\x01\x02binary", "u.txt": "hello wörld".encode("utf-16")})
        self.assertTrue(C.t_read_file({"path": "r2/b.bin"})["binary"])
        self.assertEqual(C.t_read_file({"path": "r2/u.txt"})["text"], "hello wörld")

    def test_word_powerpoint_and_excel(self):
        fresh("r3")
        zipped(C.HOME / "r3" / "a.docx", {"word/document.xml": "<w:document><w:p><w:r><w:t>Dear Sam</w:t></w:r></w:p><w:p><w:r><w:t>Thanks &amp; bye</w:t></w:r></w:p></w:document>"})
        zipped(C.HOME / "r3" / "a.pptx", {"ppt/slides/slide1.xml": "<a:p><a:t>Title one</a:t></a:p>", "ppt/slides/slide2.xml": "<a:p><a:t>Second</a:t></a:p>"})
        zipped(C.HOME / "r3" / "a.xlsx", {"xl/sharedStrings.xml": "<sst><si><t>Name</t></si><si><t>Ada</t></si></sst>",
                                          "xl/worksheets/sheet1.xml": '<sheetData><row><c r="A1" t="s"><v>0</v></c><c r="B1"><v>Age</v></c></row><row><c r="A2" t="s"><v>1</v></c><c r="B2"><v>36</v></c></row></sheetData>'})
        self.assertIn("Dear Sam", C.t_read_file({"path": "r3/a.docx"})["text"]); self.assertIn("Thanks & bye", C.t_read_file({"path": "r3/a.docx"})["text"])
        p = C.t_read_file({"path": "r3/a.pptx"})["text"]; self.assertIn("Slide 1", p); self.assertIn("Second", p)
        x = C.t_read_file({"path": "r3/a.xlsx"})["text"]; self.assertIn("Name\tAge", x); self.assertIn("Ada\t36", x)

    def test_list_dir_tree_and_pattern(self):
        fresh("l1", {"a.txt": "a", "sub/b.txt": "b", "sub/deep/c.md": "c", ".hidden/x.txt": "x", "node_modules/m.js": "m"})
        names = [e["name"] for e in C.t_list_dir({"path": "l1", "depth": 3})["entries"]]
        self.assertIn("sub/deep/c.md", names); self.assertNotIn(".hidden/x.txt", names); self.assertNotIn("node_modules/m.js", names)
        self.assertEqual([e["name"] for e in C.t_list_dir({"path": "l1", "depth": 3, "pattern": "*.md"})["entries"]], ["sub/deep/c.md"])
        self.assertEqual(sorted(e["name"] for e in C.t_list_dir({"path": "l1"})["entries"]), [".hidden", "a.txt", "node_modules", "sub"])


class Finding(unittest.TestCase):
    def test_search_by_name_and_by_content(self):
        fresh("s1", {"invoice-2024.pdf": "x", "notes/todo.txt": "buy milk\nCall Priya about the invoice", "notes/b.bin": b"\x00\x00invoice"})
        by_name = C.t_search_files({"path": "s1", "query": "invoice"})
        self.assertEqual([Path(r["path"]).name for r in by_name["results"]], ["invoice-2024.pdf"])
        self.assertEqual([Path(r["path"]).name for r in C.t_search_files({"path": "s1", "query": "*.txt"})["results"]], ["todo.txt"])
        hit = C.t_search_files({"path": "s1", "contains": "priya"})["results"]
        self.assertEqual((len(hit), hit[0]["line"]), (1, 2)); self.assertIn("Priya", hit[0]["snippet"])
        with self.assertRaises(RuntimeError): C.t_search_files({"path": "s1"})

    def test_file_info(self):
        fresh("i1", {"f.txt": "12345", "d/g.txt": "123"})
        self.assertEqual((C.t_file_info({"path": "i1/f.txt"})["size"], C.t_file_info({"path": "i1/f.txt"})["type"]), (5, "file"))
        d = C.t_file_info({"path": "i1"}); self.assertEqual((d["files"], d["size"], d["type"]), (2, 8, "folder"))

    def test_find_duplicates(self):
        fresh("d1", {"a.txt": "same content here" * 100, "b/copy.txt": "same content here" * 100, "c.txt": "different" * 100, "d.txt": "samesize" * 100})
        out = C.t_find_duplicates({"path": "d1", "min_size_kb": 0})
        self.assertEqual(out["group_count"], 1); self.assertEqual(out["groups"][0]["count"], 2)
        self.assertEqual(out["wasted_bytes"], len("same content here" * 100)); self.assertTrue((C.HOME / "d1" / "a.txt").exists())


class Changing(unittest.TestCase):
    def test_edit_file_exact_unique_crlf_and_undo(self):
        fresh("e1", {"a.txt": "one two three", "w.txt": b"line1\r\nline2\r\nline3\r\n", "r.txt": "x x x"})
        C.t_edit_file({"path": "e1/a.txt", "find": "two", "replace": "2"}); self.assertEqual((C.HOME / "e1/a.txt").read_text(), "one 2 three")
        with self.assertRaises(RuntimeError): C.t_edit_file({"path": "e1/a.txt", "find": "nope", "replace": "z"})
        with self.assertRaises(RuntimeError) as cm: C.t_edit_file({"path": "e1/r.txt", "find": "x", "replace": "y"})
        self.assertIn("3 times", str(cm.exception))
        self.assertEqual(C.t_edit_file({"path": "e1/r.txt", "find": "x", "replace": "y", "all": True})["replaced"], 3)
        C.t_edit_file({"path": "e1/w.txt", "find": "line1\nline2", "replace": "LINE1\nLINE2"})
        self.assertEqual((C.HOME / "e1/w.txt").read_bytes(), b"LINE1\r\nLINE2\r\nline3\r\n")
        self.assertTrue(C.t_undo_last({})["ok"]); self.assertTrue(C.t_undo_last({})["ok"])
        self.assertEqual((C.HOME / "e1/r.txt").read_text(), "x x x")

    def test_append(self):
        fresh("e2", {"log.txt": "a\n"})
        C.t_write_file({"path": "e2/log.txt", "content": "b\n", "append": True}); C.t_write_file({"path": "e2/new.txt", "content": "n", "append": True})
        self.assertEqual((C.HOME / "e2/log.txt").read_text(), "a\nb\n"); self.assertEqual((C.HOME / "e2/new.txt").read_text(), "n")

    def test_copy_never_overwrites_and_undoes(self):
        fresh("c1", {"a.txt": "A", "dir/x.txt": "X", "dest/a.txt": "already"})
        with self.assertRaises(RuntimeError): C.t_copy_path({"src": "c1/a.txt", "dst": "c1/dest"})
        C.t_copy_path({"src": "c1/dir", "dst": "c1/dest/"}); self.assertEqual((C.HOME / "c1/dest/dir/x.txt").read_text(), "X")
        with self.assertRaises(RuntimeError): C.t_copy_path({"src": "c1/dir", "dst": "c1/dir/inner"})
        self.assertTrue(C.t_undo_last({})["ok"]); self.assertFalse((C.HOME / "c1/dest/dir").exists()); self.assertTrue((C.HOME / "c1/dir").exists())

    def test_archive_and_extract_round_trip_and_zip_slip(self):
        fresh("z1", {"docs/a.txt": "A", "docs/sub/b.txt": "B", "docs/.hidden/c.txt": "C", "lone.txt": "L"})
        out = C.t_archive({"paths": ["z1/docs", "z1/lone.txt"], "dst": "z1/pack"})
        self.assertTrue(out["path"].endswith("pack.zip")); self.assertEqual(out["files"], 3)
        with self.assertRaises(RuntimeError): C.t_archive({"paths": ["z1/lone.txt"], "dst": "z1/pack.zip"})
        ex = C.t_extract({"src": "z1/pack.zip", "dst": "z1/out"}); self.assertEqual(ex["files"], 3)
        self.assertEqual((C.HOME / "z1/out/docs/sub/b.txt").read_text(), "B")
        again = C.t_extract({"src": "z1/pack.zip", "dst": "z1/out"}); self.assertEqual((again["files"], again["skipped"]), (0, 3))
        zipped(C.HOME / "z1" / "evil.zip", {"../escaped.txt": "boom", "ok.txt": "fine"})
        e = C.t_extract({"src": "z1/evil.zip", "dst": "z1/safe"})
        self.assertEqual((e["files"], e["skipped"]), (1, 1)); self.assertFalse((C.HOME / "z1" / "escaped.txt").exists())
        with self.assertRaises(RuntimeError): C.t_extract({"src": "z1/lone.txt"})


class Web(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        class H(BaseHTTPRequestHandler):
            def log_message(self, *a): pass
            def do_GET(self):
                if self.path == "/page":
                    body = (b"<html><head><title>Hello &amp; welcome</title></head><body><nav>MENU</nav><script>evil()</script>"
                            b"<h1>Big title</h1><p>First paragraph.</p><ul><li>one</li><li>two</li></ul><footer>FOOT</footer></body></html>")
                    ct = "text/html; charset=utf-8"
                elif self.path == "/file.bin": body, ct = b"BINARYDATA" * 10, "application/octet-stream"
                else: body, ct = json.dumps({"path": self.path}).encode(), "application/json"
                self.send_response(200); self.send_header("Content-Type", ct); self.end_headers(); self.wfile.write(body)
            def do_POST(self):
                n = int(self.headers.get("Content-Length", 0)); data = self.rfile.read(n)
                body = json.dumps({"got": data.decode(), "ct": self.headers.get("Content-Type")}).encode()
                self.send_response(201); self.send_header("Content-Type", "application/json"); self.end_headers(); self.wfile.write(body)
        cls.srv = ThreadingHTTPServer(("127.0.0.1", 0), H); cls.base = "http://127.0.0.1:%d" % cls.srv.server_address[1]
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()
        C._public_url = lambda u: str(u)          # the throwaway server is on localhost

    @classmethod
    def tearDownClass(cls):
        C._public_url = REAL_PUBLIC_URL; cls.srv.shutdown()

    def test_web_fetch_reads_the_page_not_the_menu(self):
        out = C.t_web_fetch({"url": self.base + "/page"})
        self.assertEqual(out["title"], "Hello & welcome"); self.assertTrue(out["untrusted"])
        for want in ("Big title", "First paragraph.", "- one", "- two"): self.assertIn(want, out["text"])
        for gone in ("MENU", "FOOT", "evil()"): self.assertNotIn(gone, out["text"])
        part = C.t_web_fetch({"url": self.base + "/page", "max_chars": 500, "offset": 5})
        self.assertEqual(part["offset"], 5)

    def test_http_request_post_and_status(self):
        out = C.t_http_request({"url": self.base + "/api", "method": "POST", "body": '{"a": 1}'})
        self.assertEqual(out["status"], 201); self.assertEqual(json.loads(out["text"])["got"], '{"a": 1}')
        self.assertEqual(json.loads(out["text"])["ct"], "application/json")
        with self.assertRaises(RuntimeError): C.t_http_request({"url": self.base, "method": "TRACE"})

    def test_download_file_never_overwrites_and_undoes(self):
        fresh("w1")
        out = C.t_download_file({"url": self.base + "/file.bin", "dst": "w1/"}); self.assertEqual(Path(out["path"]).name, "file.bin")
        self.assertEqual(out["size"], 100)
        with self.assertRaises(RuntimeError): C.t_download_file({"url": self.base + "/file.bin", "dst": "w1/file.bin"})
        self.assertFalse(list((C.HOME / "w1").glob("*.part")))
        self.assertTrue(C.t_undo_last({})["ok"]); self.assertFalse((C.HOME / "w1" / "file.bin").exists())

    def test_local_and_private_addresses_are_refused(self):
        C._public_url = REAL_PUBLIC_URL
        try:
            for u in ("http://127.0.0.1:8765/", "http://localhost/", "http://192.168.1.1/", "http://169.254.169.254/latest/", "http://[::1]/", "ftp://example.com/", "file:///etc/passwd"):
                with self.assertRaises(RuntimeError, msg=u): C.t_web_fetch({"url": u})
        finally:
            C._public_url = lambda u: str(u)


class Shell(unittest.TestCase):
    def test_shell_runs_in_a_folder_and_reports_a_timeout(self):
        fresh("sh1")
        C.CFG["shell"] = True
        out = C.t_run_shell({"command": "echo hi && pwd", "cwd": "sh1"}); self.assertEqual(out["code"], 0); self.assertIn("hi", out["stdout"])
        self.assertTrue(out["stdout"].strip().endswith("sh1"))
        slow = C.t_run_shell({"command": "sleep 5", "timeout": 1}); self.assertTrue(slow["timed_out"])
        C.CFG["shell"] = False
        with self.assertRaises(RuntimeError): C.t_run_shell({"command": "echo no"})
        with self.assertRaises(RuntimeError): C.CFG.update(shell=True) or C.t_run_shell({"command": "echo", "cwd": "/etc"})
        C.CFG["shell"] = False

    def test_new_tools_are_registered_and_gated(self):
        for t in ("search_files", "file_info", "find_duplicates", "edit_file", "copy_path", "archive", "extract", "download_file", "http_request"):
            self.assertIn(t, C.TOOLS)
        for t in ("edit_file", "copy_path", "archive", "extract", "download_file", "http_request"): self.assertIn(t, C.GATED)

    def test_the_male_voice_is_the_default(self):
        self.assertEqual(C.TTS_DEFAULT_VOICE, "Charon"); self.assertIn(C.TTS_DEFAULT_VOICE, C.TTS_MALE)
        self.assertIn("man", C.tts_style("hello there")); self.assertIn("man", C.tts_style("नमस्ते, कैसे हैं आप"))
        self.assertNotIn("woman", C.tts_style("hello")); self.assertNotIn("woman", C.tts_style("नमस्ते"))


if __name__ == "__main__":
    unittest.main()
