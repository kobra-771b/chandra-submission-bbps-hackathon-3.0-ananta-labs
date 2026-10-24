/* ============ Target cursor: the React Bits reticle, on every part of Chandra ============
   A vanilla-JS port of the React Bits "TargetCursor" component: the spinning corner reticle and centre dot
   replace the pointer, and the corners snap onto whatever component is under it, with springs, a quarter-
   turn lock, parallax, click squeeze and a label. Original: React Bits by David Haz, https://reactbits.dev
   (MIT + Commons Clause, Copyright (c) 2026 David Haz; see THIRD-PARTY-NOTICES.md). The motion code
   (springs, constants, lock and spin logic) follows the original line for line.

   Where it appears: only over the apps Chandra makes (sandboxed HTML previews in the artifact panel, the
   full view and file previews). Everywhere else Chandra keeps its own supplied Mac cursors.

   What Chandra adds, deliberately:
   - Inside an app preview any element is a target; its label names it and its source line.
   - Text fields keep the system I-beam (you need to see where you type); the reticle still frames them.
   - Holding Shift relabels the target "Shift + right-click: line N"; that opens the app's source there.
   - Sandboxed previews run in iframes the page cannot reach into. They post their pointer and the element
     under it (see artifact-render.js); feed() turns that into a target in page coordinates.
   - Fine pointers with hover only; touch, pens and coarse pointers keep the normal pointer. Reduced motion
     stops the spin and makes the springs settle at once. Settings can switch it off; Lite mode starts off.
   - The overlay is aria-hidden and pointer-events:none: it can never take a click or focus. */
