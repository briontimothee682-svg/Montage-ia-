// Instanced crowd: hundreds of simplified dancers (torso, head, hair, legs, two-part arms with hands),
// each with its own outfit colours, skin tone, height and dance phase.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { V, seeded, beatPhase, clamp, lerp, mat } from './lib.js';

const SKINS = [0xf1c3a7, 0xe2ad8a, 0xc68d68, 0xb47a52, 0x8d5a3b, 0x6a3f27, 0x4a2a1a];
const HAIRS = [0x120d0b, 0x2a1810, 0x4a2e1a, 0x6b4a2a, 0xd9c49a, 0xf0e4c6, 0x1a1a1a, 0x7a2a1a];
const TOPS = [0x111114, 0xf2f2f2, 0x2a2a6a, 0x6e1626, 0x1d3a2e, 0x3a2a55, 0xc9b9a2, 0x101030, 0x8a8a92, 0xd04a7a, 0x222];
const PANTS = [0x1c1d22, 0x2b2d33, 0x34465e, 0x111114, 0x5a5048];

function capsule(r, len, segs = 10) { const g = new THREE.CapsuleGeometry(r, len, 4, segs); return g; }

export class Crowd {
  // spots: [{ pos: Vector3, yaw }]; opts: { mode: 'club' | 'queue', seed }
  constructor(spots, opts = {}) {
    this.spots = spots; this.mode = opts.mode || 'club';
    const n = spots.length; this.n = n;
    const r = seeded(opts.seed || 4);
    this.group = new THREE.Group();
    const torsoG = capsule(0.16, 0.36, 12); torsoG.scale(1, 1, 0.7);
    const headG = new THREE.SphereGeometry(0.105, 16, 12); headG.scale(0.92, 1.08, 1);
    const hairG = new THREE.SphereGeometry(0.115, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55); hairG.translate(0, 0.012, -0.01);
    const legL = capsule(0.068, 0.72, 8); legL.translate(0.09, -0.36, 0);
    const legR = legL.clone(); legR.translate(-0.18, 0, 0);
    const legsG = mergeGeometries([legL, legR]);
    const upperG = capsule(0.05, 0.24, 8); upperG.translate(0, -0.12, 0);
    const foreG = capsule(0.042, 0.22, 8); foreG.translate(0, -0.11, 0);
    const handG = new THREE.SphereGeometry(0.048, 10, 8); handG.scale(0.8, 1.15, 0.5);
    const M = (g, m) => { const im = new THREE.InstancedMesh(g, m, n * (g === upperG || g === foreG || g === handG ? 2 : 1)); im.castShadow = false; im.receiveShadow = false; im.frustumCulled = false; this.group.add(im); return im; };
    const cloth = mat.std(0xffffff, 0.8), skin = mat.std(0xffffff, 0.55), hair = mat.std(0xffffff, 0.7);
    this.torso = M(torsoG, cloth); this.head = M(headG, skin); this.hair = M(hairG, hair);
    this.legs = M(legsG, mat.std(0xffffff, 0.85));
    this.upper = M(upperG, cloth); this.fore = M(foreG, skin); this.hands = M(handG, skin);
    this.p = [];
    for (let i = 0; i < n; i++) {
      const top = new THREE.Color(TOPS[Math.floor(r() * TOPS.length)]);
      const sk = new THREE.Color(SKINS[Math.floor(r() * SKINS.length)]);
      const hc = new THREE.Color(HAIRS[Math.floor(r() * HAIRS.length)]);
      const pc = new THREE.Color(PANTS[Math.floor(r() * PANTS.length)]);
      const female = r() < 0.5;
      this.torso.setColorAt(i, top); this.head.setColorAt(i, sk); this.hair.setColorAt(i, hc); this.legs.setColorAt(i, pc);
      for (const k of [0, 1]) { this.upper.setColorAt(i * 2 + k, female && r() < 0.6 ? sk : top); this.fore.setColorAt(i * 2 + k, sk); this.hands.setColorAt(i * 2 + k, sk); }
      this.p.push({
        h: (female ? 0.93 : 1.0) * (0.95 + r() * 0.1), phase: r(), energy: 0.6 + r() * 0.4,
        arms: r() < 0.55 ? 'up' : (r() < 0.6 ? 'wave' : 'down'), phone: this.mode === 'queue' && r() < 0.3, longHair: female && r() < 0.7, sw: r() * 6,
      });
    }
    this.dummy = new THREE.Object3D();
    this.m = new THREE.Matrix4(); this.m2 = new THREE.Matrix4();
  }

