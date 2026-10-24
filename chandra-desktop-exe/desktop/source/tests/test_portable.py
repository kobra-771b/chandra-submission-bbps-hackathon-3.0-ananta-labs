"""The portable copy: it runs from its own folder, keeps all its data in a data folder beside it, and never writes
into the user's profile. Tested here by running a copy of the program in a folder with spaces and non-English letters;
the Windows launcher's behaviour is checked as text (see test_launch.py) and needs a real Windows test.

    cd desktop/source && python -m unittest discover -s tests -v
"""
import os, re, shutil, subprocess, sys, tempfile, time, unittest
from pathlib import Path

SRC = Path(__file__).resolve().parents[1]


class PortableCopy(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root = Path(tempfile.mkdtemp(prefix="portable ")) / "Chandra Portable ünï 测试"
        cls.app = cls.root / "desktop" / "source"
        cls.app.mkdir(parents=True)
        shutil.copyfile(SRC / "chandra.py", cls.app / "chandra.py")
        (cls.root / "portable.txt").write_text("This copy keeps its data in the data folder beside it.\n", encoding="utf-8")
        cls.data = cls.root / "data"
        cls.home = Path(tempfile.mkdtemp(prefix="portable home "))

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.root.parent, ignore_errors=True)
        shutil.rmtree(cls.home, ignore_errors=True)

    def run_app(self):
        env = dict(os.environ, HOME=str(self.home), XDG_CONFIG_HOME=str(self.home / ".config"), USERPROFILE=str(self.home),
                   CHANDRA_DATA=str(self.data))
        for k in ("ANTHROPIC_API_KEY", "GEMINI_API_KEY", "CHANDRA_CLAUDE_KEY"): env.pop(k, None)
        out = self.home / "out.txt"
        proc = subprocess.Popen([sys.executable, "-I", "-u", str(self.app / "chandra.py"), "--no-window"], cwd=str(self.home),
                                env=env, stdout=open(out, "w", encoding="utf-8"), stderr=subprocess.STDOUT)
        url = None; deadline = time.time() + 30
        while time.time() < deadline and proc.poll() is None:
            m = re.search(r"App: (http://127\.0\.0\.1:\d+/app/\S+)", out.read_text(encoding="utf-8", errors="replace"))
            if m: url = m.group(1); break
            time.sleep(0.1)
        return proc, url

    def test_the_data_goes_into_the_data_folder_beside_the_app(self):
        proc, url = self.run_app()
        try:
            self.assertIsNotNone(url, "the portable copy did not start")
            self.assertTrue((self.data / "chandra-start.log").exists(), "the start log is not in the data folder")
        finally:
            proc.terminate(); proc.wait(timeout=10)
        self.assertFalse((self.home / ".config" / "Chandra").exists(), "the portable copy wrote into the user's profile")

    def test_the_portable_copy_carries_no_key_file_and_no_personal_data(self):
        self.assertFalse((self.app / "chandra.env").exists())
        self.assertFalse(any(self.data.glob("chandra.env")) if self.data.exists() else False)


if __name__ == "__main__":
    unittest.main()
