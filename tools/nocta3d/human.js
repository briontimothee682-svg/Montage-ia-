// Stylized 3D humans for the NOCTA film: rigged body with 2-bone IK, expressive face
// (3D eyeballs, lids, brows, decal mouth), sculpted hair, outfits and 5-finger hands.
// Character faces +Z, up is +Y, units are meters. Side sign: +1 = character's left (x > 0).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { V, clamp, lerp, smooth, seeded, canvasTex, limbGeo, lathe, mat } from './lib.js';

// ------------------------------------------------------------------ math helpers
const _m4 = new THREE.Matrix4(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();

// orient a bone so its local -Y points along dirW and its local +Z leans toward hintW
export function orientBone(bone, dirW, hintW) {
  const y = _v1.copy(dirW).normalize().negate();
  const z = _v2.copy(hintW).addScaledVector(y, -hintW.dot(y));
  if (z.lengthSq() < 1e-10) z.set(0, 0, 1).addScaledVector(y, -y.z);
  z.normalize();
  const x = _v3.crossVectors(y, z);
  _m4.makeBasis(x, y, z);
  _q1.setFromRotationMatrix(_m4);
  bone.parent.getWorldQuaternion(_q2);
  bone.quaternion.copy(_q2.invert().multiply(_q1));
  bone.updateMatrixWorld(true);
}

// analytic two-bone IK: upper/lower are joints whose meshes extend along -Y
export function solveIK(upper, lower, lenA, lenB, target, pole, hintUp) {
  const S = upper.getWorldPosition(new THREE.Vector3());
  const D = target.clone().sub(S);
  const d = clamp(D.length(), Math.abs(lenA - lenB) + 1e-3, lenA + lenB - 1e-3);
  const u = D.normalize();
  const cosA = (lenA * lenA + d * d - lenB * lenB) / (2 * lenA * d);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const v = pole.clone().sub(S);
  v.addScaledVector(u, -v.dot(u));
  if (v.lengthSq() < 1e-10) v.set(0, 0, 1);
  v.normalize();
  const E = S.clone().addScaledVector(u, lenA * cosA).addScaledVector(v, lenA * sinA);
  const T = S.clone().addScaledVector(u, d);
  orientBone(upper, E.clone().sub(S), hintUp || v);
  orientBone(lower, T.clone().sub(E), v);
  return { E, T };
}

// ------------------------------------------------------------------ head geometry
const HEAD_R = V(0.103, 0.128, 0.114);

function headGeometry(female) {
  const g = new THREE.SphereGeometry(1, 72, 56);
  const p = g.attributes.position;
  const dirs = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    dirs[i * 3] = x; dirs[i * 3 + 1] = y; dirs[i * 3 + 2] = z;
    const low = smooth((-y - 0.05) / 0.95);            // 0 above the cheeks, 1 at the chin
    const front = clamp(z * 1.2);
    // jaw: narrower toward the chin, chin a little forward
    x *= 1 - (female ? 0.34 : 0.2) * Math.pow(low, female ? 1.3 : 1.8);
    z *= 1 - 0.10 * low;
    z += 0.07 * Math.pow(low, 2.2) * front * (1 - Math.abs(x));
    // cheeks
    const ck = Math.exp(-(((y + 0.28) / 0.22) ** 2)) * Math.exp(-(((Math.abs(x) - 0.55) / 0.3) ** 2)) * front;
    x += Math.sign(x) * 0.035 * ck; z += 0.03 * ck;
    // cranium a bit bigger at the back, forehead slightly flattened
    if (z < 0) z *= 1 + 0.10 * clamp(y + 0.4);
    z *= 1 - 0.05 * smooth((y - 0.35) / 0.6) * front;
    // brow ridge
    const br = Math.exp(-(((y - 0.18) / 0.10) ** 2)) * front * Math.exp(-((x / 0.6) ** 2));
    z += (female ? 0.012 : 0.025) * br;
    // eye sockets (soft)
    const es = Math.exp(-(((y - 0.04) / 0.13) ** 2)) * Math.exp(-(((Math.abs(x) - 0.38) / 0.17) ** 2)) * front;
    z -= 0.035 * es;
    p.setXYZ(i, x * HEAD_R.x, y * HEAD_R.y, z * HEAD_R.z);
  }
  g.setAttribute('dir', new THREE.BufferAttribute(dirs, 3));
  g.computeVertexNormals();
  return g;
}

// angles of a unit direction: az (0 front, +-PI back, + toward the character's left), el
const angles = (x, y, z) => [Math.atan2(x, z), Math.asin(clamp(y, -1, 1))];

// copy of the head surface pushed outward with a per-vertex mask in alpha
function shellGeometry(headGeo, offset, maskFn, colorFn) {
  const g = headGeo.clone();
  const p = g.attributes.position, n = g.attributes.normal, d = g.attributes.dir;
  const col = new Float32Array(p.count * 4);
  for (let i = 0; i < p.count; i++) {
    const dx = d.getX(i), dy = d.getY(i), dz = d.getZ(i);
    const m = maskFn(dx, dy, dz, p.getX(i), p.getY(i), p.getZ(i));
    const off = typeof offset === 'function' ? offset(dx, dy, dz, m) : offset;
    p.setXYZ(i, p.getX(i) + n.getX(i) * off, p.getY(i) + n.getY(i) * off, p.getZ(i) + n.getZ(i) * off);
    const c = colorFn ? colorFn(dx, dy, dz) : [1, 1, 1];
    col.set([c[0], c[1], c[2], m], i * 4);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 4));
  g.computeVertexNormals();
  return g;
}

// hairline: elevation threshold as a function of |az|
function hairlineEl(az, front = 0.42, temple = 0.22, ear = 0.02, nape = -0.55) {
  const a = Math.abs(az);
  if (a < 0.75) return lerp(front, temple, Math.pow(a / 0.75, 1.4));
  if (a < 1.6) return lerp(temple, ear, smooth((a - 0.75) / 0.85));
  return lerp(ear, nape, smooth((a - 1.6) / 1.3));
}

// ------------------------------------------------------------------ textures
function irisTex(hex) {
  return canvasTex(128, 128, (g, w, h) => {
    const c = new THREE.Color(hex);
    const css = (k, a = 1) => `rgba(${Math.round(c.r * 255 * k)},${Math.round(c.g * 255 * k)},${Math.round(c.b * 255 * k)},${a})`;
    g.fillStyle = '#f4f1ee'; g.fillRect(0, 0, w, h);
    const r = g.createRadialGradient(64, 64, 10, 64, 64, 60);
    r.addColorStop(0, css(1.5)); r.addColorStop(0.55, css(1.0)); r.addColorStop(0.9, css(0.55)); r.addColorStop(1, css(0.25));
    g.fillStyle = r; g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill();
    const rnd = seeded(hex);
    for (let i = 0; i < 90; i++) {
      const a = rnd() * Math.PI * 2, r0 = 18 + rnd() * 8, r1 = 40 + rnd() * 18;
      g.strokeStyle = rnd() < 0.5 ? css(1.7, 0.35) : css(0.5, 0.35); g.lineWidth = 1 + rnd() * 1.5;
      g.beginPath(); g.moveTo(64 + Math.cos(a) * r0, 64 + Math.sin(a) * r0); g.lineTo(64 + Math.cos(a) * r1, 64 + Math.sin(a) * r1); g.stroke();
    }
    g.fillStyle = '#060404'; g.beginPath(); g.arc(64, 64, 21, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.75)'; g.lineWidth = 5; g.beginPath(); g.arc(64, 64, 59, 0, Math.PI * 2); g.stroke();
  });
}

function strandTex(hex, seed, light = 1.25, dark = 0.7) {
  return canvasTex(256, 256, (g, w, h) => {
    const c = new THREE.Color(hex), rnd = seeded(seed);
    g.fillStyle = `#${c.getHexString()}`; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 520; i++) {
      const k = rnd() < 0.5 ? light : dark;
      g.strokeStyle = `rgba(${Math.min(255, c.r * 255 * k)},${Math.min(255, c.g * 255 * k)},${Math.min(255, c.b * 255 * k)},${0.15 + rnd() * 0.3})`;
      g.lineWidth = 0.6 + rnd() * 1.6;
      const x = rnd() * w;
      g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (rnd() - .5) * 8, h * .33, x + (rnd() - .5) * 8, h * .66, x + (rnd() - .5) * 6, h); g.stroke();
    }
  }, { repeat: [3, 1] });
}

