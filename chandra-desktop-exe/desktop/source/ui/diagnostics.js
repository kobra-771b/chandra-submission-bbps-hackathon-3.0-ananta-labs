/* Diagnostics: the page that replaced Activity at the top of the rail. Everything you would want when something is
   wrong, and how well Chandra is doing: a health score, the system, the brain and keys (never their values), voice,
   safety, live latency to Claude and Gemini (free list calls, run on request), the window and its smoothness,
   your location, the error log and the start log. "Copy report" puts all of it in one block to paste. The
   host does the gathering (/diag, /diag/probe); the activity list stays underneath. */
(() => {
  const sec = document.getElementById("activity");
  if (!sec) return;
  const H = { authorization: "Bearer __CHANDRA_PAIR__" };
  const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const h2 = sec.querySelector("h2"); if (h2) h2.textContent = "Diagnostics";
  const lead = sec.querySelector("p.mu"); if (lead) lead.textContent = "Recent activity";
  const root = document.createElement("div"); root.id = "dg";
  (h2 || sec).after(root);
  let D = null, probed = false, page = {}, busy = false, stamp = 0;

  const get = async path => { const r = await fetch(location.origin + path, { headers: H }); if (!r.ok) throw new Error(r.status); return r.json(); };
  const dur = s => s < 60 ? s + " s" : s < 3600 ? Math.floor(s / 60) + " min" : Math.floor(s / 3600) + " h " + Math.floor(s % 3600 / 60) + " min";

  function pageFacts() {
    const g = {}; const nav = navigator;
    g.native = !!window.CHANDRA_NATIVE ? "native window (computer control built in)" : "browser (loopback bridge)";
    g.ui = (document.documentElement.dataset.ui || "modern") + " / " + (document.documentElement.dataset.accent || "aurora");
    g.screen = screen.width + "x" + screen.height + " @" + (devicePixelRatio || 1) + "x";
    g.cpu = nav.hardwareConcurrency ? nav.hardwareConcurrency + " threads" : "unknown";
    g.mem = nav.deviceMemory ? "~" + nav.deviceMemory + " GB" : "unknown";
    g.heap = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + " MB used" : "n/a";
    g.online = nav.onLine ? "online" : "offline";
    g.lang = nav.language + " · " + (Intl.DateTimeFormat().resolvedOptions().timeZone || "");
    try { const c = document.createElement("canvas"), gl = c.getContext("webgl"); const x = gl && gl.getExtension("WEBGL_debug_renderer_info"); g.gpu = gl ? (x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : "WebGL on") : "no WebGL (the sky falls back to a calm gradient)"; } catch (_) { g.gpu = "unknown"; }
    g.mathml = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mrow").constructor.name !== "Element" ? "supported" : "limited";
    g.speechOut = window.speechSynthesis ? speechSynthesis.getVoices().length + " device voices" : "not available";
    g.speechIn = (window.SpeechRecognition || window.webkitSpeechRecognition) ? "available" : "not available";
    const P = window.ChandraPlace; g.place = P && P.loc ? (P.loc.name || "found") + (P.auto ? " (auto)" : " (set by you)") : "not set yet";
    try { localStorage.setItem("chandra-diag", "1"); localStorage.removeItem("chandra-diag"); g.storage = "works"; } catch (_) { g.storage = "blocked"; }
    return g;
  }
  function fps() {
    return new Promise(res => { let n = 0; const t0 = performance.now(); const f = t => { n++; if (t - t0 < 700) requestAnimationFrame(f); else res(Math.round(n / ((t - t0) / 1000))); }; requestAnimationFrame(f); });
  }

  function score() {
    if (!D) return [0, "Checking…", "warn"];
    let pts = 100, notes = [];
    const b = D.brain;
    if (!b.claude_key && !b.gemini_key && !b.engine_up) { pts -= 40; notes.push("no brain available"); }
    else if (!b.claude_key && !b.gemini_key) { pts -= 12; notes.push("only the local engine"); }
    if (D.errors.last_24h > 0) { pts -= Math.min(25, D.errors.last_24h * 3); notes.push(D.errors.last_24h + " errors in 24 h"); }
    if (D.system.webview2 === false) { pts -= 10; notes.push("WebView2 missing"); }
    if (D.probes) {
      Object.entries(D.probes).forEach(([k, v]) => { if (!v.ok) { pts -= 15; notes.push(k + " failed"); } else if (v.ms > 2500) { pts -= 5; notes.push(k + " slow"); } });
      (D.selfcheck || []).forEach(c => { if (!c.ok) { pts -= 6; notes.push(c.check); } });
    }
    if (page.fps && page.fps < 24) { pts -= 6; notes.push("low frame rate"); }
    pts = Math.max(0, Math.min(100, pts));
    const lab = pts >= 90 ? "Healthy" : pts >= 70 ? "Mostly fine" : pts >= 45 ? "Needs attention" : "Problems";
    return [pts, lab + (notes.length ? ": " + notes.slice(0, 3).join(", ") : probed ? "" : ". Run the full check for live numbers."), pts >= 90 ? "ok" : pts >= 70 ? "warn" : "bad"];
  }
  const kv = (k, v, cls) => `<div class="kv"><span>${esc(k)}</span><span class="${cls || ""}">${esc(v)}</span></div>`;
  const yes = (v, a, b) => kv(a, v ? "yes" : (b || "no"), v ? "ok" : "warn");

  function draw() {
    const [pts, label, cls] = score();
    const col = cls === "ok" ? "#7be0b4" : cls === "warn" ? "#ffd98a" : "#ff8f8f";
    let out = `<div class="dtop"><div class="ring" style="--p:${pts};--c:${col}" role="img" aria-label="Health ${pts} of 100"><b>${pts}</b></div><div><h3>${esc(label.split(":")[0].split(".")[0])}</h3><p class="mu sm">${esc(label.includes(":") ? label.split(":").slice(1).join(":").trim() : label.includes(".") ? label.split(".").slice(1).join(".").trim() : "Everything checked looks good.")}</p><p class="stamp">${stamp ? "Updated " + new Date(stamp).toLocaleTimeString() : ""}</p></div>
      <div class="dbtn"><button class="btn" id="dgRef" ${busy ? "disabled" : ""}>Refresh</button><button class="btn p" id="dgFull" ${busy ? "disabled" : ""}>${busy ? "Checking…" : "Run full check"}</button><button class="btn" id="dgCopy">Copy report</button></div></div>`;
    if (!D) { root.innerHTML = out; bind(); return; }
    const s = D.system, b = D.brain, v = D.voice, sa = D.safety;
    const card = (t, body) => `<div class="glass dc"><h4>${t}</h4>${body}</div>`;
    out += '<div class="dgrid">';
    out += card("System", kv("Chandra", "v" + s.version + "-" + s.build) + kv("Windows / OS", s.os) + kv("Processor", s.machine) + kv("Python", s.python) + kv("Running for", dur(s.uptime_s)) +
      (s.webview2 === null ? "" : yes(s.webview2, "WebView2", "missing (opens in your browser)")) + kv("Ports", s.port + " · " + s.instance_port) + kv("Data folder", s.data_folder) + kv("Data size", s.data_kb + " KB · " + s.artifacts + " artifacts"));
    out += card("Brain and keys", kv("Thinking with", b.active + (b.mode !== "auto" ? " (forced)" : ""), "ok") + yes(b.claude_key, "Claude key", "not set") + (b.claude_key ? kv("Key from", b.claude_source || "file") : "") + yes(b.gemini_key, "Gemini key", "not set") +
      kv("Gemini model", b.gemini_model) + yes(b.engine_up, "Local engine", "not running") + kv("Host tools", D.host_tools + " · MCP " + D.mcp.tools));
    out += card("Voice", kv("Listening", v.listening + (v.stt_model ? " · " + v.stt_model : "")) + kv("Speaking", v.speaking + (v.tts_voice && v.tts_model ? " · " + v.tts_voice : "")) + (v.tts_model ? kv("Speech model", v.tts_model) : "") + (v.embed_model ? kv("Recall model", v.embed_model) : "") +
      kv("Device voices", page.speechOut || "…") + kv("Browser listening", page.speechIn || "…"));
    out += card("Safety", yes(sa.safeguards, "Safeguards", "off") + kv("Shell commands", sa.shell ? "on" : "off by design", sa.shell ? "warn" : "ok") + kv("HTTP computer control", sa.bridge_http_act, "ok"));
    out += card("This window", kv("Mode", page.native) + kv("Style / colour", page.ui) + kv("Smoothness", page.fps ? page.fps + " fps" : "…", page.fps && page.fps < 24 ? "warn" : "ok") + kv("Graphics", page.gpu) + kv("Screen", page.screen) + kv("CPU / memory", page.cpu + " · " + page.mem) +
      kv("Page memory", page.heap) + kv("Network", page.online, page.online === "online" ? "ok" : "bad") + kv("Maths (MathML)", page.mathml) + kv("Storage", page.storage, page.storage === "works" ? "ok" : "bad") + kv("Language / time zone", page.lang) + kv("Location", page.place));
    if (D.probes) {
      const max = Math.max(1000, ...Object.values(D.probes).map(p => p.ms));
      out += card("Live connections", Object.entries(D.probes).map(([k, p]) => `<div class="kv"><span>${esc(k)}</span><span class="${p.ok ? "ok" : "bad"}">${p.ok ? p.ms + " ms" : esc(p.detail)}</span></div><div class="bar"><i style="width:${Math.max(4, Math.round(p.ms / max * 100))}%"></i></div>`).join(""));
      out += card("Checks", (D.selfcheck || []).map(c => `<div class="chk"><span class="${c.ok ? "ok" : "bad"}">${c.ok ? "✓" : "✗"}</span><span><b>${esc(c.check)}</b> <span class="mu sm">${esc(c.detail)}</span></span></div>`).join(""));
    } else out += card("Live connections", '<p class="mu sm">Run the full check to time the connection to Claude and Gemini (free calls, no tokens) and to run every self-check.</p>');
    out += card("Errors (24 h: " + D.errors.last_24h + ")", `<pre>${esc(D.errors.recent || "No errors logged yet.")}</pre><p class="stamp">${esc(D.errors.file)}</p>`);
    out += card("Start log", `<pre>${esc(D.start_log || "Nothing logged yet.")}</pre>`);
    if (D.crash_log) out += card("Crash log", `<pre>${esc(D.crash_log)}</pre><p class="stamp">Chandra restarts itself after a crash and notes why here.</p>`);
    out += "</div>";
    root.innerHTML = out; bind();
  }
  function bind() {
    root.querySelector("#dgRef").onclick = () => load(false);
    root.querySelector("#dgFull").onclick = () => load(true);
    root.querySelector("#dgCopy").onclick = async () => {
      const t = report(); try { await navigator.clipboard.writeText(t); window.toast && toast("Report copied", "Keys are not in it"); } catch (_) { window.toast && toast("Could not copy"); }
    };
  }
  function report() {
    if (!D) return "No diagnostics yet.";
    const L = ["Chandra diagnostics " + new Date().toISOString(), ""], sec2 = (t, o) => { L.push("[" + t + "]"); Object.entries(o).forEach(([k, v]) => L.push("  " + k + ": " + (typeof v === "object" ? JSON.stringify(v) : v))); L.push(""); };
    sec2("system", D.system); sec2("brain", D.brain); sec2("voice", D.voice); sec2("safety", D.safety); sec2("window", page);
    if (D.probes) sec2("connections", Object.fromEntries(Object.entries(D.probes).map(([k, p]) => [k, (p.ok ? "ok " + p.ms + " ms" : "FAILED " + p.detail)])));
    if (D.selfcheck) { L.push("[checks]"); D.selfcheck.forEach(c => L.push("  " + (c.ok ? "ok  " : "FAIL") + " " + c.check + ": " + c.detail)); L.push(""); }
    L.push("[errors, last 24 h: " + D.errors.last_24h + "]", D.errors.recent || "none", "", "[start log]", D.start_log || "none");
    return L.join("\n");
  }
  async function load(full) {
    if (busy) return; busy = true; draw();
    try {
      page = pageFacts(); const f = fps();
      D = await get(full ? "/diag/probe" : "/diag"); if (full) probed = true; else if (probed && D) probed = false;
      page.fps = await f; stamp = Date.now();
    } catch (e) { D = null; root.innerHTML = '<div class="glass dc"><h4>Diagnostics</h4><p class="bad">Chandra\'s host did not answer (' + esc(e.message) + '). If Chandra just started, wait a moment and refresh.</p><button class="btn" id="dgRef">Try again</button></div>'; root.querySelector("#dgRef").onclick = () => load(false); busy = false; return; }
    busy = false; draw();
  }
  let seen = false;
  const open = () => { if (!seen || Date.now() - stamp > 20000) { seen = true; load(false); } };
  new MutationObserver(() => { if (sec.classList.contains("on")) open(); }).observe(sec, { attributes: true, attributeFilter: ["class"] });
  if (sec.classList.contains("on")) open();
  window.ChandraDiagnostics = { load, report };
})();
