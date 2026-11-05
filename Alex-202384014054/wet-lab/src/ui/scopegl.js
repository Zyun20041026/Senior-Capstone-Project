// Alex 202384014054
// Microscope image formation in WebGL2.
// Pass 1 draws every cell as an instanced sprite into an RGBA8 "specimen"
// buffer: R = optical thickness (phase), G = stain absorbance, B = GFP,
// A = coverage. Each sprite already carries its own defocus blur, because the
// cells sit at different depths. Pass 2 turns that into a phase-contrast,
// bright-field or fluorescence image with halos, vignetting, grain and the
// round field stop.

const VS1 = `#version 300 es
layout(location=0) in vec2 corner;
layout(location=1) in vec4 a;   // x, y (px), size (px), angle
layout(location=2) in vec4 b;   // kind, blur (px), gfp, seed
uniform vec2 res;
out vec2 uv; out vec4 vb; out float vSize;
void main(){
  float pad = 1.0 + b.y / max(a.z, 1.0) * 2.2;
  vec2 c = corner * pad;
  float s = sin(a.w), co = cos(a.w);
  vec2 p = a.xy + mat2(co, s, -s, co) * c * a.z;
  uv = c; vb = b; vSize = a.z;
  gl_Position = vec4(p / res * 2.0 - 1.0, 0.0, 1.0);
  gl_Position.y = -gl_Position.y;
}`;

const FS1 = `#version 300 es
precision highp float;
in vec2 uv; in vec4 vb; in float vSize;
out vec4 o;
float hash(float n){ return fract(sin(n) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  float a = hash(dot(i, vec2(1.0, 57.0))), b = hash(dot(i + vec2(1,0), vec2(1.0, 57.0))), c = hash(dot(i + vec2(0,1), vec2(1.0, 57.0))), d = hash(dot(i + vec2(1,1), vec2(1.0, 57.0)));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
void main(){
  float kind = vb.x, blur = vb.y / max(vSize, 1.0), seed = vb.w;
  float soft = 0.035 + blur;
  vec2 p = uv;
  float ang = atan(p.y, p.x);
  float phase = 0.0, absb = 0.0, gfp = 0.0, cov = 0.0;
  if (kind < 0.5) {
    // adherent epithelial cell: rounded polygon, nucleus with nucleoli
    vec2 q = p * vec2(1.0, 1.15 + hash(seed) * 0.45);
    float r = length(q);
    float edge = 0.8 + 0.07 * sin(ang * 5.0 + seed * 6.0) + 0.05 * sin(ang * 3.0 + seed * 2.0) + 0.06 * (noise(p * 3.0 + seed) - 0.5);
    float body = 1.0 - smoothstep(edge - soft, edge + soft, r);
    vec2 nc = p - vec2(0.1 * (hash(seed + 2.0) - 0.5), 0.06 * (hash(seed + 5.0) - 0.5));
    float nuc = 1.0 - smoothstep(0.3 - soft, 0.3 + soft, length(nc * vec2(1.0, 1.2)));
    float nl = 0.0;
    for (int i = 0; i < 2; i++) { float fi = float(i); vec2 c = nc - 0.12 * vec2(cos(seed + fi * 2.4), sin(seed * 1.3 + fi * 2.4)); nl = max(nl, 1.0 - smoothstep(0.045 - soft * 0.5, 0.06 + soft, length(c))); }
    float gran = noise(p * 18.0 + seed * 9.0) * body * (1.0 - nuc);
    phase = body * 0.3 + nuc * 0.15 + nl * nuc * 0.2 + gran * 0.07;
    cov = body; gfp = vb.z * body * (0.6 + 0.4 * nuc);
  } else if (kind < 1.5) {
    // rounded / floating / mitotic: thick sphere
    float r = length(p);
    float body = 1.0 - smoothstep(0.62 - soft, 0.62 + soft, r);
    float dome = sqrt(max(0.0, 1.0 - (r / 0.62) * (r / 0.62)));
    phase = body * (0.45 + 0.4 * dome);
    cov = body; gfp = vb.z * body;
  } else if (kind < 2.5) {
    // dead / apoptotic: shrunken, blebbed, granular
    float r = length(p) + 0.12 * (noise(p * 9.0 + seed) - 0.5);
    float body = 1.0 - smoothstep(0.5 - soft, 0.5 + soft, r);
    float bleb = 0.0;
    for (int i = 0; i < 4; i++) { float fi = float(i); vec2 c = 0.42 * vec2(cos(seed * 7.0 + fi * 1.7), sin(seed * 5.0 + fi * 2.1)); bleb = max(bleb, 1.0 - smoothstep(0.14 - soft, 0.14 + soft, length(p - c))); }
    body = max(body, bleb);
    phase = body * 0.55; absb = body * vb.z; cov = body;
  } else if (kind < 3.5) {
    // bacterium: short rod
    vec2 q = p * vec2(1.0, 3.2);
    float body = 1.0 - smoothstep(0.7 - soft, 0.7 + soft, length(q));
    phase = body * 0.7; cov = body;
  } else if (kind < 4.5) {
    // suspended cell in a counting chamber (unstained): smooth sphere
    float r = length(p);
    float body = 1.0 - smoothstep(0.6 - soft, 0.6 + soft, r);
    float dome = sqrt(max(0.0, 1.0 - (r / 0.6) * (r / 0.6)));
    phase = body * (0.35 + 0.45 * dome); cov = body;
  } else {
    // trypan-blue stained dead cell: dark blue, slightly irregular
    float r = length(p) + 0.06 * (noise(p * 8.0 + seed) - 0.5);
    float body = 1.0 - smoothstep(0.58 - soft, 0.58 + soft, r);
    phase = body * 0.3; absb = body * (0.75 + 0.2 * hash(seed)); cov = body;
  }
  // defocus spreads energy: lower peak as the sprite blurs
  float k = 1.0 / (1.0 + blur * 3.0);
  o = vec4(phase * k, absb * k, gfp * k, cov * k);
}`;

