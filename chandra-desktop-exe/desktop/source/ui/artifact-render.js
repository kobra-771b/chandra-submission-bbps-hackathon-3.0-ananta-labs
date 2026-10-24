/* ============ Artifact renderers: one safe renderer per type ============
   Rules every renderer here follows:
   - Artifact content is untrusted. It is only ever placed in the page with textContent / DOM nodes,
     never with innerHTML, so Markdown, code, tables and charts cannot inject markup or script.
   - HTML artifacts run only inside a sandboxed iframe (scripts allowed, same-origin NOT allowed), so
     they cannot read Chandra's storage, pairing code, cookies or call the host; a CSP inside the frame
     blocks network requests, forms, frames and navigation. Scripts, styles and fonts may load only
     from three public CDNs over https, so common libraries work while data can't be sent anywhere.
   - SVG renders through <img>, where SVG scripts and external loads never run.
   - Links in documents are http(s) only and open outside Chandra with rel=noopener.
   - Big content is capped on screen (lines/rows) with a note; Copy and Download always give all of it. */
(function () {
"use strict";
const h = (tag, attrs, ...kids) => {
  const e = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v; else if (k === "text") e.textContent = v; else e.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return e;
};
const MAX_LINES = 4000, MAX_ROWS = 1500, MAX_COLS = 60;

/* ---------- code: line numbers + a small tokenizer ---------- */
/* @src artifact.render.code: Code viewer with line numbers and safe highlighting */
const KW = {
  js: "break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new of return static super switch this throw try typeof var void while with yield async await null undefined true false",
  py: "and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield self",
  css: "", sh: "if then else elif fi for in do done while case esac function return export local echo",
  c: "auto break case char const continue default do double else enum extern float for goto if int long register return short signed sizeof static struct switch typedef union unsigned void volatile while class public private protected template typename namespace using new delete true false nullptr bool fn let mut pub impl use mod match struct trait enum go func package var type interface map chan defer select range",
  sql: "select from where and or not insert into values update set delete create table drop alter join left right inner outer on group by order having limit as distinct union null is in like between case when then else end primary key"
};
const FAMILY = l => { l = String(l || "").toLowerCase();
  if (/^(js|jsx|ts|tsx|javascript|typescript|mjs|cjs|json)$/.test(l)) return "js";
  if (/^(py|python)$/.test(l)) return "py"; if (/^(css|scss|less)$/.test(l)) return "css";
  if (/^(sh|bash|zsh|shell|ps1|powershell|bat|cmd)$/.test(l)) return "sh"; if (/^sql$/.test(l)) return "sql";
  if (/^(html|xml|svg|vue|svelte)$/.test(l)) return "html";
  if (/^(c|cpp|c\+\+|h|hpp|cs|csharp|java|kotlin|swift|rust|rs|go|dart|scala|php)$/.test(l)) return "c";
  return "plain"; };
function tokenize(line, fam, state) {
  /* returns [[cls, text], ...]; state carries block comments across lines */
  const out = []; let i = 0;
  const push = (c, t) => { if (t) out.push([c, t]); };
  const kws = KW[fam] ? new Set(KW[fam].split(" ")) : null;
  const ci = fam === "sql";
  while (i < line.length) {
    if (state.block) { const end = line.indexOf(state.block, i); if (end < 0) { push("c", line.slice(i)); return out; } push("c", line.slice(i, end + state.block.length)); i = end + state.block.length; state.block = null; continue; }
    const r = line.slice(i), ch = line[i];
    let m;
    if (fam === "html") {
      if ((m = /^<!--/.exec(r))) { state.block = "-->"; continue; }
      if ((m = /^<\/?[\w:-]+/.exec(r))) { push("k", m[0]); i += m[0].length; continue; }
      if ((m = /^"[^"]*"|^'[^']*'/.exec(r))) { push("s", m[0]); i += m[0].length; continue; }
      if ((m = /^[\w:-]+(?==)/.exec(r))) { push("a", m[0]); i += m[0].length; continue; }
      push(null, ch); i++; continue;
    }
    if ((fam === "js" || fam === "c" || fam === "css") && r.startsWith("/*")) { state.block = "*/"; continue; }
    if (((fam === "js" || fam === "c") && r.startsWith("//")) || ((fam === "py" || fam === "sh") && ch === "#") || (fam === "sql" && r.startsWith("--"))) { push("c", r); break; }
    if (fam === "py" && (r.startsWith('"""') || r.startsWith("'''"))) { const q = r.slice(0, 3), end = line.indexOf(q, i + 3); if (end < 0) { push("s", r); state.block = q; break; } push("s", line.slice(i, end + 3)); i = end + 3; continue; }
    if ((m = /^(["'`])(?:\\.|(?!\1).)*\1?/.exec(r)) && fam !== "plain") { push("s", m[0]); i += m[0].length; continue; }
    if ((m = /^\b\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?\b|^\b0x[\da-f]+\b/i.exec(r)) && fam !== "plain") { push("n", m[0]); i += m[0].length; continue; }
    if ((m = /^[A-Za-z_$][\w$]*/.exec(r))) { const w = m[0]; push(kws && kws.has(ci ? w.toLowerCase() : w) ? "k" : (fam !== "plain" && line[i + w.length] === "(" ? "f" : null), w); i += w.length; continue; }
    if (fam === "css" && (m = /^[#.][\w-]+/.exec(r))) { push("a", m[0]); i += m[0].length; continue; }
    push(null, ch); i++;
  }
  return out;
}
function code(text, lang, opts) {
  opts = opts || {};
  const fam = FAMILY(lang), lines = String(text).replace(/\r\n/g, "\n").split("\n");
  const shown = Math.min(lines.length, opts.max || MAX_LINES), state = { block: null };
  const box = h("div", { class: "acode", role: "region", "aria-label": (lang ? lang + " " : "") + "source, " + lines.length + " lines", tabindex: "0" });
  const start = opts.start || 1, hl = opts.highlight;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < shown; i++) {
    const n = start + i, row = h("div", { class: "aln" + (hl && n >= hl[0] && n <= hl[1] ? " hl" : "") });
    row.append(h("span", { class: "ano", "aria-hidden": "true", text: String(n) }));
    const c = h("span", { class: "atx" });
    for (const [cls, t] of tokenize(lines[i], fam, state)) c.append(cls ? h("span", { class: "t" + cls, text: t }) : document.createTextNode(t));
    if (!lines[i]) c.append("​");
    row.append(c); frag.append(row);
  }
  box.append(frag);
  if (shown < lines.length) box.append(h("div", { class: "amore", text: `Showing ${shown.toLocaleString()} of ${lines.length.toLocaleString()} lines. Copy or Download gives the whole file.` }));
  return box;
}
/* @end artifact.render.code */

/* ---------- markdown, safe subset ---------- */
/* @src artifact.render.markdown: Safe Markdown document renderer (DOM only, no innerHTML) */
/* LaTeX through KaTeX, as MathML: the browser draws it with its own math font, so no stylesheet or font files ship.
   trust is off (no \href, \url, \includegraphics); a formula KaTeX cannot read stays visible as its source. */
function math(tex, display) {
  const el = h(display ? "div" : "span", { class: display ? "amath block" : "amath", "data-tex": tex });
  try {
    if (!window.katex) throw 0;
    window.katex.render(tex, el, { displayMode: !!display, output: "mathml", throwOnError: true, trust: false, strict: "ignore", maxSize: 20, maxExpand: 500 });
  } catch (_) { el.classList.add("bad"); el.textContent = display ? "$$" + tex + "$$" : "$" + tex + "$"; }
  return el;
}
function inline(src) {
  const frag = document.createDocumentFragment();
  /* groups: 1-2 code, 3 \(..\), 4 $$..$$, 5 $..$ (not money: no space inside the dollars, no digit after the closing one), then the rest */
  const re = /(`+)([^`]+?)\1|\\\(([\s\S]+?)\\\)|\$\$([^$]+?)\$\$|\$(?![\s$])((?:[^$\n\\]|\\.)+?)(?<![\s\\])\$(?!\d)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\s][^*]*)\*|_([^_\s][^_]*)_|~~([^~]+)~~|\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g;
  let last = 0, m;
  while ((m = re.exec(src))) {
    if (m.index > last) frag.append(src.slice(last, m.index));
    if (m[2] != null) frag.append(h("code", { text: m[2] }));
    else if (m[3] != null) frag.append(math(m[3].trim(), false));
    else if (m[4] != null) frag.append(math(m[4].trim(), true));
    else if (m[5] != null) frag.append(math(m[5], false));
    else if (m[6] != null || m[7] != null) frag.append(h("strong", null, inline(m[6] || m[7])));
    else if (m[8] != null || m[9] != null) frag.append(h("em", null, inline(m[8] || m[9])));
    else if (m[10] != null) frag.append(h("del", null, inline(m[10])));
    else if (m[11] != null) frag.append(link(m[12], inline(m[11])));
    else if (m[13] != null) frag.append(link(m[13], m[13]));
    last = re.lastIndex;
  }
  if (last < src.length) frag.append(src.slice(last));
  return frag;
}
function link(href, kids) {
  let ok = false; try { ok = /^https?:$/.test(new URL(href).protocol); } catch (_) {}
  return ok ? h("a", { href, target: "_blank", rel: "noopener noreferrer nofollow", "data-external": "1", title: href }, kids) : h("span", null, kids);
}
function markdown(src, base) {
  /* every block carries data-line: the source line it starts on, for Shift + right-click */
  const root = h("article", { class: "adoc" });
  base = base || 0;
  let at = 1;
  const put = el => { if (el && el.nodeType === 1 && !el.dataset.line) el.dataset.line = at; root.append(el); };
  const lines = String(src).replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  const isBlockStart = l => /^(#{1,6}\s|```|~~~|\$\$|\\\[|>\s?|\s*([-*+]|\d+[.)])\s+|\s*(-{3,}|\*{3,}|_{3,})\s*$|\|)/.test(l);
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    at = base + i + 1;
    let m;
    if ((m = /^\s*(\$\$|\\\[)(.*)$/.exec(l))) {
      const close = m[1] === "$$" ? "$$" : "\\]", body = [];
      let rest = m[2], end = rest.indexOf(close);
      if (end >= 0 && !rest.slice(end + close.length).trim()) { body.push(rest.slice(0, end)); i++; }
      else if (end < 0) {
        if (rest.trim()) body.push(rest); i++;
        while (i < lines.length && !lines[i].includes(close)) body.push(lines[i++]);
        if (i < lines.length) { body.push(lines[i].slice(0, lines[i].indexOf(close))); i++; }
      } else m = null;
      if (m) { put(math(body.join("\n").trim(), true)); continue; }
    }
    if ((m = /^(```|~~~)\s*([\w+#.-]*)/.exec(l))) {
      const fence = m[1], body = []; i++;
      while (i < lines.length && !lines[i].startsWith(fence)) body.push(lines[i++]);
      i++; put(code(body.join("\n"), m[2], { max: 800 })); continue;
    }
    if ((m = /^(#{1,6})\s+(.*)$/.exec(l))) { put(h("h" + Math.min(6, m[1].length + 1), null, inline(m[2].replace(/\s+#+\s*$/, "")))); i++; continue; }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l)) { put(h("hr")); i++; continue; }
    if (/^>\s?/.test(l)) { const q = []; while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, "")); put(h("blockquote", null, [...markdown(q.join("\n"), at - 1).childNodes])); continue; }
    if (/^\|/.test(l) && i + 1 < lines.length && /^\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const cells = r => r.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
      const head = cells(l); i += 2; const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(cells(lines[i++]));
      const t = h("table", { class: "atable" }, h("thead", null, h("tr", null, head.map(c => h("th", null, inline(c))))), h("tbody", null, rows.map(r => h("tr", null, r.map(c => h("td", null, inline(c)))))));
      put(h("div", { class: "atwrap" }, t)); continue;
    }
    if ((m = /^\s*([-*+]|\d+[.)])\s+/.exec(l))) {
      const ordered = /\d/.test(m[1]), list = h(ordered ? "ol" : "ul");
      while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) {
        let t = lines[i++].replace(/^\s*([-*+]|\d+[.)])\s+/, "");
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) t += " " + lines[i++].trim();
        const task = /^\[( |x|X)\]\s+/.exec(t);
        const li = h("li", task ? { class: "task" } : null);
        if (task) { li.append(h("input", { type: "checkbox", disabled: true, checked: task[1] !== " ", "aria-label": task[1] !== " " ? "done" : "not done" })); t = t.slice(task[0].length); }
        li.append(inline(t)); list.append(li);
      }
      put(list); continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) para.push(lines[i++].trim());
    if (!para.length) { para.push(l.trim()); i++; }
    put(h("p", null, inline(para.join(" "))));
  }
  return root;
}
/* @end artifact.render.markdown */

/* ---------- tables: CSV / TSV / JSON arrays ---------- */
/* @src artifact.render.table: CSV/TSV parser and table view */
function parseCSV(text) {
  const t = String(text).replace(/\r\n/g, "\n");
  const first = t.split("\n", 1)[0];
  const sep = (first.match(/\t/g) || []).length > (first.match(/,/g) || []).length ? "\t" : (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ";" : ",";
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"' && cell === "") { q = true; continue; }
    if (c === sep) { row.push(cell); cell = ""; continue; }
    if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; if (rows.length > MAX_ROWS + 1) break; continue; }
    cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.length > 1 || r[0] !== "");
}
function table(rows, total) {
  if (!rows.length) return h("p", { class: "aempty", text: "This table is empty." });
  const head = rows[0].slice(0, MAX_COLS), body = rows.slice(1, MAX_ROWS + 1);
  const num = head.map((_, c) => body.length > 0 && body.every(r => r[c] == null || r[c] === "" || !isNaN(+String(r[c]).replace(/[,%$€£₹]/g, ""))));
  const t = h("table", { class: "atable" },
    h("thead", null, h("tr", null, head.map((c, k) => h("th", { scope: "col", class: num[k] ? "num" : null, text: String(c) })))),
    h("tbody", null, body.map(r => h("tr", null, head.map((_, k) => h("td", { class: num[k] ? "num" : null, text: r[k] == null ? "" : String(r[k]) }))))));
  const wrap = h("div", { class: "atwrap", tabindex: "0", role: "region", "aria-label": "Table, " + (rows.length - 1) + " rows" }, t);
  const n = (total || rows.length) - 1;
  if (body.length < n || rows[0].length > MAX_COLS) wrap.append(h("div", { class: "amore", text: `Showing ${body.length.toLocaleString()} of ${n.toLocaleString()} rows${rows[0].length > MAX_COLS ? " and the first " + MAX_COLS + " columns" : ""}.` }));
  return wrap;
}
function jsonRows(v) {
  if (!Array.isArray(v) || !v.length || !v.every(x => x && typeof x === "object" && !Array.isArray(x))) return null;
  const cols = [...new Set(v.slice(0, 200).flatMap(o => Object.keys(o)))].slice(0, MAX_COLS);
  return [cols].concat(v.slice(0, MAX_ROWS).map(o => cols.map(c => o[c] == null ? "" : typeof o[c] === "object" ? JSON.stringify(o[c]) : o[c])));
}
/* @end artifact.render.table */

/* ---------- charts: bar / line, rendered as SVG by Chandra itself ---------- */
/* @src artifact.render.chart: Chart spec validation and SVG renderer (validated dark palette) */
const SERIES = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"]; /* dataviz reference dark slots; validated on #0c0c0f */
function chartSpec(text) {
  let s; try { s = typeof text === "string" ? JSON.parse(text) : text; } catch (e) { throw new Error("Chart content must be JSON: " + e.message); }
  if (!s || typeof s !== "object") throw new Error("Chart content must be a JSON object");
  const kind = String(s.kind || s.type || "bar").toLowerCase();
  if (!["bar", "line"].includes(kind)) throw new Error('Chart kind must be "bar" or "line"');
  const labels = Array.isArray(s.labels) ? s.labels.map(String) : null;
  if (!labels || !labels.length) throw new Error("Chart needs a non-empty labels array");
  if (labels.length > 400) throw new Error("Chart has more than 400 points");
  const series = Array.isArray(s.series) ? s.series : null;
  if (!series || !series.length) throw new Error("Chart needs a series array");
  if (series.length > SERIES.length) throw new Error("Charts take up to 8 series; fold the rest into “Other”");
  const out = series.map((x, i) => {
    const values = Array.isArray(x && x.values) ? x.values.map(v => v == null || v === "" ? null : +v) : null;
    if (!values || values.length !== labels.length) throw new Error(`Series ${i + 1} needs exactly ${labels.length} values`);
    if (values.some(v => v !== null && !isFinite(v))) throw new Error(`Series ${i + 1} has a value that is not a number`);
    return { name: String((x && x.name) || "Series " + (i + 1)).slice(0, 60), values };
  });
  return { kind, title: String(s.title || "").slice(0, 120), unit: String(s.unit || "").slice(0, 16), labels, series: out };
}
const fmt = (v, unit) => v == null ? "–" : (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : Math.abs(v) >= 1e4 ? (v / 1e3).toFixed(1).replace(/\.0$/, "") + "k" : (+v.toFixed(2)).toLocaleString()) + (unit || "");
function niceTicks(lo, hi, n) {
  if (lo === hi) { hi = lo + 1; }
  const span = hi - lo, step0 = Math.pow(10, Math.floor(Math.log10(span / n))), err = span / n / step0;
  const step = step0 * (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1);
  const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step, t = [];
  for (let v = a; v <= b + step / 2; v += step) t.push(+v.toFixed(10));
  return t;
}
function chart(text) {
  const s = chartSpec(text), NS = "http://www.w3.org/2000/svg";
  const sv = (tag, a) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); return e; };
  const W = 720, H = 360, m = { l: 56, r: s.kind === "line" && s.series.length <= 4 ? 96 : 16, t: 16, b: 44 };
  const all = s.series.flatMap(x => x.values).filter(v => v != null);
  const ticks = niceTicks(Math.min(0, ...all), Math.max(0, ...all), 5), lo = ticks[0], hi = ticks[ticks.length - 1];
  const iw = W - m.l - m.r, ih = H - m.t - m.b, n = s.labels.length;
  const y = v => m.t + ih - (v - lo) / (hi - lo) * ih;
  const band = iw / n, x = i => m.l + band * i + band / 2;
  const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, class: "achart", role: "img", "aria-label": (s.title || "Chart") + ": " + s.series.map(x => x.name).join(", ") });
  ticks.forEach(t => {
    svg.append(sv("line", { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: t === 0 ? "base" : "grid" }));
    const lb = sv("text", { x: m.l - 8, y: y(t) + 4, "text-anchor": "end", class: "ax" }); lb.textContent = fmt(t, s.unit); svg.append(lb);
  });
  const every = Math.max(1, Math.ceil(n / Math.floor(iw / 64)));
  s.labels.forEach((l, i) => { if (i % every) return; const t = sv("text", { x: x(i), y: H - m.b + 18, "text-anchor": "middle", class: "ax" }); t.textContent = l.length > 12 ? l.slice(0, 11) + "…" : l; svg.append(t); });
  const marks = sv("g", {}); svg.append(marks);
  if (s.kind === "bar") {
    const k = s.series.length, gap = 2, bw = Math.max(2, Math.min(36, (band * 0.72 - gap * (k - 1)) / k));
    s.series.forEach((ser, si) => ser.values.forEach((v, i) => {
      if (v == null) return;
      const x0 = x(i) - (k * bw + gap * (k - 1)) / 2 + si * (bw + gap), y0 = y(Math.max(0, v)), y1 = y(Math.min(0, v)), hgt = Math.max(1, y1 - y0), r = Math.min(4, bw / 2, hgt);
      const up = v >= 0, d = up ? `M${x0},${y1}V${y0 + r}Q${x0},${y0} ${x0 + r},${y0}H${x0 + bw - r}Q${x0 + bw},${y0} ${x0 + bw},${y0 + r}V${y1}Z`
        : `M${x0},${y0}V${y1 - r}Q${x0},${y1} ${x0 + r},${y1}H${x0 + bw - r}Q${x0 + bw},${y1} ${x0 + bw},${y1 - r}V${y0}Z`;
      marks.append(sv("path", { d, fill: SERIES[si], "data-i": i }));
    }));
  } else {
    s.series.forEach((ser, si) => {
      let d = "", pen = false;
      ser.values.forEach((v, i) => { if (v == null) { pen = false; return; } d += (pen ? "L" : "M") + x(i).toFixed(1) + "," + y(v).toFixed(1); pen = true; });
      marks.append(sv("path", { d, fill: "none", stroke: SERIES[si], "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }));
      const lastI = ser.values.map((v, i) => v == null ? -1 : i).filter(i => i >= 0).pop();
      if (s.series.length <= 4 && lastI != null) { const t = sv("text", { x: x(lastI) + 8, y: y(ser.values[lastI]) + 4, class: "dl" }); t.textContent = ser.name.length > 12 ? ser.name.slice(0, 11) + "…" : ser.name; svg.append(t); }
    });
  }
  /* hover: a crosshair band per label with a tooltip listing every series at that point */
  const cross = sv("line", { y1: m.t, y2: m.t + ih, class: "cross", visibility: "hidden" }); svg.append(cross);
  const dots = s.kind === "line" ? s.series.map((_, si) => { const c = sv("circle", { r: 4, fill: SERIES[si], stroke: "#0c0c0f", "stroke-width": 2, visibility: "hidden" }); svg.append(c); return c; }) : [];
  const wrap = h("figure", { class: "achartwrap" });
  if (s.title) wrap.append(h("figcaption", { text: s.title }));
  const tip = h("div", { class: "atip", role: "status" });
  const hit = sv("rect", { x: m.l, y: m.t, width: iw, height: ih, fill: "transparent" }); svg.append(hit);
  const show = i => {
    if (i < 0 || i >= n) { tip.style.opacity = 0; cross.setAttribute("visibility", "hidden"); dots.forEach(d => d.setAttribute("visibility", "hidden")); return; }
    cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("visibility", "visible");
    dots.forEach((d, si) => { const v = s.series[si].values[i]; if (v == null) return d.setAttribute("visibility", "hidden"); d.setAttribute("cx", x(i)); d.setAttribute("cy", y(v)); d.setAttribute("visibility", "visible"); });
    tip.replaceChildren(h("b", { text: s.labels[i] }), ...s.series.map((ser, si) => h("div", null, h("i", { style: "background:" + SERIES[si] }), h("span", { text: ser.name }), h("span", { class: "num", text: fmt(ser.values[i], s.unit) }))));
    const r = svg.getBoundingClientRect(), px = x(i) / W * r.width;
    tip.style.left = Math.min(r.width - 180, Math.max(0, px + 12)) + "px"; tip.style.top = "8px"; tip.style.opacity = 1;
  };
  svg.addEventListener("pointermove", e => { const r = svg.getBoundingClientRect(), vx = (e.clientX - r.left) / r.width * W; show(Math.floor((vx - m.l) / band)); });
  svg.addEventListener("pointerleave", () => show(-1));
  svg.setAttribute("tabindex", "0");
  let kbd = -1;
  svg.addEventListener("keydown", e => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); kbd = Math.max(0, Math.min(n - 1, kbd + (e.key === "ArrowRight" ? 1 : -1))); show(kbd); } if (e.key === "Escape") show(-1); });
  svg.addEventListener("blur", () => show(-1));
  const plot = h("div", { class: "aplot" }, svg, tip);
  wrap.append(plot);
  if (s.series.length > 1) wrap.append(h("div", { class: "alegend" }, s.series.map((ser, si) => h("span", null, h("i", { style: "background:" + SERIES[si] }), ser.name))));
  /* the same numbers as a table, for screen readers and anyone who prefers figures */
  const rows = [["", ...s.series.map(x => x.name)]].concat(s.labels.map((l, i) => [l, ...s.series.map(x => fmt(x.values[i], s.unit))]));
  const det = h("details", { class: "adata" }, h("summary", { text: "Data table" }), table(rows));
  wrap.append(det);
  return wrap;
}
/* @end artifact.render.chart */

/* ---------- SVG and HTML: isolated ---------- */
/* @src artifact.render.svg: SVG through <img> (no scripts, no external loads) */
function svgView(text, track) {
  const blob = new Blob([String(text)], { type: "image/svg+xml" }), url = URL.createObjectURL(blob);
  track && track(() => URL.revokeObjectURL(url));
  const img = h("img", { class: "asvg", src: url, alt: "SVG artifact preview" });
  img.addEventListener("error", () => img.replaceWith(h("p", { class: "aerr", text: "This SVG could not be drawn. Check the Source tab." })), { once: true });
  return h("div", { class: "asvgwrap" }, img);
}
/* @end artifact.render.svg */
/* @src artifact.sandbox.html: Sandboxed HTML preview (iframe sandbox + CSP, error relay) */
const CDN = "https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com";
const CSP = `default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' ${CDN}; style-src 'unsafe-inline' ${CDN}; font-src data: ${CDN}; img-src data: blob:; media-src data: blob:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'`;
const RELAY = `<script>(function(){var p=function(t,m,l){try{parent.postMessage({__chandraArtifact:1,type:t,msg:String(m||"").slice(0,300),line:l||0},"*")}catch(_){}};addEventListener("error",function(e){p("error",e.message,e.lineno)});addEventListener("unhandledrejection",function(e){p("error","Unhandled promise rejection: "+(e.reason&&e.reason.message||e.reason))});addEventListener("securitypolicyviolation",function(e){p("blocked",e.blockedURI||e.violatedDirective)});addEventListener("load",function(){p("ready")})})();<\/script>`;
/* The target-cursor bridge, inside the sandbox. The page cannot see into the frame, so the frame reports
   where the pointer is and which element is under it (its box, and the source line from data-cl); the page
   draws the reticle. When the page says the cursor is on, the frame hides its own pointer (text fields keep
   the I-beam). Shift + right-click reports the element's source line. It sends positions and tag names only,
   never content, and it listens only to its parent. */
const CURSOR = `<script>(function(){var on=false,st=null,raf=0,mv=null,sh=false,
SEL="button,a[href],input,textarea,select,label,summary,[role],[tabindex],[onclick],img,canvas,svg,video,audio,h1,h2,h3,h4,h5,p,li,td,th,pre,code,blockquote,figure,[data-cl]";
function post(o){o.__chandraArtifact=1;try{parent.postMessage(o,"*")}catch(_){}}
function css(v){if(!st){st=document.createElement("style");(document.head||document.documentElement).appendChild(st)}st.textContent=v?"html,html *{cursor:none!important}input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]),textarea,[contenteditable],[contenteditable] *{cursor:text!important}":""}
addEventListener("message",function(e){if(e.source!==parent||!e.data||e.data.__chandraCursor!==1)return;on=!!e.data.on;css(on)});
function pick(el){var vw=innerWidth,vh=innerHeight;while(el&&el.nodeType===1){if(el===document.body||el===document.documentElement)return null;if(el.matches&&el.matches(SEL)){var r=el.getBoundingClientRect();if(r.width>0&&r.height>0&&!(r.width>vw*.92&&r.height>vh*.92))return el}el=el.parentElement}return null}
function lineOf(el){var a=el&&el.closest&&el.closest("[data-cl]");return a?+a.getAttribute("data-cl"):0}
function nm(el){var c=typeof el.className==="string"?el.className.trim():"";return(el.tagName.toLowerCase()+(el.id?"#"+el.id:"")+(c?"."+c.split(/\\s+/)[0]:"")).slice(0,36)}
function send(){raf=0;if(!mv)return;var e=mv,t=e.target,el=pick(t),o={type:"pointer",x:e.clientX,y:e.clientY,shift:sh,inside:true,texty:!!(t&&t.closest&&t.closest("input,textarea,[contenteditable]"))};
if(el){var r=el.getBoundingClientRect(),ln=lineOf(el);o.rect={l:r.left,t:r.top,w:r.width,h:r.height};o.radius=parseFloat(getComputedStyle(el).borderTopLeftRadius)||0;o.label=nm(el)+(ln?" · line "+ln:"");o.shiftLabel=ln?"Shift + right-click: line "+ln:"Shift + right-click: source";o.key=ln+":"+nm(el)+":"+Math.round(r.left)+","+Math.round(r.top)+","+Math.round(r.width)}
post(o)}
function kick(){if(on&&mv&&!raf)raf=requestAnimationFrame(send)}
addEventListener("pointermove",function(e){if(!on||e.pointerType&&e.pointerType!=="mouse")return;mv=e;sh=e.shiftKey;kick()},{passive:true});
addEventListener("scroll",kick,{passive:true,capture:true});
addEventListener("pointerdown",function(){if(on)post({type:"press",pressed:true})},{passive:true});
addEventListener("pointerup",function(){if(on)post({type:"press",pressed:false})},{passive:true});
document.documentElement.addEventListener("pointerleave",function(){mv=null;if(on)post({type:"pointer",inside:false})});
addEventListener("keydown",function(e){if(e.key==="Shift"){sh=true;kick()}});addEventListener("keyup",function(e){if(e.key==="Shift"){sh=false;kick()}});
addEventListener("contextmenu",function(e){if(!e.shiftKey)return;e.preventDefault();var el=pick(e.target)||e.target;post({type:"source",line:lineOf(el),label:el&&el.tagName?nm(el):""})});
})();<\/script>`;
/* Placeholder art, inside the sandbox. An image that fails to load (a missing file, or anything the sandbox
   blocks), an <img data-placeholder> and an <img src="placeholder:name"> ask the page for a Grainient still in
   Chandra's colours; the page paints it and sends back a data: URL (which the sandbox allows). Seeded by the
   image's alt text or name, so the same image always gets the same art. At most 24 per preview. */
const ART = `<script>(function(){var n=0,wait={};
function ask(img){if(!img||img.__chArt||n>=24)return;
if(window.ChandraGrainient){img.__chArt=1;n++;window.ChandraGrainient.img(img,img.getAttribute("data-placeholder")||img.getAttribute("alt")||(img.getAttribute("src")||"").replace(/^placeholder:/,"")||"image");return}
img.__chArt=1;var id=++n,r=img.getBoundingClientRect(),aw=parseInt(img.getAttribute("width"))||0,ah=parseInt(img.getAttribute("height"))||0,w=Math.round(aw||(r.width>40?r.width:0)||(ah?ah*1.6:320)),h=Math.round(ah||(r.height>40?r.height:0)||w/1.6),src=img.getAttribute("src")||"";
var seed=img.getAttribute("data-placeholder")||img.getAttribute("alt")||src.replace(/^placeholder:/,"")||"image";wait[id]=img;img.setAttribute("data-chandra-placeholder","");if(!img.getAttribute("title"))img.title=(img.getAttribute("alt")||"Image")+" (placeholder)";
try{parent.postMessage({__chandraArtifact:1,type:"art",id:id,w:w,h:h,seed:String(seed).slice(0,80)},"*")}catch(_){}}
addEventListener("message",function(e){var d=e.data;if(e.source!==parent||!d||d.__chandraArt!==1||!wait[d.id])return;var img=wait[d.id];delete wait[d.id];if(typeof d.url==="string"&&d.url.indexOf("data:image/")===0){img.removeAttribute("srcset");img.src=d.url}});
addEventListener("error",function(e){var t=e.target;if(t&&t.tagName==="IMG")ask(t)},true);
function scan(){var l=document.querySelectorAll('img[data-placeholder],img[src^="placeholder:"],img:not([src])');for(var i=0;i<l.length;i++)ask(l[i])}
if(document.readyState==="loading")addEventListener("DOMContentLoaded",scan);else scan();
new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
})();<\/script>`;
/* data-cl: the line each element starts on in the artifact's own source, added to start tags only, so the
   cursor bridge can name a line. Script, style, textarea, title and comment contents pass through untouched,
   and nothing adds a newline, so error line numbers and data-cl both match the Source tab exactly. */
function annotate(src) {
  src = String(src);
  const n = src.length, low = src.toLowerCase();
  let out = "", i = 0, line = 1;
  const nl = (a, b) => { let c = 0; for (let k = a; k < b; k++) if (src.charCodeAt(k) === 10) c++; return c; };
  while (i < n) {
    const lt = src.indexOf("<", i);
    if (lt < 0) { out += src.slice(i); break; }
    line += nl(i, lt); out += src.slice(i, lt); i = lt;
    if (src.startsWith("<!--", i)) { const e = src.indexOf("-->", i + 4), end = e < 0 ? n : e + 3; line += nl(i, end); out += src.slice(i, end); i = end; continue; }
    const m = /^<([a-zA-Z][\w:-]*)/.exec(src.slice(i, i + 80));
    if (!m) { out += "<"; i++; continue; }
    const name = m[1].toLowerCase();
    let j = i + m[0].length, q = null;
    while (j < n) { const c = src[j]; if (q) { if (c === q) q = null; } else if (c === '"' || c === "'") q = c; else if (c === ">") break; j++; }
    const end = Math.min(n, j + 1), tag = src.slice(i, end);
    const skip = /^(html|head|meta|link|base|title|script|style|br|wbr|noscript|template)$/.test(name) || /\sdata-cl=/i.test(tag);
    out += m[0] + (skip ? "" : ` data-cl="${line}"`) + tag.slice(m[0].length);
    line += nl(i, end); i = end;
    if (/^(script|style|textarea|title|xmp|noscript)$/.test(name) && !/\/>$/.test(tag)) {
      const close = low.indexOf("</" + name, i), stop = close < 0 ? n : close;
      line += nl(i, stop); out += src.slice(i, stop); i = stop;
    }
  }
  return out;
}
/* the same Grainient Chandra uses, run inside the sandbox, so placeholder images there are painted locally
   and come alive under the pointer (stir and twirl) like Chandra's own; read from the page's own module */
let gsrc = null;
function grainientScript() {
  if (gsrc === null) { const el = document.querySelector('script[data-src="ui/grainient.js"]'); gsrc = el && !/<\/script/i.test(el.textContent) ? "<script>" + el.textContent + "<\/script>" : ""; }
  return gsrc;
}
function htmlDoc(text, opts) {
  const head = `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html{color-scheme:dark}body{margin:0}</style>${RELAY}${grainientScript()}${ART}${opts && opts.bridge === false ? "" : CURSOR}`;
  const src = opts && opts.annotate === false ? String(text) : annotate(text);
  /* the policy goes first, before anything the artifact declares, so it cannot be pre-empted */
  if (/<head[^>]*>/i.test(src)) return src.replace(/<head[^>]*>/i, m => m + head);
  if (/<html[^>]*>/i.test(src)) return src.replace(/<html[^>]*>/i, m => m + "<head>" + head + "</head>");
  return "<!doctype html><html><head>" + head + "</head><body>" + src + "</body></html>";
}
function htmlView(text, onEvent) {
  const f = h("iframe", { class: "ahtml", title: "Sandboxed HTML preview", sandbox: "allow-scripts", referrerpolicy: "no-referrer", allow: "", loading: "lazy" });
  f.srcdoc = htmlDoc(text);
  const C = () => window.ChandraCursor;
  const tell = () => { try { f.contentWindow && f.contentWindow.postMessage({ __chandraCursor: 1, on: !!(C() && C().on) }, "*"); } catch (_) {} };
  const onMsg = e => {
    if (e.source !== f.contentWindow || !e.data || e.data.__chandraArtifact !== 1) return;
    const d = e.data;
    if (d.type === "pointer" || d.type === "press") { C() && C().feed(f, d); return; }
    if (d.type === "ready") tell();
    if (d.type === "art") {                                 /* placeholder art for an image in the preview */
      const G = window.ChandraGrainient;
      if (!G || !(d.id > 0) || d.id > 24) return;
      let url = ""; try { url = G.url("art:" + String(d.seed || "image").slice(0, 80), Math.min(640, Math.max(16, d.w | 0)), Math.min(640, Math.max(16, d.h | 0))); } catch (_) {}
      try { f.contentWindow.postMessage({ __chandraArt: 1, id: d.id, url }, "*"); } catch (_) {}
      return;
    }
    onEvent && onEvent(d);
  };
  addEventListener("message", onMsg);
  document.addEventListener("chandra:cursor", tell);
  f._dispose = () => { removeEventListener("message", onMsg); document.removeEventListener("chandra:cursor", tell); C() && C().feed(f, { inside: false }); };
  return f;
}
/* @end artifact.sandbox.html */

window.ChandraRender = { h, code, markdown, math, parseCSV, table, jsonRows, chart, chartSpec, svgView, htmlView, htmlDoc, annotate, FAMILY, SERIES, CSP };
})();
