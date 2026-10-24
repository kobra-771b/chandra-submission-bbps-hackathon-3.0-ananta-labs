/* ============ Ear: Chandra's own listening (1.0.7) ============
   Turn-taking is done by Silero VAD, an open-source voice-activity model (MIT, github.com/ricky0123/vad), loaded at a
   pinned version from the jsDelivr CDN. It hears speech the way a person does: it ignores breaths and room noise, keeps
   a short pause inside one turn, and hands over the exact audio of each turn. Chandra's energy detector stays as the
   fallback when the model cannot load (offline, or the CDN is blocked).
   Each turn goes to the host, which asks Gemini to write it down in English, Hindi (Devanagari) or both.
   Push-to-talk (holding Space or the moon) records exactly while held. A live level (0..1) drives the listening ring,
   and states drive the captions. Nothing is stored. */
(function () {
"use strict";
/* @src ear.listen: microphone, turn-taking (Silero VAD), push-to-talk, barge-in, WAV, transcription */
const RATE = 16000, FRAME = 2048;
const VAD_VER = "0.0.31", ORT_VER = "1.30.0";
const VAD_BASE = "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@" + VAD_VER + "/dist/";
const ORT_BASE = "https://cdn.jsdelivr.net/npm/onnxruntime-web@" + ORT_VER + "/dist/";
const E = { gen: 0, on: false, stream: null, ctx: null, src: null, proc: null, level: 0, floor: 0.006, voiced: 0, voicedTotal: 0, quiet: 0,
  rec: false, ptt: false, buf: [], pre: [], startAt: 0, opts: {}, busy: 0, mute: false,
  vad: null, pendingVad: null, vadFailed: 0, sileroSpeaking: false, bargeT: 0, state: "off" };

function speakingNow() {
  try { if (window.chandraIsSpeaking && window.chandraIsSpeaking()) return true; return !!(window.ChandraState && ChandraState.get && ChandraState.get().phase === "speaking"); } catch (_) { return false; }
}
function rms(a) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * a[i]; return Math.sqrt(s / a.length); }
function down(a, from) {                       /* linear resample to 16 kHz */
  if (from === RATE) return a;
  const k = from / RATE, n = Math.floor(a.length / k), o = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = i * k, j = x | 0, f = x - j; o[i] = a[j] * (1 - f) + (a[j + 1] || 0) * f; }
  return o;
}
function wav(chunks) {
  const len = chunks.reduce((s, c) => s + c.length, 0), b = new ArrayBuffer(44 + len * 2), v = new DataView(b);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + len * 2, true); str(8, "WAVE"); str(12, "fmt "); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, RATE, true); v.setUint32(28, RATE * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, "data"); v.setUint32(40, len * 2, true);
  let o = 44; chunks.forEach(c => { for (let i = 0; i < c.length; i++, o += 2) v.setInt16(o, Math.max(-1, Math.min(1, c[i])) * 0x7fff, true); });
  return new Uint8Array(b);
}
function b64(u8) { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }

