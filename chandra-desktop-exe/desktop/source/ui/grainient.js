/* ============ Grainient: Chandra's placeholder art ============
   A vanilla-JS port of the React Bits "Grainient" background (WebGL2 + GLSL). The field and grain shaders
   and the OKLab colour maths are the supplied ones, unchanged. What is different, and why:
   - Chandra paints many placeholders (artifact covers, missing images, the avatar), and a page may hold only
     about 16 WebGL contexts. So there is ONE shared offscreen renderer that paints still frames on request
     and hands back data: URLs, cached by key. No placeholder keeps a context or a loop.
   - The "random" colours are Chandra's own: each placeholder picks one of the Starlight combos below, with
     an angle, type, band count and variation drawn from a seed. Give it the same seed (an artifact id, a
     file name) and you get the same picture again, so a card never changes colour between visits.
   - Without WebGL2 a canvas-2D gradient in the same colours stands in.
   - Mouse-sensitive: the placeholder under the pointer comes alive (stir and twirl, below), on the same
     shared context, and returns to its still frame afterwards.

   Original component: React Bits by David Haz, https://reactbits.dev (MIT + Commons Clause).
   Copyright (c) 2026 David Haz. See THIRD-PARTY-NOTICES.md. */
(function () {
"use strict";
/* @src starlight.grainient: Grainient still renderer and Chandra's seeded colour combos (placeholders) */
const MAX_COLORS = 8;
const TYPES = { linear: 0, radial: 1 };

const VERTEX = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FIELD = `#version 300 es
precision highp float;
precision highp int;
uniform float uAspect;
uniform float uTime;
uniform vec3 uRamp[8];
uniform int uCount;
uniform int uType;
uniform vec2 uDir;
uniform float uExtent;
uniform float uBands;
uniform float uSoftness;
uniform float uFlow;
uniform float uScale;
uniform float uSilk;
uniform vec4 uStir[24];
uniform float uStirWeight[24];
uniform vec4 uTwirl[4];
uniform vec2 uSeed;
uniform float uContrast;
uniform float uSaturation;
uniform float uSettle;
uniform float uReveal;
in vec2 vUv;
out vec4 outColor;

vec2 hash2(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.103, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy) * 2.0 - 1.0;
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(hash2(i), f);
  float b = dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
  float c = dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
  float d = dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));
  return 0.5 + 0.5 * mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

vec2 drift(vec2 p, float t) {
  vec2 w1 = vec2(
    noise(p * 0.85 + vec2(t * 0.11, t * 0.07)),
    noise(p * 0.85 + vec2(4.1, 1.7) - vec2(t * 0.08, t * 0.12))
  );
  vec2 w2 = vec2(
    noise(p * 1.55 + w1 * 1.8 + vec2(1.3, 7.1) + t * 0.05),
    noise(p * 1.55 + w1 * 1.8 + vec2(6.4, 2.2) - t * 0.06)
  );
  return (w1 - 0.5) * 1.1 + (w2 - 0.5) * 0.55;
}

vec2 warp(vec2 p) {
  vec2 q = p / uScale;
  if (uType == 1) {
    float turn = uTime * 0.35;
    q = mat2(cos(turn), sin(turn), -sin(turn), cos(turn)) * q;
  } else {
    q += vec2(-uDir.y, uDir.x) * uTime * 0.45;
  }
  return p + drift(q + uSeed, uTime) * uFlow * uScale * uSettle;
}

float coord(vec2 p) {
  vec2 w = warp(p);
  return uType == 1 ? 1.0 - length(w) * 1.1 : dot(w, uDir) / uExtent + 0.5;
}

vec3 labToRgb(vec3 lab) {
  float l = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
  float m = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
  float s = lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z;
  l = l * l * l;
  m = m * m * m;
  s = s * s * s;
  return vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
}

vec3 encode(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
  for (int i = 0; i < 24; i++) {
    float w = uStirWeight[i];
    if (w <= 0.0) continue;
    vec2 d = p - uStir[i].xy;
    p -= uStir[i].zw * w * exp(-dot(d, d) / 0.045);
  }
  for (int i = 0; i < 4; i++) {
    float angle = uTwirl[i].z;
    if (angle == 0.0) continue;
    vec2 d = p - uTwirl[i].xy;
    float a = angle * exp(-dot(d, d) / (uTwirl[i].w * uTwirl[i].w));
    float c = cos(a);
    float s = sin(a);
    p = uTwirl[i].xy + mat2(c, -s, s, c) * d;
  }
  float raw = coord(p);
  float s = raw;
  if (uBands > 1.0) {
    s *= uBands;
    float cycle = floor(s);
    s = fract(s);
    if (mod(cycle, 2.0) > 0.5) s = 1.0 - s;
  }
  s = clamp(s, 0.0, 1.0);
  float scaled = s * float(uCount - 1);
  int index = int(min(floor(scaled), float(uCount - 2)));
  float f = scaled - float(index);
  float edge = max(uSoftness * 0.5, fwidth(scaled) * 0.75);
  float shaped = smoothstep(0.5 - edge, 0.5 + edge, f);
  vec3 from = uRamp[0];
  vec3 to = uRamp[1];
  for (int i = 0; i < 7; i++) {
    if (i == index) {
      from = uRamp[i];
      to = uRamp[i + 1];
    }
  }
  vec3 lab = mix(from, to, shaped);
  if (uSilk > 0.0) {
    vec2 grad = vec2(coord(p + vec2(0.004, 0.0)) - raw, coord(p + vec2(0.0, 0.004)) - raw) / 0.004;
    vec2 slope = grad * sin(3.14159265 * clamp(raw, 0.0, 1.0) * uBands) * uSilk * 4.0;
    vec3 normal = normalize(vec3(-slope, 1.0));
    vec3 light = normalize(vec3(-uDir.y, uDir.x, 1.2));
    float diffuse = dot(normal, light) - light.z;
    lab = uRamp[0] + (lab - uRamp[0]) * (1.0 + (diffuse * 0.35 + max(diffuse, 0.0) * diffuse * 0.6) * uSilk);
  }
  lab = mix(uRamp[0], lab, smoothstep(0.0, 1.0, uReveal * 1.5 - length(vUv - 0.5) * 0.6));
  lab.x = (lab.x - 0.55) * uContrast + 0.55;
  lab.yz *= uSaturation;
  outColor = vec4(encode(labToRgb(lab)), 1.0);
}`;

const COMPOSITE = `#version 300 es
precision highp float;
uniform sampler2D uField;
uniform float uGrain;
uniform float uGrainSize;
uniform float uFrame;
in vec2 vUv;
out vec4 outColor;

float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

float clump(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

void main() {
  vec3 color = texture(uField, vUv).rgb;
  vec2 pixel = gl_FragCoord.xy + uFrame * vec2(17.0, 59.0);
  float fine = hash(pixel) + hash(pixel + 7.13) - 1.0;
  float coarse = (clump(pixel / max(uGrainSize, 1.0)) - 0.5) * 2.0;
  float grain = mix(fine, coarse, clamp(uGrainSize - 1.0, 0.0, 1.0) * 0.8);
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color += grain * uGrain * (0.45 + 2.2 * luma * (1.0 - luma));
  outColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}`;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const toLinear = value => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
const toLab = ([r, g, b]) => {
  const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  ];
};
const hexRgb = h => { h = String(h).replace('#', ''); if (h.length === 3) h = h.replace(/./g, c => c + c);
  const n = parseInt(h.slice(0, 6), 16) || 0; return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

/* Chandra's Starlight combos: deep space -> blue -> ice/periwinkle -> star white. Mostly blue; periwinkle is
   the accent, never the lead; the last stop is always a star colour (cool white or warm starlight). */
const COMBOS = [
  ['#02040b', '#0a1a4f', '#2f5bff', '#a8d4ff', '#fff3d1'],
  ['#03050d', '#13235e', '#5b7cff', '#8e8cff', '#f4f7ff'],
  ['#010309', '#081436', '#1e3fd8', '#38bdf8', '#e8f4ff'],
  ['#02060f', '#0b2a5c', '#3d6bff', '#6f95ff', '#dbe7ff'],
  ['#04040e', '#151a52', '#4457e8', '#a5b4ff', '#fff3d1'],
  ['#01040a', '#06204a', '#1d5bd6', '#7cc4ff', '#f6f8ff'],
  ['#03030b', '#101446', '#3d6bff', '#8e8cff', '#fff8e7'],
  ['#020510', '#0d1f5c', '#2a4dff', '#a8d4ff', '#f4f7ff']
];

/* small seeded PRNG (mulberry32) over a string hash (FNV-1a), so the same seed always draws the same art */
const hash = s => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = seed => { let a = hash(seed); return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

function recipe(seed) {
  const r = rng(seed == null ? Math.random() : seed);
  const colors = COMBOS[Math.floor(r() * COMBOS.length)].slice();
  return {
    colors, type: r() < 0.3 ? 'radial' : 'linear', angle: Math.round(r() * 360), bands: r() < 0.25 ? 2 : 1,
    flow: 0.6 + r() * 0.9, scale: 0.8 + r() * 0.6, softness: 0.85 + r() * 0.15, silk: 0.2 + r() * 0.35,
    grainAmount: 0.07, grainSize: 1.2, contrast: 1, saturation: 1, variation: r() * 40, time: r() * 30
  };
}

let gl = null, canvas = null, field = null, composite = null, vao = null, target = null, buffer = null, broken = false;
const compile = (type, source) => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  console.warn('[Grainient] shader:', gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
  return null;
};
const link = fragmentSource => {
  const vertex = compile(gl.VERTEX_SHADER, VERTEX), fragment = compile(gl.FRAGMENT_SHADER, fragmentSource), program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
  gl.deleteShader(vertex); gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); return null; }
  const uniforms = {}, count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    if (!info) continue;
    const name = info.name.replace(/\[0\]$/, '');
    uniforms[name] = gl.getUniformLocation(program, name);
  }
  return { program, uniforms };
};
function setup() {
  if (gl || broken) return !!gl;
  try {
    canvas = document.createElement('canvas');
    gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    if (!gl) throw new Error('webgl2-unavailable');
    field = link(FIELD); composite = link(COMPOSITE);
    if (!field || !composite) throw new Error('shader-failed');
    vao = gl.createVertexArray();
    target = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, target);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    buffer = gl.createFramebuffer();
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); gl = null; });
    return true;
  } catch (e) { broken = true; gl = null; return false; }
}

