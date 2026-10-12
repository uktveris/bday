// Theatre curtains drawn on a 2D canvas that covers the whole page.
//
// Each half is a sheet of pleated velvet. Its pleats are shaded once into a
// 1-pixel-tall strip (from the fold shape: lit slopes, dark valleys, a sheen
// on the edges); every frame that strip is stretched across the cloth in
// horizontal bands. Opening squeezes the bands toward the sides, with the
// bottom of the cloth trailing the top, then slides the gathered stack off
// screen. A swagged valance, a fringed hem and a strip of stage floor finish
// the picture.

const DURATION = 2.4; // seconds to open or close
const STRIP = 1024; // resolution of the pleat shading
const PLEATS = 10; // folds per half
const BANDS = 46; // horizontal slices per half while hanging still
const BAND_PX = 2; // slice height while moving, so the swinging edge is smooth
const LAG = 0.1; // how far the hem trails the rail (fraction of the motion)

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// Velvet colour ramp, from deep shadow to highlight.
const RAMP = [
  [0, [74, 8, 42]],
  [0.3, [146, 24, 84]],
  [0.58, [226, 62, 138]],
  [0.82, [255, 132, 192]],
  [1, [255, 200, 226]],
];
function velvet(v, tone) {
  v = clamp01(v);
  let i = 1;
  while (i < RAMP.length - 1 && RAMP[i][0] < v) i++;
  const [a, ca] = RAMP[i - 1];
  const [b, cb] = RAMP[i];
  const t = (v - a) / (b - a);
  return [0, 1, 2].map((k) => (ca[k] + (cb[k] - ca[k]) * t) * tone);
}

// One row of pleat shading across a sheet of cloth, plus the fold heights
// (used to make the hem wave with the folds).
function pleatStrip(seed, tone = 1) {
  const c = document.createElement('canvas');
  c.width = STRIP;
  c.height = 1;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(STRIP, 1);
  const heights = new Float32Array(STRIP);
  for (let i = 0; i < STRIP; i++) {
    const s = i / (STRIP - 1);
    // Irregular spacing, so no two pleats are quite the same width.
    const phase = PLEATS * s + 0.32 * Math.sin(Math.PI * 2 * 1.3 * s + seed * 1.7) + 0.18 * Math.sin(Math.PI * 2 * 3.3 * s + seed * 3.1);
    heights[i] = 0.5 + 0.5 * Math.cos(Math.PI * 2 * phase);
  }
  for (let i = 0; i < STRIP; i++) {
    const h = heights[i];
    const slope = ((heights[Math.min(STRIP - 1, i + 1)] - heights[Math.max(0, i - 1)]) * (STRIP - 1)) / 2 / (Math.PI * PLEATS);
    // Light from the left: slopes facing it are bright; velvet also catches
    // light on any steep edge; valleys sit in shadow.
    const v = (0.25 + 0.45 * h + 0.24 * slope + 0.1 * Math.abs(slope)) * (0.8 + 0.2 * h);
    const [r, g, b] = velvet(v, tone);
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return { canvas: c, heights };
}

const GOLD = '#e9c063';
const GOLD_DARK = '#a8762a';
const GOLD_LIGHT = '#fbe7a6';

// The valance never changes shape, so it's drawn once per resize.
function drawValance(ctx, W, valH, strip) {
  const band = valH * 0.12; // just a sliver, so the swags hang right under the rail

  // Pleated pelmet across the top.
  ctx.drawImage(strip.canvas, 0, 0, STRIP, 1, 0, 0, W / 2 + 1, band);
  ctx.drawImage(strip.canvas, 0, 0, STRIP, 1, W / 2, 0, W / 2, band);
  let g = ctx.createLinearGradient(0, 0, 0, band);
  g.addColorStop(0, 'rgba(20,0,10,0.1)');
  g.addColorStop(1, 'rgba(20,0,10,0.45)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, band);

  // Swags: scallops of cloth with fold lines sagging between their corners.
  const n = Math.max(2, Math.round(W / Math.min(260, Math.max(120, W * 0.22))));
  const sw = W / n;
  const depth = valH - band - 12;
  const top = band - 2;
  for (let i = 0; i < n; i++) {
    const x0 = i * sw;
    const edge = () => {
      ctx.beginPath();
      ctx.moveTo(x0, top);
      ctx.lineTo(x0 + sw, top);
      ctx.quadraticCurveTo(x0 + sw / 2, top + depth * 2, x0, top);
    };
    ctx.save();
    edge();
    g = ctx.createLinearGradient(0, top, 0, top + depth);
    g.addColorStop(0, '#86164b');
    g.addColorStop(0.5, '#e2428b');
    g.addColorStop(1, '#a8245f');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.clip();
    for (let k = 1; k <= 6; k++) {
      const f = k / 7;
      for (const [df, style, width] of [[0, 'rgba(50,0,25,0.4)', 3.2], [0.05, 'rgba(255,175,215,0.32)', 2]]) {
        ctx.strokeStyle = style;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x0 - 2, top);
        ctx.quadraticCurveTo(x0 + sw / 2, top + depth * 2 * (f + df), x0 + sw + 2, top);
        ctx.stroke();
      }
    }
    ctx.restore();

    // Gold trim and fringe along the scallop.
    for (let t = 0.02; t < 1; t += 2.2 / sw) {
      const x = x0 + sw * (1 - t);
      const y = top + depth * 4 * t * (1 - t);
      ctx.strokeStyle = Math.round(t * sw) % 2 ? GOLD : GOLD_DARK;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 8);
      ctx.stroke();
    }
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(x0 + sw, top);
    ctx.quadraticCurveTo(x0 + sw / 2, top + depth * 2, x0, top);
    ctx.stroke();
  }

  // Tails hanging where the swags meet, each ending in a tassel.
  const tw = sw * 0.2;
  const tl = valH - band - 6;
  for (let i = 0; i <= n; i++) {
    const x = i * sw;
    g = ctx.createLinearGradient(x - tw / 2, 0, x + tw / 2, 0);
    g.addColorStop(0, '#6f0f3c');
    g.addColorStop(0.35, '#f0559c');
    g.addColorStop(0.6, '#c93478');
    g.addColorStop(1, '#6f0f3c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - tw / 2, top);
    ctx.lineTo(x + tw / 2, top);
    ctx.lineTo(x + tw / 2, top + tl * 0.6);
    ctx.lineTo(x + tw / 4, top + tl * 0.78);
    ctx.lineTo(x, top + tl);
    ctx.lineTo(x - tw / 4, top + tl * 0.78);
    ctx.lineTo(x - tw / 2, top + tl * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(50,0,25,0.45)';
    ctx.lineWidth = 1.6;
    for (const dx of [-tw / 4, 0, tw / 4]) {
      ctx.beginPath();
      ctx.moveTo(x + dx, top);
      ctx.lineTo(x + dx, top + tl * (dx === 0 ? 0.97 : 0.76));
      ctx.stroke();
    }
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.arc(x, top + tl + 5, 5, 0, Math.PI * 2);
    ctx.fill();
    for (let k = -3; k <= 3; k++) {
      ctx.strokeStyle = k % 2 ? GOLD : GOLD_DARK;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + k * 0.9, top + tl + 8);
      ctx.lineTo(x + k * 1.9, top + tl + 24);
      ctx.stroke();
    }
  }

  // Gold rail along the very top.
  const railH = Math.max(7, valH * 0.07);
  g = ctx.createLinearGradient(0, 0, 0, railH);
  g.addColorStop(0, GOLD_LIGHT);
  g.addColorStop(0.45, GOLD);
  g.addColorStop(1, GOLD_DARK);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, railH);
}

