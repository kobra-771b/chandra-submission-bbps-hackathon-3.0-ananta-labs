/* ============ Chandra Artifacts ============
   Lasting, inspectable outputs from conversations: code, HTML apps, documents, SVG, charts, tables.

   Where they come from (all real paths through the assistant, see "Chandra · one assistant"):
     create_artifact  the model's tool for making or revising an artifact (the main path)
     write_file       a file Chandra wrote on this computer (after approval) is kept as an artifact too,
                      with that file as verified provenance
     save_file        a file Chandra made for the person to save
     reply            a long fenced code block in a reply (models that don't use tools); it is moved
                      out of the reply into an artifact, so nothing is lost and the reply stays short
   Where they live: Chandra's host, one JSON file each in the data folder (artifacts/), with versions.

   The click contract, everywhere an artifact appears (page cards, chat chips, reply chips):
     click             the artifact's normal action: HTML runs in its sandboxed preview, a document
                       opens to read, code opens in the source view, data opens as a table, charts draw
     Shift + click     source discovery instead (never both): where it came from, real file locations
                       with line ranges when Chandra can prove them, and the Chandra code that handles it
   Keyboard: Enter opens, Shift+Enter inspects. Touch or keyboard users also get an "Inspect source"
   button in the artifact panel, so nothing depends on holding Shift. */
