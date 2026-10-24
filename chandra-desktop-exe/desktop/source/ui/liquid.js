/* ============ Liquid glass: viscous colour flowing inside a glass panel ============
   Panels marked data-liquid (the composer, the voice bar) get a thick, slow liquid behind their glass: domain-warped
   noise in Chandra's Starlight palette, moving the way heavy liquid does, with a bright rim along the glass edge and
   a faint moving shine. One small WebGL2 canvas per panel, 30 frames a second at most, a still frame under Reduce
   motion, and paused while the panel is off screen. Without WebGL2 (or in Lite mode) a CSS version of the same
   colours flows instead. Original work for Chandra; no third-party code.
   Text stays readable: the liquid sits behind the content (z-index 0; the content is above it). */
(function () {
"use strict";
/* @src liquid.glass: viscous liquid behind glass panels (WebGL2 shader, CSS fallback) */
const VS = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`;
const FS = `#version 300 es
precision highp float;
uniform vec2 uPx;      // canvas size in device pixels
uniform vec2 uSize;    // panel size in CSS pixels
uniform float uRad;    // corner radius, CSS px
uniform float uT;      // time
uniform float uScale;  // device px per CSS px
out vec4 outColor;
float hsh(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hsh(i), hsh(i + vec2(1.0, 0.0)), f.x), mix(hsh(i + vec2(0.0, 1.0)), hsh(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return v; }
float sdRound(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r; }
void main() {
  vec2 css = gl_FragCoord.xy / uScale;          // CSS px, origin bottom-left
  vec2 c = css - uSize * 0.5;                   // centred on the panel
  float d = sdRound(c, uSize * 0.5 - 1.0, uRad); // < 0 inside the glass
  vec2 p = c / 150.0;                           // a thick, viscous scale
  float t = uT;
  vec2 q = vec2(fbm(p + vec2(0.0, t * 0.05)), fbm(p + vec2(5.2, 1.3) - vec2(t * 0.04, 0.0)));
  vec2 r = vec2(fbm(p + 3.5 * q + vec2(1.7, 9.2) + t * 0.03), fbm(p + 3.5 * q + vec2(8.3, 2.8) - t * 0.035));
  float f = fbm(p + 3.5 * r);
  vec3 deep = vec3(0.008, 0.016, 0.043), blue = vec3(0.239, 0.420, 1.0), ice = vec3(0.659, 0.831, 1.0), star = vec3(1.0, 0.953, 0.82);
  vec3 col = mix(deep, blue, smoothstep(0.25, 0.8, f));
  col = mix(col, ice, smoothstep(0.6, 0.95, f) * smoothstep(0.3, 0.8, r.x) * 0.75);
  col += star * smoothstep(0.86, 1.0, f) * 0.5;
  float rim = 1.0 - smoothstep(0.0, 9.0, -d);
  float shine = smoothstep(-44.0, -4.0, d) * (0.5 + 0.5 * sin(t * 0.4 + c.x * 0.02 - c.y * 0.015));
  col += vec3(0.75, 0.88, 1.0) * (rim * 0.55 + shine * 0.07);
  float a = (1.0 - smoothstep(-0.5, 0.5, d)) * (0.48 + 0.38 * f);
  a = max(a, rim * 0.6);
  outColor = vec4(col * a, a);                  // premultiplied
}`;
const SCALE = 0.75;       // render at 3/4 resolution: liquid doesn't need sharp pixels
const FPS = 30;
const lite = () => !!window.CHANDRA_LITE;
const still = () => (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) || document.body.classList.contains("rm");

function compile(gl, type, src) {
  const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
  if (gl.getShaderParameter(sh, gl.COMPILE_STATUS)) return sh;
  console.warn("[liquid] shader:", gl.getShaderInfoLog(sh)); gl.deleteShader(sh); return null;
}
function setup(el) {
  const cv = document.createElement("canvas");
  cv.className = "liquid-cv"; cv.setAttribute("aria-hidden", "true");
  el.prepend(cv);
  const gl = cv.getContext("webgl2", { premultipliedAlpha: true, alpha: true, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
  const vs = gl && compile(gl, gl.VERTEX_SHADER, VS), fs = gl && compile(gl, gl.FRAGMENT_SHADER, FS);
  const prog = gl && vs && fs && gl.createProgram();
  if (!prog) { cv.remove(); return null; }
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { cv.remove(); return null; }
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.useProgram(prog);
  const u = {}; ["uPx", "uSize", "uRad", "uT", "uScale"].forEach(n => u[n] = gl.getUniformLocation(prog, n));
  return { el, cv, gl, u, t: Math.random() * 40, raf: 0, last: 0, visible: true, dead: false };
}
function fit(L) {
  const r = L.el.getBoundingClientRect(), w = Math.max(2, Math.round(r.width * SCALE)), h = Math.max(2, Math.round(r.height * SCALE));
  if (L.cv.width !== w || L.cv.height !== h) { L.cv.width = w; L.cv.height = h; L.gl.viewport(0, 0, w, h); }
  L.w = r.width; L.h = r.height;
  const rad = parseFloat(getComputedStyle(L.el).borderTopLeftRadius) || 22;
  L.rad = Math.min(rad, r.height / 2);
}
function paint(L) {
  const gl = L.gl;
  gl.uniform2f(L.u.uPx, L.cv.width, L.cv.height);
  gl.uniform2f(L.u.uSize, L.w, L.h);
  gl.uniform1f(L.u.uRad, L.rad);
  gl.uniform1f(L.u.uT, L.t);
  gl.uniform1f(L.u.uScale, L.cv.width / L.w);
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
function frame(L, now) {
  L.raf = 0;
  if (L.dead || !L.visible || document.hidden) return;
  if (now - L.last < 1000 / FPS) { L.raf = requestAnimationFrame(n => frame(L, n)); return; }
  L.t += Math.min(0.1, (now - (L.last || now)) / 1000); L.last = now;
  fit(L); paint(L);
  L.raf = requestAnimationFrame(n => frame(L, n));
}
function fallback(el) { el.classList.add("liquid-fb"); }

const panels = new Map();
function attach(el) {
  if (panels.has(el) || lite()) { if (lite()) fallback(el); return; }
  const L = setup(el);
  if (!L) { fallback(el); return; }
  panels.set(el, L);
  fit(L);
  if (still()) { paint(L); return; }
  new ResizeObserver(() => { fit(L); if (still()) paint(L); }).observe(el);
  new IntersectionObserver(es => { L.visible = es.some(e => e.isIntersecting); if (L.visible && !L.raf && !still()) L.raf = requestAnimationFrame(n => frame(L, n)); }).observe(el);
  L.raf = requestAnimationFrame(n => frame(L, n));
}
function start() { document.querySelectorAll("[data-liquid]").forEach(attach); }
if (document.readyState === "loading") addEventListener("DOMContentLoaded", start); else start();
addEventListener("resize", () => panels.forEach(L => { if (!L.dead) fit(L); }));
document.addEventListener("visibilitychange", () => panels.forEach(L => { if (!document.hidden && !L.raf && !still() && L.visible) L.raf = requestAnimationFrame(n => frame(L, n)); }));
window.ChandraLiquid = { attach, get panels() { return panels.size; } };
/* @end liquid.glass */
})();