function knitTex(hex, seed, rows = 26, cols = 18) {
  return canvasTex(256, 256, (g, w, h) => {
    const c = new THREE.Color(hex);
    g.fillStyle = `#${c.getHexString()}`; g.fillRect(0, 0, w, h);
    const cw = w / cols, rh = h / rows;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = i * cw, y = j * rh;
      for (const s of [-1, 1]) {
        g.fillStyle = `rgba(0,0,0,0.16)`;
        g.beginPath(); g.ellipse(x + cw / 2 + s * cw * 0.2, y + rh / 2, cw * 0.18, rh * 0.55, s * 0.5, 0, Math.PI * 2); g.fill();
        g.fillStyle = `rgba(255,255,255,0.12)`;
        g.beginPath(); g.ellipse(x + cw / 2 + s * cw * 0.2 - 1, y + rh / 2 - 1, cw * 0.12, rh * 0.42, s * 0.5, 0, Math.PI * 2); g.fill();
      }
    }
  }, { repeat: [3, 2] });
}

function ribTex(hex, n = 60) {
  return canvasTex(256, 64, (g, w, h) => {
    const c = new THREE.Color(hex);
    g.fillStyle = `#${c.getHexString()}`; g.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) {
      const x = (i / n) * w;
      const gr = g.createLinearGradient(x, 0, x + w / n, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0.22)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.10)'); gr.addColorStop(1, 'rgba(0,0,0,0.22)');
      g.fillStyle = gr; g.fillRect(x, 0, w / n, h);
    }
  }, { repeat: [3, 4] });
}

function denimTex(hex, seed) {
  return canvasTex(256, 256, (g, w, h) => {
    const c = new THREE.Color(hex), rnd = seeded(seed);
    g.fillStyle = `#${c.getHexString()}`; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const x = rnd() * w, y = rnd() * h;
      g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.10)';
      g.fillRect(x, y, 3 + rnd() * 5, 1);
    }
  }, { repeat: [2, 4] });
}

// ------------------------------------------------------------------ character specs
export const CAST = {
  lucas: {
    female: false, scale: 1.0, skin: 0xe2ad8a, lips: 0xa86a60, iris: 0x6e6232, brow: 0x3f2818, hair: 0x4a2e1a,
    hairStyle: 'crop', facial: 'stubble', top: 'tee_overshirt', topColor: 0xf4f2ee, outer: 0x17171a,
    pants: 0x1d1f26, shoes: 0xf2f2f2, chain: 'silver',
  },
  malik: {
    female: false, scale: 1.02, skin: 0x6a3f27, lips: 0x5a2f25, iris: 0x2e1a10, brow: 0x120c09, hair: 0x120d0b,
    hairStyle: 'twists', facial: 'beard', top: 'sweater', topColor: 0xe9dcc4, pants: 0x2b2d33, shoes: 0x1a1a1c, chain: 'gold',
  },
  chloe: {
    female: true, scale: 0.94, skin: 0xf1c3a7, lips: 0xd57c80, iris: 0x5e93cf, brow: 0xa98a64, hair: 0xf0e4c6,
    hairStyle: 'long', facial: null, top: 'cami', topColor: 0x101014, pants: 0x8aa3c4, shoes: 0x141416, hoops: true,
  },
  ines: {
    female: true, scale: 0.95, skin: 0xb47a52, lips: 0x8c3a3e, iris: 0x45260f, brow: 0x24150d, hair: 0x2a1810,
    hairStyle: 'curly', facial: null, top: 'ribbed', topColor: 0x6e1626, pants: 0x1c1d22, shoes: 0xf0eeea, chain: 'gold_thin',
  },
  dj: {
    female: false, scale: 1.0, skin: 0x9a6542, lips: 0x7a4436, iris: 0x2e1a10, brow: 0x1a1210, hair: 0x15100d,
    hairStyle: 'buzz', facial: 'beard', top: 'tee', topColor: 0x111114, pants: 0x18181c, shoes: 0x111111, headphones: true,
  },
  bouncer: {
    female: false, scale: 1.08, skin: 0x7b4a2e, lips: 0x5a2f25, iris: 0x2e1a10, brow: 0x120c09, hair: 0x120d0b,
    hairStyle: 'buzz', facial: 'beard', top: 'jacket', topColor: 0x0d0d10, outer: 0x0d0d10, pants: 0x0f0f12, shoes: 0x0b0b0b, bulk: 1.18,
  },
};

// ------------------------------------------------------------------ Human
export class Human {
  constructor(name, opts = {}) {
    const s = { ...CAST[name], ...opts };
    this.name = name; this.s = s;
    this.seed = [...name].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
    const F = s.female;
    this.root = new THREE.Group(); this.root.name = name;
    this.rig = new THREE.Group(); this.root.add(this.rig);
    this.rig.scale.setScalar(s.scale || 1);
    const bulk = s.bulk || 1;

    // ----- materials
    this.mSkin = mat.phys(s.skin, { roughness: 0.52, sheen: 0.5, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xff9a80).multiplyScalar(0.18), clearcoat: 0.05, clearcoatRoughness: 0.7 });
    const mTop = this.topMaterial(s);
    const mPants = mat.std(0xffffff, 0.85, 0, { map: denimTex(s.pants, this.seed) });
    const mShoe = mat.std(s.shoes, 0.55);

    // ----- skeleton
    const J = (parent, x, y, z, name) => { const g = new THREE.Group(); g.name = name; g.position.set(x, y, z); parent.add(g); return g; };
    this.L = {
      thigh: F ? 0.42 : 0.44, shin: F ? 0.41 : 0.43, upper: F ? 0.27 : 0.29, fore: F ? 0.24 : 0.26,
    };
    const hipH = this.L.thigh + this.L.shin + 0.075;
    this.hipH = hipH;
    this.hips = J(this.rig, 0, hipH, 0, 'hips');
    this.spine = J(this.hips, 0, 0.02, 0, 'spine');
    const shY = F ? 0.405 : 0.425, shX = (F ? 0.15 : 0.17) * bulk;
    this.neck = J(this.spine, 0, F ? 0.468 : 0.488, -0.005, 'neck');
    this.head = J(this.neck, 0, 0.085, 0.004, 'head');
    this.arm = {}; this.leg = {};
    for (const side of [1, -1]) {
      const k = side > 0 ? 'L' : 'R';
      const sh = J(this.spine, side * shX, shY, -0.008, 'shoulder' + k);
      const el = J(sh, 0, -this.L.upper, 0, 'elbow' + k);
      const wr = J(el, 0, -this.L.fore, 0, 'wrist' + k);
      this.arm[k] = { sh, el, wr, side };
      const th = J(this.hips, side * (F ? 0.088 : 0.092) * bulk, -0.045, 0, 'thigh' + k);
      const kn = J(th, 0, -this.L.thigh, 0, 'knee' + k);
      const an = J(kn, 0, -this.L.shin, 0, 'ankle' + k);
      this.leg[k] = { th, kn, an, side };
    }