(function () {
"use strict";
const R = window.ChandraRender, h = R && R.h;
if (!R) return;
const $ = s => document.querySelector(s);
const HDR = { authorization: "Bearer __CHANDRA_PAIR__", "content-type": "application/json" };
const toastSafe = (a, b) => { try { window.toast ? window.toast(a, b) : 0 } catch (_) {} };
const ago = ts => { const m = (Date.now() - ts) / 6e4 | 0; return m < 1 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? (m / 60 | 0) + " h ago" : (m / 1440 | 0) + " d ago"; };
const size = n => n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(1) + " KB" : (n / 1048576).toFixed(1) + " MB";
const debounce = (fn, ms) => { let t = 0; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

async function api(path, body) {
  let r;
  try { r = await fetch(location.origin + path, body === undefined ? { headers: HDR } : { method: "POST", headers: HDR, body: JSON.stringify(body) }); }
  catch (_) { throw new Error("Chandra's host is not reachable. Restart Chandra."); }
  let d = {}; try { d = await r.json(); } catch (_) {}
  if (!r.ok || d.error) throw new Error(d.error || "Chandra's host answered " + r.status);
  return d;
}

/* ---------- types ---------- */
const TYPES = {
  html: { label: "App", icon: "M3 5h18v14H3zM3 9h18M6.5 7h.01M9 7h.01", ext: "html", mime: "text/html", open: "preview" },
  code: { label: "Code", icon: "M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14", ext: "txt", mime: "text/plain", open: "source" },
  markdown: { label: "Document", icon: "M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6", ext: "md", mime: "text/markdown", open: "preview" },
  svg: { label: "Graphic", icon: "M3 21l3-9 9-9 6 6-9 9zM6 12l6 6", ext: "svg", mime: "image/svg+xml", open: "preview" },
  chart: { label: "Chart", icon: "M4 20V10M10 20V4M16 20v-8M21 20H3", ext: "json", mime: "application/json", open: "preview" },
  csv: { label: "Table", icon: "M3 5h18v14H3zM3 10h18M3 15h18M9 5v14", ext: "csv", mime: "text/csv", open: "preview" },
  json: { label: "Data", icon: "M8 4c-2 0-2 2-2 4s-2 4-2 4 2 2 2 4 0 4 2 4M16 4c2 0 2 2 2 4s2 4 2 4-2 2-2 4 0 4-2 4", ext: "json", mime: "application/json", open: "preview" },
  text: { label: "Text", icon: "M5 6h14M5 10h14M5 14h10M5 18h7", ext: "txt", mime: "text/plain", open: "preview" }
};
const LANG_EXT = { python: "py", py: "py", javascript: "js", js: "js", typescript: "ts", ts: "ts", tsx: "tsx", jsx: "jsx", css: "css", scss: "scss",
  bash: "sh", sh: "sh", shell: "sh", zsh: "sh", powershell: "ps1", ps1: "ps1", bat: "bat", java: "java", kotlin: "kt", swift: "swift", rust: "rs", rs: "rs",
  go: "go", c: "c", cpp: "cpp", "c++": "cpp", cs: "cs", csharp: "cs", php: "php", ruby: "rb", rb: "rb", sql: "sql", yaml: "yml", yml: "yml", toml: "toml",
  xml: "xml", html: "html", json: "json", r: "r", lua: "lua", dart: "dart", scala: "scala", vue: "vue", svelte: "svelte", dockerfile: "Dockerfile" };
const icon = (t, cls) => `<svg class="${cls || "ai"}" viewBox="0 0 24 24" aria-hidden="true"><path d="${(TYPES[t] || TYPES.text).icon}"/></svg>`;
function inferType(type, language, name) {
  const t = String(type || "").toLowerCase(), l = String(language || "").toLowerCase(), ext = (String(name || "").match(/\.([\w+]+)$/) || [])[1] || "";
  if (TYPES[t]) { if (t === "code" && (l === "html" || ext === "html")) return "html"; return t; }
  const k = l || ext.toLowerCase();
  if (/^(html?|htm)$/.test(k)) return "html"; if (k === "svg") return "svg"; if (/^(md|markdown)$/.test(k)) return "markdown";
  if (/^(csv|tsv)$/.test(k)) return "csv"; if (k === "json") return "json"; if (/^(txt|text|plain)$/.test(k)) return "text";
  return k ? "code" : "text";
}
const fileName = a => {
  const base = String(a.title || "artifact").replace(/[^\w.\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "artifact";
  if (/\.[\w]{1,10}$/.test(base) && a.type === "code") return base;
  const ext = a.type === "code" ? (LANG_EXT[String(a.language || "").toLowerCase()] || "txt") : TYPES[a.type] ? TYPES[a.type].ext : "txt";
  return base.replace(/\.[\w]{1,10}$/, "") + "." + ext;
};

/* ---------- store client ---------- */
/* @src artifact.client.store: Artifact store client (list, cache, save, events) */
const Store = {
  list: [], loaded: false, error: null, loading: null, cache: new Map(), subs: new Set(),
  emit(ev) { this.subs.forEach(f => { try { f(ev) } catch (e) { console.warn("artifacts", e) } }); },
  async load() {
    if (this.loading) return this.loading;
    this.loading = api("/artifacts").then(d => { this.list = d.items || []; this.loaded = true; this.error = null; this.emit({ type: "list" }); return this.list; })
      .catch(e => { this.error = e.message; this.emit({ type: "error", error: e.message }); throw e; })
      .finally(() => { this.loading = null; });
    return this.loading;
  },
  meta(id) { return this.list.find(a => a.id === id) || null; },
  async get(id) {
    const m = this.meta(id), c = this.cache.get(id);
    if (c && (!m || c.updated === m.updated)) return c;
    const rec = await api("/artifacts/" + encodeURIComponent(id));
    this.cache.set(id, rec);
    if (this.cache.size > 8) this.cache.delete(this.cache.keys().next().value);   /* small LRU: content is loaded on demand */
    return rec;
  },
  put(meta) {
    const i = this.list.findIndex(a => a.id === meta.id);
    if (i >= 0) this.list.splice(i, 1);
    this.list.unshift(meta); this.cache.delete(meta.id);
    this.emit({ type: "saved", id: meta.id, meta });
  },
  async save(payload) { const meta = await api("/artifacts/save", payload); this.put(meta); return meta; },
  async restore(id, v) { const meta = await api("/artifacts/restore", { id, v }); this.put(meta); return meta; },
  async remove(id) { await api("/artifacts/delete", { id }); this.list = this.list.filter(a => a.id !== id); this.cache.delete(id); this.emit({ type: "deleted", id }); }
};
/* @end artifact.client.store */

/* ---------- making artifacts from the assistant ---------- */
/* @src artifact.create.provenance: Files Chandra touched this session, used to verify provenance */
const Ledger = new Map();          /* path -> [{via, at, run}]: only files Chandra really read, wrote or was handed */
function noteFile(path, via, run) {
  if (!path) return;
  const p = String(path), list = Ledger.get(p) || [];
  list.push({ via, at: Date.now(), run }); Ledger.set(p, list.slice(-5));
  if (Ledger.size > 200) Ledger.delete(Ledger.keys().next().value);
}
const norm = p => String(p || "").replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
function verifyPath(claimed) {
  if (!claimed) return null;
  const c = norm(claimed);
  for (const [p, uses] of Ledger) {
    const n = norm(p);
    if (n === c || n.endsWith("/" + c.replace(/^~\//, "")) ) return { path: p, verified: true, via: uses[uses.length - 1].via,
      note: uses.some(u => u.via === "attachment") ? "Attached by you" : uses.some(u => u.via === "read_file") ? "Read by Chandra before this artifact was made" : "Written by Chandra" };
  }
  return { path: String(claimed).slice(0, 400), verified: false, via: "claimed",
    note: "Named by the model. Chandra did not open this file in this session, so it is not shown." };
}
/* @end artifact.create.provenance */
/* @src artifact.create.tool: create_artifact tool handler (validation, revision, idempotency) */
function sourceOf(ctx, via) {
  const c = ctx || {};
  return { via, run: c.run || "", thread: c.thread || "", threadTitle: c.threadTitle || "", item: c.item == null ? null : c.item,
    origin: c.origin || "typed", model: c.model || "", prompt: String(c.prompt || "").slice(0, 240), at: Date.now() };
}
async function fromTool(args, ctx) {
  args = args || {};
  const content = typeof args.content === "string" ? args.content : args.content == null ? "" : JSON.stringify(args.content, null, 2);
  if (!content.trim()) throw new Error("create_artifact needs the full content");
  const type = inferType(args.type, args.language, args.title);
  if (type === "chart") R.chartSpec(content);              /* throws a precise error the model can fix */
  const files = [];
  const v = verifyPath(args.source_path); if (v) files.push(v);
  const payload = { op: (ctx && ctx.op) || "", title: args.title, type, language: args.language || "", content, note: String(args.note || "").slice(0, 300),
    by: "model", source: sourceOf(ctx, "create_artifact"), files };
  if (args.artifact_id) {
    if (!Store.loaded) await Store.load().catch(() => {});
    if (!Store.meta(String(args.artifact_id))) throw new Error("No artifact with id " + args.artifact_id + ". Leave artifact_id out to make a new one.");
    payload.id = String(args.artifact_id);
  }
  const meta = await Store.save(payload);
  ctx && ctx.arts && !ctx.arts.includes(meta.id) && ctx.arts.push(meta.id);
  return { ok: true, artifact_id: meta.id, version: meta.version, title: meta.title, type: meta.type, shown_to_user: true,
    note: meta.duplicate ? "already saved" : (meta.version > 1 ? "saved as version " + meta.version + "; earlier versions kept" : "created") };
}
/* @end artifact.create.tool */
/* @src artifact.create.files: write_file / save_file results kept as artifacts */
async function fromFile(kind, args, out, ctx) {
  const content = String((args && args.content) || "");
  if (!content.trim()) return null;
  const name = kind === "write_file" ? String((out && out.path) || args.path || "") : String((out && out.filename) || args.filename || "");
  const base = name.split(/[\\/]/).pop() || "file.txt";
  const type = inferType("", "", base), files = [];
  if (kind === "write_file" && out && out.path) { noteFile(out.path, "write_file", ctx && ctx.run); files.push({ path: out.path, verified: true, via: "write_file", note: "Written to this computer by Chandra (you approved it)" }); }
  try {
    const meta = await Store.save({ op: (ctx && ctx.op) || "", title: base, type, language: type === "code" ? (base.split(".").pop() || "") : "", content,
      by: "model", source: sourceOf(ctx, kind), files });
    ctx && ctx.arts && !ctx.arts.includes(meta.id) && ctx.arts.push(meta.id);
    return meta;
  } catch (e) { console.warn("artifact from " + kind, e); return null; }
}
/* @end artifact.create.files */
/* @src artifact.extract.reply: Long fenced code blocks in replies become artifacts */
/* A readable title for content that arrived without one: the page's <title>, the document's first heading,
   or the first function/class it defines, named like a file ("fizzbuzz.py"). */
function autoTitle(type, lang, body) {
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  if (type === "html") { const t = (body.match(/<title>\s*([^<]{2,80}?)\s*<\/title>/i) || [])[1] || (body.match(/<h1[^>]*>\s*([^<]{2,60}?)\s*<\/h1>/i) || [])[1]; return t ? t.trim() : "HTML app"; }
  if (type === "markdown") { const t = (body.match(/^#{1,3}\s+(.{2,80})$/m) || [])[1]; return t ? t.trim() : "Document"; }
  if (type === "code") {
    const ext = LANG_EXT[String(lang || "").toLowerCase()] || "", n = (body.match(/\b(?:def|function|class|fn|func|interface|struct)\s+([A-Za-z_$][\w$]*)/) || [])[1];
    if (n) return n + (ext ? "." + ext : "");
    return (lang ? cap(String(lang)) + " " : "") + "snippet";
  }
  return (TYPES[type] || TYPES.text).label;
}
async function fromReply(text, ctx) {
  const re = /```([\w+#.\-]*)[^\n]*\n([\s\S]*?)```/g, found = [];
  let m;
  while ((m = re.exec(text))) {
    const body = m[2].replace(/\n$/, "");
    if (body.split("\n").length >= 8 || body.length >= 400) found.push({ full: m[0], lang: m[1], body });
  }
  if (!found.length) return text;
  let out = text, n = 0;
  for (const f of found) {
    const type = inferType("", f.lang, ""), title = autoTitle(type, f.lang, f.body);
    try {
      const meta = await Store.save({ op: (ctx && ctx.run ? ctx.run + ":reply:" + (n++) : ""), title: title.slice(0, 80), type, language: f.lang || "", content: f.body,
        by: "model", source: sourceOf(ctx, "reply"), files: [] });
      ctx && ctx.arts && !ctx.arts.includes(meta.id) && ctx.arts.push(meta.id);
      out = out.replace(f.full, `(saved as artifact “${meta.title}”)`);
    } catch (e) { console.warn("artifact from reply", e); }
  }
  return out;
}
/* @end artifact.extract.reply */

/* ---------- shared UI bits ---------- */
function chip(meta, extra) {
  const b = document.createElement("button");
  b.type = "button"; b.className = "art-chip" + (extra ? " " + extra : "");
  b.dataset.artifactId = meta.id; b.setAttribute("data-cursor-target", ""); b.dataset.cursorLabel = "Open"; b.dataset.cursorLabelShift = "Shift-click: origin · Shift + right-click: source";
  b.setAttribute("aria-describedby", "artHint");
  b.innerHTML = icon(meta.type) + "<span></span><small></small>";
  b.querySelector("span").textContent = meta.title; b.querySelector("small").textContent = (TYPES[meta.type] || TYPES.text).label + (meta.version > 1 ? " · v" + meta.version : "");
  return b;
}
const hint = document.createElement("p");
hint.id = "artHint"; hint.className = "sr-only"; hint.textContent = "Enter opens the artifact. Shift and Enter, or Shift-click, shows where it came from.";
document.body.append(hint);

/* reply card chips: artifacts made by the latest request */
const jv = $("#jv");
const jva = document.createElement("div"); jva.id = "jva"; jva.className = "art-chips"; jva.setAttribute("aria-label", "Artifacts from this reply");
jv && jv.append(jva);
function showInCard(ids) {
  jva.replaceChildren();
  (ids || []).map(id => Store.meta(id)).filter(Boolean).forEach(m => jva.append(chip(m)));
  if (jva.children.length && jv && !jv.classList.contains("on")) jv.classList.add("on");
}

/* ---------- the Artifacts page ---------- */
/* @src artifact.view.page: Artifacts page (search, filters, cards, empty/loading/error states) */
const page = $("#artifacts");
const FILTERS = [["all", "All"], ["html", "Apps"], ["code", "Code"], ["doc", "Documents"], ["data", "Data"], ["chart", "Charts"], ["svg", "Graphics"]];
const match = (f, t) => f === "all" || f === t || (f === "doc" && (t === "markdown" || t === "text")) || (f === "data" && (t === "csv" || t === "json"));
let filter = "all", query = "";
if (page) {
  page.insertAdjacentHTML("beforeend", `<div class="art-tools"><input class="tx" id="artQ" type="search" placeholder="Search artifacts" aria-label="Search artifacts" autocomplete="off"><div class="fl" id="artF" role="group" aria-label="Filter by type">${FILTERS.map(([k, l], i) => `<button class="chip" data-f="${k}" aria-pressed="${i === 0}">${l}</button>`).join("")}</div></div><div id="artList" class="art-grid" aria-live="polite"></div><p class="mu sm art-foot">Click opens an artifact. <kbd>Shift</kbd>+click shows where it came from; <kbd>Shift</kbd>+right-click opens its source. Artifacts are kept in Chandra's data folder on this computer.</p>`);
  $("#artQ").addEventListener("input", debounce(() => { query = $("#artQ").value.trim().toLowerCase(); renderPage(); }, 120));
  $("#artF").addEventListener("click", e => { const c = e.target.closest("[data-f]"); if (!c) return; filter = c.dataset.f; page.querySelectorAll("#artF .chip").forEach(x => x.setAttribute("aria-pressed", x === c)); renderPage(); });
}
function card(m) {
  const b = chip(m, "art-card");
  b.innerHTML = `<span class="art-cover" aria-hidden="true"></span><span class="art-type">${icon(m.type)}<b></b></span><span class="art-title"></span><span class="art-meta"></span><span class="art-excerpt" aria-hidden="true"></span>`;
  /* Starlight: each card wears Grainient art seeded by its id, so it keeps the same colours forever */
  const G = window.ChandraGrainient;
  if (G && document.documentElement.dataset.skin !== "classic") try {
    const cv = b.querySelector(".art-cover"); cv.style.backgroundImage = `url("${G.url("card:" + m.id, 384, 96, { type: "linear" })}")`;
    cv.dataset.gseed = "card:" + m.id; cv.dataset.gopts = '{"type":"linear"}'; b.dataset.glive = "";   /* hover the card: its cover moves */
  } catch (_) {}
  b.querySelector(".art-type b").textContent = (TYPES[m.type] || TYPES.text).label + (m.type === "code" && m.language ? " · " + m.language : "");
  b.querySelector(".art-title").textContent = m.title;
  const src = m.source || {};
  b.querySelector(".art-meta").textContent = ["v" + m.version, ago(m.updated), src.threadTitle ? "from “" + src.threadTitle + "”" : src.origin === "voice" ? "from a voice request" : ""].filter(Boolean).join(" · ");
  b.querySelector(".art-excerpt").textContent = m.type === "chart" ? "" : String(m.excerpt || "").split("\n").filter(l => l.trim()).slice(0, 3).join("\n");
  b.setAttribute("aria-label", `${m.title}, ${(TYPES[m.type] || TYPES.text).label}, version ${m.version}`);
  return b;
}
function renderPage() {
  const list = $("#artList"); if (!list) return;
  if (!Store.loaded && Store.error) {
    list.replaceChildren(h("div", { class: "art-state" }, h("b", { text: "Couldn't load artifacts" }), h("p", { class: "mu sm", text: Store.error }), h("button", { class: "btn", type: "button", id: "artRetry", text: "Try again" })));
    $("#artRetry").onclick = () => { list.replaceChildren(h("div", { class: "art-state mu", text: "Loading…" })); Store.load().then(renderPage, renderPage); };
    return;
  }
  if (!Store.loaded) { list.replaceChildren(...[0, 1, 2].map(() => h("div", { class: "art-skel", "aria-hidden": "true" })), h("span", { class: "sr-only", text: "Loading artifacts" })); return; }
  const items = Store.list.filter(m => match(filter, m.type) && (!query || (m.title + " " + (m.language || "") + " " + ((m.source || {}).threadTitle || "")).toLowerCase().includes(query)));
  if (!Store.list.length) {
    list.replaceChildren(h("div", { class: "art-state" }, h("b", { text: "Nothing here yet" }),
      h("p", { class: "mu sm", text: "When Chandra makes something lasting (code, an HTML app, a document, a chart, a table or an SVG), it is kept here with every version." }),
      h("button", { class: "chip", type: "button", id: "artTry", text: "Try: make a focus timer as an HTML app" })));
    $("#artTry").onclick = () => { try { show("home"); } catch (_) {} const i = $("#inp"); i.value = "Make a minimal focus timer as an HTML app, in Chandra's black and silver style"; i.dispatchEvent(new Event("input")); i.focus(); };
    return;
  }
  if (!items.length) { list.replaceChildren(h("div", { class: "art-state mu", text: "No artifacts match." })); return; }
  list.replaceChildren(...items.map(card));
}
/* @end artifact.view.page */

/* ---------- the artifact panel ---------- */
/* @src artifact.view.panel: Artifact panel (preview/source tabs, versions, actions, states) */
const panel = document.createElement("aside");
panel.id = "artp"; panel.className = "artp"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "false"); panel.setAttribute("aria-labelledby", "artpT"); panel.hidden = true;
panel.innerHTML = `<header class="artp-h"><span class="artp-type" id="artpType"></span><h2 id="artpT" tabindex="-1"></h2><button class="ib" type="button" id="artpX" aria-label="Close artifact" data-tip="Close (Esc)"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header>
<div class="artp-sub"><span id="artpMeta"></span><label class="artp-ver"><span class="sr-only">Version</span><select id="artpV" class="tx"></select></label></div>
<div class="artp-tabs" role="tablist" aria-label="Artifact views"><button role="tab" type="button" data-tab="preview" id="artTabP">Preview</button><button role="tab" type="button" data-tab="source" id="artTabS">Source</button><button role="tab" type="button" data-tab="inspect" id="artTabI">Inspect source</button></div>
<div class="artp-actions" role="toolbar" aria-label="Artifact actions">
 <button class="chip" type="button" data-act="copy" data-cursor-target data-cursor-label="Copy">Copy</button>
 <button class="chip" type="button" data-act="download" data-cursor-target data-cursor-label="Save">Download</button>
 <button class="chip" type="button" data-act="full" data-cursor-target data-cursor-label="Open">Full view</button>
 <button class="chip" type="button" data-act="revise" data-cursor-target data-cursor-label="Revise">Revise</button>
 <button class="chip" type="button" data-act="regen" data-cursor-target data-cursor-label="Run">Regenerate</button>
 <button class="chip" type="button" data-act="chat" data-cursor-target data-cursor-label="Open">Open chat</button>
 <button class="chip dng" type="button" data-act="delete">Delete</button>
</div>
<div class="artp-banner" id="artpBanner" hidden></div>
<div class="artp-body" id="artpBody" role="tabpanel" tabindex="-1"></div>
<div class="artp-status mu sm" id="artpStatus" role="status" aria-live="polite"></div>`;
document.body.append(panel);
const P = { id: null, rec: null, v: null, tab: "preview", opener: null, cleanups: [], pinned: false, renderKey: "", hl: 0 };
const cleanup = () => { P.cleanups.splice(0).forEach(f => { try { f() } catch (_) {} }); };
const status = t => { $("#artpStatus").textContent = t || ""; };
const curVersion = () => P.rec ? (P.rec.versions.find(x => x.v === P.v) || P.rec.versions[P.rec.versions.length - 1]) : null;
const hasPreview = t => t !== "code";

async function open(id, opener, tab) {
  const first = P.id !== id;
  P.hl = 0;
  P.id = id; P.opener = opener || P.opener || document.activeElement; P.pinned = false;
  if (first) { P.rec = null; P.v = null; }
  panel.hidden = false; document.body.classList.add("art-open");
  requestAnimationFrame(() => panel.classList.add("on"));
  const m = Store.meta(id);
  $("#artpT").textContent = m ? m.title : "Loading…";
  $("#artpType").innerHTML = m ? icon(m.type) + `<span>${(TYPES[m.type] || TYPES.text).label}</span>` : "";
  if (first) { cleanup(); $("#artpBody").replaceChildren(h("div", { class: "art-state mu", text: "Loading…" })); }
  try {
    P.rec = await Store.get(id);
    if (P.id !== id) return;                                  /* another artifact was opened meanwhile */
  } catch (e) {
    if (P.id !== id) return;
    $("#artpBody").replaceChildren(h("div", { class: "art-state" }, h("b", { text: "Couldn't open this artifact" }), h("p", { class: "mu sm", text: e.message })));
    return;
  }
  const t = P.rec.type;
  P.tab = tab && tab !== "normal" ? tab : (first || tab === "normal") ? (TYPES[t] || TYPES.text).open : P.tab;
  if (!hasPreview(t) && P.tab === "preview") P.tab = "source";
  paint();
  if (first) $("#artpT").focus({ preventScroll: true });
}
function close() {
  if (panel.hidden) return;
  cleanup(); panel.classList.remove("on"); document.body.classList.remove("art-open");
  $("#artpBody").replaceChildren();                       /* stop a running app preview: no hidden timers, no focus left inside */
  setTimeout(() => { if (!panel.classList.contains("on")) panel.hidden = true; }, 220);
  const o = P.opener; P.id = null; P.rec = null; P.renderKey = "";
  if (o && o.isConnected) try { o.focus({ preventScroll: true }) } catch (_) {}
}
function paint() {
  const rec = P.rec; if (!rec) return;
  const m = Store.meta(rec.id) || {}, ver = curVersion(), latest = rec.versions[rec.versions.length - 1];
  $("#artpT").textContent = rec.title;
  $("#artpType").innerHTML = icon(rec.type) + `<span>${(TYPES[rec.type] || TYPES.text).label}${rec.type === "code" && rec.language ? " · " + rec.language.replace(/[<>&"]/g, "") : ""}</span>`;
  const lines = ver.content.split("\n").length;
  $("#artpMeta").textContent = [lines.toLocaleString() + " lines", size(new Blob([ver.content]).size), "updated " + ago(rec.updated)].join(" · ");
  const sel = $("#artpV");
  sel.replaceChildren(...rec.versions.slice().reverse().map(v => h("option", { value: v.v, selected: v.v === ver.v, text: `v${v.v}${v.v === latest.v ? " (latest)" : ""}${v.note ? " · " + v.note.slice(0, 40) : ""} · ${ago(v.created)}` })));
  sel.disabled = rec.versions.length < 2;
  const ban = $("#artpBanner");
  if (ver.v !== latest.v) {
    ban.hidden = false; ban.replaceChildren(h("span", { text: `Viewing version ${ver.v}. The latest is ${latest.v}.` }), h("button", { class: "chip", type: "button", "data-act": "restore", text: "Restore this version" }), h("button", { class: "chip", type: "button", "data-act": "latest", text: "Back to latest" }));
  } else if (rec.pruned) { ban.hidden = false; ban.replaceChildren(h("span", { text: `${rec.pruned} older version${rec.pruned > 1 ? "s were" : " was"} removed to stay within ${30} kept versions.` })); }
  else ban.hidden = true;
  panel.querySelectorAll("[data-tab]").forEach(b => { const on = b.dataset.tab === P.tab; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; b.hidden = b.dataset.tab === "preview" && !hasPreview(rec.type); });
  panel.querySelector("[data-act=full]").hidden = !["html", "svg", "chart", "markdown"].includes(rec.type);
  panel.querySelector("[data-act=chat]").hidden = !(rec.source && rec.source.thread);
  const key = rec.id + ":" + ver.v + ":" + ver.hash + ":" + P.tab + (P.tab === "source" ? ":" + P.hl : "");
  if (key === P.renderKey) return;                        /* unchanged: never re-parse or re-run a preview */
  P.renderKey = key; cleanup(); status("");
  const body = $("#artpBody");
  try {
    if (P.tab === "inspect") body.replaceChildren(inspectView(rec, ver, m));
    else if (P.tab === "source") body.replaceChildren(sourceView(rec, ver));
    else body.replaceChildren(preview(rec, ver));
  } catch (e) {
    body.replaceChildren(h("div", { class: "art-state" }, h("b", { text: "This artifact can't be previewed" }), h("p", { class: "mu sm", text: e.message }), h("p", { class: "mu sm", text: "Its source is intact: open the Source tab." })));
  }
}
/* the Source tab; with P.hl set (from Shift + right-click on a part of the preview) that line is lit and
   scrolled to, and a very long file is shown from a window around it */
function sourceView(rec, ver) {
  const lang = rec.type === "code" ? rec.language : rec.type === "chart" ? "json" : rec.type === "markdown" ? "md" : rec.type;
  const line = P.hl | 0;
  if (!line) return R.code(ver.content, lang);
  const all = ver.content.split("\n"), from = line > 3800 ? Math.max(1, line - 200) : 1;
  const box = R.code(from > 1 ? all.slice(from - 1).join("\n") : ver.content, lang, { start: from, highlight: [line, line] });
  requestAnimationFrame(() => { const r = box.querySelector(".aln.hl"); if (r) r.scrollIntoView({ block: "center" }); });
  status(`Line ${line} of the artifact's source: the part you picked in the preview.`);
  return box;
}
function showLine(line) {
  if (!P.rec) return;
  if (!full.hidden) full._close();
  P.hl = Math.max(0, line | 0); P.tab = "source"; P.renderKey = ""; paint();
}
function preview(rec, ver, full) {
  const c = ver.content;
  switch (rec.type) {
    case "html": {
      const f = R.htmlView(c, ev => {
        if (ev.type === "ready") status("Running in a sandbox: no network, no access to Chandra or your files.");
        if (ev.type === "error") status("The app reported an error" + (ev.line ? " on line " + ev.line : "") + ": " + ev.msg);
        if (ev.type === "blocked") status("Blocked by the sandbox: " + ev.msg);
        if (ev.type === "source") showLine(ev.line || 0);
      });
      P.cleanups.push(() => f._dispose && f._dispose());
      return h("div", { class: "ahtmlwrap" + (full ? " full" : "") }, f);
    }
    case "markdown": return R.markdown(c);
    case "svg": return R.svgView(c, fn => P.cleanups.push(fn));
    case "chart": return R.chart(c);
    case "csv": { const rows = R.parseCSV(c); return R.table(rows, c.split("\n").filter(l => l.trim()).length); }
    case "json": {
      let v; try { v = JSON.parse(c); } catch (e) { return h("div", null, h("p", { class: "aerr", text: "Not valid JSON: " + e.message }), R.code(c, "json")); }
      const rows = R.jsonRows(v); return rows ? R.table(rows, v.length + 1) : R.code(JSON.stringify(v, null, 2), "json");
    }
    case "text": return h("pre", { class: "atext", text: c.length > 400000 ? c.slice(0, 400000) + "\n…" : c });
    default: return R.code(c, rec.language);
  }
}
panel.addEventListener("click", async e => {
  if (e.target.closest("#artpX")) return close();
  const tab = e.target.closest("[data-tab]"); if (tab) { P.tab = tab.dataset.tab; P.hl = 0; paint(); return; }
  const a = e.target.closest("[data-act]"); if (!a || !P.rec) return;
  const rec = P.rec, ver = curVersion();
  try {
    switch (a.dataset.act) {
      case "copy": await copy(ver.content); status("Copied version " + ver.v + " to the clipboard."); break;
      case "download": {                                    /* preview first, exactly as it will be saved; Save inside */
        if (window.ChandraPreview) {
          const blob = new Blob([ver.content], { type: (TYPES[rec.type] || TYPES.text).mime });
          let r = ""; await ChandraPreview.open({ name: fileName(rec), blob, title: rec.title + (ver.v > 1 ? " · v" + ver.v : ""), save: async () => (r = await download(rec, ver)) });
          if (r) status(r);
        } else { const r = await download(rec, ver); if (r) status(r); }
        break;
      }
      case "full": fullView(rec, ver); break;
      case "revise": revise(rec); break;
      case "regen": regenerate(rec); break;
      case "chat": openChat(rec.source); break;
      case "restore": { const v = ver.v; await Store.restore(rec.id, v); P.v = null; await open(rec.id, null, P.tab); status("Restored version " + v + " as a new version. Nothing was lost."); break; }
      case "latest": P.v = null; P.renderKey = ""; paint(); break;
      case "delete": confirmDelete(rec); break;
    }
  } catch (err) { status(err.message || String(err)); }
});
panel.addEventListener("change", e => { if (e.target.id === "artpV") { P.v = +e.target.value; P.pinned = true; P.renderKey = ""; paint(); } });
panel.addEventListener("keydown", e => {
  const tab = e.target.closest && e.target.closest("[role=tab]");
  if (tab && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
    const tabs = [...panel.querySelectorAll("[role=tab]:not([hidden])")], i = tabs.indexOf(tab), n = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    n.focus(); n.click(); e.preventDefault();
  }
});
async function copy(text) {
  try { await navigator.clipboard.writeText(text); return; } catch (_) {}
  const t = h("textarea", { class: "sr-only" }); t.value = text; document.body.append(t); t.select();
  const ok = document.execCommand && document.execCommand("copy"); t.remove();
  if (!ok) throw new Error("The clipboard is not available here. Use Download instead.");
}
async function download(rec, ver) {
  const name = fileName(rec), blob = new Blob([ver.content], { type: (TYPES[rec.type] || TYPES.text).mime + ";charset=utf-8" });
  if (window.pywebview && pywebview.api && pywebview.api.save_file) {
    const b64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(",")[1]); fr.readAsDataURL(blob); });
    const p = await pywebview.api.save_file(name, b64);
    return p ? "Saved to " + p : "";
  }
  const u = URL.createObjectURL(blob), a = h("a", { href: u, download: name }); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 2000);
  return "Downloading " + name + ".";
}
function confirmDelete(rec) {
  const ban = $("#artpBanner"); ban.hidden = false;
  ban.replaceChildren(h("span", { text: `Delete “${rec.title}” and its ${rec.versions.length} version${rec.versions.length > 1 ? "s" : ""}? This can't be undone.` }),
    h("button", { class: "chip dng", type: "button", id: "artDelYes", text: "Delete" }), h("button", { class: "chip", type: "button", id: "artDelNo", text: "Keep it" }));
  $("#artDelNo").onclick = () => { P.renderKey = ""; paint(); };
  $("#artDelYes").onclick = async () => { try { await Store.remove(rec.id); close(); toastSafe("Artifact deleted", rec.title); } catch (e) { status(e.message); } };
  $("#artDelNo").focus();
}
/* @end artifact.view.panel */

/* ---------- full view (modal) ---------- */
/* @src artifact.view.full: Full-window view for apps, graphics, charts and documents */
const full = document.createElement("div");
full.id = "artfull"; full.className = "artfull"; full.setAttribute("role", "dialog"); full.setAttribute("aria-modal", "true"); full.setAttribute("aria-label", "Artifact full view"); full.hidden = true;
document.body.append(full);
function fullView(rec, ver) {
  const prevCleanups = P.cleanups.length;
  const bar = h("div", { class: "artfull-bar" }, h("b", { text: rec.title }), h("span", { class: "mu sm", text: rec.type === "html" ? "Sandboxed: no network, no access to Chandra or your files" : "" }), h("button", { class: "btn", type: "button", id: "artFullX", text: "Close" }));
  full.replaceChildren(bar, h("div", { class: "artfull-body" }, preview(rec, ver, true)));
  const extra = P.cleanups.splice(prevCleanups);
  full.hidden = false; full._close = () => { extra.forEach(f => { try { f() } catch (_) {} }); full.hidden = true; full.replaceChildren(); panel.querySelector("[data-act=full]").focus(); };
  $("#artFullX").onclick = full._close; $("#artFullX").focus();
}
/* @end artifact.view.full */

/* ---------- revise, regenerate, back to the conversation ---------- */
/* @src artifact.actions.revise: Revise / regenerate through the normal assistant pipeline */
let reviseTarget = null;
function revise(rec) {
  reviseTarget = { id: rec.id, title: rec.title };
  window.ChandraComposer && ChandraComposer.paint();
  try { show("home"); } catch (_) {}
  const i = $("#inp"); i.placeholder = `Describe the change to “${rec.title}”…`; i.focus();
  status("Tell Chandra what to change. The current version stays in the history.");
}
function takeRevise() {
  const r = reviseTarget; reviseTarget = null; $("#inp").placeholder = "Ask Chandra anything…"; window.ChandraComposer && ChandraComposer.paint();
  return r;
}
function regenerate(rec) {
  try { show("home"); } catch (_) {}
  const t = `Regenerate the artifact “${rec.title}” (artifact_id ${rec.id}) with a fresh take that keeps its purpose. Save it with create_artifact and artifact_id ${rec.id}; the current version stays in its history.`;
  if (typeof window.run === "function") window.run(t);
  status("Regenerating. The new version will appear here when it's ready.");
}
function openChat(src) {
  if (!src || !src.thread || !window.ChandraChat) { toastSafe("No saved chat", "This artifact wasn't made in a saved chat."); return; }
  const ok = ChandraChat.open(src.thread, src.item);
  if (ok === false) toastSafe("That chat was deleted", "The artifact stays here.");
  else close();
}
/* @end artifact.actions.revise */

/* ---------- source discovery (Shift+click) ---------- */
/* @src artifact.inspect: Source discovery view (origin, verified file locations, Chandra code) */
const CODE_KEYS = {
  common: ["artifact.client.store", "host.artifacts.store", "artifact.view.panel"],
  via: { create_artifact: ["assistant.tool.create_artifact", "artifact.create.tool"], reply: ["artifact.extract.reply"], write_file: ["artifact.create.files", "assistant.tool.provenance"], save_file: ["artifact.create.files"] },
  type: { html: ["artifact.sandbox.html"], code: ["artifact.render.code"], markdown: ["artifact.render.markdown"], svg: ["artifact.render.svg"], chart: ["artifact.render.chart"], csv: ["artifact.render.table"], json: ["artifact.render.table"], text: [] }
};
let mapCache = null, mapAt = 0;
async function sourceMap() { if (!mapCache || Date.now() - mapAt > 30000) { mapCache = await api("/source/map"); mapAt = Date.now(); } return mapCache; }
const locCache = new Map();
function locate(path, snippet, key) {
  if (locCache.has(key)) return locCache.get(key);
  const p = api("/source/locate", { path, snippet }); locCache.set(key, p); p.catch(() => locCache.delete(key)); return p;
}
function locRow(title, path, why, range) {
  const row = h("div", { class: "src-row" });
  const head = h("div", { class: "src-head" }, h("b", { text: title }), h("code", { class: "src-path", text: path + (range ? `:${range[0]}${range[1] !== range[0] ? "–" + range[1] : ""}` : "") }));
  row.append(head);
  if (why) row.append(h("p", { class: "mu sm", text: why }));
  const acts = h("div", { class: "src-acts" });
  const viewer = h("div", { class: "src-view", hidden: true });
  const vb = h("button", { class: "chip", type: "button", text: "View lines", "data-cursor-target": "", "data-cursor-label": "Inspect" });
  vb.onclick = async () => {
    if (!viewer.hidden) { viewer.hidden = true; vb.textContent = "View lines"; return; }
    vb.disabled = true;
    try {
      const a = range ? Math.max(1, range[0] - 3) : 1, b = range ? range[1] + 3 : 60;
      const d = await api("/source/read", { path, start: a, end: b });
      viewer.replaceChildren(R.code(d.lines.join("\n"), (path.match(/\.(\w+)$/) || [])[1], { start: d.start, highlight: range }));
      if (d.end < (range ? range[1] : d.end)) viewer.append(h("p", { class: "amore", text: "Showing the first 400 lines of this range." }));
      viewer.hidden = false; vb.textContent = "Hide lines";
    } catch (e) { viewer.hidden = false; viewer.replaceChildren(h("p", { class: "aerr", text: e.message })); }
    vb.disabled = false;
  };
  const ob = h("button", { class: "chip", type: "button", text: "Open in editor", "data-cursor-target": "", "data-cursor-label": "Open" });
  ob.onclick = async () => { ob.disabled = true; try { const d = await api("/source/open", { path, line: range ? range[0] : 1 }); status(`Opened in ${d.editor}${d.line ? " at line " + d.line : ""}.`); } catch (e) { status(e.message); } ob.disabled = false; };
  acts.append(vb, ob); row.append(acts, viewer);
  return row;
}
function inspectView(rec, ver, meta) {
  const root = h("div", { class: "src" });
  const src = Object.assign({}, rec.source || {}, ver.source || {});
  const VIA = { create_artifact: "Made by the model with the create_artifact tool", reply: "Taken from a code block in Chandra's reply", write_file: "Written to a file on this computer by Chandra", save_file: "Made by Chandra as a file for you to save" };
  /* 1 · origin */
  const o = h("section", { class: "src-sec" }, h("h3", { text: "Where it came from" }));
  const dl = h("dl", { class: "src-dl" });
  const add = (k, v) => { if (v) dl.append(h("dt", { text: k }), h("dd", null, v)); };
  add("Conversation", src.threadTitle ? `“${src.threadTitle}”${src.item != null ? ", message " + (src.item + 1) : ""}` : src.origin === "voice" ? "A voice request (not saved as a chat)" : "Not linked to a saved chat");
  add("Asked", src.prompt ? `“${src.prompt}”` : "");
  add("How", VIA[src.via] || "Unknown");
  add("Model", src.model || "");
  add("When", src.at ? new Date(src.at).toLocaleString() : "");
  add("Version", `v${ver.v}${ver.note ? " · " + ver.note : ""}${ver.by && ver.by !== "model" ? " · by " + ver.by : ""}`);
  o.append(dl);
  if (src.thread) { const b = h("button", { class: "chip", type: "button", text: "Open conversation", "data-cursor-target": "", "data-cursor-label": "Open" }); b.onclick = () => openChat(src); o.append(b); }
  root.append(o);
  /* 2 · files on this computer */
  const f = h("section", { class: "src-sec" }, h("h3", { text: "Files on this computer" }));
  const files = rec.files || [];
  const verified = files.filter(x => x.verified), claimed = files.filter(x => !x.verified);
  if (!verified.length) f.append(h("p", { class: "mu sm", text: "None. This artifact was generated in the conversation; it has no file of its own on this computer. Its content is kept in Chandra's artifact store:" }), h("code", { class: "src-path", text: meta.stored_at || "artifacts/" + rec.id + ".json" }));
  const snippet = ver.content.length <= 200000 ? ver.content : ver.content.split("\n").slice(0, 60).join("\n");
  verified.forEach(x => {
    const slot = h("div", { class: "src-row mu sm", text: "Checking " + x.path + "…" }); f.append(slot);
    locate(x.path, snippet, rec.id + ":" + ver.v + ":" + x.path).then(d => {
      const why = x.note + ". " + (d.match === "exact" ? `This version's content is at lines ${d.range[0]}–${d.range[1]} of the file.` : d.match === "partial" ? `The file has changed since; the closest matching part starts at line ${d.range[0]}.` : `The file no longer contains this version's content (it has ${d.lines} lines now).`);
      slot.replaceWith(locRow(x.path.split(/[\\/]/).pop(), d.path, why, d.range));
    }).catch(e => slot.replaceWith(h("div", { class: "src-row" }, h("b", { text: x.path }), h("p", { class: "aerr", text: e.message }))));
  });
  claimed.forEach(x => f.append(h("div", { class: "src-row" }, h("code", { class: "src-path", text: x.path }), h("p", { class: "mu sm", text: x.note }))));
  root.append(f);
  /* 3 · Chandra's own code */
  const c = h("section", { class: "src-sec" }, h("h3", { text: "Chandra code that handles it" }));
  const keys = [...(CODE_KEYS.via[src.via] || []), ...(CODE_KEYS.type[rec.type] || []), ...CODE_KEYS.common];
  const slot = h("p", { class: "mu sm", text: "Reading Chandra's source map…" }); c.append(slot);
  sourceMap().then(map => {
    if (!map.available) { slot.textContent = "Chandra's source files are not on this computer (a packaged build), so code locations can't be shown."; return; }
    slot.textContent = `Line ranges are read from the files in ${map.root} just now.`;
    let n = 0;
    keys.forEach(k => { const e = map.entries[k]; if (!e) return; n++; c.append(locRow(e.why || k, e.file, "", [e.start, e.end])); });
    if (!n) slot.textContent = "No marked code locations were found for this artifact type.";
  }).catch(e => { slot.textContent = "Couldn't read the source map: " + e.message; });
  root.append(c);
  /* 4 · limits, said plainly */
  const lim = [
    "Content written by the model has no source file: the model's output is the source, shown in the Source tab.",
    "Line ranges are only shown when Chandra can find this version's exact text in the file.",
    "Chandra never searches your computer to find a source. It only looks at files it read, wrote or was given in that conversation."
  ];
  if (claimed.length) lim.unshift("A path the model merely mentioned is listed but never opened.");
  root.append(h("section", { class: "src-sec" }, h("h3", { text: "Limits" }), h("ul", { class: "src-lim mu sm" }, lim.map(t => h("li", { text: t })))));
  return root;
}
const inspect = debounce((id, opener) => open(id, opener, "inspect"), 120);
/* @end artifact.inspect */

/* ---------- the two-click contract ---------- */
/* @src artifact.contract.click: Click opens, Shift+click inspects (never both) */
document.addEventListener("mousedown", e => { if (e.shiftKey && e.button === 0 && e.target.closest && e.target.closest("[data-artifact-id]")) e.preventDefault(); }, true); /* no text-selection jump */
document.addEventListener("click", e => {
  const el = e.target.closest && e.target.closest("[data-artifact-id]");
  if (!el || e.button !== 0 || el.closest("#artp")) return;
  e.preventDefault(); e.stopPropagation();
  const id = el.dataset.artifactId;
  if (e.shiftKey) inspect(id, el); else open(id, el, "normal");
}, true);
/* Shift + right-click: go to the source of the thing under the pointer. On an artifact (a chip, a card, a
   row) that is the artifact's own source; on a part of an open preview it is the line that part comes
   from (Markdown blocks and table rows carry data-line; HTML apps report their line from inside the
   sandbox, see artifact-render.js). Everything else in Chandra is handled by source-finder.js. */
document.addEventListener("contextmenu", e => {
  if (!e.shiftKey || !e.target.closest) return;
  const inPrev = e.target.closest("#artpBody,#artfull .artfull-body");
  const art = !inPrev && e.target.closest("[data-artifact-id]");
  if (!inPrev && !art) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (art) { open(art.dataset.artifactId, art, "source"); return; }
  const at = e.target.closest("[data-line],[data-cl]");
  showLine(at ? +(at.dataset.line || at.dataset.cl) : 0);
}, true);
/* @end artifact.contract.click */
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (!full.hidden) { full._close(); return; }
  if (!panel.hidden && !document.querySelector(".ov.on,#ob.on")) close();
}, true);

/* keep everything fresh when the store changes */
Store.subs.add(ev => {
  if (page && page.classList.contains("on")) renderPage();
  if (P.id && (ev.type === "saved" && ev.id === P.id)) { if (!P.pinned) P.v = null; P.rec = null; open(P.id, null, P.tab); }
  if (P.id && ev.type === "deleted" && ev.id === P.id) close();
  if (window.ChandraChat && ChandraChat.render) try { ChandraChat.render(); } catch (_) {}
});

window.ChandraArtifacts = {
  store: Store, open, close, inspect: (id, el) => open(id, el, "inspect"), renderPage: () => { renderPage(); if (!Store.loaded && !Store.loading) Store.load().then(renderPage, renderPage); },
  fromTool, fromFile, fromReply, noteFile, showInCard, chip, takeRevise, get reviseTarget() { return reviseTarget }, clearRevise: () => { reviseTarget = null; $("#inp").placeholder = "Ask Chandra anything…"; window.ChandraComposer && ChandraComposer.paint(); },
  list: () => Store.list.slice(), types: TYPES
};
Store.load().catch(() => {});
})();
