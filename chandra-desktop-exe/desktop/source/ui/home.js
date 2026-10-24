/* ============ Home: one calm column around the speaking light (1.6) ============
   The greeting and a one-line Screen sense status, the speaking light, the reply, the composer and four quiet prompts.
   When Chandra speaks, the speaking light takes the place of the moon mark. Ctrl+Space talks to Chandra.
   Nothing here calls the network: it reads what the page already has. */
(function () {
"use strict";
/* @src home.layout: calm one-column home, status line, quick prompts, speaking orb in the moon's place, Ctrl+Space */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const E = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const home = $("#home");
if (!home) return;

const ICON = {
  folder: "M3.5 7.5a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z",
  screen: "M3 5h18v11H3zM9 20h6M12 16v4",
  layers: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
  mic: "M9 3h6v11a3 3 0 0 1-6 0zM5 11a7 7 0 0 0 14 0M12 18v3",
  keys: "M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10",
  chat: "M4 5h16v11H9l-5 4z",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
  plan: "M4 6h16M4 12h10M4 18h7M18 15l2 2 3-4"
};
const svg = (d, cls) => `<svg class="${cls || "ic"}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON[d] || d}"/></svg>`;
const say = text => {
  const inp = $("#inp"), go = $("#go");
  if (!inp || !go) return;
  inp.value = text; inp.dispatchEvent(new Event("input", { bubbles: true })); go.click();
};

/* ---------- 1.6: a calm home ----------
   One centred column: the greeting with a one-line Screen sense status under it, the speaking light, the reply,
   the composer, and four quiet prompts under it. The side columns, the separate voice bar and the prompts that
   circled the moon are gone: the composer's microphone, the Hey Chandra button and Ctrl+Space do the talking,
   recent chats live in the Chats panel. */
const head = $("#idle", home);
const stat = document.createElement("div");
stat.id = "hstat"; stat.setAttribute("aria-label", "Screen sense");
if (head) head.after(stat); else home.prepend(stat);
const watch = $("#watch");
if (watch) stat.append(watch);

/* 1.7: voice first: the prompts are things to say (tap one to run it) */
const QUICK = [["What's on my screen?", "screen"], ["\u0906\u091c \u0915\u093e \u092a\u094d\u0932\u093e\u0928 \u092c\u0928\u093e\u0913", "plan"], ["Remind me in 10 minutes", "bolt"], ["Organize my downloads", "layers"]];
const chips = document.createElement("div");
chips.id = "qchips"; chips.setAttribute("aria-label", "Quick prompts");
chips.innerHTML = `<span class="qlabel">Try saying</span>` + QUICK.map(([t, i]) => `<button class="qchip" type="button" data-say="${E(t)}">${svg(i)}<span>\u201c${E(t)}\u201d</span></button>`).join("");
const comp = $("#comp", home) || $(".comp", home);
if (comp) comp.after(chips); else home.append(chips);
home.addEventListener("click", e => { const q = e.target.closest("#qchips [data-say]"); if (q) say(q.dataset.say); });

/* the composer says how to talk, so no second bar is needed */
const inp = $("#inp");
if (inp && !/Space/.test(inp.placeholder || "")) inp.placeholder = "Or type here \u00b7 hold Space to talk";
const jv = $("#jv", home);
if (jv) jv.classList.add("reply-card");

/* Ctrl+Space talks to Chandra (the same as the microphone button) */
addEventListener("keydown", e => {
  if (e.code !== "Space" || !e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  if ($("#ob.on") || $(".ov.on")) return;
  e.preventDefault();
  const m = $("#mic"); if (m) m.click();
}, true);

/* ---------- the blob takes the moon's place while Chandra listens or speaks ---------- */
let heroOrb = null, orbTimer = 0, offTimer = 0;
function ensureOrb() {
  if (heroOrb || !window.ChandraNebula || document.documentElement.dataset.ui === "legacy") return heroOrb;
  const stage = $(".stage", home);
  if (!stage) return null;
  const box = document.createElement("div");
  box.id = "heroOrb"; box.setAttribute("aria-hidden", "true");
  stage.append(box);
  /* 1.0: Nebula (ui/nebula.js), the child of Sky Cloud and Pulsar */
  const inst = new window.ChandraNebula(box, { radius: 0.5 });
  if (!inst.ok) { box.remove(); heroOrb = null; return null; }
  heroOrb = inst;
  const cv = box.querySelector("canvas"); if (cv) cv.addEventListener("webglcontextlost", () => { delete home.dataset.orb; clearInterval(orbTimer); heroOrb = null; box.remove(); });   /* no GPU: the moon stays */
  return heroOrb;
}
function orbOn(on) {
  clearTimeout(offTimer);
  if (document.documentElement.dataset.ui === "legacy") { if (on) home.dataset.lg = "on"; else delete home.dataset.lg; return; }   /* Legacy: the coloured moon breathes instead */
  if (on) {
    if (!ensureOrb()) return;
    heroOrb.set({ paused: false });
    home.dataset.orb = "on";
    clearInterval(orbTimer);
    orbTimer = setInterval(() => {
      const ph = (window.ChandraState && ChandraState.get().phase) || "";
      let lvl = window.ChandraPresence ? (ChandraPresence.level || 0) : 0;
      if (ph === "listening" && window.ChandraEar && ChandraEar.on) lvl = Math.max(lvl, ChandraEar.level);   /* your voice, while Chandra listens */
      heroOrb && heroOrb.set({ level: Math.max(0.05, Math.min(1, lvl)), warmth: ph === "speaking" ? 1 : 0, energy: ph === "listening" ? 0.4 : 0.55 });
    }, 60);
  } else {
    clearInterval(orbTimer);
    offTimer = setTimeout(() => { delete home.dataset.orb; if (heroOrb) heroOrb.set({ paused: true }); }, 420);   /* no GPU work while the moon is shown */
  }
}
const fresh = () => { if (heroOrb) heroOrb.set({ level: undefined }); };

/* ---------- wiring ---------- */
function refresh() {}
if (window.ChandraState && ChandraState.subscribe) {
  ChandraState.subscribe(s => {
    const ph = s && s.phase;
    orbOn(ph === "speaking" || ph === "listening");   /* the blob is Chandra's voice: it shows while it listens and while it speaks */
    if (ph !== "speaking" && ph !== "listening") fresh();
  });
}
window.ChandraHome = { say, refresh, get orb() { return !!heroOrb; } };
/* @end home.layout */
})();