(function () {
"use strict";
/* @src cursor.target: Target cursor overlay (ported React Bits TargetCursor) + any-component targeting */
const CORNER_ANGLES = [0, 90, 180, 270];
const QUARTER = Math.PI / 2;
const KEY = "chandra-precision-cursor";
const spring = (state, goal, stiffness, damping, dt) => {
  const steps = 2;
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    state.v += (stiffness * (goal - state.x) - damping * state.v) * h;
    state.x += state.v * h;
  }
};
/* any component Chandra draws; the innermost match under the pointer wins */
const TARGETS = ["[data-cursor-target]", "[data-artifact-id]", "button", "a[href]", "input", "textarea", "select", "summary", "label",
  "[role=button]", "[role=tab]", "[role=switch]", "[role=menuitem]", "[role=radio]", "[role=option]", "[tabindex]:not([tabindex='-1'])",
  ".chip", ".pill", ".btn", ".ib", ".av", ".g", ".card", ".row", ".comp", ".stage", ".orb", ".owl", ".toast", ".sheet", ".acode", ".aln",
  "img", "canvas", "video", "audio", "pre", "table", "h1", "h2", "h3", ".art-card", ".fp-body", "#tx > *"].join(",");
const NOT_TARGET = "html,body,main,#sky,.aura,.stars,#eclipse-orbit,.target-cursor,.target-cursor *";
const TEXTY = "input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]):not([type=file]),textarea,[contenteditable=true],[contenteditable='']";
const NAMES = { comp: "Composer", inp: "Message", thr: "Chats", nav: "Navigation", hero: "Chandra", orb: "Speaking light", owl: "Owl",
  top: "Top bar", tx: "Conversation", sug: "Suggestions", artp: "Artifact", artfull: "Artifact", menu: "Menu", windowChrome: "Window" };
const OPTS = { cursorColor: "#eef2ff", cursorColorOnTarget: "#a8d4ff", spinDuration: 2, busySpin: 0.9, hoverDuration: 0.2,
  parallaxOn: true, size: 36, cornerSize: 12, thickness: 2.5, padding: 6, matchRadius: true, dotSize: 4, showLabel: true, clickEffect: true };
const CLASSIC = { cursorColor: "#dfe3ea", cursorColorOnTarget: "#c9d3e6" };

function labelFor(el, shift) {
  if (!el) return "";
  if (shift) return el.getAttribute("data-cursor-label-shift") || "Shift + right-click: source";
  const own = el.getAttribute("data-cursor-label") || el.getAttribute("aria-label") || el.getAttribute("data-tip") || el.getAttribute("title") ||
    el.getAttribute("placeholder") || el.getAttribute("alt");
  if (own) return own.trim().slice(0, 40);
  if (el.id && NAMES[el.id]) return NAMES[el.id];
  const t = (el.innerText || el.textContent || "").trim().replace(/\s+/g, " ");
  if (t && t.length <= 32 && !el.matches(".g,.card,.sheet,table,pre,.acode")) return t;
  const named = el.closest("[id]");
  return named && NAMES[named.id] ? NAMES[named.id] : "";
}

function create(o) {
  const root = document.createElement("div");
  root.className = "target-cursor"; root.setAttribute("aria-hidden", "true"); root.style.opacity = "0";
  const corners = CORNER_ANGLES.map(() => { const s = document.createElement("span"); s.className = "target-cursor__corner"; root.append(s); return s; });
  const dot = document.createElement("span"); dot.className = "target-cursor__dot"; root.append(dot);
  const labelEl = document.createElement("span"); labelEl.className = "target-cursor__label"; root.append(labelEl);
  document.body.append(root);
  const html = document.documentElement;
  const mq = matchMedia("(prefers-reduced-motion: reduce)");
  const reduce = () => mq.matches || document.body.classList.contains("rm");

  const pointer = { x: 0, y: 0, inside: false, seen: false, pressed: false, shift: false, texty: false };
  const centerX = { x: 0, v: 0 }, centerY = { x: 0, v: 0 }, halfW = { x: 0, v: 0 }, halfH = { x: 0, v: 0 }, radius = { x: 0, v: 0 },
    turn = { x: 0, v: 0 }, lock = { x: 0, v: 0 }, press = { x: 0, v: 0 }, presence = { x: 0, v: 0 };
  let target = null, targetRadius = 0, quarter = 0, spinSpeed = 0, raf = 0, last = 0, lastLabel = "", lastColor = "", tick = 0;
  /* a target inside a sandboxed preview: {frame, rect (page coords), radius, label, shiftLabel, texty} */
  let remote = null;

  const hideCursor = () => html.classList.toggle("tc-hide", pointer.inside && !pointer.texty);
  const usable = el => el && !el.matches(NOT_TARGET) && el.getClientRects().length > 0;
  const findTarget = (x, y, element) => {
    const node = element || document.elementFromPoint(x, y);
    if (node && node.tagName === "IFRAME" && remote && remote.frame === node) return node;
    const found = node && node.closest ? node.closest(TARGETS) : null;
    return usable(found) ? found : null;
  };
  const lockOn = next => {
    if (next === target) return;
    target = next;
    if (target) {
      quarter = Math.round(turn.x / QUARTER);
      targetRadius = remote && target === remote.frame ? remote.radius || 0 : parseFloat(getComputedStyle(target).borderTopLeftRadius) || 0;
      spinSpeed = 0;
    }
  };
  const rectOf = t => remote && t === remote.frame ? remote.rect : t.getBoundingClientRect();

  function frame(now) {
    raf = 0;
    const s = o;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    const snap = reduce();
    if (target && !target.isConnected) lockOn(null);
    /* something may have opened over the target while the pointer stood still */
    if (target && pointer.inside && !remote && ++tick % 8 === 0 && findTarget(pointer.x, pointer.y) !== target) lockOn(findTarget(pointer.x, pointer.y));
    const rect = target ? rectOf(target) : null;
    const locked = !!rect && pointer.inside;
    const snapW = 4.6 / s.hoverDuration, snapK = snapW * snapW, snapC = 2 * 0.62 * snapW;
    const sp = (st, g, k, c) => { if (snap) { st.x = g; st.v = 0; } else spring(st, g, k, c, dt); };

    sp(presence, pointer.inside ? 1 : 0, 260, 32);
    sp(lock, locked ? 1 : 0, snapK, 2 * snapW);
    sp(press, pointer.pressed && s.clickEffect ? 1 : 0, 900, 40);

    let goalX = pointer.x, goalY = pointer.y, goalW = s.size / 2, goalH = s.size / 2, goalR = Math.min(2, s.cornerSize / 4);
    if (locked) {
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2, lean = s.parallaxOn && !snap ? 0.08 : 0;
      goalX = cx + (pointer.x - cx) * lean;
      goalY = cy + (pointer.y - cy) * lean;
      const odd = Math.abs(quarter) % 2 === 1;
      const w = rect.width / 2 + s.padding, h = rect.height / 2 + s.padding;
      goalW = odd ? h : w; goalH = odd ? w : h;
      goalR = s.matchRadius ? Math.min(targetRadius + Math.max(0, s.padding), s.cornerSize) : 0;
    }
    if (!pointer.inside && presence.x < 0.01) pointer.seen = false;
    if (!pointer.seen) { centerX.x = goalX; centerY.x = goalY; halfW.x = goalW; halfH.x = goalH; pointer.seen = pointer.inside; }
    const follow = locked ? snapK : 2200, followC = locked ? snapC : 2 * Math.sqrt(2200);
    sp(centerX, goalX, follow, followC); sp(centerY, goalY, follow, followC);
    sp(halfW, goalW, snapK, snapC); sp(halfH, goalH, snapK, snapC);
    sp(radius, goalR, snapK, 2 * snapW);
    if (locked) sp(turn, quarter * QUARTER, snapK, snapC);
    else {
      const dur = html.dataset.wait ? s.busySpin : s.spinDuration;
      const speed = dur > 0 && !snap ? (Math.PI * 2) / dur : 0;
      spinSpeed += (speed - spinSpeed) * (1 - Math.exp(-dt * 3));
      turn.v = spinSpeed;
      turn.x += spinSpeed * dt;
    }

    const squeeze = 1 - press.x * 0.14, cos = Math.cos(turn.x), sin = Math.sin(turn.x);
    const w = Math.max(0, halfW.x) * squeeze, h = Math.max(0, halfH.x) * squeeze;
    const local = [[-w, -h], [w, -h], [w, h], [-w, h]];
    const r = Math.max(0, Math.min(radius.x, s.cornerSize)), degrees = (turn.x * 180) / Math.PI;
    let left = Infinity, top = Infinity;
    corners.forEach((corner, i) => {
      const [lx, ly] = local[i];
      const x = centerX.x + lx * cos - ly * sin, y = centerY.x + lx * sin + ly * cos;
      left = Math.min(left, x); top = Math.min(top, y);
      corner.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${(CORNER_ANGLES[i] + degrees).toFixed(2)}deg)`;
      corner.style.width = corner.style.height = `${s.cornerSize}px`;
      corner.style.borderWidth = `${s.thickness}px 0 0 ${s.thickness}px`;
      corner.style.borderTopLeftRadius = `${r.toFixed(2)}px`;
    });
    const dotScale = (1 - press.x * 0.35) * (pointer.texty ? 0 : 1);
    dot.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0) translate(-50%, -50%) scale(${dotScale.toFixed(3)})`;
    dot.style.width = dot.style.height = `${s.dotSize}px`;

    const text = s.showLabel && target ? (remote && target === remote.frame ? (pointer.shift ? remote.shiftLabel : remote.label) || "" : labelFor(target, pointer.shift)) : "";
    if (text && text !== lastLabel) labelEl.textContent = text;
    if (text) lastLabel = text;
    const shown = text ? Math.max(0, Math.min(1, lock.x)) : 0;
    labelEl.style.transform = `translate3d(${left.toFixed(2)}px, ${(top - 8).toFixed(2)}px, 0) translateY(-100%) translateY(${((1 - shown) * 4).toFixed(2)}px)`;
    labelEl.style.opacity = shown.toFixed(3);

    const mix = s.cursorColorOnTarget ? Math.round(Math.max(0, Math.min(1, lock.x)) * 100) : 0;
    const color = mix ? `color-mix(in oklab, ${s.cursorColorOnTarget} ${mix}%, ${s.cursorColor})` : s.cursorColor;
    if (color !== lastColor) { root.style.setProperty("--target-cursor-color", color); lastColor = color; }
    root.style.opacity = Math.max(0, Math.min(1, presence.x)).toFixed(3);

    const resting = !pointer.inside && presence.x < 0.002 && Math.abs(presence.v) < 0.002 && Math.abs(lock.x) < 0.002 && Math.abs(press.x) < 0.002;
    const spinning = pointer.inside && !locked && spinSpeed > 0.0001;
    const moving = Math.abs(centerX.v) + Math.abs(centerY.v) + Math.abs(halfW.v) + Math.abs(halfH.v) + Math.abs(turn.v) > 0.01 ||
      Math.abs(goalX - centerX.x) + Math.abs(goalY - centerY.x) > 0.05 || Math.abs(lock.v) + Math.abs(press.v) + Math.abs(presence.v) > 0.001;
    if (!resting && (spinning || moving || locked)) raf = requestAnimationFrame(frame);
    else last = 0;
  }
  const wake = () => { if (!raf) raf = requestAnimationFrame(frame); };

  /* In Chandra's own UI the pointer is Chandra's own Mac cursor: the reticle only lives over the apps Chandra
     makes (their sandboxed previews feed it, see feed() below). Moving over the page itself hides it. */
  const onMove = e => {
    if (!remote && !pointer.inside) return;
    remote = null; pointer.inside = false; pointer.pressed = false; pointer.texty = false;
    lockOn(null); hideCursor(); wake();
  };
  const onDown = () => {};
  const onUp = () => {};
  const onLeave = () => { pointer.inside = false; pointer.pressed = false; remote = null; lockOn(null); hideCursor(); wake(); };
  const onScroll = () => {};
  const onKey = e => { if (e.key === "Shift" && pointer.shift !== (e.type === "keydown")) { pointer.shift = e.type === "keydown"; wake(); } };
  const onBlur = () => { pointer.shift = false; if (!remote) onLeave(); };
  addEventListener("pointermove", onMove, { passive: true });
  addEventListener("pointerdown", onDown, { passive: true });
  addEventListener("pointerup", onUp, { passive: true });
  addEventListener("scroll", onScroll, { passive: true, capture: true });
  addEventListener("resize", onScroll, { passive: true });
  addEventListener("keydown", onKey); addEventListener("keyup", onKey);
  document.documentElement.addEventListener("pointerleave", onLeave);
  addEventListener("blur", onBlur);
  return {
    /* a pointer report from a sandboxed preview, already in the frame's own coordinates */
    feed(frameEl, m) {
      if (!frameEl || !frameEl.isConnected) return;
      if (m.type === "press") { pointer.pressed = !!m.pressed; wake(); return; }
      const box = frameEl.getBoundingClientRect();
      if (m.inside === false) { if (remote && remote.frame === frameEl) { remote = null; pointer.inside = false; lockOn(null); hideCursor(); wake(); } return; }
      pointer.x = box.left + (+m.x || 0); pointer.y = box.top + (+m.y || 0); pointer.inside = true; pointer.texty = !!m.texty;
      if (typeof m.shift === "boolean") pointer.shift = m.shift;
      if (typeof m.pressed === "boolean") pointer.pressed = m.pressed;
      html.classList.remove("tc-hide");                    /* the frame hides its own pointer */
      const r = m.rect;
      if (r && r.w > 0 && r.h > 0) {
        const rect = { left: box.left + Math.max(0, r.l), top: box.top + Math.max(0, r.t), width: Math.min(r.w, box.width), height: Math.min(r.h, box.height) };
        const fresh = !remote || remote.frame !== frameEl || remote.key !== m.key;
        remote = { frame: frameEl, rect, radius: +m.radius || 0, label: String(m.label || "").slice(0, 60), shiftLabel: String(m.shiftLabel || "").slice(0, 60), key: m.key };
        if (fresh) { target = null; lockOn(frameEl); }
      } else { remote = { frame: frameEl, rect: null, key: null }; lockOn(null); }
      wake();
    },
    get target() { return remote && target === remote.frame ? null : target; },
    destroy() {
      cancelAnimationFrame(raf);
      removeEventListener("pointermove", onMove); removeEventListener("pointerdown", onDown); removeEventListener("pointerup", onUp);
      removeEventListener("scroll", onScroll, { capture: true }); removeEventListener("resize", onScroll); removeEventListener("keydown", onKey); removeEventListener("keyup", onKey);
      document.documentElement.removeEventListener("pointerleave", onLeave); removeEventListener("blur", onBlur);
      html.classList.remove("tc-hide");
      root.remove();
    }
  };
}

let inst = null;
const fine = matchMedia("(hover: hover) and (pointer: fine)");
const wanted = () => { let v = null; try { v = localStorage.getItem(KEY) } catch (_) {} return v === "on"; };   /* opt-in: Options > Target cursor. Off by default (two cursors showed on some PCs) */
const opts = () => Object.assign({}, OPTS, document.documentElement.dataset.skin === "classic" ? CLASSIC : {});
function sync() {
  const on = fine.matches && wanted();
  if (on && !inst) inst = create(opts()); else if (!on && inst) { inst.destroy(); inst = null; }
  document.documentElement.classList.toggle("tc-on", !!inst);
  document.dispatchEvent(new CustomEvent("chandra:cursor", { detail: { on: !!inst } }));
}
fine.addEventListener("change", sync);
document.addEventListener("chandra:skin", () => { if (inst) { inst.destroy(); inst = null; sync(); } });
sync();
window.ChandraCursor = {
  get on() { return !!inst }, get wanted() { return wanted() }, get available() { return fine.matches },
  get target() { return inst ? inst.target : null },
  feed(frameEl, m) { if (inst) inst.feed(frameEl, m); },
  labelFor,
  TARGETS,
  set(on) { try { localStorage.setItem(KEY, on ? "on" : "off") } catch (_) {} sync(); }
};
/* @end cursor.target */
})();