export function createStage(canvas, { reducedMotion = false } = {}) {
  const ctx = canvas.getContext('2d');
  const duration = reducedMotion ? 0.05 : DURATION;
  const strips = [pleatStrip(1), pleatStrip(2.6)];
  const dark = pleatStrip(4.1, 0.72);
  let valance = null;

  let W = 0;
  let H = 0;
  let valH = 0;
  let p = 0; // 0 closed .. 1 open
  let target = 0;
  let opening = true;
  let running = false;
  let last = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    valH = Math.min(132, Math.max(62, H * 0.13));
    valance = document.createElement('canvas');
    valance.width = Math.round(W * dpr);
    valance.height = Math.round((valH + 34) * dpr);
    const vctx = valance.getContext('2d');
    vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawValance(vctx, W, valH, dark);
  }

  // How open the cloth is at a given height (0 top .. 1 hem). The cloth hangs
  // almost straight down from the rail; the hem just swings a little behind
  // it (more toward the bottom), both when opening and when closing.
  function openAt(yn) {
    const trail = LAG * yn * yn;
    if (opening) return ease(clamp01(p * (1 + LAG) - trail));
    return 1 - ease(clamp01((1 - p) * (1 + LAG) - trail));
  }

  function draw(time) {
    ctx.clearRect(0, 0, W, H);
    const e = ease(p);
    const floorH = Math.max(18, H * 0.035);
    const hemY = H - floorH * 0.5;

    // Stage floor the curtains rest on; it sinks away as they open.
    const floorY = H - floorH + e * floorH * 1.8;
    let g = ctx.createLinearGradient(0, floorY, 0, floorY + floorH);
    g.addColorStop(0, '#2a0d18');
    g.addColorStop(0.3, '#150509');
    g.addColorStop(1, '#050102');
    ctx.fillStyle = g;
    ctx.fillRect(0, floorY, W, floorH + 2);

    // The two halves, in bands from the rail down to the hem.
    const bands = p > 0 && p < 1 ? Math.ceil(hemY / BAND_PX) : BANDS;
    const bh = hemY / bands;
    const hem = [];
    for (let side = 0; side < 2; side++) {
      const strip = strips[side];
      let x0 = 0;
      let w = 0;
      for (let j = 0; j < bands; j++) {
        const yn = (j + 0.5) / bands;
        const o = openAt(yn);
        const sway = reducedMotion ? 0 : Math.sin(time * 0.7 + yn * 2.4 + side * 1.3) * 3 * yn * (1 - o);
        w = (W / 2) * 1.03 * (1 - 0.9 * o) + sway;
        const slide = smooth(0.5, 1, o) * (w + 30);
        x0 = side === 0 ? -slide : W + slide - w;
        ctx.drawImage(strip.canvas, 0, 0, STRIP, 1, x0, j * bh, w, bh + 0.7);
      }
      hem.push({ x0, w, heights: strip.heights });
    }

    // The right half overlaps the left in the middle and shades it a little.
    ctx.globalCompositeOperation = 'source-atop';
    if (e < 1) {
      const edge = hem[1].x0;
      const shade = ctx.createLinearGradient(edge - 28, 0, edge, 0);
      shade.addColorStop(0, 'rgba(15,0,8,0)');
      shade.addColorStop(1, `rgba(15,0,8,${0.5 * (1 - e)})`);
      ctx.fillStyle = shade;
      ctx.fillRect(edge - 28, 0, 28, hemY);
    }

    // Lighting over the cloth only: shade under the valance and near the
    // floor, darker toward the edges, a soft spot in the middle.
    g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(20,0,10,0.5)');
    g.addColorStop(0.3, 'rgba(20,0,10,0)');
    g.addColorStop(0.75, 'rgba(20,0,10,0)');
    g.addColorStop(1, 'rgba(20,0,10,0.38)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const reach = Math.hypot(W, H) * 0.62;
    g = ctx.createRadialGradient(W / 2, H * 0.48, 0, W / 2, H * 0.48, reach);
    g.addColorStop(0, 'rgba(255,225,240,0.13)');
    g.addColorStop(0.45, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(10,0,5,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // Shadow the valance throws on the curtains.
    const lift = e * (valH + 40) * 1.2;
    g = ctx.createLinearGradient(0, valH * 0.5 - lift, 0, valH * 1.45 - lift);
    g.addColorStop(0, 'rgba(15,0,8,0.6)');
    g.addColorStop(1, 'rgba(15,0,8,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, valH * 1.45);
    ctx.globalCompositeOperation = 'source-over';

    // Gold trim and fringe along the hem, rising and falling with the folds.
    for (const [side, { x0, w, heights }] of hem.entries()) {
      if (w < 2) continue;
      const from = Math.max(0, x0);
      // The left half's hem stops where the right half overlaps it.
      const to = Math.min(W, x0 + w, side === 0 ? hem[1].x0 : Infinity);
      const yAt = (x) => hemY - 4 + heights[Math.min(STRIP - 1, Math.max(0, Math.round(((x - x0) / w) * (STRIP - 1))))] * 5;
      // Strands sit on pixel centres so they stay crisp on both halves.
      for (const [offset, style] of [[0.5, GOLD], [2.5, GOLD_DARK]]) {
        ctx.strokeStyle = style;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let x = Math.floor(from) + offset; x < to; x += 4) {
          const y = yAt(x);
          ctx.moveTo(x, y - 2);
          ctx.lineTo(x, y + 9);
        }
        ctx.stroke();
      }
      ctx.strokeStyle = GOLD_LIGHT;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x = from; x <= to; x += 3) ctx.lineTo(x, yAt(x) - 3);
      ctx.stroke();
    }

    // Valance on top; it lifts away as the curtains open.
    ctx.drawImage(valance, 0, -lift, W, valH + 34);
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const step = dt / duration;
    p = target > p ? Math.min(target, p + step) : Math.max(target, p - step);
    if (p >= 1 && target === 1) {
      // Fully open: nothing left to draw, so stop and get out of the way.
      running = false;
      ctx.clearRect(0, 0, W, H);
      canvas.style.visibility = 'hidden';
      return;
    }
    draw(now / 1000);
    // With reduced motion there's no sway, so a still curtain needn't redraw.
    if (reducedMotion && p === target) {
      running = false;
      return;
    }
    requestAnimationFrame(frame);
  }

  function start() {
    canvas.style.visibility = '';
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }

  resize();
  draw(0);
  start(); // keeps running while closed, for the gentle sway
  window.addEventListener('resize', () => {
    resize();
    if (running) draw(performance.now() / 1000);
  });

  return {
    durationMs: duration * 1000,
    open() {
      opening = true;
      target = 1;
      start();
    },
    close() {
      opening = false;
      target = 0;
      start();
    },
  };
}