/* one still frame of the supplied shaders: no stirs, no twirls, intro finished (uSettle = uReveal = 1) */
const ZERO = { time: null, stirs: new Float32Array(24 * 4), weights: new Float32Array(24), twirls: new Float32Array(4 * 4), frame: 0 };
function paintGL(rc, w, h, dyn) {
  dyn = dyn || ZERO;
  const ramp = new Float32Array(MAX_COLORS * 3);
  rc.colors.slice(0, MAX_COLORS).forEach((c, i) => ramp.set(toLab(hexRgb(c)), i * 3));
  canvas.width = w; canvas.height = h;
  const fw = Math.max(1, Math.round(w / 2)), fh = Math.max(1, Math.round(h / 2)), aspect = w / h;
  gl.bindTexture(gl.TEXTURE_2D, target);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, fw, fh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target, 0);
  gl.bindVertexArray(vao);
  gl.disable(gl.BLEND);
  gl.viewport(0, 0, fw, fh);
  gl.useProgram(field.program);
  const fu = field.uniforms, radians = (rc.angle * Math.PI) / 180;
  gl.uniform1f(fu.uAspect, aspect);
  gl.uniform1f(fu.uTime, dyn.time != null ? dyn.time : rc.time);
  gl.uniform3fv(fu.uRamp, ramp);
  gl.uniform1i(fu.uCount, rc.colors.length);
  gl.uniform1i(fu.uType, TYPES[rc.type] ?? 0);
  gl.uniform2f(fu.uDir, Math.sin(radians), Math.cos(radians));
  gl.uniform1f(fu.uExtent, aspect * Math.abs(Math.sin(radians)) + Math.abs(Math.cos(radians)));
  gl.uniform1f(fu.uBands, clamp(rc.bands, 1, 8));
  gl.uniform1f(fu.uSoftness, clamp(rc.softness, 0, 1));
  gl.uniform1f(fu.uFlow, clamp(rc.flow, 0, 3));
  gl.uniform1f(fu.uScale, clamp(rc.scale, 0.25, 3));
  gl.uniform1f(fu.uSilk, clamp(rc.silk, 0, 1));
  gl.uniform4fv(fu.uStir, dyn.stirs);
  gl.uniform1fv(fu.uStirWeight, dyn.weights);
  gl.uniform4fv(fu.uTwirl, dyn.twirls);
  gl.uniform2f(fu.uSeed, rc.variation * 3.17, rc.variation * 1.91);
  gl.uniform1f(fu.uContrast, clamp(rc.contrast, 0.2, 2));
  gl.uniform1f(fu.uSaturation, clamp(rc.saturation, 0, 2));
  gl.uniform1f(fu.uSettle, 1);
  gl.uniform1f(fu.uReveal, 1);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, w, h);
  gl.useProgram(composite.program);
  const cu = composite.uniforms;
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, target);
  gl.uniform1i(cu.uField, 0);
  gl.uniform1f(cu.uGrain, clamp(rc.grainAmount, 0, 0.5));
  gl.uniform1f(cu.uGrainSize, clamp(rc.grainSize, 0.5, 4));
  gl.uniform1f(cu.uFrame, dyn.frame || 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  return canvas;
}
/* the stand-in when WebGL2 is missing: a plain 2D gradient in the same colours */
function paint2D(rc, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'), r = (rc.angle * Math.PI) / 180, d = Math.hypot(w, h) / 2;
  const g = rc.type === 'radial' ? x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, d)
    : x.createLinearGradient(w / 2 - Math.sin(r) * d, h / 2 + Math.cos(r) * d, w / 2 + Math.sin(r) * d, h / 2 - Math.cos(r) * d);
  const stops = rc.type === 'radial' ? rc.colors.slice().reverse() : rc.colors;
  stops.forEach((col, i) => g.addColorStop(i / (stops.length - 1), col));
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  return c;
}

