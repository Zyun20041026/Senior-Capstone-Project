/*
 * Capsid Lockdown — drawing.
 * Three stacked canvases:
 *   back  (2D)    measuring lines and the far half of the frame, behind the virus
 *   gl    (WebGL) the shell in three layers: a dark body with one plate per
 *                 protein, a smooth mound for every protein that is not locked
 *                 yet, and a few lobes of different sizes on each mound
 *   front (2D)    the near half of the frame, readings, outlines, antibody
 *                 marks, hover and hint overlays
 * Everything is generated in code; there are no image assets.
 */
(function (root) {
  'use strict';
  const { vec, rng32, ico } = root.Capsid;
  const { norm, dot, cross, sub, add, scale, len, tangent, mulMV, axisAngle } = vec;

  const PERSP = 0.14;      // weak perspective, relative to the model's size
  const LIGHT = norm([-0.5, 0.6, 0.62]);
  const MINT = [112, 214, 164], PINK = [201, 170, 181], STEEL = [150, 172, 208], DUSK = [118, 106, 124], HOT = [228, 124, 94], GOLD = [236, 200, 110];
  // one colour per protein chain (codes 1..7), after reference/4: rose, sage, ice, blush, periwinkle, and two more for
  // the strains with many kinds of protein: lilac, sand
  const CHAIN = [[206, 122, 148], [124, 170, 136], [204, 226, 242], [242, 224, 232], [128, 158, 212], [172, 150, 204], [226, 200, 166]];
  const NUM = ['', '#a9c6f3', '#e8d48b', '#f2a27e', '#ee86a6', '#c8a4f4', '#ffffff', '#ffffff', '#ffffff', '#ffffff'];
  const MONO = '"SF Mono", ui-monospace, Menlo, Consolas, "Roboto Mono", monospace';
  const css = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a == null ? 1 : a) + ')';
  const f3 = (c) => 'vec3(' + c.map((x) => (x / 255).toFixed(3)).join(',') + ')';

  const COMMON = `
uniform mat3 u_rot;
uniform vec2 u_res;
uniform vec2 u_center;
uniform float u_px;
uniform float u_persp;
uniform float u_span;
uniform float u_time;
uniform float u_breath;
uniform float u_burst;
uniform float u_build;
uniform float u_dim;
uniform float u_clear;
uniform float u_focus;             // 0..1: while one protein is aimed at, all but it and its neighbours go quiet
const vec3 L = vec3(${LIGHT.map((x) => x.toFixed(4)).join(',')});
// focus: a protein out of the aimed-at neighbourhood (glow below the neighbours' 0.55) fades to a dim
// grey-mauve; marked and exposed proteins and locked plates keep their colour, since they are what the
// player reasons from
float calmK(float glow, float keep, float lock) {
  return u_focus * (1.0 - smoothstep(0.18, 0.45, glow)) * (1.0 - keep) * (1.0 - lock);
}
vec3 calm(vec3 c, float k) {
  float l = dot(c, vec3(0.3, 0.55, 0.15));
  return mix(c, vec3(l) * vec3(0.94, 0.86, 0.92) * 0.6, k * 0.85);
}
vec3 chainCol(float c) { return c < 1.5 ? ${f3(CHAIN[0])} : c < 2.5 ? ${f3(CHAIN[1])} : c < 3.5 ? ${f3(CHAIN[2])} : c < 4.5 ? ${f3(CHAIN[3])} : c < 5.5 ? ${f3(CHAIN[4])} : c < 6.5 ? ${f3(CHAIN[5])} : ${f3(CHAIN[6])}; }
// a protein's line (see setLine): colour packed as r*65536 + g*256 + b; alpha + 2 * (dark backing in tenths);
// width in CSS pixels; drawn share of the way round + 2 * dashes
vec3 lineCol(float pc) {
  float r = floor(pc / 65536.0), g = floor((pc - r * 65536.0) / 256.0);
  return vec3(r, g, pc - r * 65536.0 - g * 256.0) / 255.0;
}
vec4 lineParts(vec4 l) {                       // alpha, dark backing, drawn share, dashes
  float u = floor(l.y * 0.5), d = floor(l.w * 0.5);
  return vec4(l.y - 2.0 * u, u * 0.1, l.w - 2.0 * d, d);
}
`;

  // ---- beads ----
  const VS_PT = COMMON + `
attribute vec3 a_pos;
attribute vec3 a_nrm;             // direction the bead moves in (its protein's normal)
attribute vec3 a_shn;             // direction used for shading
attribute vec4 a_info;            // random seed, radius, dome height, kind (0 protein, 1 spike, 2 spike that hides when facing the viewer, 3 protein detail seen only close up,
                                  // 4 a wet, glossy body: the 交锋's mucus drops)
attribute vec4 a_aux;             // breathing phase, height in the relief 0..1 (tone for spikes); 1 + chain code + shade 0..0.98 for chain colours;
                                  // then where the bead sits on its protein: 0 middle .. 1 border (-1 not on one), and its turn round the middle
attribute vec4 a_state;           // locked, marked, exposed, glow
attribute vec4 a_line;            // the protein's line, packed (see lineParts)
uniform float u_detail;           // 0..1: how far in the view is zoomed, for the close-up detail
varying vec3 v_col;
varying float v_light;
varying float v_seed;
varying float v_size;
varying float v_zr;
varying float v_calm;
varying float v_gloss;
void main() {
  float seed = a_info.x, kind = a_info.w;
  float detail = step(2.5, kind) * (1.0 - step(3.5, kind));
  float own = 1.0 - step(0.5, kind) * (1.0 - step(3.5, kind)) * (1.0 - detail);
  v_gloss = step(3.5, kind);
  float gone = clamp(a_state.x * 1.6 - seed * 0.6, 0.0, 1.0);
  gone = gone * gone * (3.0 - 2.0 * gone);
  float build = clamp(u_build * 1.6 - seed * 0.6, 0.0, 1.0);
  build = 1.0 - pow(1.0 - build, 3.0);
  float breath = sin(u_time * 1.6 + a_aux.x) * u_breath;
  float lift = own * (a_info.z * (1.0 + 0.34 * breath + 0.5 * a_state.z) * (1.0 - gone) - a_info.y * 0.7 * gone);
  vec3 p = a_pos + a_nrm * lift;
  float fly = (1.0 - build) * (0.5 + 1.2 * seed) + u_burst * (0.2 + 1.6 * seed);
  p += normalize(a_nrm + (a_shn - a_nrm) * 0.8) * fly * u_span * 0.9;
  vec3 q = u_rot * p;
  float sc = 1.0 / (1.0 - q.z * u_persp);
  vec2 px = u_center + vec2(q.x, -q.y) * u_px * sc;
  gl_Position = vec4(px.x / u_res.x * 2.0 - 1.0, 1.0 - px.y / u_res.y * 2.0, -q.z / u_span * 0.45, 1.0);
  float size = 2.0 * a_info.y * u_px * sc * build * (1.0 - gone) * (1.0 - 0.8 * u_burst);
  size *= 1.0 + own * (0.08 * breath + 0.14 * a_state.w + 0.12 * a_state.z);
  float toward = (u_rot * a_nrm).z;
  if (kind > 0.5 && kind < 2.5) size *= mix(1.0, smoothstep(0.78, 0.38, toward), u_clear);   // while playing, spikes that point at the viewer step aside
  if (kind > 1.5 && kind < 2.5) size *= smoothstep(0.95, 0.66, toward);
  size *= mix(1.0, u_detail, detail);           // the close-up lumps grow in as the view zooms in
  if (size < 0.6) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  gl_PointSize = size + 2.0;                    // one pixel of margin for the soft edge
  v_zr = size * 0.1125 / (u_px * sc * u_span);  // the ball's radius in depth-buffer units
  float t = a_aux.y, code = t > 1.5 ? floor(t) - 1.0 : 0.0;
  if (code > 0.5) t = fract(a_aux.y) / 0.98;
  // five steps from the grooves to the crests, as in the first version
  vec3 col = mix(vec3(0.47, 0.35, 0.41), vec3(0.66, 0.52, 0.58), smoothstep(0.0, 0.28, t));
  col = mix(col, vec3(0.80, 0.67, 0.72), smoothstep(0.28, 0.52, t));
  col = mix(col, vec3(0.74, 0.77, 0.84), smoothstep(0.52, 0.78, t));
  col = mix(col, vec3(0.90, 0.91, 0.94), smoothstep(0.78, 1.0, t));
  // or one colour per chain, deeper where the chain lies low
  if (code > 0.5) col = chainCol(code) * (0.56 + 0.44 * t);
  col = mix(col, ${f3(HOT)} * (0.72 + 0.4 * t), a_state.y);   // marked proteins wear the resistant colour
  col = mix(col, ${f3(HOT)} * (0.72 + 0.4 * t), a_state.z);
  col = mix(col, vec3(1.0, 0.97, 0.98), 0.34 * a_state.w) * (1.0 + 0.16 * a_state.w);
  vec3 spike = code > 0.5 ? col : mix(vec3(0.46, 0.43, 0.52), vec3(0.62, 0.60, 0.68), a_aux.y);   // fibres and legs may carry a chain colour too
  col = mix(spike, col, own);
  v_calm = calmK(a_state.w, max(a_state.y, a_state.z), a_state.x);
  col = calm(col, v_calm);
  // the protein's line also takes the beads along its border (a filled one takes them all)
  vec4 lp = lineParts(a_line);
  float onEdge = a_aux.z < -0.5 ? 0.0 : max(smoothstep(0.74, 0.97, a_aux.z), step(400.0, a_line.z));
  col = mix(col, lineCol(a_line.x) * 1.05, clamp(lp.x * onEdge, 0.0, 1.0) * 0.5);
  float fog = mix(0.34, 1.0, smoothstep(-1.0, 0.3, q.z / u_span));
  float ao = mix(mix(0.5, 1.0, smoothstep(0.0, 0.6, t)), 1.0, max(1.0 - own, 0.45 * a_state.w));   // grooves sit in shadow
  v_light = mix(0.42, 1.0, (dot(u_rot * a_shn, L) * 0.5 + 0.5) * ao);
  v_col = col * fog * u_dim;
  v_seed = seed;
  v_size = size;
}`;
  // Each granule is a small ball: smooth light across it, a soft antialiased
  // rim, and a fine stipple only where it turns into shadow (none at all when
  // the ball is only a few pixels wide, so small views stay smooth).
  const FS_PT = (fragDepth) => `${fragDepth ? '#extension GL_EXT_frag_depth : enable' : ''}
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec3 v_col;
varying float v_light;
varying float v_seed;
varying float v_size;
varying float v_zr;
varying float v_calm;              // 0..1: quieted by focus, so drawn flatter, with no stipple or highlight
varying float v_gloss;             // 1: wet and glossy (a mucus drop): a crisp highlight and a bright rim on the lit side
uniform float u_grain;
uniform float u_aa;
uniform float u_fuse;              // 1: the balls fuse into lobes, so each shows little shading of its own
uniform float u_toon;              // 1: drawn plainly, a lit face and a shadow with the stipple along the turn
uniform float u_chain;             // 1: coloured by chain, after reference/4: a flat lit face and a shadow that thins into dots
const vec3 L = vec3(${LIGHT.map((x) => x.toFixed(4)).join(',')});
float hash(vec2 p, float seed) { return fract(sin(dot(p, vec2(127.1, 311.7)) + seed * 74.7) * 43758.5453); }
void main() {
  vec2 p = (gl_PointCoord * 2.0 - 1.0) * (v_size + 2.0) / v_size;
  float r = length(p);
  float edge = (1.0 - r) * 0.5 * v_size;        // pixels inside the rim
  float cover = mix(step(0.0, edge), clamp(edge + 0.5, 0.0, 1.0), u_aa);
  if (cover <= 0.0) discard;
  float nz = sqrt(max(0.0, 1.0 - r * r));
  vec3 n = vec3(p.x, -p.y, nz);
  float d = dot(n, L);
  float light = v_light * mix(0.60 + 0.40 * d, 0.70 + 0.30 * d, u_fuse);
  float lit = mix(smoothstep(0.10, 0.80, light), 0.18 + 0.82 * smoothstep(0.40, 0.66, light), u_toon);
  // stipple: only in the half-tones, and only on balls large enough to carry it
  float fine = smoothstep(7.0, 18.0, v_size / u_grain) * (1.0 - v_calm);
  vec2 cell = floor(gl_PointCoord * (v_size + 2.0) / u_grain);
  float dots = step(hash(cell, v_seed), lit);
  float band = mix(1.0 - smoothstep(0.55, 0.95, lit), 1.0 - abs(lit - 0.55) * 2.2, u_toon);
  float tone = mix(lit, dots, mix(mix(0.42, 0.4, u_fuse), 0.75, u_toon) * fine * clamp(band, 0.0, 1.0));
  tone *= mix(1.0, smoothstep(0.0, 0.42, nz), mix(0.5, 0.34, u_fuse));                // the rim falls into shadow
  tone = mix(tone, 0.3 + 0.45 * tone, 0.6 * v_calm);
  float spec = pow(max(0.0, dot(n, normalize(L + vec3(0.0, 0.0, 1.0)))), 22.0) * 0.16 * v_light * (1.0 - 0.7 * u_toon) * (1.0 - v_calm);
  vec3 shade = v_col * 0.20 + vec3(0.040, 0.040, 0.046);
  vec3 col = mix(shade, v_col, tone) + spec * (v_col * 0.5 + 0.2);
  if (u_chain > 0.5) {
    // the lit face is one flat colour; the turn into shadow is stippled; the shadow sinks into a neutral dark ground
    float lc = 0.16 + 0.84 * smoothstep(0.38, 0.68, light);
    lc = mix(lc, 0.3 + 0.45 * lc, 0.6 * v_calm);
    float bc = clamp(1.0 - abs(lc - 0.55) * 2.0, 0.0, 1.0);
    float tc = mix(lc, step(hash(cell, v_seed), lc), 0.8 * fine * bc);
    tc *= mix(1.0, smoothstep(0.0, 0.45, nz), 0.4);
    col = mix(vec3(0.072, 0.072, 0.078), v_col, tc);
  }
  if (v_gloss > 0.5) {
    float hl = smoothstep(0.955, 0.975, dot(n, normalize(L + vec3(0.0, 0.0, 1.0))));
    float sheen = smoothstep(0.42, 0.05, nz) * smoothstep(0.15, 0.7, d);
    col = mix(col, vec3(1.0), clamp(hl * 0.92 + sheen * 0.3, 0.0, 1.0) * (1.0 - v_calm) * step(4.0, v_size));
  }
  gl_FragColor = vec4(col, cover);
  ${fragDepth ? 'gl_FragDepthEXT = gl_FragCoord.z - nz * v_zr;' : ''}
}`;

  // ---- body, plates and mounds ----
  const VS_TRI = COMMON + `
attribute vec3 a_ctr;
attribute vec3 a_off;
attribute vec3 a_nrm;
attribute vec3 a_info;            // random seed, kind (0 body, 1 plate, 2 mound), 0 centre .. 1 rim (mound: 0 groove .. 1 crown)
attribute vec3 a_shn;             // mound: direction used for shading
attribute vec4 a_aux;             // mound: height, breathing phase; then 0 middle .. 1 border of the plate or mound (-1 body), turn round the middle
attribute vec4 a_state;
attribute vec4 a_line;            // the protein's line, packed (see lineParts)
uniform float u_dpr;
varying vec3 v_col;
varying vec2 v_edge;              // 0 middle .. 1 border, turn round the middle
varying vec3 v_lc;                // line colour
varying vec4 v_lp;                // line alpha, dark backing, drawn share, dashes
varying float v_lw;               // line width in device pixels
void main() {
  v_edge = a_aux.zw; v_lc = lineCol(a_line.x); v_lp = lineParts(a_line); v_lw = a_line.z * u_dpr;
  float seed = a_info.x, rim = a_info.z, mound = step(1.5, a_info.y);
  float build = clamp(u_build * 1.6 - seed * 0.6, 0.0, 1.0);
  build = 1.0 - pow(1.0 - build, 3.0);
  float burst = clamp(u_burst * 1.5 - seed * 0.5, 0.0, 1.0);
  float gone = clamp(a_state.x * 1.6 - seed * 0.6, 0.0, 1.0);
  gone = gone * gone * (3.0 - 2.0 * gone);
  float breath = sin(u_time * 1.6 + a_aux.y) * u_breath;
  // a mound stands on its protein and sinks under the plate when the protein is locked
  float lift = mound * (a_aux.x * (1.0 + 0.34 * breath + 0.5 * a_state.z) * (1.0 - gone) * build - 0.03 * u_span * gone);
  vec3 p = a_ctr + a_off * build * (1.0 - burst) + a_nrm * (lift + u_span * (burst * (0.2 + 1.2 * seed) * 0.9 + (1.0 - build) * 0.25));
  vec3 q = u_rot * p;
  float sc = 1.0 / (1.0 - q.z * u_persp);
  vec2 px = u_center + vec2(q.x, -q.y) * u_px * sc;
  gl_Position = vec4(px.x / u_res.x * 2.0 - 1.0, 1.0 - px.y / u_res.y * 2.0, -q.z / u_span * 0.45, 1.0);
  float shade = 0.56 + 0.44 * max(0.0, dot(u_rot * a_nrm, L));
  vec3 raw = vec3(0.235, 0.175, 0.200) * (1.0 - 0.25 * rim);
  vec3 cold = vec3(0.074, 0.094, 0.130) + vec3(0.05, 0.06, 0.085) * rim * rim;
  vec3 col = mix(raw, cold, a_state.x);
  col = mix(col, vec3(0.05, 0.19, 0.14), a_state.y * (1.0 - a_state.x));
  col = mix(col, vec3(0.28, 0.105, 0.08), a_state.z);
  col += vec3(0.085, 0.215, 0.16) * a_state.w * (0.5 + 0.5 * rim);
  vec3 under = mix(vec3(0.026, 0.028, 0.036), vec3(0.105, 0.078, 0.090) * shade, (1.0 - a_state.x) * (1.0 - a_state.z));   // the body: dark under plates, a deep shadow under mounds
  col = mix(under, col * shade, min(1.0, a_info.y));
  // the mound: dusky in the groove, pink on the shoulder, paler on the crown
  float t = rim;
  vec3 mc = mix(vec3(0.30, 0.22, 0.27), vec3(0.60, 0.46, 0.52), smoothstep(0.0, 0.5, t));
  mc = mix(mc, vec3(0.80, 0.66, 0.71), smoothstep(0.5, 1.0, t));
  // or, when the floor is shared out among chains (kind 2 + chain code), each wedge in its chain's colour, a shade deeper
  float code = a_info.y - 2.0;
  if (code > 9.5) mc = chainCol(code - 10.0) * (0.36 + 0.26 * t);     // the 交锋's cells (kind 12 + chain code): the body in its own colour, deeper
  else if (code > 0.5) mc = mix(vec3(0.25, 0.20, 0.23), chainCol(code) * 0.55, 0.38) * (0.8 + 0.3 * t);
  mc = mix(mc, ${f3(HOT)} * (0.66 + 0.4 * t), max(a_state.y, a_state.z));     // marked proteins wear the resistant colour
  mc = mix(mc, vec3(1.0, 0.97, 0.98), 0.34 * a_state.w) * (1.0 + 0.16 * a_state.w);
  float ao = mix(0.45, 1.0, smoothstep(0.0, 0.6, t));
  float lit = smoothstep(0.12, 0.86, mix(0.30, 1.0, (dot(u_rot * a_shn, L) * 0.5 + 0.5) * ao));
  mc = mix(mc * 0.20 + vec3(0.040, 0.040, 0.046), mc, lit);
  col = mix(col, mc, mound);
  col = calm(col, calmK(a_state.w, max(a_state.y, a_state.z), a_state.x));
  float fog = mix(mix(0.42, 0.34, mound), 1.0, smoothstep(-1.0, 0.3, q.z / u_span));
  v_col = col * fog * u_dim;
}`;
  // A protein's line is drawn into its own plate or mound, so it follows the
  // real surface, is hidden by whatever stands in front of it and gets the same
  // multisampling as the shell. Its width is held in screen pixels by measuring
  // how fast the border coordinate changes from one pixel to the next.
  const FS_TRI = (deriv) => `${deriv ? '#extension GL_OES_standard_derivatives : enable' : ''}
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec3 v_col;
varying vec2 v_edge;
varying vec3 v_lc;
varying vec4 v_lp;
varying float v_lw;
uniform float u_grain;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  float g = hash(floor(gl_FragCoord.xy / u_grain));
  vec3 col = v_col * (0.92 + 0.16 * step(0.5, g));
  if (v_edge.x > -0.5 && v_lp.x > 0.004) {
    ${deriv ? 'float fw = max(fwidth(v_edge.x), 1e-5);' : 'float fw = 0.012;'}
    float d = (1.0 - v_edge.x) / fw - 0.6;                  // pixels in from the border
    float w = max(v_lw, 0.8);
    float band = smoothstep(-0.5, 0.5, d) * (1.0 - smoothstep(w - 0.5, w + 0.5, d));
    float back = v_lp.y * smoothstep(w - 0.5, w + 0.5, d) * (1.0 - smoothstep(w + 1.4, w + 2.4, d));
    // part of the way round (a countdown), the rest faint; or in dashes
    float turn = fract(v_edge.y + 0.25);
    ${deriv ? 'float tw = max(fwidth(v_edge.y), 1e-4);' : 'float tw = 0.004;'}
    float part = v_lp.z > 0.999 ? 1.0 : mix(0.25, 1.0, 1.0 - smoothstep(v_lp.z - tw, v_lp.z + tw, turn));
    float dash = 1.0;
    if (v_lp.w > 0.5) { float k = fract(v_edge.y * v_lp.w); dash = smoothstep(0.0, tw * v_lp.w * 1.5, k) * (1.0 - smoothstep(0.55 - tw * v_lp.w * 1.5, 0.55, k)); }
    col = mix(col, vec3(0.043, 0.051, 0.071), clamp(back * v_lp.x, 0.0, 1.0) * 0.8);
    col = mix(col, v_lc, clamp(band * v_lp.x * part * dash, 0.0, 1.0));
  }
  gl_FragColor = vec4(col, 1.0);
}`;

  // ---- numbers printed on the locked plates ----
  // One glyph sheet holds a distance field for each digit, so the edges stay
  // sharp at any size and the digits lie on the plate in perspective.
  const VS_GLYPH = COMMON + `
attribute vec3 a_pos;
attribute vec2 a_uv;
attribute vec4 a_col;
varying vec2 v_uv;
varying vec4 v_col;
uniform float u_lift;
void main() {
  vec3 q = u_rot * a_pos;
  float sc = 1.0 / (1.0 - q.z * u_persp);
  vec2 px = u_center + vec2(q.x, -q.y) * u_px * sc;
  // the plate's grain stands a little proud of its plane: test depth as if the digit sat u_lift
  // nearer the eye, without moving it on screen, so no speck of plate pokes through the ink
  gl_Position = vec4(px.x / u_res.x * 2.0 - 1.0, 1.0 - px.y / u_res.y * 2.0, -(q.z + u_lift) / u_span * 0.45, 1.0);
  v_uv = a_uv;
  v_col = a_col;
}`;
  const FS_GLYPH = (deriv) => `${deriv ? '#extension GL_OES_standard_derivatives : enable' : ''}
precision mediump float;
uniform sampler2D u_tex;
varying vec2 v_uv;
varying vec4 v_col;
void main() {
  float d = texture2D(u_tex, v_uv).a;
  float w = ${deriv ? 'max(fwidth(d) * 0.7, 0.008)' : '0.05'};
  float ink = smoothstep(0.75 - w, 0.75 + w, d);
  float rim = smoothstep(0.56 - w, 0.56 + w, d) * (1.0 - ink);         // a thin dark edge keeps it readable on any plate
  float a = (ink + rim * 0.55) * v_col.a;
  if (a <= 0.003) discard;
  gl_FragColor = vec4(v_col.rgb * ink * v_col.a + vec3(0.03, 0.035, 0.05) * rim * 0.55 * v_col.a, a);
}`;

  const UNIFORMS = ['u_rot', 'u_res', 'u_center', 'u_px', 'u_persp', 'u_span', 'u_time', 'u_breath', 'u_burst', 'u_build', 'u_dim', 'u_clear', 'u_grain', 'u_aa', 'u_fuse', 'u_toon', 'u_chain', 'u_detail', 'u_focus', 'u_dpr', 'u_tex', 'u_lift'];
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function hash2(x, y) {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // ---------- real structure ----------
  // look.real names a builder below. It lays out a virus's surface proteins the way textbooks draw
  // them: which lattice they sit on, how many there are, the shape of each assembly. It uses the noro
  // 'chains' style: one pastel colour per kind of chain, fused balls, fine detail only close up. The
  // board's cells stay what the game is played on, so each assembly belongs to the cell it stands on;
  // it lights up, takes a mark and sinks with that cell. A builder returns { units, deco, ground }:
  //   unit    { p, n, t, balls }: p a point on the shell, n the shell's normal there, t a direction
  //           along it. Each ball [a, b, z, r, code, shade, kind] sits a along t, b along n x t and z
  //           out of the shell. code 1..7 is a chain colour, shade 0..1 runs low..high, and kind is
  //           0, or 3 for a lump seen only close up.
  //   deco    bead chains off the shell (fibres, legs) as in boards.js, with tone = 1 + code + 0.98 * shade
  //   ground  the chain colour of every cell's floor (a membrane); without it, each floor takes the
  //           colour of most of the assemblies on it
  // Shapes, counts and colours are the textbook picture. Nothing in the game's data is real.
  const TAU = Math.PI * 2, S3 = Math.sqrt(3);
  const spin = (t, n, a) => add(scale(t, Math.cos(a)), scale(cross(n, t), Math.sin(a)));    // t turned by a about n
  const flat = (d, n) => norm(sub(d, scale(n, dot(d, n))));
  // k balls in a ring of radius rad round the assembly's axis
  function around(k, rad, z, r, code, shade, a0, step) {
    const out = [];
    for (let i = 0; i < k; i++) { const a = (a0 || 0) + i * TAU / k; out.push([Math.cos(a) * rad, Math.sin(a) * rad, z, r, code, shade + (step || 0) * (i % 2), 0]); }
    return out;
  }
  // a few small lumps on top of a ball, grown in only when the view is close (kind 3)
  function lumps(balls, x, y, z, r, k, code, shade, rnd) {
    const rot = rnd() * TAU;
    for (let i = 0; i < k; i++) {
      const zz = 0.5 + 0.38 * (1 - (i + 0.5) / k), rr = Math.sqrt(1 - zz * zz), ph = rot + i * 2.39996;
      balls.push([x + Math.cos(ph) * rr * r * 0.72, y + Math.sin(ph) * rr * r * 0.72, z + zz * r * 0.72, r * 0.46, code, shade + 0.06, 3]);
    }
  }
  // Caspar-Klug lattice (h, k) on the unit sphere, built face by face on the icosahedron: its 10T + 2
  // points (five: true on the 12 vertices) and, with tri, the centres of its 20T triangles (kind 1
  // pointing up, 2 down). t is the lattice's first axis there, for turning an assembly with its face.
  function lattice(h, k, tri) {
    const V = ico.V, raw = [], bx = h + k / 2, by = k * S3 / 2, cx = bx / 2 - by * S3 / 2, cy = bx * S3 / 2 + by / 2, det = bx * cy - by * cx;
    const bary = (x, y) => { const w1 = (x * cy - y * cx) / det, w2 = (bx * y - by * x) / det; return [1 - w1 - w2, w1, w2]; };
    const at = (F, w) => norm(add(add(scale(V[F[0]], w[0]), scale(V[F[1]], w[1])), scale(V[F[2]], w[2])));
    for (const F of ico.F) {
      for (let i = -k - 2; i <= h + 2; i++) for (let j = -2; j <= h + k + 2; j++) {
        const x0 = i + j / 2, y0 = j * S3 / 2, sites = [[x0, y0, 0]];
        if (tri) sites.push([x0 + 0.5, y0 + S3 / 6, 1], [x0 + 1, y0 + S3 / 3, 2]);
        for (const [x, y, kind] of sites) {
          const w = bary(x, y);
          if (w[0] < -1e-6 || w[1] < -1e-6 || w[2] < -1e-6) continue;
          const p = at(F, w), q = at(F, bary(x + 0.01, y));
          raw.push({ p, t: flat(sub(q, p), p), kind, five: Math.max(w[0], w[1], w[2]) > 1 - 1e-6 });
        }
      }
    }
    const out = [];       // a point on an edge or a corner was made by every face that shares it: keep one
    for (const s of raw) if (!out.some((o) => len(sub(o.p, s.p)) < 1e-5)) out.push(s);
    return out;
  }
  // the board's surface as triangles (each cell a fan from its centre), with a normal that turns smoothly
  // from cell to cell, for scattering assemblies over a membrane
  function shell(board) {
    const { cells, verts } = board, vn = verts.map(() => [0, 0, 0]), cum = [], tri = [];
    cells.forEach((c) => c.poly.forEach((v) => { vn[v] = add(vn[v], c.n); }));
    for (let i = 0; i < vn.length; i++) vn[i] = norm(vn[i]);
    let area = 0;
    cells.forEach((c, ci) => c.poly.forEach((a, e) => {
      const b = c.poly[(e + 1) % c.poly.length];
      area += len(cross(sub(verts[a], c.c), sub(verts[b], c.c))) / 2;
      cum.push(area); tri.push([ci, a, b]);
    }));
    function pick(rnd) {
      const x = rnd() * area;
      let lo = 0, hi = cum.length - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < x) lo = m + 1; else hi = m; }
      const [ci, a, b] = tri[lo], c = cells[ci];
      let r1 = rnd(), r2 = rnd();
      if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
      const w0 = 1 - r1 - r2;
      return { p: add(add(scale(c.c, w0), scale(verts[a], r1)), scale(verts[b], r2)), n: norm(add(add(scale(c.n, w0), scale(vn[a], r1)), scale(vn[b], r2))), ci };
    }
    return { area, pick };
  }
  // up to `count` points over the shell, none within `gap` of another (or as o.apart decides); o.weight
  // thins some places out, o.prep may attach things a point needs before it is tested
  function scatter(S, rnd, count, gap, o) {
    o = o || {};
    const out = [], grid = new Map(), g = (x) => Math.floor(x / gap);
    for (let tries = 0; tries < count * 60 && out.length < count; tries++) {
      const s = S.pick(rnd);
      if (o.weight && rnd() > o.weight(s)) continue;
      if (o.prep) o.prep(s);
      const gx = g(s.p[0]), gy = g(s.p[1]), gz = g(s.p[2]);
      let ok = true;
      for (let dx = -1; dx <= 1 && ok; dx++) for (let dy = -1; dy <= 1 && ok; dy++) for (let dz = -1; dz <= 1 && ok; dz++) {
        const b = grid.get((gx + dx) + ',' + (gy + dy) + ',' + (gz + dz));
        if (b) for (const q of b) if (o.apart ? !o.apart(q, s) : len(sub(q.p, s.p)) < gap) { ok = false; break; }
      }
      if (!ok) continue;
      out.push(s);
      const key = gx + ',' + gy + ',' + gz;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(s);
    }
    return out;
  }
  const loose = (s, rnd, balls) => ({ p: s.p, n: s.n, t: spin(tangent(s.n)[0], s.n, rnd() * TAU), balls });
  const tone = (code, shade) => 1 + code + 0.98 * Math.max(0, Math.min(1, shade));
  const STEP5 = 1.1071487;       // angle between two neighbouring five-fold axes

  const REAL = {
    // HPV, T = 7 (dextro): 72 capsomers, and every one is a pentamer of the same protein, so even
    // the 60 that sit among six neighbours are five-lobed stars. Rose on the 12 five-fold axes, ice
    // between. The middle of each star is filled low, so the shell reads as knobs, not holes.
    hpv(board, rnd) {
      const units = [];
      for (const s of lattice(2, 1)) {
        const code = s.five ? 1 : 2, a0 = rnd() * TAU, balls = [[0, 0, 0.03, 0.07, code, 0.1, 0]];
        for (let i = 0; i < 5; i++) {
          const a = a0 + i * TAU / 5, c = Math.cos(a), si = Math.sin(a), sh = 0.62 + 0.12 * (i % 2);
          balls.push([c * 0.1, si * 0.1, 0.05, 0.09, code, sh, 0]);
          lumps(balls, c * 0.11, si * 0.11, 0.05, 0.09, 2, code, sh, rnd);
        }
        units.push({ p: s.p, n: s.p, t: s.t, balls });
      }
      return { units };
    },
    // adenovirus, pseudo T = 25: 240 hexons (trimers on a near-hexagonal base) on a (5, 0) lattice,
    // a penton base on each of the 12 vertices, and from each a long thin fibre ending in a knob.
    // The five hexons round each penton (sage) are told apart from the rest (sand).
    adeno(board, rnd) {
      const sites = lattice(5, 0), fives = sites.filter((s) => s.five), units = [], deco = [];
      for (const s of sites) {
        if (s.five) {
          const balls = around(5, 0.056, 0.02, 0.058, 1, 0.55, rnd() * TAU, 0.08);
          balls.push([0, 0, 0.05, 0.042, 1, 0.85, 0]);
          units.push({ p: s.p, n: s.p, t: s.t, balls });
          // the fibre: a beaded shaft that bends a little, then a knob of three
          const side = spin(s.t, s.p, rnd() * TAU), bend = 0.05 + 0.06 * rnd(), L = 0.44, k = 10, foot = 0.08;
          const along = (f) => add(add(s.p, scale(s.p, foot + L * f)), scale(side, bend * f * f));
          const dir = (f) => norm(add(scale(s.p, L), scale(side, 2 * bend * f)));
          for (let i = 0; i <= k; i++) deco.push({ p: along(i / k), d: dir(i / k), r: 0.017, fade: true, tone: tone(3, 0.35 + 0.3 * i / k) });
          const tip = add(along(1), scale(dir(1), 0.034)), [ku, kv] = tangent(dir(1));
          for (let i = 0; i < 3; i++) { const a = i * TAU / 3; deco.push({ p: add(tip, add(scale(ku, Math.cos(a) * 0.028), scale(kv, Math.sin(a) * 0.028))), d: dir(1), r: 0.036, fade: true, tone: tone(4, 0.8) }); }
          continue;
        }
        const code = fives.some((f) => dot(f.p, s.p) > Math.cos(STEP5 / 5 * 1.4)) ? 2 : 7, balls = [];
        for (let i = 0; i < 3; i++) {
          const a = TAU / 12 + i * TAU / 3, b = a + TAU / 6;
          balls.push([Math.cos(a) * 0.045, Math.sin(a) * 0.045, 0, 0.072, code, 0.42, 0]);
          balls.push([Math.cos(b) * 0.024, Math.sin(b) * 0.024, 0.05, 0.05, code, 0.82, 0]);
        }
        units.push({ p: s.p, n: s.p, t: s.t, balls });
      }
      return { units, deco, seam: 0.2 };
    },
    // rotavirus, outer layer T = 13 (laevo): 260 VP7 trimers on the lattice's triangles, channels on its
    // points, and 60 VP4 spikes (a stalk, a body and two heads) standing in the channels round the
    // five-fold axes. The trimers lean their lobes into the channels, so those stay small, and they
    // wear the quieter periwinkle so the spikes stand out.
    rota(board, rnd) {
      const sites = lattice(3, 1, true), fives = sites.filter((s) => s.kind === 0 && s.five), units = [], step = STEP5 / Math.sqrt(13);
      for (const s of sites) {
        if (s.kind === 0) {
          const f = s.five ? null : fives.find((q) => dot(q.p, s.p) > Math.cos(step * 1.35));
          if (!f) continue;
          const balls = [[0, 0, 0.03, 0.042, 1, 0.3, 0], [0, 0, 0.09, 0.046, 1, 0.45, 0], [0, 0, 0.15, 0.058, 1, 0.62, 0], [0, 0.05, 0.21, 0.052, 4, 0.85, 0], [0, -0.05, 0.21, 0.052, 4, 0.85, 0]];
          lumps(balls, 0, 0.05, 0.21, 0.052, 2, 4, 0.85, rnd); lumps(balls, 0, -0.05, 0.21, 0.052, 2, 4, 0.85, rnd);
          units.push({ p: s.p, n: s.p, t: flat(sub(f.p, s.p), s.p), balls });
          continue;
        }
        const balls = around(3, 0.042, 0, 0.078, 5, 0.5, s.kind === 1 ? TAU / 4 : -TAU / 4);
        balls.push([0, 0, 0.03, 0.068, 5, 0.72, 0]);
        units.push({ p: s.p, n: s.p, t: s.t, balls });
      }
      return { units, seam: 0.22 };
    },
    // tobacco mosaic virus: one coat protein repeated along a single helix, 16 1/3 to a turn, pitch about
    // a quarter of the radius. Neighbours touch, so each turn reads as one ridge. Each end shows the
    // subunits as wedges round the central channel.
    tmv(board, rnd) {
      let lo = Infinity, hi = -Infinity, R = 0;
      for (const q of board.verts) { lo = Math.min(lo, q[1]); hi = Math.max(hi, q[1]); R = Math.max(R, Math.hypot(q[0], q[2])); }
      const per = 16.33, pitch = 0.256 * R, units = [], n = Math.floor((hi - lo - 0.24 * R) / pitch * per);
      for (let i = 0; i < n; i++) {
        const th = i * TAU / per, y = lo + 0.12 * R + i * pitch / per, nr = [Math.cos(th), 0, Math.sin(th)], sh = i % 2 ? 0.5 : 0.62, balls = [];
        // six balls close together along the helix: the turns read as one smooth coil, the subunits by their shade
        for (let k = 0; k < 6; k++) { const a = (k - 2.5) * 0.064; balls.push([a, 0, 0.012 * (1 - Math.abs(k - 2.5) / 2.5), 0.11, 2, sh + 0.08 * (1 - Math.abs(k - 2.5) / 2.5), 0]); }
        units.push({ p: [nr[0] * R, y, nr[2] * R], n: nr, t: norm([-Math.sin(th), pitch / (TAU * R), Math.cos(th)]), balls });
      }
      for (const [y, sy] of [[lo, -1], [hi, 1]]) for (let j = 0; j < 16; j++) {
        const a = j * TAU / 16, rd = [Math.cos(a), 0, Math.sin(a)];
        units.push({ p: [rd[0] * 0.6 * R, y, rd[2] * 0.6 * R], n: [0, sy, 0], t: rd, balls: [[-0.25, 0, 0, 0.068, 2, 0.42, 0], [0, 0, 0.02, 0.092, 2, 0.6, 0], [0.24, 0, 0.01, 0.106, 2, 0.74, 0]] });
      }
      return { units, seam: 0.2 };
    },
    // rabies: a bullet of membrane studded with G trimers, each a short stalk and a knobbed head, on
    // every side but the flat end
    rabies(board, rnd) {
      const S = shell(board), units = [], N = 320;
      for (const s of scatter(S, rnd, N, 0.72 * Math.sqrt(S.area / N), { weight: (q) => q.n[1] < -0.85 ? 0.12 : 1 })) {
        // the head's three lobes pressed together under a crown, leaning a little each its own way, so the coat
        // reads as rounded knobs on stalks rather than a print of clover leaves
        const lean = 0.35 * rnd(), x = (z) => lean * z;
        const balls = [[0, 0, 0.03, 0.04, 2, 0.28, 0], [x(0.09), 0, 0.09, 0.046, 2, 0.4, 0]].concat(around(3, 0.04, 0.16, 0.07, 2, 0.6, rnd() * TAU, 0.08).map((b) => (b[0] += x(0.16), b)), [[x(0.19), 0, 0.19, 0.06, 2, 0.8, 0]]);
        units.push(loose(s, rnd, balls));
      }
      return { units, ground: 5 };
    },
    // Ebola: a long membrane tube covered in GP trimers, each a short stalk opening into a three-lobed cup
    ebola(board, rnd) {
      const S = shell(board), units = [], N = Math.round(S.area / 0.13);
      // a close coat of chalices in a mid tone, so the tube reads as one textured skin rather than dots on a ground
      for (const s of scatter(S, rnd, N, 0.74 * Math.sqrt(S.area / N))) {
        const lean = 0.3 * rnd(), x = (z) => lean * z;
        const balls = [[0, 0, 0.035, 0.05, 6, 0.3, 0], [x(0.095), 0, 0.095, 0.064, 6, 0.42, 0]].concat(around(3, 0.046, 0.17, 0.085, 6, 0.6, rnd() * TAU, 0.1).map((b) => (b[0] += x(0.17), b)), [[x(0.205), 0, 0.205, 0.07, 6, 0.84, 0]]);
        units.push(loose(s, rnd, balls));
      }
      return { units, ground: 6 };
    },
    // influenza: about 250 spikes on the envelope. Most are rod-like HA trimers (a stalk and a
    // three-lobed head); in a few patches stand NA tetramers (a thin stalk and a square head).
    flu(board, rnd) {
      const S = shell(board), N = 330, pts = scatter(S, rnd, N, 0.72 * Math.sqrt(S.area / N)), units = [], patch = [];
      for (let i = 0; i < 7; i++) patch.push(pts[Math.floor(rnd() * pts.length)].p);
      for (const s of pts) {
        const na = patch.some((q) => len(sub(q, s.p)) < 0.3) && rnd() < 0.75, a0 = rnd() * TAU;
        const balls = na ? [[0, 0, 0.04, 0.024, 1, 0.3, 0], [0, 0, 0.1, 0.024, 1, 0.42, 0]].concat(around(4, 0.04, 0.175, 0.045, 1, 0.82, a0))
          : [[0, 0, 0.035, 0.036, 2, 0.3, 0], [0, 0, 0.1, 0.042, 2, 0.45, 0]].concat(around(3, 0.034, 0.185, 0.054, 2, 0.8, a0));
        units.push(loose(s, rnd, balls));
      }
      return { units, ground: 5 };
    },
    // coronavirus: a few dozen large S trimers, each a thin stalk that leans at its hinges under a
    // bulbous three-lobed head: the crown
    corona(board, rnd) {
      const S = shell(board), units = [];
      for (const s of scatter(S, rnd, 44, 0.44)) {
        const lean = 0.3 * rnd(), x = (z) => lean * z, a0 = rnd() * TAU;
        const balls = [[x(0.04), 0, 0.04, 0.03, 4, 0.3, 0], [x(0.1), 0, 0.1, 0.03, 4, 0.4, 0], [x(0.16), 0, 0.16, 0.033, 4, 0.5, 0], [x(0.225), 0, 0.225, 0.058, 1, 0.5, 0]];
        for (let i = 0; i < 3; i++) {
          const a = a0 + i * TAU / 3, bx = x(0.3) + Math.cos(a) * 0.06, by = Math.sin(a) * 0.06;
          balls.push([bx, by, 0.3, 0.068, 1, 0.72, 0]);
          lumps(balls, bx, by, 0.3, 0.068, 2, 1, 0.72, rnd);
        }
        balls.push([x(0.355), 0, 0.355, 0.05, 1, 0.92, 0]);
        units.push(loose(s, rnd, balls));
      }
      return { units, ground: 5 };
    },
    // herpes simplex: hundreds of glycoproteins of several kinds, unevenly spread and often in clusters:
    // tall gB trimers (sage), short gD knobs (ice), slender gC (blush), boot-shaped gH/gL (lilac)
    herpes(board, rnd) {
      const S = shell(board), hubs = [], kindOf = () => { const x = rnd(); return x < 0.4 ? 0 : x < 0.65 ? 1 : x < 0.85 ? 2 : 3; };
      for (let i = 0; i < 26; i++) hubs.push({ p: S.pick(rnd).p, k: kindOf() });
      const hub = (p) => { let best = null, bd = 0.42; for (const h of hubs) { const d = len(sub(h.p, p)); if (d < bd) { bd = d; best = h; } } return best; };
      const N = 280, units = [];
      for (const s of scatter(S, rnd, N, 0.62 * Math.sqrt(S.area / N), { weight: (q) => hub(q.p) ? 1 : 0.3 })) {
        const h = hub(s.p), k = h && rnd() < 0.7 ? h.k : kindOf(), a0 = rnd() * TAU;
        const balls = k === 0 ? [[0, 0, 0.03, 0.03, 2, 0.3, 0], [0, 0, 0.08, 0.036, 2, 0.45, 0]].concat(around(3, 0.032, 0.14, 0.045, 2, 0.8, a0))
          : k === 1 ? [[0, 0, 0.025, 0.04, 3, 0.45, 0], [0, 0, 0.07, 0.05, 3, 0.8, 0]]
          : k === 2 ? [[0, 0, 0.03, 0.022, 4, 0.35, 0], [0.01, 0, 0.075, 0.022, 4, 0.45, 0], [0.025, 0, 0.12, 0.022, 4, 0.55, 0], [0.045, 0, 0.165, 0.022, 4, 0.65, 0], [0.065, 0, 0.205, 0.032, 4, 0.85, 0]]
          : [[0, 0, 0.03, 0.04, 6, 0.4, 0], [0, 0, 0.085, 0.044, 6, 0.55, 0], [0.04, 0, 0.13, 0.046, 6, 0.75, 0], [0.085, 0, 0.14, 0.036, 6, 0.85, 0]];
        units.push(loose(s, rnd, balls));
      }
      return { units, ground: 1 };
    },
    // vaccinia: the brick's surface is covered in short tubular elements, ridges lying in loose whorls
    // of parallel strands (the 'mulberry' look)
    pox(board, rnd) {
      const S = shell(board), units = [], step = 0.03, sep = 0.13, near = 0.085, r0 = 0.05;
      const field = (p, n) => {
        const g = [Math.sin(2.1 * p[1] + 0.7) + 0.6 * Math.cos(1.7 * p[2]), Math.sin(1.9 * p[2] + 2.1) + 0.6 * Math.cos(2.3 * p[0]), Math.sin(2.3 * p[0] + 4.2) + 0.6 * Math.cos(1.5 * p[1])];
        const t = sub(g, scale(n, dot(g, n)));
        return len(t) > 0.15 ? norm(t) : tangent(n)[0];
      };
      // points in space binned in cubes of side `size`, to find what is close to a point
      const bins = (size) => {
        const m = new Map(), k = (x, y, z) => x + ',' + y + ',' + z, f = (v) => Math.floor(v / size);
        return {
          add(q) { const key = k(f(q.p[0]), f(q.p[1]), f(q.p[2])); if (!m.has(key)) m.set(key, []); m.get(key).push(q); },
          each(p, fn) {
            const x = f(p[0]), y = f(p[1]), z = f(p[2]);
            for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) { const b = m.get(k(x + dx, y + dy, z + dz)); if (b) for (const q of b) if (fn(q)) return true; }
            return false;
          },
        };
      };
      // a fine cloud of points on the skin; a step is pressed back onto the plane of the closest of them
      const cloud = bins(0.06), seeds = [];
      for (let i = Math.round(S.area / 0.0005); i > 0; i--) { const q = S.pick(rnd); cloud.add(q); seeds.push(q); }
      const onto = (p) => {
        let best = null, bd = 1e9;
        cloud.each(p, (q) => { const d = len(sub(q.p, p)); if (d < bd) { bd = d; best = q; } return false; });
        return best && { p: sub(p, scale(best.n, dot(sub(p, best.p), best.n))), n: best.n };
      };
      // strands follow a swirling field over the skin and stop short of strands already laid, so they
      // pack side by side into whorls of parallel ridges (evenly spaced streamlines)
      const laid = bins(sep), taken = (p, d) => laid.each(p, (q) => len(sub(q.p, p)) < d);
      for (const seed of seeds) {
        if (rnd() > 0.4 || taken(seed.p, sep)) continue;
        const most = 6 + Math.floor(rnd() * 12), line = [{ p: seed.p, n: seed.n, t: field(seed.p, seed.n) }];
        for (const dir of [1, -1]) {
          let q = line[dir > 0 ? line.length - 1 : 0], t = scale(q.t, dir);
          for (let i = 0; i < most; i++) {
            const nx = onto(add(q.p, scale(t, step)));
            if (!nx || taken(nx.p, near)) break;
            let t2 = field(nx.p, nx.n);
            if (dot(t2, t) < 0) t2 = scale(t2, -1);
            if (dot(t2, t) < 0.8) break;
            q = { p: nx.p, n: nx.n, t: scale(t2, dir) };
            if (dir > 0) line.push(q); else line.unshift(q);
            t = t2;
          }
        }
        if (line.length < 5) continue;
        // a tube of overlapping balls in the skin's own colour, rounded off at both ends
        const base = 0.28 + 0.14 * rnd();
        line.forEach((q, i) => {
          const e = Math.min(i, line.length - 1 - i), f = e >= 2 ? 1 : 0.72 + 0.14 * e;
          units.push({ p: q.p, n: q.n, t: q.t, balls: [[0, 0, 0.016 * f, r0 * f, 7, base + 0.1 * f, 0]] });
          laid.add(q);
        });
      }
      return { units, ground: 7 };
    },
    // T4: the head is a prolate icosahedron with T = 13 (laevo) ends, gp23 hexamers each with a Hoc knob
    // in its middle, gp24 pentamers on 11 vertices (the 12th is the portal under the neck). The tail
    // sheath is rings of six gp18 subunits that twist down the tail. Then a hexagonal baseplate with six
    // short fibres folded under it, six long kinked tail fibres, and whiskers at the collar.
    t4(board, rnd) {
      const v0 = ico.V[0], Rm = axisAngle(cross(v0, [0, -1, 0]), Math.acos(Math.max(-1, Math.min(1, -v0[1])))), mid = board.mid || [0, 0, 0];
      const units = [], deco = [];
      for (const s of lattice(3, 1)) {
        const q = mulMV(Rm, s.p);
        if (q[1] < -0.97) continue;
        const n = norm([q[0], q[1] / 1.2, q[2]]), tq = mulMV(Rm, s.t);
        const balls = s.five ? around(5, 0.07, 0.015, 0.064, 1, 0.55, 0, 0.08).concat([[0, 0, 0.02, 0.05, 1, 0.3, 0]])
          : around(6, 0.085, 0.01, 0.064, 6, 0.5, 0, 0.1).concat([[0, 0, 0.055, 0.052, 4, 0.85, 0]]);
        units.push({ p: [q[0] - mid[0], q[1] * 1.2 - mid[1], q[2] - mid[2]], n, t: flat([tq[0], tq[1] * 1.2, tq[2]], n), balls });
      }
      let rimY = -Infinity;
      board.cells.forEach((c) => { if (c.tag === 2) for (const v of c.poly) rimY = Math.max(rimY, board.verts[v][1]); });
      const sp = board.spec, r = sp.r, top = rimY - 0.36, end = top - sp.rings * sp.h;
      const ring = (a) => [Math.cos(a), 0, Math.sin(a)], along = (a) => [-Math.sin(a), 0, Math.cos(a)];
      // collar knobs and whiskers
      for (let j = 0; j < 6; j++) {
        const a = j * TAU / 6 + 0.3, rd = ring(a);
        units.push({ p: [rd[0] * r * 1.05, rimY - 0.2, rd[2] * r * 1.05], n: rd, t: along(a), balls: [[0, 0, 0.02, 0.07, 5, 0.55, 0], [0.05, 0, 0.04, 0.05, 5, 0.75, 0]] });
        const base = [rd[0] * r * 1.25, rimY - 0.18, rd[2] * r * 1.25], d = norm(add(scale(rd, 0.85), [0, -0.5, 0]));
        for (let i = 0; i < 6; i++) deco.push({ p: add(base, scale(d, 0.34 * (i + 0.5) / 6)), d, r: 0.014, tone: tone(5, 0.5) });
      }
      // the sheath
      const rise = 0.115, rows = Math.floor((top - end - 0.04) / rise);
      for (let i = 0; i < rows; i++) {
        const y = top - 0.02 - rise * (i + 0.5);
        for (let j = 0; j < 6; j++) {
          const a = j * TAU / 6 + i * 0.3, rd = ring(a);
          units.push({ p: [rd[0] * r, y, rd[2] * r], n: rd, t: along(a), balls: [[-0.055, 0, 0, 0.068, 2, 0.48 + 0.1 * (i % 2), 0], [0.045, 0.015, 0.025, 0.06, 2, 0.76, 0]] });
        }
      }
      // the baseplate: six wedges on the flare, a hub and six short fibres underneath
      for (let j = 0; j < 6; j++) {
        const a = j * TAU / 6, rd = ring(a);
        units.push({ p: [rd[0] * (r + 0.15), end - 0.13, rd[2] * (r + 0.15)], n: norm([rd[0] * 0.26, 0.29, rd[2] * 0.26]), t: along(a), balls: [[0, 0, 0.02, 0.085, 5, 0.5, 0], [0, 0.05, 0.05, 0.06, 5, 0.72, 0]] });
        units.push({ p: [rd[0] * 0.4, end - 0.28, rd[2] * 0.4], n: [0, -1, 0], t: rd, balls: [[-0.08, 0, 0, 0.035, 4, 0.5, 0], [0, 0, 0.01, 0.035, 4, 0.6, 0], [0.08, 0, 0, 0.035, 4, 0.7, 0]] });
      }
      units.push({ p: [0, end - 0.28, 0], n: [0, -1, 0], t: [1, 0, 0], balls: [[0, 0, 0.02, 0.075, 5, 0.6, 0]] });
      // long tail fibres, bent at the knee
      for (let j = 0; j < 6; j++) {
        const rd = ring(j * TAU / 6 + TAU / 12), base = [rd[0] * r * 1.85, end - 0.26, rd[2] * r * 1.85];
        const up = norm(add(scale(rd, 0.8), [0, 0.6, 0])), knee = add(base, scale(up, 0.5)), down = norm(add(scale(rd, 0.5), [0, -0.87, 0]));
        for (let i = 0; i < 6; i++) deco.push({ p: add(base, scale(up, 0.5 * (i + 0.5) / 6)), d: up, r: 0.028, tone: tone(5, 0.55) });
        for (let i = 0; i < 9; i++) deco.push({ p: add(knee, scale(down, 0.86 * (i + 0.5) / 9)), d: down, r: 0.025, tone: tone(4, 0.6) });
        deco.push({ p: add(knee, scale(down, 0.9)), d: down, r: 0.038, tone: tone(4, 0.85) });
      }
      return { units, deco, seam: 0.2 };
    },
  };

  function Renderer(back, glc, front) {
    const gl = glc.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true, depth: true }) || glc.getContext('experimental-webgl');
    if (!gl) throw new Error('WebGL is not available');
    const cb = back.getContext('2d'), cf = front.getContext('2d');

    function program(vs, fs, attribs) {
      const p = gl.createProgram();
      for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        gl.attachShader(p, s);
      }
      attribs.forEach((a, i) => gl.bindAttribLocation(p, i, a));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const U = {};
      for (const n of UNIFORMS) U[n] = gl.getUniformLocation(p, n);
      return { p, U, count: attribs.length };
    }
    // Soft rims come from alpha-to-coverage on the multisampled canvas; balls cut
    // into each other like real spheres where the depth extension exists.
    const msaa = !!(gl.getContextAttributes() || {}).antialias && gl.getParameter(gl.SAMPLES) > 1;
    const fragDepth = !!gl.getExtension('EXT_frag_depth');
    const deriv = !!gl.getExtension('OES_standard_derivatives');
    const PT = program(VS_PT, FS_PT(fragDepth), ['a_pos', 'a_nrm', 'a_shn', 'a_info', 'a_aux', 'a_state', 'a_line']);
    const TRI = program(VS_TRI, FS_TRI(deriv), ['a_ctr', 'a_off', 'a_nrm', 'a_info', 'a_shn', 'a_aux', 'a_state', 'a_line']);
    const GLYPH = program(VS_GLYPH, FS_GLYPH(deriv), ['a_pos', 'a_uv', 'a_col']);
    const vbGlyph = gl.createBuffer();
    // a far plane that only writes alpha: wherever something was drawn the canvas becomes opaque, sample by sample
    const FILL = program('attribute vec2 a_pos; void main() { gl_Position = vec4(a_pos, 0.9999, 1.0); }', 'precision mediump float; void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); }', ['a_pos']);
    const vbFill = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbFill); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    gl.clearColor(0, 0, 0, 0);

    let W = 0, H = 0, dpr = 1;
    // Draw at the screen's real pixel ratio (3 on recent phones). Very large
    // windows are held to about nine million pixels per canvas.
    const pixelRatio = (w, h) => Math.max(1, Math.min(3, window.devicePixelRatio || 1, Math.sqrt(9e6 / Math.max(1, w * h))));
    let grain = 1;
    function resize() {
      const w = window.innerWidth, h = window.innerHeight, d = pixelRatio(w, h);
      if (w === W && h === H && d === dpr) return false;
      W = w; H = h; dpr = d; grain = Math.max(1, Math.round(d * 0.67));
      for (const c of [back, glc, front]) { c.width = Math.round(w * d); c.height = Math.round(h * d); c.style.width = w + 'px'; c.style.height = h + 'px'; }
      gl.viewport(0, 0, glc.width, glc.height);
      return true;
    }
    function begin() {
      resize();
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      for (const c of [cb, cf]) { c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H); c.lineCap = 'round'; c.lineJoin = 'round'; }
    }

    // ---------- model: GPU buffers for one board ----------
    // Three layers. The frame is a handful of loose lines around the whole
    // shape (drawn in 2D, see cage). Each protein is one smooth mound with a
    // groove along its border. On every mound sit a few lobes of different
    // sizes: enough to give it a face, never a field of little circles.
    const PS = 15, TS = 17;
    const RINGS = [1, 0.88, 0.72, 0.5, 0.24];
    const prof = (t) => 1 - Math.pow(1 - Math.min(1, t), 2.2);                 // 0 in the groove .. 1 on the crown
    const slope = (t) => 2.2 * Math.pow(1 - Math.min(1, t), 1.2);
    // Height of a protein's floor across it, s = 0 in the middle .. 1 at its border.
    // dome: one smooth mound. cup: a shallow hollow in the middle, a shoulder
    // near the border and a soft groove where it meets its neighbour.
    const domeH = (s) => prof(1 - s);
    const cupH = (s) => s < 0.78 ? 0.58 + 0.42 * smooth(0.0, 0.78, s) : 1 - smooth(0.78, 1, s);
    const plateH = (s) => s < 0.74 ? 0.72 + 0.28 * smooth(0.0, 0.74, s) : 1 - smooth(0.74, 1, s);
    const shallowH = (s) => s < 0.74 ? 0.62 + 0.38 * smooth(0.0, 0.74, s) : 1 - smooth(0.74, 1, s);
    const RINGS_CUP = [1, 0.95, 0.89, 0.82, 0.72, 0.58, 0.42, 0.24];
    const CELL_FLOOR = [1, 3, 5];      // the floor's chain colour by kind of cell: rose, ice, periwinkle
    const DETAIL = [300, 460];   // the shell's radius on screen (CSS px) over which the close-up lumps grow in
    const dH = (H, s) => { const a = Math.max(0, s - 0.01), b = Math.min(1, s + 0.01); return (H(b) - H(a)) / (b - a); };
    function model(board, look) {
      look = look || {};
      const unit = board.unit, cells = board.cells, n = cells.length, rnd = rng32(n * 131 + 7);
      const span = Math.max(board.fit.hw, board.fit.hh);
      const tri = [], pts = [], triRange = [], ptRange = [];
      const dome = (look.dome == null ? 0.25 : look.dome) * unit * 1.35, cellLook = !!look.cell;
      // look.cell with look.types: the 交锋's tissue, one kind per cell (see cellParts)
      const types = cellLook ? look.types || null : null;
      const few = n <= 48 ? [3, 5] : n <= 100 ? [2, 4] : [1, 3];
      // relief 'arches': every border between two proteins carries one arch made
      // of two lobes, one from each side (a pair of protruding domains)
      // relief 'pairs': the same arrangement drawn plainly, one big round ball per
      // domain (a low shoulder and a head), so each arch is a pair of heads
      // relief 'chains' (a T=3 shell, after the calicivirus capsid): the 180 copies of
      // the one protein sit in three settings, A round the five-fold hollows, B and C
      // taking turns round the three-fold ones. A pairs with B across a border between
      // a five- and a six-sided hollow; C pairs with C across a border between two
      // six-sided ones (the true two-fold). Each copy is coloured by its setting: its
      // shell domain is a wedge of the floor, its protruding domain a stalk and a head
      // that leans into its partner's
      const arches = look.relief === 'arches', pairs = look.relief === 'pairs', chains = look.relief === 'chains', edgy = arches || pairs || chains;
      // look.real: the virus's own surface proteins (see REAL), shared out among the cells they stand on
      const R = look.real && REAL[look.real] ? REAL[look.real](board, rng32(n * 977 + 13)) : null;
      const H = arches ? cupH : pairs ? plateH : chains || R ? shallowH : domeH, rings = edgy || R ? RINGS_CUP : RINGS;
      // each cell's own flat frame: u, v across it, and its outline in those terms (z: below the centre)
      const frames = cells.map((c) => {
        const [u, v] = tangent(c.n);
        return { u, v, Q: c.poly.map((q) => { const d = sub(board.verts[q], c.c); return [dot(d, u), dot(d, v), dot(d, c.n)]; }) };
      });
      // the plane of a cell's outline under a point, and how far out the point is (0 middle .. 1 border, more outside)
      const fanAt = (Q, x, y) => {
        let h = 0, s = Infinity;
        for (let e = 0; e < Q.length; e++) {
          const A = Q[e], B = Q[(e + 1) % Q.length], det = A[0] * B[1] - A[1] * B[0];
          if (Math.abs(det) < 1e-12) continue;
          const w1 = (x * B[1] - y * B[0]) / det, w2 = (A[0] * y - A[1] * x) / det;
          if (w1 >= -1e-6 && w2 >= -1e-6) { h = w1 * A[2] + w2 * B[2]; s = w1 + w2; }
        }
        return [h, s];
      };
      // every assembly goes to the cell whose outline holds it (one that hangs past every edge is left out)
      const own = cells.map(() => []), floorCode = new Array(n).fill(R && R.ground ? R.ground : 0);
      if (R) {
        for (const U of R.units) {
          const near = [];
          cells.forEach((c, ci) => {
            if (dot(c.n, U.n) < 0.3) return;
            const d = len(sub(U.p, c.c));
            if (near.length < 6 || d < near[near.length - 1][0]) { near.push([d, ci]); near.sort((a, b) => a[0] - b[0]); if (near.length > 6) near.pop(); }
          });
          let best = null;
          for (const [, ci] of near) {
            const f = frames[ci], d = sub(U.p, cells[ci].c), x = dot(d, f.u), y = dot(d, f.v), s = fanAt(f.Q, x, y)[1];
            if (!best || s < best.s) best = { ci, x, y, s };
            if (s <= 1) break;
          }
          if (best && best.s < 1.35) own[best.ci].push({ U, x: best.x, y: best.y });
        }
        if (!R.ground) own.forEach((list, ci) => {
          const count = {};
          let most = 0;
          for (const { U } of list) { const k = U.balls[0][4]; count[k] = (count[k] || 0) + 1; if (count[k] > most) { most = count[k]; floorCode[ci] = k; } }
        });
      }
      const owners = new Map();
      if (edgy) cells.forEach((c, i) => { for (const q of c.poly) { if (!owners.has(q)) owners.set(q, []); owners.get(q).push(i); } });
      const corners = cells.map((c) => edgy ? c.poly.map((q, k) => k).filter((k) => owners.get(c.poly[k]).length >= 3) : []);
      const toned = [];   // [index of a ball, its height]: arches are coloured by height once every ball is placed
      let top = dome;
      // The 交锋's tissue, in the noro 'chains' style: each kind of cell carries its own parts, a few large
      // fused shapes in one pastel each (reference/4), never a field of small balls.
      //   plain (absorptive) cell  three soft rose ridges across the top, the brush border drawn as
      //                            cushions rather than hairs, and three muted receptor knobs on them
      //   goblet cell              an ice-blue cup round the border holding one big glossy drop of
      //                            mucus and a small one budding off it; one receptor left uncovered
      //   stem cell                five periwinkle petals with lavender tips round a dark hollow
      // Every part belongs to its cell: it sinks when the cell bursts and grows back with it.
      function cellParts(c, fr, kind, Hc, under, phase) {
        const { u, v } = fr, R0 = c.rad, a0 = rnd() * TAU, co = Math.cos(a0), si = Math.sin(a0), cseed = rnd();
        let reach = 0;
        // a ball at (x, y) across the cell (turned by a0), z over the floor; it is lit as if it stood at
        // (sx, sy), so the balls of one ridge or petal share their light and fuse into one smooth shape
        const ball = (x, y, z, r, code, sh, k, sx, sy) => {
          const X = x * co - y * si, Y = x * si + y * co, [h, s] = under(X, Y), lift = dome * Hc(s);
          const across = add(scale(u, X), scale(v, Y)), pos = add(c.c, add(across, scale(c.n, h + z)));
          const lx = sx == null ? x : sx, ly = sy == null ? y : sy;
          const shn = norm(add(c.n, scale(add(scale(u, lx * co - ly * si), scale(v, lx * si + ly * co)), 0.55 / R0)));
          pts.push(pos[0], pos[1], pos[2], c.n[0], c.n[1], c.n[2], shn[0], shn[1], shn[2], cseed + 0.03 * rnd(), r, lift, k || 0, phase, tone(code, sh));
          reach = Math.max(reach, lift * 1.3 + z + r * 1.25);
        };
        // how far a line across the cell (at y, heading dir) runs before it nears the border
        const runTo = (y, dir, edge) => {
          let x = 0;
          for (let t = 0.02 * R0; t < 1.6 * R0; t += 0.02 * R0) {
            const X = dir * t * co - y * si, Y = dir * t * si + y * co;
            if (under(X, Y)[1] > edge) break;
            x = t;
          }
          return x;
        };
        if (kind === 1) {
          const K = 18, d = 0.6 * R0, rr = 0.19 * R0;
          for (let k = 0; k < K; k++) { const a = k * TAU / K; ball(Math.cos(a) * d, Math.sin(a) * d, -0.2 * rr, rr, 3, 0.42, 0); }
          ball(0.02 * R0, 0.03 * R0, 0.1 * R0, 0.5 * R0, 3, 0.97, 4);
          ball(0.36 * R0, -0.33 * R0, 0.16 * R0, 0.2 * R0, 3, 0.93, 4);
          ball(-0.58 * R0, 0.26 * R0, 0.12 * R0, 0.12 * R0, 7, 0.42, 0);
        } else if (kind === 2) {
          // each petal a teardrop, narrow at the hollow and full at the rim, with a lavender tip inside
          for (let k = 0; k < 5; k++) {
            const a = k * TAU / 5, ca = Math.cos(a), sa = Math.sin(a), mx = ca * 0.5 * R0, my = sa * 0.5 * R0;
            for (let d = 0.3; d <= 0.625; d += 0.025) {
              const f = (d - 0.3) / 0.325, r = (0.1 + 0.09 * Math.sin(Math.min(1, f * 1.25) * Math.PI / 2)) * R0;
              ball(ca * d * R0, sa * d * R0, (0.02 + 0.12 * f) * R0 - r * 0.3, r, f < 0.2 ? 6 : 5, f < 0.2 ? 0.62 : 0.8, 0, mx, my);
            }
          }
        } else {
          const rows = [-0.47, 0, 0.47], knobs = [];
          rows.forEach((y0, ri) => {
            const y = y0 * R0, rr = (ri === 1 ? 0.27 : 0.25) * R0, Lp = runTo(y, 1, 0.76), Lm = runTo(y, -1, 0.76);
            const step = 0.2 * rr, nB = Math.max(2, Math.round((Lp + Lm) / step)), mid = (Lp - Lm) / 2;
            // the outer ridges bow out in the middle and draw in at the ends, like the segments of a cushion,
            // and every ridge thins and sinks into the cell at its ends instead of ending in a round tip
            for (let k = 0; k <= nB; k++) {
              const x = -Lm + (Lp + Lm) * k / nB, f = x >= 0 ? x / (Lp || 1) : -x / (Lm || 1), round = Math.sqrt(Math.max(0, 1 - f * f));
              const yy = y * (0.8 + 0.2 * round);
              ball(x, yy, -(0.36 + 0.3 * f * f) * rr, rr * (0.5 + 0.5 * round), 1, ri === 1 ? 0.84 : 0.76, 0, mid + (x - mid) * 0.35, yy);
            }
            knobs.push([y, rr, Lp, Lm]);
          });
          // the receptors: one on each ridge, never two side by side
          const at = [0.12 + 0.18 * rnd(), -0.12 - 0.18 * rnd(), 0.3 * (rnd() - 0.5)];
          knobs.forEach(([y, rr, Lp, Lm], k) => { const x = at[k] >= 0 ? at[k] * Lp : at[k] * Lm; ball(x, y * 0.98, 0.55 * rr, 0.12 * R0, 7, 0.55, 0); });
        }
        return reach;
      }
      cells.forEach((c, ci) => {
        const seed = rnd(), phase = rnd() * 6.283, P = c.poly.map((v) => board.verts[v]), k = Math.max(0.6, 1 - 0.15 * unit / c.rad);
        const up = add(c.c, scale(c.n, 0.012 * unit)), t0 = tri.length / TS;
        // a stem cell's top is a cup, the opening of its crypt
        const ck = types ? types[ci] : 0, Hc = ck === 2 ? cupH : H, rc = ck === 2 ? RINGS_CUP : rings;
        const corner = (ctr, off, kind, rim, shn, h) => tri.push(ctr[0], ctr[1], ctr[2], off[0], off[1], off[2], c.n[0], c.n[1], c.n[2], seed, kind, rim, shn[0], shn[1], shn[2], h, phase);
        const D = P.map((p) => sub(p, c.c));
        // the borders from corner to corner, the protein across each, and the chain each border's wedge belongs to
        const cn = corners[ci], sideOf = new Array(P.length).fill(0);
        const sides = cn.map((k0, j) => {
          const k1 = cn[(j + 1) % cn.length], o1 = owners.get(c.poly[k1]);
          for (let k = k0; k !== k1; k = (k + 1) % P.length) sideOf[k] = j;
          const other = owners.get(c.poly[k0]).find((o) => o !== ci && o1.includes(o));
          return { other: other == null ? -1 : other, code: cn.length === 5 ? 1 : other != null && corners[other].length === 5 ? 2 : 3 };
        });
        for (let e = 0; e < P.length; e++) {
          const a = D[e], b = D[(e + 1) % P.length];
          corner(c.c, [0, 0, 0], 0, 0, c.n, 0); corner(c.c, a, 0, 1, c.n, 0); corner(c.c, b, 0, 1, c.n, 0);
          corner(up, [0, 0, 0], 1, 0, c.n, 0); corner(up, scale(a, k), 1, 1, c.n, 0); corner(up, scale(b, k), 1, 1, c.n, 0);
        }
        // the mound: rings from the border in to the middle
        const out = D.map((d) => { const z = dot(d, c.n), flat = sub(d, scale(c.n, z)); return { dir: norm(flat), reach: Math.max(1e-6, len(flat)) }; });
        let kd = 2;
        const vert = (e, s) => {
          const o = out[e], hs = Hc(s), g = -dome * dH(Hc, s) / o.reach * (edgy || R ? 0.7 : 1.9);
          corner(c.c, scale(D[e], s), kd, arches ? 0.4 + 0.6 * hs : pairs ? 0.16 + 0.3 * hs : hs, s ? norm(add(c.n, scale(o.dir, g))) : c.n, dome * hs);
        };
        for (let e = 0; e < P.length; e++) {
          const f = (e + 1) % P.length;
          kd = R ? 2 + floorCode[ci] : cellLook ? 12 + CELL_FLOOR[ck] : chains && cn.length ? 2 + sides[sideOf[e]].code : 2;
          for (let r = 0; r + 1 < rc.length; r++) {
            const s0 = rc[r], s1 = rc[r + 1];
            vert(e, s0); vert(f, s0); vert(f, s1);
            vert(e, s0); vert(f, s1); vert(e, s1);
          }
          const sl = rc[rc.length - 1];
          vert(e, sl); vert(f, sl); vert(e, 0);
        }
        triRange.push([t0, tri.length / TS - t0]);

        // the lobes, each resting on the mound
        const { u, v, Q } = frames[ci];
        // the plane of the protein's border under a point, and how far out the point is (0 middle .. 1 border)
        const under = (x, y) => { const [h, s] = fanAt(Q, x, y); return [h, s === Infinity ? 0 : Math.min(1, s)]; };
        const p0 = pts.length / PS;
        // real structure: this cell's assemblies. They stand on the smooth shell, not on the cell's own
        // flat floor, and all at the height of the mounds' tops, so a helix or a lattice runs on unbroken
        // across the borders between cells. They rise, breathe and sink with their cell.
        // A close coat (R.seam) dips and thins a little where it crosses a border, so the cells still
        // show through it; the dip is the same seen from either side, so the coat stays unbroken.
        if (R) for (const { U } of own[ci]) {
          const T = U.t, N = U.n, B = vec.cross(N, T), useed = rnd();      // (inside the renderer, cross draws a mark)
          for (const [ba, bb, bz, r0, code, sh, kind] of U.balls) {
            const side = add(scale(T, ba), scale(B, bb)), off = Math.hypot(ba, bb);
            const pos = add(U.p, add(side, scale(N, bz)));
            let lift = dome, br = r0;
            if (R.seam) {
              const d = sub(pos, c.c), s = Math.min(1.2, fanAt(Q, dot(d, u), dot(d, v))[1]), k = smooth(0.8, 1.04, s);
              lift = dome * (1 - 0.5 * k); br = r0 * (1 - R.seam * k);
            }
            const shn = off > 1e-6 ? norm(add(N, scale(side, 0.45 / Math.max(off, br * 1.5)))) : N;
            pts.push(pos[0], pos[1], pos[2], N[0], N[1], N[2], shn[0], shn[1], shn[2], useed + 0.03 * rnd(), br, lift, kind || 0, phase, tone(code, sh));
            // tall spikes may stand a little past the fitted frame, as decoration does
            const reach = bz + br * 1.25;
            top = Math.max(top, lift * 1.3 + (reach < 0.15 ? reach : 0.15 + (reach - 0.15) * 0.5));
          }
        }
        if (edgy) {
          // Each protein sends one lobe towards each of its borders; the lobe from
          // the protein on the other side meets it there, so every border carries
          // an arch (a pair of protruding domains), and the middle stays a hollow.
          // A lobe is a stem, a shoulder and a head, each a few fused balls. The
          // arches across the borders between two six-sided proteins stand higher;
          // colour follows height over the whole shell, so only their crests go pale.
          for (let j = 0; j < cn.length; j++) {
            const k0 = cn[j], k1 = cn[(j + 1) % cn.length];
            let mx = 0, my = 0, cnt = 0, other = -1;
            for (let k = k0; ; k = (k + 1) % P.length) {
              mx += Q[k][0]; my += Q[k][1]; cnt++;
              if (k !== k0 && k !== k1) for (const o of owners.get(c.poly[k])) if (o !== ci) other = o;
              if (k === k1) break;
            }
            mx /= cnt; my /= cnt;
            const mr = Math.hypot(mx, my), dx = mx / mr, dy = my / mr;
            let tx = Q[k1][0] - Q[k0][0], ty = Q[k1][1] - Q[k0][1];
            const el = Math.hypot(tx, ty); tx /= el; ty /= el;
            const Xd = add(scale(u, dx), scale(v, dy)), Td = add(scale(u, tx), scale(v, ty));
            const tall = cn.length > 5 && other >= 0 && corners[other].length > 5 ? 1 : 0;
            const lseed = rnd();
            const blob = (rad, tan, z, a, b, cz, nSurf, rs) => {
              const bx = dx * rad + tx * tan, by = dy * rad + ty * tan;
              const [hp, sOut] = under(bx, by), lift = dome * H(sOut);
              const m0 = Math.min(a, b, cz);
              const put = (ex, ey, ez, r, nx, ny, nz) => {
                const pos = add(c.c, add(add(scale(u, bx + dx * ex + tx * ey), scale(v, by + dy * ex + ty * ey)), scale(c.n, hp + z + ez)));
                const shn = norm(add(add(scale(Xd, nx), scale(Td, ny)), scale(c.n, nz + 0.6)));
                toned.push([pts.length / PS, lift + z + ez + r]);
                pts.push(pos[0], pos[1], pos[2], c.n[0], c.n[1], c.n[2], shn[0], shn[1], shn[2], lseed + 0.04 * rnd(), r, lift, 0, phase, 0);
                top = Math.max(top, lift * 1.3 + z + ez + r * 1.25);
              };
              put(0, -0.35 * b, 0, m0 * 1.02, 0, -0.25, 1);
              put(0, 0.35 * b, 0, m0 * 1.02, 0, 0.25, 1);
              const rot = rnd() * 6.283;
              for (let i = 0; i < nSurf; i++) {
                const zz = 0.25 + 0.72 * (1 - (i + 0.5) / nSurf), rr = Math.sqrt(1 - zz * zz), ph = rot + i * 2.39996;
                const nx = rr * Math.cos(ph), ny = rr * Math.sin(ph);
                put(a * nx * 0.55, b * ny * 0.55, cz * zz * 0.55, m0 * rs * (0.85 + 0.3 * rnd()), nx / a * m0, ny / b * m0, zz / cz * m0);
              }
            };
            if (chains) {
              // one copy of the protein: a low stalk on the shell, then a head of two
              // fused lobes, the smaller reaching across the border to its partner's.
              // The partner's copy is the same turned half round, so the pair is a
              // two-fold arch. C/C arches stand flat and upright, A/B ones bend lower.
              const code = sides[j].code, up = tall;
              const emit = (pos, shn, r, lift, kind, sh) => pts.push(pos[0], pos[1], pos[2], c.n[0], c.n[1], c.n[2], shn[0], shn[1], shn[2], lseed + 0.03 * rnd(), r, lift, kind, phase, 1 + code + 0.98 * Math.max(0, Math.min(1, sh)));
              const lobe = (rad, tan, z, r, sh, tilt, lumps) => {
                const bx = dx * rad + tx * tan, by = dy * rad + ty * tan;
                const [hp, sOut] = under(bx, by), lift = dome * H(sOut);
                const pos = add(c.c, add(add(scale(u, bx), scale(v, by)), scale(c.n, hp + z)));
                emit(pos, norm(add(c.n, scale(Xd, tilt))), r, lift, 0, sh);
                top = Math.max(top, lift * 1.3 + z + r * 1.25);
                // close up, the head shows a few lumps of its own (kind 3: grown in only when zoomed)
                const rot = rnd() * 6.283;
                for (let i = 0; i < lumps; i++) {
                  const zz = 0.42 + 0.46 * (1 - (i + 0.5) / lumps), rr = Math.sqrt(1 - zz * zz), ph = rot + i * 2.39996;
                  const dir = add(add(scale(Xd, rr * Math.cos(ph)), scale(Td, rr * Math.sin(ph))), scale(c.n, zz));
                  emit(add(pos, scale(dir, r * 0.7)), norm(add(dir, scale(c.n, 0.4))), r * 0.46, lift, 3, sh + 0.06);
                }
              };
              // the leg stands inside the hollow; the head leans out over the border, where it meets its partner's
              lobe(0.68 * mr, -0.03 * el, 0.0, 0.22 * mr, 0.28, -0.25, 0);                                          // stalk, low
              lobe(0.83 * mr, 0.04 * el, (0.1 + 0.03 * up) * mr, 0.25 * mr, 0.5, 0.0, 0);                          // stalk, rising
              lobe((0.96 - 0.03 * up) * mr, 0.11 * el, (0.21 + 0.06 * up) * mr, (0.3 + 0.02 * up) * mr, 0.9, 0.3, 5);  // head
              continue;
            }
            if (pairs) {
              // one ball per domain, shaded like a sphere of its own; colour by kind, not by height
              const ball = (rad, tan, z, r, tone, tilt) => {
                const bx = dx * rad + tx * tan, by = dy * rad + ty * tan;
                const [hp, sOut] = under(bx, by), lift = dome * H(sOut);
                const pos = add(c.c, add(add(scale(u, bx), scale(v, by)), scale(c.n, hp + z)));
                const shn = norm(add(c.n, scale(Xd, tilt)));
                pts.push(pos[0], pos[1], pos[2], c.n[0], c.n[1], c.n[2], shn[0], shn[1], shn[2], lseed + 0.03 * rnd(), r, lift, 0, phase, tone);
                top = Math.max(top, lift * 1.3 + z + r * 1.25);
              };
              // the base of the arch (half of it from each side), darker and low, then the head on top
              ball(0.94 * mr, -0.03 * el, -0.02 * mr, 0.25 * mr, 0.26, 0.4);
              ball(0.86 * mr, 0.085 * el, (0.12 + 0.07 * tall) * mr, (0.28 + 0.03 * tall) * mr, tall ? 0.8 : 0.48, 0.25);
              continue;
            }
            const lift = 0.05 * mr * tall;
            blob(0.44 * mr, -0.05 * el, 0.0, 0.2 * mr, 0.32 * el, 0.13 * mr, 4, 0.85);
            blob(0.68 * mr, 0.02 * el, 0.05 * mr + lift * 0.5, 0.2 * mr, 0.3 * el, 0.15 * mr, 4, 0.85);
            blob(0.92 * mr, 0.1 * el, 0.1 * mr + lift, 0.18 * mr, 0.27 * el, 0.16 * mr, 5, 0.8);
          }
        }
        if (cellLook) top = Math.max(top, cellParts(c, frames[ci], ck, Hc, under, phase));
        const count = edgy || R || cellLook ? 0 : few[0] + Math.floor(rnd() * (few[1] - few[0] + 1)), a0 = rnd() * 6.283;
        for (let l = 0; l < count; l++) {
          const a = a0 + l * 6.283 / count + (rnd() - 0.5) * 0.8;
          const d = (count === 1 ? 0.16 * rnd() : 0.3 + 0.2 * rnd()) * c.rad;
          const r = (count <= 2 ? 0.44 : count === 3 ? 0.38 : 0.33) * c.rad * (0.72 + 0.5 * rnd());
          const x = Math.cos(a) * d, y = Math.sin(a) * d;
          let h = 0, s = 0;
          for (let e = 0; e < Q.length; e++) {
            const A = Q[e], B = Q[(e + 1) % Q.length], det = A[0] * B[1] - A[1] * B[0];
            if (Math.abs(det) < 1e-12) continue;
            const w1 = (x * B[1] - y * B[0]) / det, w2 = (A[0] * y - A[1] * x) / det;
            if (w1 >= -1e-6 && w2 >= -1e-6) { h = w1 * A[2] + w2 * B[2]; s = Math.min(1, w1 + w2); }
          }
          const lift = dome * prof(1 - s), tone = 0.34 + 0.66 * rnd();
          const pos = add(c.c, add(add(scale(u, x), scale(v, y)), scale(c.n, h + r * 0.22)));
          const shn = norm(add(c.n, scale(add(scale(u, x), scale(v, y)), 0.45 / c.rad)));
          pts.push(pos[0], pos[1], pos[2], c.n[0], c.n[1], c.n[2], shn[0], shn[1], shn[2], rnd(), r, lift, 0, phase, tone);
          top = Math.max(top, lift * 1.3 + r * 1.25);
        }
        ptRange.push([p0, pts.length / PS - p0]);
      });
      if (toned.length) {
        let lo = Infinity, hi = 0;
        for (const [, h] of toned) { lo = Math.min(lo, h); hi = Math.max(hi, h); }
        for (const [i, h] of toned) pts[i * PS + 14] = 0.3 + 0.7 * Math.pow((h - lo) / (hi - lo || 1), 1.8);
      }
      const cellPts = pts.length / PS;
      for (const d of R ? R.deco || [] : board.deco) pts.push(d.p[0], d.p[1], d.p[2], d.d[0], d.d[1], d.d[2], d.d[0], d.d[1], d.d[2], rnd(), d.r, 0, d.fade ? 2 : 1, 0, d.tone || rnd() * 0.6);

      // the frame stands just outside the lobes; it draws itself in from the top down
      const axis = norm([0.35, 0.88, 0.3]);
      let lo = Infinity, hi = -Infinity;
      const cage = (board.cage || []).map((l, i) => {
        let order = 0;
        const p = l.p.map((q, j) => { const w = add(q, scale(l.n[j], top * 0.8)); order -= dot(w, axis) / l.p.length; return w; });
        lo = Math.min(lo, order); hi = Math.max(hi, order);
        return { p, n: l.n, f: l.f, seed: i + 1, order, x: new Float32Array(p.length), y: new Float32Array(p.length), z: new Float32Array(p.length) };
      });
      cage.forEach((l) => { l.order = (l.order - lo) / (hi - lo || 1); });
      let cageReach = 0;
      cage.forEach((l) => l.p.forEach((q) => { cageReach = Math.max(cageReach, board.mode === 'free' ? Math.hypot(q[0], q[1], q[2]) - board.fit.hw : Math.max(Math.hypot(q[0], q[2]) - board.fit.hw, Math.abs(q[1]) - board.fit.hh)); }));

      // For the proteins' lines, every vertex and bead also learns where it sits on
      // its protein: 0 in the middle .. 1 at the border (-1 not on one), and how far
      // round the middle it is (in turns, unwrapped within each triangle).
      const TS2 = TS + 2, PS2 = PS + 2, nT = tri.length / TS, nP = pts.length / PS;
      const triData = new Float32Array(nT * TS2), ptData2 = new Float32Array(nP * PS2);
      const ex = [0, 0, 0], tx = [0, 0, 0], mid = [false, false, false];
      for (let ci = 0; ci < n; ci++) {
        const { u, v, Q } = frames[ci], [t0, tc] = triRange[ci];
        for (let t = t0; t < t0 + tc; t += 3) {
          let ref = null, sum = 0, cnt = 0;
          for (let j = 0; j < 3; j++) {
            const o = (t + j) * TS, kind = tri[o + 10];
            const x = tri[o + 3] * u[0] + tri[o + 4] * u[1] + tri[o + 5] * u[2], y = tri[o + 3] * v[0] + tri[o + 4] * v[1] + tri[o + 5] * v[2];
            ex[j] = kind < 0.5 ? -1 : kind < 1.5 ? tri[o + 11] : Math.min(1, fanAt(Q, x, y)[1]);
            mid[j] = Math.hypot(x, y) < 1e-9;
            if (mid[j]) continue;
            let a = Math.atan2(y, x) / TAU;
            if (ref == null) ref = a; else a = ref + (a - ref) - Math.round(a - ref);
            tx[j] = a; sum += a; cnt++;
          }
          for (let j = 0; j < 3; j++) {
            const o = (t + j) * TS, w = (t + j) * TS2;
            for (let k = 0; k < TS; k++) triData[w + k] = tri[o + k];
            triData[w + TS] = ex[j]; triData[w + TS + 1] = mid[j] ? (cnt ? sum / cnt : 0) : tx[j];
          }
        }
        const c = cells[ci], [p0, pc] = ptRange[ci];
        for (let i = p0; i < p0 + pc; i++) {
          const o = i * PS, kind = pts[o + 12], dx = pts[o] - c.c[0], dy = pts[o + 1] - c.c[1], dz = pts[o + 2] - c.c[2];
          ptData2[i * PS2 + PS] = kind > 0.5 && kind < 2.5 ? -1 : Math.min(1.3, fanAt(Q, dx * u[0] + dy * u[1] + dz * u[2], dx * v[0] + dy * v[1] + dz * v[2])[1]);
        }
      }
      for (let i = 0; i < nP; i++) {
        for (let k = 0; k < PS; k++) ptData2[i * PS2 + k] = pts[i * PS + k];
        if (i >= cellPts) ptData2[i * PS2 + PS] = -1;
      }
      const ptData = new Float32Array(pts);
      const m = {
        board, n, span, persp: PERSP / span, triRange, ptRange, pts: ptData, pad: top,              // how far the proteins stand out of the shell
        cage, cagePad: Math.max(top, cageReach),                                                 // how far the frame does
        rimLift: Math.max(0.1, H(1)) * dome, midLift: H(0) * dome,           // where an unlocked protein's border and middle appear to be
        nTri: tri.length / TS, nPt: pts.length / PS, cellPts,
        triState: new Float32Array(tri.length / TS * 4), ptState: new Float32Array(pts.length / PS * 4), last: new Float32Array(n * 4).fill(-1),
        vbTri: gl.createBuffer(), vbPt: gl.createBuffer(), vbTriState: gl.createBuffer(), vbPtState: gl.createBuffer(),
        // each protein's line: what this frame's overlay asked for, and what the GPU holds (see setLine)
        line: new Float32Array(n * 4), lineUp: new Float32Array(n * 4), triLine: new Float32Array(nT * 4), ptLine: new Float32Array(nP * 4),
        vbTriLine: gl.createBuffer(), vbPtLine: gl.createBuffer(),
        lay: {
          x: new Float32Array(n), y: new Float32Array(n), z: new Float32Array(n), s: new Float32Array(n), face: new Float32Array(n), vis: new Uint8Array(n), open: new Float32Array(n),
          poly: cells.map((c) => new Float32Array(c.poly.length * 2)), reach: cells.map((c) => { let r = 0; c.poly.forEach((v) => { r = Math.max(r, Math.hypot(board.verts[v][0] - c.c[0], board.verts[v][1] - c.c[1], board.verts[v][2] - c.c[2])); }); return r; }),
        },
        concave: board.spec.shape === 'phage' || board.spec.shape === 'filament',
        fused: arches, toon: pairs || chains || !!R || cellLook, chain: chains || !!R || cellLook,
      };
      gl.bindBuffer(gl.ARRAY_BUFFER, m.vbTri); gl.bufferData(gl.ARRAY_BUFFER, triData, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.vbPt); gl.bufferData(gl.ARRAY_BUFFER, ptData2, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.vbTriState); gl.bufferData(gl.ARRAY_BUFFER, m.triState, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.vbPtState); gl.bufferData(gl.ARRAY_BUFFER, m.ptState, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.vbTriLine); gl.bufferData(gl.ARRAY_BUFFER, m.triLine, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.vbPtLine); gl.bufferData(gl.ARRAY_BUFFER, m.ptLine, gl.DYNAMIC_DRAW);
      return m;
    }

    // a model's GPU buffers, when it will not be drawn again (the 交锋 builds one per tissue)
    function free(m) {
      if (!m) return;
      for (const k of ['vbTri', 'vbPt', 'vbTriState', 'vbPtState', 'vbTriLine', 'vbPtLine']) if (m[k]) { gl.deleteBuffer(m[k]); m[k] = null; }
    }

    // ---------- the frame ----------
    // Near lines go on the front canvas, over the proteins; far lines go on the
    // back canvas, where the shell itself hides whatever passes behind it.
    function strokeRun(ctx, X, Y, i0, i1, upto, seed, alpha, width, color) {
      let total = 0;
      for (let i = i0; i < i1; i++) total += Math.hypot(X[i + 1] - X[i], Y[i + 1] - Y[i]);
      if (total < 1 || alpha <= 0.004) return;
      const end = total * upto, amp0 = Math.min(1, total / 90);
      ctx.strokeStyle = color;
      for (let pass = 0; pass < 2; pass++) {
        const ph = seed * 12.9898 + pass * 4.37, amp = (pass ? 1.25 : 0.7) * amp0;
        ctx.beginPath();
        let d = 0, first = true;
        for (let i = i0; i < i1 && d < end; i++) {
          const dx = X[i + 1] - X[i], dy = Y[i + 1] - Y[i], seg = Math.hypot(dx, dy);
          if (seg < 1e-3) continue;
          const nx = -dy / seg, ny = dx / seg, steps = Math.max(1, Math.round(seg / 14));
          for (let k = first ? 0 : 1; k <= steps; k++) {
            const at = d + seg * k / steps;
            if (at > end + 0.01) break;
            const w = (Math.sin(at * 0.058 + ph) * 0.6 + Math.sin(at * 0.151 + ph * 1.7) * 0.4) * Math.min(1, at / 10, (total - at) / 10) * amp;
            const x = X[i] + dx * k / steps + nx * w, y = Y[i] + dy * k / steps + ny * w;
            if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
          }
          d += seg;
        }
        ctx.globalAlpha = Math.min(1, alpha * (pass ? 0.5 : 0.9));
        ctx.lineWidth = width * (pass ? 0.75 : 1);
        ctx.setLineDash(pass ? [total * 0.21, 3, total * 0.13, 2.5, total * 0.38, 4] : []);
        ctx.stroke();
      }
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    const cp = { x: 0, y: 0, z: 0, s: 1 };
    function cage(m, v, alpha, width) {
      const R = v.R, build = v.build == null ? 1 : v.build, A = (alpha == null ? 1 : alpha) * (1 - Math.min(1, (v.burst || 0) * 2.5)) * (v.dim == null ? 1 : v.dim);
      if (A <= 0.01) return;
      const w = width || Math.max(0.6, Math.min(1.35, v.px * m.span / 170));
      const toward = (d) => R[2][0] * d[0] + R[2][1] * d[1] + R[2][2] * d[2];
      for (const l of m.cage) {
        const t = Math.max(0, Math.min(1, build * 1.7 - l.order * 0.7));
        if (t <= 0) continue;
        const np = l.p.length;
        for (let i = 0; i < np; i++) { project(m, v, l.p[i], cp); l.x[i] = cp.x; l.y[i] = cp.y; l.z[i] = cp.z; }
        const depth = (i, j) => 0.6 + 0.4 * smooth(-0.3, 0.9, (l.z[i] + l.z[j]) / (2 * m.span));
        if (l.f) {
          const front = toward(l.f[0]) > 0.05 || toward(l.f[1]) > 0.05;
          if (front) strokeRun(cf, l.x, l.y, 0, np - 1, t, l.seed, 0.8 * depth(0, np - 1) * A, w, '#fff');
          else strokeRun(cb, l.x, l.y, 0, np - 1, t, l.seed, 0.3 * A, w * 0.8, '#fff');
          continue;
        }
        // a curved line: cut it where it passes from the near side to the far side
        const last = Math.max(1, Math.ceil(t * (np - 1)));
        let i0 = 0, side = toward(l.n[0]) + toward(l.n[1]) > 0.04;
        for (let i = 1; i <= last; i++) {
          const s = i < last ? toward(l.n[i]) + toward(l.n[i + 1]) > 0.04 : !side;
          if (s === side) continue;
          if (side) strokeRun(cf, l.x, l.y, i0, i, 1, l.seed + i0, 0.8 * depth(i0, i) * A, w, '#fff');
          else strokeRun(cb, l.x, l.y, i0, i, 1, l.seed + i0, 0.3 * A, w * 0.8, '#fff');
          i0 = i; side = s;
        }
      }
    }

    // st: 4 floats per protein (locked, marked, exposed, glow)
    function setState(m, st) {
      let dirty = false;
      for (let i = 0; i < m.n; i++) {
        const o = i * 4;
        if (st[o] === m.last[o] && st[o + 1] === m.last[o + 1] && st[o + 2] === m.last[o + 2] && st[o + 3] === m.last[o + 3]) continue;
        dirty = true;
        for (let k = 0; k < 4; k++) m.last[o + k] = st[o + k];
        for (const [arr, range] of [[m.triState, m.triRange[i]], [m.ptState, m.ptRange[i]]]) {
          for (let j = range[0] * 4, e = (range[0] + range[1]) * 4; j < e; j += 4) { arr[j] = st[o]; arr[j + 1] = st[o + 1]; arr[j + 2] = st[o + 2]; arr[j + 3] = st[o + 3]; }
        }
      }
      if (!dirty) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, m.vbTriState); gl.bufferSubData(gl.ARRAY_BUFFER, 0, m.triState);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.vbPtState); gl.bufferSubData(gl.ARRAY_BUFFER, 0, m.ptState);
    }

    // One line per protein, drawn into its own plate or mound (see FS_TRI) and onto
    // the beads along its border. The overlays ask for lines while they run; the
    // next draw sends the ones that changed and starts the list afresh, so a line
    // nobody asks for again is gone a frame later. A later request for the same
    // protein replaces an earlier one, as a later stroke used to cover it.
    //   rgb 0..255, alpha 0..1, width in CSS pixels (400 or more fills the protein)
    //   o: { under: 0..1 dark line beneath, dash: dashes round it, part: 0..1 of the way round drawn strongly }
    function setLine(m, i, rgb, alpha, width, o) {
      if (!(alpha > 0.01) || i < 0 || i >= m.n) return;
      const P = m.line, k = i * 4;
      P[k] = Math.round(rgb[0]) * 65536 + Math.round(rgb[1]) * 256 + Math.round(rgb[2]);
      P[k + 1] = Math.min(1, alpha) * 0.999 + 2 * Math.round(Math.min(1, (o && o.under) || 0) * 10);
      P[k + 2] = width;
      P[k + 3] = (o && o.part != null ? Math.max(0, Math.min(1, o.part)) : 1) + 2 * ((o && o.dash) || 0);
    }
    function syncLines(m) {
      const P = m.line, U = m.lineUp;
      for (let i = 0; i < m.n; i++) {
        const k = i * 4;
        if (P[k] === U[k] && P[k + 1] === U[k + 1] && P[k + 2] === U[k + 2] && P[k + 3] === U[k + 3]) continue;
        U[k] = P[k]; U[k + 1] = P[k + 1]; U[k + 2] = P[k + 2]; U[k + 3] = P[k + 3];
        for (const [arr, range, vb] of [[m.triLine, m.triRange[i], m.vbTriLine], [m.ptLine, m.ptRange[i], m.vbPtLine]]) {
          if (!range[1]) continue;
          for (let j = range[0] * 4, e = (range[0] + range[1]) * 4; j < e; j += 4) { arr[j] = P[k]; arr[j + 1] = P[k + 1]; arr[j + 2] = P[k + 2]; arr[j + 3] = P[k + 3]; }
          gl.bindBuffer(gl.ARRAY_BUFFER, vb);
          gl.bufferSubData(gl.ARRAY_BUFFER, range[0] * 16, arr.subarray(range[0] * 4, (range[0] + range[1]) * 4));
        }
      }
      P.fill(0);
    }

    let enabled = 0;
    function use(P, m, v) {
      gl.useProgram(P.p);
      for (let i = 0; i < Math.max(enabled, P.count); i++) { if (i < P.count) gl.enableVertexAttribArray(i); else gl.disableVertexAttribArray(i); }
      enabled = P.count;
      const R = v.R, U = P.U;
      gl.uniformMatrix3fv(U.u_rot, false, [R[0][0], R[1][0], R[2][0], R[0][1], R[1][1], R[2][1], R[0][2], R[1][2], R[2][2]]);
      gl.uniform2f(U.u_res, glc.width, glc.height);
      gl.uniform2f(U.u_center, v.cx * dpr, v.cy * dpr);
      gl.uniform1f(U.u_px, v.px * dpr);
      gl.uniform1f(U.u_persp, m.persp);
      gl.uniform1f(U.u_span, m.span);
      gl.uniform1f(U.u_time, v.time || 0);
      gl.uniform1f(U.u_breath, v.breath == null ? 1 : v.breath);
      gl.uniform1f(U.u_burst, v.burst || 0);
      gl.uniform1f(U.u_build, v.build == null ? 1 : v.build);
      gl.uniform1f(U.u_dim, v.dim == null ? 1 : v.dim);
      gl.uniform1f(U.u_clear, v.clear ? 1 : 0);
      gl.uniform1f(U.u_focus, v.focus || 0);
      gl.uniform1f(U.u_grain, grain);
      gl.uniform1f(U.u_aa, msaa ? 1 : 0);
      if (U.u_dpr) gl.uniform1f(U.u_dpr, dpr);
      if (U.u_tex) gl.uniform1i(U.u_tex, 0);
      if (U.u_fuse) gl.uniform1f(U.u_fuse, m.fused ? 1 : 0);
      if (U.u_toon) gl.uniform1f(U.u_toon, m.toon ? 1 : 0);
      if (U.u_chain) gl.uniform1f(U.u_chain, m.chain ? 1 : 0);
      if (U.u_detail) gl.uniform1f(U.u_detail, smooth(DETAIL[0], DETAIL[1], v.px * m.span));
    }
    // v: { R, cx, cy, px, state, time, breath, burst, build, dim, focus }
    function draw(m, v) {
      if (v.state) setState(m, v.state);
      syncLines(m);
      const F = Float32Array.BYTES_PER_ELEMENT, T2 = (TS + 2) * F, P2 = (PS + 2) * F;
      use(TRI, m, v);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.vbTri);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, T2, 0);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, T2, 3 * F);
      gl.vertexAttribPointer(2, 3, gl.FLOAT, false, T2, 6 * F);
      gl.vertexAttribPointer(3, 3, gl.FLOAT, false, T2, 9 * F);
      gl.vertexAttribPointer(4, 3, gl.FLOAT, false, T2, 12 * F);
      gl.vertexAttribPointer(5, 4, gl.FLOAT, false, T2, 15 * F);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.vbTriState);
      gl.vertexAttribPointer(6, 4, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.vbTriLine);
      gl.vertexAttribPointer(7, 4, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, m.nTri);
      use(PT, m, v);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.vbPt);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, P2, 0);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, P2, 3 * F);
      gl.vertexAttribPointer(2, 3, gl.FLOAT, false, P2, 6 * F);
      gl.vertexAttribPointer(3, 4, gl.FLOAT, false, P2, 9 * F);
      gl.vertexAttribPointer(4, 4, gl.FLOAT, false, P2, 13 * F);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.vbPtState);
      gl.vertexAttribPointer(5, 4, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.vbPtLine);
      gl.vertexAttribPointer(6, 4, gl.FLOAT, false, 0, 0);
      // beads leave alpha alone: their alpha only says how much of a pixel they cover
      gl.colorMask(true, true, true, false);
      if (msaa) gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE);
      gl.drawArrays(gl.POINTS, 0, v.spikes === false ? m.cellPts : m.nPt);
      if (msaa) gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
      gl.colorMask(true, true, true, true);
    }
    // after everything is drawn: make every covered sample opaque
    function finish() {
      gl.useProgram(FILL.p);
      for (let i = 0; i < Math.max(enabled, 1); i++) { if (i < 1) gl.enableVertexAttribArray(i); else gl.disableVertexAttribArray(i); }
      enabled = 1;
      gl.bindBuffer(gl.ARRAY_BUFFER, vbFill);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.colorMask(false, false, false, true); gl.depthMask(false); gl.depthFunc(gl.GREATER);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.colorMask(true, true, true, true); gl.depthMask(true); gl.depthFunc(gl.LEQUAL);
    }

    // ---------- the digits as a distance field ----------
    // Drawn once with the system's monospace face, then turned into distances
    // (Felzenszwalb & Huttenlocher), so a digit stays crisp at any size and angle.
    const GCELL = 96, GFONT = 72, GSPREAD = 6, GW = 1024, GH = 128;
    let glyphTex = null;
    function edt1(f, n, d, v, z) {
      let k = 0; v[0] = 0; z[0] = -1e20; z[1] = 1e20;
      for (let q = 1; q < n; q++) {
        let s;
        do { const r = v[k]; s = (f[q] + q * q - f[r] - r * r) / (2 * q - 2 * r); } while (s <= z[k] && --k > -1);
        k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
      }
      k = 0;
      for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const r = v[k]; d[q] = (q - r) * (q - r) + f[r]; }
    }
    function edt2(g, w, h) {
      const n = Math.max(w, h), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
      for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = g[y * w + x]; edt1(f, h, d, v, z); for (let y = 0; y < h; y++) g[y * w + x] = d[y]; }
      for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) f[x] = g[y * w + x]; edt1(f, w, d, v, z); for (let x = 0; x < w; x++) g[y * w + x] = Math.sqrt(d[x]); }
    }
    function glyphAtlas() {
      if (glyphTex) return glyphTex;
      const w = GCELL * 10, h = GCELL, c = document.createElement('canvas');
      c.width = w; c.height = h;
      const x = c.getContext('2d');
      x.fillStyle = '#fff'; x.font = '600 ' + GFONT + 'px ' + MONO; x.textAlign = 'center'; x.textBaseline = 'middle';
      for (let k = 0; k < 10; k++) x.fillText(String(k), k * GCELL + GCELL / 2, GCELL / 2 + GFONT * 0.04);
      const img = x.getImageData(0, 0, w, h).data, outer = new Float64Array(w * h), inner = new Float64Array(w * h);
      for (let i = 0; i < w * h; i++) {
        const a = img[i * 4 + 3] / 255;
        outer[i] = a >= 0.999 ? 0 : a <= 0.001 ? 1e20 : Math.pow(Math.max(0, 0.5 - a), 2);
        inner[i] = a <= 0.001 ? 0 : a >= 0.999 ? 1e20 : Math.pow(Math.max(0, a - 0.5), 2);
      }
      edt2(outer, w, h); edt2(inner, w, h);
      const out = new Uint8Array(GW * GH);
      for (let y = 0; y < h; y++) for (let k = 0; k < w; k++) {
        const sd = inner[y * w + k] - outer[y * w + k];       // pixels inside the ink (negative: outside)
        out[y * GW + k] = Math.round(255 * Math.max(0, Math.min(1, 0.75 + sd * 0.25 / GSPREAD)));
      }
      glyphTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, glyphTex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.ALPHA, GW, GH, 0, gl.ALPHA, gl.UNSIGNED_BYTE, out);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return glyphTex;
    }
    // a digit lying in the plane through p: rx, uy are half its width and height as world vectors
    const glyphs = [];
    function addGlyph(p, rx, uy, digit, rgb, alpha) {
      const u0 = digit * GCELL / GW, u1 = (digit + 1) * GCELL / GW, v1 = GCELL / GH, r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
      const at = (sx, sy, u, w) => glyphs.push(p[0] + rx[0] * sx + uy[0] * sy, p[1] + rx[1] * sx + uy[1] * sy, p[2] + rx[2] * sx + uy[2] * sy, u, w, r, g, b, alpha);
      at(-1, 1, u0, 0); at(1, 1, u1, 0); at(1, -1, u1, v1);
      at(-1, 1, u0, 0); at(1, -1, u1, v1); at(-1, -1, u0, v1);
    }
    function flushGlyphs(m, v) {
      if (!glyphs.length) return;
      use(GLYPH, m, v);
      gl.uniform1f(GLYPH.U.u_lift, 0.06 * m.board.unit);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, glyphAtlas());
      gl.bindBuffer(gl.ARRAY_BUFFER, vbGlyph); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(glyphs), gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 36, 0);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 36, 12);
      gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 36, 20);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.colorMask(true, true, true, false); gl.depthMask(false);
      gl.drawArrays(gl.TRIANGLES, 0, glyphs.length / 9);
      gl.colorMask(true, true, true, true); gl.depthMask(true); gl.disable(gl.BLEND);
      glyphs.length = 0;
    }
    const hexRgb = (h) => { const x = parseInt(h.slice(1), 16); return [x >> 16 & 255, x >> 8 & 255, x & 255]; };
    const NUM_RGB = NUM.map((h) => h ? hexRgb(h) : [255, 255, 255]);
    const WHITE = [255, 255, 255], PALE = [246, 255, 251];
    // the screen's right and up, laid into the plane with normal n
    const gr = [0, 0, 0], gu = [0, 0, 0];
    function screenAxes(R, n) {
      let d = R[0][0] * n[0] + R[0][1] * n[1] + R[0][2] * n[2];
      gr[0] = R[0][0] - n[0] * d; gr[1] = R[0][1] - n[1] * d; gr[2] = R[0][2] - n[2] * d;
      let l = Math.hypot(gr[0], gr[1], gr[2]) || 1; gr[0] /= l; gr[1] /= l; gr[2] /= l;
      d = R[1][0] * n[0] + R[1][1] * n[1] + R[1][2] * n[2];
      const e = R[1][0] * gr[0] + R[1][1] * gr[1] + R[1][2] * gr[2];
      gu[0] = R[1][0] - n[0] * d - gr[0] * e; gu[1] = R[1][1] - n[1] * d - gr[1] * e; gu[2] = R[1][2] - n[2] * d - gr[2] * e;
      l = Math.hypot(gu[0], gu[1], gu[2]) || 1; gu[0] /= l; gu[1] /= l; gu[2] /= l;
    }

    // ---------- projection shared by the shader and the 2D overlays ----------
    function project(m, v, p, out) {
      const R = v.R;
      const x = R[0][0] * p[0] + R[0][1] * p[1] + R[0][2] * p[2];
      const y = R[1][0] * p[0] + R[1][1] * p[1] + R[1][2] * p[2];
      const z = R[2][0] * p[0] + R[2][1] * p[1] + R[2][2] * p[2];
      const sc = 1 / (1 - z * m.persp);
      out.x = v.cx + x * v.px * sc; out.y = v.cy - y * v.px * sc; out.z = z; out.s = sc;
      return out;
    }
    const tmp = { x: 0, y: 0, z: 0, s: 1 };
    function inPoly(poly, x, y) {
      let inside = false;
      for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
        if ((poly[i + 1] > y) !== (poly[j + 1] > y) && x < (poly[j] - poly[i]) * (y - poly[i + 1]) / (poly[j + 1] - poly[i + 1]) + poly[i]) inside = !inside;
      }
      return inside;
    }
    // Where every protein is on screen right now. An unlocked protein is drawn
    // as granules standing out of the shell, so its outline and centre are
    // lifted to where those granules are; a locked one is the plate itself.
    const lifted = [0, 0, 0];
    function layout(m, v) {
      const L = m.lay, b = m.board, R = v.R, st = v.state;
      for (let i = 0; i < m.n; i++) {
        const c = b.cells[i], n = c.n, open = st ? 1 - Math.min(1, st[i * 4]) : 0, rim = m.rimLift * open, mid = m.midLift * open;
        lifted[0] = c.c[0] + n[0] * mid; lifted[1] = c.c[1] + n[1] * mid; lifted[2] = c.c[2] + n[2] * mid;
        project(m, v, lifted, tmp);
        L.x[i] = tmp.x; L.y[i] = tmp.y; L.z[i] = tmp.z; L.s[i] = tmp.s;
        // facing: the normal's view z
        L.face[i] = R[2][0] * n[0] + R[2][1] * n[1] + R[2][2] * n[2];
        const poly = L.poly[i];
        for (let k = 0; k < c.poly.length; k++) {
          const p = b.verts[c.poly[k]];
          lifted[0] = p[0] + n[0] * rim; lifted[1] = p[1] + n[1] * rim; lifted[2] = p[2] + n[2] * rim;
          project(m, v, lifted, tmp); poly[k * 2] = tmp.x; poly[k * 2 + 1] = tmp.y;
        }
        L.vis[i] = L.face[i] > 0.04 ? 1 : 0;
        L.open[i] = open;
      }
      if (m.concave) for (let i = 0; i < m.n; i++) if (L.vis[i] && pickPoly(m, v, L.x[i], L.y[i]) !== i) L.vis[i] = 0;
      m.view = v;
    }
    // the nearest outline that contains a screen point
    function pickPoly(m, v, x, y) {
      const L = m.lay;
      let best = -1, bz = -Infinity;
      for (let i = 0; i < m.n; i++) {
        if (L.face[i] <= 0.04 || L.z[i] <= bz) continue;
        const r = L.reach[i] * v.px * L.s[i] * 1.05, dx = x - L.x[i], dy = y - L.y[i];
        if (dx * dx + dy * dy > r * r) continue;
        if (inPoly(L.poly[i], x, y)) { best = i; bz = L.z[i]; }
      }
      return best;
    }
    // The protein under a screen point. Near the rim of the virus the granules
    // of an unlocked protein lean out over its neighbours, so what counts is
    // the granule actually drawn there; outlines decide only where there is
    // none (plates, grooves).
    function pick(m, v, x, y) {
      const L = m.lay, P = m.pts, R = v.R, persp = m.persp;
      let hit = -1, hz = -Infinity;
      for (let i = 0; i < m.n; i++) {
        if (L.open[i] < 0.5 || L.face[i] < -0.35) continue;
        const reach = (L.reach[i] + m.pad) * v.px * L.s[i] * 1.1, cx = x - L.x[i], cy = y - L.y[i];
        if (cx * cx + cy * cy > reach * reach) continue;
        for (let o = m.ptRange[i][0] * PS, e = o + m.ptRange[i][1] * PS; o < e; o += PS) {
          const h = P[o + 11], px = P[o] + P[o + 3] * h, py = P[o + 1] + P[o + 4] * h, pz = P[o + 2] + P[o + 5] * h;
          const z = R[2][0] * px + R[2][1] * py + R[2][2] * pz;
          if (z <= hz) continue;
          const sc = 1 / (1 - z * persp), r = P[o + 10] * v.px * sc;
          const dx = x - (v.cx + (R[0][0] * px + R[0][1] * py + R[0][2] * pz) * v.px * sc), dy = y - (v.cy - (R[1][0] * px + R[1][1] * py + R[1][2] * pz) * v.px * sc);
          if (dx * dx + dy * dy <= r * r) { hit = i; hz = z; }
        }
      }
      const under = pickPoly(m, v, x, y);
      if (hit < 0 || hit === under) return under;
      // a plate clearly nearer than the granule (another part of a bent or two-part shell) hides it
      if (under >= 0 && L.open[under] < 0.5 && L.z[under] > hz + 0.6 * L.reach[under]) return under;
      return L.face[hit] > 0.04 ? hit : -1;       // granules peeking over the rim belong to a protein on the far side
    }
    const radPx = (m, v, i) => m.board.cells[i].rad * v.px * m.lay.s[i];

    // ---------- hand-drawn line: two slightly wandering passes ----------
    function sketch(ctx, ax, ay, bx, by, seed, alpha, width, color, upto) {
      const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy), end = upto == null ? 1 : upto;
      if (len < 0.5 || alpha <= 0.004 || end <= 0) return;
      const nx = -dy / len, ny = dx / len, n = Math.max(3, Math.round(len / 16));
      ctx.strokeStyle = color || '#fff';
      for (let pass = 0; pass < 2; pass++) {
        const ph = seed * 12.9898 + pass * 4.37, amp = (pass ? 1.25 : 0.7) * Math.min(1, len / 90);
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
          const t = i / n * end, w = (Math.sin(t * 5.3 + ph) * 0.6 + Math.sin(t * 13.7 + ph * 1.7) * 0.4) * Math.sin(Math.PI * t) * amp;
          const x = ax + dx * t + nx * w, y = ay + dy * t + ny * w;
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.globalAlpha = alpha * (pass ? 0.5 : 0.9);
        ctx.lineWidth = width * (pass ? 0.75 : 1);
        ctx.setLineDash(pass ? [len * 0.21, 3, len * 0.13, 2.5, len * 0.38, 4] : []);
        ctx.stroke();
      }
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    function sketchCircle(ctx, x, y, r, seed, alpha, width) {
      if (alpha <= 0.004) return;
      ctx.strokeStyle = '#fff';
      for (let pass = 0; pass < 2; pass++) {
        const n = 72, ph = seed * 3.1 + pass * 2.2;
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
          const a = i / n * Math.PI * 2 + ph * 0.1, rr = r + (Math.sin(a * 3 + ph) * 0.6 + Math.sin(a * 7.3 + ph * 2.1) * 0.4) * (pass ? 1.6 : 0.9) + pass * 1.2;
          if (i) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        ctx.globalAlpha = alpha * (pass ? 0.45 : 0.9);
        ctx.lineWidth = width * (pass ? 0.75 : 1);
        ctx.setLineDash(pass ? [r * 0.5, 4, r * 0.3, 3, r * 0.9, 5] : []);
        ctx.stroke();
      }
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    function ring(ctx, x, y, r, alpha, width, color, dash) {
      if (alpha <= 0.01 || r <= 0) return;
      ctx.globalAlpha = Math.min(1, alpha); ctx.strokeStyle = color; ctx.lineWidth = width;
      ctx.setLineDash(dash || []);
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }

    // ---------- stippled ball sprites for legends ----------
    const sprites = {};
    function ball(rgb, rad) {
      const key = rgb.join(',') + '/' + rad.toFixed(1) + '/' + dpr;
      if (sprites[key]) return sprites[key];
      const R = rad * dpr, size = Math.ceil(R * 2) + 2, c = document.createElement('canvas');
      c.width = c.height = size;
      const x = c.getContext('2d'), img = x.createImageData(size, size), g = grain, mid = size / 2;
      for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
        const dx = (px + 0.5 - mid) / R, dy = (py + 0.5 - mid) / R, r2 = dx * dx + dy * dy;
        if (r2 > 1) continue;
        const nz = Math.sqrt(1 - r2), micro = dx * LIGHT[0] - dy * LIGHT[1] + nz * LIGHT[2];
        const lit = smooth(0.1, 0.8, 0.92 * (0.6 + 0.4 * micro));
        const on = hash2(Math.floor(px / g), Math.floor(py / g) + Math.round(rad * 31)) < lit ? 1 : 0;
        const tone = (lit + (on - lit) * 0.42 * (1 - smooth(0.55, 0.95, lit))) * (0.5 + 0.5 * smooth(0, 0.42, nz));
        const o = (py * size + px) * 4, edge = Math.min(1, (1 - Math.sqrt(r2)) * R);
        for (let k = 0; k < 3; k++) { const dark = rgb[k] * 0.2 + 11; img.data[o + k] = dark + (rgb[k] - dark) * tone; }
        img.data[o + 3] = 255 * edge;
      }
      x.putImageData(img, 0, 0);
      return (sprites[key] = c);
    }

    // ---------- glyphs ----------
    // antibody: a Y with two short hands
    function antibody(ctx, x, y, s, alpha, color, rot) {
      if (alpha <= 0.01 || s < 2) return;
      ctx.save();
      ctx.translate(x, y); ctx.rotate(rot || 0);
      ctx.globalAlpha = Math.min(1, alpha); ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.3, s * 0.2);
      ctx.beginPath();
      ctx.moveTo(0, s * 0.72); ctx.lineTo(0, s * 0.02);
      ctx.lineTo(-s * 0.52, -s * 0.6); ctx.moveTo(0, s * 0.02); ctx.lineTo(s * 0.52, -s * 0.6);
      ctx.stroke();
      ctx.restore();
    }
    function cross(ctx, x, y, s, alpha, color) {
      if (alpha <= 0.01 || s < 2) return;
      ctx.globalAlpha = Math.min(1, alpha); ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.3, s * 0.22);
      ctx.beginPath(); ctx.moveTo(x - s * 0.5, y - s * 0.5); ctx.lineTo(x + s * 0.5, y + s * 0.5); ctx.moveTo(x + s * 0.5, y - s * 0.5); ctx.lineTo(x - s * 0.5, y + s * 0.5); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    function outline(m, i, k, alpha, width, color, dash, under) {
      if (alpha <= 0.01) return;
      const L = m.lay, poly = L.poly[i], cx = L.x[i], cy = L.y[i];
      cf.beginPath();
      for (let j = 0; j < poly.length; j += 2) {
        const x = cx + (poly[j] - cx) * k, y = cy + (poly[j + 1] - cy) * k;
        if (j) cf.lineTo(x, y); else cf.moveTo(x, y);
      }
      cf.closePath();
      // a dark line underneath keeps the outline readable on pale granules
      if (under) { cf.setLineDash([]); cf.globalAlpha = Math.min(1, alpha) * under; cf.strokeStyle = '#0b0d12'; cf.lineWidth = width + 2.4; cf.stroke(); }
      cf.globalAlpha = Math.min(1, alpha); cf.strokeStyle = color; cf.lineWidth = width;
      cf.setLineDash(dash || []);
      cf.stroke();
      cf.setLineDash([]); cf.globalAlpha = 1;
    }
    function fillCell(m, i, alpha, rgb) {
      if (alpha <= 0.004) return;
      const poly = m.lay.poly[i];
      cf.beginPath();
      for (let j = 0; j < poly.length; j += 2) { if (j) cf.lineTo(poly[j], poly[j + 1]); else cf.moveTo(poly[j], poly[j + 1]); }
      cf.closePath();
      cf.globalAlpha = Math.min(1, alpha); cf.fillStyle = css(rgb); cf.fill(); cf.globalAlpha = 1;
    }
    const mintCss = css(MINT), hotCss = css(HOT);

    /*
     * Everything drawn over the shell while playing. ui:
     *   reading(i) -> -1 or the number        alpha  overall strength
     *   hover, near[] (neighbours of hover), hoverKind 'dose' | 'flag' | 'chord' | 'none'
     *   armed  cell waiting for a second tap  start  cell for the first dose (or -1)
     *   hint { cell, kind, why[], flags[] }   fx [{ type, cell, t, ... }]
     *   reveal 0..1 + mines[] + wrong[]       shown when the virus escapes
     */
    function overlay(m, v, ui) {
      const L = m.lay, st = v.state, time = v.time || 0, A = ui.alpha == null ? 1 : ui.alpha;
      if (A <= 0.01) return;
      cf.textAlign = 'center'; cf.textBaseline = 'middle';
      const b = m.board, R = v.R;
      for (let i = 0; i < m.n; i++) {
        if (!L.vis[i]) continue;
        const f = L.face[i], r = radPx(m, v, i), lock = st[i * 4], flag = st[i * 4 + 1], miss = st[i * 4 + 2];
        const fade = smooth(0.06, 0.4, f) * A;
        if (lock > 0.05) {
          setLine(m, i, WHITE, 0.3 * lock * fade, 1);
          const num = ui.reading(i);
          if (num > 0 && lock > 0.4) {
            const px = Math.round(Math.min(1.25 * r, 3.1 * r * f, 40));
            if (px >= 7) {
              // printed on the plate itself, so it tilts and hides with it
              const c = b.cells[i], n = c.n, em = Math.min(1.25 * c.rad, 40 / (v.px * L.s[i])), half = em * GCELL / GFONT / 2, h = 0.016 * b.unit;
              screenAxes(R, n);
              addGlyph([c.c[0] + n[0] * h, c.c[1] + n[1] * h, c.c[2] + n[2] * h], [gr[0] * half, gr[1] * half, gr[2] * half], [gu[0] * half, gu[1] * half, gu[2] * half],
                num % 10, NUM_RGB[num] || WHITE, Math.min(1, (lock - 0.4) / 0.4) * smooth(0.1, 0.42, f) * A);
            }
          }
        }
        const g = Math.min(r * 0.92, r * 2.6 * f);
        if (miss > 0.05) cross(cf, L.x[i], L.y[i], g * 1.05, miss * fade, '#fff');
        else if (flag > 0.05) antibody(cf, L.x[i], L.y[i], g * (0.6 + 0.4 * flag), flag * fade, '#f4fffa');
      }
      // the escape: show what was left
      if (ui.reveal > 0.01) {
        for (const i of ui.mines || []) if (L.vis[i]) cross(cf, L.x[i], L.y[i], radPx(m, v, i) * 0.8, ui.reveal * 0.9 * A, hotCss);
        for (const i of ui.wrong || []) if (L.vis[i]) ring(cf, L.x[i], L.y[i], radPx(m, v, i) * 0.9, ui.reveal * A, 1.4, hotCss, [3, 3]);
      }
      // first dose target
      if (ui.start >= 0 && L.vis[ui.start]) {
        const i = ui.start, r = radPx(m, v, i), ph = (time * 0.8) % 1;
        ring(cf, L.x[i], L.y[i], r * (0.9 + 1.5 * ph), (1 - ph) * 0.9 * A, 1.6, mintCss);
        ring(cf, L.x[i], L.y[i], r * 0.9, 0.95 * A, 1.6, mintCss);
        setLine(m, i, MINT, 0.9 * A, 1.6);
      }
      // hover: the protein and everything it touches
      if (ui.hover >= 0 && L.vis[ui.hover]) {
        const act = ui.hoverKind !== 'none';
        // neighbours: a thin mint line round each one, locked or not
        for (const j of ui.near || []) if (L.vis[j]) setLine(m, j, MINT, 0.95 * A, 1.4, { under: 0.5 });
        // the protein itself: a heavy pale line round it, dashed when a click would do nothing
        setLine(m, ui.hover, PALE, A, 2.6, { under: 0.7, dash: act ? 0 : 12 });
      }
      if (ui.armed >= 0 && L.vis[ui.armed]) {
        const i = ui.armed, r = radPx(m, v, i);
        ring(cf, L.x[i], L.y[i], r * (1.25 + 0.08 * Math.sin(time * 6)), A, 1.8, mintCss);
      }
      // hint: the readings it rests on, then the protein it settles
      const h = ui.hint;
      if (h) {
        const hot = h.kind === 'badflag' || h.kind === 'miss', col = hot ? hotCss : mintCss;
        for (const w of h.why || []) if (L.vis[w]) {
          const r = radPx(m, v, w);
          ring(cf, L.x[w], L.y[w], r * 1.08, 0.95 * A, 1.5, '#fff', [3, 3.5]);
          if (h.cell >= 0 && L.vis[h.cell]) sketch(cf, L.x[w], L.y[w], L.x[h.cell], L.y[h.cell], w + 1, 0.4 * A, 1, '#fff');
        }
        for (const w of h.flags || []) if (L.vis[w]) ring(cf, L.x[w], L.y[w], radPx(m, v, w) * 1.02, 0.8 * A, 1.2, mintCss, [2, 3]);
        for (const c of h.cells || [h.cell]) if (c >= 0 && L.vis[c]) {
          const r = radPx(m, v, c), ph = (time * 0.9) % 1, main = c === h.cell;
          if (main) ring(cf, L.x[c], L.y[c], r * (1 + 1.2 * ph), (1 - ph) * 0.9 * A, 1.6, col);
          setLine(m, c, hot ? HOT : MINT, (main ? 1 : 0.7) * A, main ? 2.2 : 1.5, { under: 0.4 });
          if (h.kind === 'flag' && st[c * 4 + 1] < 0.5) antibody(cf, L.x[c], L.y[c], r * 0.8, (0.55 + 0.4 * Math.sin(time * 5)) * A, mintCss);
        }
      }
      // effects
      for (const e of ui.fx || []) {
        const i = e.cell;
        if (e.type === 'ab') {            // an antibody flying in from outside
          const t = e.t, k = 1 - Math.pow(1 - t, 3), x = e.fx + (L.x[i] - e.fx) * k, y = e.fy + (L.y[i] - e.fy) * k;
          antibody(cf, x, y, radPx(m, v, i) * (1.5 - 0.6 * k), Math.min(1, t * 4) * A, mintCss, (1 - k) * e.spin);
          continue;
        }
        if (!L.vis[i]) continue;
        const r = radPx(m, v, i);
        if (e.type === 'lock') ring(cf, L.x[i], L.y[i], r * (0.5 + 0.9 * e.t), (1 - e.t) * 0.75 * A, 1.4, mintCss);
        else if (e.type === 'dose') { ring(cf, L.x[i], L.y[i], r * (0.4 + 2.6 * e.t), (1 - e.t) * A, 2, mintCss); ring(cf, L.x[i], L.y[i], r * (0.2 + 1.5 * e.t), (1 - e.t) * 0.6 * A, 1.2, '#fff'); }
        else if (e.type === 'miss') { ring(cf, L.x[i], L.y[i], r * (0.6 + 3.2 * e.t), (1 - e.t) * A, 2.4, hotCss); ring(cf, L.x[i], L.y[i], r * (0.4 + 1.8 * e.t), (1 - e.t) * 0.8 * A, 1.4, '#fff', [3, 4]); }
        else if (e.type === 'clear') ring(cf, L.x[i], L.y[i], r * (1.2 - 0.9 * e.t), e.t * (1 - e.t) * 3 * A, 1.6, mintCss);
      }
      flushGlyphs(m, v);
    }

    /*
     * 交锋 · 守住这团细胞, drawn over the cells (game.js drawDuel fills ui):
     *   alpha        overall strength          surf   how far the cell tops stand above the unit sphere
     *   cells[i]     0 healthy, 1 infected, 2 lost          left[i]  0..1 of an infected cell's time still to go
     *   vir[]        { id, p, st, bind, bindK, coat, sink, cell, k }   p: world point; st 'drift' | 'land' | 'coat' | 'engulf'
     *   shadows[]    { cell, k }                clouds[] { id, u, cos, k (life left 0..1), age (s) }
     *   dots[]       { id, p, left (s) }        screen spots are written back into dotOut
     *   mac          { p, eat: { p, k } | null, curl: { p, t } | null, hover, grab }   its screen spot is written into mac.out
     *   reach[]      cells it reaches now       route[] cells of a route being drawn       path[] world points still to crawl
     *   preview      { cells[], u, cos } where a click would put a cloud
     *   hint         { text, from, to } world points            threats[] { p, hot, k } edge arrows go into arrowOut
     *   fx[]         { type, t, ... }           bounds { x0, y0, x1, y1 } the stage
     */
    const goldCss = css(GOLD), ICE = '#f4fffa', DARK = '#0b0d12', MUCUS = css(CHAIN[2]), LILAC = '#cbb9f2';
    // for each cell, the cell across each edge of its outline (-1 none)
    function acrossOf(m) {
      if (m.across) return m.across;
      const b = m.board, own = new Map();
      b.cells.forEach((c, i) => c.poly.forEach((q) => { if (!own.has(q)) own.set(q, []); own.get(q).push(i); }));
      m.across = b.cells.map((c, i) => c.poly.map((q, e) => {
        const r = c.poly[(e + 1) % c.poly.length], o = own.get(r);
        const j = own.get(q).find((k) => k !== i && o.indexOf(k) >= 0);
        return j == null ? -1 : j;
      }));
      return m.across;
    }
    const SANS = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", sans-serif';
    const qa = { x: 0, y: 0, z: 0, s: 1 }, qb = { x: 0, y: 0, z: 0, s: 1 }, qc = { x: 0, y: 0, z: 0, s: 1 }, pa = [0, 0, 0];
    const F = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, face: 1, s: 1 };
    // the screen image of the plane touching the clump at p (normal n): local model units -> CSS pixels
    function frameAt(m, v, p, n) {
      const t = tangent(n), u = t[0], w = t[1], e = 0.02, R = v.R;
      project(m, v, p, qa);
      pa[0] = p[0] + u[0] * e; pa[1] = p[1] + u[1] * e; pa[2] = p[2] + u[2] * e; project(m, v, pa, qb);
      pa[0] = p[0] + w[0] * e; pa[1] = p[1] + w[1] * e; pa[2] = p[2] + w[2] * e; project(m, v, pa, qc);
      F.a = (qb.x - qa.x) / e; F.b = (qb.y - qa.y) / e; F.c = (qc.x - qa.x) / e; F.d = (qc.y - qa.y) / e; F.e = qa.x; F.f = qa.y;
      F.face = R[2][0] * n[0] + R[2][1] * n[1] + R[2][2] * n[2]; F.s = qa.s;
      return F;
    }
    // a path traced in that plane; the stroke afterwards keeps its width in screen pixels
    function onPlane(fn) { cf.save(); cf.transform(F.a, F.b, F.c, F.d, F.e, F.f); cf.beginPath(); fn(); cf.restore(); }
    const lx = (x, y) => F.e + F.a * x + F.c * y, ly = (x, y) => F.f + F.b * x + F.d * y;
    // how much of a point above the clump is in view: in front, or out past its silhouette
    function seenAt(v, p, rb) {
      const R = v.R, z = R[2][0] * p[0] + R[2][1] * p[1] + R[2][2] * p[2];
      if (z >= 0.03) return 1;
      const x = R[0][0] * p[0] + R[0][1] * p[1] + R[0][2] * p[2], y = R[1][0] * p[0] + R[1][1] * p[1] + R[1][2] * p[2];
      return Math.max(smooth(-0.1, 0.03, z / (len(p) || 1)), smooth(0, 0.08, Math.sqrt(x * x + y * y) - rb));
    }
    // a norovirus at this scale: a dark ball ringed with a few round outlines
    function virusGlyph(x, y, r, rot, col, alpha) {
      if (alpha <= 0.01 || r < 1.5) return;
      cf.globalAlpha = Math.min(1, alpha) * 0.88; cf.fillStyle = '#1c1416';
      cf.beginPath(); cf.arc(x, y, r * 0.98, 0, TAU); cf.fill();
      cf.globalAlpha = Math.min(1, alpha); cf.strokeStyle = col; cf.lineWidth = Math.max(1, r * 0.1);
      cf.beginPath(); cf.arc(x, y, r * 0.42, 0, TAU);
      for (let k = 0; k < 7; k++) {
        const a = rot + k * TAU / 7, bx = x + Math.cos(a) * r * 0.7, by = y + Math.sin(a) * r * 0.7;
        cf.moveTo(bx + r * 0.27, by); cf.arc(bx, by, r * 0.27, 0, TAU);
      }
      cf.stroke();
      cf.globalAlpha = 1;
    }
    function chevron(x, y, ux, uy, s, alpha, color) {
      cf.globalAlpha = Math.min(1, alpha); cf.fillStyle = color;
      const px = -uy, py = ux;
      cf.beginPath();
      cf.moveTo(x + ux * s, y + uy * s);
      cf.lineTo(x - ux * s * 0.5 + px * s * 0.8, y - uy * s * 0.5 + py * s * 0.8);
      cf.lineTo(x - ux * s * 0.1, y - uy * s * 0.1);
      cf.lineTo(x - ux * s * 0.5 - px * s * 0.8, y - uy * s * 0.5 - py * s * 0.8);
      cf.closePath(); cf.fill();
      cf.globalAlpha = 1;
    }
    function label(text, x, y, px, color, alpha, backing) {
      cf.font = '600 ' + px + 'px ' + SANS;
      cf.textAlign = 'center'; cf.textBaseline = 'middle';
      if (backing) {
        const w = cf.measureText(text).width + px * 1.1;
        cf.globalAlpha = Math.min(1, alpha) * 0.82; cf.fillStyle = 'rgba(22,22,24,1)';
        cf.fillRect(x - w / 2, y - px * 0.85, w, px * 1.7);
      }
      cf.globalAlpha = Math.min(1, alpha); cf.fillStyle = color; cf.fillText(text, x, y + px * 0.05);
      cf.globalAlpha = 1;
    }
    // points along the clump from a to b (unit directions) at height h
    const arcPts = [];
    function arcRun(m, v, a, b, h) {
      const R = v.R;
      for (let k = 0; k <= 10; k++) {
        const t = k / 10, d = norm([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
        pa[0] = d[0] * h; pa[1] = d[1] * h; pa[2] = d[2] * h;
        project(m, v, pa, qa);
        arcPts.push(qa.x, qa.y, R[2][0] * d[0] + R[2][1] * d[1] + R[2][2] * d[2]);
      }
    }
    function strokeArcs(alpha, width, color, dash, offset) {
      cf.globalAlpha = Math.min(1, alpha); cf.strokeStyle = color; cf.lineWidth = width;
      cf.setLineDash(dash || []); cf.lineDashOffset = offset || 0;
      cf.beginPath();
      let pen = false;
      for (let i = 0; i < arcPts.length; i += 3) {
        if (arcPts[i + 2] < 0.04) { pen = false; continue; }
        if (pen) cf.lineTo(arcPts[i], arcPts[i + 1]); else cf.moveTo(arcPts[i], arcPts[i + 1]);
        pen = true;
      }
      cf.stroke();
      cf.setLineDash([]); cf.lineDashOffset = 0; cf.globalAlpha = 1;
    }
    const pq = { x: 0, y: 0, z: 0, s: 1 };
    function duel(m, v, ui) {
      const A = ui.alpha == null ? 1 : ui.alpha, time = v.time || 0, b = m.board, Rm = v.R;
      if (A <= 0.01) return;
      const L = m.lay, surf = ui.surf, unitPx = b.unit * v.px, rbPx = surf * v.px;
      const cellAt = (i) => scale(b.cells[i].n, surf);
      cf.lineCap = 'round'; cf.lineJoin = 'round';

      // lost cells keep a faint rim; infected ones a hot one
      for (let i = 0; i < m.n; i++) {
        if (!L.vis[i]) continue;
        const fade = smooth(0.06, 0.4, L.face[i]) * A;
        if (ui.cells[i] === 2) outline(m, i, 1, 0.24 * fade, 1, '#fff');
        else if (ui.cells[i] === 1) outline(m, i, 0.96, (0.45 + 0.25 * Math.sin(time * 7 + i)) * fade, 1.4, hotCss);
      }

      // mucus: a soft, wet edge round the cells it covers (the goblet cell and its ring), following the
      // cells' own borders, so it never reads as a cloud's round cap
      if (ui.mucus) {
        const ac = acrossOf(m);
        for (let i = 0; i < m.n; i++) if (ui.mucus[i] && L.vis[i]) fillCell(m, i, 0.07 * smooth(0.06, 0.4, L.face[i]) * A, CHAIN[2]);
        for (const [w, a] of [[5.5, 0.16], [1.4, 0.62]]) {
          cf.lineWidth = w; cf.strokeStyle = MUCUS;
          for (let i = 0; i < m.n; i++) {
            if (!ui.mucus[i] || !L.vis[i]) continue;
            const poly = L.poly[i], k = poly.length / 2, fade = smooth(0.06, 0.4, L.face[i]) * A;
            cf.globalAlpha = a * fade; cf.beginPath();
            for (let e = 0; e < k; e++) {
              const j = ac[i][e];
              if (j >= 0 && ui.mucus[j]) continue;
              const f = (e + 1) % k;
              cf.moveTo(poly[e * 2], poly[e * 2 + 1]); cf.lineTo(poly[f * 2], poly[f * 2 + 1]);
            }
            cf.stroke();
          }
        }
        cf.globalAlpha = 1;
      }

      // antibody clouds: a pale cap over the cells they cover
      for (const c of ui.clouds) {
        const th = Math.acos(Math.max(-1, Math.min(1, c.cos))), [e1, e2] = tangent(c.u), sn = Math.sin(th), cs = Math.cos(th);
        const blink = c.k < 0.18 ? 0.55 + 0.45 * Math.sin(time * 18) : 1, grow = smooth(0, 0.35, c.age), a = A * blink * grow;
        let any = false;
        cf.beginPath();
        for (let k = 0; k <= 36; k++) {
          const ph = k / 36 * TAU, co = Math.cos(ph), si = Math.sin(ph);
          const d = [c.u[0] * cs + (e1[0] * co + e2[0] * si) * sn, c.u[1] * cs + (e1[1] * co + e2[1] * si) * sn, c.u[2] * cs + (e1[2] * co + e2[2] * si) * sn];
          pa[0] = d[0] * surf * 1.03; pa[1] = d[1] * surf * 1.03; pa[2] = d[2] * surf * 1.03;
          project(m, v, pa, qa);
          let x = qa.x, y = qa.y;
          if (qa.z < 0) { const dx = x - v.cx, dy = y - v.cy, dl = Math.hypot(dx, dy) || 1; x = v.cx + dx / dl * rbPx; y = v.cy + dy / dl * rbPx; } else any = true;
          if (k) cf.lineTo(x, y); else cf.moveTo(x, y);
        }
        if (!any) continue;
        cf.closePath();
        cf.globalAlpha = 0.11 * a; cf.fillStyle = ICE; cf.fill();
        cf.globalAlpha = 0.55 * a; cf.strokeStyle = ICE; cf.lineWidth = 1.3; cf.setLineDash([5, 5]); cf.stroke(); cf.setLineDash([]);
        cf.globalAlpha = 1;
      }

      // landing shadows: darker the closer the particle is
      for (const sh of ui.shadows) {
        const n = b.cells[sh.cell].n;
        frameAt(m, v, cellAt(sh.cell), n);
        const fade = smooth(-0.02, 0.2, F.face) * A, k = sh.k;
        if (fade <= 0.01) continue;
        const r = b.unit * (0.78 - 0.3 * k);
        onPlane(() => cf.arc(0, 0, r, 0, TAU));
        cf.globalAlpha = (0.12 + 0.55 * k * k) * fade; cf.fillStyle = '#08060a'; cf.fill();
        cf.globalAlpha = (0.25 + 0.6 * k) * fade; cf.strokeStyle = hotCss; cf.lineWidth = 1.3; cf.setLineDash([3, 4]); cf.stroke(); cf.setLineDash([]);
        cf.globalAlpha = 1;
      }

      // infected cells: a ring that runs down to the burst
      for (let i = 0; i < m.n; i++) {
        if (ui.cells[i] !== 1) continue;
        const n = b.cells[i].n;
        frameAt(m, v, cellAt(i), n);
        const fade = smooth(-0.02, 0.2, F.face) * A, left = ui.left[i];
        if (fade <= 0.01) continue;
        const r = b.unit * 0.84, beat = 0.5 + 0.5 * Math.sin(time * (5 + 9 * (1 - left)));
        onPlane(() => cf.arc(0, 0, r, 0, TAU));
        cf.globalAlpha = 0.25 * fade; cf.strokeStyle = hotCss; cf.lineWidth = 2; cf.stroke();
        onPlane(() => cf.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + TAU * left));
        cf.globalAlpha = (0.75 + 0.25 * beat) * fade; cf.lineWidth = 3.2 + 1.4 * beat * (1 - left); cf.stroke();
        cf.globalAlpha = 1;
      }

      // stem cells at work: a lilac ring runs round the stem cell, and a faint line goes to the cell it is growing back
      for (const g of ui.regrow || []) {
        const n = b.cells[g.stem].n;
        arcPts.length = 0;
        arcRun(m, v, n, b.cells[g.cell].n, surf * 1.02);
        strokeArcs(0.45 * A, 1.6, LILAC, [3, 5], -time * 10);
        frameAt(m, v, cellAt(g.stem), n);
        const fade = smooth(-0.02, 0.2, F.face) * A;
        if (fade <= 0.01) continue;
        const r = b.unit * 0.78;
        onPlane(() => cf.arc(0, 0, r, 0, TAU));
        cf.globalAlpha = 0.5 * fade; cf.strokeStyle = DARK; cf.lineWidth = 4.4; cf.stroke();
        cf.globalAlpha = 0.3 * fade; cf.strokeStyle = LILAC; cf.lineWidth = 2; cf.stroke();
        onPlane(() => cf.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + TAU * g.k));
        cf.globalAlpha = 0.95 * fade; cf.lineWidth = 2.6; cf.stroke();
        cf.globalAlpha = 1;
      }

      // where the macrophage reaches, where a cloud would land
      for (const i of ui.reach || []) if (L.vis[i]) outline(m, i, 0.9, (ui.mac && (ui.mac.hover || ui.mac.grab) ? 0.85 : 0.32) * smooth(0.06, 0.4, L.face[i]) * A, 1.3, mintCss, null, 0.35);
      const pv = ui.preview;
      if (pv) for (const i of pv.cells) if (L.vis[i]) outline(m, i, 0.94, 0.75 * A, 1.4, ICE, [4, 4], 0.45);

      // the path still to crawl, then a route being drawn
      if (ui.path && ui.path.length > 1) {
        arcPts.length = 0;
        for (let k = 0; k + 1 < ui.path.length; k++) arcRun(m, v, ui.path[k], ui.path[k + 1], surf * 1.02);
        strokeArcs(0.75 * A, 2, mintCss, [6, 6], -time * 24);
      }
      if (ui.route && ui.route.length > 1) {
        const r = ui.route;
        arcPts.length = 0;
        for (let k = 0; k + 1 < r.length; k++) arcRun(m, v, b.cells[r[k]].n, b.cells[r[k + 1]].n, surf * 1.02);
        strokeArcs(0.5 * A, 6, DARK);
        strokeArcs(A, 3.2, mintCss);
        const end = r[r.length - 1];
        if (L.vis[end]) { outline(m, end, 1.02, A, 2.4, mintCss, null, 0.6); for (const j of b.adj ? b.adj[end] : []) if (L.vis[j]) outline(m, j, 0.9, 0.85 * A, 1.3, mintCss, null, 0.35); }
      }

      // receptors gathering and the particles themselves
      for (const p of ui.vir) {
        const rv = b.unit * 0.36;
        if (p.st === 'drift') continue;
        const n = b.cells[p.cell].n;
        frameAt(m, v, p.p, n);
        const fade = smooth(-0.02, 0.2, F.face) * A;
        if (fade <= 0.01) continue;
        const rpx = rv * Math.hypot(F.a, F.b), x = F.e, y = F.f;
        if (p.st === 'land' || p.st === 'engulf') {
          // three receptors drift in from the cell's edge, one at a time
          for (let j = 0; j < 3; j++) {
            const a = 1.2 + j * TAU / 3 + p.id;
            const k = p.st === 'engulf' ? 1 : j < p.bind ? 1 : j === p.bind ? p.bindK : 0;
            const d = rv * 1.05 + (b.unit * 0.82 - rv * 1.05) * (1 - k * k * (3 - 2 * k));
            const gx = lx(Math.cos(a) * d, Math.sin(a) * d), gy = ly(Math.cos(a) * d, Math.sin(a) * d), gr = Math.max(2, unitPx * 0.05);
            cf.globalAlpha = (0.35 + 0.65 * k) * fade * (1 - (p.sink || 0)); cf.fillStyle = goldCss;
            cf.beginPath(); cf.arc(gx, gy, gr * (j < p.bind ? 1.15 : 1), 0, TAU); cf.fill();
            if (j < p.bind) { cf.globalAlpha *= 0.5; cf.strokeStyle = goldCss; cf.lineWidth = 1; cf.beginPath(); cf.moveTo(gx, gy); cf.lineTo(x + (gx - x) * 0.55, y + (gy - y) * 0.55); cf.stroke(); }
          }
          cf.globalAlpha = 1;
        }
        const sink = p.sink || 0, grey = p.coat || 0;
        const col = grey > 0.5 ? '#a3a3a6' : hotCss;
        virusGlyph(x, y, rpx * (1 - 0.75 * sink), time * 0.4 + p.id, col, fade * (1 - sink * 0.6));
        if (grey > 0.01) {      // antibodies stuck on it
          for (let k = 0; k < 3; k++) {
            const a = -1.6 + k * 1.6 + p.id;
            antibody(cf, x + Math.cos(a) * rpx * 1.1, y + Math.sin(a) * rpx * 1.1, rpx * 0.55, grey * fade, ICE, a + Math.PI / 2);
          }
        }
        // three pips over its head, lit one by one
        if (p.st === 'land' || p.st === 'engulf') {
          const s = Math.max(4, Math.min(8, rpx * 0.3)), gap = s * 1.5, y0 = y - rpx - s * 1.6;
          for (let j = 0; j < 3; j++) {
            const px = x + (j - 1) * gap - s / 2, on = p.st === 'engulf' || j < p.bind;
            cf.globalAlpha = 0.85 * fade; cf.fillStyle = '#1b1b1c'; cf.fillRect(px - 1, y0 - 1, s + 2, s + 2);
            cf.globalAlpha = fade; cf.strokeStyle = on ? goldCss : 'rgba(236,200,110,0.55)'; cf.lineWidth = 1; cf.strokeRect(px + 0.5, y0 + 0.5, s - 1, s - 1);
            if (on) { cf.fillStyle = goldCss; cf.fillRect(px, y0, s, s); }
            else if (j === p.bind && p.st === 'land') { cf.fillStyle = goldCss; cf.globalAlpha = 0.7 * fade; const h = s * p.bindK; cf.fillRect(px, y0 + s - h, s, h); }
          }
          cf.globalAlpha = 1;
        }
      }

      // the macrophage: a mint cell that reaches out to what it eats
      const M = ui.mac;
      if (M) {
        M.out.vis = false;
        const n = norm(M.p);
        frameAt(m, v, M.p, n);
        const fade = smooth(-0.05, 0.2, F.face) * A, det = F.a * F.d - F.b * F.c;
        if (fade > 0.01 && Math.abs(det) > 1e-6) {
          const r0 = b.unit * 0.62 * (M.grab ? 1.08 : 1), cx = F.e, cy = F.f;
          let ta = 0, ext = 0;
          const reachTo = (q, k) => {
            project(m, v, q, pq);
            const dx = pq.x - cx, dy = pq.y - cy;
            const lxx = (F.d * dx - F.c * dy) / det, lyy = (-F.b * dx + F.a * dy) / det;
            ta = Math.atan2(dy, dx); ext = Math.max(0, Math.hypot(lxx, lyy) - r0 * 0.6) * k;
          };
          if (M.eat) reachTo(M.eat.p, 0.25 + 0.75 * M.eat.k);
          if (M.curl) { reachTo(M.curl.p, 1 - M.curl.t); ta += 1.1 * M.curl.t; }
          const N = 48;
          cf.beginPath();
          for (let k = 0; k <= N; k++) {
            const th = k / N * TAU, sx = Math.cos(th), sy = Math.sin(th);
            let ux = (F.d * sx - F.c * sy) / det, uy = (-F.b * sx + F.a * sy) / det;
            const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
            let dt = th - ta; dt -= TAU * Math.round(dt / TAU);
            const rr = r0 * (1 + 0.07 * Math.sin(3 * th + time * 1.7) + 0.05 * Math.sin(5 * th - time * 2.3 + 1)) + ext * Math.exp(-dt * dt / 0.05);
            const X = lx(ux * rr, uy * rr), Y = ly(ux * rr, uy * rr);
            if (k) cf.lineTo(X, Y); else cf.moveTo(X, Y);
          }
          cf.closePath();
          cf.globalAlpha = 0.55 * fade; cf.strokeStyle = DARK; cf.lineWidth = 5; cf.stroke();
          cf.globalAlpha = 0.92 * fade; cf.fillStyle = 'rgb(96,190,146)'; cf.fill();
          cf.globalAlpha = fade; cf.strokeStyle = '#d5ffe9'; cf.lineWidth = 1.6; cf.stroke();
          // its nucleus and a few granules
          onPlane(() => cf.ellipse(-r0 * 0.12, r0 * 0.1, r0 * 0.42, r0 * 0.34, 0.5, 0, TAU));
          cf.globalAlpha = 0.9 * fade; cf.fillStyle = 'rgb(52,124,96)'; cf.fill();
          for (let k = 0; k < 4; k++) {
            const a = k * 1.9 + 0.6, d = r0 * 0.55;
            cf.globalAlpha = 0.7 * fade; cf.fillStyle = '#e6fff2';
            cf.beginPath(); cf.arc(lx(Math.cos(a) * d, Math.sin(a) * d), ly(Math.cos(a) * d, Math.sin(a) * d), Math.max(1.2, unitPx * 0.025), 0, TAU); cf.fill();
          }
          cf.globalAlpha = 1;
          const rpx = r0 * Math.hypot(F.a, F.b);
          if (M.hover && !M.grab) ring(cf, cx, cy, rpx * 1.32, 0.8 * fade, 1.3, mintCss, [4, 4]);
          M.out.vis = fade > 0.3; M.out.x = cx; M.out.y = cy; M.out.r = rpx;
        }
      }

      // drifting particles, above everything on the surface
      for (const p of ui.vir) {
        if (p.st !== 'drift') continue;
        const vis = seenAt(v, p.p, surf) * A;
        if (vis <= 0.01) continue;
        project(m, v, p.p, qa);
        virusGlyph(qa.x, qa.y, b.unit * 0.36 * v.px * qa.s, time * 0.9 + p.id, hotCss, vis * smooth(0, 0.12, p.k));
      }

      // light points waiting to be swept up
      ui.dotOut.length = 0;
      for (const d of ui.dots) {
        const vis = seenAt(v, d.p, surf) * A;
        if (vis <= 0.05) continue;
        project(m, v, d.p, qa);
        const bob = Math.sin(time * 3 + d.id) * 2, x = qa.x, y = qa.y + bob, blink = d.left < 3 ? 0.45 + 0.55 * Math.abs(Math.sin(time * 6)) : 1;
        const r = Math.max(5, unitPx * 0.09) * qa.s;
        const g = cf.createRadialGradient(x, y, 0, x, y, r * 2.4);
        g.addColorStop(0, 'rgba(255,240,200,0.95)'); g.addColorStop(0.35, 'rgba(236,200,110,0.6)'); g.addColorStop(1, 'rgba(236,200,110,0)');
        cf.globalAlpha = vis * blink; cf.fillStyle = g;
        cf.beginPath(); cf.arc(x, y, r * 2.4, 0, TAU); cf.fill();
        cf.fillStyle = '#fff6dc'; cf.beginPath(); cf.arc(x, y, r * 0.42, 0, TAU); cf.fill();
        cf.globalAlpha = 1;
        ui.dotOut.push({ id: d.id, x, y, r: r * 1.6 });
        if (ui.dotLabel && ui.dotLabel.id === d.id) label(ui.dotLabel.text, x, y - r * 2.4 - 14, 13, goldCss, vis, true);
      }

      // the antibodies in each cloud hang just above the cells
      for (const c of ui.clouds) {
        const [e1, e2] = tangent(c.u), th = Math.acos(Math.max(-1, Math.min(1, c.cos)));
        const blink = c.k < 0.18 ? 0.55 + 0.45 * Math.sin(time * 18) : 1, grow = smooth(0, 0.35, c.age);
        for (let j = 0; j < 11; j++) {
          const h1 = Math.sin(c.id * 12.9898 + j * 78.233) * 43758.5453, h2 = Math.sin(c.id * 39.346 + j * 11.135) * 24634.6345;
          const fr = Math.sqrt(h1 - Math.floor(h1)) * 0.82, ph = (h2 - Math.floor(h2)) * TAU, sn = Math.sin(th * fr), cs = Math.cos(th * fr);
          const lift = surf + 0.07 + 0.025 * Math.sin(time * 1.3 + j) + (1 - grow) * 0.6;
          const d = [c.u[0] * cs + (e1[0] * Math.cos(ph) + e2[0] * Math.sin(ph)) * sn, c.u[1] * cs + (e1[1] * Math.cos(ph) + e2[1] * Math.sin(ph)) * sn, c.u[2] * cs + (e1[2] * Math.cos(ph) + e2[2] * Math.sin(ph)) * sn];
          pa[0] = d[0] * lift; pa[1] = d[1] * lift; pa[2] = d[2] * lift;
          const vis = seenAt(v, pa, surf) * A * blink * grow;
          if (vis <= 0.02) continue;
          project(m, v, pa, qa);
          antibody(cf, qa.x, qa.y, unitPx * 0.17 * qa.s, 0.9 * vis, ICE, time * 0.5 + j * 1.7);
        }
      }

      // the footprint a click would leave
      if (pv) {
        const vis = seenAt(v, scale(pv.u, surf), surf);
        project(m, v, scale(pv.u, surf * 1.08), qa);
        if (vis > 0.1) for (let j = 0; j < 3; j++) antibody(cf, qa.x + (j - 1) * unitPx * 0.28, qa.y - unitPx * 0.1 * (j === 1 ? 1 : 0), unitPx * 0.16, 0.55 * A * vis, ICE, (j - 1) * 0.4);
      }

      // effects
      for (const e of ui.fx) {
        const t = e.t;
        if (t < 0 || t >= 1) continue;
        if (e.type === 'fly') {        // a light point flying to the counter
          const k = 1 - Math.pow(1 - t, 2.2), mx = (e.x0 + e.x1) / 2, my = Math.min(e.y0, e.y1) - 80;
          const x = (1 - k) * (1 - k) * e.x0 + 2 * (1 - k) * k * mx + k * k * e.x1, y = (1 - k) * (1 - k) * e.y0 + 2 * (1 - k) * k * my + k * k * e.y1;
          cf.globalAlpha = 0.35; cf.fillStyle = goldCss; cf.beginPath(); cf.arc(x, y, 9, 0, TAU); cf.fill();
          cf.globalAlpha = 1; cf.fillStyle = '#fff6dc'; cf.beginPath(); cf.arc(x, y, 3.5, 0, TAU); cf.fill();
          continue;
        }
        if (e.type === 'combo') {
          const pop = t < 0.15 ? 0.6 + 0.4 * t / 0.15 : 1;
          label('×' + e.n, e.x, e.y - 34 * t - 18, Math.round((17 + 3 * Math.min(4, e.n)) * pop), goldCss, (1 - t * t) * A, false);
          continue;
        }
        if (e.type === 'pop') { ring(cf, e.x, e.y, 6 + 18 * t, (1 - t) * A, 2, mintCss); ring(cf, e.x, e.y, 3 + 9 * t, (1 - t) * 0.8 * A, 1.2, '#fff'); continue; }
        const i = e.cell, n = b.cells[i].n;
        frameAt(m, v, cellAt(i), n);
        const fade = smooth(-0.02, 0.2, F.face) * A;
        if (fade <= 0.01) continue;
        const u = b.unit;
        if (e.type === 'burst') {
          if (L.vis[i]) fillCell(m, i, Math.pow(1 - t, 2) * 0.9 * fade, [255, 236, 222]);
          onPlane(() => cf.arc(0, 0, u * (0.5 + 2.2 * t), 0, TAU)); cf.globalAlpha = (1 - t) * fade; cf.strokeStyle = hotCss; cf.lineWidth = 3; cf.stroke();
          onPlane(() => cf.arc(0, 0, u * (0.3 + 1.3 * t), 0, TAU)); cf.globalAlpha = (1 - t) * 0.8 * fade; cf.strokeStyle = '#fff'; cf.lineWidth = 1.4; cf.stroke();
        } else if (e.type === 'engulf') {
          onPlane(() => cf.arc(0, 0, u * (0.08 + 0.55 * (1 - t)), 0, TAU)); cf.globalAlpha = (1 - t) * 0.85 * fade; cf.strokeStyle = '#2b1013'; cf.lineWidth = 5; cf.stroke();
          cf.strokeStyle = hotCss; cf.lineWidth = 1.5; cf.stroke();
        } else if (e.type === 'infect') {
          onPlane(() => cf.arc(0, 0, u * (0.4 + 0.8 * t), 0, TAU)); cf.globalAlpha = (1 - t) * fade; cf.strokeStyle = hotCss; cf.lineWidth = 2.2; cf.stroke();
        } else if (e.type === 'land') {
          onPlane(() => cf.arc(0, 0, u * (0.2 + 0.4 * t), 0, TAU)); cf.globalAlpha = (1 - t) * 0.6 * fade; cf.strokeStyle = '#fff'; cf.lineWidth = 1.2; cf.stroke();
        } else if (e.type === 'bind') {
          onPlane(() => cf.arc(0, 0, u * (0.3 + 0.35 * t), 0, TAU)); cf.globalAlpha = (1 - t) * 0.7 * fade; cf.strokeStyle = goldCss; cf.lineWidth = 1.4; cf.stroke();
        } else if (e.type === 'coat') {
          onPlane(() => cf.arc(0, 0, u * (0.3 + 0.5 * t), 0, TAU)); cf.globalAlpha = (1 - t) * 0.7 * fade; cf.strokeStyle = ICE; cf.lineWidth = 1.4; cf.stroke();
          if (e.released) for (let j = 0; j < 3; j++) {      // the receptors let go
            const a = 1.2 + j * TAU / 3 + e.seed, d = u * (0.4 + 0.6 * t);
            cf.globalAlpha = (1 - t) * fade; cf.fillStyle = goldCss;
            cf.beginPath(); cf.arc(lx(Math.cos(a) * d, Math.sin(a) * d), ly(Math.cos(a) * d, Math.sin(a) * d), Math.max(2, unitPx * 0.045), 0, TAU); cf.fill();
          }
        } else if (e.type === 'regrow') {      // a cell grown back: a lilac flash that settles into it
          if (L.vis[i]) fillCell(m, i, Math.pow(1 - t, 2) * 0.45 * fade, [214, 200, 246]);
          onPlane(() => cf.arc(0, 0, u * (1.3 - 0.8 * t), 0, TAU)); cf.globalAlpha = (1 - t) * fade; cf.strokeStyle = LILAC; cf.lineWidth = 2.4; cf.stroke();
          onPlane(() => cf.arc(0, 0, u * (0.9 - 0.6 * t), 0, TAU)); cf.globalAlpha = (1 - t) * 0.7 * fade; cf.strokeStyle = '#fff'; cf.lineWidth = 1.2; cf.stroke();
        } else if (e.type === 'reach') {
          onPlane(() => cf.arc(0, 0, u * (1.9 - 0.5 * t), 0, TAU)); cf.globalAlpha = (1 - t) * 0.8 * fade; cf.strokeStyle = mintCss; cf.lineWidth = 1.6; cf.stroke();
        }
        cf.globalAlpha = 1;
      }

      // trouble on the far side: arrows round the edge, pointing the way to turn
      ui.arrowOut.length = 0;
      const bins = [];
      for (const th of ui.threats) {
        const z = Rm[2][0] * th.p[0] + Rm[2][1] * th.p[1] + Rm[2][2] * th.p[2], pl = len(th.p) || 1;
        if (z / pl > 0.12) continue;
        let x = Rm[0][0] * th.p[0] + Rm[0][1] * th.p[1] + Rm[0][2] * th.p[2], y = -(Rm[1][0] * th.p[0] + Rm[1][1] * th.p[1] + Rm[1][2] * th.p[2]);
        let dl = Math.hypot(x, y);
        if (dl < 0.05) { x = 0; y = 1; dl = 1; }
        const ang = Math.atan2(y, x), key = (th.hot ? 0 : 100) + ((Math.round(ang / (TAU / 14)) % 14) + 14) % 14;
        let bin = bins.find((q) => q.key === key);
        if (!bin) { bin = { key, x: 0, y: 0, w: 0, k: 0, hot: th.hot, cell: th.cell, n: 0 }; bins.push(bin); }
        bin.x += x / dl; bin.y += y / dl; bin.w++; bin.n++;
        if (th.k > bin.k) { bin.k = th.k; bin.cell = th.cell; }
      }
      const B = ui.bounds;
      for (const q of bins) {
        const dl = Math.hypot(q.x, q.y) || 1, ux = q.x / dl, uy = q.y / dl;
        let r = rbPx + 40;
        // stay on the stage
        if (ux > 0.01) r = Math.min(r, (B.x1 - 18 - v.cx) / ux); else if (ux < -0.01) r = Math.min(r, (B.x0 + 18 - v.cx) / ux);
        if (uy > 0.01) r = Math.min(r, (B.y1 - 18 - v.cy) / uy); else if (uy < -0.01) r = Math.min(r, (B.y0 + 18 - v.cy) / uy);
        const x = v.cx + ux * r, y = v.cy + uy * r, pulse = q.hot ? 0.6 + 0.4 * Math.sin(time * (5 + 6 * q.k)) : 0.75;
        const col = q.hot ? hotCss : mintCss, s = 9 + 4 * Math.min(1, q.k) + Math.min(4, q.n - 1);
        chevron(x, y, ux, uy, s + 3, 0.5 * A, DARK);
        chevron(x, y, ux, uy, s, pulse * A, col);
        if (q.n > 1) label(String(q.n), x - ux * (s + 9), y - uy * (s + 9), 11, col, 0.9 * A, false);
        ui.arrowOut.push({ x, y, cell: q.cell });
      }

      // the one line of help, with a ghost drag from the macrophage to the particle
      const H = ui.hint;
      if (H) {
        project(m, v, H.from, qa); const fx = qa.x, fy = qa.y, fs = seenAt(v, H.from, surf);
        project(m, v, H.to, qb); const tx = qb.x, ty = qb.y, ts = seenAt(v, H.to, surf);
        if (fs > 0.3 && ts > 0.3) {
          const dx = tx - fx, dy = ty - fy, dl = Math.hypot(dx, dy) || 1, nx = -dy / dl, ny = dx / dl, bend = Math.min(60, dl * 0.25);
          const mx = (fx + tx) / 2 + nx * bend, my = (fy + ty) / 2 + ny * bend;
          cf.globalAlpha = 0.9 * A; cf.strokeStyle = mintCss; cf.lineWidth = 2; cf.setLineDash([6, 6]); cf.lineDashOffset = -time * 30;
          cf.beginPath(); cf.moveTo(fx, fy); cf.quadraticCurveTo(mx, my, tx, ty); cf.stroke(); cf.setLineDash([]); cf.lineDashOffset = 0;
          const g = (time * 0.65) % 1, k = g * g * (3 - 2 * g), gx = (1 - k) * (1 - k) * fx + 2 * (1 - k) * k * mx + k * k * tx, gy = (1 - k) * (1 - k) * fy + 2 * (1 - k) * k * my + k * k * ty;
          ring(cf, gx, gy, 9, Math.sin(Math.PI * g) * A, 2, '#fff');
          const ex = tx - mx, ey = ty - my, el = Math.hypot(ex, ey) || 1;
          chevron(tx - ex / el * 4, ty - ey / el * 4, ex / el, ey / el, 8, 0.95 * A, mintCss);
          label(H.text, (fx + tx) / 2 + nx * (bend + 22), (fy + ty) / 2 + ny * (bend + 22), 15, '#f2f2f4', A, true);
        }
      }
      cf.textAlign = 'center'; cf.textBaseline = 'middle';
    }

    // measuring lines behind the virus: a loose circle, or an axis with end ticks
    function backdrop(m, v, alpha) {
      if (alpha <= 0.01) return;
      const b = m.board;
      if (b.mode === 'free') {
        const r = (b.fit.hw + m.pad) * v.px * 1.07;
        sketchCircle(cb, v.cx, v.cy, r, m.n, alpha * 0.34, 1);
        for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.5, c = Math.cos(a), s = Math.sin(a); sketch(cb, v.cx + c * (r - 5), v.cy + s * (r - 5), v.cx + c * (r + 9), v.cy + s * (r + 9), k + 3, alpha * 0.55, 1, '#fff'); }
        return;
      }
      const a = { x: 0, y: 0, z: 0, s: 1 }, e = { x: 0, y: 0, z: 0, s: 1 }, h = (b.fit.hh + m.pad) * 1.08;
      project(m, v, [0, h, 0], a); project(m, v, [0, -h, 0], e);
      sketch(cb, a.x, a.y, e.x, e.y, m.n, alpha * 0.36, 1, '#fff');
      const dx = e.x - a.x, dy = e.y - a.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len * 8, ny = dx / len * 8;
      sketch(cb, a.x - nx, a.y - ny, a.x + nx, a.y + ny, 5, alpha * 0.55, 1, '#fff');
      sketch(cb, e.x - nx, e.y - ny, e.x + nx, e.y + ny, 6, alpha * 0.55, 1, '#fff');
    }

    return {
      begin, finish, resize, model, free, draw, cage, layout, pick, overlay, duel, backdrop, project, ball, ring, sketch, antibody,
      front: cf, back: cb,
      get width() { return W; }, get height() { return H; }, get dpr() { return dpr; },
      colors: { MINT, PINK, STEEL, DUSK, HOT, GOLD, NUM, CHAIN }, MONO,
    };
  }

  Renderer.REAL = REAL;          // for checks in Node and the console
  Renderer.lattice = lattice;
  root.CapsidRenderer = Renderer;
})(typeof self !== 'undefined' ? self : this);
