"use client";

import { useEffect, useRef } from "react";

type Props = { yesShare: number };

const vertexSource = `
attribute vec2 position;
varying vec2 uv;
void main() { uv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }
`;

const fragmentSource = `
precision highp float;
uniform float uTime;
uniform float uShare;
uniform vec2 uResolution;
varying vec2 uv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 p = (uv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
  float r = length(p);
  float mask = 1.0 - smoothstep(0.44, 0.52, r);
  if (mask <= 0.0) { gl_FragColor = vec4(0.0); return; }

  float angle = mix(-0.78, 0.78, clamp(uShare, 0.0, 1.0));
  vec2 boundary = vec2(cos(angle), sin(angle));
  float side = dot(p, boundary);
  float wave = sin(p.y * 18.0 + uTime * 0.65) * 0.009;
  float edge = 1.0 - smoothstep(0.0, 0.018, abs(side + wave));
  vec3 blue = vec3(0.20, 0.31, 0.95);
  vec3 lime = vec3(0.70, 0.86, 0.08);
  vec3 color = side < 0.0 ? blue : lime;

  float ring = 1.0 - smoothstep(0.0, 0.008, abs(r - (0.40 + 0.018 * sin(uTime * 1.7))));
  float ping = (1.0 - smoothstep(0.0, 0.018, abs(fract(r * 5.0 - uTime * 0.16) - 0.5))) * 0.22;
  vec2 grid = floor((p + 0.52) * 34.0);
  float dotField = step(0.82, hash(grid + floor(uTime * 0.03))) * (1.0 - smoothstep(0.05, 0.48, r)) * 0.16;
  float alpha = clamp(mask * (edge * 0.78 + ring * 0.30 + ping + dotField), 0.0, 1.0);
  gl_FragColor = vec4(color * alpha, alpha);
}
`;

export function SignalOrbShader({ yesShare }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shareRef = useRef(yesShare / 100);

  useEffect(() => {
    shareRef.current = yesShare / 100;
  }, [yesShare]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: true, antialias: true });
    if (!gl) return;
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
    };
    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) return;
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "position");
    const time = gl.getUniformLocation(program, "uTime");
    const share = gl.getUniformLocation(program, "uShare");
    const resolution = gl.getUniformLocation(program, "uResolution");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let displayed = shareRef.current;
    const resize = () => {
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(canvas.clientWidth * scale));
      const height = Math.max(1, Math.floor(canvas.clientHeight * scale));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };
    const render = (now: number) => {
      resize();
      displayed += (shareRef.current - displayed) * 0.08;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1f(time, reduced ? 0 : now / 1000);
      gl.uniform1f(share, displayed);
      gl.uniform2f(resolution, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!reduced) frame = requestAnimationFrame(render);
    };
    render(reduced ? 0 : performance.now());
    return () => cancelAnimationFrame(frame);
  }, []);

  return <canvas ref={canvasRef} className="signal-orb-shader" aria-hidden="true" />;
}