const cache = new Map();         /* key -> data URL; small, bounded */
const CACHE_MAX = 64;
function url(seed, w, h, opts) {
  w = Math.max(8, Math.min(1024, Math.round(w || 320))); h = Math.max(8, Math.min(1024, Math.round(h || 200)));
  const key = `${seed}|${w}x${h}|${opts ? JSON.stringify(opts) : ''}`;
  if (cache.has(key)) { const v = cache.get(key); cache.delete(key); cache.set(key, v); return v; }
  const rc = Object.assign(recipe(seed), opts || {});
  let out;
  try { out = (setup() ? paintGL(rc, w, h) : paint2D(rc, w, h)).toDataURL('image/jpeg', 0.86); }
  catch (_) { out = paint2D(rc, w, h).toDataURL('image/jpeg', 0.86); }
  cache.set(key, out);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return out;
}
/* paint into an element as its background (cards, covers, the avatar); sized to the element */
function fill(el, seed, opts) {
  if (!el) return;
  const r = el.getBoundingClientRect(), k = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.round((r.width || 320) * k), h = Math.round((r.height || 200) * k);
  /* quantise so tiny layout changes reuse the cache */
  /* important: several older page layers set backgrounds with !important */
  el.style.setProperty('background-image', `url("${url(seed, Math.ceil(w / 32) * 32, Math.ceil(h / 32) * 32, opts)}")`, 'important');
  el.style.setProperty('background-size', 'cover', 'important');
  el.classList.add('grainient-fill');
  el.dataset.gseed = String(seed); el.dataset.gopts = opts ? JSON.stringify(opts) : '';
}
/* a broken or placeholder <img>: swap in art of the same size, keep its alt text, mark it as a placeholder */
function img(el, seed) {
  if (!el || el.dataset.grainient) return;
  el.dataset.grainient = '1';
  const w = +el.getAttribute('width') || el.naturalWidth || el.width || el.clientWidth || 320, h = +el.getAttribute('height') || el.naturalHeight || el.height || el.clientHeight || 200;
  const s = seed || el.getAttribute('alt') || el.getAttribute('src') || 'img';
  el.removeAttribute('srcset');
  el.src = url(s, Math.min(640, w), Math.min(640, h));
  el.title = (el.getAttribute('alt') ? el.getAttribute('alt') + ' — ' : '') + 'placeholder';
  el.classList.add('grainient-img');
  el.dataset.gseed = String(s); el.dataset.gopts = '';
}

