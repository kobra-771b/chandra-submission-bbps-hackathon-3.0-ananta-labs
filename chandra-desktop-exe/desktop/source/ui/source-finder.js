/* ============ Source finder: Shift + right-click on any part of Chandra ============
   Click uses a component; Shift + right-click shows where that component lives in Chandra's own source.
   The part under the target cursor (or the pointer) is named by its id, its distinctive class names and its
   words; the host searches Chandra's source files for them (POST /source/find) and returns real
   file:line:column hits, each read from disk at that moment. The panel says plainly that these are text
   matches. Nothing outside Chandra's source is searched. Artifacts and their previews are handled by
   artifacts.js first (their source is the artifact itself), so this only sees the rest of the UI. */
(function () {
"use strict";
/* @src source.finder: Shift + right-click source finder (component naming, results panel, code view) */
const HDR = { authorization: "Bearer __CHANDRA_PAIR__", "content-type": "application/json" };
const R = window.ChandraRender, h = R.h;
/* class names that say nothing about which component this is */
const GENERIC = new Set(["g", "on", "off", "sm", "mu", "dim", "row", "list", "chip", "btn", "ib", "p", "f", "hl", "active", "open", "busy", "lite",
  "rm", "pill", "card", "grp", "sp", "tx", "ok", "err", "hidden", "show", "flash", "fl", "fc", "a", "i", "v"]);
const TEXT_TAGS = /^(BUTTON|A|H1|H2|H3|LABEL|SUMMARY|B|STRONG|SPAN|P|LI)$/;

async function api(path, body) {
  let r;
  try { r = await fetch(location.origin + path, { method: "POST", headers: HDR, body: JSON.stringify(body) }); }
  catch (_) { throw new Error("Chandra's host is not reachable. Restart Chandra."); }
  let d = {}; try { d = await r.json(); } catch (_) {}
  if (!r.ok || d.error) throw new Error(d.error || "Chandra's host answered " + r.status);
  return d;
}

/* name the component: its own id and distinctive classes first, then its nearest named container */
function describe(el) {
  const ids = [], classes = [], chain = [];
  let n = el, depth = 0;
  while (n && n.nodeType === 1 && n !== document.body && depth < 6) {
    const own = [...n.classList].filter(c => !GENERIC.has(c) && /^[A-Za-z_][\w-]{0,63}$/.test(c));
    if (n.id && /^[A-Za-z_][\w-]{0,63}$/.test(n.id) && ids.length < 2) ids.push(n.id);
    own.forEach(c => { if (classes.length < (depth ? 4 : 6) && !classes.includes(c)) classes.push(c); });
    chain.push(n);
    if (ids.length) break;                                /* named (itself or its nearest container): enough */
    n = n.parentElement; depth++;
  }
  let text = "";
  if (TEXT_TAGS.test(el.tagName) || el.matches(".chip,.btn,[role=button],[role=tab],[role=menuitem]")) {
    text = (el.innerText || el.textContent || "").trim().replace(/\s+/g, " ");
    if (text.length > 60 || text.length < 4) text = "";
  }
  if (!text) { const ph = el.getAttribute("placeholder"); if (ph && ph.length >= 4) text = ph.slice(0, 60); }
  const tag = el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + [...el.classList].slice(0, 3).map(c => "." + c).join("");
  return { ids, classes, text, tag, label: window.ChandraCursor ? window.ChandraCursor.labelFor(el, false) : "" };
}

/* ---------- the panel ---------- */
const panel = document.createElement("aside");
panel.className = "artp srcp"; panel.id = "srcp"; panel.hidden = true;
panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Component source");
panel.innerHTML = `<header class="artp-h"><span class="artp-type"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14"/></svg><span>Source</span></span><h2 id="srcpT" tabindex="-1"></h2><button class="ib" type="button" id="srcpX" aria-label="Close source" data-tip="Close (Esc)"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header>
<div class="artp-sub"><span id="srcpMeta"></span></div>
<div class="srcp-body" id="srcpBody"></div><div class="artp-status mu sm" id="srcpStatus" role="status" aria-live="polite"></div>`;
document.body.append(panel);
const $ = s => panel.querySelector(s);
const status = t => { $("#srcpStatus").textContent = t || ""; };
let opener = null, ring = null;

function close() {
  if (panel.hidden) return;
  panel.classList.remove("on");
  setTimeout(() => { if (!panel.classList.contains("on")) { panel.hidden = true; $("#srcpBody").replaceChildren(); } }, 220);
  if (ring) { ring.remove(); ring = null; }
  if (opener && opener.isConnected) try { opener.focus({ preventScroll: true }); } catch (_) {}
}
/* a brief frame around the component that was picked, so it's clear what the results are for */
function mark(el) {
  if (ring) ring.remove();
  const r = el.getBoundingClientRect();
  ring = h("div", { class: "srcp-ring", "aria-hidden": "true" });
  Object.assign(ring.style, { left: r.left - 4 + "px", top: r.top - 4 + "px", width: r.width + 8 + "px", height: r.height + 8 + "px",
    borderRadius: (parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0) + 4 + "px" });
  document.body.append(ring);
  setTimeout(() => { if (ring) ring.classList.add("out"); }, 1400);
}

function excerptNode(hit) {
  const t = hit.excerpt, a = Math.max(0, Math.min(t.length, hit.mark[0])), b = Math.max(a, Math.min(t.length, hit.mark[1]));
  return h("code", { class: "srcp-ex" }, t.slice(0, a), h("mark", { text: t.slice(a, b) }), t.slice(b));
}
async function showLines(hit, slot, btn) {
  slot.hidden = false;
  slot.replaceChildren(h("p", { class: "mu sm", text: "Reading " + hit.file + "…" }));
  try {
    const d = await api("/source/read", { path: hit.file, start: Math.max(1, hit.line - 8), end: hit.line + 24 });
    const lines = d.lines.map(l => l.length > 400 ? l.slice(0, 400) + " …" : l);
    slot.replaceChildren(R.code(lines.join("\n"), hit.file.split(".").pop(), { start: d.start, highlight: [hit.line, hit.line] }));
    btn.textContent = "Hide lines";
  } catch (e) { slot.replaceChildren(h("p", { class: "aerr", text: e.message })); }
}
function hitRow(hit) {
  const slot = h("div", { class: "srcp-lines", hidden: true });
  const view = h("button", { class: "chip", type: "button", text: "View lines", "data-cursor-label": "View" });
  view.onclick = () => { if (!slot.hidden) { slot.hidden = true; view.textContent = "View lines"; return; } showLines(hit, slot, view); };
  const edit = h("button", { class: "chip", type: "button", text: "Open in editor", "data-cursor-label": "Open" });
  edit.onclick = async () => {
    edit.disabled = true;
    try { const d = await api("/source/open", { path: hit.file, line: hit.line }); status(`Opened ${hit.file} in ${d.editor}${d.line ? " at line " + d.line : ""}.`); }
    catch (e) { status(e.message); }
    edit.disabled = false;
  };
  return h("div", { class: "srcp-hit" },
    h("div", { class: "srcp-loc" }, h("b", { text: `${hit.file}:${hit.line}` }), h("span", { class: "mu sm", text: `col ${hit.col} · “${hit.term}”` }),
      hit.block ? h("span", { class: "srcp-blk", title: hit.why || "", text: hit.block }) : null),
    excerptNode(hit), h("div", { class: "srcp-acts" }, view, edit), slot);
}

async function find(el) {
  const d = describe(el);
  opener = document.activeElement;
  mark(el);
  panel.hidden = false; requestAnimationFrame(() => panel.classList.add("on"));
  $("#srcpT").textContent = d.label || d.tag;
  $("#srcpMeta").textContent = d.tag;
  status("");
  const body = $("#srcpBody");
  body.replaceChildren(h("div", { class: "art-state mu", text: "Searching Chandra's source…" }));
  $("#srcpT").focus({ preventScroll: true });
  if (!d.ids.length && !d.classes.length && !d.text) {
    body.replaceChildren(h("div", { class: "art-state" }, h("b", { text: "This part has no name to look for" }),
      h("p", { class: "mu sm", text: "It has no id, no distinctive class and no words of its own. Try the part around it." })));
    return;
  }
  let res;
  try { res = await api("/source/find", { ids: d.ids, classes: d.classes, text: d.text }); }
  catch (e) { body.replaceChildren(h("div", { class: "art-state" }, h("b", { text: "Couldn't search the source" }), h("p", { class: "mu sm", text: e.message }))); return; }
  const terms = [...res.terms.ids.map(x => "#" + x), ...res.terms.classes.map(x => "." + x), ...(res.terms.text ? ["“" + res.terms.text + "”"] : [])];
  const head = h("div", { class: "srcp-note mu sm" },
    h("p", { text: `Looked for ${terms.join(", ")} in Chandra's own source (${res.searched.length} files). These are text matches, read from the files just now; nothing outside Chandra's source was searched.` }));
  if (!res.hits.length) {
    body.replaceChildren(head, h("div", { class: "art-state" }, h("b", { text: "No matches" }),
      h("p", { class: "mu sm", text: "This part is built at run time from names that don't appear literally in the source." })));
    return;
  }
  const groups = {};
  res.hits.forEach(x => (groups[x.kind] = groups[x.kind] || []).push(x));
  const out = [head];
  ["markup", "style", "behavior", "text"].forEach(k => {
    if (!groups[k]) return;
    out.push(h("div", { class: "grp", text: `${res.kinds[k]} · ${groups[k].length}` }), ...groups[k].map(hitRow));
  });
  if (res.more) out.push(h("p", { class: "mu sm", text: `${res.more} more matches not shown.` }));
  body.replaceChildren(...out);
  /* the first match is usually the one you want: open its lines straight away */
  const first = body.querySelector(".srcp-hit .chip");
  if (first) first.click();
}

panel.addEventListener("click", e => { if (e.target.closest("#srcpX")) close(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !panel.hidden) { e.stopPropagation(); close(); } }, true);
/* registered after artifacts.js, which claims artifacts and previews first */
document.addEventListener("contextmenu", e => {
  if (!e.shiftKey || e.defaultPrevented || !e.target.closest) return;
  if (e.target.closest("#srcp")) return;                      /* inside the results: leave the native menu */
  const C = window.ChandraCursor;
  let el = C && C.target && C.target.contains && C.target.contains(e.target) ? C.target : null;
  if (!el) el = e.target.closest(C ? C.TARGETS : "button,a,input,textarea,.g,[id]") || e.target;
  if (!el || el === document.body || el === document.documentElement) return;
  e.preventDefault();
  find(el);
}, true);

window.ChandraSourceFinder = { find, close, describe };
/* @end source.finder */
})();
