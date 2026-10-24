/* ============ Aurora: Chandra's sky (1.6) ============
   One quiet light source behind everything, in the calm-technology spirit: content first, the background only
   breathes. A WebGL1 fragment shader draws
   - deep space, navy to near-black;
   - two slow aurora curtains (fbm noise) in Chandra's blues, periwinkle and ice, brightest near the top;
   - the planet's dark arc across the bottom with a thin rim of light: the eclipse that is Chandra's mark;
   - two layers of stars that drift a little with the pointer (parallax), and twinkle;
   - fine animated grain, so the gradients never band.
   It follows Chandra's state: livelier while it thinks and works, cooler while it listens, and warmer (star-white
   rim, a lift that follows the real voice level) while it speaks.
   Costs: 30 fps at most, drawn at reduced resolution and stretched (the scene is soft by design), paused while the
   window is hidden or something covers it. Reduce motion draws one still frame. Without WebGL, or in Lite mode,
   the CSS fallback in calm.css stands in. */
(function () {
"use strict";
/* @src aurora.sky: WebGL aurora background (state-reactive, parallax stars, grain) */
const VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
const FRAG = `precision mediump float;
uniform vec2 R;uniform float T,E,W,L,C,A;uniform vec2 M;
float h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+vec2(17.,9.);a*=.5;}return v;}
float stars(vec2 uv,float s,float t){vec2 g=uv*s,id=floor(g),f=fract(g)-.5;float r=h(id);
 if(r<.975)return 0.;vec2 o=vec2(h(id+3.1),h(id+7.7))-.5;float d=length(f-o*.6);
 float tw=.55+.45*sin(t*(1.+r*3.)+r*40.);return smoothstep(.09,.0,d)*tw*(r-.975)*40.;}
void main(){
 vec2 uv=gl_FragCoord.xy/R;float asp=R.x/R.y;vec2 q=vec2((uv.x-.5)*asp,uv.y);
 float t=T*(.035+.05*E);
 vec3 col=mix(vec3(.004,.008,.024),vec3(.02,.04,.11),pow(uv.y,1.4));
 // soft colour fields under everything: slow mesh-gradient light, the way modern product skies feel (silky, never noisy)
 vec2 f1=vec2(-.55+.18*sin(t*.7),.78+.05*cos(t*.5)),f2=vec2(.6+.15*cos(t*.6),.70+.06*sin(t*.8)),f3=vec2(.05*sin(t*.4),.95);
 col+=vec3(.20,.32,.95)*exp(-dot(q-f1,q-f1)*2.6)*(.11+.07*E)*A;
 col+=vec3(.45,.36,.95)*exp(-dot(q-f2,q-f2)*3.0)*(.08+.05*E+.08*W)*A;
 col+=mix(vec3(.45,.75,1.),vec3(.30,.90,.95),C)*exp(-dot(q-f3,q-f3)*4.0)*(.05+.06*C)*A;
 // aurora curtains: three silky bands whose height wanders slowly, hue drifting from blue to violet to ice
 for(int k=0;k<3;k++){float fk=float(k);
  float x=q.x*(.9+fk*.35)+fk*2.9;
  float w=fbm(vec2(x*.7,t*.8+fk*5.))*.6+fbm(vec2(x*1.6-t*.4,fk*3.))*.15;
  float y=uv.y-(.60+fk*.075)-w*.30;
  float band=exp(-y*y*(18.+fk*14.))*(.6+.4*fbm(vec2(x*3.,t*1.2+fk*9.)));
  float rays=.82+.18*n(vec2(x*10.,uv.y*1.5-t*1.5));
  float hue=.5+.5*sin(x*.8+t*.9+fk*2.1);
  vec3 c1=mix(vec3(.18,.34,1.),vec3(.50,.42,1.),hue);vec3 c2=mix(vec3(.62,.82,1.),vec3(.35,.92,.98),C);
  col+=mix(c1,c2,smoothstep(-.10,.20,y))*band*rays*(.26+.20*E+.10*C)*(1.-fk*.25)*A;}
 // stars, two depths, drifting with the pointer
 col+=vec3(.75,.85,1.)*stars(uv*vec2(asp,1.)+M*.006,70.,T)*1.1;
 col+=vec3(.9,.92,1.)*stars(uv*vec2(asp,1.)+M*.014+7.,34.,T*.7)*1.4;
 // the planet: a dark arc across the bottom with a thin rim of light (warmer while Chandra speaks)
 vec2 pc=vec2(0.,-1.55);float d=length(vec2(q.x,uv.y)-pc)-1.72;
 float rim=exp(-abs(d)*55.)*(.55+.35*E+.6*W*(.6+L));float halo=exp(-max(d,0.)*7.)*(.10+.12*W);
 vec3 rimc=mix(vec3(.35,.55,1.),vec3(1.,.93,.78),W);
 col+=rimc*(rim+halo);col*=mix(1.,.06,smoothstep(-.004,-.03,d));
 // vignette and grain
 col*=1.-.35*pow(length((uv-.5)*vec2(1.1,1.3)),2.);
 col+=(h(gl_FragCoord.xy+fract(T)*vec2(91.,37.))-.5)*.012;
 gl_FragColor=vec4(col,1.);}`;

const PHASE = { idle: [0.2, 0, 0], waiting: [0.3, 0, 0], listening: [0.45, 0, 1], thinking: [0.85, 0, 0.2], working: [1, 0, 0.2],
  responding: [0.7, 0.3, 0], speaking: [0.5, 1, 0], interrupted: [0.1, 0, 0], error: [0.1, 0, 0] };
const reduced = () => document.body.classList.contains("rm") || (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);

class ChandraAurora {
  constructor(host, opts) {
    this.o = Object.assign({ scale: 0.55, maxFps: 24, soft: false }, opts || {});
    if (this.o.soft) { this.o.scale = 0.35; this.o.maxFps = 12; }
    this.host = host; this.ok = false; this.paused = false; this.raf = 0; this.last = 0; this.t0 = performance.now();
    this.cur = [0.2, 0, 0]; this.goal = [0.2, 0, 0]; this.m = [0, 0]; this.mg = [0, 0]; this.alpha = 0;
    const cv = this.cv = document.createElement("canvas");
    cv.className = "aurora-canvas"; host.append(cv);
    const gl = this.gl = cv.getContext("webgl", { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: "low-power" });
    if (!gl) { cv.remove(); return; }
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
    const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) { cv.remove(); return; }
    const pr = this.pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { cv.remove(); return; }
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {}; ["R", "T", "E", "W", "L", "C", "A", "M"].forEach(k => this.u[k] = gl.getUniformLocation(pr, k));
    cv.addEventListener("webglcontextlost", e => { e.preventDefault(); this.ok = false; cancelAnimationFrame(this.raf); host.classList.add("aurora-fallback"); });
    this.ok = true;
    this.resize = this.resize.bind(this); this.frame = this.frame.bind(this);
    addEventListener("resize", this.resize, { passive: true }); this.resize();
    addEventListener("pointermove", e => { this.mg = [e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5]; if (reduced()) return; this.kick(); }, { passive: true });
    document.addEventListener("visibilitychange", () => this.kick());
    if (window.ChandraState && ChandraState.subscribe) ChandraState.subscribe(s => { this.goal = (PHASE[s && s.phase] || PHASE.idle).slice(); this.kick(); });
    this.kick();
  }
  resize() {
    const k = Math.min(1, this.o.scale * Math.min(1.5, window.devicePixelRatio || 1));
    const w = Math.max(2, Math.round(innerWidth * k)), h = Math.max(2, Math.round(innerHeight * k));
    if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; this.gl.viewport(0, 0, w, h); }
    this.kick(true);
  }
  set(o) { if (o && "paused" in o) { this.paused = !!o.paused; this.kick(); } }
  kick(once) { if (!this.ok) return; if (!this.raf) this.raf = requestAnimationFrame(this.frame); if (once) this.once = true; }
  frame(now) {
    this.raf = 0;
    if (!this.ok) return;
    const still = this.paused || document.hidden || reduced();
    if (!still && now - this.last < 1000 / this.o.maxFps - 1) { this.raf = requestAnimationFrame(this.frame); return; }
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0.016; this.last = now;
    for (let i = 0; i < 3; i++) this.cur[i] += (this.goal[i] - this.cur[i]) * (1 - Math.exp(-dt * 2.2));
    this.m[0] += (this.mg[0] - this.m[0]) * (1 - Math.exp(-dt * 3)); this.m[1] += (this.mg[1] - this.m[1]) * (1 - Math.exp(-dt * 3));
    this.alpha = Math.min(1, this.alpha + dt * 0.6);                 /* the sky fades in once, on start */
    const lvl = window.ChandraPresence ? Math.min(1, ChandraPresence.level || 0) : 0;
    const gl = this.gl, u = this.u, t = reduced() ? 40 : (now - this.t0) / 1000;
    gl.uniform2f(u.R, this.cv.width, this.cv.height); gl.uniform1f(u.T, t);
    gl.uniform1f(u.E, this.cur[0]); gl.uniform1f(u.W, this.cur[1]); gl.uniform1f(u.C, this.cur[2]); gl.uniform1f(u.L, lvl);
    gl.uniform1f(u.A, reduced() ? 1 : this.alpha); gl.uniform2f(u.M, this.m[0] * 60, -this.m[1] * 60);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.once = false;
    if (!still) this.raf = requestAnimationFrame(this.frame);
  }
}
window.ChandraAurora = ChandraAurora;
/* @end aurora.sky */
})();
