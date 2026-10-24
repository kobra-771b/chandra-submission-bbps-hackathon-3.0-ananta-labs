/* ============ Gradient ASCII: Chandra's Starlight backdrop ============
   A vanilla-JS port of the React Bits "Gradient ASCII" background (WebGL2 + GLSL), so Chandra needs no
   React runtime. The shaders, colour maths, glyph atlas and the field -> halo -> blur -> composite
   passes are the supplied ones, unchanged. Changes from the React original, all lifecycle and cost:
   - a class with set(props)/destroy() instead of a React effect; WebGL2 is checked up front, and the host
     gets a CSS fallback class (a still gradient) when it is missing or the context is lost;
   - maxFps caps the GPU draw (the backdrop runs at 30 fps), maxDevicePixelRatio caps the canvas size,
     and paused stops the loop (Lite mode, the page hidden, the window off screen);
   - reduced motion also follows Chandra's own "Reduce motion" setting (body.rm), not only the OS query;
   - pointer trail and click wave listen on window, passively: the canvas itself never takes input;
   - flipY mirrors the pointer for a host that mirrors the canvas with CSS (Chandra's sky glows from below).

   Original component: React Bits by David Haz, https://reactbits.dev (MIT + Commons Clause).
   Copyright (c) 2026 David Haz. See THIRD-PARTY-NOTICES.md. */