  // hype: 0..1 (all hands up at 1), t: seconds
  update(t, hype = 0.5) {
    const d = this.dummy, M = this.m;
    const root = new THREE.Matrix4(), part = new THREE.Matrix4(), tmp = new THREE.Matrix4();
    const q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < this.n; i++) {
      const s = this.spots[i], P = this.p[i];
      const club = this.mode === 'club';
      const ph = club ? beatPhase(t + P.phase * 0.2) : 0;
      const bounce = club ? Math.abs(Math.sin(Math.PI * ph)) * P.energy : 0.15 * Math.sin(t * 1.3 + P.sw);
      const yawWob = club ? 0.25 * Math.sin(t * 1.1 + P.sw) : 0.1 * Math.sin(t * 0.5 + P.sw);
      root.compose(V(s.pos.x, s.pos.y + 0.06 * bounce, s.pos.z), q.setFromEuler(e.set(0, s.yaw + yawWob, 0)), V(P.h, P.h, P.h));
      const set = (im, idx, pos, rot, scl = V(1, 1, 1)) => {
        part.compose(pos, q.setFromEuler(e.set(rot.x, rot.y, rot.z)), scl);
        tmp.multiplyMatrices(root, part); im.setMatrixAt(idx, tmp);
      };
      set(this.legs, i, V(0, 0.86, 0), V(0, 0, 0));
      const lean = club ? 0.08 * bounce : 0;
      set(this.torso, i, V(0, 1.16, 0), V(lean, 0, 0.05 * Math.sin(t * 2 + P.sw) * (club ? 1 : 0)));
      set(this.head, i, V(0, 1.6 + 0.02 * bounce, 0.02 + lean * 0.3), V(club ? 0.15 * bounce - 0.1 : 0.05, club ? 0.2 * Math.sin(t * 0.9 + P.sw) : 0.3 * Math.sin(t * 0.3 + P.sw), 0));
      set(this.hair, i, V(0, 1.6 + 0.02 * bounce, 0.02 + lean * 0.3), V(club ? 0.15 * bounce - 0.1 : 0.05, 0, 0), P.longHair ? V(1.05, 1.5, 1.05) : V(1, 1, 1));
      // arms
      const up = club ? clamp(hype * 1.4 - (P.arms === 'down' ? 0.6 : 0) + (P.arms === 'up' ? 0.3 : 0)) : 0;
      for (const [k, sx] of [[0, 1], [1, -1]]) {
        const idx = i * 2 + k;
        let a1, a2, fwd;
        if (club && (P.arms === 'wave' && sx < 0)) { a1 = lerp(0.4, 2.6, up); a2 = 0.6 + 0.3 * Math.sin(t * 6 + P.sw); fwd = 0.3; }
        else if (club) { a1 = lerp(0.25 + 0.25 * bounce, 2.75 + 0.1 * Math.sin(t * 3 + P.sw + sx), up); a2 = lerp(1.2, 0.25, up); fwd = lerp(-0.6, 0.15, up); }
        else if (P.phone && sx < 0) { a1 = 0.25; a2 = 1.5; fwd = -0.9; }
        else { a1 = 0.12; a2 = 0.25; fwd = -0.05; }
        const sh = V(sx * 0.2, 1.43, 0);
        part.compose(sh, q.setFromEuler(e.set(fwd * (1 - up) - 0.1 * up, 0, sx * a1, 'XYZ')), V(1, 1, 1));
        const shoulderW = new THREE.Matrix4().multiplyMatrices(root, part);
        this.upper.setMatrixAt(idx, shoulderW);
        part.compose(V(0, -0.24, 0), q.setFromEuler(e.set(-a2 * (club ? 0.6 : 1), 0, sx * a2 * (club ? 0.4 : 0))), V(1, 1, 1));
        const elbowW = new THREE.Matrix4().multiplyMatrices(shoulderW, part);
        this.fore.setMatrixAt(idx, elbowW);
        part.compose(V(0, -0.25, 0), q.identity(), V(1, 1, 1));
        this.hands.setMatrixAt(idx, tmp.multiplyMatrices(elbowW, part));
      }
    }
    for (const im of [this.torso, this.head, this.hair, this.legs, this.upper, this.fore, this.hands]) im.instanceMatrix.needsUpdate = true;
  }
}
