"use client";

import { useEffect, useRef } from "react";

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = (aPos * 0.5 + 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const NOISE = `
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p = p * 2.0 + 17.0;
    a *= 0.5;
  }
  return v;
}
`;

function effectFragment(effect, dark, quality) {
  const pal = dark
    ? { bg: "vec3(0.035, 0.033, 0.032)", a: "vec3(0.78, 0.47, 0.29)", b: "vec3(0.51, 0.36, 0.56)", c: "vec3(0.25, 0.35, 0.55)", hi: "vec3(0.94, 0.86, 0.74)" }
    : { bg: "vec3(0.97, 0.965, 0.945)", a: "vec3(0.82, 0.46, 0.28)", b: "vec3(0.58, 0.45, 0.62)", c: "vec3(0.42, 0.55, 0.72)", hi: "vec3(0.98, 0.93, 0.86)" };
  const low = quality === "low" ? "2" : "3";
  const vecs = "varying vec2 vUv;\nuniform float uT;\nuniform float uMix;\n" + NOISE + "\n";

  if (effect === "nebula") {
    return `precision mediump float;
${vecs}
vec3 orb(vec2 uv, vec2 center, float r, vec3 col, float depth) {
  float d = length(uv - center);
  float glow = exp(-d * d / (2.0 * r * r)) * depth;
  return col * glow;
}
void main() {
  vec2 uv = vUv - 0.5;
  uv.x *= 1.8;
  float t = uT * 0.08;
  vec3 col = ${pal.bg};
  float sweep = (vUv.y + vUv.x * 0.35);
  float band = smoothstep(0.18, 0.9, sweep + 0.12 * sin(t * 0.8 + vUv.x * 6.0));
  col = mix(col, ${pal.c} * 0.12, band);
  vec2 orb1 = vec2(sin(t * 0.6) * 0.28, cos(t * 0.45) * 0.20 - 0.05);
  vec2 orb2 = vec2(cos(t * 0.35 + 2.0) * 0.34, sin(t * 0.3 + 1.0) * 0.26 + 0.1);
  vec2 orb3 = vec2(sin(t * 0.22 + 4.0) * 0.20, cos(t * 0.26 + 3.0) * 0.30 - 0.15);
  col += orb(uv, orb1, 0.24, ${pal.a} * 0.35, 0.7);
  col += orb(uv, orb2, 0.20, ${pal.b} * 0.30, 0.55);
  col += orb(uv, orb3, 0.16, ${pal.c} * 0.30, 0.85);
  for (int i = 0; i < ${low}; i++) {
    float fi = float(i);
    float px = fract(hash(vec2(fi, 3.7)) * 3.14159);
    float py = fract(hash(vec2(fi, 9.1)) * 2.0);
    float tw = 0.4 + 0.6 * sin(t * 1.6 + fi * 7.0);
    col += ${pal.hi} * tw * 0.10 * exp(-pow((vUv.x - px) * 26.0, 2.0)) * exp(-pow((vUv.y - fract(py - t * 0.02)) * 26.0, 2.0));
  }
  col = mix(col, ${pal.bg}, 0.25);
  float vig = 1.0 - 0.35 * smoothstep(0.55, 1.25, length(uv));
  col *= vig;
  gl_FragColor = vec4(col, uMix);
}`;
  }

  if (effect === "threads") {
    return `precision mediump float;
${vecs}
vec3 glow(vec2 uv, vec2 a, vec2 b, vec3 col, float w) {
  vec2 ab = b - a;
  float t = clamp(dot(uv - a, ab) / dot(ab, ab), 0.0, 1.0);
  vec2 p = a + ab * t;
  float d = length(uv - p);
  return col * exp(-d * d / (w * w)) * (0.25 + 0.75 * (1.0 - t));
}
void main() {
  vec2 uv = vUv - 0.5;
  uv.x *= 1.8;
  float t = uT * 0.1;
  vec3 col = ${pal.bg};
  for (int i = 0; i < ${low}; i++) {
    float fi = float(i);
    vec2 a = vec2(-0.6, fract(hash(vec2(fi, 2.0)) * 2.4) - 0.7);
    float curve = sin(fi * 2.7) * 0.22;
    vec2 b = vec2(0.6, a.y + 0.55 + 0.2 * sin(t * 0.8 + fi));
    vec2 m = vec2(0.0, a.y + 0.28 + curve * sin(t * 0.9 + fi * 3.1));
    vec2 q1 = a + (m - a) * 2.0;
    vec2 q2 = m + (b - m) * 2.0;
    vec2 prev = a;
    float step = 0.08;
    for (int s = 0; s < 14; s++) {
      float f = float(s) * step;
      vec2 c1 = mix(mix(a, q1, f), mix(q1, q2, f), f);
      float g = f + step;
      vec2 c2 = mix(mix(a, q1, g), mix(q1, q2, g), g);
      float w = 0.015 + 0.012 * (0.5 + 0.5 * vnoise(vec2(f * 6.0, fi * 3.0) + t));
      vec3 cc = mix(${pal.a}, ${pal.b}, fract(fi * 0.618));
      if (mod(fi, 2.0) < 1.0) cc = mix(${pal.c}, ${pal.a}, fract(fi * 0.37));
      col += glow(uv, c1, c2, cc, w) * 0.85;
      prev = c2;
    }
    float px = fract(hash(vec2(fi, 5.3)) * 4.0);
    float py = fract(fract(hash(vec2(fi, 8.9)) * 7.0) + t * 0.015 * (0.6 + fract(fi * 0.3)));
    float tw = 0.35 + 0.65 * sin(t * 2.2 + fi * 13.0);
    col += ${pal.hi} * tw * 0.07 * exp(-pow((vUv.x - px + 0.5) * 34.0, 2.0)) * exp(-pow((vUv.y - py) * 34.0, 2.0));
  }
  float vig = 1.0 - 0.3 * smoothstep(0.6, 1.3, length(uv));
  col *= vig;
  gl_FragColor = vec4(col, uMix);
}`;
  }

  // aurora (default)
  return `precision mediump float;
${vecs}
void main() {
  vec2 uv = vUv - 0.5;
  uv.x *= 1.8;
  float t = uT * 0.1;
  vec3 col = ${pal.bg};
  for (int i = 0; i < ${low}; i++) {
    float fi = float(i);
    float bx = -0.65 + 0.325 * fi;
    float sway = 0.09 * sin(t * 0.5 + fi * 2.2);
    float x = bx + sway + 0.04 * vnoise(vec2(uv.y * 1.4, t * 0.4 + fi * 3.0));
    float w = 0.055 + 0.02 * sin(t * 0.7 + fi * 4.0);
    float beam = exp(-pow((uv.x - x) / w, 2.0));
    float fall = smoothstep(0.75, 0.02, abs(uv.y + 0.05)) * 0.5 + 0.25;
    float breathe = 0.55 + 0.45 * sin(t * 0.4 + fi * 1.7);
    col += mix(${pal.a}, ${pal.b}, fract(fi * 0.618)) * beam * fall * breathe * 0.55;
  }
  float aur = fbm(vec2(vUv.x * 1.7, vUv.y * 2.4) + vec2(t * 0.3, t * 0.16));
  vec3 aurCol = mix(${pal.b}, ${pal.c}, smoothstep(0.3, 0.8, aur));
  float aurMask = smoothstep(0.25, 0.85, fbm(vec2(vUv.x * 2.2 - t * 0.22, vUv.y * 3.1 + t * 0.1)));
  col += aurCol * aurMask * 0.22 * (0.6 + 0.4 * sin(t * 0.3));
  float grain = hash(vUv * 420.0 + t) * 0.05;
  col += grain;
  float vig = 1.0 - 0.42 * smoothstep(0.5, 1.35, length(uv));
  col *= vig;
  gl_FragColor = vec4(col, uMix);
}`;
}

const EFFECTS = ["aurora", "threads", "nebula"];
const TAB_EFFECT = { chat: 0, ide: 1, camera: 2, auto: 2, studio: 1 };

function qualityLevel() {
  try {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return "static";
    const coarse = window.matchMedia?.("(pointer: coarse)")?.matches;
    const mem = navigator.deviceMemory;
    const cores = navigator.hardwareConcurrency || 8;
    if (coarse || (mem && mem < 4) || cores <= 4) return "low";
    return "high";
  } catch {
    return "low";
  }
}

export default function Backdrop({ tab, dark }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
    if (!gl) {
      canvas.parentElement?.classList.add("backdrop-static");
      return;
    }
    const quality = qualityLevel();
    if (quality === "static") {
      canvas.parentElement?.classList.add("backdrop-static");
      return;
    }

    const state = {
      gl,
      quality,
      time: 0,
      from: TAB_EFFECT[tab] ?? 0,
      to: TAB_EFFECT[tab] ?? 0,
      mix: 1,
      raf: 0,
      last: 0,
      running: true,
      programs: [],
      uniforms: [],
    };
    stateRef.current = state;

    const compile = (src, type) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    };

    const build = (effect) => {
      const frag = effectFragment(effect, dark, quality);
      const p = gl.createProgram();
      gl.attachShader(p, compile(VERT, gl.VERTEX_SHADER));
      gl.attachShader(p, compile(frag, gl.FRAGMENT_SHADER));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(p));
        return null;
      }
      gl.useProgram(p);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(p, "aPos");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const uT = gl.getUniformLocation(p, "uT");
      const uMix = gl.getUniformLocation(p, "uMix");
      return { p, uT, uMix };
    };

    EFFECTS.forEach((e) => {
      const prog = build(e);
      if (prog) state.programs.push(prog);
    });
    if (state.programs.length === 0) {
      canvas.parentElement?.classList.add("backdrop-static");
      return;
    }

    const resize = () => {
      const dpr = quality === "high" ? Math.min(window.devicePixelRatio || 1, 1.75) : 1;
      const w = Math.max(2, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(2, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };
    resize();
    window.addEventListener("resize", resize);

    const tick = (now) => {
      if (!state.running) return;
      state.raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - state.last) / 1000 || 0.016);
      state.last = now;
      state.time += dt;
      const target = TAB_EFFECT[tabRef.current] ?? 0;
      if (target !== state.to) {
        state.from = state.to;
        state.to = target;
        state.mix = 0;
      }
      if (state.mix < 1) state.mix = Math.min(1, state.mix + dt * 1.6);
      const fpsCap = quality === "low" ? 30 : 60;
      if (now - state.lastDraw < 1000 / fpsCap) return;
      state.lastDraw = now;

      gl.viewport(0, 0, canvas.width, canvas.height);
      const a = state.programs[state.from] || state.programs[0];
      const b = state.programs[state.to] || a;
      if (!a || !b) return;
      const m = state.mix;
      if (a === b || m >= 1) {
        gl.useProgram(a.p);
        gl.uniform1f(a.uT, state.time);
        gl.uniform1f(a.uMix, 1);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      } else {
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
gl.useProgram(a.p);
        gl.uniform1f(a.uT, state.time);
        gl.uniform1f(a.uMix, 1);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.useProgram(b.p);
        gl.uniform1f(b.uT, state.time);
        gl.uniform1f(b.uMix, m);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.disable(gl.BLEND);
      }
    };

    const onVis = () => {
      state.running = !document.hidden;
      if (state.running && state.raf === 0) {
        state.last = 0;
        state.raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    state.raf = requestAnimationFrame(tick);

    return () => {
      state.running = false;
      cancelAnimationFrame(state.raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark]);

  const tabRef = useRef(tab);
  tabRef.current = tab;

  return (
    <div className={`backdrop ${dark ? "backdrop-dark" : "backdrop-light"}`} aria-hidden="true">
      <canvas ref={canvasRef} />
      <div className="backdrop-grain" />
    </div>
  );
}