/* one quiet retry: a busy service often answers a second later, and "Couldn't hear that" for a hiccup is worse than a short wait */
async function transcribe(audio, lang) {
  try { return await transcribeOnce(audio, lang); }
  catch (err) { if (/key|quota|No Gemini/i.test(String(err && err.message))) throw err; await new Promise(r => setTimeout(r, 1200)); return transcribeOnce(audio, lang); }
}
async function transcribeOnce(audio, lang) {
  const api = window.pywebview && pywebview.api;
  if (window.CHANDRA_NATIVE && api && typeof api.stt === "function") {
    const r = await api.stt(audio, lang || "", "audio/wav") || {};
    if (r.error) throw new Error(r.error); return r;
  }
  const r = await fetch(location.origin + "/stt", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer __CHANDRA_PAIR__" },
    body: JSON.stringify({ audio, lang: lang || "", mime: "audio/wav" }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error(d.error || ("listening failed (" + r.status + ")"));
  return d;
}

function state(s, detail) { E.state = s; E.opts.onState && E.opts.onState(s, detail); }

/* one finished turn goes to the host for transcription; the reply comes back through onText */
function send(chunks) {
  const secs = chunks.reduce((s, c) => s + c.length, 0) / RATE;
  if (secs < 0.35) { state("listening"); return; }
  state("heard");
  E.busy++;
  transcribe(b64(wav(chunks)), E.opts.lang && E.opts.lang())
    .then(r => { const t = String(r.text || "").trim(); if (t && E.on) E.opts.onText && E.opts.onText(t, r.lang || ""); else if (E.on) state("listening", t ? "" : "nothing"); })
    .catch(err => { E.opts.onError && E.opts.onError(err); })
    .finally(() => { E.busy--; if (E.on && !E.rec) state("listening"); });
}
/* energy path only: the turn ends after a pause, or is dropped when there was no voice in it */
function finish(reason) {
  if (!E.rec) return;
  E.rec = false; E.ptt = false;
  const chunks = E.buf; E.buf = [];
  const voicedSecs = E.voicedTotal * FRAME / (E.ctx ? E.ctx.sampleRate : 48000);
  if (E.pendingVad) { E.vad = E.pendingVad; E.pendingVad = null; }
  if (reason === "cancel" || (reason !== "ptt" && !E.vad && voicedSecs < 0.25)) { state("listening"); return; }
  send(chunks);
}
function startUtterance() {
  E.rec = true; E.buf = E.pre.slice(); E.pre = []; E.quiet = 0; E.voicedTotal = 0; E.startAt = performance.now();
  state("hearing");
  E.opts.onSpeech && E.opts.onSpeech();
}

/* ---------- Silero: the turn-taking model ---------- */
let sileroLoad = null;
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = src; s.async = true;
    const t = setTimeout(() => { s.remove(); rej(new Error("timeout")); }, 20000);
    s.onload = () => { clearTimeout(t); res(); };
    s.onerror = () => { clearTimeout(t); s.remove(); rej(new Error("load failed")); };
    document.head.appendChild(s);
  });
}
function loadSilero() {
  if (window.vad && window.vad.MicVAD) return Promise.resolve(true);
  if (!sileroLoad) sileroLoad = (async () => {
    if (!window.ort) await loadScript(ORT_BASE + "ort.min.js");
    if (!(window.vad && window.vad.MicVAD)) await loadScript(VAD_BASE + "bundle.min.js");
    return !!(window.vad && window.vad.MicVAD);
  })().catch(() => { sileroLoad = null; return false; });
  return sileroLoad;
}
/* a pause of up to about 1.3 s stays inside the same turn; speech shorter than 240 ms is not a turn */
function sileroOptions() {
  return {
    model: "v5", baseAssetPath: VAD_BASE, onnxWASMBasePath: ORT_BASE,
    startOnLoad: true, getStream: async () => E.stream, pauseStream: async () => {}, resumeStream: async () => E.stream,
    positiveSpeechThreshold: 0.5, negativeSpeechThreshold: 0.35,
    redemptionMs: 1300, preSpeechPadMs: 300, minSpeechMs: 240,
    onSpeechStart: sileroStart, onSpeechRealStart: sileroRealStart, onSpeechEnd: sileroEnd,
    onVADMisfire: () => { E.sileroSpeaking = false; clearTimeout(E.bargeT); if (E.on && !E.rec && !E.ptt) state("listening"); },
  };
}
/* one model instance is made when the page loads (about 2 s, which the first tap would otherwise wait for); it is started
   by the first listen, and the next one is prepared straight after */
let sileroReady = null;
function prepareSilero() {
  if (!sileroReady) sileroReady = loadSilero()
    .then(ok => ok ? window.vad.MicVAD.new(Object.assign(sileroOptions(), { startOnLoad: false })) : null)
    .catch(() => null);
  return sileroReady;
}
async function startSilero() {
  const v = await prepareSilero();
  sileroReady = null; setTimeout(prepareSilero, 0);
  if (!v) return null;
  await v.start();
  return v;
}
function sileroStart() { E.sileroSpeaking = true; }
function sileroRealStart() {
  if (!E.on || E.ptt) return;
  /* speech that lasts while Chandra is talking is an interruption (barge-in); a breath or an echo is not */
  if (speakingNow()) { clearTimeout(E.bargeT); E.bargeT = setTimeout(() => { if (E.sileroSpeaking && E.opts.onBargeIn) E.opts.onBargeIn(); }, 150); }
  state("hearing");
  E.opts.onSpeech && E.opts.onSpeech();
}
function sileroEnd(audio) {
  E.sileroSpeaking = false; clearTimeout(E.bargeT);
  if (!E.on || E.ptt || E.mute) { state("listening"); return; }
  send([audio]);
}