const VS2 = `#version 300 es
layout(location=0) in vec2 corner;
out vec2 uv;
void main(){ uv = corner * 0.5 + 0.5; gl_Position = vec4(corner, 0.0, 1.0); }`;

const FS2 = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D spec;
uniform vec2 res;
uniform float mode;      // 0 phase, 1 bright, 2 fluorescence
uniform float light, expo, t, defocus, grid, acid, formazan;
uniform vec2 stagePx;    // stage offset in px for the grid
uniform float pxPerMm;
out vec4 o;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec4 S(vec2 p){ return texture(spec, p); }
vec4 blurS(vec2 p, float r){
  vec4 s = vec4(0.0); float w = 0.0;
  for (int i = 0; i < 12; i++) { float a = float(i) * 0.5236; vec2 d = vec2(cos(a), sin(a)) * r / res; s += S(p + d); s += S(p + d * 0.5); w += 2.0; }
  return s / w;
}
// Neubauer ruling: a 3 × 3 mm grid; the four corner squares in 4 × 4, the
// centre in 5 × 5, each large square bounded by triple lines.
float ruling(vec2 px){
  vec2 mm = vec2(px.x + stagePx.x, stagePx.y - px.y) / pxPerMm;
  if (mm.x < -0.02 || mm.y < -0.02 || mm.x > 3.02 || mm.y > 3.02) return 0.0;
  vec2 f = abs(fract(mm + 0.5) - 0.5) * pxPerMm;
  float line = 1.0 - smoothstep(0.55, 1.4, min(f.x, f.y));
  vec2 f2 = abs(fract(mm + 0.5 + 0.0055) - 0.5) * pxPerMm;
  vec2 f3 = abs(fract(mm + 0.5 - 0.0055) - 0.5) * pxPerMm;
  line = max(line, 0.7 * (1.0 - smoothstep(0.4, 1.2, min(min(f2.x, f2.y), min(f3.x, f3.y)))));
  vec2 cell = floor(clamp(mm, 0.0, 2.999));
  bool corner = mod(cell.x, 2.0) == 0.0 && mod(cell.y, 2.0) == 0.0;
  bool centre = cell.x == 1.0 && cell.y == 1.0;
  if (corner) { vec2 q = abs(fract(mm * 4.0 + 0.5) - 0.5) * pxPerMm / 4.0; line = max(line, 0.55 * (1.0 - smoothstep(0.3, 1.0, min(q.x, q.y)))); }
  if (centre) { vec2 q = abs(fract(mm * 5.0 + 0.5) - 0.5) * pxPerMm / 5.0; line = max(line, 0.5 * (1.0 - smoothstep(0.3, 1.0, min(q.x, q.y)))); }
  return line;
}
void main(){
  vec2 px = uv * res;
  // Pass 1 already wrote the specimen with y down (its vertex shader flips
  // clip y), so it is sampled as is: a cell drawn at canvas y sits at y, where
  // the counting overlay, the grid and clicks look for it.
  vec2 p = uv;
  vec4 s = S(p);
  vec4 sb = blurS(p, 4.5);
  vec4 sw = blurS(p, 14.0);
  float grain = (hash(px + t) - 0.5) * 0.035;
  vec3 col;
  if (mode < 0.5) {
    // positive phase contrast: thin cytoplasm dark, thick cells bright with halo
    float ph = s.r;
    float val = 0.6 - 0.85 * ph + 1.9 * max(0.0, sb.r - ph) - 0.45 * max(0.0, ph - sb.r) + 1.4 * max(0.0, ph - 0.55) + 0.25 * max(0.0, sw.r - sb.r);
    val += 0.18 * defocus * (sb.r - ph);
    vec3 bg = mix(vec3(0.66, 0.65, 0.61), vec3(0.72, 0.66, 0.42), acid);
    col = bg * (val / 0.62) * light;
    col *= 1.0 - 0.6 * s.g * vec3(0.7, 0.45, 0.1);
  } else if (mode < 1.5) {
    // bright field: unstained cells nearly invisible in focus, rings when defocused
    float ph = s.r;
    float edge = (sb.r - ph);
    vec3 bg = vec3(0.93, 0.92, 0.88);
    bg = mix(bg, vec3(0.95, 0.72, 0.42), formazan);
    bg = mix(bg, vec3(0.86, 0.82, 0.6), acid);
    float g = grid > 0.5 ? ruling(px) : 0.0;
    col = bg * (1.0 - 0.06 * ph + 0.9 * edge * (0.35 + defocus)) * light;
    col *= 1.0 - s.g * vec3(0.78, 0.6, 0.12) * 1.1;
    col *= 1.0 - 0.75 * g;
    col += vec3(0.08) * max(0.0, ph - 0.55);
  } else {
    float f = (s.b * 0.8 + sb.b * 0.5 + sw.b * 0.25) * expo;
    col = vec3(0.12, 1.0, 0.32) * f + vec3(0.004, 0.01, 0.006);
    col = 1.0 - exp(-col * 2.2);
    grain *= 0.5;
  }
  col += grain;
  // vignette and the round field stop
  vec2 c = uv - 0.5;
  float r = length(c * vec2(res.x / res.y, 1.0)) / 0.5;
  col *= 1.0 - 0.42 * smoothstep(0.55, 1.0, r);
  float stop = 1.0 - smoothstep(0.985, 1.0, r);
  o = vec4(col * stop, 1.0);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}

