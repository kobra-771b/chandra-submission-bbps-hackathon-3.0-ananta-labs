"""Checks that the page and the host agree: every computer tool the page offers exists on the host, the page's
scripts are valid JavaScript (when Node.js is installed), and the agent's instructions name only tools that exist.

    cd desktop/source && python -m unittest discover -s tests -v
"""
import re, shutil, subprocess, tempfile, unittest
from pathlib import Path

SRC = Path(__file__).resolve().parents[1]
HOST = (SRC / "chandra.py").read_text(encoding="utf-8")
PAGE = (SRC / "app.v1.html").read_text(encoding="utf-8")


def host_tools():
    return set(re.findall(r"^def t_(\w+)\(", HOST, re.M))


def page_tools():
    """Names of the agent tools defined in the page (both tables), found anywhere in the page."""
    return (set(re.findall(r"^\s(\w+):\{(?:d:|risky|computer)", PAGE, re.M)) | set(re.findall(r"^ (\w+):\[", PAGE, re.M))
            | set(re.findall(r"^T\.(\w+)=\{", PAGE, re.M)))


def block(start, end="};"):
    a = PAGE.index(start); b = PAGE.index(end, a)
    return PAGE[a:b]


class ToolContract(unittest.TestCase):
    def test_every_bridge_tool_exists_on_the_host(self):
        bridge = set(re.findall(r"^ (\w+):\[", block("const BTOOLS={"), re.M))
        self.assertTrue(bridge, "no bridge tools found")
        missing = sorted(bridge - host_tools())
        self.assertEqual(missing, [], "the page offers tools the host does not have")

    def test_read_only_list_names_real_tools(self):
        ro = re.search(r'const READ_ONLY=new Set\(\[([^\]]*)\]\)', PAGE).group(1)
        names = set(re.findall(r'"(\w+)"', ro))
        known = page_tools() | host_tools()
        self.assertEqual(sorted(names - known), [])

    def test_the_agent_instructions_name_existing_tools(self):
        prompt = re.search(r"const sysPrompt=\(\)=>`(.*?)`;", PAGE, re.S).group(1)
        named = set(re.findall(r"\b(set_plan|update_plan|propose_memory|note_add|web_research|computer_profile|"
                               r"active_window|screen_text|organize_folder|organize_preview|undo_last|submit_checkpoint|"
                               r"set_timer|set_reminder|time_now|web_search|web_fetch|http_request|download_file)\b", prompt))
        self.assertEqual(sorted(named - (page_tools() | host_tools())), [])

    def test_only_the_risky_steps_are_checked_before_they_run(self):
        m = re.search(r"const RISK_TOOLS=new Set\(\[([^\]]*)\]\)", PAGE).group(1)
        names = set(re.findall(r'"(\w+)"', m))
        self.assertEqual(names, {"delete_path", "run_shell", "submit_checkpoint", "http_request",
                                 "click", "drag", "scroll", "type_text", "press_keys"})
        self.assertEqual(sorted(names - (page_tools() | host_tools())), [])
        self.assertIn("assess_action", host_tools())
        self.assertIn('tool:"assess_action"', PAGE)

    def test_there_are_no_permission_switches_left(self):
        for old in ("Choose what Chandra can use", "S.perm", "PERM[", "CAT[", "AUTO_PERM", "ChandraPerm", "Allow for this task",
                    "Allow in this window", "I need ${p} access"):
            self.assertNotIn(old, PAGE, old)

    def test_the_gate_asks_the_host_and_holds_only_one_yes_per_workflow(self):
        gate = block("async function riskGate(name,args){", "\n}\n")
        self.assertIn('tool:"assess_action"', gate)
        self.assertIn("CH.taskOK.has(r.key)", gate)
        self.assertIn("CH.okUntil", gate)

    def test_diagnostics_and_playbooks_are_kept(self):   # the production UI keeps Playbooks and Diagnostics (the old Activity page)
        for need in ("ChandraPlaybooks", 'id="playbooks"', 'id="activity"', "Diagnostics"):
            self.assertIn(need, PAGE, need)

    def test_the_old_per_window_and_per_session_gates_are_gone(self):
        for old in ("appInputAllowed", "askAppInput", "APP_INPUT", "APP_OK", "ASK_FIRST", "ASK_EVERY_TIME"):
            self.assertNotIn(old, PAGE, old)


class PageScripts(unittest.TestCase):
    @unittest.skipUnless(shutil.which("node"), "Node.js is not installed")
    def test_every_inline_script_parses(self):
        scripts = re.findall(r"<script(?![^>]*src=)[^>]*>(.*?)</script>", PAGE, re.S)
        bad = []
        with tempfile.TemporaryDirectory() as d:
            for i, sc in enumerate(scripts):
                if len(sc) > 300000 or "<!DOCTYPE" in sc[:200]: continue      # the artifact sandbox template is not a script
                f = Path(d) / ("s%02d.js" % i); f.write_text(sc, encoding="utf-8")
                r = subprocess.run(["node", "--check", str(f)], capture_output=True, text=True)
                if r.returncode: bad.append((i, r.stderr.splitlines()[:2]))
        self.assertEqual(bad, [])

    def test_the_page_contains_no_api_key_values(self):
        self.assertIsNone(re.search(r"sk-ant-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{30,}", PAGE))


if __name__ == "__main__":
    unittest.main()
