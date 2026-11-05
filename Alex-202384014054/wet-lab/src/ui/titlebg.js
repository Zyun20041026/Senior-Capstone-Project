// Alex 202384014054
// Title backdrop: a still, dingy bench drawn small and blown up, with a
// culture dish in front under a wall lamp. Only the grain, a slow drift and
// the lamp's flicker move.

import { rng } from '../sim/rng.js';

const W = 480, H = 270, ZOOM = 1.05;

function dish(g, r) {
  const cx = 318, cy = 214, rx = 86, ry = 28;
  // shadow
  for (let i = 6; i > 0; i--) { g.fillStyle = `rgba(0,0,0,${0.06})`; g.beginPath(); g.ellipse(cx + 8, cy + 10, rx + i * 3, ry + i * 1.2, 0, 0, 7); g.fill(); }
  // wall and base
  g.fillStyle = '#3c4140'; g.beginPath(); g.ellipse(cx, cy + 7, rx, ry, 0, 0, Math.PI); g.lineTo(cx - rx, cy); g.ellipse(cx, cy, rx, ry, 0, Math.PI, 0, true); g.fill();
  // medium
  g.fillStyle = '#86504c'; g.beginPath(); g.ellipse(cx, cy + 2, rx - 4, ry - 2, 0, 0, 7); g.fill();
  const shade = g.createLinearGradient(0, cy - ry, 0, cy + ry);
  shade.addColorStop(0, 'rgba(255,230,220,.12)'); shade.addColorStop(1, 'rgba(0,0,0,.3)');
  g.fillStyle = shade; g.fill();
  // cell lawn
  for (let n = 0; n < 5200; n++) {
    const a = r() * 6.283, d = Math.sqrt(r()) * 0.97;
    const x = cx + Math.cos(a) * d * (rx - 5), y = cy + 2 + Math.sin(a) * d * (ry - 3);
    const v = 140 + r() * 45 | 0;
    g.fillStyle = `rgba(${v},${v - 10},${v - 50},${0.25 + r() * 0.3})`;
    g.fillRect(x, y, 1 + (r() < 0.3), 1);
  }
  // lid: rim and the viewer's reflection
  g.strokeStyle = 'rgba(200,215,210,.35)'; g.lineWidth = 1;
  g.beginPath(); g.ellipse(cx, cy - 2, rx + 2, ry + 1, 0, 0, 7); g.stroke();
  g.strokeStyle = 'rgba(225,240,235,.55)'; g.lineWidth = 1.5;
  g.beginPath(); g.ellipse(cx, cy - 2, rx - 2, ry - 1, 0, Math.PI * 1.18, Math.PI * 1.62); g.stroke();
  g.fillStyle = 'rgba(220,235,230,.12)'; g.beginPath(); g.ellipse(cx + 22, cy - 9, 24, 5, -0.08, 0, 7); g.fill();
  // masking tape, scrawled on
  g.save(); g.translate(cx - 34, cy + 27); g.rotate(-0.05);
  g.fillStyle = '#b7ad8c'; g.fillRect(0, 0, 32, 7);
  g.fillStyle = '#2b2a28'; g.font = '6px "SF Mono",ui-monospace,Menlo,monospace'; g.fillText('A549 P12', 3, 6);
  g.restore();
}

