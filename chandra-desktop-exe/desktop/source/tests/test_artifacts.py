"""Host-side tests for artifacts and source discovery (Chandra 1.2). Standard library only.

    cd desktop/source && python -m unittest discover -s tests -v

Runs against a throwaway home folder; never touches your real Chandra data.
"""
import importlib.util, os, tempfile, unittest
from pathlib import Path

TMP = tempfile.mkdtemp(prefix="chandra-test-")
os.environ.update(HOME=TMP, USERPROFILE=TMP, APPDATA=str(Path(TMP) / "AppData"), XDG_CONFIG_HOME=str(Path(TMP) / ".config"))
SRC = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("chandra_host_under_test", SRC / "chandra.py")
C = importlib.util.module_from_spec(spec)
spec.loader.exec_module(C)


class Artifacts(unittest.TestCase):
    def test_create_version_restore_delete(self):
        a = C.art_save({"op": "r1:c1", "title": "T", "type": "code", "language": "python", "content": "print(1)\n"})
        self.assertEqual(a["version"], 1)
        self.assertTrue(C.art_save({"op": "r1:c1", "content": "print(1)\n"}).get("duplicate"), "same op must not duplicate")
        b = C.art_save({"id": a["id"], "op": "r2:c1", "content": "print(2)\n", "note": "two"})
        self.assertEqual([v["v"] for v in b["versions"]], [1, 2])
        self.assertEqual(C.art_save({"id": a["id"], "op": "r3:c1", "content": "print(2)\n"})["version"], 2, "unchanged content adds no version")
        r = C.art_restore(a["id"], 1)
        self.assertEqual(r["version"], 3)
        self.assertEqual(C.art_get(a["id"])["versions"][-1]["content"], "print(1)\n")
        self.assertIn(a["id"], [m["id"] for m in C.art_list()])
        C.art_delete(a["id"])
        self.assertNotIn(a["id"], [m["id"] for m in C.art_list()])

    def test_limits_and_ids(self):
        with self.assertRaises(ValueError): C.art_save({"content": "x" * (C.ART_MAX_CONTENT + 1)})
        with self.assertRaises(ValueError): C.art_get("../../etc/passwd")
        with self.assertRaises(KeyError): C.art_save({"id": "art_missing0", "content": "x"})
        self.assertEqual(C.art_save({"type": "exe", "content": "x"})["type"], "text", "unknown types fall back to text")

    def test_version_cap(self):
        a = C.art_save({"content": "v0"})
        for i in range(C.ART_MAX_VERSIONS + 4): C.art_save({"id": a["id"], "content": "v%d" % (i + 1)})
        rec = C.art_get(a["id"])
        self.assertEqual(len(rec["versions"]), C.ART_MAX_VERSIONS)
        self.assertEqual(rec["pruned"], 5)


class SourceDiscovery(unittest.TestCase):
    def test_map_has_real_ranges(self):
        m = C.source_map()
        self.assertTrue(m["available"])
        e = m["entries"]["host.artifacts.store"]
        lines = (SRC / e["file"]).read_text(encoding="utf-8").splitlines()
        self.assertIn("@src host.artifacts.store", lines[e["start"] - 1])
        self.assertIn("@end host.artifacts.store", lines[e["end"] - 1])

    def test_locate_exact_and_partial(self):
        f = Path(TMP) / "proj" / "a.py"; f.parent.mkdir(exist_ok=True)
        f.write_text("x = 1\ndef hello():\n    return 'hi'\n", encoding="utf-8")
        d = C.source_locate({"path": str(f), "snippet": "def hello():\n    return 'hi'"})
        self.assertEqual((d["match"], d["range"]), ("exact", [2, 3]))
        d = C.source_locate({"path": str(f), "snippet": "def hello():  # changed since\n    return 'hi'"})
        self.assertIn(d["match"], ("partial", "none"))

    def test_path_rules(self):
        sec = Path(TMP) / ".ssh" / "id_rsa"; sec.parent.mkdir(exist_ok=True); sec.write_text("k")
        for bad in (str(sec), "/etc/passwd", str(C.STORE / "pairing_code"), str(Path(TMP) / ".env")):
            with self.assertRaises((PermissionError, RuntimeError, ValueError), msg=bad):
                C.source_read({"path": bad})
        self.assertEqual(C.source_read({"path": "ui/state.js", "start": 1, "end": 1})["kind"], "chandra")


if __name__ == "__main__":
    unittest.main()
