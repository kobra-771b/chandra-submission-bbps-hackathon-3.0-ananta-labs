"""Host-side tests for organizing files: make_dir, move_path into a folder that does not exist yet,
organize_preview / organize_folder (one approval, one undo), and the '~' / OneDrive path forms. Standard library only.

    cd desktop/source && python -m unittest discover -s tests -v

Runs against a throwaway home folder.
"""
import importlib.util, os, tempfile, unittest
from pathlib import Path

TMP = tempfile.mkdtemp(prefix="chandra-organize-")
os.environ.update(HOME=TMP, USERPROFILE=TMP, APPDATA=str(Path(TMP) / "AppData"), XDG_CONFIG_HOME=str(Path(TMP) / ".config"))
SRC = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("chandra_host_organize_test", SRC / "chandra.py")
C = importlib.util.module_from_spec(spec)
spec.loader.exec_module(C)


def make(folder, names):
    folder.mkdir(parents=True, exist_ok=True)
    for n in names: (folder / n).write_text(n)
    return folder


def fresh(name):
    d = C.HOME / name
    if d.exists():
        import shutil; shutil.rmtree(d)
    return d


class Paths(unittest.TestCase):
    def test_tilde_and_relative_forms_reach_the_same_folder(self):
        d = make(fresh("Downloads"), ["a.txt"])
        for form in ("Downloads", "~/Downloads", "~\\Downloads", str(d)):
            self.assertEqual(C._safe(form), d.resolve(), form)

    def test_redirected_known_folder_is_found_in_onedrive(self):
        import shutil
        shutil.rmtree(C.HOME / "Desktop", ignore_errors=True)
        d = make(C.HOME / "OneDrive" / "Desktop", ["x.txt"])
        self.assertEqual(C._safe("Desktop"), d.resolve())
        shutil.rmtree(C.HOME / "OneDrive")


class MoveIntoNewFolder(unittest.TestCase):
    def test_missing_folder_never_renames_the_file(self):
        d = make(fresh("mv1"), ["photo.jpg"])
        with self.assertRaises(RuntimeError) as cm: C.t_move_path({"src": str(d / "photo.jpg"), "dst": str(d / "Images")})
        self.assertIn("make_dir", str(cm.exception))
        self.assertEqual(sorted(p.name for p in d.iterdir()), ["photo.jpg"])       # untouched, not renamed to "Images"

    def test_trailing_slash_makes_the_folder(self):
        d = make(fresh("mv2"), ["photo.jpg", "b.jpg"])
        out = C.t_move_path({"src": str(d / "photo.jpg"), "dst": str(d / "Images") + "/"})
        self.assertEqual(Path(out["to"]), (d / "Images" / "photo.jpg").resolve())
        C.t_move_path({"src": str(d / "b.jpg"), "dst": str(d / "Images")})         # now it exists, so a plain folder path works
        self.assertEqual(sorted(p.name for p in (d / "Images").iterdir()), ["b.jpg", "photo.jpg"])

    def test_rename_with_an_extension_still_works(self):
        d = make(fresh("mv3"), ["a.txt"])
        C.t_move_path({"src": str(d / "a.txt"), "dst": str(d / "b.txt")})
        self.assertTrue((d / "b.txt").exists())

    def test_make_dir(self):
        d = fresh("mk")
        self.assertTrue(C.t_make_dir({"path": str(d / "x" / "y")})["created"])
        self.assertFalse(C.t_make_dir({"path": str(d / "x" / "y")})["created"])
        (d / "f").write_text("f")
        with self.assertRaises(RuntimeError): C.t_make_dir({"path": str(d / "f")})
        with self.assertRaises(RuntimeError): C.t_make_dir({"path": "/etc/chandra-nope"})