/* ---------- live: the placeholder under the pointer moves ----------
   The React Bits interactions, unchanged in spirit: moving the pointer stirs the colours along its path,
   clicking twirls them, and the field keeps flowing. One live renderer at a time, on the shared context:
   it follows the placeholder under the pointer, starts from that placeholder's still frame (so nothing
   jumps), and lets go once the stirs have settled. */
const MAX_STIRS = 24, MAX_TWIRLS = 4, STIR_LIFE = 1.3, STIR_STEP = 0.06, TWIRL_LIFE = 2.6;
const L = { el: null, cv: null, ctx: null, rc: null, raf: 0, last: 0, time: 0, frame: 0, grain: 0, trail: [], spins: [], img: false, hover: false,
  pointer: { x: 0.5, y: 0.5, sx: 0.5, sy: 0.5, vx: 0, inside: false, fresh: true },
  stirs: new Float32Array(MAX_STIRS * 4), weights: new Float32Array(MAX_STIRS), twirls: new Float32Array(MAX_TWIRLS * 4) };
const reduced = () => (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || (document.body && document.body.classList.contains('rm'));
function attach(el) {
  if (L.el === el) { L.hover = true; return; }
  detach(true);
  if (!setup() || reduced()) return;
  let opts = {}; try { opts = el.dataset.gopts ? JSON.parse(el.dataset.gopts) : {}; } catch (_) {}
  L.el = el; L.rc = Object.assign(recipe(el.dataset.gseed), opts); L.time = L.rc.time; L.trail = []; L.spins = []; L.hover = true;
  L.pointer.fresh = true; L.img = el.tagName === 'IMG';
  const cv = document.createElement('canvas'); cv.className = 'grainient-live'; cv.setAttribute('aria-hidden', 'true');
  if (L.img) { cv.style.cssText = 'position:fixed;pointer-events:none;z-index:2147482000;border-radius:' + getComputedStyle(el).borderRadius; document.body.append(cv); }
  else { if (getComputedStyle(el).position === 'static') el.style.position = 'relative'; cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;border-radius:inherit;z-index:-1'; el.prepend(cv); }
  L.cv = cv; L.ctx = cv.getContext('2d'); L.last = 0;
  wake();
}
function detach(now) {
  if (!L.el) return;
  if (!now && (L.trail.length || L.spins.length)) { L.hover = false; return; }   /* let the stirs settle first */
  cancelAnimationFrame(L.raf); L.raf = 0;
  L.cv && L.cv.remove(); L.el = null; L.cv = null; L.ctx = null;
}
function wake() { if (!L.raf && L.el) L.raf = requestAnimationFrame(frame); }
function frame(now) {
  L.raf = 0;
  const el = L.el; if (!el || !el.isConnected || !gl) { detach(true); return; }
  const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) { detach(true); return; }
  const dt = L.last ? Math.min(0.05, Math.max(0.001, (now - L.last) / 1000)) : 1 / 60; L.last = now;
  const k = Math.min(2, window.devicePixelRatio || 1), w = Math.max(8, Math.min(1024, Math.round(r.width * k))), h = Math.max(8, Math.min(1024, Math.round(r.height * k)));
  if (L.img) Object.assign(L.cv.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  if (L.cv.width !== w || L.cv.height !== h) { L.cv.width = w; L.cv.height = h; }
  L.time += dt * 0.16 * (L.hover ? 1.6 : 1);
  L.grain += dt; if (L.grain > 1 / 24) { L.grain = 0; L.frame = (L.frame + 1) % 97; }
  touches(dt, r.width / r.height);
  paintGL(L.rc, w, h, { time: L.time, stirs: L.stirs, weights: L.weights, twirls: L.twirls, frame: L.frame });
  L.ctx.drawImage(canvas, 0, 0);
  if (L.hover || L.trail.length || L.spins.length) wake(); else detach(true);
}
function touches(dt, aspect) {
  const p = L.pointer, follow = 1 - Math.exp(-dt / 0.06), px = p.sx, py = p.sy;
  p.sx += (p.x - p.sx) * follow; p.sy += (p.y - p.sy) * follow;
  const vx = ((p.sx - px) / dt) * aspect, vy = (p.sy - py) / dt; p.vx = vx;
  const trail = L.trail, head = trail[0];
  trail.forEach(s => { if (s.done) s.age += dt; });
  if (p.inside && Math.hypot(vx, vy) > 0.02) {
    if (!head || head.done) { trail.unshift({ x: 0, y: 0, vx: 0, vy: 0, age: 0, grow: 0, done: false }); if (trail.length > MAX_STIRS) trail.pop(); }
    const live = trail[0];
    live.x = (p.sx - 0.5) * aspect; live.y = p.sy - 0.5; live.vx = vx; live.vy = vy;
    live.grow = Math.min(1, live.grow + dt / STIR_STEP); live.done = live.grow >= 1;
  } else if (head) head.done = true;
  while (trail.length && trail[trail.length - 1].age > STIR_LIFE) trail.pop();
  for (let i = 0; i < MAX_STIRS; i++) {
    const s = trail[i]; if (!s) { L.weights[i] = 0; continue; }
    const fade = 1 - s.age / STIR_LIFE, cap = Math.min(1, 2.2 / Math.max(Math.hypot(s.vx, s.vy), 0.001));
    L.stirs.set([s.x, s.y, s.vx * cap, s.vy * cap], i * 4);
    L.weights[i] = fade * fade * s.grow * 0.05 * 1.6;
  }
  L.spins.forEach(s => { s.age += dt; });
  while (L.spins.length && L.spins[L.spins.length - 1].age > TWIRL_LIFE) L.spins.pop();
  for (let i = 0; i < MAX_TWIRLS; i++) {
    const s = L.spins[i]; if (!s) { L.twirls[i * 4 + 2] = 0; continue; }
    const k = s.age / TWIRL_LIFE, env = Math.min(1, s.age / 0.18) * (1 - k) * (1 - k);
    L.twirls.set([s.x, s.y, s.direction * 2.4 * env, 0.16 + 0.1 * Math.min(1, s.age / 0.5)], i * 4);
  }
}
function locate(e) {
  const r = L.el.getBoundingClientRect(), p = L.pointer;
  const x = (e.clientX - r.left) / Math.max(1, r.width), y = 1 - (e.clientY - r.top) / Math.max(1, r.height);
  p.inside = x >= 0 && x <= 1 && y >= 0 && y <= 1; p.x = x; p.y = y;
  if (p.fresh || !p.inside) { p.sx = x; p.sy = y; p.fresh = false; }
  return r;
}
addEventListener('pointermove', e => {
  if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
  let t = e.target && e.target.closest ? e.target.closest('[data-gseed]') : null;
  if (!t && e.target && e.target.closest) { const host = e.target.closest('[data-glive]'); t = host && host.querySelector('[data-gseed]'); }
  if (t) attach(t); else if (L.el) { L.hover = false; L.pointer.inside = false; detach(false); }
  if (L.el) { locate(e); wake(); }
}, { passive: true, capture: true });
addEventListener('pointerdown', e => {
  if (!L.el || !e.target || !e.target.closest || !(e.target.closest('[data-gseed]') === L.el || (e.target.closest('[data-glive]') || {}).contains?.(L.el))) return;
  const r = locate(e);
  L.spins.unshift({ x: (L.pointer.x - 0.5) * (r.width / r.height), y: L.pointer.y - 0.5, age: 0, direction: L.pointer.vx < 0 ? 1 : -1 });
  if (L.spins.length > MAX_TWIRLS) L.spins.pop();
  wake();
}, { passive: true, capture: true });

window.ChandraGrainient = { url, fill, img, recipe, combos: COMBOS.map(c => c.slice()), supported: () => setup() };
/* @end starlight.grainient */
})();