export function scopeGL(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false });
  if (!gl) return null;
  const p1 = program(gl, VS1, FS1), p2 = program(gl, VS2, FS2);
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const inst = gl.createBuffer();
  const vao1 = gl.createVertexArray();
  gl.bindVertexArray(vao1);
  gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, inst);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 0); gl.vertexAttribDivisor(1, 1);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16); gl.vertexAttribDivisor(2, 1);
  const vao2 = gl.createVertexArray();
  gl.bindVertexArray(vao2);
  gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  let tex = null, fb = null, W = 0, H = 0;
  const target = (w, h) => {
    if (w === W && h === H) return;
    W = w; H = h;
    if (tex) { gl.deleteTexture(tex); gl.deleteFramebuffer(fb); }
    tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  };
  const U = (p, n) => gl.getUniformLocation(p, n);
  const u1 = { res: U(p1, 'res') };
  const u2 = Object.fromEntries(['spec', 'res', 'mode', 'light', 'expo', 't', 'defocus', 'grid', 'acid', 'formazan', 'stagePx', 'pxPerMm'].map((n) => [n, U(p2, n)]));
  return {
    // cells: Float32Array of 8 floats per cell (x, y, size, angle, kind, blur, gfp/stain, seed), in device px
    draw(cells, n, o) {
      const w = canvas.width, h = canvas.height;
      target(w, h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND); gl.blendEquation(gl.MAX); gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(p1);
      gl.uniform2f(u1.res, w, h);
      gl.bindBuffer(gl.ARRAY_BUFFER, inst);
      gl.bufferData(gl.ARRAY_BUFFER, cells.subarray(0, n * 8), gl.DYNAMIC_DRAW);
      gl.bindVertexArray(vao1);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
      gl.blendEquation(gl.FUNC_ADD); gl.disable(gl.BLEND);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.useProgram(p2);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(u2.spec, 0);
      gl.uniform2f(u2.res, w, h);
      gl.uniform1f(u2.mode, o.mode); gl.uniform1f(u2.light, o.light); gl.uniform1f(u2.expo, o.expo);
      gl.uniform1f(u2.t, o.t); gl.uniform1f(u2.defocus, o.defocus); gl.uniform1f(u2.grid, o.grid ? 1 : 0);
      gl.uniform1f(u2.acid, o.acid || 0); gl.uniform1f(u2.formazan, o.formazan || 0);
      gl.uniform2f(u2.stagePx, o.stagePx[0], o.stagePx[1]); gl.uniform1f(u2.pxPerMm, o.pxPerMm);
      gl.bindVertexArray(vao2);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
    },
    lost: () => gl.isContextLost(),
  };
}
