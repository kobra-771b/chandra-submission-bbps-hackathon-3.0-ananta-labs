/* ============ Speech in, in Chandra's window (1.0.1) ============
   WebView2 has no speech service: its SpeechRecognition fails with "network" and never hears anything, and the page
   restarted it every 300 ms. In Chandra's window the page's recogniser (the "Chandra" wake word, and listening without
   a Gemini key) is Windows' own offline recogniser, run by the host (WinEar in chandra.py), with the same events.
   After errors the next start waits longer, up to 15 s, so a missing microphone cannot spin.
   When Windows itself blocks the microphone, Chandra says so and opens the right Settings page, once. */
(function () {
"use strict";
/* @src speech.in: SpeechRecognition on Windows' recogniser, and plain reasons when the microphone is blocked */
if (!window.CHANDRA_NATIVE) return;
const api = () => window.pywebview && pywebview.api;
const ready = () => window.chandraNativeReady || Promise.resolve(!!api());
const say = (a, b) => setTimeout(() => { try { window.toast(a, b); } catch (_) {} }, 60);   /* after the page's own toast */
const EVENTS = ["start", "end", "error", "result", "nomatch", "audiostart", "audioend", "soundstart", "soundend", "speechstart", "speechend"];
const recs = {};
let seq = 0, fails = 0, notice = "", settingsOpened = false;
const list = a => { a.item = i => a[i]; return a; };

function windowsBlocked(why) {
  say("Windows is blocking the microphone", why + " Turn it on in the Settings page that just opened, then try again.");
  if (!settingsOpened) { settingsOpened = true; try { api().mic_settings(); } catch (_) {} }
}

function finish(r) {
  const id = r._id;
  if (!id) return;
  delete recs[id]; r._id = null; r._sent = false;
  r._fire("end");
}

function SR() {
  this.lang = ""; this.continuous = false; this.interimResults = false; this.maxAlternatives = 1;
  this._ls = {}; this._id = null; this._t = 0; this._sent = false; this._res = [];
  EVENTS.forEach(t => { this["on" + t] = null; });
}
SR.prototype.addEventListener = function (t, f) { (this._ls[t] = this._ls[t] || []).push(f); };
SR.prototype.removeEventListener = function (t, f) { this._ls[t] = (this._ls[t] || []).filter(g => g !== f); };
SR.prototype._fire = function (t, e) {
  e = e || {}; e.type = t; e.target = this;
  (this._ls[t] || []).slice().forEach(f => { try { f.call(this, e); } catch (_) {} });
  const h = this["on" + t];
  if (h) try { h.call(this, e); } catch (_) {}
};
SR.prototype.start = function () {
  if (this._id) throw new DOMException("recognition has already started", "InvalidStateError");
  const me = this, id = "w" + (++seq), wait = fails ? Math.min(15000, 1000 * Math.pow(2, fails - 1)) : 0;
  me._id = id; me._res = []; recs[id] = me;
  me._t = setTimeout(() => {
    me._t = 0;
    ready().then(ok => {
      if (me._id !== id) return;
      const a = api();
      if (!ok || !a || !a.sr_start) { window.__chandraSr(id, "error", "service-not-allowed"); window.__chandraSr(id, "end"); return; }
      me._sent = true;
      a.sr_start(id, String(me.lang || ""), !!me.interimResults, Math.max(1, +me.maxAlternatives || 1))
        .catch(() => { window.__chandraSr(id, "error", "audio-capture"); window.__chandraSr(id, "end"); });
    });
  }, wait);
};
function halt(me, how) {
  if (!me._id) return;
  if (me._sent) { try { api()[how](me._id); } catch (_) {} return; }           /* the host answers with "end" */
  clearTimeout(me._t); me._t = 0;
  setTimeout(() => finish(me), 0);
}
SR.prototype.stop = function () { halt(this, "sr_stop"); };
SR.prototype.abort = function () { halt(this, "sr_abort"); };

/* the host's events: start, speechstart, result {final, alts:[{t, c}]}, notice "why", error "code", end */
window.__chandraSr = function (id, ev, d) {
  const r = recs[id];
  if (!r) return;
  if (ev === "notice") { notice = String(d || ""); return; }
  if (ev === "start") { r._fire("start"); r._fire("audiostart"); return; }
  if (ev === "result") {
    fails = 0;
    const res = list((d.alts || []).map(a => ({ transcript: String(a.t || ""), confidence: +a.c || 0 })));
    res.isFinal = !!d.final;
    const L = r._res, i = L.length && !L[L.length - 1].isFinal ? L.length - 1 : L.length;
    L[i] = res;
    r._fire("result", { resultIndex: i, results: list(L.slice()) });
    return;
  }
  if (ev === "error") {
    if (d !== "no-speech") fails++;
    r._fire("error", { error: d, message: notice });
    if (notice) {
      if (d === "not-allowed") windowsBlocked(notice);
      else say(d === "service-not-allowed" ? "The wake word needs Windows speech recognition" : "Chandra can't hear you", notice);
      notice = "";
    }
    return;
  }
  if (ev === "end") { finish(r); return; }
  r._fire(ev);
};
[["SpeechRecognition", SR], ["webkitSpeechRecognition", SR]].forEach(p => {
  try { Object.defineProperty(window, p[0], { value: p[1], configurable: true, writable: true }); } catch (_) { window[p[0]] = p[1]; }
});

/* the microphone itself (Gemini listening, double-clap): the page only knew "blocked"; say why, and what to do */
const md = navigator.mediaDevices;
if (md && md.getUserMedia) {
  const gum = md.getUserMedia.bind(md);
  let toldAt = 0;
  md.getUserMedia = function (c) {
    return gum(c).catch(async e => {
      if (c && c.audio && Date.now() - toldAt > 15000) {
        toldAt = Date.now();
        let why = "";
        try { await ready(); why = ((await api().mic_check()) || {}).blocked || ""; } catch (_) {}
        if (why) windowsBlocked(why);
        else if (e && e.name === "NotFoundError") say("No microphone found", "Plug one in or turn it on, then try again.");
        else if (e && e.name === "NotReadableError") say("The microphone is busy", "Another app is holding it. Close that app, then try again.");
      }
      throw e;
    });
  };
}
/* @end speech.in */
})();