function paint(c) {
  const g = c.getContext('2d'), r = rng(20261102);
  // wall
  const wall = g.createLinearGradient(0, 0, 0, 160);
  wall.addColorStop(0, '#111513'); wall.addColorStop(1, '#232a26');
  g.fillStyle = wall; g.fillRect(0, 0, W, 160);
  g.strokeStyle = 'rgba(255,255,255,.035)'; g.lineWidth = 1;
  for (let y = 70; y < 160; y += 18) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); g.stroke(); }
  for (let y = 70, row = 0; y < 160; y += 18, row++) for (let x = (row % 2) * 12; x < W; x += 24) { g.beginPath(); g.moveTo(x + 0.5, y); g.lineTo(x + 0.5, y + 18); g.stroke(); }
  for (let i = 0; i < 14; i++) { // stains
    const x = r() * W, y = r() * 160, s = 10 + r() * 50, gr = g.createRadialGradient(x, y, 0, x, y, s);
    gr.addColorStop(0, `rgba(${40 + r() * 30 | 0},${36 + r() * 20 | 0},20,.25)`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - s, y - s, s * 2, s * 2);
  }
  // bench
  const bench = g.createLinearGradient(0, 158, 0, H);
  bench.addColorStop(0, '#2c312e'); bench.addColorStop(1, '#0f1211');
  g.fillStyle = bench; g.fillRect(0, 158, W, H - 158);
  g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, 158, W, 2);
  for (let i = 0; i < 60; i++) { // scratches
    const x = r() * W, y = 160 + r() * 110, l = 4 + r() * 22, a = (r() - 0.5) * 0.5;
    g.strokeStyle = `rgba(255,255,255,${0.02 + r() * 0.05})`; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  // wall lamp
  g.fillStyle = '#2b2f2d'; g.fillRect(312, 34, 62, 10);
  g.fillStyle = '#c9dad3'; g.fillRect(316, 44, 54, 4);
  // light spill on wall and bench
  g.globalCompositeOperation = 'screen';
  const spill = g.createRadialGradient(343, 90, 20, 343, 120, 280);
  spill.addColorStop(0, 'rgba(150,190,180,.22)'); spill.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = spill; g.fillRect(0, 0, W, H);
  const glare = g.createRadialGradient(343, 182, 4, 343, 182, 70);
  glare.addColorStop(0, 'rgba(170,200,190,.16)'); glare.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glare; g.fillRect(250, 160, 190, 50);
  g.globalCompositeOperation = 'source-over';
  // a marker pen left lying about
  g.save(); g.translate(196, 236); g.rotate(-0.32);
  g.fillStyle = '#1b1d1c'; g.fillRect(0, 0, 44, 5); g.fillStyle = '#7a2e26'; g.fillRect(44, 0, 10, 5);
  g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, 1, 54, 1);
  g.restore();
  dish(g, r);
  // grade: washed out, green-grey, crushed
  g.globalCompositeOperation = 'saturation'; g.fillStyle = 'hsla(0,0%,50%,.45)'; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'soft-light'; g.fillStyle = 'rgba(90,125,105,.55)'; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';
  const vig = g.createRadialGradient(W * 0.62, H * 0.5, 60, W * 0.62, H * 0.5, 330);
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,.85)');
  g.fillStyle = vig; g.fillRect(0, 0, W, H);
  const left = g.createLinearGradient(0, 0, W * 0.5, 0);
  left.addColorStop(0, 'rgba(0,0,0,.6)'); left.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = left; g.fillRect(0, 0, W, H);
}

function noiseTiles(n) {
  return Array.from({ length: n }, () => {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), d = g.createImageData(W, H);
    for (let k = 0; k < d.data.length; k += 4) { const v = Math.random() * 255; d.data[k] = d.data[k + 1] = d.data[k + 2] = v; d.data[k + 3] = 255; }
    g.putImageData(d, 0, 0);
    return c;
  });
}

// Draws into `canvas` until it leaves the document.
export function titleBackdrop(canvas) {
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  const plate = document.createElement('canvas'); plate.width = W; plate.height = H;
  paint(plate);
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const noise = noiseTiles(still ? 1 : 4);
  let last = 0, dip = 0, until = 0;
  const frame = (now) => {
    if (!canvas.isConnected) return;
    if (!still) requestAnimationFrame(frame);
    if (now - last < 1000 / 24) return;
    last = now;
    const t = now / 1000;
    const ox = (Math.sin(t * 0.031) + 1) / 2 * W * (ZOOM - 1), oy = (Math.sin(t * 0.023 + 1) + 1) / 2 * H * (ZOOM - 1);
    g.drawImage(plate, -ox, -oy, W * ZOOM, H * ZOOM);
    // the viewer's tube: steady, then now and again a stutter
    if (now > until && Math.random() < 0.004) until = now + 200 + Math.random() * 500;
    dip = now < until ? (Math.random() < 0.5 ? 0.3 : 0.08) : 0;
    if (dip) { g.fillStyle = `rgba(0,0,0,${dip})`; g.fillRect(0, 0, W, H); }
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.32;
    g.drawImage(noise[(t * 12 | 0) % noise.length], 0, 0);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  };
  requestAnimationFrame(frame);
}