/* ---------- energy fallback: the same job with a simple level detector ---------- */
function onAudio(ev) {
  const raw = ev.inputBuffer.getChannelData(0), r = rms(raw), sr = E.ctx.sampleRate;
  E.level += ((Math.min(1, Math.max(0, (20 * Math.log10(r + 1e-6) + 60) / 42))) - E.level) * 0.5;
  if (E.pendingVad && !E.rec) { E.vad = E.pendingVad; E.pendingVad = null; }
  if (E.mute) return;
  if (E.vad) {                       /* Silero decides where turns start and end; this path only records push-to-talk */
    if (E.rec) { E.buf.push(down(new Float32Array(raw), sr)); if ((performance.now() - E.startAt) / 1000 >= 45) finish("ptt"); }
    return;
  }
  const chunk = down(new Float32Array(raw), sr);
  const talking = speakingNow();
  const thr = Math.max(0.012, E.floor * 3) * (talking ? 2.6 : 1);
  const loud = r > thr;
  if (!E.rec && !loud) E.floor = E.floor * 0.97 + Math.min(r, 0.05) * 0.03;      /* the room's noise floor, tracked while quiet */
  const frameS = FRAME / sr;
  if (E.rec) {
    E.buf.push(chunk);
    if (loud) { E.quiet = 0; E.voicedTotal++; } else E.quiet += frameS;
    const len = (performance.now() - E.startAt) / 1000;
    if (!E.ptt && (E.quiet >= (E.opts.endSilence || 0.85) || len >= 20)) finish("vad");
    else if (E.ptt && len >= 45) finish("ptt");
    return;
  }
  E.pre.push(chunk); while (E.pre.length > Math.ceil(0.35 / frameS)) E.pre.shift();
  E.voiced = loud ? E.voiced + 1 : 0;
  const need = talking ? Math.ceil(0.28 / frameS) : 2;                            /* ~90 ms normally; ~280 ms over Chandra's own voice */
  if (E.voiced >= need) {
    if (talking) E.opts.onBargeIn && E.opts.onBargeIn();
    startUtterance();
  }
}

async function start(opts) {
  E.opts = opts || {};
  if (E.on) return true;
  const md = navigator.mediaDevices;
  if (!md || !md.getUserMedia) throw new Error("This window has no microphone access.");
  const gen = E.gen = E.gen + 1;                                                /* stop() bumps E.gen: a stale start lets go */
  const got = await md.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
  if (gen !== E.gen) { got.getTracks().forEach(t => t.stop()); return false; }
  E.stream = got;
  const C = window.AudioContext || window.webkitAudioContext;
  E.ctx = new C(); if (E.ctx.state === "suspended") { try { await E.ctx.resume(); } catch (_) {} }
  if (gen !== E.gen) { E.stream.getTracks().forEach(t => t.stop()); try { E.ctx.close(); } catch (_) {} E.stream = E.ctx = null; return false; }
  E.src = E.ctx.createMediaStreamSource(E.stream);
  E.proc = E.ctx.createScriptProcessor(FRAME, 1, 1);
  E.proc.onaudioprocess = onAudio;
  const sink = E.ctx.createGain(); sink.gain.value = 0;                            /* keeps the processor running, silently */
  E.src.connect(E.proc); E.proc.connect(sink); sink.connect(E.ctx.destination);
  Object.assign(E, { on: true, rec: false, ptt: false, buf: [], pre: [], voiced: 0, voicedTotal: 0, floor: 0.006, vad: null, sileroSpeaking: false });
  state("listening");
  /* until the model is ready (a few seconds the first time) the energy path listens; then Silero takes over */
  if (!E.vadFailed || Date.now() - E.vadFailed > 300000) startSilero().then(v => {
    if (!E.on) { if (v) try { v.destroy(); } catch (_) {} return; }
    if (v) { E.vadFailed = 0; if (E.rec && !E.ptt) E.pendingVad = v; else E.vad = v; E.opts.onEngine && E.opts.onEngine("silero"); }
    else { E.vadFailed = Date.now(); E.opts.onEngine && E.opts.onEngine("energy"); }
  }).catch(() => { E.vadFailed = Date.now(); });
  return true;
}
function stop() {
  E.gen = E.gen + 1;
  if (!E.on) return;
  E.on = false; E.rec = false; E.ptt = false; E.buf = []; E.pre = []; E.level = 0; clearTimeout(E.bargeT);
  try { E.vad && E.vad.destroy(); } catch (_) {}
  E.vad = null; E.pendingVad = null;
  try { E.proc && (E.proc.onaudioprocess = null); E.src && E.src.disconnect(); E.proc && E.proc.disconnect(); } catch (_) {}
  try { E.stream && E.stream.getTracks().forEach(t => t.stop()); } catch (_) {}
  try { E.ctx && E.ctx.close(); } catch (_) {}
  E.stream = E.ctx = E.src = E.proc = null;
  state("off");
}
/* push-to-talk: record exactly while held, whichever engine is listening */
function ptt(down) {
  if (!E.on) return;
  if (down) { if (!E.rec) startUtterance(); E.ptt = true; }
  else if (E.ptt) finish("ptt");
}

/* the model loads while the page loads, so the first tap does not wait for it */
prepareSilero();

window.ChandraEar = {
  start, stop, ptt,
  cancel() { finish("cancel"); },
  set muted(v) { E.mute = !!v; },
  get on() { return E.on; }, get level() { return E.on ? E.level : 0; }, get recording() { return E.rec; },
  get busy() { return E.busy > 0; }, get state() { return E.state || "off"; }, get engine() { return E.vad ? "silero" : "energy"; },
  supported() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && (window.AudioContext || window.webkitAudioContext)); },
  _wav: wav, _down: down
};
/* @end ear.listen */
})();
