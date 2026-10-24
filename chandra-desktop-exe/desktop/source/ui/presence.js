/* ============ Composer presence: the speaking blob, driven by ChandraState ============
   - The blob (ui/blob.js) rises over the composer's top-right edge like a moon
     on the horizon. Its energy follows the assistant's phase; while Chandra speaks, its level follows
     the speech. (The ribbon mode was tried and rejected: it needs a ~4:1 box and opens into a broad
     sheet when speaking, which would sit over the input.)
   - 1.6: the owl that perched here is gone, with the buddy: a calmer composer.
   - A small text line in the composer says the phase in words, so state never depends on motion or colour.

   Where the speaking level comes from, honestly:
   - 1.5: Chandra's natural voice (Gemini, through the host) plays through Web Audio, so while it speaks
     the level is the real output level, read from an analyser (speechSource = "audio").
   - The computer's own voices (speechSynthesis) do not expose audio samples, so no
     analyser can read them. The level is built from the real playback events instead: it rises at
     "start", kicks on every word "boundary" (scaled by the word's length) and drops to zero at "end"
     or on interruption. If a voice sends no boundary events, the ribbon falls back to the component's
     own synthetic speech motion while playback is active (speechSource = "synthetic").
   - While listening, the level comes from a real microphone analyser only when microphone permission
     is already granted (no new permission prompt is ever triggered for this); otherwise it pulses on
     the speech recogniser's interim results (micSource = "recogniser"). */