    // ----- torso
    const prof = F
      ? [[0.001, -0.12], [0.11, -0.115], [0.155, -0.07], [0.158, 0.0], [0.135, 0.12], [0.122, 0.2], [0.138, 0.28], [0.15, 0.34], [0.152, 0.40], [0.15, 0.43], [0.13, 0.46], [0.08, 0.482], [0.001, 0.49]]
      : [[0.001, -0.12], [0.105, -0.115], [0.146, -0.08], [0.15, 0.0], [0.146, 0.12], [0.152, 0.22], [0.166, 0.32], [0.176, 0.40], [0.178, 0.44], [0.158, 0.475], [0.11, 0.5], [0.05, 0.513], [0.001, 0.516]];
    const profB = prof.map(([r, y]) => [r * bulk, y]);
    const torsoSkin = new THREE.Mesh(lathe(profB, 40, 0.66), this.mSkin);
    this.spine.add(torsoSkin);
    this.buildTop(s, profB, mTop);
    // pelvis / pants
    const pelvis = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), mPants);
    pelvis.scale.set(0.152 * bulk, 0.105, 0.108 * bulk); pelvis.position.set(0, -0.055, -0.003);
    this.hips.add(pelvis);
    if (false) {
      const bust = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), mTop);
      bust.scale.set(0.118, 0.06, 0.05); bust.position.set(0, 0.33, 0.062); this.spine.add(bust);
    }

    // ----- neck & head
    const neckMesh = new THREE.Mesh(limbGeo(0.12, F ? 0.040 : 0.047, F ? 0.044 : 0.052, 24, 0), this.mSkin);
    neckMesh.rotation.x = Math.PI; neckMesh.position.y = -0.02; this.neck.add(neckMesh);
    this.buildHead(s);

    // ----- limbs
    const armR = F ? [0.040, 0.031, 0.031, 0.024] : [0.049, 0.039, 0.039, 0.030];
    const legR = F ? [0.083, 0.056, 0.055, 0.037] : [0.088, 0.060, 0.058, 0.041];
    for (const k of ['L', 'R']) {
      const a = this.arm[k], l = this.leg[k];
      const up = new THREE.Mesh(limbGeo(this.L.upper, armR[0] * bulk, armR[1] * bulk), this.mSkin); a.sh.add(up);
      const fo = new THREE.Mesh(limbGeo(this.L.fore, armR[2] * bulk, armR[3]), this.mSkin); a.el.add(fo);
      this.buildSleeves(s, a, armR, mTop, bulk);
      this.buildHand(a, armR[3]);
      const th = new THREE.Mesh(limbGeo(this.L.thigh, legR[0] * bulk, legR[1]), mPants); l.th.add(th);
      const sn = new THREE.Mesh(limbGeo(this.L.shin, legR[2], legR[3]), mPants); l.kn.add(sn);
      const knee = new THREE.Mesh(new THREE.SphereGeometry(legR[1] * 1.02, 20, 14), mPants); l.kn.add(knee);
      // shoe
      const shoe = new THREE.Group(); l.an.add(shoe);
      const sole = new THREE.Mesh(new RoundedBoxGeometry(0.098, 0.035, 0.27, 3, 0.016), mat.std(s.shoes === 0xf2f2f2 || s.shoes === 0xf0eeea ? 0xffffff : 0x2a2a2a, 0.6));
      sole.position.set(0, -0.058, 0.05); shoe.add(sole);
      const upper = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), mShoe);
      upper.scale.set(0.05, 0.05, 0.13); upper.position.set(0, -0.03, 0.05); shoe.add(upper);
      if (F && name === 'chloe') { upper.scale.set(0.045, 0.09, 0.12); upper.position.y = 0.0; }
    }

    // ----- props / accessories
    if (s.chain) this.buildChain(s.chain);
    this.phone = null;
    this.face = { smile: 0, open: 0, browUp: 0, blink: 0, squint: 0 };
    this._mouthKey = '';
    this.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }

  topMaterial(s) {
    if (s.top === 'sweater') return mat.std(0xffffff, 0.95, 0, { map: knitTex(s.topColor, this.seed), bumpMap: knitTex(0x808080, this.seed + 1), bumpScale: 1.2 });
    if (s.top === 'ribbed') return mat.std(0xffffff, 0.75, 0, { map: ribTex(s.topColor), bumpMap: ribTex(0x808080), bumpScale: 0.8 });
    if (s.top === 'cami') return mat.phys(s.topColor, { roughness: 0.28, sheen: 1.0, sheenRoughness: 0.35, sheenColor: new THREE.Color(0x8a8aa0), clearcoat: 0.3 });
    return mat.std(s.topColor, 0.85);
  }

  buildTop(s, prof, mTop) {
    const cut = (yMax, grow = 0.006, yMin = -0.12) => {
      const p = prof.filter(([r, y]) => y <= yMax && y >= yMin).map(([r, y]) => [r + grow, y]);
      return p;
    };
    const hemY = -0.085;
    if (s.top === 'cami') {
      const g = lathe([[0.001, hemY - 0.01], [0.162, hemY], ...cut(0.395, 0.006, hemY + 0.01)], 40, 0.66);
      this.spine.add(new THREE.Mesh(g, mTop));
      for (const side of [1, -1]) {   // straps
        const curve = new THREE.CatmullRomCurve3([V(side * 0.08, 0.375, 0.088), V(side * 0.093, 0.445, 0.04), V(side * 0.093, 0.45, -0.05), V(side * 0.085, 0.385, -0.085)]);
        this.spine.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.004, 6), mTop));
      }
      return;
    }
    const grow = s.top === 'sweater' ? 0.015 : (s.top === 'jacket' ? 0.02 : 0.006);
    const top = new THREE.Mesh(lathe([[0.001, hemY - 0.012], [prof[2][0] + grow + 0.012, hemY], ...cut(0.53, grow, hemY + 0.01)], 40, 0.68), mTop);
    this.spine.add(top);
    // collar / neckline
    const collar = new THREE.Mesh(new THREE.TorusGeometry(s.top === 'sweater' ? 0.062 : 0.056, s.top === 'sweater' ? 0.014 : 0.006, 10, 40), mTop);
    collar.rotation.x = Math.PI / 2 + 0.25; collar.scale.set(1, 0.85, 1); collar.position.set(0, s.female ? 0.475 : 0.5, 0.008);
    this.spine.add(collar);
    if (s.top === 'sweater') {
      const hem = new THREE.Mesh(lathe([[0.164 + 0.02, -0.09], [0.168 + 0.02, -0.04]], 40, 0.68), mat.std(0xd9caae, 0.95, 0, { bumpMap: ribTex(0x808080, 90), bumpScale: 1 }));
      this.spine.add(hem);
    }
    if (s.top === 'tee_overshirt' || s.top === 'jacket') {
      // open overshirt: lathe shell with a gap at the front
      const mOut = mat.std(0xffffff, 0.8, 0, { map: denimTex(s.outer, this.seed + 3) });
      const gap = s.top === 'jacket' ? 0.25 : 0.62;
      const p = prof.filter(([r, y]) => y <= 0.5).map(([r, y]) => [r + 0.016, y]);
      p[0] = [p[1][0], -0.1];
      const g = lathe(p, 40, 0.70, gap / 2, Math.PI * 2 - gap);
      const shell = new THREE.Mesh(g, mOut);
      shell.material.side = THREE.DoubleSide;
      this.spine.add(shell);
      // collar flaps
      for (const side of [1, -1]) {
        const flap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.008), mOut);
        flap.position.set(side * 0.06, 0.465, 0.085); flap.rotation.set(-0.35, 0, side * 0.45); this.spine.add(flap);
        const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.36, 0.012), mOut);
        lapel.position.set(side * 0.068, 0.27, 0.108); lapel.rotation.set(-0.05, 0, side * 0.04); this.spine.add(lapel);
        // buttons
        if (side > 0) for (let i = 0; i < 4; i++) {
          const b = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.003, 12), mat.std(0x2a2a2e, 0.4));
          b.rotation.x = Math.PI / 2; b.position.set(side * 0.074, 0.1 + i * 0.09, 0.114); this.spine.add(b);
        }
      }
      this.mOuter = mOut;
    }
  }

  buildSleeves(s, a, r, mTop, bulk) {
    const add = (joint, len, r0, r1, m) => { const me = new THREE.Mesh(limbGeo(len, r0, r1, 20, 0.04), m); joint.add(me); return me; };
    const sh = new THREE.Mesh(new THREE.SphereGeometry(r[0] * 1.08 * bulk + (s.top === 'sweater' ? 0.012 : (s.top === 'cami' ? 0 : 0.012)), 20, 14), s.top === 'cami' ? this.mSkin : (this.mOuter || mTop));
    a.sh.add(sh);
    if (s.top === 'cami') return;
    if (s.top === 'tee_overshirt' || s.top === 'jacket') {
      const m = this.mOuter;
      add(a.sh, this.L.upper, r[0] * bulk + 0.014, r[1] * bulk + 0.014, m);
      const el = new THREE.Mesh(new THREE.SphereGeometry(r[1] * bulk + 0.014, 16, 12), m); a.el.add(el);
      const k = s.top === 'jacket' ? 0.95 : 0.55;
      add(a.el, this.L.fore * k, r[2] * bulk + 0.013, lerp(r[2], r[3], k) + 0.016, m);
      if (k < 0.9) {   // rolled cuff
        const cuff = new THREE.Mesh(new THREE.TorusGeometry(lerp(r[2], r[3], k) + 0.014, 0.008, 8, 24), m);
        cuff.rotation.x = Math.PI / 2; cuff.position.y = -this.L.fore * k; a.el.add(cuff);
      }
      return;
    }
    const g = s.top === 'sweater' ? 0.012 : 0.008;
    add(a.sh, this.L.upper, r[0] * bulk + g, r[1] * bulk + g, mTop);
    const el = new THREE.Mesh(new THREE.SphereGeometry(r[1] * bulk + g, 16, 12), mTop); a.el.add(el);
    const len = s.top === 'tee' ? 0 : this.L.fore * 0.93;
    if (s.top === 'tee') {   // short sleeve
      a.sh.children[a.sh.children.length - 1].scale.y = 0.45;
      a.el.remove(el);
      return;
    }
    add(a.el, len, r[2] * bulk + g, r[3] + g * 0.9, mTop);
    if (s.top === 'sweater') {
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(r[3] + 0.016, r[3] + 0.014, 0.05, 20), mat.std(0xd9caae, 0.95));
      cuff.position.y = -len + 0.015; a.el.add(cuff);
    }
  }

  buildHand(a, wristR) {
    const side = a.side;
    const hand = new THREE.Group(); a.wr.add(hand); a.hand = hand;
    const F = this.s.female;
    const k = F ? 0.88 : 1.0;
    const palm = new THREE.Mesh(new RoundedBoxGeometry(0.076 * k, 0.088 * k, 0.03 * k, 4, 0.013 * k), this.mSkin);
    palm.position.set(0, -0.05 * k, 0); hand.add(palm);
    a.fingers = [];
    const fx = [-0.026, -0.009, 0.009, 0.026], fl = [0.072, 0.08, 0.076, 0.06];
    for (let i = 0; i < 4; i++) {
      const base = new THREE.Group(); base.position.set(side * fx[i] * k * -1, -0.092 * k, 0); hand.add(base);
      const r0 = (i === 3 ? 0.0078 : 0.0088) * k;
      const p1 = new THREE.Mesh(limbGeo(fl[i] * 0.55 * k, r0, r0 * 0.92, 12, 0.03), this.mSkin); base.add(p1);
      const mid = new THREE.Group(); mid.position.y = -fl[i] * 0.55 * k; base.add(mid);
      const p2 = new THREE.Mesh(limbGeo(fl[i] * 0.45 * k, r0 * 0.92, r0 * 0.8, 12, 0.03), this.mSkin); mid.add(p2);
      const nail = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), mat.std(F ? 0xe8b0b4 : 0xf0d0c4, 0.35));
      nail.scale.set(r0 * 0.75, r0 * 1.0, r0 * 0.35); nail.position.set(0, -fl[i] * 0.45 * k + r0 * 0.6, -r0 * 0.75); mid.add(nail);
      a.fingers.push([base, mid]);
    }
    // thumb (thumb side = -side for palm normal +Z: left thumb at -x... see header note)
    const tb = new THREE.Group(); tb.position.set(side * 0.036 * k, -0.03 * k, 0.012 * k); hand.add(tb);
    tb.rotation.set(0.0, 0, side * 0.7);
    const t1 = new THREE.Mesh(limbGeo(0.042 * k, 0.0105 * k, 0.0095 * k, 12, 0.05), this.mSkin); tb.add(t1);
    const tm = new THREE.Group(); tm.position.y = -0.042 * k; tb.add(tm);
    const t2 = new THREE.Mesh(limbGeo(0.032 * k, 0.0095 * k, 0.0085 * k, 12, 0.03), this.mSkin); tm.add(t2);
    a.thumb = [tb, tm];
    const wrist = new THREE.Mesh(new THREE.SphereGeometry(wristR * 1.05, 14, 10), this.mSkin); a.wr.add(wrist);
  }

  buildChain(kind) {
    const gold = kind.startsWith('gold');
    const m = mat.std(gold ? 0xe0ae52 : 0xdedfe4, 0.22, 1.0);
    const thin = kind === 'gold_thin';
    const t = new THREE.Mesh(new THREE.TorusGeometry(this.s.female ? 0.07 : 0.075, thin ? 0.0012 : 0.0022, 6, 64), m);
    t.rotation.x = Math.PI / 2 - 0.95; t.scale.set(1, 1.3, 1);
    t.position.set(0, this.s.female ? 0.43 : 0.455, 0.045);
    this.spine.add(t);
    if (thin) {
      const pend = new THREE.Mesh(new THREE.SphereGeometry(0.006, 12, 8), m);
      pend.position.set(0, 0.355, 0.105); this.spine.add(pend);
    }
  }

  // ------------------------------------------------------------------ head
  buildHead(s) {
    const F = s.female;
    const hg = new THREE.Group(); hg.position.set(0, 0.118, 0.012); hg.scale.setScalar(1.08); this.head.add(hg); this.headGroup = hg;
    const geo = headGeometry(F);
    this.mHead = this.mSkin.clone(); this.mHead.vertexColors = true;
    this.paintHead(geo, F);
    const head = new THREE.Mesh(geo, this.mHead); hg.add(head); this.headMesh = head;
    // surface sampler on the face (front projection)
    this.buildFaceSampler(head);
    const fa = (x, y, off = 0) => { const r = this.faceAt(x, y); return r.p.clone().addScaledVector(r.n, off); };

    // ears
    for (const side of [1, -1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), this.mSkin);
      ear.scale.set(0.012, 0.031, 0.021); ear.position.set(side * 0.099, -0.008, -0.006); ear.rotation.set(0, side * 0.35, side * -0.1);
      hg.add(ear);
      const inner = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), mat.std(new THREE.Color(s.skin).multiplyScalar(0.72), 0.6));
      inner.scale.set(0.004, 0.02, 0.012); inner.position.set(side * 0.108, -0.008, -0.004); inner.rotation.copy(ear.rotation); hg.add(inner);
      if (s.hoops) {
        const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.0017, 8, 28), mat.std(0xe0ae52, 0.2, 1));
        hoop.position.set(side * 0.104, -0.044, 0.0); hoop.rotation.y = Math.PI / 2; hg.add(hoop);
      }
    }
    // nose
    const nose = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), this.mSkin);
    const np = fa(0, -0.030, 0.0);
    nose.scale.set(F ? 0.0115 : 0.0135, F ? 0.012 : 0.014, F ? 0.013 : 0.015); nose.position.copy(np).add(V(0, 0, -0.004)); hg.add(nose);
    const bridge = new THREE.Mesh(new THREE.CylinderGeometry(F ? 0.004 : 0.005, F ? 0.0072 : 0.0085, 0.026, 14), this.mSkin);
    const bp = fa(0, -0.016, -0.0042); bridge.position.copy(bp); bridge.rotation.x = -0.25; hg.add(bridge);
    for (const side of [1, -1]) {
      const al = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), this.mSkin);
      al.scale.set(0.0075, 0.0065, 0.0075); al.position.copy(fa(side * 0.0105, -0.035, -0.0045)); hg.add(al);
    }

    // eyes
    this.eyes = [];
    const ex = F ? 0.038 : 0.039, ey = 0.006;
    const rEye = F ? 0.0188 : 0.018;
    const mWhite = mat.phys(0xf5f2ee, { roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 });
    const mIris = new THREE.MeshPhysicalMaterial({ map: irisTex(s.iris), roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.03 });
    const mLash = mat.std(0x120c0a, 0.7);
    for (const side of [1, -1]) {
      const sp = this.faceAt(side * ex, ey);
      const c = sp.p.clone().addScaledVector(V(0, 0, 1), -rEye * 0.62);
      const socket = new THREE.Group(); socket.position.copy(c); hg.add(socket);
      const ball = new THREE.Group(); socket.add(ball);
      ball.add(new THREE.Mesh(new THREE.SphereGeometry(rEye, 32, 24), mWhite));
      const capG = new THREE.SphereGeometry(rEye * 1.004, 32, 12, 0, Math.PI * 2, 0, 0.62);
      capG.rotateX(Math.PI / 2);
      const uv = capG.attributes.uv, pp = capG.attributes.position;
      const capR = rEye * Math.sin(0.62);
      for (let i = 0; i < uv.count; i++) uv.setXY(i, pp.getX(i) / (2 * capR) + 0.5, pp.getY(i) / (2 * capR) + 0.5);
      ball.add(new THREE.Mesh(capG, mIris));
      const glint = new THREE.Mesh(new THREE.SphereGeometry(rEye * 0.12, 10, 8), mat.emit(0xffffff, 1.4));
      glint.position.set(rEye * 0.32, rEye * 0.38, rEye * 0.93); ball.add(glint);
      // lids
      const lidG = new THREE.SphereGeometry(rEye * 1.06, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2);
      const upper = new THREE.Group(); socket.add(upper);
      upper.add(new THREE.Mesh(lidG, this.mSkin));
      const lash = new THREE.Mesh(new THREE.TorusGeometry(rEye * 1.07, F ? 0.0016 : 0.0011, 6, 32, Math.PI), mLash);
      lash.rotation.x = Math.PI / 2; lash.rotation.z = Math.PI; upper.add(lash);
      if (F) {   // eyelash flick
        const fl = new THREE.Mesh(new THREE.ConeGeometry(0.0016, 0.007, 6), mLash);
        fl.position.set(side * rEye * 1.0, 0, rEye * 0.3); fl.rotation.set(0, 0, side * -1.2); upper.add(fl);
      }
      const lower = new THREE.Group(); socket.add(lower);
      const lowG = new THREE.SphereGeometry(rEye * 1.05, 32, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
      lower.add(new THREE.Mesh(lowG, this.mSkin));
      this.eyes.push({ socket, ball, upper, lower, side });
    }
    // brows
    this.brows = [];
    const mBrow = mat.std(s.brow, 0.9);
    for (const side of [1, -1]) {
      const g = new THREE.Group(); hg.add(g);
      const pts = [];
      const bx = [0.014, 0.03, 0.048, 0.062], by = F ? [0.034, 0.041, 0.042, 0.036] : [0.033, 0.039, 0.040, 0.035];
      for (let i = 0; i < 4; i++) pts.push(fa(side * bx[i], by[i], 0.0035));
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, F ? 0.0028 : 0.0042, 8), mBrow);
      g.add(tube);
      g.userData.base = g.position.clone();
      this.brows.push({ g, side });
    }
    // mouth decals container
    this.mouthGroup = new THREE.Group(); hg.add(this.mouthGroup);
    this.mLip = mat.std(s.lips, F ? 0.35 : 0.55);
    this.mMouth = mat.std(0x3a0e12, 0.8);
    this.mTeeth = mat.std(0xf6f3ec, 0.35);
    this.mTongue = mat.std(0xc0545a, 0.6);
    for (const m of [this.mLip, this.mMouth, this.mTeeth, this.mTongue]) { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; }
    // cheek blush
    const blush = canvasTex(64, 64, (g2) => { const r = g2.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,110,110,0.5)'); r.addColorStop(1, 'rgba(255,110,110,0)'); g2.fillStyle = r; g2.fillRect(0, 0, 64, 64); });
    for (const side of [1, -1]) {
      const geo2 = this.decalGeo((() => { const sh = new THREE.Shape(); sh.absarc(side * 0.052, -0.034, 0.02, 0, Math.PI * 2); return sh; })(), 0.0008, true);
      const bm = new THREE.Mesh(geo2, new THREE.MeshStandardMaterial({ map: blush, transparent: true, opacity: F ? 0.55 : 0.25, depthWrite: false, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1 }));
      hg.add(bm);
    }

    this.buildHair(s, geo, hg);
    if (s.facial) this.buildFacial(s, geo, hg);
    if (s.headphones) this.buildHeadphones(hg);
  }

  // baked ambient occlusion and skin tint in vertex colors (eye sockets, nose, lips, under the chin)
  paintHead(geo, F) {
    const p = geo.attributes.position, n = geo.attributes.normal;
    const col = new Float32Array(p.count * 3);
    const g = (v, s) => Math.exp(-((v / s) ** 2));
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ny = n.getY(i);
      let ao = 0;
      if (z > 0) {
        for (const sx of [1, -1]) {
          const d = Math.hypot(x - sx * 0.039, (y - 0.006) * 1.15);
          ao += 0.22 * g(d - 0.021, 0.008) + 0.10 * g(d, 0.024);
        }
        ao += 0.10 * g(Math.abs(x) - 0.016, 0.007) * g(y + 0.026, 0.014);
        ao += 0.14 * g(x, 0.011) * g(y + 0.047, 0.005);
        ao += 0.16 * g(x, 0.018) * g(y + 0.084, 0.006);
        ao += 0.06 * g(Math.abs(x) - 0.03, 0.012) * g(y + 0.066, 0.012);
      }
      ao += 0.32 * clamp(-ny - 0.25) * clamp((-y - 0.04) / 0.05);
      let r = 1 - ao, gg = 1 - ao, b = 1 - ao;
      const warm = (z > 0 ? 1 : 0) * (0.5 * g(x, 0.012) * g(y + 0.03, 0.012) + 0.6 * g(Math.abs(x) - 0.055, 0.02) * g(y + 0.03, 0.02));
      gg *= 1 - 0.07 * warm; b *= 1 - 0.09 * warm;
      col.set([r, gg, b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }

  buildFaceSampler(head) {
    const ray = new THREE.Raycaster();
    const N = 48, x0 = -0.105, x1 = 0.105, y0 = -0.135, y1 = 0.11;
    this._fs = { N, x0, x1, y0, y1, p: [], n: [] };
    head.updateMatrixWorld(true);
    const tmp = new THREE.Mesh(head.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    tmp.updateMatrixWorld(true);
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const x = lerp(x0, x1, i / N), y = lerp(y0, y1, j / N);
      ray.set(V(x, y, 0.5), V(0, 0, -1));
      const hit = ray.intersectObject(tmp, false)[0];
      if (hit) { this._fs.p.push(hit.point.clone()); this._fs.n.push(hit.face.normal.clone()); }
      else { this._fs.p.push(V(x, y, 0)); this._fs.n.push(V(0, 0, 1)); }
    }
  }

  faceAt(x, y) {
    const f = this._fs, N = f.N;
    const u = clamp((x - f.x0) / (f.x1 - f.x0)) * N, v = clamp((y - f.y0) / (f.y1 - f.y0)) * N;
    const i = Math.min(N - 1, Math.floor(u)), j = Math.min(N - 1, Math.floor(v));
    const a = u - i, b = v - j;
    const idx = (ii, jj) => jj * (N + 1) + ii;
    const p = V(), n = V();
    for (const [ii, jj, w] of [[i, j, (1 - a) * (1 - b)], [i + 1, j, a * (1 - b)], [i, j + 1, (1 - a) * b], [i + 1, j + 1, a * b]]) {
      p.addScaledVector(f.p[idx(ii, jj)], w); n.addScaledVector(f.n[idx(ii, jj)], w);
    }
    return { p, n: n.normalize() };
  }

  // 2D shape in face coordinates -> geometry lying on the face surface
  decalGeo(shape, off = 0.0006, uv01 = false) {
    const g = new THREE.ShapeGeometry(shape, 12);
    const p = g.attributes.position;
    let bb = null;
    if (uv01) { g.computeBoundingBox(); bb = g.boundingBox; }
    for (let i = 0; i < p.count; i++) {
      const r = this.faceAt(p.getX(i), p.getY(i));
      const q = r.p.addScaledVector(r.n, off);
      if (uv01) g.attributes.uv.setXY(i, (p.getX(i) - bb.min.x) / (bb.max.x - bb.min.x), (p.getY(i) - bb.min.y) / (bb.max.y - bb.min.y));
      p.setXYZ(i, q.x, q.y, q.z);
    }
    g.computeVertexNormals();
    return g;
  }

  buildMouth() {
    const f = this.face;
    const key = [f.smile, f.open, f.pout || 0].map(v => Math.round(v * 40)).join(',');
    if (key === this._mouthKey) return;
    this._mouthKey = key;
    for (const c of [...this.mouthGroup.children]) { c.geometry.dispose(); this.mouthGroup.remove(c); }
    const F = this.s.female;
    const s = clamp(f.smile), o = clamp(f.open);
    const my = -0.067, w = (F ? 0.024 : 0.026) * (1 + 0.22 * s - 0.1 * (f.pout || 0));
    const corner = 0.0065 * s - 0.001;
    const topY = x => my + corner * Math.pow(Math.abs(x) / w, 2) + 0.0012 * (1 - Math.pow(x / w, 2)) * (1 - o);
    const N = 24;
    const xs = Array.from({ length: N + 1 }, (_, i) => lerp(-w, w, i / N));
    if (o < 0.04) {
      // closed: thin lip line + soft lower lip
      const sh = new THREE.Shape();
      xs.forEach((x, i) => { const y = topY(x) + 0.0011; i ? sh.lineTo(x, y) : sh.moveTo(x, y); });
      [...xs].reverse().forEach(x => sh.lineTo(x, topY(x) - 0.0013 - 0.0008 * (1 - Math.pow(x / w, 2))));
      this.mouthGroup.add(new THREE.Mesh(this.decalGeo(sh, 0.0008), this.mMouth));
      const lip = new THREE.Shape();
      const lw = w * 0.78;
      const lx = Array.from({ length: N + 1 }, (_, i) => lerp(-lw, lw, i / N));
      lx.forEach((x, i) => { const y = topY(x) - 0.0016; i ? lip.lineTo(x, y) : lip.moveTo(x, y); });
      [...lx].reverse().forEach(x => lip.lineTo(x, topY(x) - 0.0016 - (F ? 0.0075 : 0.0055) * Math.sqrt(Math.max(0, 1 - Math.pow(x / lw, 2)))));
      this.mouthGroup.add(new THREE.Mesh(this.decalGeo(lip, 0.0006), this.mLip));
      const ul = new THREE.Shape();
      lx.forEach((x, i) => { const y = topY(x) + 0.0014; i ? ul.lineTo(x, y) : ul.moveTo(x, y); });
      [...lx].reverse().forEach(x => ul.lineTo(x, topY(x) + 0.0014 + (F ? 0.0045 : 0.003) * (1 - Math.pow(x / lw, 2)) * (1 - 0.35 * Math.exp(-((x / 0.005) ** 2)))));
      this.mouthGroup.add(new THREE.Mesh(this.decalGeo(ul, 0.0006), this.mLip));
      return;
    }
    // open smile: flat-ish top, round bottom
    const depth = 0.006 + 0.020 * o;
    const botY = x => topY(x) - depth * Math.sqrt(Math.max(0, 1 - Math.pow(x / w, 2))) * (1 - 0.25 * s * Math.pow(x / w, 2));
    const cav = new THREE.Shape();
    xs.forEach((x, i) => (i ? cav.lineTo(x, topY(x)) : cav.moveTo(x, topY(x))));
    [...xs].reverse().forEach(x => cav.lineTo(x, botY(x)));
    this.mouthGroup.add(new THREE.Mesh(this.decalGeo(cav, 0.0007), this.mMouth));
    // upper teeth
    const tw = w * 0.86, th = Math.min(0.0055, depth * 0.45);
    const txs = xs.filter(x => Math.abs(x) <= tw);
    const teeth = new THREE.Shape();
    txs.forEach((x, i) => (i ? teeth.lineTo(x, topY(x) - 0.0004) : teeth.moveTo(x, topY(x) - 0.0004)));
    [...txs].reverse().forEach(x => teeth.lineTo(x, Math.max(botY(x) + 0.0006, topY(x) - th * (1 - 0.5 * Math.pow(x / tw, 4)))));
    this.mouthGroup.add(new THREE.Mesh(this.decalGeo(teeth, 0.0009), this.mTeeth));
    // tongue
    if (o > 0.35) {
      const tg = new THREE.Shape();
      const tW = w * 0.55, ty = my - depth * 0.78;
      tg.absellipse(0, ty, tW, depth * 0.28, 0, Math.PI * 2);
      this.mouthGroup.add(new THREE.Mesh(this.decalGeo(tg, 0.0008), this.mTongue));
    }
    // lips around
    const lip = new THREE.Shape();
    xs.forEach((x, i) => (i ? lip.lineTo(x, botY(x) - 0.0004) : lip.moveTo(x, botY(x) - 0.0004)));
    [...xs].reverse().forEach(x => lip.lineTo(x, botY(x) - 0.0004 - (F ? 0.0055 : 0.0038) * Math.sqrt(Math.max(0, 1 - Math.pow(x / w, 2)))));
    this.mouthGroup.add(new THREE.Mesh(this.decalGeo(lip, 0.0006), this.mLip));
    const ul = new THREE.Shape();
    xs.forEach((x, i) => (i ? ul.lineTo(x, topY(x) + 0.0003) : ul.moveTo(x, topY(x) + 0.0003)));
    [...xs].reverse().forEach(x => ul.lineTo(x, topY(x) + 0.0003 + (F ? 0.0032 : 0.0022) * Math.sqrt(Math.max(0, 1 - Math.pow(x / w, 2)))));
    this.mouthGroup.add(new THREE.Mesh(this.decalGeo(ul, 0.0006), this.mLip));
  }

  // ------------------------------------------------------------------ hair
  buildHair(s, geo, hg) {
    const style = s.hairStyle;
    const hairCol = new THREE.Color(s.hair);
    const rnd = seeded(this.seed + 11);
    const vary = k => () => { const c = hairCol.clone().multiplyScalar(1 + (rnd() - 0.5) * k); return [c.r, c.g, c.b]; };
    const mHair = (extra = {}) => mat.std(0xffffff, 0.62, 0, { vertexColors: true, alphaTest: 0.5, ...extra });
    if (style === 'crop' || style === 'buzz') {
      const crop = style === 'crop';
      const jag = (x, y, z) => 0.05 * Math.sin(Math.atan2(x, z) * 23) + 0.03 * Math.sin(Math.atan2(x, z) * 41 + 1.3);
      const mask = (x, y, z) => { const [az, el] = angles(x, y, z); const fr = crop ? 0.07 * Math.exp(-((az / 0.6) ** 2)) : 0; return smooth((el - hairlineEl(az, 0.40, 0.24, 0.30, 0.05) + fr + (crop ? jag(x, y, z) : 0) + 0.03) / 0.04); };
      const bump = (x, y, z) => { const n = Math.sin(x * 37 + y * 11) * Math.sin(z * 29 - y * 23) * Math.sin(x * 13 + z * 17); return n; };
      const off = (x, y, z, m) => crop ? (0.003 + 0.011 * smooth((y - 0.2) / 0.6) + 0.0035 * bump(x, y, z) + 0.004 * smooth((z - 0.3) / 0.6) * smooth((y - 0.2) / 0.5)) * m + 0.001 : 0.0025;
      const g = shellGeometry(geo, off, mask, vary(0.25));
      const m = mHair({ roughness: crop ? 0.75 : 0.9, bumpMap: strandTex(0x808080, this.seed, 1.4, 0.6), bumpScale: 2 });
      hg.add(new THREE.Mesh(g, m));
      // fade on the sides and back (low, semi-transparent)
      const fmask = (x, y, z) => { const [az, el] = angles(x, y, z); const lo = hairlineEl(az, 0.4, 0.2, -0.05, -0.62); return smooth((el - lo) / 0.05) * (1 - mask(x, y, z)) * (Math.abs(az) > 0.55 ? 1 : 0); };
      const fg = shellGeometry(geo, 0.0012, fmask, () => [hairCol.r * 0.8, hairCol.g * 0.8, hairCol.b * 0.8]);
      const fm = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: crop ? 0.55 : 0.7, depthWrite: false, roughness: 0.95 });
      hg.add(new THREE.Mesh(fg, fm));
      if (false) {   // (tufts disabled)
        const tuft = new THREE.ConeGeometry(0.009, 0.028, 6);
        const im = new THREE.InstancedMesh(tuft, mat.std(s.hair, 0.75), 70);
        const d = new THREE.Object3D();
        for (let i = 0; i < 70; i++) {
          const az = (rnd() - 0.5) * 2.2, el = 0.55 + rnd() * 0.9;
          const dir = V(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
          d.position.set(dir.x * HEAD_R.x * 1.12, dir.y * HEAD_R.y * 1.07 + 0.003, dir.z * HEAD_R.z * 1.1);
          d.quaternion.setFromUnitVectors(V(0, 1, 0), dir.clone().add(V(0, 0.3, 0.55)).normalize());
          d.scale.set(1, 0.7 + rnd() * 0.6, 1);
          d.updateMatrix(); im.setMatrixAt(i, d.matrix);
        }
        hg.add(im);
      }
      return;
    }
    if (style === 'twists') {
      const mask = (x, y, z) => { const [az, el] = angles(x, y, z); return smooth((el - hairlineEl(az, 0.42, 0.26, 0.28, 0.0) + 0.03) / 0.06); };
      hg.add(new THREE.Mesh(shellGeometry(geo, 0.004, mask, vary(0.2)), mHair({ roughness: 0.9 })));
      const fmask = (x, y, z) => { const [az, el] = angles(x, y, z); const lo = hairlineEl(az, 0.42, 0.2, -0.08, -0.62); return smooth((el - lo) / 0.05) * (1 - mask(x, y, z)) * (Math.abs(az) > 0.5 ? 1 : 0); };
      const fm = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false, roughness: 0.95 });
      hg.add(new THREE.Mesh(shellGeometry(geo, 0.0012, fmask, () => [hairCol.r, hairCol.g, hairCol.b]), fm));
      // twists: little spiraled cylinders
      const tw = new THREE.CylinderGeometry(0.0052, 0.0068, 0.042, 8, 6);
      const tp = tw.attributes.position;
      for (let i = 0; i < tp.count; i++) {   // spiral grooves
        const x = tp.getX(i), y = tp.getY(i), z = tp.getZ(i);
        const a = Math.atan2(z, x), k = 1 + 0.18 * Math.sin(a * 2 + y * 260);
        tp.setXYZ(i, x * k, y, z * k);
      }
      tw.computeVertexNormals();
      const n = 380;
      const im = new THREE.InstancedMesh(tw, mat.std(0xffffff, 0.55, 0), n);
      const d = new THREE.Object3D();
      let c = 0;
      while (c < n) {
        const az = (rnd() - 0.5) * 2 * 2.6, el = 0.25 + rnd() * 1.3;
        const dir = V(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
        if (el < hairlineEl(az, 0.47, 0.32, 0.36, 0.08) + 0.04) continue;
        d.position.set(dir.x * HEAD_R.x * 1.06, dir.y * HEAD_R.y * 1.04, dir.z * HEAD_R.z * 1.07);
        const out = dir.clone().add(V((rnd() - .5) * 0.35, 0.18, (rnd() - .5) * 0.35)).normalize();
        d.quaternion.setFromUnitVectors(V(0, 1, 0), out);
        d.position.addScaledVector(out, 0.012);
        d.scale.set(1, 0.85 + rnd() * 0.5, 1);
        d.updateMatrix(); im.setMatrixAt(c, d.matrix);
        im.setColorAt(c, new THREE.Color(0x1d1612).multiplyScalar(0.7 + rnd() * 0.8));
        c++;
      }
      hg.add(im);
      return;
    }
    if (style === 'long') {
      const mask = (x, y, z) => { const [az, el] = angles(x, y, z); const a = Math.abs(az); const thr = a < 1.2 ? lerp(0.62, 0.0, Math.pow(a / 1.2, 0.75)) : lerp(0.0, -0.5, smooth((a - 1.2) / 1.6)); return smooth((el - thr + 0.02) / 0.04); };
      const strands = strandTex(0xd8d8d8, this.seed, 1.12, 0.82);
      const capM = mat.std(0xffffff, 0.45, 0, { vertexColors: true, alphaTest: 0.5, map: strands });
      const g = shellGeometry(geo, (x, y, z) => 0.008 + 0.005 * smooth(y) - 0.006 * Math.exp(-((x / 0.04) ** 2)) * smooth((z - 0.1) / 0.4) * smooth((y - 0.5) / 0.4), mask, (x, y, z) => {
        const part = Math.exp(-((x / 0.05) ** 2)) * smooth((z - 0.2) / 0.5) * smooth((y - 0.55) / 0.3);
        const c = hairCol.clone().multiplyScalar(1 - 0.35 * part); return [c.r, c.g, c.b];
      });
      // spherical uv for the strand texture
      const uv = g.attributes.uv; const dd = g.attributes.dir;
      for (let i = 0; i < uv.count; i++) { const [az] = angles(dd.getX(i), dd.getY(i), dd.getZ(i)); uv.setXY(i, (az / Math.PI) * 2, dd.getY(i)); }
      hg.add(new THREE.Mesh(g, capM));
      // long curtain down the back and sides
      const curtain = (az0, az1, len, flare, startEl = -0.02) => {
        const segU = 40, segV = 26;
        const pos = [], uvs = [], idx = [];
        for (let j = 0; j <= segV; j++) for (let i = 0; i <= segU; i++) {
          const u = i / segU, v = j / segV;
          const az = lerp(az0, az1, u);
          const dir = V(Math.sin(az), 0, Math.cos(az));
          const back = Math.max(0, -Math.cos(az));
          const r0 = 1.07;
          const rr = r0 + flare * smooth(v * 1.4) * (0.6 + 0.6 * back) + 0.02 * Math.sin(u * 37) * v;
          const x = dir.x * HEAD_R.x * rr, z = dir.z * HEAD_R.z * rr - 0.03 * smooth(v * 2) * back;
          const y = Math.sin(startEl) * HEAD_R.y - v * len;
          const taper = 1 - 0.06 * Math.pow(v, 3);
          pos.push(x * taper, y, z * taper); uvs.push(u * 4, 1 - v);
        }
        for (let j = 0; j < segV; j++) for (let i = 0; i < segU; i++) {
          const a = j * (segU + 1) + i, b = a + 1, c = a + segU + 1, d2 = c + 1;
          idx.push(a, c, b, b, c, d2);
        }
        const cg = new THREE.BufferGeometry();
        cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        cg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        cg.setIndex(idx); cg.computeVertexNormals();
        const m = mat.std(s.hair, 0.45, 0, { map: strands, side: THREE.DoubleSide });
        return new THREE.Mesh(cg, m);
      };
      hg.add(curtain(1.5, Math.PI * 2 - 1.5, 0.34, 0.5, 0.12));
      // face-framing front strands
      for (const side of [1, -1]) {
        const a0 = side * 0.95, a1 = side * 1.55;
        hg.add(curtain(Math.min(a0, a1), Math.max(a0, a1), 0.27, 0.32, 0.32));
      }
      return;
    }
    if (style === 'curly') {
      const mask = (x, y, z) => { const [az, el] = angles(x, y, z); return smooth((el - hairlineEl(az, 0.46, 0.25, 0.0, -0.6) + 0.03) / 0.06); };
      hg.add(new THREE.Mesh(shellGeometry(geo, 0.012, mask, vary(0.2)), mHair({ roughness: 0.85 })));
      const curl = new THREE.SphereGeometry(1, 14, 10);
      const cp = curl.attributes.position;
      for (let i = 0; i < cp.count; i++) { const x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i); const k = 1 + 0.12 * Math.sin(x * 9 + y * 7) * Math.sin(z * 8); cp.setXYZ(i, x * k, y * k, z * k); }
      curl.computeVertexNormals();
      const n = 760;
      const im = new THREE.InstancedMesh(curl, mat.std(0xffffff, 0.7, 0, { bumpMap: strandTex(0x808080, this.seed + 5, 1.5, 0.5), bumpScale: 1.5 }), n);
      const d = new THREE.Object3D();
      let c = 0;
      while (c < n) {
        let pos, r;
        if (c < 560) {
          const az = (rnd() - 0.5) * 2 * Math.PI, el = -0.2 + rnd() * 1.75;
          const thr = hairlineEl(az, 0.5, 0.32, 0.05, -0.6);
          if (el < thr) continue;
          const dir = V(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
          const edge = smooth((el - thr) / 0.25);
          const vol = 1.0 + (0.12 + 0.45 * rnd()) * edge * (0.75 + 0.25 * Math.max(0, -Math.cos(az)));
          pos = V(dir.x * HEAD_R.x * vol * 1.08, dir.y * HEAD_R.y * vol, dir.z * HEAD_R.z * vol * 1.05);
          r = (0.011 + 0.016 * rnd()) * (0.6 + 0.4 * edge);
        } else {   // lower volume around the neck, down to the shoulders
          const az = Math.PI + (rnd() - 0.5) * 2 * 2.1, y = -0.02 - rnd() * 0.17;
          if (Math.abs(Math.cos(az)) > 0.2 && Math.cos(az) > 0) continue;
          const rad = 0.105 + rnd() * 0.06 + 0.03 * (1 + y / 0.2);
          pos = V(Math.sin(az) * rad * 1.15, y, Math.cos(az) * rad * 0.95 - 0.015);
          r = 0.013 + 0.017 * rnd();
        }
        d.position.copy(pos); d.rotation.set(rnd() * 6, rnd() * 6, rnd() * 6); d.scale.setScalar(r);
        d.updateMatrix(); im.setMatrixAt(c, d.matrix);
        im.setColorAt(c, hairCol.clone().multiplyScalar(0.7 + rnd() * 0.75));
        c++;
      }
      hg.add(im);
    }
  }

  buildFacial(s, geo, hg) {
    // beard / stubble region on the jaw, avoiding the lips
    const beardMask = (x, y, z, px, py, pz) => {
      const [az, el] = angles(x, y, z);
      const a = Math.abs(az);
      if (a > 1.62) return 0;
      const thr = a > 1.35 ? lerp(-0.15, 0.08, smooth((a - 1.35) / 0.27)) : (a > 0.55 ? lerp(-0.42, -0.15, smooth((a - 0.55) / 0.8)) : lerp(-0.32, -0.42, smooth(a / 0.55)));
      let m = smooth((thr - el + 0.03 * Math.sin(az * 31) * Math.sin(el * 17)) / 0.06);
      const mouth = ((px / 0.034) ** 2 + ((py + 0.068) / 0.0105) ** 2);
      if (pz > 0) m *= smooth((mouth - 1) / 0.4);
      const neckCut = smooth((el + 1.05) / 0.12);
      return m * neckCut;
    };
    if (s.facial === 'beard') {
      const g = shellGeometry(geo, (x, y, z, m) => 0.0022 * m + 0.0004, beardMask, () => { const c = new THREE.Color(0x1c1410); return [c.r, c.g, c.b]; });
      hg.add(new THREE.Mesh(g, mat.std(0xffffff, 0.95, 0, { vertexColors: true, alphaTest: 0.5, bumpMap: strandTex(0x808080, 4, 1.6, 0.4), bumpScale: 2 })));
    } else {
      const g = shellGeometry(geo, 0.0007, (...a) => beardMask(...a) * 0.42, () => { const c = new THREE.Color(s.hair).multiplyScalar(0.7); return [c.r, c.g, c.b]; });
      hg.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, depthWrite: false, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1 })));
    }
  }

  buildHeadphones(hg) {
    const m = mat.std(0x16161a, 0.4, 0.3);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.122, 0.009, 10, 40, Math.PI), m);
    band.position.set(0, 0.0, -0.005); hg.add(band);
    for (const side of [1, -1]) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.03, 28), m);
      cup.rotation.z = Math.PI / 2; cup.position.set(side * 0.118, -0.01, 0); hg.add(cup);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.004, 8, 24), mat.emit(0x6a7bff, 1.2));
      ring.rotation.y = Math.PI / 2; ring.position.set(side * 0.134, -0.01, 0); hg.add(ring);
    }
  }

  // ------------------------------------------------------------------ props
  makePhone() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.074, 0.152, 0.009, 4, 0.004), mat.phys(0x1b1c20, { roughness: 0.3, metalness: 0.5, clearcoat: 1 }));
    g.add(body);
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x223355, toneMapped: false });
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.068, 0.146), screenMat);
    scr.position.z = 0.0047; g.add(scr);
    g.userData.screen = screenMat;
    this.phone = g;
    return g;
  }

  // ------------------------------------------------------------------ pose
  // p: { pos, yaw, hipsY, hipsPitch, spine:{x,y,z}, look, headTurn:{x,y,z}, hands:{L,R}, feet:{L,R}, face:{...}, t }
  pose(p) {
    const t = p.t || 0;
    this.root.position.copy(p.pos || V());
    this.root.rotation.set(0, p.yaw || 0, 0);
    const sc = this.s.scale || 1;
    this.hips.position.y = (p.hipsY !== undefined ? p.hipsY / sc : this.hipH) ;
    this.hips.position.x = (p.hipsX || 0) / sc;
    this.hips.rotation.set(p.hipsPitch || 0, p.hipsYaw || 0, p.hipsRoll || 0);
    const sp = p.spine || {};
    this.spine.rotation.set(sp.x || 0, sp.y || 0, sp.z || 0);
    this.neck.rotation.set(0, 0, 0); this.head.rotation.set(0, 0, 0);
    this.root.updateMatrixWorld(true);

    // head look-at (split between neck and head)
    if (p.look) {
      this.head.lookAt(p.look);
      const q = this.head.quaternion.clone();
      const e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
      e.y = clamp(e.y, -1.25, 1.25); e.x = clamp(e.x, -0.7, 0.6);
      const ht = p.headTurn || {};
      e.x += ht.x || 0; e.y += ht.y || 0; e.z = (ht.z || 0);
      this.neck.rotation.set(e.x * 0.4, e.y * 0.4, e.z * 0.4, 'YXZ');
      this.head.rotation.set(e.x * 0.6, e.y * 0.6, e.z * 0.6, 'YXZ');
    } else if (p.headTurn) {
      const ht = p.headTurn;
      this.neck.rotation.set((ht.x || 0) * 0.4, (ht.y || 0) * 0.4, (ht.z || 0) * 0.4, 'YXZ');
      this.head.rotation.set((ht.x || 0) * 0.6, (ht.y || 0) * 0.6, (ht.z || 0) * 0.6, 'YXZ');
    }
    this.root.updateMatrixWorld(true);

    // arms
    for (const k of ['L', 'R']) {
      const a = this.arm[k];
      const h = p.hands && p.hands[k];
      if (h && h.pos) {
        const pole = h.pole || this.toWorld(V(a.side * 0.5, -0.2, -0.6));
        solveIK(a.sh, a.el, this.L.upper * sc, this.L.fore * sc, h.pos, pole);
      } else {
        a.sh.rotation.set(0.05, 0, a.side * 0.09); a.el.rotation.set(-0.25, 0, 0);
        a.sh.updateMatrixWorld(true);
      }
      // hand orientation
      const fwd = a.el.localToWorld(V(0, -1, 0)).sub(a.el.getWorldPosition(V())).normalize();
      if (h && h.dir) orientBone(a.wr, h.dir, h.palm || V(0, 0, 1));
      else if (h && h.palm) orientBone(a.wr, fwd, h.palm);
      else orientBone(a.wr, fwd, this.toWorldDir(V(-a.side, 0, 0.25)));
      const curl = h && h.curl !== undefined ? h.curl : 0.25;
      const spread = h && h.spread !== undefined ? h.spread : 0.0;
      a.fingers.forEach(([base, mid], i) => {
        base.rotation.set(-curl * 1.25 - 0.08, 0, -a.side * (i - 1.5) * 0.025 * (1 + spread * 5));
        mid.rotation.set(-curl * 1.35 - 0.1, 0, 0);
      });
      const tc = h && h.thumb !== undefined ? h.thumb : curl;
      a.thumb[0].rotation.set(-tc * 0.5, a.side * -tc * 0.4, a.side * (0.75 - tc * 0.35));
      a.thumb[1].rotation.set(-tc * 0.6, 0, 0);
    }
    // legs
    for (const k of ['L', 'R']) {
      const l = this.leg[k];
      const f = p.feet && p.feet[k];
      if (f && f.pos) {
        const pole = f.pole || this.toWorld(V(l.side * 0.1, 0.4, 1.0));
        solveIK(l.th, l.kn, this.L.thigh * sc, this.L.shin * sc, f.pos, pole);
        const ankleDir = f.dir || V(0, -1, 0);
        orientBone(l.an, ankleDir, f.toe || this.toWorldDir(V(0, 0, 1)));
      } else {
        l.th.rotation.set(0, 0, 0); l.kn.rotation.set(0, 0, 0); l.an.rotation.set(0, 0, 0);
      }
    }
    this.root.updateMatrixWorld(true);

    // eyes
    const look = p.eyes || p.look;
    for (const e of this.eyes) {
      if (look) {
        e.ball.lookAt(look);
        const eu = new THREE.Euler().setFromQuaternion(e.ball.quaternion, 'YXZ');
        e.ball.rotation.set(clamp(eu.x, -0.45, 0.45), clamp(eu.y, -0.6, 0.6), 0, 'YXZ');
      } else e.ball.rotation.set(0, 0, 0);
    }
    // face
    const fc = { ...this.face, ...(p.face || {}) };
    const blinkAuto = this.autoBlink(t);
    const blink = Math.max(fc.blink || 0, blinkAuto);
    const sq = clamp((fc.squint || 0) + 0.45 * clamp(fc.smile || 0) * (0.5 + 0.5 * clamp(fc.open || 0)));
    const lookDown = this.eyes[0].ball.rotation.x;
    for (const e of this.eyes) {
      const open = lerp(-0.5 - (fc.browUp || 0) * 0.25 + Math.max(0, lookDown) * 0.6, Math.PI / 2 + 0.02, blink);
      e.upper.rotation.set(open + sq * 0.15, 0, 0);
      e.lower.rotation.set(0.78 - sq * 0.62 * (1 - blink), 0, 0);
    }
    for (const b of this.brows) {
      b.g.position.set(0, (fc.browUp || 0) * 0.007 - sq * 0.0015, 0);
      b.g.rotation.set(0, 0, b.side * (fc.browUp || 0) * 0.04);
    }
    this.face = { smile: fc.smile || 0, open: fc.open || 0, browUp: fc.browUp || 0, pout: fc.pout || 0 };
    this.buildMouth();
  }

  autoBlink(t) {
    const r = seeded(this.seed);
    let tb = r() * 2;
    while (tb < t + 1) {
      const d = t - tb;
      if (d >= 0 && d < 0.16) return Math.sin((d / 0.16) * Math.PI);
      tb += 2.2 + r() * 2.8;
    }
    return 0;
  }

  toWorld(v) { return this.root.localToWorld(v.clone()); }
  toWorldDir(v) { return v.clone().applyQuaternion(this.root.getWorldQuaternion(new THREE.Quaternion())); }
  headWorld() { return this.headGroup.getWorldPosition(V()); }
  shoulderWorld(k) { return this.arm[k].sh.getWorldPosition(V()); }
}
