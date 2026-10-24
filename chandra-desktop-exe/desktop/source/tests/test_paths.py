"""The file tools with names that people really have: spaces, accents, Cyrillic, Chinese, Hindi. Each test runs the
real tools (run_tool) inside a home folder that is itself in a path with spaces and non-English letters, and checks
that undo puts everything back. Standard library only; nothing is sent anywhere.

    cd desktop/source && python -m unittest discover -s tests -v
"""
import importlib.util, os, tempfile, unittest
from pathlib import Path

HOME = Path(tempfile.mkdtemp(prefix="chandra paths ")) / "Ananta होम 测试"
HOME.mkdir(parents=True)
for k in ("ANTHROPIC_API_KEY", "GEMINI_API_KEY", "CHANDRA_CLAUDE_KEY"): os.environ.pop(k, None)
os.environ.update(HOME=str(HOME), USERPROFILE=str(HOME), APPDATA=str(HOME / "AppData"), XDG_CONFIG_HOME=str(HOME / ".config"))
SRC = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("chandra_paths_test", SRC / "chandra.py")
C = importlib.util.module_from_spec(spec)
spec.loader.exec_module(C)


def call(name, **args):
    out = C.run_tool(name, args)
    if "error" in out: raise AssertionError(out["error"])
    return out["result"]


class NonEnglishNames(unittest.TestCase):
    def setUp(self):
        self.dl = HOME / "Загрузки и файлы" / "Downloads"
        self.dl.mkdir(parents=True, exist_ok=True)
        self.names = ["фото отпуск.jpg", "表 格.xlsx", "a b.PDF", "résumé 测试.txt", "नोट्स.txt", "backup (2).zip"]
        for n in self.names: (self.dl / n).write_text("content of " + n, encoding="utf-8")

    def tearDown(self):
        import shutil
        shutil.rmtree(self.dl.parent, ignore_errors=True)

    def test_listing_shows_the_names_as_they_are(self):
        listed = {e["name"] for e in call("list_dir", path=str(self.dl))["entries"]}
        self.assertTrue(set(self.names) <= listed, set(self.names) - listed)

    def test_reading_a_file_with_accents_and_hindi_in_its_name(self):
        text = call("read_file", path=str(self.dl / "résumé 测试.txt"))
        self.assertIn("content of résumé 测试.txt", str(text))

    def test_searching_finds_non_english_names(self):
        found = call("search_files", path=str(self.dl), query="नोट्स")
        self.assertIn("नोट्स.txt", str(found))

    def test_organize_sorts_them_and_undo_puts_every_name_back(self):
        plan = call("organize_preview", path=str(self.dl))
        self.assertTrue(plan)
        call("organize_folder", path=str(self.dl))
        for n in self.names:
            self.assertFalse((self.dl / n).exists(), "moved away: " + n)
        self.assertEqual(sum(1 for _ in self.dl.rglob("*") if _.is_file()), len(self.names))
        call("undo_last")
        for n in self.names:
            self.assertEqual((self.dl / n).read_text(encoding="utf-8"), "content of " + n, n)

    def test_moving_into_a_folder_with_spaces_and_unicode_then_undo(self):
        target = self.dl / "Мои документы" / "测试 2026"
        call("move_path", src=str(self.dl / "表 格.xlsx"), dst=str(target) + os.sep)
        self.assertTrue((target / "表 格.xlsx").exists())
        call("undo_last")
        self.assertTrue((self.dl / "表 格.xlsx").exists())


class StaysInsideHome(unittest.TestCase):
    def test_paths_outside_the_home_folder_are_refused(self):
        for bad in ("../../../../etc/hosts", "/etc/hosts", "~/../../etc"):
            out = C.run_tool("read_file", {"path": bad})
            self.assertIn("error", out, bad)

    def test_a_link_out_of_home_is_not_followed(self):
        outside = Path(tempfile.mkdtemp(prefix="outside "))
        secret = outside / "secret.txt"; secret.write_text("not for Chandra", encoding="utf-8")
        link = HOME / "link to outside"
        try:
            os.symlink(outside, link, target_is_directory=True)
        except (OSError, NotImplementedError):
            self.skipTest("this system cannot create symbolic links here")
        out = C.run_tool("read_file", {"path": str(link / "secret.txt")})
        self.assertIn("error", out)


if __name__ == "__main__":
    unittest.main()
