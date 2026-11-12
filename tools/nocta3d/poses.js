// Pose helpers built on Human.pose(): sitting with a phone, standing, dancing.
import * as THREE from 'three';
import { V, clamp, lerp, smooth, easeInOut, beatPulse, beatPhase, BEAT, DROP } from './lib.js';

const yawQ = yaw => new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw);
const local = (pos, yaw, v) => v.clone().applyQuaternion(yawQ(yaw)).add(pos);

// seated on a seat whose surface center (under the pelvis) is `seat` (world), facing `yaw`.
// o: { lean, phone: 0..1 (1 = holding up, 0 = lowered on the lap), screen: 0..1, look, face, t, hands }
export function sit(h, seat, yaw, o = {}) {
  const sc = h.s.scale || 1;
  const floor = o.floor ?? 0;
  const pos = V(seat.x, floor, seat.z);
  const hipsY = seat.y - floor + 0.085 * sc;
  const lean = o.lean ?? 0.12;
  const phoneUp = o.phone ?? 1;
  const L = (x, y, z) => local(pos, yaw, V(x, y, z));
  const feet = {
    L: { pos: L(0.13 * sc, 0.075, 0.44 * sc + (o.footFwd || 0)), pole: L(0.2, 1.2, 2.5) },
    R: { pos: L(-0.13 * sc, 0.075, 0.42 * sc + (o.footFwd || 0)), pole: L(-0.2, 1.2, 2.5) },
  };
  let twist = o.twist || 0;
  if (o.look && !o.phoneObj || (o.look && (o.phone ?? 1) < 0.6)) {
    const d = o.look.clone().sub(pos).applyQuaternion(yawQ(-yaw));
    twist += clamp(Math.atan2(d.x, d.z) * 0.4, -0.55, 0.55);
  }
  const p = { pos, yaw, hipsY, hipsPitch: -0.12, spine: { x: lean, y: twist, z: o.roll || 0 }, feet, t: o.t, face: o.face, look: o.look, eyes: o.eyes, headTurn: o.headTurn };
  // phone: from chest height (looking at it) down to the lap
  if (o.phoneObj) {
    const ph = o.phoneObj;
    const up = L(0, hipsY + 0.30 * sc, 0.30 * sc), down = L(0, hipsY + 0.08 * sc, 0.30 * sc);
    ph.position.copy(down.clone().lerp(up, phoneUp));
    h.pose({ ...p, hands: null });   // to know where the head is
    const head = h.headWorld();
    const tilt = lerp(0.9, 0, phoneUp);
    const look = head.clone().lerp(L(0, hipsY - 0.4, 1.2), tilt * 0.6);
    ph.lookAt(look);
    const pq = ph.quaternion;
    const side = (x, y, z) => V(x, y, z).applyQuaternion(pq).add(ph.position);
    const dirU = V(0, 1, 0).applyQuaternion(pq), nrm = V(0, 0, 1).applyQuaternion(pq);
    const hand = (sx) => ({
      pos: side(sx * 0.052, -0.045, -0.018), dir: dirU.clone().multiplyScalar(0.6).add(V(-sx, 0, 0).applyQuaternion(pq)).normalize(),
      palm: nrm, curl: 0.55, thumb: 0.15, pole: L(sx * 0.6, hipsY - 0.1, -0.3),
    });
    p.hands = { L: hand(1), R: hand(-1) };
    if (o.hands) Object.assign(p.hands, o.hands);
    if (o.phoneObj.userData.screen) {
      const k = o.screen ?? 0.35;
      o.phoneObj.userData.screen.color.setRGB(0.25 * k + 0.05, 0.35 * k + 0.06, 0.6 * k + 0.1);
    }
  } else if (o.hands) p.hands = o.hands;
  else {
    p.hands = {
      L: { pos: L(0.12 * sc, hipsY + 0.02, 0.3 * sc), palm: L(0, -1, 0).sub(L(0, 0, 0)), curl: 0.35, pole: L(0.5, hipsY, -0.2) },
      R: { pos: L(-0.12 * sc, hipsY + 0.02, 0.3 * sc), palm: L(0, -1, 0).sub(L(0, 0, 0)), curl: 0.35, pole: L(-0.5, hipsY, -0.2) },
    };
  }
  h.pose(p);
}

