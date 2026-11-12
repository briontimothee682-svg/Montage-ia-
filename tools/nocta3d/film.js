// The NOCTA film: builds the whole world once and stages every shot (camera, characters, lights).
import * as THREE from 'three';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { V, clamp, lerp, smooth, prog, keys, easeInOut, easeOut, easeIn, seeded, glowTex, mat, canvasTex, beatPulse, beatPhase, bar, BEAT, DROP } from './lib.js';
import { Human } from './human.js';
import { sit, dance, laugh, talk } from './poses.js';
import { buildSky, nightEnvironment, buildMountains, buildLakefront, updateStreaks, buildTown, buildApartmentBuilding, buildClubExterior, CLUB, APT } from './city.js';
import { buildApartment } from './apartment.js';
import { Golf, CAR } from './car.js';
import { buildClubInterior, updateClub } from './club.js';
import { Crowd } from './crowd.js';

export const SHOTS = {
  '01': [0.0, 6.0], '02': [6.0, 11.0], '03a': [11.0, bar(1)], '03b': [bar(1), bar(2)], '04': [bar(2), bar(5)],
  '05': [bar(5), bar(7)], '06': [bar(7), bar(9.5)], '07': [bar(9.5), bar(13.5)], '08': [bar(13.5), 41.0],
};
const NOTIF = 2.5, DJ_DROP = bar(13), GLASS = DROP;
const LANE_Z = -42.6;

// car kinematics: constant 25 m/s, then a smooth stop in front of the club
const V0 = 25, T_BRAKE = 26.0, BRAKE = 2.6;
const X_STOP = CLUB.x;
const X0 = X_STOP - V0 * (T_BRAKE - 13.34) - V0 * BRAKE / 2;
export function carX(t) {
  if (t < T_BRAKE) return X0 + V0 * (t - 13.34);
  const tau = Math.min(t - T_BRAKE, BRAKE);
  return X0 + V0 * (T_BRAKE - 13.34) + V0 * tau - (V0 / (2 * BRAKE)) * tau * tau;
}
const carZ = t => lerp(LANE_Z, -41.0, smooth((t - T_BRAKE) / BRAKE));
const carYaw = t => Math.PI / 2 - 0.12 * Math.sin(Math.PI * clamp((t - T_BRAKE - 0.3) / 1.6)) ;

