// Realistic facial rig for the NOCTA characters: morph targets on the head mesh (jaw opening,
// smile with cheek raise, brow raise), a mouth made of lips / cavity / teeth / tongue that follows
// the same deformation, and wet, smaller eyes with thick lids and a pink waterline.
import * as THREE from 'three';
import { V, clamp, lerp, smooth, seeded, canvasTex, mat } from './lib.js';

export const MOUTH_Y = -0.0665;
const PIV = V(0, -0.002, -0.035);
const JAW_MAX = 0.24;

// how much a head-local point follows the jaw (0 = skull, 1 = jaw)
export function jawWeight(x, y, z) {
  if (z < -0.075) return 0;
  const ax = Math.abs(x);
  const lip = MOUTH_Y - 0.0004 + 0.0035 * Math.pow(Math.min(ax, 0.04) / 0.03, 2);
  const bw = 0.0012 + 0.02 * smooth((ax - 0.022) / 0.05);
  let w = smooth((lip - y) / bw + 0.5);
  w *= smooth((z + 0.07) / 0.06);
  // the lip corners stay anchored: the lower lip opens in a U, the chin drops fully
  const W = 0.029;
  const nearLip = smooth((y - (lip - 0.02)) / 0.014);
  const anchor = ax < W ? Math.pow(1 - (ax / W) ** 2, 0.6) : 0;
  w *= lerp(1, 0.06 + 0.94 * anchor, nearLip);
  return w;
}

export function jawFull(x, y, z) {
  const c = Math.cos(JAW_MAX), s = Math.sin(JAW_MAX);
  const dy = y - PIV.y, dz = z - PIV.z;
  return [0, PIV.y + dy * c - dz * s - y, PIV.z + dy * s + dz * c - z];
}

export function smileDelta(x, y, z) {
  if (z < 0.0) return [0, 0, 0];
  let dx = 0, dy = 0, dz = 0;
  for (const s of [1, -1]) {
    const d = Math.hypot(x - s * 0.026, (y - MOUTH_Y) * 1.3);
    const g = Math.exp(-((d / 0.017) ** 2));
    dx += s * 0.0032 * g; dy += 0.0045 * g; dz -= 0.0016 * g;
    const d2 = Math.hypot(x - s * 0.043, y + 0.034);
    const g2 = Math.exp(-((d2 / 0.021) ** 2));
    dx += s * 0.0008 * g2; dy += 0.0028 * g2; dz += 0.0024 * g2;
  }
  return [dx, dy, dz];
}

export function browDelta(x, y, z) {
  if (z < 0.0) return [0, 0, 0];
  const g = Math.exp(-(((y - 0.047) / 0.02) ** 2)) * Math.exp(-(((Math.abs(x) - 0.033) / 0.038) ** 2));
  return [0, 0.0042 * g, 0.0006 * g];
}

// add the three morph targets (relative) to a head-topology geometry
export function addFaceMorphs(geo, src = null) {
  const p = (src || geo).attributes.position;
  const n = p.count;
  const jaw = new Float32Array(n * 3), smile = new Float32Array(n * 3), brow = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const w = jawWeight(x, y, z), j = jawFull(x, y, z);
    jaw.set([j[0] * w, j[1] * w, j[2] * w], i * 3);
    smile.set(smileDelta(x, y, z), i * 3);
    brow.set(browDelta(x, y, z), i * 3);
  }
  geo.morphAttributes.position = [new THREE.BufferAttribute(jaw, 3), new THREE.BufferAttribute(smile, 3), new THREE.BufferAttribute(brow, 3)];
  geo.morphTargetsRelative = true;
}

function lipTex(hex, female) {
  return canvasTex(64, 64, (g, w, h) => {
    const c = new THREE.Color(hex);
    const css = (k) => `rgb(${Math.min(255, c.r * 255 * k) | 0},${Math.min(255, c.g * 255 * k) | 0},${Math.min(255, c.b * 255 * k) | 0})`;
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, css(1.0)); gr.addColorStop(0.45, css(1.1)); gr.addColorStop(1, css(0.92));
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const r = seeded(hex);
    for (let i = 0; i < 25; i++) { g.strokeStyle = `rgba(0,0,0,${0.02 + r() * 0.03})`; const x = r() * w; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 4, h); g.stroke(); }
  });
}

