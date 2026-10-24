/* ============ File preview: see a file before it is saved ============
   Everything Chandra hands you as a file (an artifact's Download, a file a tool made, an export, an
   attachment you're about to send) opens here first, shown as exactly the bytes that would be saved:
   images and SVG as images (SVG scripts never run), PDF in the built-in viewer, audio and video with
   controls, code with line numbers, Markdown rendered or as source, CSV/TSV and JSON as tables, HTML
   running in the same sandbox as HTML artifacts, and anything else as a file card with its size,
   SHA-256 and first bytes. Save then uses Chandra's native save dialog (or the browser download). */
(function () {
"use strict";
/* @src file.preview: Preview-before-save sheet (type detection, viewers, save) */
const R = window.ChandraRender, h = R.h;
const MAX_TEXT = 4 * 1024 * 1024;
const EXT = {
  image: /\.(png|jpe?g|gif|webp|bmp|avif|ico)$/i, svg: /\.svg$/i, pdf: /\.pdf$/i, audio: /\.(mp3|wav|ogg|oga|m4a|flac|aac|opus)$/i,
  video: /\.(mp4|webm|ogv|mov|m4v)$/i, md: /\.(md|markdown|mdown)$/i, csv: /\.(csv|tsv)$/i, json: /\.(json|geojson|ipynb)$/i, html: /\.html?$/i,
  code: /\.(txt|log|py|pyw|js|mjs|cjs|ts|tsx|jsx|css|scss|less|java|kt|c|h|cc|cpp|hpp|cs|go|rs|rb|php|swift|sh|bash|zsh|ps1|bat|cmd|sql|yaml|yml|toml|ini|cfg|conf|env\.example|xml|r|lua|dart|vue|svelte|gradle|makefile|dockerfile|tex|rst|ananta-notes)$/i
};
const MIME = { image: /^image\/(png|jpeg|gif|webp|bmp|avif|x-icon|vnd\.microsoft\.icon)$/, svg: /^image\/svg\+xml/, pdf: /^application\/pdf/, audio: /^audio\//,
  video: /^video\//, md: /^text\/markdown/, csv: /^text\/(csv|tab-separated-values)/, json: /^application\/(json|geo\+json)/, html: /^text\/html/, code: /^(text\/|application\/(javascript|x-python|xml|x-sh|sql|toml|yaml))/ };
const LABEL = { image: "Image", svg: "SVG image", pdf: "PDF", audio: "Audio", video: "Video", md: "Markdown", csv: "Table", json: "JSON", html: "Web page", code: "Text", bin: "File" };

const size = n => n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(1) + " KB" : (n / 1048576).toFixed(1) + " MB";
const langOf = name => ((String(name).match(/\.(\w+)$/) || [])[1] || "txt").toLowerCase();
async function sniff(blob, name) {
  for (const k of ["svg", "image", "pdf", "audio", "video", "md", "csv", "json", "html", "code"]) if (EXT[k].test(name) || (blob.type && MIME[k].test(blob.type))) return k;
  /* unknown name and type: text if the first 8 KB decode as UTF-8 without NULs */
  const head = new Uint8Array(await blob.slice(0, 8192).arrayBuffer());
  if (head.includes(0)) return "bin";
  try { new TextDecoder("utf-8", { fatal: true }).decode(head); return "code"; } catch (_) { return "bin"; }
}
async function sha256(blob) {
  if (!crypto.subtle || blob.size > 64 * 1048576) return "";
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()));
  return [...d].map(b => b.toString(16).padStart(2, "0")).join("");
}
function hexdump(u8) {
  const out = [];
  for (let i = 0; i < u8.length; i += 16) {
    const row = u8.subarray(i, i + 16);
    out.push(i.toString(16).padStart(6, "0") + "  " + [...row].map(b => b.toString(16).padStart(2, "0")).join(" ").padEnd(48) + "  " + [...row].map(b => b >= 32 && b < 127 ? String.fromCharCode(b) : ".").join(""));
  }
  return out.join("\n");
}
async function saveBlob(name, blob) {
  if (window.pywebview && pywebview.api && pywebview.api.save_file) {
    const b64 = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(",")[1] || ""); fr.onerror = rej; fr.readAsDataURL(blob); });
    const p = await pywebview.api.save_file(name, b64);
    return p ? "Saved to " + p : "";
  }
  const u = URL.createObjectURL(blob), a = h("a", { href: u, download: name });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
  return "Downloading " + name + ".";
}

