/* ============ Composer: attachments, the revise pill, and Send that becomes Stop ============
   - Attach: the + button (and drag-and-drop onto the composer) adds up to 4 files to the next message.
     In Chandra's own window the native picker is used, so each file keeps its real path; an artifact
     made from it can then point back to it. In a plain browser the path is unknown and says so.
     Text files up to 512 KB go in as text; images go to vision-capable brains (Claude) as images.
   - Revise: "Revise" on an artifact pins it here, so the next message updates that artifact.
   - While Chandra thinks or works, Send becomes Stop (the same stop as the card's Stop chip);
     while Chandra speaks, it stops the speech. Enter-to-send and Shift+Enter for a new line are unchanged. */
(function () {
"use strict";
/* @src composer.context: Composer attachments, revise pill and Send/Stop */
const $ = s => document.querySelector(s);
const comp = $("#comp"), inp = $("#inp"), go = $("#go"), att = $("#att");
if (!comp || !inp) return;
const MAX_FILES = 4, MAX_TEXT = 512 * 1024, MAX_IMG = 8 * 1024 * 1024;
const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|jsonl|xml|yaml|yml|toml|ini|cfg|conf|log|html?|css|scss|less|js|mjs|cjs|jsx|ts|tsx|py|rb|go|rs|java|kt|swift|c|h|cpp|hpp|cs|php|sh|bash|zsh|ps1|bat|sql|r|lua|dart|scala|vue|svelte|svg|tex|rst|env\.example)$/i;
const IMG = /^image\/(png|jpe?g|webp|gif)$/i;
const items = [];
const toast0 = (a, b) => { try { window.toast(a, b) } catch (_) {} };
const fmt = n => n < 1024 ? n + " B" : (n / 1024).toFixed(n < 10240 ? 1 : 0) + " KB";
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const row = document.createElement("div");
row.className = "cctx"; row.id = "cctx"; row.setAttribute("aria-label", "Attached to the next message");
inp.before(row);

function paint() {
  const rv = window.ChandraArtifacts && ChandraArtifacts.reviseTarget;
  row.innerHTML = (rv ? `<span class="cpill rv"><span>Revising “${esc(rv.title)}”</span><button type="button" class="cx" data-clear-revise aria-label="Stop revising ${esc(rv.title)}">×</button></span>` : "") +
    items.map((f, i) => `<span class="cpill${f.error ? " bad" : ""}" data-i="${i}" role="button" tabindex="0" data-cursor-label="Preview" title="${esc(f.path || f.name)}"><span>${esc(f.name)}</span><small>${f.error ? esc(f.error) : f.kind === "image" ? "image" : fmt(f.size)}</small><button type="button" class="cx" data-rm="${i}" aria-label="Remove ${esc(f.name)}">×</button></span>`).join("");
  row.classList.toggle("on", !!(rv || items.length));
}
row.addEventListener("click", e => {
  const r = e.target.closest("[data-rm]"); if (r) { items.splice(+r.dataset.rm, 1); paint(); inp.focus(); return; }
  const pill = e.target.closest(".cpill[data-i]");                          /* look at an attachment before sending it */
  if (pill && window.ChandraPreview) { const f = items[+pill.dataset.i]; if (f && f.blob) ChandraPreview.open({ name: f.name, blob: f.blob, path: f.path, mode: "view" }); return; }
  if (e.target.closest("[data-clear-revise]")) { ChandraArtifacts.clearRevise(); inp.focus(); }
});

row.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.matches(".cpill[data-i]")) { e.preventDefault(); e.target.click(); } });