// mouth that follows the facial morphs. h: Human (needs faceAt), F: female
export class Mouth {
  constructor(h, F, lipsHex, group) {
    this.h = h; this.F = F; this.group = group;
    this.w = F ? 0.0235 : 0.0255;
    const mk = (hex, rough, extra = {}) => { const m = mat.std(hex, rough, 0, extra); m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; return m; };
    this.mCav = mk(0x3a1216, 0.85);
    const fade = (outerTop) => canvasTex(16, 64, (g, w2, h2) => { const gr = g.createLinearGradient(0, 0, 0, h2); if (outerTop) { gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.45, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,1)'); } else { gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); } g.fillStyle = gr; g.fillRect(0, 0, w2, h2); }, { linear: true });
    this.mLip = mk(0xffffff, F ? 0.38 : 0.6, { map: lipTex(lipsHex, F), alphaMap: fade(true), transparent: true, depthWrite: false });
    this.mLipLo = mk(0xffffff, F ? 0.35 : 0.6, { map: lipTex(lipsHex, F), alphaMap: fade(false), transparent: true, depthWrite: false });
    const teethTex = canvasTex(256, 32, (g, w2, h2) => {
      const gr = g.createLinearGradient(0, 0, 0, h2); gr.addColorStop(0, '#d8cfc2'); gr.addColorStop(0.3, '#f2ede4'); gr.addColorStop(1, '#e6ddd0'); g.fillStyle = gr; g.fillRect(0, 0, w2, h2);
      const n = 12; for (let i = 1; i < n; i++) { const x = (i / n) * w2; g.strokeStyle = 'rgba(120,100,90,0.35)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h2); g.stroke(); }
      const sh = g.createLinearGradient(0, 0, w2, 0); sh.addColorStop(0, 'rgba(60,20,20,0.7)'); sh.addColorStop(0.15, 'rgba(0,0,0,0)'); sh.addColorStop(0.85, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(60,20,20,0.7)'); g.fillStyle = sh; g.fillRect(0, 0, w2, h2);
    });
    this.mTeeth = mk(0xffffff, 0.3, { map: teethTex });
    this.mTongue = mk(0xb04a52, 0.55);
    this.mGum = mk(0x9a3a44, 0.6);
    const w = this.w, N = 24;
    const up = x => MOUTH_Y + 0.0003 + 0.0016 * (Math.abs(x) / w) ** 2;
    const lo = x => MOUTH_Y - 0.0006 - 0.0003 * (1 - (x / w) ** 2) + 0.0016 * (Math.abs(x) / w) ** 2;
    this.up = up; this.lo = lo;
    const xs = Array.from({ length: N + 1 }, (_, i) => lerp(-w, w, i / N));
    this.xs = xs;
    const shape = (top, bot, xx) => { const s = new THREE.Shape(); xx.forEach((x, i) => (i ? s.lineTo(x, top(x)) : s.moveTo(x, top(x)))); [...xx].reverse().forEach(x => s.lineTo(x, bot(x))); return s; };
    this.parts = [];
    this.addStatic(shape(up, lo, xs), this.mCav, 0.0007);
    const lw = w * 0.96;
    const lx = Array.from({ length: N + 1 }, (_, i) => lerp(-lw, lw, i / N));
    const upT = (F ? 0.0048 : 0.0032), loT = (F ? 0.0068 : 0.0048);
    // upper lip with a cupid's bow, lower lip fuller
    this.addStatic(shape(x => up(x) + 0.0002 + upT * Math.pow(1 - (x / lw) ** 2, 0.7) * (1 - 0.28 * Math.exp(-((x / 0.0045) ** 2))) + 0.0006 * Math.exp(-(((Math.abs(x) - 0.006) / 0.004) ** 2)), x => up(x) + 0.0001, lx), this.mLip, 0.0006, true);
    this.addStatic(shape(x => lo(x) - 0.0001, x => lo(x) - 0.0002 - loT * Math.pow(1 - (x / lw) ** 2, 0.6), lx), this.mLipLo, 0.0006, true);
    // dynamic: teeth, tongue
    this.teeth = new THREE.Mesh(new THREE.BufferGeometry(), this.mTeeth); group.add(this.teeth);
    this.teethLo = new THREE.Mesh(new THREE.BufferGeometry(), this.mTeeth); group.add(this.teethLo);
    this.tongue = new THREE.Mesh(new THREE.BufferGeometry(), this.mTongue); group.add(this.tongue);
  }

  addStatic(shape, m, off, uv = false) {
    const g = new THREE.ShapeGeometry(shape, 10);
    const p = g.attributes.position;
    g.computeBoundingBox(); const bb = g.boundingBox;
    const rest = new Float32Array(p.count * 3), jaw = new Float32Array(p.count * 3), smile = new Float32Array(p.count * 3), brow = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      const r = this.h.faceAt(x, y);
      const q = r.p.addScaledVector(r.n, off);
      if (uv) g.attributes.uv.setXY(i, (x - bb.min.x) / (bb.max.x - bb.min.x), (y - bb.min.y) / (bb.max.y - bb.min.y));
      rest.set([q.x, q.y, q.z], i * 3);
      const w = jawWeight(x, y, q.z), j = jawFull(q.x, q.y, q.z);
      jaw.set([j[0] * w, j[1] * w, j[2] * w], i * 3);
      smile.set(smileDelta(q.x, q.y, q.z), i * 3);
      brow.set(browDelta(q.x, q.y, q.z), i * 3);
      p.setXYZ(i, q.x, q.y, q.z);
    }
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, m); this.group.add(mesh);
    this.parts.push({ mesh, rest, jaw, smile, brow });
  }

  point(x, y, off, jw, sm, br) {
    const r = this.h.faceAt(x, y);
    const q = r.p.addScaledVector(r.n, off);
    const w = jawWeight(x, y, q.z), j = jawFull(q.x, q.y, q.z), s = smileDelta(q.x, q.y, q.z), b = browDelta(q.x, q.y, q.z);
    return V(q.x + j[0] * w * jw + s[0] * sm + b[0] * br, q.y + j[1] * w * jw + s[1] * sm + b[1] * br, q.z + j[2] * w * jw + s[2] * sm + b[2] * br);
  }

  strip(mesh, A, B) {
    const pos = [], idx = [], uv = [];
    for (let i = 0; i < A.length; i++) { pos.push(A[i].x, A[i].y, A[i].z, B[i].x, B[i].y, B[i].z); uv.push(i / (A.length - 1), 1, i / (A.length - 1), 0); }
    for (let i = 0; i < A.length - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    mesh.geometry.dispose(); mesh.geometry = g;
  }

  update(jw, sm, br) {
    for (const P of this.parts) {
      const a = P.mesh.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) {
        const k = i * 3;
        a.setXYZ(i, P.rest[k] + P.jaw[k] * jw + P.smile[k] * sm + P.brow[k] * br, P.rest[k + 1] + P.jaw[k + 1] * jw + P.smile[k + 1] * sm + P.brow[k + 1] * br, P.rest[k + 2] + P.jaw[k + 2] * jw + P.smile[k + 2] * sm + P.brow[k + 2] * br);
      }
      a.needsUpdate = true;
    }
    // teeth / tongue inside the opening
    const open = jw;
    const show = open > 0.04;
    this.teeth.visible = this.teethLo.visible = show; this.tongue.visible = open > 0.3;
    if (!show) return;
    const w = this.w;
    const tx = this.xs.filter(x => Math.abs(x) <= w * 0.86);
    const U = tx.map(x => this.point(x, this.up(x) - 0.0002, 0.0009, jw, sm, br));
    const L = tx.map(x => this.point(x, this.lo(x) + 0.0002, 0.0009, jw, sm, br));
    const gapK = (i) => { const d = U[i].distanceTo(L[i]); return d; };
    const UT = U.map((u, i) => { const d = gapK(i); const hgt = Math.min(0.0058, d * 0.42) * (1 - 0.45 * Math.pow(tx[i] / (w * 0.86), 4)); return u.clone().lerp(L[i], hgt / Math.max(d, 1e-5)); });
    this.strip(this.teeth, U, UT);
    const lx = tx.map((x, i) => i).filter(i => Math.abs(tx[i]) <= w * 0.72);
    const L2 = lx.map(i => L[i]), U2 = lx.map(i => U[i]);
    const LT = L2.map((l, k) => { const d = l.distanceTo(U2[k]); const hgt = Math.min(0.0032, d * 0.22) * smooth((open - 0.25) / 0.3); return l.clone().lerp(U2[k], hgt / Math.max(d, 1e-5)); });
    this.strip(this.teethLo, LT, L2);
    if (open > 0.3) {
      const ti = lx.filter(i => Math.abs(tx[i]) <= w * 0.55);
      const A = ti.map(i => L[i].clone().lerp(U[i], 0.12)), B = ti.map(i => L[i].clone().lerp(U[i], 0.12 + 0.22 * smooth((open - 0.3) / 0.4) * Math.sqrt(Math.max(0, 1 - (tx[i] / (w * 0.55)) ** 2))));
      this.strip(this.tongue, B, A);
    }
  }
}

function scleraTex() {
  return canvasTex(128, 64, (g, w, h) => {
    g.fillStyle = '#f2ece6'; g.fillRect(0, 0, w, h);
    const r = seeded(4);
    for (const cx of [0, w / 2, w]) {
      const gr = g.createRadialGradient(cx, h / 2, 0, cx, h / 2, 26); gr.addColorStop(0, 'rgba(230,150,150,0.55)'); gr.addColorStop(1, 'rgba(230,150,150,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }
    for (let i = 0; i < 30; i++) { g.strokeStyle = `rgba(200,80,80,${0.12 + r() * 0.15})`; g.lineWidth = 0.6; g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 12; y += (r() - 0.5) * 6; g.lineTo(x, y); } g.stroke(); }
  });
}

// eye with sclera texture, iris cap, thick lids with a lash line and a pink waterline
export function buildEye(socket, rEye, mSkin, mIris, F, side) {
  const ball = new THREE.Group(); socket.add(ball);
  const mWhite = mat.phys(0xffffff, { map: scleraTex(), roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03 });
  const sclera = new THREE.Mesh(new THREE.SphereGeometry(rEye, 32, 24), mWhite); ball.add(sclera);
  const capA = 0.52;
  const capG = new THREE.SphereGeometry(rEye * 1.005, 32, 14, 0, Math.PI * 2, 0, capA);
  capG.rotateX(Math.PI / 2);
  const uv = capG.attributes.uv, pp = capG.attributes.position, capR = rEye * Math.sin(capA);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pp.getX(i) / (2 * capR) + 0.5, pp.getY(i) / (2 * capR) + 0.5);
  ball.add(new THREE.Mesh(capG, mIris));
  const catch1 = new THREE.Mesh(new THREE.CircleGeometry(rEye * 0.07, 12), new THREE.MeshBasicMaterial({ color: 0xc8ccd6, transparent: true, opacity: 0.55 }));
  catch1.position.set(rEye * 0.3, rEye * 0.32, rEye * 0.96); catch1.lookAt(rEye * 0.6, rEye * 0.64, rEye * 3); ball.add(catch1);
  const mLash = mat.std(0x0e0a08, 0.8);
  const mRim = mSkin;
  const mWater = mat.std(0xc98a86, 0.25);
  // upper lid: shell + thick rounded rim + lashes
  const upper = new THREE.Group(); socket.add(upper);
  upper.add(new THREE.Mesh(new THREE.SphereGeometry(rEye * 1.07, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), mSkin));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(rEye * 1.06, rEye * 0.09, 8, 36, Math.PI), mRim);
  rim.rotation.x = Math.PI / 2; rim.rotation.z = Math.PI; upper.add(rim);
  const lash = new THREE.Mesh(new THREE.TorusGeometry(rEye * 1.1, F ? rEye * 0.065 : rEye * 0.045, 6, 36, Math.PI), mLash);
  lash.rotation.x = Math.PI / 2 + 0.12; lash.rotation.z = Math.PI; lash.position.y = rEye * 0.02; upper.add(lash);
  if (false) for (let k = 0; k < 9; k++) {
    const a = Math.PI * (0.15 + 0.7 * k / 8);
    const l = new THREE.Mesh(new THREE.ConeGeometry(rEye * 0.035, rEye * 0.35, 4), mLash);
    l.position.set(Math.cos(a) * rEye * 1.1, rEye * 0.12, Math.sin(a) * rEye * 1.1);
    l.rotation.set(-0.9 * Math.sin(a), 0, Math.cos(a) * 0.9); upper.add(l);
  }
  // crease above the lid
  const crease = new THREE.Mesh(new THREE.TorusGeometry(rEye * 1.22, rEye * 0.035, 6, 30, Math.PI * 0.8), mat.std(new THREE.Color(0x000000), 1, 0, { transparent: true, opacity: 0.18, depthWrite: false }));
  crease.rotation.set(Math.PI / 2 - 0.55, 0, Math.PI + Math.PI * 0.1); socket.add(crease);
  // lower lid with waterline
  const lower = new THREE.Group(); socket.add(lower);
  lower.add(new THREE.Mesh(new THREE.SphereGeometry(rEye * 1.06, 32, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mSkin));
  const water = new THREE.Mesh(new THREE.TorusGeometry(rEye * 1.04, rEye * 0.055, 6, 36, Math.PI), mWater);
  water.rotation.x = -Math.PI / 2; lower.add(water);
  // tear duct (caruncle)
  const car = new THREE.Mesh(new THREE.SphereGeometry(rEye * 0.16, 10, 8), mat.std(0xd08a88, 0.3));
  car.position.set(-side * rEye * 0.98, -rEye * 0.05, rEye * 0.25); socket.add(car);
  return { ball, upper, lower };
}

export function poreTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    const r = seeded(77);
    for (let i = 0; i < 9000; i++) { const v = 100 + r() * 60; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(r() * w, r() * h, 1 + r(), 1 + r()); }
    for (let i = 0; i < 1400; i++) { g.fillStyle = 'rgba(40,40,40,0.5)'; g.beginPath(); g.arc(r() * w, r() * h, 0.6 + r() * 0.6, 0, Math.PI * 2); g.fill(); }
  }, { repeat: [7, 7], linear: true });
}
