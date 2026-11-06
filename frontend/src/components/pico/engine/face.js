import * as THREE from 'three';

const lerp = (a, b, t) => a + (b - a) * t;

const CODE_LINES = [
  'sys.link ........ ok',
  'mem  62%  cpu 14%',
  'mic  idle  cam  off',
  'motion.ctl  ready',
  'servo[0..11] sync',
  'ear.ring pulse 0.8',
  'net  ::1  up',
  '0x3F2A 9C1D 77B0',
  'task queue  0',
  'voice.synth  armed',
];

function pill(c, cx, cy, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  const x = cx - w / 2;
  const y = cy - h / 2;
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function heart(c, cx, cy, s) {
  c.beginPath();
  c.moveTo(cx, cy + s * 0.95);
  c.bezierCurveTo(cx - s * 1.55, cy - s * 0.1, cx - s * 0.95, cy - s * 1.25, cx, cy - s * 0.5);
  c.bezierCurveTo(cx + s * 0.95, cy - s * 1.25, cx + s * 1.55, cy - s * 0.1, cx, cy + s * 0.95);
  c.closePath();
}
function star(c, cx, cy, s) {
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    const r = i % 2 ? s * 0.3 : s;
    c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  c.closePath();
}

/**
 * The glossy visor screen. A 2D canvas is drawn each time the face state changes
 * and used as an emissive texture so the eyes glow (and bloom).
 */
export function createFace() {
  const FW = 896;
  const FH = 612;
  const canvas = document.createElement('canvas');
  canvas.width = FW;
  canvas.height = FH;
  const c = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.encoding = THREE.sRGBEncoding;
  texture.anisotropy = 4;

  let lastKey = '';

  function draw(S, t, textSeed) {
    const s = FW / 1024;
    const cxm = FW / 2;
    const hex = S.glowHex;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const A_ = (a) => `rgba(${r},${g},${b},${a})`;
    const lite = `rgb(${Math.round(lerp(r, 255, 0.6))},${Math.round(lerp(g, 255, 0.6))},${Math.round(lerp(b, 255, 0.6))})`;

    c.clearRect(0, 0, FW, FH);
    const bgG = c.createRadialGradient(cxm, FH * 0.46, 30, cxm, FH * 0.5, FW * 0.62);
    bgG.addColorStop(0, '#071a24');
    bgG.addColorStop(1, '#010508');
    c.fillStyle = bgG;
    c.fillRect(0, 0, FW, FH);
    c.fillStyle = A_(0.035);
    for (let y = 0; y < FH; y += 6) c.fillRect(0, y, FW, 1.5);

    // status text
    c.font = `${Math.round(13 * s * 1.15)}px ui-monospace, Menlo, Consolas, monospace`;
    c.textBaseline = 'top';
    c.textAlign = 'left';
    for (let i = 0; i < 6; i++) {
      c.fillStyle = A_(i === 0 ? 0.55 : 0.28);
      c.fillText(CODE_LINES[(i + textSeed) % CODE_LINES.length], 150 * s, (92 + i * 19) * s);
    }
    c.textAlign = 'right';
    c.fillStyle = A_(0.55);
    c.fillText('PICO  ONLINE', FW - 150 * s, 92 * s);
    for (let i = 0; i < 4; i++) {
      c.fillStyle = A_(0.22 + 0.08 * ((i + textSeed) % 3));
      c.fillRect(FW - 150 * s - 90 * s, (118 + i * 12) * s, (90 - i * 14) * s, 5 * s);
    }
    c.textAlign = 'left';
    c.fillStyle = A_(0.3);
    c.fillText(S.sleeping ? 'standby' : 'ready', 150 * s, FH - 112 * s);

    // eyes
    const e = S.expr;
    const open = 1 - S.blink;
    const ex = 205 * s;
    const ey = FH * 0.46 + S.gy;
    const ew = 98 * s;
    const eh = 152 * s;
    const gr = (cy, h) => {
      const q = c.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
      q.addColorStop(0, lite);
      q.addColorStop(0.35, A_(1));
      q.addColorStop(1, A_(0.92));
      return q;
    };
    const eyes = [cxm - ex + S.gx, cxm + ex + S.gx];
    c.lineCap = 'round';
    c.lineJoin = 'round';
    const stroke = (w) => {
      c.strokeStyle = A_(1);
      c.lineWidth = w;
    };

    if (e === 'happy' || e === 'wink') {
      eyes.forEach((x, i) => {
        if (e === 'wink' && i === 1) {
          const h = eh * open;
          pill(c, x, ey, ew, Math.max(8 * s, h), 46 * s);
          c.fillStyle = gr(ey, h);
          c.fill();
          return;
        }
        stroke(26 * s);
        c.beginPath();
        c.arc(x, ey + 34 * s, 66 * s, Math.PI * 1.1, Math.PI * 1.9);
        c.stroke();
      });
    } else if (e === 'love') {
      const pulse = 1 + 0.07 * Math.sin(t * 8);
      eyes.forEach((x) => {
        heart(c, x, ey + 4 * s, 62 * s * pulse);
        c.fillStyle = 'rgb(255,120,160)';
        c.fill();
        heart(c, x - 14 * s, ey - 22 * s, 14 * s);
        c.fillStyle = 'rgba(255,255,255,.55)';
        c.fill();
      });
    } else if (e === 'wow') {
      eyes.forEach((x) => {
        c.beginPath();
        c.arc(x, ey, 58 * s, 0, 7);
        c.fillStyle = gr(ey, 116 * s);
        c.fill();
        c.beginPath();
        c.arc(x, ey, 22 * s, 0, 7);
        c.fillStyle = '#04141c';
        c.fill();
        c.beginPath();
        c.arc(x - 16 * s, ey - 18 * s, 8 * s, 0, 7);
        c.fillStyle = 'rgba(255,255,255,.8)';
        c.fill();
      });
      c.beginPath();
      c.ellipse(cxm + S.gx, FH * 0.8, 22 * s, 28 * s, 0, 0, 7);
      stroke(10 * s);
      c.stroke();
    } else if (e === 'sparkle') {
      eyes.forEach((x, i) => {
        const k = 1 + 0.1 * Math.sin(t * 7 + i);
        star(c, x, ey, 74 * s * k);
        c.fillStyle = gr(ey, 150 * s);
        c.fill();
      });
    } else if (e === 'think') {
      eyes.forEach((x) => {
        const h = eh * 0.62 * open;
        pill(c, x + 26 * s, ey - 22 * s, ew * 0.9, Math.max(8 * s, h), 40 * s);
        c.fillStyle = gr(ey, h);
        c.fill();
      });
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.arc(cxm - 40 * s + i * 40 * s, FH * 0.8, (8 + 5 * (0.5 + 0.5 * Math.sin(t * 6 - i * 1.2))) * s, 0, 7);
        c.fillStyle = A_(1);
        c.fill();
      }
    } else if (e === 'sleep') {
      eyes.forEach((x) => {
        stroke(18 * s);
        c.beginPath();
        c.moveTo(x - 50 * s, ey + 6 * s);
        c.quadraticCurveTo(x, ey + 30 * s, x + 50 * s, ey + 6 * s);
        c.stroke();
      });
      for (let i = 0; i < 3; i++) {
        const p = (t * 0.35 + i / 3) % 1;
        c.fillStyle = A_(0.8 * (1 - p));
        c.font = `${(30 + 22 * p) * s}px sans-serif`;
        c.textAlign = 'center';
        c.fillText('z', cxm + 250 * s + p * 70 * s, FH * 0.36 - p * 120 * s);
      }
    } else {
      eyes.forEach((x) => {
        const h = Math.max(8 * s, eh * open);
        pill(c, x, ey, ew, h, 46 * s);
        c.fillStyle = gr(ey, h);
        c.fill();
        if (open > 0.5) {
          pill(c, x - 18 * s, ey - h * 0.28, 22 * s, 36 * s, 11 * s);
          c.fillStyle = 'rgba(255,255,255,.45)';
          c.fill();
        }
      });
    }

    // speech waveform
    if (S.talk > 0.04 && e !== 'wow' && e !== 'think' && e !== 'sleep') {
      for (let i = -4; i <= 4; i++) {
        const h = (10 + 74 * S.talk * Math.abs(Math.sin(t * 11 + i * 1.3) * Math.cos(t * 4.1 + i))) * s;
        pill(c, cxm + S.gx * 0.5 + i * 26 * s, FH * 0.81, 12 * s, h, 6 * s);
        c.fillStyle = A_(0.95);
        c.fill();
      }
    }
    texture.needsUpdate = true;
  }

  /** Redraw only when something visible changed. Returns true if it redrew. */
  function update(S, t) {
    const textSeed = Math.floor(t / 1.2);
    const animating = S.expr === 'think' || S.expr === 'sleep' || S.expr === 'love' || S.expr === 'sparkle' || S.talk > 0.04;
    const key = [
      S.expr,
      Math.round(S.blink * 12),
      Math.round(S.gx),
      Math.round(S.gy),
      Math.round(S.talk * 14),
      S.glowHex,
      textSeed,
      animating ? Math.floor(t * 24) : 0,
      S.sleeping,
    ].join('|');
    if (key === lastKey) return false;
    lastKey = key;
    draw(S, t, textSeed);
    return true;
  }

  function invalidate() {
    lastKey = '';
  }

  return { canvas, texture, update, invalidate };
}
