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

// standing / dancing. o: { energy 0..1, arms: 'down' | 'up' | 'wave' | 'hug', hugL/hugR: world shoulder targets, t, look, face, phase }
export function dance(h, pos, yaw, o = {}) {
  const t = o.t || 0, sc = h.s.scale || 1, e = o.energy ?? 1;
  const ph = beatPhase(t + (o.phase || 0));
  const bounce = Math.abs(Math.sin(Math.PI * ph));
  const L = (x, y, z) => local(pos, yaw, V(x, y, z));
  const hipsY = h.hipH * sc - 0.035 * e - 0.03 * e * (1 - bounce);
  const sway = Math.sin(((t + (o.phase || 0)) / BEAT) * Math.PI * 0.5) * e;
  const feet = {
    L: { pos: L(0.12 * sc, 0.075, 0.03 + 0.02 * sway), pole: L(0.3, 0.6, 2) },
    R: { pos: L(-0.12 * sc, 0.075, -0.02 - 0.02 * sway), pole: L(-0.3, 0.6, 2) },
  };
  const hy = hipsY;
  const shH = hy + 0.45 * sc;
  const hands = {};
  const arms = o.arms || 'down';
  for (const [k, sx] of [['L', 1], ['R', -1]]) {
    if (arms === 'up') {
      const lift = 0.62 + 0.05 * bounce + 0.04 * Math.sin(t * 3 + sx);
      hands[k] = { pos: L(sx * (0.2 + 0.06 * Math.sin(t * 2.1 + sx)), shH + lift * sc, 0.06 + 0.05 * Math.sin(t * 1.7 + sx * 2)), pole: L(sx * 1.2, shH, -0.3), palm: L(0, 0, 1).sub(L(0, 0, 0)), curl: 0.25, spread: 0.6 };
    } else if (arms === 'wave') {
      const up = sx > 0 ? 1 : 0.2;
      hands[k] = { pos: L(sx * (0.25 + 0.05 * Math.sin(t * 4)), shH + (0.15 + 0.45 * up) * sc + 0.05 * bounce, 0.18), pole: L(sx * 1.2, shH - 0.3, -0.4), curl: 0.3 };
    } else if (arms === 'hug' && o['hug' + k]) {
      const tgt = o['hug' + k];
      hands[k] = { pos: tgt, pole: L(sx * 0.3, shH + 0.4, -0.6), palm: V(0, -1, 0), curl: 0.6 };
    } else if (arms === 'mic') {   // singing along: one hand to the chest, one up
      hands[k] = sx > 0
        ? { pos: L(0.22, shH + (0.5 + 0.08 * bounce) * sc, 0.12), pole: L(1, shH, -0.3), curl: 0.6 }
        : { pos: L(-0.05, shH - 0.12, 0.2), pole: L(-1, shH - 0.3, -0.2), curl: 0.7 };
    } else {
      const sw = Math.sin(((t + (o.phase || 0)) / BEAT) * Math.PI + (sx > 0 ? 0 : Math.PI));
      hands[k] = { pos: L(sx * 0.24, hy + 0.12 + 0.12 * e * Math.max(0, sw), 0.16 + 0.05 * sw * e), pole: L(sx * 0.8, hy, -0.6), curl: 0.6 };
    }
    if (o.hands && o.hands[k]) hands[k] = o.hands[k];
  }
  h.pose({
    pos, yaw, hipsY: hy, hipsYaw: 0.08 * sway, hipsRoll: 0.03 * sway,
    spine: { x: 0.04 + 0.05 * bounce * e + (o.lean || 0), y: -0.12 * sway, z: -0.04 * sway + (o.roll || 0) },
    feet, hands, t, look: o.look, eyes: o.eyes, face: o.face, headTurn: o.headTurn || { x: 0.05 * bounce * e, z: 0.06 * sway },
  });
}