export class Film {
  async build(renderer) {
    const scene = this.scene = new THREE.Scene();
    this.renderer = renderer;
    this.env = nightEnvironment(renderer);
    scene.environment = this.env;
    // font for the club sign
    const ttf = await new Promise((res, rej) => new TTFLoader().load('/assets/fonts/TiltNeon-Regular.ttf', res, undefined, rej));
    const font = { font: new Font(ttf), TextGeometry };
    this.sky = buildSky(scene);
    this.mountains = buildMountains(scene);
    this.lake = buildLakefront(scene);
    this.town = buildTown(scene);
    this.aptBuilding = buildApartmentBuilding(scene);
    this.apt = buildApartment(scene);
    this.clubExt = buildClubExterior(scene, font);
    this.club = buildClubInterior(scene);
    this.car = new Golf(); scene.add(this.car.root);
    this.moon = new THREE.DirectionalLight(0x8095ff, 0.35); this.moon.position.set(400, 600, -900); scene.add(this.moon);
    this.ambient = new THREE.HemisphereLight(0x3a4a8a, 0x120c08, 0.25); scene.add(this.ambient);
    // cast
    this.cast = {};
    for (const n of ['lucas', 'malik', 'chloe', 'ines']) { const h = new Human(n); scene.add(h.root); this.cast[n] = h; h.phoneObj = h.makePhone(); scene.add(h.phoneObj); }
    this.dj = new Human('dj'); scene.add(this.dj.root);
    this.bouncers = [new Human('bouncer'), new Human('bouncer', { skin: 0xc68d68, hairStyle: 'buzz', facial: 'stubble', hair: 0x2a1a10 })];
    for (const b of this.bouncers) scene.add(b.root);
    // queue outside the club
    const qr = seeded(55), qs = [];
    for (let i = 0; i < 24; i++) qs.push({ pos: V(CLUB.x - 3.4 - i * 0.85 - qr() * 0.3, 0, CLUB.front - 1.3 - qr() * 0.5), yaw: Math.PI / 2 + (qr() - 0.5) * 1.6 });
    this.queue = new Crowd(qs, { mode: 'queue', seed: 21 });
    scene.add(this.queue.group);
    // phone lights + notification holograms
    this.phoneFx = Object.values(this.cast).map(h => {
      const l = new THREE.PointLight(0xbcd6ff, 0, 1.6, 2); scene.add(l);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(0xbfdcff), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
      glow.scale.set(0.35, 0.35, 1); scene.add(glow);
      const card = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.07), new THREE.MeshBasicMaterial({ map: holoTex(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
      scene.add(card);
      return { h, l, glow, card };
    });
    this.screenTexDim = phoneScreen(false); this.screenTexLit = phoneScreen(true);
    for (const h of Object.values(this.cast)) { h.phoneObj.userData.screen.map = this.screenTexDim; h.phoneObj.userData.screen.needsUpdate = true; }
    this.groups = {
      apt: [this.apt.group], aptExt: [this.aptBuilding], city: [this.town, this.lake.group, this.mountains],
      clubExt: [this.clubExt.group, this.queue.group, ...this.bouncers.map(b => b.root)], clubInt: [this.club.group, this.dj.root], car: [this.car.root],
    };
    this.allLights = [];
    scene.traverse(o => { if (o.isLight) this.allLights.push(o); });
  }

  show(names) {
    for (const [k, arr] of Object.entries(this.groups)) for (const o of arr) o.visible = names.includes(k);
  }

  // which lights are active per shot (keeps the per-fragment light count low)
  lightsFor(keep) {
    for (const l of this.allLights) l.visible = keep(l);
  }

  // ------------------------------------------------------------------ apartment shots
  seatAll(t, o = {}) {
    const S = this.apt.seats, C = this.cast;
    const order = ['lucas', 'malik', 'chloe', 'ines'];
    for (const n of order) {
      const h = C[n];
      const st = S[n];
      const ox = o[n] || {};
      sit(h, st[0], st[1], { t, phoneObj: h.phoneObj, floor: APT.floor, ...ox });
    }
  }

  apartment(t, shot, cam) {
    this.show(['apt', 'aptExt', 'city']);
    for (const h of Object.values(this.cast)) { h.root.visible = true; h.phoneObj.visible = true; h.headGroup.visible = true; }
    this.lightsFor(l => this.apt.group.children.includes(l) || l === this.moon || this.phoneFx.some(p => p.l === l));
    this.scene.fog = new THREE.FogExp2(0x0b1230, 0.0012);
    this.scene.environmentIntensity = 0.45;
    const C = this.cast, S = this.apt.seats;
    const heads = Object.fromEntries(Object.entries(C).map(([k, h]) => [k, h.headWorld()]));
    const notif = clamp((t - NOTIF) / 0.12);
    const surprise = Math.exp(-Math.max(0, t - NOTIF - 0.15) / 0.6) * (t > NOTIF + 0.1 ? 1 : 0);
    const o = {};
    if (shot === '01') {
      for (const n of Object.keys(C)) {
        const lift = smooth((t - NOTIF - 0.1) / 0.4) * 0.3;
        const sd = n.length * 1.7;
        const read = t > NOTIF + 0.6 ? 0.04 * Math.sin(t * 2.2 + sd) : 0;
        const grin = smooth((t - 3.3 - (n.length % 3) * 0.25) / 0.9);
        o[n] = { phone: 1, screen: 0.35 + 0.65 * notif, lean: 0.16 - 0.06 * lift, face: { smile: 0.05 + 0.55 * grin, browUp: 0.75 * surprise + 0.2 * grin, open: 0.18 * surprise + 0.12 * grin * Math.abs(Math.sin(t * 3 + sd)) }, look: C[n].phoneObj.position, headTurn: { x: -0.05 * lift + read, y: 0.05 * Math.sin(t * 0.8 + sd) } };
      }
    } else {
      // 02: the looks, one after another, then everyone smiles at each other
      const pairs = [['lucas', 'malik', 6.25], ['malik', 'chloe', 7.05], ['chloe', 'ines', 7.85], ['ines', 'lucas', 8.65]];
      for (const n of Object.keys(C)) {
        const lower = smooth((t - 6.0) / 0.7);
        let look = C[n].phoneObj.position.clone(), smile = 0.25, open = 0.0;
        const mine = pairs.find(p => p[0] === n), seen = pairs.find(p => p[1] === n);
        if (t > 6.15) look = heads[n === 'lucas' ? 'ines' : n].clone();
        if (mine && t > mine[2]) { look = heads[mine[1]]; smile = 0.35 + 0.6 * smooth((t - mine[2] - 0.15) / 0.5); open = 0.25 * smooth((t - mine[2] - 0.35) / 0.5); }
        if (seen && t > seen[2] + 0.1 && t < seen[2] + 0.75) look = heads[seen[0]];
        let nod = 0, roll = 0;
        if (mine && t > mine[2] && t < mine[2] + 0.9) { nod = 0.08 * Math.sin((t - mine[2]) * 9) * Math.exp(-(t - mine[2]) * 2); roll = 0.06 * smooth((t - mine[2]) / 0.4); }
        if (t > 9.4) { const others = Object.keys(C).filter(k => k !== n); look = heads[others[Math.floor((t * 0.8 + n.length) % 3)]]; smile = 1; const lg = laugh(t, n.length, smooth((t - 9.4) / 0.4)); open = lg.open; nod = -lg.shake * 2; }
        else if (mine && t > mine[2] + 0.5) open = Math.max(open, talk(t, n.length, 0.7));
        o[n] = { phone: 1 - lower, screen: 1 - 0.6 * lower, lean: lerp(0.16, 0.04, lower), look, face: { smile, open, browUp: 0.3 * smooth((t - 9.4) / 0.4) + (mine && t > mine[2] && t < mine[2] + 0.8 ? 0.5 : 0) }, headTurn: { x: nod, z: roll * (n.length % 2 ? 1 : -1) } };
      }
    }
    this.seatAll(t, o);
    // phones: screens, lights, holograms
    for (const p of this.phoneFx) {
      const ph = p.h.phoneObj;
      const k = shot === '01' ? notif : clamp(1 - (t - 6.0) / 0.8);
      ph.userData.screen.map = k > 0.5 ? this.screenTexLit : this.screenTexDim;
      ph.userData.screen.color.setScalar(0.42 + 0.28 * k);
      const n = V(0, 0, 1).applyQuaternion(ph.quaternion);
      p.l.position.copy(ph.position).addScaledVector(n, 0.26);
      p.l.intensity = 0.06 + 0.14 * k;
      p.glow.position.copy(ph.position).addScaledVector(n, 0.02);
      p.glow.material.opacity = 0; p.glow.visible = false;
      const rise = clamp((t - NOTIF) / 0.7);
      p.card.position.copy(ph.position).add(V(0, 0.09 + 0.16 * easeOut(rise), 0)).addScaledVector(n, 0.03);
      p.card.lookAt(cam.position);
      p.card.material.opacity = shot === '01' ? 0.55 * smooth(rise * 3) * (1 - smooth((t - 5.2) / 0.6)) : 0;
    }
  }

  // ------------------------------------------------------------------ car helpers
  placeCar(t, withCast = true) {
    const x = carX(t), z = carZ(t), yaw = carYaw(t);
    this.car.update(V(x, 0, z), yaw, x - X0, t);
    this.car.drawCluster(t < T_BRAKE ? 92 + 3 * Math.sin(t * 2) : 92 * (1 - clamp((t - T_BRAKE) / BRAKE)), t);
    this.car.root.updateMatrixWorld(true);
    // passengers
    const L = v => this.car.root.localToWorld(v.clone());
    const yawW = yaw;
    const C = this.cast;
    if (!withCast) return { x, z, yaw };
    const seatsCar = { lucas: [V(0.37, 0.44, 0.04)], malik: [V(-0.37, 0.44, -0.08)], chloe: [V(0.35, 0.47, -1.0)], ines: [V(-0.35, 0.47, -1.0)] };
    for (const [n, [p]] of Object.entries(seatsCar)) {
      const h = C[n]; h.root.visible = true; h.phoneObj.visible = false;
      const seat = L(p);
      const o = { t, lean: -0.22, footFwd: n === 'lucas' || n === 'malik' ? 0.38 : -0.02, floor: L(V(0, 0.37, 0)).y };
      if (n === 'lucas') {
        const sw = this.car.steer;
        sw.rotation.z = 0.05 * Math.sin(t * 0.55) + 0.02 * Math.sin(t * 1.7);
        sw.updateMatrixWorld(true);
        const tap = beatPulse(t, DROP, 10);
        const swo = sw.getWorldPosition(V());
        const sdir = v => sw.localToWorld(v.clone()).sub(swo).normalize();
        const grip = (sx, lift) => {
          const a = Math.atan2(0.42, sx * 0.9);
          const R = 0.185, rim = V(Math.cos(a) * R, Math.sin(a) * R, 0);
          const radial = V(Math.cos(a), Math.sin(a), 0);
          const dir = sdir(radial.clone().multiplyScalar(0.75).add(V(0, 0, 0.66)));
          const palm = sdir(V(0, 0, 1).add(radial.clone().multiplyScalar(-0.35)));
          const pos = sw.localToWorld(rim.clone().addScaledVector(radial, -0.045).add(V(0, 0, -0.028 - 0.012 * lift)));
          return { pos, dir, palm, curl: 0.95 - 0.55 * lift, thumb: 0.75, pole: L(V(sx * 0.75, 0.55, -0.35)) };
        };
        o.hands = { L: grip(1, 0), R: grip(-1, tap) };
        o.look = L(V(0.37 + 0.6 * Math.sin(t * 0.4), 1.1, 20));
        o.face = { smile: 0.55 + 0.2 * Math.sin(t * 0.7), open: talk(t, 3, 0.35) * (Math.sin(t * 0.9) > 0.3 ? 1 : 0) };
        o.twist = 0.03 * Math.sin(t * 0.6);
      } else {
        const b2 = beatPulse(t, DROP, 5), hb = Math.sin((t - DROP) / BEAT * Math.PI);
        const up = n === 'malik' ? 0.22 + 0.06 * b2 : 0.05 * b2;
        o.hands = { L: { pos: L(V(p.x + 0.17, 0.78 + up * (n === 'malik' ? 1 : 0.3) + 0.03 * hb, p.z + 0.28)), curl: 0.7, pole: L(V(p.x + 0.8, 0.6, p.z - 0.3)) }, R: { pos: L(V(p.x - 0.15, 0.78 + 0.02 * hb, p.z + 0.25)), curl: 0.6, pole: L(V(p.x - 0.8, 0.6, p.z - 0.3)) } };
        o.look = n === 'malik' ? (Math.sin(t * 0.8) > 0 ? L(V(0.37, 1.2, 0.1)) : L(V(-0.5, 1.1, 8))) : L(V(0, 1.1, 5));
        o.face = { smile: 0.9, open: n === 'malik' ? talk(t, 5, 0.8) : laugh(t, n.length, 0.5).open };
        o.headTurn = { x: 0.07 * b2, z: 0.05 * hb };
        o.roll = 0.04 * hb;
      }
      sit(h, seat, yawW, o);
    }
    return { x, z, yaw };
  }

  driverEye(t) {
    const h = this.cast.lucas;
    return h.headGroup.localToWorld(V(0, 0.04, -0.06));
  }

  // ------------------------------------------------------------------ club helpers
  stageClub(t) {
    const C = this.club;
    updateClub(C, t, DJ_DROP);
    // DJ
    const bp = C.boothPos;
    const up = smooth((t - DJ_DROP + 0.1) / 0.25) * (1 - smooth((t - DJ_DROP - 1.6) / 0.4));
    const ph = beatPhase(t);
    const mix = (k, sx) => ({ pos: V(bp.x + sx * (0.45 + 0.1 * Math.sin(t * 2 + sx)), bp.y + 1.16 + 0.03 * Math.abs(Math.sin(Math.PI * ph)), bp.z + 0.05), pole: V(bp.x + sx * 1.4, bp.y + 1.0, bp.z + 1.5), curl: 0.5, palm: V(0, -1, 0) });
    dance(this.dj, V(bp.x, bp.y, bp.z + 0.78), Math.PI, {
      t, energy: 1, arms: up > 0.5 ? 'up' : 'groove', lean: up > 0.5 ? -0.05 : 0.18,
      hands: up > 0.5 ? null : { L: mix('L', -1), R: mix('R', 1) },
      look: up > 0.5 ? V(bp.x, 9, bp.z - 8) : V(bp.x, bp.y + 1.0, bp.z - 0.2), face: { smile: 0.7 + 0.3 * up, open: 0.6 * up },
    });
    // bouncers, arms crossed
    this.bouncers.forEach((b, i) => {
      const sx = i ? 1 : -1;
      const pos = V(CLUB.x + sx * 2.6, 0, CLUB.front - 1.4);
      const L = v => v.clone().applyAxisAngle(V(0, 1, 0), Math.PI).add(pos);
      dance(b, pos, Math.PI, { t, energy: 0, arms: 'groove', hands: {
        L: { pos: L(V(-0.12, 1.25, 0.24)), pole: L(V(0.9, 1.1, -0.2)), curl: 0.7, palm: L(V(0, 0, -1)).sub(pos) },
        R: { pos: L(V(0.12, 1.2, 0.27)), pole: L(V(-0.9, 1.1, -0.2)), curl: 0.7, palm: L(V(0, 0, -1)).sub(pos) },
      }, look: V(CLUB.x + sx * 3, 1.6, CLUB.front - 20), face: { smile: 0.1 } });
    });
    this.queue.update(t, 0);
  }

  vipDance(t) {
    const vip = this.club.vip; vip.updateMatrixWorld(true);
    const L = v => vip.localToWorld(v.clone());
    const names = ['malik', 'chloe', 'lucas', 'ines'];
    const zs = [-0.86, -0.3, 0.3, 0.86];
    const yaw = -Math.PI / 2 + 0.0;
    const C = this.cast;
    for (const h of Object.values(C)) { h.root.visible = true; h.phoneObj.visible = false; h.headGroup.visible = true; }
    // first pass to get shoulder positions
    const pos = names.map((n, i) => L(V(2.2 - (i % 2 ? 0.08 : 0), 1.4, zs[i])));
    names.forEach((n, i) => dance(C[n], pos[i], yaw + (i < 2 ? 0.15 : -0.15), { t, energy: 0.8, arms: 'groove', phase: i * 0.07 }));
    const sh = n => ({ L: C[n].shoulderWorld('L'), R: C[n].shoulderWorld('R') });
    const S = Object.fromEntries(names.map(n => [n, sh(n)]));
    const heads = Object.fromEntries(names.map(n => [n, C[n].headWorld()]));
    const lg = k => laugh(t, k * 1.9, 1);
    const laughF = k => ({ smile: 1, open: lg(k).open, browUp: 0.25 + 0.15 * Math.sin(t * 2 + k) });
    const lookCam = this.camera.position;
    const free = (x, z, sx, k) => {
      const b = Math.abs(Math.sin(Math.PI * beatPhase(t + k * 0.05)));
      return { pos: L(V(x + 0.05, 1.4 + 1.62 + 0.07 * b + 0.03 * Math.sin(t * 2.3 + k), z)), pole: L(V(x + 0.3, 1.4 + 1.5, z + sx * 0.9)), curl: 0.45 + 0.35 * b, thumb: 0.5, spread: 0.25 };
    };
    const cfg = {
      malik: { arms: 'hug', hugL: S.chloe.L.clone().add(V(0, 0.05, 0)), hands: { R: free(1.95, -1.15, -1, 0) }, look: t % 2.4 < 1.2 ? heads.chloe : lookCam, face: laughF(0), shake: lg(0).shake },
      chloe: { arms: 'hug', hugR: S.malik.R.clone().add(V(0, 0.04, 0)), hands: { L: free(1.97, -0.08, 1, 1) }, look: t % 2.0 < 0.9 ? heads.malik : lookCam, face: laughF(1), shake: lg(1).shake },
      lucas: { arms: 'hug', hugL: S.ines.L.clone().add(V(0, 0.05, 0)), hands: { R: free(1.97, 0.1, -1, 2) }, look: t % 2.2 < 1.1 ? heads.ines : lookCam, face: laughF(2), shake: lg(2).shake },
      ines: { arms: 'hug', hugR: S.lucas.R.clone().add(V(0, 0.04, 0)), hands: { L: free(1.95, 1.15, 1, 3) }, look: t % 1.8 < 0.8 ? heads.lucas : lookCam, face: laughF(3), shake: lg(3).shake },
    };
    names.forEach((n, i) => dance(C[n], pos[i], yaw + (i < 2 ? 0.15 : -0.15), { t, energy: 0.85, phase: i * 0.07, ...cfg[n] }));
  }
}

function holoTex() {
  return canvasTex(256, 112, (g, w, h) => {
    const r = (x, y, ww, hh, rad) => { g.beginPath(); g.moveTo(x + rad, y); g.arcTo(x + ww, y, x + ww, y + hh, rad); g.arcTo(x + ww, y + hh, x, y + hh, rad); g.arcTo(x, y + hh, x, y, rad); g.arcTo(x, y, x + ww, y, rad); g.closePath(); };
    g.fillStyle = 'rgba(150,190,255,0.35)'; r(6, 6, w - 12, h - 12, 22); g.fill();
    g.strokeStyle = 'rgba(220,235,255,0.95)'; g.lineWidth = 4; r(6, 6, w - 12, h - 12, 22); g.stroke();
    g.fillStyle = 'rgba(200,120,255,0.95)'; r(20, 26, 56, 56, 14); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.9)'; for (const [y, ww] of [[34, 130], [56, 150], [74, 100]]) { r(92, y, ww, 10, 5); g.fill(); }
  });
}

function phoneScreen(lit) {
  return canvasTex(128, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, lit ? '#3a4a9a' : '#141a3a'); gr.addColorStop(1, lit ? '#7a3aa0' : '#20102a');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = 'bold 26px sans-serif'; g.textAlign = 'center'; g.fillText('22:47', w / 2, 52);
    if (lit) {
      g.fillStyle = 'rgba(255,255,255,0.92)'; g.beginPath(); g.roundRect(10, 80, w - 20, 54, 12); g.fill();
      g.fillStyle = '#a040ff'; g.beginPath(); g.roundRect(18, 90, 32, 32, 8); g.fill();
      g.fillStyle = 'rgba(40,40,60,0.8)'; g.fillRect(58, 94, 54, 7); g.fillRect(58, 108, 44, 7);
    } else {
      for (let i = 0; i < 12; i++) { g.fillStyle = `hsla(${i * 30},60%,60%,0.7)`; g.beginPath(); g.roundRect(14 + (i % 4) * 27, 90 + Math.floor(i / 4) * 30, 20, 20, 5); g.fill(); }
    }
  });
}
