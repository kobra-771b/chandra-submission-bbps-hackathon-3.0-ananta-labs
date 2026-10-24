/* ============ Voice first (1.7) ============
   Talking is the main way in; typing is there when you want it.
   - The moon is the talk button: tap to start or stop a conversation, hold to talk (push-to-talk).
   - Hold Space anywhere (outside a text field) to talk; Ctrl+Space toggles a conversation.
   - A ring around the moon follows your voice while Chandra listens.
   - Captions: what you said, small; what Chandra says, large, the sentence being spoken lit up.
   - English, Hindi or Hinglish from one switch under the greeting.
   - Start typing anywhere and the composer takes the keys.
   Reads the voice module through window.chandraVoice and the state bus; changes nothing about what a reply does. */
(function () {
"use strict";
/* @src voicefirst.home: talk button, push-to-talk, listening ring, captions, language switch */
const $ = (s, r) => (r || document).querySelector(s);
const home = $("#home"), stage = $("#home .stage");
const V = () => window.chandraVoice;
if (!home || !stage) return;
const E = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const hi = () => V() && V().lang === "hi-IN";
const typing = el => !!(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)));
const blocked = () => !!$("#ob.on,#lg.on,.ov.on,#shs.on") || !home.classList.contains("on");

/* ---------- the moon is the talk button ---------- */
stage.setAttribute("role", "button"); stage.tabIndex = 0;
const ring = document.createElement("div"); ring.className = "vring"; ring.setAttribute("aria-hidden", "true"); stage.append(ring);
const label = () => V() && V().awake ? (hi() ? "बातचीत रोकें" : "Stop talking to Chandra") : (hi() ? "चंद्र से बात करें" : "Talk to Chandra");
let holdT = 0, held = false, downAt = 0;
stage.addEventListener("pointerdown", e => {
  if (e.button !== 0 || e.target.closest("button,a,input")) return;
  downAt = Date.now(); held = false;
  clearTimeout(holdT); holdT = setTimeout(() => { held = true; V() && V().ptt(true); }, 320);   /* hold: push-to-talk */
});
const release = () => { clearTimeout(holdT); if (held) { held = false; V() && V().ptt(false); } };
stage.addEventListener("pointerup", e => {
  if (!downAt) return; const wasHeld = held; release(); downAt = 0;
  if (wasHeld || e.target.closest("button,a,input")) return;
  const v = V(); if (!v) return; v.awake ? v.end() : v.begin("voice");                         /* tap: start or stop */
});
stage.addEventListener("pointerleave", () => { if (downAt) { release(); downAt = 0; } });
stage.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); const v = V(); if (v) v.awake ? v.end() : v.begin("voice"); } });

/* ---------- hold Space to talk ---------- */
let spaceDown = false;
addEventListener("keydown", e => {
  if (e.code !== "Space" || e.ctrlKey || e.metaKey || e.altKey || typing(document.activeElement) || blocked()) return;
  if (document.activeElement === stage) return;
  e.preventDefault();
  if (!e.repeat && !spaceDown) { spaceDown = true; V() && V().ptt(true); }
}, true);
addEventListener("keyup", e => { if (e.code === "Space" && spaceDown) { spaceDown = false; e.preventDefault(); V() && V().ptt(false); } }, true);
addEventListener("blur", () => { if (spaceDown) { spaceDown = false; V() && V().ptt(false); } });

/* ---------- start typing anywhere: the composer takes the keys ---------- */
addEventListener("keydown", e => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1 || e.key === " " || typing(document.activeElement) || blocked()) return;
  const inp = $("#inp"); if (inp) inp.focus();
});

