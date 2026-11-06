import * as THREE from 'three';

const rad = (d) => (d * Math.PI) / 180;

/**
 * Point and normal on a super-ellipsoid (|x/a|^n + |y/b|^n + |z/c|^n = 1)
 * in the direction (dx, dy, dz). n = 2 is a plain ellipsoid, larger n is boxier.
 */
export function superSurface(dx, dy, dz, R, n) {
  const F = Math.pow(
    Math.pow(Math.abs(dx) / R.x, n) + Math.pow(Math.abs(dy) / R.y, n) + Math.pow(Math.abs(dz) / R.z, n),
    1 / n
  );
  const k = 1 / F;
  const p = new THREE.Vector3(dx * k, dy * k, dz * k);
  const nn = new THREE.Vector3(
    (Math.sign(p.x) * Math.pow(Math.abs(p.x) / R.x, n - 1)) / R.x,
    (Math.sign(p.y) * Math.pow(Math.abs(p.y) / R.y, n - 1)) / R.y,
    (Math.sign(p.z) * Math.pow(Math.abs(p.z) / R.z, n - 1)) / R.z
  ).normalize();
  return { p, n: nn };
}

/** A sphere reshaped into a super-ellipsoid (used for head, torso, pelvis). */
export function superGeo(R, n, ws = 72, hs = 48) {
  const g = new THREE.SphereGeometry(1, ws, hs);
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const s = superSurface(pos.getX(i), pos.getY(i), pos.getZ(i), R, n);
    pos.setXYZ(i, s.p.x, s.p.y, s.p.z);
    nor.setXYZ(i, s.n.x, s.n.y, s.n.z);
  }
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

/**
 * A squircle-shaped patch lying on the surface of a super-ellipsoid.
 * Used for the visor, its bezel, and the small panels. UVs map the patch
 * by angle, so a canvas drawn in pixels keeps its proportions.
 */
export function patchGeo(R, n, o) {
  const seg = o.seg || 56;
  const p = o.p || 4;
  const off = o.off || 0;
  const th0 = o.thetaOff || 0;
  const P = [];
  const N = [];
  const UV = [];
  const I = [];
  for (let j = 0; j <= seg; j++) {
    for (let i = 0; i <= seg; i++) {
      const u = (i / seg) * 2 - 1;
      const v = (j / seg) * 2 - 1;
      const rinf = Math.max(Math.abs(u), Math.abs(v));
      const rp = Math.pow(Math.pow(Math.abs(u), p) + Math.pow(Math.abs(v), p), 1 / p);
      const s = rp > 1e-9 ? rinf / rp : 0;
      const x = u * s;
      const y = v * s;
      const ph = x * o.phi;
      const th = th0 + y * o.theta;
      const q = superSurface(Math.sin(ph) * Math.cos(th), Math.sin(th), Math.cos(ph) * Math.cos(th), R, n);
      P.push(q.p.x + q.n.x * off, q.p.y + q.n.y * off, q.p.z + q.n.z * off);
      N.push(q.n.x, q.n.y, q.n.z);
      UV.push(x * 0.5 + 0.5, y * 0.5 + 0.5);
    }
  }
  for (let j = 0; j < seg; j++) {
    for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i;
      const b = a + 1;
      const c = a + seg + 1;
      const d = c + 1;
      I.push(a, b, d, a, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setIndex(I);
  g.computeBoundingSphere();
  return g;
}

export function onSurface(R, n, phiDeg, thetaDeg, off) {
  const ph = rad(phiDeg);
  const th = rad(thetaDeg);
  const q = superSurface(Math.sin(ph) * Math.cos(th), Math.sin(th), Math.cos(ph) * Math.cos(th), R, n);
  return { p: q.p.clone().addScaledVector(q.n, off), n: q.n };
}

export function mesh(geo, mat, part, cast = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = true;
  m.userData.part = part;
  return m;
}

export function radialTexture(stops, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach((s) => g.addColorStop(s[0], s[1]));
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}