/* ---------- the sheet ---------- */
const sheet = h("div", { class: "fp", id: "fp", role: "dialog", "aria-modal": "true", "aria-labelledby": "fpT", hidden: true });
sheet.innerHTML = `<div class="fp-card"><header class="fp-h"><span class="fp-icon" aria-hidden="true"></span><div class="fp-tt"><h2 id="fpT" tabindex="-1"></h2><p class="mu sm" id="fpMeta"></p></div>
<div class="fp-modes" id="fpModes" role="tablist" aria-label="View"></div><button class="ib" type="button" id="fpX" aria-label="Close preview" data-tip="Close (Esc)"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></header>
<div class="fp-body" id="fpBody"></div>
<footer class="fp-f"><span class="mu sm" id="fpNote"></span><span class="fp-acts"><button class="btn" type="button" id="fpCopy" hidden>Copy</button><button class="btn p" type="button" id="fpSave">Save</button></span></footer></div>`;
document.body.append(sheet);
const $ = s => sheet.querySelector(s);
let cur = null, urls = [], cleanups = [], opener = null;
const revoke = () => { cleanups.splice(0).forEach(f => { try { f(); } catch (_) {} }); urls.splice(0).forEach(u => { try { URL.revokeObjectURL(u); } catch (_) {} }); };
const objURL = (blob, type) => { const u = URL.createObjectURL(type && blob.type !== type ? new Blob([blob], { type }) : blob); urls.push(u); return u; };
const note = t => { $("#fpNote").textContent = t || ""; };

function close() {
  if (sheet.hidden) return;
  sheet.classList.remove("on");
  revoke(); $("#fpBody").replaceChildren();
  setTimeout(() => { if (!sheet.classList.contains("on")) sheet.hidden = true; }, 200);
  const r = cur && cur.resolve; cur = null;
  if (r) r(false);
  if (opener && opener.isConnected) try { opener.focus({ preventScroll: true }); } catch (_) {}
}
function modes(list, active, paint) {
  const box = $("#fpModes");
  box.replaceChildren(...(list.length > 1 ? list.map(([k, l]) => {
    const b = h("button", { type: "button", role: "tab", class: "chip", "aria-selected": k === active, text: l });
    b.onclick = () => { box.querySelectorAll("[role=tab]").forEach(x => x.setAttribute("aria-selected", x === b)); revoke(); paint(k); };
    return b;
  }) : []));
}

async function render(kind, blob, name) {
  const body = $("#fpBody");
  const put = (...n) => body.replaceChildren(...n);
  const text = async () => { if (blob.size > MAX_TEXT) throw new Error(`This file is ${size(blob.size)}; the preview shows text files up to ${size(MAX_TEXT)}. Save it to open it in an app.`); return blob.text(); };
  switch (kind) {
    case "image": {
      const img = h("img", { class: "fp-img", alt: name, src: objURL(blob) });
      img.onload = () => note(`${img.naturalWidth} × ${img.naturalHeight} px`);
      img.onerror = () => { put(h("div", { class: "art-state" }, h("b", { text: "This image can't be shown" }), h("p", { class: "mu sm", text: "The file may be damaged or in a format this window can't draw. Its bytes are unchanged." }))); };
      img.onclick = () => img.classList.toggle("actual");
      img.title = "Click to switch between fit and actual size";
      return put(h("div", { class: "fp-stage" }, img));
    }
    case "svg": {
      /* drawn as an image: an SVG's scripts never run here */
      const img = h("img", { class: "fp-img", alt: name, src: objURL(blob, "image/svg+xml") });
      modes([["view", "Image"], ["src", "Source"]], "view", async k => k === "src" ? put(R.code(await text(), "xml")) : render("svg", blob, name));
      return put(h("div", { class: "fp-stage" }, img));
    }
    case "pdf": return put(h("iframe", { class: "fp-frame", title: "PDF preview", src: objURL(blob, "application/pdf") }));
    case "audio": return put(h("div", { class: "fp-stage" }, h("audio", { controls: true, src: objURL(blob), preload: "metadata" })));
    case "video": return put(h("div", { class: "fp-stage" }, h("video", { controls: true, src: objURL(blob), preload: "metadata", class: "fp-video" })));
    case "md": {
      const t = await text();
      modes([["view", "Document"], ["src", "Source"]], "view", k => put(k === "src" ? R.code(t, "md") : h("div", { class: "fp-doc" }, R.markdown(t))));
      return put(h("div", { class: "fp-doc" }, R.markdown(t)));
    }
    case "csv": {
      const t = await text();
      modes([["view", "Table"], ["src", "Source"]], "view", k => put(k === "src" ? R.code(t, "csv") : R.table(R.parseCSV(t), t.split("\n").filter(l => l.trim()).length)));
      return put(R.table(R.parseCSV(t), t.split("\n").filter(l => l.trim()).length));
    }
    case "json": {
      const t = await text();
      let v = null; try { v = JSON.parse(t); } catch (e) { note("Not valid JSON: " + e.message); return put(R.code(t, "json")); }
      const rows = R.jsonRows(v);
      const pretty = JSON.stringify(v, null, 2);
      if (rows) modes([["view", "Table"], ["src", "Source"]], "view", k => put(k === "src" ? R.code(pretty, "json") : R.table(rows, v.length + 1)));
      return put(rows ? R.table(rows, v.length + 1) : R.code(pretty, "json"));
    }
    case "html": {
      const t = await text();
      const run = () => { const f = R.htmlView(t, ev => { if (ev.type === "error") note("The page reported an error" + (ev.line ? " on line " + ev.line : "") + ": " + ev.msg); });
        cleanups.push(() => f._dispose && f._dispose()); return h("div", { class: "fp-html" }, f); };
      modes([["view", "Page"], ["src", "Source"]], "view", k => put(k === "src" ? R.code(t, "html") : run()));
      note("Running in a sandbox: no network, no access to Chandra or your files.");
      return put(run());
    }
    case "code": return put(R.code(await text(), langOf(name)));
    default: {
      const head = new Uint8Array(await blob.slice(0, 256).arrayBuffer());
      const art = h("div", { class: "fp-art", "aria-hidden": "true" });
      if (window.ChandraGrainient) try { art.style.backgroundImage = `url("${ChandraGrainient.url("file:" + name, 320, 200)}")`; } catch (_) {}
      const hash = h("code", { class: "fp-hash", text: "computing…" });
      sha256(blob).then(x => { hash.textContent = x || "(too large to hash here)"; }).catch(() => { hash.textContent = "(unavailable)"; });
      return put(h("div", { class: "fp-bin" }, art, h("div", null,
        h("p", null, h("b", { text: "No preview for this kind of file" })),
        h("p", { class: "mu sm", text: `${blob.type || "Unknown type"} · ${size(blob.size)}. Saving it keeps these exact bytes.` }),
        h("p", { class: "mu sm" }, "SHA-256 ", hash),
        h("pre", { class: "fp-hex", text: hexdump(head) + (blob.size > 256 ? "\n…" : "") }))));
    }
  }
}

