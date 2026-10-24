/* ============ Starlight: the sky, the corona, the look switch, placeholder art ============
   Mounts the Gradient ASCII sky (a horizon of light across the top, the dark arc below) and the ASCII eclipse corona
   around the moon mark, follows Chandra's state (a little quicker while it thinks and works, warmer while
   it speaks), and fills placeholders with Grainient art in Chandra's colours.
   Costs: the sky draws at 30 fps at most and at 1x pixel density, pauses when the window is hidden, in Lite
   mode, with Reduce motion (one still frame), and while a full-screen artifact covers it. */
(function () {
"use strict";
/* @src starlight.mount: sky + corona mount, skin switch, phase reactions, Grainient placeholders */
const KEY = "chandra-skin";
const root = document.documentElement;
const skin = () => root.dataset.skin === "classic" ? "classic" : "starlight";
const lite = () => !!window.CHANDRA_LITE;

/* the sky: the Gradient ASCII horizon across the top, the dark arc of the planet below it; it scrambles
   under the pointer and sends a wave from every click */
const SKY = { shape: "horizon", colors: ["#0a1a4f", "#1e3fd8", "#3d6bff", "#6f95ff", "#a8d4ff"], characters: " =+xX0S8#@",
  cellSize: 14, density: 0.8, glyphOpacity: 0.85, glow: 0.3, flicker: 0.2, softness: 0.55, scale: 1, flow: 0.55, speed: 0.55,
  gradientOpacity: 0.7, grain: 0.06, variation: 3, scrambleRadius: 0.13, clickEffect: "wave", intro: true,
  fontFamily: 'ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,monospace', maxDevicePixelRatio: 1, maxFps: 30 };
const CORONA = { shape: "eclipse", colors: ["#13235e", "#3d6bff", "#8e8cff", "#a8d4ff", "#f4f7ff"], characters: " .:-=+*x#",
  cellSize: 11, density: 0.75, glyphOpacity: 0.75, glow: 0.4, flicker: 0.25, softness: 0.55, scale: 1, flow: 0.4, speed: 0.7,
  gradientOpacity: 0.85, grain: 0.04, variation: 7, mouseInteraction: true, scrambleRadius: 0.16, clickEffect: "burst", intro: true,
  fontFamily: SKY.fontFamily, maxDevicePixelRatio: 1.5, maxFps: 30 };
const PHASE = {
  idle: { speed: 0.55, flicker: 0.18, glow: 0.35 }, waiting: { speed: 0.6, flicker: 0.2, glow: 0.38 },
  listening: { speed: 0.8, flicker: 0.24, glow: 0.45 }, thinking: { speed: 1.1, flicker: 0.32, glow: 0.48 },
  working: { speed: 1.25, flicker: 0.36, glow: 0.5 }, responding: { speed: 0.9, flicker: 0.26, glow: 0.5 },
  speaking: { speed: 0.8, flicker: 0.22, glow: 0.6 }, interrupted: { speed: 0.45, flicker: 0.1, glow: 0.3 },
  error: { speed: 0.4, flicker: 0.1, glow: 0.28 }
};

let sky = null, corona = null, skyEl = null, coronaEl = null, phase = "";
/* Software rendering (no usable GPU: Windows' WARP / "Basic Render Driver", SwiftShader, llvmpipe) draws
   these passes on the CPU and would slow everything else down. Then the sky and the corona draw at quarter
   resolution and 10 fps, which keeps the look and leaves the CPU to Chandra. */
const SOFT = (() => {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return false;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const r = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return /swiftshader|llvmpipe|softpipe|basic render|microsoft basic|warp|software/i.test(r);
  } catch (_) { return false; }
})();
const LIGHT = SOFT ? { maxDevicePixelRatio: 0.5, maxFps: 10 } : {};

function mountSky() {
  if (skyEl) return;
  skyEl = document.createElement("div");
  skyEl.id = "sky"; skyEl.setAttribute("aria-hidden", "true");
  const aura = document.querySelector(".aura");
  if (aura) aura.after(skyEl); else document.body.prepend(skyEl);
  /* 1.6: the aurora (ui/aurora.js) is the sky; the ASCII horizon stays only as the corona around the moon */
  if (!lite() && window.ChandraAurora) {
    sky = new window.ChandraAurora(skyEl, { soft: SOFT });
    if (!sky.ok) { sky = null; skyEl.classList.add("aurora-fallback"); }
  } else skyEl.classList.add("aurora-fallback");
  requestAnimationFrame(() => skyEl.classList.add("on"));
}
function mountCorona() {
  const stage = document.querySelector("#home .stage");
  if (!stage || coronaEl) return;
  coronaEl = document.createElement("div");
  coronaEl.className = "corona"; coronaEl.setAttribute("aria-hidden", "true");
  stage.prepend(coronaEl);
  if (!lite() && window.GradientASCII && window.GradientASCII.supported()) {
    corona = new window.GradientASCII(coronaEl, Object.assign({}, CORONA, LIGHT));
    if (!corona.ok) corona = null;
  } else coronaEl.classList.add("gradient-ascii-fallback");
}
function covered() { const f = document.getElementById("artfull"); return !!(f && !f.hidden && f.classList.contains("on")); }
let paused = null;
function sync() {
  const on = skin() === "starlight";
  if (on) { mountSky(); mountCorona(); }
  const pause = !on || covered();
  if (pause === paused) return;
  paused = pause;
  sky && sky.set({ paused: pause });
  corona && corona.set({ paused: pause });
}
function onPhase(p) {
  p = PHASE[p] ? p : "idle";
  if (p === phase) return;
  phase = p;
  const t = PHASE[phase];
  sky && sky.set(t);                        /* the aurora reads the phase itself; set() only takes {paused} */
  corona && corona.set({ speed: t.speed * 1.2, glow: t.glow + 0.1,
    colors: phase === "speaking" ? ["#13235e", "#3d6bff", "#a8d4ff", "#fff3d1", "#fffaf0"] : CORONA.colors });
}

function setSkin(next) {
  next = next === "classic" ? "classic" : "starlight";
  root.dataset.skin = next;
  try { localStorage.setItem(KEY, next); } catch (_) {}
  sync();
  paintAvatars();
  document.dispatchEvent(new CustomEvent("chandra:skin", { detail: { skin: next } }));
}

/* ---------- Grainient placeholders ---------- */
const G = () => window.ChandraGrainient;
function paintAvatars() {
  if (!G()) return;
  document.querySelectorAll(".av").forEach(a => {
    if (a.classList.contains("pic") || skin() !== "starlight") { if (a.classList.contains("grainient-fill")) { a.style.removeProperty("background-image"); a.classList.remove("grainient-fill"); } return; }
    const seed = "avatar:" + (a.textContent || "").trim();
    if (a.dataset.gseed === seed && a.classList.contains("grainient-fill")) return;
    a.dataset.gseed = seed;
    G().fill(a, seed, { type: "radial", bands: 1 });
  });
}
/* any image in Chandra's own UI that fails to load gets placeholder art instead of a broken icon */
document.addEventListener("error", e => {
  const t = e.target;
  if (!(t instanceof HTMLImageElement) || !G() || t.dataset.grainient || t.closest("[data-no-placeholder]")) return;
  G().img(t, t.getAttribute("alt") || t.getAttribute("src"));
}, true);

/* ---------- start ---------- */
mountSky(); mountCorona(); sync();
if (window.ChandraState && window.ChandraState.subscribe) window.ChandraState.subscribe(s => onPhase(s && s.phase));
/* the full-screen artifact view covers the sky: pause underneath it */
const watchFull = () => { const f = document.getElementById("artfull"); if (!f) return false; new MutationObserver(sync).observe(f, { attributes: true, attributeFilter: ["hidden", "class"] }); return true; };
if (!watchFull()) setTimeout(watchFull, 1500);
paintAvatars();
new MutationObserver(() => { clearTimeout(paintAvatars.t); paintAvatars.t = setTimeout(paintAvatars, 120); })
  .observe(document.body, { subtree: true, childList: true, characterData: true });

window.ChandraSkin = { get soft() { return SOFT; }, get skin() { return skin(); }, set: setSkin, get sky() { return sky; }, get corona() { return corona; } };
/* @end starlight.mount */
})();