(function () {
"use strict";
const comp = document.getElementById("comp");
if (!comp || !window.ChandraState) return;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const reduced = () => document.body.classList.contains("rm") || (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);

/* ---------- DOM ---------- */
const layer = document.createElement("div");
layer.className = "presence";
layer.setAttribute("aria-hidden", "true");
layer.innerHTML = '<div class="orb" id="orb"></div>';
comp.prepend(layer);
const crow = comp.querySelector(".crow"), sp = crow && crow.querySelector(".sp");
const label = document.createElement("span");
label.className = "cphase"; label.id = "cphase"; label.setAttribute("role", "status"); label.setAttribute("aria-live", "polite");
if (sp) sp.after(label); else if (crow) crow.append(label);

/* ---------- the blob ---------- */
/* @src presence.blob.tuning: per-phase energy for the blob (its colours are fixed in blob.js) */
const PALETTE = ["#8f8478", "#b3a48e", "#d8c8ad", "#fff6e8", "#dbe3f1", "#8ea6d6", "#2f4269"];   /* Classic: champagne sheet + silver/Chandra-blue sheet */
const STARLIGHT = ["#5b7cff", "#8e8cff", "#c9d6ff", "#fff3d1", "#a8d4ff", "#3d6bff", "#13235e"]; /* Starlight: star sheet + blue sheet */
const skinPalette = () => document.documentElement.dataset.skin === "classic" ? PALETTE : STARLIGHT;
const BASE = { colors: skinPalette(), glass: true, count: 2, thickness: 0.9, glow: 0.8, saturation: 0.8, amplitude: 0.9, spread: 0.9,
  dispersion: 0.6, rim: 0.85, refraction: 1, glassSize: 1, waviness: 1, taper: 1, scale: 1, maxDevicePixelRatio: 2,
  interactive: false, clickPulse: false, intro: true };
const PHASE = {
  idle:        { energy: 0.08, speed: 0.45, intensity: 0.60, opacity: 0.80, maxFps: 24 },
  waiting:     { energy: 0.14, speed: 0.50, intensity: 0.66, opacity: 0.85, maxFps: 30 },
  listening:   { energy: 0.26, speed: 0.70, intensity: 0.80, opacity: 1.00, maxFps: 60 },
  thinking:    { energy: 0.30, speed: 0.85, intensity: 0.80, opacity: 1.00, maxFps: 60 },
  working:     { energy: 0.38, speed: 1.00, intensity: 0.86, opacity: 1.00, maxFps: 60 },
  responding:  { energy: 0.52, speed: 1.05, intensity: 0.95, opacity: 1.00, maxFps: 60 },
  speaking:    { energy: 0.22, speed: 1.00, intensity: 1.00, opacity: 1.00, maxFps: 60 },
  interrupted: { energy: 0.04, speed: 0.40, intensity: 0.45, opacity: 0.75, maxFps: 60 },
  error:       { energy: 0.05, speed: 0.35, intensity: 0.40, opacity: 0.60, maxFps: 24 }
};
/* @end presence.strands.tuning */
const orb = layer.querySelector("#orb");
let strands = null;
if (!window.CHANDRA_LITE && window.ChandraNebula) {
  strands = new window.ChandraNebula(orb, { count: 520, radius: 0.4, maxFps: 45 });     /* 1.0: Nebula, small */
  if (!strands.ok) { strands = null; orb.classList.add("strands-fallback"); }
} else orb.classList.add("strands-fallback");          /* Lite mode or no WebGL: the CSS orb stands in */
document.addEventListener("chandra:skin", () => strands && strands.set({ colors: skinPalette() }));
window.ChandraPresence = { get strands() { return strands }, get speechSource() { return V.speechSource }, get micSource() { return V.micSource }, get level() { return V.level } };

/* ---------- voice level ---------- */
/* @src presence.voice.level: speech-event and microphone level for the blob */
const V = { phase: "idle", level: 0, base: 0, speechSource: "none", micSource: "none", boundaries: 0, startAt: 0, raf: 0, last: 0,
  mic: null };
function tick(now) {
  V.raf = 0;
  const dt = V.last ? Math.min(0.05, (now - V.last) / 1000) : 0; V.last = now;
  if (V.mic && V.mic.an) {
    V.mic.an.getFloatTimeDomainData(V.mic.buf);
    let s = 0; for (let i = 0; i < V.mic.buf.length; i++) s += V.mic.buf[i] * V.mic.buf[i];
    const db = 20 * Math.log10(Math.sqrt(s / V.mic.buf.length) + 1e-6);
    V.base = clamp((db + 58) / 42, 0, 1);
  }
  if (V.speechSource === "audio" && window.ChandraVoiceOut) V.base = clamp(window.ChandraVoiceOut.level() * 1.15, 0, 1);
  V.level += (V.base - V.level) * (1 - Math.exp(-dt / (V.base > V.level ? 0.05 : 0.14)));
  if (V.phase === "speaking" && (V.speechSource === "events" || V.speechSource === "audio") && strands) strands.set({ level: clamp(V.level, 0, 1) });
  if (V.phase === "listening" && V.micSource !== "none" && strands) strands.set({ level: clamp(V.level, 0, 1) });
  if (V.phase === "speaking" && !V.boundaries && V.speechSource === "events" && now - V.startAt > 900) {
    V.speechSource = "synthetic";                     /* this voice sends no word boundaries */
    strands && strands.set({ level: undefined, listening: true });
  }
  if (V.phase === "speaking" || (V.phase === "listening" && V.micSource !== "none")) V.raf = requestAnimationFrame(tick);
  else V.last = 0;
}
const run = () => { if (!V.raf) { V.last = 0; V.raf = requestAnimationFrame(tick); } };
function onSpeechEvent(ev) {
  if (ev.type === "speech:start") { V.boundaries = 0; V.startAt = performance.now(); V.speechSource = ev.source === "audio" ? "audio" : "events"; V.base = 0.34; V.level = 0.2; run(); }
  if (ev.type === "speech:boundary") {
    V.boundaries++;
    if (V.speechSource === "synthetic") { V.speechSource = "events"; strands && strands.set({ listening: false }); }
    const n = clamp((ev.charLength || 5) / 8, 0.3, 1);
    V.level = Math.max(V.level, 0.55 + 0.4 * n); V.base = 0.3 + 0.15 * n;
    setTimeout(() => { if (V.phase === "speaking") V.base = 0.3; }, 140 + 40 * (ev.charLength || 4));
    run();
  }
  if (ev.type === "speech:end") { V.base = 0; V.level = 0; V.speechSource = "none"; strands && strands.set({ level: 0, listening: false }); }
  if (ev.type === "listen:heard" && V.micSource === "recogniser") { V.level = Math.max(V.level, 0.62); V.base = 0.22; run(); setTimeout(() => { if (V.micSource === "recogniser") V.base = 0.08; }, 260); }
}
async function micOpen() {
  if (V.mic) return;
  V.micSource = "recogniser";
  const gen = V.micGen = (V.micGen || 0) + 1;
  try {
    const perm = navigator.permissions && await navigator.permissions.query({ name: "microphone" });
    if (!perm || perm.state !== "granted" || !navigator.mediaDevices) return;
    const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    if (gen !== V.micGen || V.phase !== "listening") { s.getTracks().forEach(t => t.stop()); return; }
    const C = window.AudioContext || window.webkitAudioContext, ctx = new C(), an = ctx.createAnalyser();
    an.fftSize = 512; ctx.createMediaStreamSource(s).connect(an);
    V.mic = { s, ctx, an, buf: new Float32Array(512) }; V.micSource = "analyser"; run();
  } catch (_) { V.micSource = "recogniser"; }
}
function micClose() {
  V.micGen = (V.micGen || 0) + 1;
  if (V.mic) { try { V.mic.s.getTracks().forEach(t => t.stop()); V.mic.ctx.close(); } catch (_) {} V.mic = null; }
  V.micSource = "none";
}
/* @end presence.voice.level */


/* ---------- phase -> visuals ---------- */
/* @src presence.apply: phase to blob and composer state line */
function apply(s, ev) {
  const prev = V.phase;
  V.phase = s.phase;
  layer.dataset.phase = s.phase; comp.dataset.phase = s.phase;
  label.textContent = s.phase === "idle" ? "" : s.label;
  label.title = s.phase === "error" && s.error ? s.error : "";
  if (strands) {
    const p = Object.assign({}, PHASE[s.phase] || PHASE.idle);
    if (s.phase !== "speaking" && s.phase !== "listening") { p.level = undefined; p.listening = false; }
    if (s.phase === "interrupted") { p.level = 0; p.listening = false; }
    strands.set(p);
  }
  if (s.phase === "listening" && prev !== "listening") micOpen();
  if (s.phase !== "listening" && prev === "listening") micClose();
  if (ev) onSpeechEvent(ev);
}
window.ChandraState.subscribe(apply);
/* @end presence.apply */
})();