async function readImage(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("not a readable image")); i.src = url; });
    const k = Math.min(1, 1568 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.82);
  } finally { URL.revokeObjectURL(url); }
}
async function add(blob, name, path) {
  if (items.filter(f => !f.error).length >= MAX_FILES) { toast0("Up to " + MAX_FILES + " files per message"); return; }
  const f = { name: String(name || "file").slice(0, 120), path: path || "", size: blob.size, kind: "text", blob };
  try {
    if (IMG.test(blob.type) || /\.(png|jpe?g|webp|gif)$/i.test(f.name)) {
      if (blob.size > MAX_IMG) throw new Error("larger than 8 MB");
      f.kind = "image"; f.dataUrl = await readImage(blob);
    } else if (/^text\//.test(blob.type) || /json|xml|javascript|csv/.test(blob.type) || TEXT_EXT.test(f.name)) {
      if (blob.size > MAX_TEXT) throw new Error("larger than 512 KB");
      f.text = await blob.text();
    } else throw new Error("only text and images");
    if (f.path && window.ChandraArtifacts) ChandraArtifacts.noteFile(f.path, "attachment");
  } catch (e) { f.error = e.message || "unreadable"; }
  items.push(f); paint();
}
function b64ToBlob(b64, name) {
  const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const ext = (String(name).match(/\.(\w+)$/) || [])[1] || "";
  const type = /^(png|gif|webp)$/i.test(ext) ? "image/" + ext.toLowerCase() : /^jpe?g$/i.test(ext) ? "image/jpeg" : "";
  return new Blob([u], { type });
}
const picker = document.createElement("input");
picker.type = "file"; picker.multiple = true; picker.hidden = true; picker.setAttribute("aria-hidden", "true");
document.body.append(picker);
picker.onchange = async () => { for (const f of [...picker.files]) await add(f, f.name, ""); picker.value = ""; inp.focus(); };
async function pick() {
  if (window.pywebview && pywebview.api && pywebview.api.pick_files) {
    try {
      const r = await pywebview.api.pick_files();
      if (Array.isArray(r)) { for (const f of r) { if (f.error) { items.push({ name: f.name, path: f.path, error: f.error, size: 0 }); paint(); } else await add(b64ToBlob(f.b64, f.name), f.name, f.path); } inp.focus(); return; }
      if (r === null) return;                                     /* cancelled */
    } catch (_) {}
  }
  picker.click();
}
if (att) {
  att.onclick = null;
  att.addEventListener("click", e => { e.preventDefault(); e.stopImmediatePropagation(); pick(); }, true);
  att.setAttribute("aria-label", "Attach files"); att.dataset.tip = "Attach files";
}
comp.addEventListener("dragover", e => { if ([...(e.dataTransfer && e.dataTransfer.types || [])].includes("Files")) { e.preventDefault(); comp.classList.add("drop"); } });
comp.addEventListener("dragleave", e => { if (!comp.contains(e.relatedTarget)) comp.classList.remove("drop"); });
comp.addEventListener("drop", async e => { comp.classList.remove("drop"); const fs = [...(e.dataTransfer && e.dataTransfer.files || [])]; if (!fs.length) return; e.preventDefault(); for (const f of fs) await add(f, f.name, ""); inp.focus(); });

/* Send <-> Stop */
const ICON = { send: go ? go.innerHTML : "", stop: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>' };
let mode = "send";
function setMode(m) {
  if (!go || m === mode) return; mode = m;
  go.innerHTML = m === "send" ? ICON.send : ICON.stop;
  go.classList.toggle("stopping", m !== "send");
  const l = m === "stop" ? "Stop" : m === "hush" ? "Stop speaking" : "Send";
  go.setAttribute("aria-label", l); go.dataset.tip = l;
}
if (go) go.addEventListener("click", e => {
  if (mode === "send") return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (mode === "stop" && window.ChandraUnified && ChandraUnified.stop) ChandraUnified.stop();
  if (mode === "hush" && window.chandraVoice && chandraVoice.hush) chandraVoice.hush();
}, true);
window.ChandraState && ChandraState.subscribe(s => {
  const busy = window.ChandraUnified && ChandraUnified.busy;
  setMode(s.phase === "speaking" ? "hush" : busy && (s.phase === "thinking" || s.phase === "working" || s.phase === "waiting") ? "stop" : "send");
});

window.ChandraComposer = {
  paint,
  get count() { return items.filter(f => !f.error).length; },
  get pending() { return items.some(f => !f.error) || !!(window.ChandraArtifacts && ChandraArtifacts.reviseTarget); },
  take() { const out = items.filter(f => !f.error); items.length = 0; paint(); return out; }
};
paint();
/* @end composer.context */
})();
