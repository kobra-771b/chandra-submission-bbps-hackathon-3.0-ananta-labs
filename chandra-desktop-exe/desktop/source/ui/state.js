/* ============ ChandraState: one place that knows what Chandra is doing ============
   The app already announces its task state on <body data-st> (idle, listen, think, act, done, need).
   This module reads that channel and adds the signals it cannot express: speech playback (start,
   word boundaries, end, interruption), listening, the moment a reply arrives, and errors.
   Everything visual (the speaking light, the owl, the composer's state line) subscribes here instead
   of guessing from CSS classes or timers.

   Phases, highest priority first:
     interrupted  speech was cut off (held ~0.7 s so the cut is visible, then resolves)
     speaking     a spoken reply is actually playing (speechSynthesis start..end)
     thinking     the model is planning (data-st think)
     working      tools are running (data-st act)
     error        a request failed (held ~2.4 s, then resolves; new speech or new work clears it)
     responding   a reply just arrived and is being written into the chat and artifacts
     listening    the microphone is open for Chandra (voice mode awake)
     waiting      Chandra needs the person (approval, paused, locked)
     idle
*/
(function () {
"use strict";
/* @src state.bus: Assistant lifecycle state bus (phases, signals, subscribers) */
const subs = new Set();
const BASE = { idle: "idle", done: "idle", listen: "listening", think: "thinking", act: "working", need: "waiting" };
const LABEL = { idle: "Ready", listening: "Listening", thinking: "Thinking", working: "Working", responding: "Responding",
  speaking: "Speaking", interrupted: "Interrupted", error: "Something went wrong", waiting: "Needs you" };
const M = { base: "idle", listening: false, speaking: false, speechStarted: 0, respondingUntil: 0, transient: null,
  phase: "idle", since: Date.now(), error: "" };
let timer = 0;

function derive() {
  const now = Date.now();
  if (M.transient && now >= M.transient.until) M.transient = null;
  /* real work always wins over a fading notice: speech, then new work, then the notice */
  if (M.transient && M.transient.kind === "interrupted") return "interrupted";
  if (M.speaking) return "speaking";
  if (M.base === "thinking" || M.base === "working") return M.base;
  if (M.transient) return M.transient.kind;
  if (M.respondingUntil > now) return "responding";
  if (M.listening || M.base === "listening") return "listening";
  if (M.base === "waiting") return "waiting";
  return "idle";
}
function snapshot() {
  return { phase: M.phase, label: LABEL[M.phase] || M.phase, since: M.since, base: M.base, speaking: M.speaking,
    listening: M.listening, error: M.error };
}
function update(event) {
  const next = derive();
  clearTimeout(timer);
  const wakeAt = Math.min(M.transient ? M.transient.until : Infinity, M.respondingUntil > Date.now() ? M.respondingUntil : Infinity);
  if (wakeAt !== Infinity) timer = setTimeout(() => update({ type: "tick" }), Math.max(16, wakeAt - Date.now() + 5));
  const changed = next !== M.phase;
  if (changed) { M.phase = next; M.since = Date.now(); document.documentElement.dataset.phase = next; }
  if (changed || (event && event.type !== "tick")) {
    const s = snapshot();
    subs.forEach(fn => { try { fn(s, event || { type: "change" }) } catch (e) { console.warn("ChandraState subscriber", e) } });
  }
}

/* The signals other code sends. Unknown names are ignored, so callers never break the app. */
function signal(type, detail) {
  detail = detail || {};
  const ev = Object.assign({ type, at: Date.now() }, detail);
  switch (type) {
    case "speech:start": M.speaking = true; M.speechStarted = Date.now(); M.transient = null; break;
    case "speech:boundary": break;                       /* a word is being spoken: presence.js turns these into level */
    case "speech:end":
      if (!M.speaking) { if (!detail.interrupted) return; }
      M.speaking = false;
      if (detail.interrupted) M.transient = { kind: "interrupted", until: Date.now() + 700 };
      break;
    case "listen:start": M.listening = true; break;
    case "listen:end": M.listening = false; break;
    case "listen:heard": break;                          /* the recogniser heard speech (interim results) */
    case "assistant:responding": M.respondingUntil = Date.now() + Math.max(450, Math.min(1400, detail.ms || 650)); break;
    case "assistant:error": M.error = String(detail.message || "").slice(0, 200); M.transient = { kind: "error", until: Date.now() + 2400 }; break;
    case "assistant:stopped": M.respondingUntil = 0; break;
    default: break;
  }
  update(ev);
}

function readBase() {
  const s = document.body && document.body.dataset.st;
  const b = BASE[s] || "idle";
  if (b !== M.base) {
    M.base = b;
    if ((b === "thinking" || b === "working") && M.transient && M.transient.kind === "error") M.transient = null;   /* a new request clears the old error */
    update({ type: "base", st: s });
  }
}

function boot() {
  readBase();
  new MutationObserver(readBase).observe(document.body, { attributes: true, attributeFilter: ["data-st"] });
}
if (document.body) boot(); else document.addEventListener("DOMContentLoaded", boot);

window.ChandraState = {
  get: snapshot,
  signal,
  subscribe(fn) { subs.add(fn); try { fn(snapshot(), { type: "init" }) } catch (e) { console.warn(e) } return () => subs.delete(fn); },
  labels: LABEL
};
/* @end state.bus */
})();