(function () {
"use strict";
/* @src starlight.gradient-ascii: WebGL2 Gradient ASCII renderer (ported React Bits shaders, glyph atlas, loop) */
const MAX_COLORS = 8;
const MAX_CLICKS = 4;
const MAX_TRAIL = 24;
const CLICK_LIFE = 1.2;
const TRAIL_LIFE = 0.7;
const TRAIL_STEP = 0.015;
const INTRO_SECONDS = 2.4;
const ATLAS_CELL_W = 60;
const ATLAS_CELL_H = 100;
const ATLAS_COLUMNS = 16;
const FONT_SCALE = 0.78;
const DEFAULT_COLORS = ['#1e3fd8', '#f6f8ff', '#a5d8ff', '#38bdf8'];
const DEFAULT_CHARACTERS = ' =+xX0S8#@';
const DEFAULT_FONT = '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const SHAPES = { horizon: 0, pinch: 1, rise: 2, eclipse: 3 };
const CLICK_EFFECTS = { none: 0, wave: 1, burst: 2 };

const VERTEX = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const COMMON = `
float hash12(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
`;

const FIELD = `#version 300 es
precision highp float;
precision highp int;
uniform float uAspect;
uniform float uTime;
uniform int uShape;
uniform vec3 uRamp[8];
uniform int uCount;
uniform float uScale;
uniform float uSoftness;
uniform float uFlow;
uniform vec2 uSeed;
uniform vec4 uTrail[24];
uniform float uRadius;
uniform vec4 uClicks[4];
uniform int uClickEffect;
uniform float uIntro;
uniform float uFrame;
in vec2 vUv;
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outAux;
${COMMON}
vec2 hash22(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.103, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy) * 2.0 - 1.0;
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(hash22(i), f);
  float b = dot(hash22(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
  float c = dot(hash22(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
  float d = dot(hash22(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));
  return 0.5 + 0.5 * mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
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

vec3 horizon(vec2 p, float time, out float order) {
  float span = 0.5 * max(uAspect, 1.0);
  float x = p.x / span;
  float arch = -0.17 - 0.2 * x * x + 0.02 * sin(time * 0.6);
  float soft = mix(0.05, 0.22, uSoftness);
  float edge = p.y - arch;
  float rim = 0.38 * smoothstep(-soft, 0.42, edge);
  vec2 sun = vec2(0.08 * sin(time * 0.31) * span, 0.58);
  float spread = length((p - sun) / vec2(0.95 * span, 0.75));
  float sky = mix(0.55, 1.0, smoothstep(0.2, 0.95, spread));
  order = clamp(edge * 1.3, 0.0, 1.0);
  return vec3(rim, sky, smoothstep(0.18, 0.62, edge));
}

vec3 pinch(vec2 p, float time, out float order) {
  float span = 0.5 * max(uAspect, 0.75);
  float x = p.x / span;
  float sway = 0.02 * sin(x * 1.7 + time * 0.55);
  float breathe = 1.0 + 0.06 * sin(time * 0.8);
  float width = (0.13 + 0.22 * x * x) * breathe * mix(0.85, 1.2, uSoftness);
  float y = abs(p.y - sway) / width;
  float t = exp(-pow(y, 2.2)) * (0.42 + 0.58 * exp(-x * x * 1.8));
  order = clamp(abs(p.y - sway) * 2.4 + abs(x) * 0.3, 0.0, 1.0);
  return vec3(t, t, 0.0);
}

vec3 rise(vec2 p, float time, out float order) {
  float wide = max(uAspect, 0.9);
  vec2 center = vec2(0.05 * sin(time * 0.45) * wide, -0.7);
  vec2 radius = vec2(0.82 * wide, 0.64 * (1.0 + 0.04 * sin(time * 0.8)));
  float d = length((p - center) / radius);
  float soft = mix(0.6, 1.15, uSoftness);
  float t = clamp(pow(clamp(1.0 - d, 0.0, 1.0), soft) * 1.35, 0.0, 1.0);
  order = clamp((d - 0.2) * 1.3, 0.0, 1.0);
  return vec3(t, t, 0.0);
}

vec3 eclipse(vec2 p, float time, out float order) {
  float fit = min(1.0, uAspect * 1.25);
  float r = 0.23 * fit * (1.0 + 0.015 * sin(time * 0.9));
  float angle = atan(p.y, p.x);
  float rays = noise(vec2(cos(angle), sin(angle)) * 2.2 + time * 0.08) * 0.8 + 0.6;
  float d = length(p) - r;
  float reach = mix(0.07, 0.15, uSoftness) * rays * fit;
  float t = smoothstep(-0.006, 0.006 + 0.02 * uSoftness, d) * exp(-max(d, 0.0) / reach);
  order = clamp(d * 2.0, 0.0, 1.0);
  return vec3(t, t, 0.0);
}

vec4 tone(float t) {
  float x = smoothstep(0.3, 1.0, t) * float(uCount - 1);
  int index = int(floor(x));
  return vec4(mix(uRamp[index], uRamp[min(index + 1, uCount - 1)], fract(x)), smoothstep(0.0, 0.38, t));
}

void main() {
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
  float time = uTime;
  vec2 q = p / uScale;
  vec2 warp = vec2(
    noise(q * 1.6 + uSeed + vec2(0.0, time * 0.3)),
    noise(q * 1.6 + uSeed.yx + vec2(4.3, -time * 0.24))
  ) - 0.5;
  q += warp * uFlow * (uShape == 3 ? 0.04 : 0.18);
  float order = 0.0;
  vec3 shape;
  if (uShape == 0) shape = horizon(q, time, order);
  else if (uShape == 1) shape = pinch(q, time, order);
  else if (uShape == 2) shape = rise(q, time, order);
  else shape = eclipse(q, time, order);

  float reveal = clamp((uIntro * 1.45 - order) / 0.45, 0.0, 1.0);
  reveal = reveal * reveal * (3.0 - 2.0 * reveal);

  float scramble = 0.0;
  for (int i = 0; i < 24; i++) {
    vec4 point = uTrail[i];
    if (point.z <= 0.0) continue;
    vec2 d = p - point.xy;
    scramble = max(scramble, point.z * exp(-dot(d, d) / (uRadius * uRadius)));
  }
  for (int i = 0; i < 4; i++) {
    vec4 c = uClicks[i];
    if (c.w <= 0.0) continue;
    float d = length(p - c.xy);
    if (uClickEffect == 1) {
      scramble = max(scramble, exp(-pow((d - c.z * 0.75) / 0.06, 2.0)) * c.w);
    } else if (uClickEffect == 2) {
      float size = 0.08 + 0.22 * (1.0 - exp(-c.z * 5.0));
      scramble = max(scramble, (1.0 - smoothstep(size * 0.6, size, d)) * c.w);
    }
  }
  vec2 t = clamp(shape.xy * mix(0.7, 1.0, reveal), 0.0, 1.0);
  vec4 mixed = mix(tone(t.x), tone(t.y), shape.z);
  vec3 color = encode(labToRgb(mixed.rgb));
  float alpha = mixed.a * reveal;
  float dither = (hash12(gl_FragCoord.xy + uFrame * 13.7) - 0.5) / 255.0;
  outColor = clamp(vec4(color * alpha + dither, alpha + dither), 0.0, 1.0);
  outAux = vec4(reveal, scramble, 0.0, 1.0);
}`;

const GLYPHS = `
uniform sampler2D uField;
uniform sampler2D uAux;
uniform sampler2D uAtlas;
uniform vec2 uResolution;
uniform vec2 uCell;
uniform vec2 uOffset;
uniform vec2 uAtlasGrid;
uniform float uCount;
uniform float uDensity;
uniform float uOpacity;
uniform float uFlicker;
uniform float uDepth;
uniform float uGlyphTime;
uniform float uSeedValue;
uniform float uLight;
${COMMON}
float sampleGlyph(float index, vec2 local, vec2 coord, float soft) {
  float column = mod(index, uAtlasGrid.x);
  float row = floor(index / uAtlasGrid.x);
  vec2 atlasUv = vec2((column + local.x) / uAtlasGrid.x, (row + 1.0 - local.y) / uAtlasGrid.y);
  vec2 continuous = coord / uAtlasGrid;
  float scale = exp2(soft);
  return textureGrad(uAtlas, atlasUv, dFdx(continuous) * scale, dFdy(continuous) * scale).a;
}

vec4 glyphAt(vec2 px) {
  vec2 coord = (px - uOffset) / uCell;
  vec2 cell = floor(coord);
  vec2 local = coord - cell;
  vec2 uv = clamp(((cell + 0.5) * uCell + uOffset) / uResolution, vec2(0.0), vec2(1.0));
  vec4 field = texture(uField, uv);
  vec4 aux = texture(uAux, uv);
  vec3 visible = uLight > 0.5 ? field.rgb + (1.0 - field.a) : field.rgb;
  float luma = dot(visible, vec3(0.2126, 0.7152, 0.0722));
  float value = uLight > 0.5 ? clamp((1.0 - luma) * 1.5, 0.0, 1.0) : luma;
  float pick = hash12(cell + uSeedValue * 7.31);
  float level = hash12(cell * 1.73 + 4.1 + uSeedValue);
  float tick = floor(uGlyphTime * 9.0 + level * 9.0);
  float wobble = (hash12(cell * 2.31 + tick * 17.7) - 0.5) * uFlicker * 0.4 + (level - 0.5) * 0.1;
  float tone = clamp(pow(value, 0.75) + wobble, 0.0, 1.0);
  float index = floor(tone * (uCount - 1.0) + 0.5);
  float decode = max(aux.g, 1.0 - aux.r);
  if (decode > 0.02) {
    float frame = floor(uGlyphTime * 20.0);
    if (hash12(cell * 3.7 + frame * 5.3) < decode * 1.25) index = 1.0 + floor(hash12(cell + frame * 1.37) * (uCount - 1.0));
  }
  float present = step(pick, uDensity * mix(1.0, 0.3 + tone * 1.1, 0.55));
  float cutoff = smoothstep(0.03, 0.1, value);
  float focus = step(hash12(cell * 0.71 + 9.2 + uSeedValue), uDepth);
  float coverage = sampleGlyph(index, local, coord, focus * 1.2);
  float alpha = uOpacity * present * cutoff * coverage * mix(1.0, 0.35 + 0.65 * level, 0.55) * (1.0 - focus * 0.5);
  if (uLight < 0.5) {
    vec3 light = field.rgb * 0.55 + vec3(0.03) * field.a;
    return vec4(light * alpha, 0.6 * field.a * alpha);
  }
  vec3 ink = visible * 0.8;
  return vec4(ink * alpha, alpha);
}
`;

const HALO = `#version 300 es
precision highp float;
uniform float uDownscale;
in vec2 vUv;
out vec4 outColor;
${GLYPHS}
void main() {
  outColor = glyphAt(gl_FragCoord.xy * uDownscale);
}`;

const BLUR = `#version 300 es
precision highp float;
uniform sampler2D uSource;
uniform vec2 uStep;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec4 sum = texture(uSource, vUv) * 0.2270270270;
  sum += texture(uSource, vUv + uStep * 1.3846153846) * 0.3162162162;
  sum += texture(uSource, vUv - uStep * 1.3846153846) * 0.3162162162;
  sum += texture(uSource, vUv + uStep * 3.2307692308) * 0.0702702703;
  sum += texture(uSource, vUv - uStep * 3.2307692308) * 0.0702702703;
  outColor = sum;
}`;

const COMPOSITE = `#version 300 es
precision highp float;
uniform sampler2D uHalo;
uniform float uGlow;
uniform float uGradient;
uniform float uGrain;
uniform float uFrame;
in vec2 vUv;
out vec4 outColor;
${GLYPHS}
void main() {
  vec4 base = texture(uField, vUv) * uGradient;
  vec4 glyph = glyphAt(gl_FragCoord.xy);
  vec4 halo = texture(uHalo, vUv) * uGlow;
  vec4 color;
  if (uLight < 0.5) {
    color = base + glyph + halo;
  } else {
    color = glyph + base * (1.0 - glyph.a);
    color += halo * 0.6 * (1.0 - color.a);
  }
  float grain = (hash12(gl_FragCoord.xy + uFrame * vec2(17.0, 59.0)) + hash12(gl_FragCoord.xy * 1.31 + uFrame * 7.0) - 1.0) * uGrain;
  float body = clamp(color.a, 0.0, 1.0);
  color.rgb += grain * (0.25 + body) * 0.5;
  color.a = clamp(color.a, 0.0, 1.0);
  color.rgb = clamp(color.rgb, 0.0, color.a);
  outColor = color;
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
let warned = false;
const compile = (gl, type, source) => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  if (!warned) { warned = true; console.warn("[GradientASCII] shader:", gl.getShaderInfoLog(shader)); }
  gl.deleteShader(shader);
  return null;
};
const link = (gl, fragmentSource) => {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); return null; }
  const uniforms = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    if (!info) continue;
    const name = info.name.replace(/\[0\]$/, '');
    uniforms[name] = gl.getUniformLocation(program, name);
  }
  return { program, uniforms };
};
const createTarget = (gl, count) => {
  const textures = Array.from({ length: count }, () => {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  });
  return { textures, framebuffer: gl.createFramebuffer(), width: 0, height: 0 };
};
const sizeTarget = (gl, target, width, height) => {
  if (target.width === width && target.height === height) return;
  target.width = width;
  target.height = height;
  gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
  target.textures.forEach((texture, i) => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, texture, 0);
  });
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
};
const buildAtlas = (gl, characters, fontFamily) => {
  const list = [...new Set([...characters].filter(char => char !== '\n' && char !== '\r'))];
  if (!list.length) list.push(' ');
  const font = `300 ${Math.round(ATLAS_CELL_H * FONT_SCALE)}px ${fontFamily}`;
  const columns = Math.min(ATLAS_COLUMNS, list.length);
  const rows = Math.ceil(list.length / columns);
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_CELL_W * columns;
  canvas.height = ATLAS_CELL_H * rows;
  const context = canvas.getContext('2d');
  if (context) {
    context.font = font;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#fff';
    list.forEach((char, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      context.fillText(char, column * ATLAS_CELL_W + ATLAS_CELL_W / 2, row * ATLAS_CELL_H + ATLAS_CELL_H / 2 + 3);
    });
  }
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return { texture, count: list.length, grid: [columns, rows] };
};

const DEFAULTS = {
  colors: DEFAULT_COLORS, shape: 'horizon', characters: DEFAULT_CHARACTERS, cellSize: 18, density: 0.8,
  glyphOpacity: 0.85, glow: 0.2, depthOfField: 0, flicker: 0.2, softness: 0.5, scale: 1, flow: 0.5, speed: 1,
  gradientOpacity: 0.9, grain: 0.08, variation: 0, mouseInteraction: true, scrambleRadius: 0.1, clickEffect: 'wave',
  intro: true, lightMode: false, fontFamily: DEFAULT_FONT, maxDevicePixelRatio: 2, maxFps: 60, paused: false, flipY: false
};
/* the React component's prop normalisation, unchanged */
const settle = p => {
  const palette = (Array.isArray(p.colors) && p.colors.length ? p.colors : DEFAULT_COLORS).slice(0, MAX_COLORS);
  return {
    colors: palette.length > 1 ? palette : [palette[0], palette[0]],
    shape: SHAPES[p.shape] ?? 0,
    characters: p.characters || DEFAULT_CHARACTERS,
    cellSize: clamp(p.cellSize, 6, 64),
    density: clamp(p.density, 0, 1),
    glyphOpacity: clamp(p.glyphOpacity, 0, 1),
    glow: clamp(p.glow, 0, 2),
    depthOfField: clamp(p.depthOfField, 0, 1),
    flicker: clamp(p.flicker, 0, 1),
    softness: clamp(p.softness, 0, 1),
    scale: clamp(p.scale, 0.4, 2.5),
    flow: clamp(p.flow, 0, 2),
    speed: Math.max(0, p.speed),
    gradientOpacity: clamp(p.gradientOpacity, 0, 1),
    grain: clamp(p.grain, 0, 0.4),
    variation: Math.max(0, p.variation),
    mouseInteraction: p.mouseInteraction,
    scrambleRadius: clamp(p.scrambleRadius, 0.02, 0.4),
    clickEffect: CLICK_EFFECTS[p.clickEffect] ?? 1,
    intro: p.intro,
    lightMode: p.lightMode,
    fontFamily: p.fontFamily || DEFAULT_FONT
  };
};

let support = null;
function supported() {
  if (support !== null) return support;
  try {
    const c = document.createElement('canvas'), gl = c.getContext('webgl2');
    support = !!gl;
    if (gl) gl.getExtension('WEBGL_lose_context')?.loseContext();
  } catch (_) { support = false; }
  return support;
}

class GradientASCII {
  constructor(container, props) {
    this.container = container;
    this.p = Object.assign({}, DEFAULTS, props || {});
    this.s = settle(this.p);
    this.ok = false;
    container.classList.add('gradient-ascii-container');
    if (!supported()) { this._fail('webgl2-unavailable'); return; }
    const canvas = document.createElement('canvas');
    canvas.className = 'gradient-ascii-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.setAttribute('role', 'presentation');
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
    if (!gl) { this._fail('webgl2-unavailable'); return; }
    this.canvas = canvas; this.gl = gl;
    container.appendChild(canvas);
    if (!this._setup()) { canvas.remove(); this._fail('shader-failed'); return; }
    this.ok = true;
    const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
    this.reduced = () => !!(mq && mq.matches) || document.body.classList.contains('rm');
    const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const colorCache = new Map();
    this.parse = value => {
      const key = String(value);
      const cached = colorCache.get(key);
      if (cached) return cached;
      let rgb = [0, 0, 0];
      if (probe) {
        probe.clearRect(0, 0, 1, 1);
        probe.fillStyle = '#000000';
        probe.fillStyle = key;
        probe.fillRect(0, 0, 1, 1);
        const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
        rgb = [r / 255, g / 255, b / 255];
      }
      colorCache.set(key, rgb);
      return rgb;
    };
    this.view = { width: 1, height: 1, ratio: 1 };
    this.ramp = new Float32Array(MAX_COLORS * 3);
    this.clickData = new Float32Array(MAX_CLICKS * 4);
    this.trailData = new Float32Array(MAX_TRAIL * 4);
    this.clicks = []; this.trail = []; this.pointer = { x: 0, y: 0, inside: false };
    this.st = { atlasKey: '', paletteKey: '', time: 0, glyphTime: 0, intro: this.s.intro && !this.reduced() ? 0 : 1,
      frameSeed: 0, grainClock: 0, raf: 0, last: 0, lastDraw: 0, visible: typeof IntersectionObserver === 'undefined', lost: false };
    this._frame = this._frame.bind(this);
    this._onLost = e => { e.preventDefault(); this.st.lost = true; if (this.st.raf) cancelAnimationFrame(this.st.raf); this.st.raf = 0; this._status(false, 'context-lost'); };
    this._onRestored = () => { this.st.lost = false; this.st.atlasKey = ''; this.st.paletteKey = ''; this.atlas = null;
      if (this._setup()) { this._resize(true); this._status(true, 'restored'); this.wake(); } };
    this._onVis = () => { this.st.last = 0; this.wake(); };
    this._onMove = e => this._move(e);
    this._onDown = e => this._down(e);
    canvas.addEventListener('webglcontextlost', this._onLost);
    canvas.addEventListener('webglcontextrestored', this._onRestored);
    document.addEventListener('visibilitychange', this._onVis);
    window.addEventListener('pointermove', this._onMove, { passive: true });
    window.addEventListener('pointerdown', this._onDown, { passive: true });
    this.ro = new ResizeObserver(() => this._resize());
    this.ro.observe(container);
    if (typeof IntersectionObserver !== 'undefined') {
      this.io = new IntersectionObserver(es => { this.st.visible = es.some(x => x.isIntersecting); if (this.st.visible) { this.st.last = 0; this.wake(); } });
      this.io.observe(container);
    }
    this._resize();
  }
  _fail(reason) { this.ok = false; this._status(false, reason); }
  _status(ok, reason) { this.container.classList.toggle('gradient-ascii-fallback', !ok); try { this.onstatus && this.onstatus(ok, reason); } catch (_) {} }
  _setup() {
    const gl = this.gl;
    this.field = link(gl, FIELD); this.halo = link(gl, HALO); this.blur = link(gl, BLUR); this.composite = link(gl, COMPOSITE);
    if (!this.field || !this.halo || !this.blur || !this.composite) return false;
    this.vao = gl.createVertexArray();
    this.fieldTarget = createTarget(gl, 2);
    this.haloA = createTarget(gl, 1);
    this.haloB = createTarget(gl, 1);
    return true;
  }
  _syncAtlas() {
    const s = this.s, gl = this.gl, key = `${s.fontFamily}|${s.characters}`;
    if (key === this.st.atlasKey && this.atlas) return;
    this.st.atlasKey = key;
    if (this.atlas) gl.deleteTexture(this.atlas.texture);
    this.atlas = buildAtlas(gl, s.characters, s.fontFamily);
    document.fonts?.load?.(`300 64px ${s.fontFamily}`, s.characters).then(() => {
      if (!this.ok || this.st.atlasKey !== key) return;
      if (this.atlas) gl.deleteTexture(this.atlas.texture);
      this.atlas = buildAtlas(gl, s.characters, s.fontFamily);
      this._draw();
    }, () => {});
  }
  _syncPalette() {
    const s = this.s, key = s.colors.join(',');
    if (key === this.st.paletteKey) return;
    this.st.paletteKey = key;
    s.colors.forEach((color, i) => this.ramp.set(toLab(this.parse(color)), i * 3));
  }
  _bindGlyphs(program, width, height) {
    const gl = this.gl, s = this.s, atlas = this.atlas, u = program.uniforms;
    if (!atlas) return;
    const cellH = s.cellSize * this.view.ratio;
    const cellW = cellH * (ATLAS_CELL_W / ATLAS_CELL_H);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.fieldTarget.textures[0]);
    gl.uniform1i(u.uField, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.fieldTarget.textures[1]);
    gl.uniform1i(u.uAux, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, atlas.texture);
    gl.uniform1i(u.uAtlas, 2);
    gl.uniform2f(u.uResolution, width, height);
    gl.uniform2f(u.uCell, cellW, cellH);
    gl.uniform2f(u.uOffset, (width - Math.ceil(width / cellW) * cellW) / 2, (height - Math.ceil(height / cellH) * cellH) / 2);
    gl.uniform2f(u.uAtlasGrid, atlas.grid[0], atlas.grid[1]);
    gl.uniform1f(u.uCount, atlas.count);
    gl.uniform1f(u.uDensity, s.density);
    gl.uniform1f(u.uOpacity, s.glyphOpacity);
    gl.uniform1f(u.uFlicker, this.reduced() ? 0 : s.flicker);
    gl.uniform1f(u.uDepth, s.depthOfField);
    gl.uniform1f(u.uGlyphTime, this.st.glyphTime);
    gl.uniform1f(u.uSeedValue, s.variation);
    gl.uniform1f(u.uLight, s.lightMode ? 1 : 0);
  }
  _draw() {
    const gl = this.gl, s = this.s, st = this.st, view = this.view, canvas = this.canvas;
    if (!this.ok || st.lost) return;
    const { field, halo, blur, composite, fieldTarget, haloA, haloB } = this;
    const aspect = view.width / view.height;
    this._syncAtlas();
    this._syncPalette();
    gl.bindVertexArray(this.vao);
    gl.disable(gl.BLEND);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fieldTarget.framebuffer);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.viewport(0, 0, fieldTarget.width, fieldTarget.height);
    gl.useProgram(field.program);
    const fu = field.uniforms;
    gl.uniform1f(fu.uAspect, aspect);
    gl.uniform1f(fu.uTime, st.time);
    gl.uniform1i(fu.uShape, s.shape);
    gl.uniform3fv(fu.uRamp, this.ramp);
    gl.uniform1i(fu.uCount, s.colors.length);
    gl.uniform1f(fu.uScale, s.scale);
    gl.uniform1f(fu.uSoftness, s.softness);
    gl.uniform1f(fu.uFlow, s.flow);
    gl.uniform2f(fu.uSeed, s.variation * 3.17, s.variation * 1.91);
    gl.uniform4fv(fu.uTrail, this.trailData);
    gl.uniform1f(fu.uRadius, s.scrambleRadius);
    gl.uniform4fv(fu.uClicks, this.clickData);
    gl.uniform1i(fu.uClickEffect, s.clickEffect);
    gl.uniform1f(fu.uIntro, st.intro);
    gl.uniform1f(fu.uFrame, st.frameSeed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    const glowing = s.glow > 0.001;
    if (glowing) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, haloA.framebuffer);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
      gl.viewport(0, 0, haloA.width, haloA.height);
      gl.useProgram(halo.program);
      this._bindGlyphs(halo, canvas.width, canvas.height);
      gl.uniform1f(halo.uniforms.uDownscale, canvas.width / haloA.width);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.useProgram(blur.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(blur.uniforms.uSource, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, haloB.framebuffer);
      gl.bindTexture(gl.TEXTURE_2D, haloA.textures[0]);
      gl.uniform2f(blur.uniforms.uStep, 1 / haloA.width, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, haloA.framebuffer);
      gl.bindTexture(gl.TEXTURE_2D, haloB.textures[0]);
      gl.uniform2f(blur.uniforms.uStep, 0, 1 / haloA.height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(composite.program);
    this._bindGlyphs(composite, canvas.width, canvas.height);
    const cu = composite.uniforms;
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, haloA.textures[0]);
    gl.uniform1i(cu.uHalo, 3);
    gl.uniform1f(cu.uGlow, glowing ? s.glow : 0);
    gl.uniform1f(cu.uGradient, s.gradientOpacity);
    gl.uniform1f(cu.uGrain, s.grain);
    gl.uniform1f(cu.uFrame, st.frameSeed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  _resize(force) {
    if (!this.ok) return;
    const gl = this.gl, view = this.view, canvas = this.canvas, c = this.container;
    view.width = Math.max(1, c.clientWidth);
    view.height = Math.max(1, c.clientHeight);
    view.ratio = Math.min(window.devicePixelRatio || 1, Math.max(0.5, this.p.maxDevicePixelRatio));
    const w = Math.max(1, Math.round(view.width * view.ratio)), h = Math.max(1, Math.round(view.height * view.ratio));
    if (w === canvas.width && h === canvas.height && !force) return;
    canvas.width = w; canvas.height = h;
    sizeTarget(gl, this.fieldTarget, Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)));
    const hw = Math.max(1, Math.round(w / 4)), hh = Math.max(1, Math.round(h / 4));
    sizeTarget(gl, this.haloA, hw, hh);
    sizeTarget(gl, this.haloB, hw, hh);
    this._draw();
    this.wake();
  }
  _input(dt) {
    const trail = this.trail, clicks = this.clicks, trailData = this.trailData, clickData = this.clickData;
    trail.forEach(point => { point.age += dt; });
    while (trail.length && trail[trail.length - 1].age > TRAIL_LIFE) trail.pop();
    for (let i = 0; i < MAX_TRAIL; i++) {
      const point = trail[i];
      if (!point) { trailData[i * 4 + 2] = 0; continue; }
      const k = 1 - point.age / TRAIL_LIFE;
      trailData.set([point.x, point.y, k * k, 0], i * 4);
    }
    clicks.forEach(click => { click.age += dt; });
    while (clicks.length && clicks[clicks.length - 1].age > CLICK_LIFE) clicks.pop();
    for (let i = 0; i < MAX_CLICKS; i++) {
      const click = clicks[i];
      if (!click) { clickData[i * 4 + 3] = 0; continue; }
      const k = click.age / CLICK_LIFE;
      const envelope = Math.min(1, click.age / 0.08) * (1 - k) * (1 - k);
      clickData.set([click.x, click.y, click.age, envelope], i * 4);
    }
  }
  _frame(now) {
    const st = this.st, s = this.s, p = this.p;
    st.raf = 0;
    if (!this.ok || st.lost || !st.visible || document.hidden || p.paused) return;
    const reduce = this.reduced();
    const dt = st.last ? clamp((now - st.last) / 1000, 0.001, 0.05) : 1 / 60;
    st.last = now;
    if (!reduce) {
      st.time += dt * s.speed * 0.5;
      st.glyphTime += dt * Math.max(s.speed, 0.15);
    }
    if (st.intro < 1) st.intro = Math.min(1, st.intro + dt / INTRO_SECONDS);
    st.grainClock += dt;
    if (!reduce && st.grainClock > 1 / 24) { st.grainClock = 0; st.frameSeed = (st.frameSeed + 1) % 97; }
    this._input(dt);
    /* frame-rate cap: time advances every frame, only the GPU work is skipped */
    if (!st.lastDraw || now - st.lastDraw >= 1000 / Math.max(1, p.maxFps) - 2) { st.lastDraw = now; this._draw(); }
    const busy = !reduce || st.intro < 1 || this.clicks.length > 0 || this.trail.length > 0;
    if (busy) st.raf = requestAnimationFrame(this._frame);
    else { st.last = 0; this._draw(); }
  }
  _locate(event) {
    const rect = this.container.getBoundingClientRect(), pointer = this.pointer;
    const x = (event.clientX - rect.left) / Math.max(1, rect.width);
    const down = (event.clientY - rect.top) / Math.max(1, rect.height);
    const y = this.p.flipY ? down : 1 - down;   /* flipY: the host mirrors the canvas with CSS, so mirror the pointer too */
    const aspect = rect.width / Math.max(1, rect.height);
    pointer.inside = x >= 0 && x <= 1 && y >= 0 && y <= 1;
    pointer.x = (x - 0.5) * aspect;
    pointer.y = y - 0.5;
  }
  _move(event) {
    if (!this.ok || !this.s.mouseInteraction || this.p.paused || this.reduced()) return;
    this._locate(event);
    const pointer = this.pointer, trail = this.trail;
    if (!pointer.inside) return;
    const head = trail[0];
    const gap = head ? Math.hypot(pointer.x - head.x, pointer.y - head.y) : Infinity;
    if (gap < TRAIL_STEP) return;
    if (head && head.age < 0.1) {
      const steps = Math.min(6, Math.floor(gap / (TRAIL_STEP * 2)));
      for (let i = 1; i <= steps; i++) {
        const k = i / (steps + 1);
        trail.unshift({ x: head.x + (pointer.x - head.x) * k, y: head.y + (pointer.y - head.y) * k, age: 0 });
      }
    }
    trail.unshift({ x: pointer.x, y: pointer.y, age: 0 });
    trail.length = Math.min(trail.length, MAX_TRAIL);
    this.wake();
  }
  _down(event) {
    if (!this.ok || !this.s.clickEffect || this.p.paused || this.reduced()) return;
    this._locate(event);
    if (!this.pointer.inside) return;
    this.clicks.unshift({ x: this.pointer.x, y: this.pointer.y, age: 0 });
    if (this.clicks.length > MAX_CLICKS) this.clicks.pop();
    this.wake();
  }
  wake() {
    const st = this.st;
    if (this.ok && !st.raf && st.visible && !st.lost && !this.p.paused && !document.hidden) st.raf = requestAnimationFrame(this._frame);
  }
  set(props) {
    if (!props) return;
    Object.assign(this.p, props);
    this.s = settle(this.p);
    if (!this.ok) return;
    if ('maxDevicePixelRatio' in props) this._resize();
    if (this.p.paused) { if (this.st.raf) cancelAnimationFrame(this.st.raf); this.st.raf = 0; }
    else { this.st.last = 0; this._draw(); this.wake(); }
  }
  destroy() {
    const st = this.st, gl = this.gl;
    if (st && st.raf) cancelAnimationFrame(st.raf);
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerdown', this._onDown);
    document.removeEventListener('visibilitychange', this._onVis);
    this.ro && this.ro.disconnect(); this.io && this.io.disconnect();
    if (this.canvas) { this.canvas.removeEventListener('webglcontextlost', this._onLost); this.canvas.removeEventListener('webglcontextrestored', this._onRestored); }
    if (gl && this.ok) {
      [this.fieldTarget, this.haloA, this.haloB].forEach(target => {
        target.textures.forEach(texture => gl.deleteTexture(texture));
        gl.deleteFramebuffer(target.framebuffer);
      });
      if (this.atlas) gl.deleteTexture(this.atlas.texture);
      gl.deleteVertexArray(this.vao);
      [this.field, this.halo, this.blur, this.composite].forEach(item => gl.deleteProgram(item.program));
    }
    if (gl) gl.getExtension('WEBGL_lose_context')?.loseContext();
    this.canvas && this.canvas.remove();
    this.ok = false; this.canvas = null; this.gl = null;
  }
}
GradientASCII.supported = supported;
GradientASCII.SHAPES = Object.keys(SHAPES);
window.GradientASCII = GradientASCII;
/* @end starlight.gradient-ascii */
})();