/* open({ name, blob, title?, save?: async () => string|void, saveLabel?, mode?: "save" | "view" }) -> Promise<boolean saved> */
async function open(o) {
  if (!o || !o.blob) return false;
  if (cur) close();
  opener = document.activeElement;
  const name = String(o.name || "file"), blob = o.blob;
  const kind = await sniff(blob, name);
  return new Promise(resolve => {
    cur = Object.assign({}, o, { name, kind, resolve });
    $("#fpT").textContent = o.title || name;
    $("#fpMeta").textContent = [LABEL[kind], size(blob.size), o.title ? name : "", o.path || ""].filter(Boolean).join(" · ");
    sheet.querySelector(".fp-icon").textContent = (langOf(name) || "").slice(0, 4).toUpperCase();
    $("#fpModes").replaceChildren(); note(""); revoke();
    const view = o.mode === "view";
    $("#fpSave").hidden = view; $("#fpSave").textContent = o.saveLabel || "Save";
    $("#fpCopy").hidden = !["code", "md", "csv", "json", "html", "svg"].includes(kind) || blob.size > MAX_TEXT;
    sheet.hidden = false; requestAnimationFrame(() => sheet.classList.add("on"));
    $("#fpBody").replaceChildren(h("div", { class: "art-state mu", text: "Opening…" }));
    render(kind, blob, name).catch(e => $("#fpBody").replaceChildren(h("div", { class: "art-state" }, h("b", { text: "Couldn't preview this file" }), h("p", { class: "mu sm", text: e.message }))));
    $(view ? "#fpX" : "#fpSave").focus({ preventScroll: true });
  });
}

sheet.addEventListener("click", async e => {
  if (e.target === sheet || e.target.closest("#fpX")) return close();
  if (!cur) return;
  if (e.target.closest("#fpCopy")) {
    try { await navigator.clipboard.writeText(await cur.blob.text()); note("Copied to the clipboard."); } catch (_) { note("The clipboard is not available here."); }
    return;
  }
  if (e.target.closest("#fpSave")) {
    const b = $("#fpSave"); b.disabled = true;
    try {
      const msg = cur.save ? await cur.save() : await saveBlob(cur.name, cur.blob);
      if (msg === "" || msg === false) { note("Not saved."); b.disabled = false; return; }  /* the save dialog was cancelled */
      const r = cur.resolve; cur.resolve = null;
      try { window.toast && window.toast("Saved", typeof msg === "string" ? msg : cur.name); } catch (_) {}
      r && r(true);
      close();
    } catch (err) { note(err.message || String(err)); }
    b.disabled = false;
  }
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && !sheet.hidden) { e.stopImmediatePropagation(); e.preventDefault(); close(); } }, true);

window.ChandraPreview = { open, close, save: saveBlob, sniff };
/* @end file.preview */
})();
