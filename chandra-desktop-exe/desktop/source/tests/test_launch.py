"""The launch path: the real program started the way a person starts it (a separate process, from a folder whose name has
spaces and non-English letters), the page it serves, and the launcher files. Windows-only pieces (the batch launcher's
behaviour, the message box, the native window) are checked as text here and listed as untested in the release notes.

    cd desktop/source && python -m unittest discover -s tests -v
"""
import os, re, shutil, subprocess, sys, tempfile, time, unittest, urllib.error, urllib.request
from pathlib import Path

SRC = Path(__file__).resolve().parents[1]           # desktop/source
DESKTOP = SRC.parent                                # desktop (holds runtime/ next to source/)


def start_app(home, extra=()):
    """Runs a COPY of chandra.py from a scratch folder. The app moves a key file that sits beside it into its data
    folder on first start, so running it from the real source folder would take the key out of the release tree."""
    env = dict(os.environ, HOME=str(home), XDG_CONFIG_HOME=str(home / ".config"), USERPROFILE=str(home))
    for k in ("ANTHROPIC_API_KEY", "GEMINI_API_KEY", "CHANDRA_CLAUDE_KEY"): env.pop(k, None)
    app_dir = home.parent / (home.name + " app")
    app_dir.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(SRC / "chandra.py", app_dir / "chandra.py")
    out = home / "app-output.txt"
    proc = subprocess.Popen([sys.executable, "-I", "-u", str(app_dir / "chandra.py"), "--no-window", *extra],
                            cwd=str(home), env=env, stdout=open(out, "w", encoding="utf-8"), stderr=subprocess.STDOUT)
    deadline = time.time() + 30
    url = None
    while time.time() < deadline and proc.poll() is None:
        m = re.search(r"App: (http://127\.0\.0\.1:\d+/app/\S+)", out.read_text(encoding="utf-8", errors="replace"))
        if m: url = m.group(1); break
        time.sleep(0.1)
    return proc, url, out


class LaunchFromAnyFolder(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root = Path(tempfile.mkdtemp(prefix="chandra launch "))
        cls.home = cls.root / "Документы и файлы ünï 测试 नमस्ते"
        cls.home.mkdir(parents=True)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.root, ignore_errors=True)

    def test_the_server_is_ready_quickly_and_serves_the_page(self):
        t0 = time.time()
        proc, url, out = start_app(self.home)
        try:
            self.assertIsNotNone(url, "the app did not report its address: " + out.read_text(encoding="utf-8", errors="replace")[-600:])
            self.assertLess(time.time() - t0, 15, "startup took too long")
            page = urllib.request.urlopen(url, timeout=10).read()
            self.assertGreater(len(page), 500_000, "the page is much smaller than expected")
            self.assertIn(b"<html", page[:400].lower())
            self.assertNotIn(b"__CHANDRA_PAIR__", page, "the pairing code was not put into the page")
        finally:
            proc.terminate(); proc.wait(timeout=10)

    def test_the_page_is_not_served_without_the_pairing_code(self):
        proc, url, out = start_app(self.home)
        try:
            self.assertIsNotNone(url)
            base = url.rsplit("/app/", 1)[0]
            with self.assertRaises(urllib.error.HTTPError) as ctx:
                urllib.request.urlopen(base + "/app/not-the-code", timeout=10)
            self.assertIn(ctx.exception.code, (401, 403, 404))
        finally:
            proc.terminate(); proc.wait(timeout=10)

    def test_the_start_log_names_the_machine_and_the_version(self):
        proc, url, out = start_app(self.home)
        try:
            self.assertIsNotNone(url)
        finally:
            proc.terminate(); proc.wait(timeout=10)
        log = (self.home / ".config" / "Chandra" / "chandra-start.log").read_text(encoding="utf-8")
        self.assertRegex(log, r"launch \d+\.\d+\.\d+ on")
        self.assertIn("machine", log)


class LauncherFiles(unittest.TestCase):
    def read(self, rel):
        return (DESKTOP.parent / rel).read_bytes()

    def test_the_launchers_are_plain_ascii_with_windows_line_endings(self):
        for name in ("Chandra.bat", "setup-chandra.bat"):
            raw = self.read(name)
            raw.decode("ascii")                 # raises if there is any non-ASCII byte
            self.assertIn(b"\r\n", raw, name + " must use CRLF line endings")
            self.assertNotRegex(raw.replace(b"\r\n", b""), rb"\n", name + " has bare LF line endings")

    def test_chandra_bat_starts_the_bundled_runtime_on_the_bundled_program(self):
        text = self.read("Chandra.bat").decode("ascii")
        self.assertIn(r'desktop\runtime\pythonw.exe', text)
        self.assertIn(r'desktop\source\chandra.py', text)
        self.assertIn("%*", text, "the launcher must pass its arguments on (a .ananta file to open)")
        self.assertIn("%~dp0", text, "the launcher must work from its own folder, whatever it is called")
        self.assertTrue((DESKTOP / "runtime" / "pythonw.exe").exists())
        self.assertTrue((DESKTOP / "source" / "chandra.py").exists())

    def test_setup_chandra_bat_is_the_same_launcher(self):
        text = self.read("setup-chandra.bat").decode("ascii")
        self.assertIn('call "%~dp0Chandra.bat"', text)
        self.assertNotIn("pythonw", text, "one launcher only: the setup file must not start Python itself")

    def test_the_runtime_is_the_64_bit_build_the_installer_ships(self):
        import struct
        data = (DESKTOP / "runtime" / "python.exe").read_bytes()
        off = struct.unpack_from("<I", data, 0x3C)[0]
        self.assertEqual(struct.unpack_from("<H", data, off + 4)[0], 0x8664, "expected an x64 (AMD64) python.exe")


if __name__ == "__main__":
    unittest.main()
