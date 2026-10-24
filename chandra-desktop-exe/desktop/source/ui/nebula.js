/* ============ Nebula: Chandra's voice orb (1.0) ============
   The child of two earlier designs: the Sky Cloud (a soft sphere of drifting blue-white cloud that breathes and
   brightens with the voice) and the Pulsar (a turning shell of light points that sound pushes outward).
   - The cloud: a sphere shaded from below-blue to a soft white crown, clouds drifting faster as Chandra thinks.
   - The shell: ~1400 points on a slightly larger sphere, turning on a tilted axis. Each latitude follows one band of
     the sound (low at the equator, highs toward the poles), so a voice ripples across it; points behind the cloud sink
     into it.
   - Warmth: while Chandra speaks the crown and the points warm toward star-white.
   One WebGL1 context, two draws (the cloud as a full quad, the shell as additive points). 60 fps at most, paused when
   hidden or told to; Reduce motion keeps it still. new ChandraNebula(host, opts).set({level, bands, energy, warmth,
   paused}); .ok is false without WebGL, and the caller keeps its CSS stand-in. */
(function () {
"use strict";
/* @src nebula.orb: cloud sphere + pulsar point shell, sound-reactive */
const NOISE = "float h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}" +
  "float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}" +
  "float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.02+vec2(11.,7.);a*=.5;}return v;}";
const QUAD_V = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
const CLOUD_F = `precision highp float;uniform vec2 R;uniform float T,L,E,W,RAD,A;uniform vec3 B;${NOISE}
void main(){vec2 p=(gl_FragCoord.xy-.5*R)/min(R.x,R.y)*2.;
 float r=RAD*(1.+.07*L+.012*sin(T*1.3));float d=length(p);vec3 col=vec3(0.);float a=0.;
 if(d<r){vec2 q=p/r;float z=sqrt(max(0.,1.-dot(q,q)));
  vec2 w=q*1.5/(.6+.4*z);float sp=.05+.22*E;
  float c=fbm(w+vec2(T*sp,T*sp*.6)+fbm(w*1.3-T*sp*.5)*.8);
  vec3 deep=vec3(.08,.20,.72),sky=vec3(.48,.72,1.),wh=mix(vec3(.95,.98,1.),vec3(1.,.95,.84),W);
  col=mix(deep,sky,smoothstep(.15,.6,c));col=mix(col,wh,smoothstep(.40,.80,c)*(.5+.7*L));
  col=mix(col,wh,pow(z,6.)*(.22+.4*L+.15*B.x));
  col*=.45+.55*z;col+=sky*pow(1.-z,3.)*.75;
  col+=wh*pow(max(0.,dot(normalize(vec3(q,z)),normalize(vec3(-.4,.5,.8)))),24.)*.3;
  a=smoothstep(r,r-.012,d);}
 float g=exp(-max(d-r,0.)*7.)*(.16+.42*L)*step(r-.012,d);col+=vec3(.25,.45,1.)*g;a=max(a,g);
 gl_FragColor=vec4(col*A,a*A);}`;
const DOT_V = `precision highp float;attribute vec3 P;attribute float S;
uniform float T,ROT,L,E,W,RAD,PX,ASP;uniform vec3 B;varying float vA;varying vec3 vC;
void main(){float ca=cos(ROT),sa=sin(ROT);vec3 p=vec3(P.x*ca+P.z*sa,P.y,-P.x*sa+P.z*ca);
 float ct=cos(.35),st=sin(.35);p=vec3(p.x,p.y*ct-p.z*st,p.y*st+p.z*ct);
 float lat=abs(P.y);float band=lat<.33?B.x:mix(B.y,B.z,(lat-.33)/.67);
 float rip=sin(P.y*9.-T*5.)*.5+.5;
 float disp=1.16+.035*sin(S*40.+T*1.7)+(.06+.36*band*rip)*L+.03*E*sin(P.x*5.+T*2.);
 float k=2.6/(2.6-p.z);vec2 xy=p.xy*disp*RAD*k;
 gl_Position=vec4(xy.x*ASP,xy.y,0.,1.);
 float depth=(p.z+1.)*.5;
 /* over the cloud's face the shell fades (a halo, not a grid); behind the cloud it is hidden */
 float pr=length(p.xy)*disp*k/1.;float over=1.-smoothstep(.86,1.02,pr);
 vA=(.22+.72*depth)*mix(1.,p.z>0.?.10+.25*band*L:.03,over);
 vC=mix(vec3(.55,.75,1.),mix(vec3(.85,.92,1.),vec3(1.,.9,.72),W),depth*(.4+.6*band*L));
 gl_PointSize=(1.1+2.1*depth)*PX*(1.+.9*band*L*rip);}`;
const DOT_F = "precision highp float;varying float vA;varying vec3 vC;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,.05,d)*vA;gl_FragColor=vec4(vC*a,a);}";

const reduced = () => (document.body && document.body.classList.contains("rm")) || (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);

class ChandraNebula {
  constructor(host, opts) {
    this.o = Object.assign({ count: 1400, radius: 0.46, maxFps: 60, maxDevicePixelRatio: 2 }, opts || {});
    this.host = host; this.ok = false; this.paused = false; this.raf = 0; this.last = 0; this.t0 = performance.now();
    this.s = { level: 0, energy: 0.3, warmth: 0, bands: null, alpha: 0 };
    this.cur = { L: 0, E: 0.3, W: 0, B: [0, 0, 0] }; this.rot = 0;
    const cv = this.cv = document.createElement("canvas");
    cv.className = "nebula-canvas"; cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
    host.append(cv);
    const gl = this.gl = cv.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: true });
    if (!gl) { cv.remove(); return; }
    const prog = (vs, fs) => {
      const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null; };
      const v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs); if (!v || !f) return null;
      const p = gl.createProgram(); gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
      return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
    };
    this.cloud = prog(QUAD_V, CLOUD_F); this.dots = prog(DOT_V, DOT_F);
    if (!this.cloud || !this.dots) { cv.remove(); return; }
    this.quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const N = this.o.count, pts = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {                         /* a Fibonacci sphere: even points, no clumps */
      const y = 1 - (i + 0.5) / N * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963;
      pts.set([Math.cos(th) * r, y, Math.sin(th) * r, Math.random()], i * 4);
    }
    this.pts = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.pts); gl.bufferData(gl.ARRAY_BUFFER, pts, gl.STATIC_DRAW);
    const U = (p, names) => { const u = {}; names.forEach(k => u[k] = gl.getUniformLocation(p, k)); return u; };
    this.uc = U(this.cloud, ["R", "T", "L", "E", "W", "RAD", "A", "B"]);
    this.ud = U(this.dots, ["T", "ROT", "L", "E", "W", "RAD", "PX", "ASP", "B"]);
    this.ac = gl.getAttribLocation(this.cloud, "p"); this.aP = gl.getAttribLocation(this.dots, "P"); this.aS = gl.getAttribLocation(this.dots, "S");
    cv.addEventListener("webglcontextlost", e => { e.preventDefault(); this.ok = false; cancelAnimationFrame(this.raf); });
    this.ok = true;
    this.frame = this.frame.bind(this); this.resize = this.resize.bind(this);
    if (typeof ResizeObserver !== "undefined") { this.ro = new ResizeObserver(this.resize); this.ro.observe(host); }
    addEventListener("resize", this.resize); this.resize();
    document.addEventListener("visibilitychange", () => this.kick());
    this.kick();
  }
  resize() {
    const dpr = Math.min(this.o.maxDevicePixelRatio, window.devicePixelRatio || 1), r = this.host.getBoundingClientRect();
    const w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
    if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; }
    this.kick();
  }
  /* level 0..1 (the voice), bands [low, mid, high] 0..1 when known, energy 0..1 (thinking), warmth 0..1 (speaking) */
  set(o) {
    if (!o) return;
    if ("paused" in o) this.paused = !!o.paused;
    if (o.level !== undefined) this.s.level = o.level == null ? 0 : Math.max(0, Math.min(1, +o.level || 0));
    if (o.energy !== undefined) this.s.energy = +o.energy || 0;
    if (o.warmth !== undefined) this.s.warmth = +o.warmth || 0;
    if (o.bands !== undefined) this.s.bands = o.bands;
    this.kick();
  }
  kick() { if (this.ok && !this.raf) this.raf = requestAnimationFrame(this.frame); }
  destroy() { this.ok = false; cancelAnimationFrame(this.raf); this.ro && this.ro.disconnect(); removeEventListener("resize", this.resize); this.cv.remove(); }
  frame(now) {
    this.raf = 0; if (!this.ok) return;
    const still = this.paused || document.hidden;
    if (still) { this.last = 0; return; }
    if (this.last && now - this.last < 1000 / this.o.maxFps - 1) { this.raf = requestAnimationFrame(this.frame); return; }
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0.016; this.last = now;
    const s = this.s, c = this.cur, rm = reduced(), t = rm ? 8 : (now - this.t0) / 1000;
    const up = (a, b, k) => a + (b - a) * (1 - Math.exp(-dt * k));
    c.L = up(c.L, s.level, s.level > c.L ? 24 : 8); c.E = up(c.E, s.energy, 3); c.W = up(c.W, s.warmth, 3);
    const B = s.bands || [s.level, s.level * (0.75 + 0.25 * Math.sin(t * 7)), s.level * (0.55 + 0.45 * Math.sin(t * 11 + 1))];
    for (let i = 0; i < 3; i++) c.B[i] = up(c.B[i], Math.max(0, Math.min(1, B[i] || 0)), B[i] > c.B[i] ? 26 : 9);
    s.alpha = Math.min(1, s.alpha + dt * 1.6);
    this.rot += rm ? 0 : dt * (0.18 + 0.9 * c.E + 0.25 * c.L);
    const gl = this.gl, W = this.cv.width, H = this.cv.height, R = this.o.radius;
    gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.cloud); gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(this.ac); gl.vertexAttribPointer(this.ac, 2, gl.FLOAT, false, 0, 0);
    const u = this.uc; gl.uniform2f(u.R, W, H); gl.uniform1f(u.T, t); gl.uniform1f(u.L, c.L); gl.uniform1f(u.E, c.E); gl.uniform1f(u.W, c.W);
    gl.uniform1f(u.RAD, R); gl.uniform1f(u.A, s.alpha); gl.uniform3f(u.B, c.B[0], c.B[1], c.B[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3); gl.disableVertexAttribArray(this.ac);
    gl.blendFunc(gl.ONE, gl.ONE);                                 /* the shell adds light */
    gl.useProgram(this.dots); gl.bindBuffer(gl.ARRAY_BUFFER, this.pts);
    gl.enableVertexAttribArray(this.aP); gl.vertexAttribPointer(this.aP, 3, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(this.aS); gl.vertexAttribPointer(this.aS, 1, gl.FLOAT, false, 16, 12);
    const d = this.ud, m = Math.min(W, H);
    gl.uniform1f(d.T, t); gl.uniform1f(d.ROT, this.rot); gl.uniform1f(d.L, c.L); gl.uniform1f(d.E, c.E); gl.uniform1f(d.W, c.W);
    gl.uniform1f(d.RAD, R * m / H); gl.uniform1f(d.ASP, H / W); gl.uniform1f(d.PX, Math.max(1, m / 260)); gl.uniform3f(d.B, c.B[0], c.B[1], c.B[2]);
    gl.drawArrays(gl.POINTS, 0, this.o.count);
    gl.disableVertexAttribArray(this.aP); gl.disableVertexAttribArray(this.aS);
    if (!rm) this.raf = requestAnimationFrame(this.frame);
  }
}
window.ChandraNebula = ChandraNebula;
/* @end nebula.orb */
})();