/* ---------- state, ring and greeting line ---------- */
const sub = $("#idle p") || $("#idle .mu");
const hint = () => hi() ? "बात करने के लिए चाँद दबाएँ, या Space दबाए रखें" : "Tap the moon or hold Space to talk";
function paint() {
  const ph = (window.ChandraState && ChandraState.get().phase) || "idle";
  const ear = window.ChandraEar && ChandraEar.state;
  const st = ph === "listening" ? (ear === "hearing" ? "hearing" : ear === "heard" ? "heard" : "listening") : ph;
  home.dataset.voice = st;
  stage.setAttribute("aria-label", label());
  if (sub && !sub.dataset.vf) { sub.dataset.vf = 1; }
  if (sub) sub.textContent = st === "listening" ? (hi() ? "सुन रहा हूँ… बोलिए" : "Listening… go ahead")
    : st === "hearing" ? (hi() ? "सुन रहा हूँ…" : "Listening…") : st === "heard" ? (hi() ? "समझ रहा हूँ…" : "Got it…")
    : st === "thinking" || st === "working" ? (hi() ? "सोच रहा हूँ…" : "Thinking…") : st === "speaking" ? (hi() ? "बोल रहा हूँ · टोकने के लिए बोलिए" : "Speaking · just talk to interrupt")
    : hint();
}
let raf = 0, lvl = 0;
function loop() {
  raf = 0;
  const v = V(), on = v && v.awake;
  let target = 0;
  if (on && window.ChandraEar && ChandraEar.on) target = ChandraEar.level;
  else if (on && window.ChandraPresence) target = ChandraPresence.level || 0;
  lvl += (target - lvl) * 0.35;
  stage.style.setProperty("--lvl", lvl.toFixed(3));
  if (on || lvl > 0.01) raf = requestAnimationFrame(loop);
}
const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };

/* ---------- captions ---------- */
const jv = $("#jv");
const caps = document.createElement("div"); caps.id = "caps"; caps.setAttribute("aria-live", "polite");
caps.innerHTML = '<p class="cyou" id="cyou"></p><p class="csay" id="csay"></p>';
if (jv) jv.prepend(caps); else stage.after(caps);
let parts = [];
addEventListener("chandra:say", e => {
  const d = e.detail || {};
  if (d.parts !== parts) { parts = d.parts || []; $("#csay").innerHTML = parts.map((p, i) => `<span data-i="${i}">${E(p)}</span>`).join(" "); }
  $("#csay").querySelectorAll("span").forEach(s => s.classList.toggle("now", +s.dataset.i === d.i));
  $("#csay").querySelectorAll("span").forEach(s => s.classList.toggle("said", +s.dataset.i < d.i));
  caps.classList.add("on"); jv && jv.classList.add("captioning");
});
addEventListener("chandra:ear", e => {
  const d = e.detail || {};
  if (d.state === "text") { $("#cyou").textContent = ""; }   /* a conversation, not a transcript: the person's words are not shown back */
  paint(); kick();
});
if (window.ChandraState && ChandraState.subscribe) ChandraState.subscribe(s => {
  paint(); kick();
  if (s && s.phase === "speaking") return;
  /* when the voice is done, the last sentence stays lit a moment, then all of it reads as said */
  if (parts.length) setTimeout(() => $("#csay").querySelectorAll("span").forEach(x => { x.classList.remove("now"); x.classList.add("said"); }), 600);
});
/* a typed request clears the captions; the reply card shows it as before */
const go = $("#go"); if (go) go.addEventListener("click", () => { caps.classList.remove("on"); jv && jv.classList.remove("captioning"); $("#cyou").textContent = ""; $("#csay").textContent = ""; parts = []; }, true);

/* ---------- English, Hindi or Hinglish ---------- */
const stat = $("#hstat");
const sw = document.createElement("div"); sw.className = "langsw";
function paintLang() { const L = window.ChandraLangs; if (!L || sw.firstChild) { const s = sw.querySelector("select"); if (s && L) s.value = L.current(); return; } sw.append(L.make("langdd")); }
if (stat) stat.append(sw); else home.prepend(sw);

/* approvals and progress keep the full card; only a plain reply becomes captions */
if (jv) { const jvc = $("#jvc"); const asks = () => jv.classList.toggle("asks", !!(jvc && [...jvc.querySelectorAll("button")].some(b => /^(Allow|Always allow|Deny|Accept|Hold back)/.test(b.textContent.trim()))));
  if (jvc) new MutationObserver(asks).observe(jvc, { childList: true, subtree: true }); asks(); }
paintLang(); paint();
window.ChandraVoiceFirst = { paint, captions: caps };
/* @end voicefirst.home */
})();