// expressive helpers -------------------------------------------------------------------------
// irregular laugh: jaw 'ha-ha' pulses, returns { open, shake }
export function laugh(t, seed = 0, k = 1) {
  const r = (x) => Math.sin(x * 12.9898 + seed * 78.233) * 43758.5453 % 1;
  const ph = t * 7.5 + seed;
  const pulse = Math.pow(Math.abs(Math.sin(ph)), 1.5) * (0.75 + 0.25 * Math.sin(t * 1.3 + seed));
  return { open: k * (0.28 + 0.42 * pulse), shake: k * 0.03 * Math.sin(ph * 2) };
}
// talking jaw (syllables)
export function talk(t, seed = 0, k = 1) {
  const v = Math.abs(Math.sin(t * 11 + seed) * Math.sin(t * 4.3 + seed * 2));
  return k * (0.05 + 0.3 * v);
}

// standing / dancing. o: { energy 0..1, arms: 'groove' | 'up' | 'pump' | 'hug', hugL/hugR: world targets, t, look, face, phase }
export function dance(h, pos, yaw, o = {}) {
  const t = o.t || 0, sc = h.s.scale || 1, e = o.energy ?? 1;
  const tp = t + (o.phase || 0);
  const ph = beatPhase(tp);
  const bounce = Math.abs(Math.sin(Math.PI * ph));          // knees: down on every beat
  const half = Math.sin((tp / BEAT) * Math.PI);              // alternates every beat
  const L = (x, y, z) => local(pos, yaw, V(x, y, z));
  const hipsY = h.hipH * sc - 0.045 * e - 0.045 * e * (1 - bounce);
  const sway = Math.sin((tp / BEAT) * Math.PI * 0.5) * e;    // two-beat hip sway
  const feet = {
    L: { pos: L(0.13 * sc + 0.015 * sway, 0.075, 0.05 + 0.03 * Math.max(0, sway)), pole: L(0.35, 0.6, 2) },
    R: { pos: L(-0.13 * sc + 0.015 * sway, 0.075, -0.01 + 0.03 * Math.max(0, -sway)), pole: L(-0.35, 0.6, 2) },
  };
  const hy = hipsY;
  const shH = hy + 0.42 * sc;
  const hands = {};
  const arms = o.arms || 'groove';
  for (const [k, sx] of [['L', 1], ['R', -1]]) {
    const own = sx > 0 ? half : -half;
    if (arms === 'up') {                                      // hands up, elbows bent, small fist pumps
      const pump = 0.06 * Math.max(0, own) * e;
      hands[k] = { pos: L(sx * (0.27 + 0.04 * Math.sin(t * 1.9 + sx)), shH + (0.43 + pump) * sc, 0.1 + 0.04 * Math.sin(t * 1.4 + sx * 2)), pole: L(sx * 1.4, shH + 0.1, -0.2), palm: L(0, 0.2, 1).sub(L(0, 0, 0)), curl: 0.55 + 0.3 * Math.max(0, own), thumb: 0.5, spread: 0.2 };
    } else if (arms === 'pump') {                             // one arm pumping the air on the beat
      const up = sx > 0;
      hands[k] = up
        ? { pos: L(0.24, shH + (0.36 + 0.12 * bounce) * sc, 0.16), pole: L(1.3, shH - 0.1, -0.3), curl: 0.85, thumb: 0.6 }
        : { pos: L(-0.2, hy + 0.2 + 0.06 * own, 0.22), pole: L(-0.9, hy, -0.5), curl: 0.7 };
    } else if (arms === 'hug' && o['hug' + k]) {
      hands[k] = { pos: o['hug' + k], pole: L(sx * 0.4, shH + 0.45, -0.7), palm: V(0, -1, 0), curl: 0.55, thumb: 0.4 };
    } else {                                                   // groove: elbows bent ~90deg, forearms swinging with the beat
      hands[k] = { pos: L(sx * (0.21 + 0.03 * own), hy + 0.24 + 0.09 * e * Math.max(0, own), 0.22 + 0.05 * own * e), pole: L(sx * 0.9, hy - 0.1, -0.7), curl: 0.7, thumb: 0.5 };
    }
    if (o.hands && o.hands[k]) hands[k] = o.hands[k];
  }
  const sh = o.shake || 0;
  h.pose({
    pos, yaw, hipsY: hy, hipsYaw: 0.1 * sway, hipsRoll: 0.04 * sway,
    spine: { x: 0.05 + 0.06 * bounce * e + (o.lean || 0) + sh, y: -0.14 * sway, z: -0.05 * sway + 0.03 * half * e + (o.roll || 0) },
    feet, hands, t, look: o.look, eyes: o.eyes, face: o.face,
    headTurn: o.headTurn || { x: 0.07 * bounce * e - 2 * sh, y: 0.04 * half * e, z: 0.07 * sway },
  });
}