class OrganizeFolder(unittest.TestCase):
    NAMES = ["a.jpg", "b.PNG", "c.pdf", "d.docx", "e.xlsx", "f.mp4", "g.mp3", "h.zip", "i.exe", "j.py", "k.xyz", "noext"]

    def setUp(self):
        self.d = make(fresh("Downloads"), self.NAMES)
        (self.d / "SomeFolder").mkdir()
        (self.d / "SomeFolder" / "inner.jpg").write_text("inner")
        for n in (".hidden", "movie.mp4.crdownload", "desktop.ini", "link.lnk"): (self.d / n).write_text(n)

    def test_preview_changes_nothing(self):
        before = sorted(p.name for p in self.d.iterdir())
        out = C.t_organize_preview({"path": "Downloads"})
        self.assertEqual(out["files"], len(self.NAMES))
        self.assertEqual(out["folders"]["Images"]["count"], 2)
        self.assertEqual(out["folders"]["Other"]["count"], 2)
        self.assertEqual(out["left_alone_count"], 4)
        self.assertEqual(sorted(p.name for p in self.d.iterdir()), before)

    def test_organize_by_type_then_undo(self):
        before = sorted(p.name for p in self.d.iterdir())
        out = C.t_organize_folder({"path": "~/Downloads"})
        self.assertTrue(out["ok"]); self.assertEqual(out["moved"], len(self.NAMES))
        self.assertEqual(sorted(p.name for p in (self.d / "Images").iterdir()), ["a.jpg", "b.PNG"])
        self.assertTrue((self.d / "Installers" / "i.exe").exists() and (self.d / "Code" / "j.py").exists())
        self.assertTrue((self.d / "Other" / "k.xyz").exists() and (self.d / "Other" / "noext").exists())
        # left alone: the folder and what is in it, hidden/system files, unfinished downloads, shortcuts
        for n in (".hidden", "movie.mp4.crdownload", "desktop.ini", "link.lnk", "SomeFolder"): self.assertTrue((self.d / n).exists(), n)
        self.assertTrue((self.d / "SomeFolder" / "inner.jpg").exists())
        undone = C.t_undo_last({})                                  # one step puts the whole job back
        self.assertTrue(undone["ok"], undone)
        self.assertEqual(sorted(p.name for p in self.d.iterdir()), before)

    def test_running_it_twice_is_a_no_op(self):
        C.t_organize_folder({"path": "Downloads"})
        again = C.t_organize_folder({"path": "Downloads"})
        self.assertEqual(again["moved"], 0)
        self.assertEqual(C.t_organize_preview({"path": "Downloads"})["files"], 0)

    def test_new_files_join_existing_folders_and_nothing_is_overwritten(self):
        C.t_organize_folder({"path": "Downloads"})
        (self.d / "a.jpg").write_text("newer a")
        out = C.t_organize_folder({"path": "Downloads"})
        self.assertEqual(out["moved"], 1)
        self.assertEqual((self.d / "Images" / "a.jpg").read_text(), "a.jpg")
        self.assertEqual((self.d / "Images" / "a (1).jpg").read_text(), "newer a")

    def test_undo_leaves_what_changed_since(self):
        C.t_organize_folder({"path": "Downloads"})
        (self.d / "c.pdf").write_text("a different c.pdf the person saved")
        (self.d / "Documents" / "c.pdf").unlink()                   # gone from where Chandra put it
        out = C.t_undo_last({})
        self.assertTrue(out["ok"]); self.assertIn("left where they are", out["result"])
        self.assertEqual((self.d / "c.pdf").read_text(), "a different c.pdf the person saved")

    def test_by_extension_and_by_date(self):
        out = C.t_organize_folder({"path": "Downloads", "by": "extension"})
        self.assertTrue((self.d / "JPG" / "a.jpg").exists() and (self.d / "No extension" / "noext").exists())
        C.t_undo_last({})
        out = C.t_organize_folder({"path": "Downloads", "by": "date"})
        self.assertEqual(len(out["folders"]), 1); self.assertRegex(next(iter(out["folders"])), r"^\d{4}-\d{2}$")

    def test_a_file_where_a_folder_should_be_does_not_block_it(self):
        d = make(fresh("Downloads"), ["a.jpg", "Images"])          # "Images" is a FILE
        out = C.t_organize_folder({"path": "Downloads"})
        self.assertEqual(out["moved"], 2)                           # a.jpg, and the loose file called Images (no extension: "Other")
        self.assertTrue((d / "Other" / "Images").is_file())
        self.assertTrue(any((d / n / "a.jpg").exists() for n in ("Images", "Images (files)")))   # whichever name was free

    def test_refuses_home_and_outside_home(self):
        with self.assertRaises(RuntimeError): C.t_organize_folder({"path": str(C.HOME)})
        with self.assertRaises(RuntimeError): C.t_organize_folder({"path": "/etc"})
        with self.assertRaises(RuntimeError): C.t_organize_folder({"path": "Downloads", "by": "mood"})
        with self.assertRaises(RuntimeError): C.t_organize_folder({"path": "NoSuchFolder"})

    def test_stop_all_ends_the_job_and_keeps_it_undoable(self):
        C.HALT.set()
        try:
            out = C.t_organize_folder({"path": "Downloads"})
        finally:
            C.HALT.clear()
        self.assertTrue(out["stopped"]); self.assertEqual(out["moved"], 0)

    def test_tools_are_registered_and_gated(self):
        for t in ("make_dir", "organize_preview", "organize_folder"): self.assertIn(t, C.TOOLS)
        self.assertIn("organize_folder", C.GATED); self.assertIn("make_dir", C.GATED)
        self.assertNotIn("organize_preview", C.GATED)               # read-only

    def test_list_dir_says_when_it_cut_the_list(self):
        make(fresh("big"), ["f%d.txt" % i for i in range(5)])
        out = C.t_list_dir({"path": "big"})
        self.assertEqual((out["total"], out["truncated"], len(out["entries"])), (5, False, 5))


if __name__ == "__main__":
    unittest.main()
