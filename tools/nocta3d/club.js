// NOCTA club interior: packed dance floor, stage with the DJ booth and an LED wall, truss with
// moving-head beams, laser fans, haze, strobes, confetti, and the raised VIP booth right of the DJ.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { V, seeded, canvasTex, mat, glowTex, beatPulse, beatPhase, BEAT, DROP, bar, clamp, lerp, lathe } from './lib.js';
import { CLUB } from './city.js';
import { Crowd } from './crowd.js';

export function buildClubInterior(scene) {
  const g = new THREE.Group();
  const { x, front, back, w, h } = CLUB;
  const zStage = back - 6;
  const black = mat.std(0x0a0a0e, 0.6, 0.2);
  // floor (glossy), walls, ceiling (inside faces)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w - 1.2, back - front - 1), new THREE.MeshStandardMaterial({ color: 0x0c0c12, roughness: 0.22, metalness: 0.6 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(x, 0.02, (front + back) / 2); g.add(floor);
  const room = new THREE.Mesh(new THREE.BoxGeometry(w - 1.3, h - 0.4, back - front - 1.0), new THREE.MeshStandardMaterial({ color: 0x07070b, roughness: 0.8, side: THREE.BackSide }));
  room.position.set(x, (h - 0.4) / 2, (front + back) / 2); g.add(room);
  // stage
  const stage = new THREE.Mesh(new RoundedBoxGeometry(22, 1.2, 7, 2, 0.05), black); stage.position.set(x, 0.6, back - 3.6); g.add(stage);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(22, 0.05, 0.05), mat.emit(0x6a5aff, 4)); edge.position.set(x, 1.18, back - 7.1); g.add(edge);
  // LED wall (animated canvas)
  const ledTex = canvasTex(640, 256, () => {});
  const led = new THREE.Mesh(new THREE.PlaneGeometry(26, 10.4), new THREE.MeshBasicMaterial({ map: ledTex, toneMapped: false }));
  led.position.set(x, 1.2 + 5.2, back - 0.9); led.rotation.y = Math.PI; g.add(led);
  // side LED columns
  const cols = [];
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.4, 8, 0.4), mat.emit(i % 2 ? 0x3a6bff : 0xa040ff, 2));
    c.position.set(x + sx * (14.5 + i * 3), 4, back - 2 - i * 9); g.add(c); cols.push(c);
  }
  // DJ booth
  const booth = new THREE.Group(); booth.position.set(x, 1.2, zStage + 1.0); g.add(booth);
  const desk = new THREE.Mesh(new RoundedBoxGeometry(3.4, 1.05, 1.0, 2, 0.05), black); desk.position.y = 0.525; booth.add(desk);
  const boothTex = canvasTex(512, 160, () => {});
  const front2 = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 0.95), new THREE.MeshBasicMaterial({ map: boothTex, toneMapped: false }));
  front2.position.set(0, 0.525, -0.505); front2.rotation.y = Math.PI; booth.add(front2);
  const gear = mat.std(0x16161a, 0.35, 0.5);
  for (const gx of [-1.05, 0, 1.05]) {
    const u = new THREE.Mesh(new RoundedBoxGeometry(gx === 0 ? 0.8 : 0.7, 0.08, 0.6, 2, 0.02), gear); u.position.set(gx, 1.09, 0.02); booth.add(u);
    for (let k = 0; k < (gx === 0 ? 12 : 3); k++) {
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(gx === 0 ? 0.02 : 0.16, gx === 0 ? 0.02 : 0.16, 0.02, 16), gx === 0 ? mat.emit(k % 3 ? 0x40a0ff : 0xff40c0, 2.5) : mat.std(0x2a2a30, 0.3, 0.8));
      knob.position.set(gx + (gx === 0 ? ((k % 4) - 1.5) * 0.15 : 0), 1.14, gx === 0 ? -0.15 + Math.floor(k / 4) * 0.13 : 0.02); booth.add(knob);
      if (gx !== 0) break;
    }
  }
  // truss + moving heads with beams
  const trussM = mat.std(0x2a2a30, 0.4, 0.9);
  const truss = new THREE.Mesh(new THREE.BoxGeometry(30, 0.3, 0.3), trussM); truss.position.set(x, 10.5, zStage - 2); g.add(truss);
  const truss2 = truss.clone(); truss2.position.set(x, 10.5, front + 10); g.add(truss2);
  const beamTex = canvasTex(64, 256, (c, w2, h2) => { const gr = c.createLinearGradient(0, 0, 0, h2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, w2, h2); const gx = c.createLinearGradient(0, 0, w2, 0); gx.addColorStop(0, 'rgba(0,0,0,1)'); gx.addColorStop(0.5, 'rgba(0,0,0,0)'); gx.addColorStop(1, 'rgba(0,0,0,1)'); c.globalCompositeOperation = 'destination-out'; c.fillStyle = gx; c.fillRect(0, 0, w2, h2); });
  const beams = [];
  const beamG = new THREE.CylinderGeometry(0.06, 1.5, 16, 24, 1, true); beamG.translate(0, -8, 0);
  for (const tz of [zStage - 2, front + 10]) for (let i = 0; i < 8; i++) {
    const col = [0x4a7bff, 0xb050ff, 0xffffff, 0xff4fd0][i % 4];
    const head = new THREE.Group(); head.position.set(x - 13 + i * (26 / 7), 10.2, tz); g.add(head);
    const b = new THREE.Mesh(beamG, new THREE.MeshBasicMaterial({ map: beamTex, color: new THREE.Color(col).multiplyScalar(0.35), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    head.add(b);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.14, 16), mat.emit(col, 5)); lens.position.y = -0.05; lens.rotation.x = Math.PI / 2; head.add(lens);
    beams.push({ head, b, i, tz, col });
  }
  // lasers
  const laserG = new THREE.CylinderGeometry(0.012, 0.012, 60, 6, 1, true); laserG.translate(0, -30, 0);
  const laserGlowG = new THREE.CylinderGeometry(0.08, 0.08, 60, 8, 1, true); laserGlowG.translate(0, -30, 0);
  const lasers = [];
  for (const [lx, ly, lz, col] of [[x - 9, 9.5, zStage - 1, 0x3060ff], [x + 9, 9.5, zStage - 1, 0x9a40ff], [x, 11, zStage + 1, 0x2a8bff], [x - 16, 6, front + 14, 0xa040ff], [x + 16, 6, front + 14, 0x4060ff]]) {
    const em = new THREE.Group(); em.position.set(lx, ly, lz); g.add(em);
    const fan = [];
    for (let k = 0; k < 7; k++) {
      const l = new THREE.Mesh(laserG, mat.add(col, 6, 0.9));
      const gl = new THREE.Mesh(laserGlowG, mat.add(col, 1.2, 0.18));
      const piv = new THREE.Group(); piv.add(l, gl); em.add(piv); fan.push(piv);
    }
    lasers.push({ em, fan, col });
  }
  // haze sheets
  const hazeTex = canvasTex(256, 256, (c, w2, h2) => { const r = seeded(4); for (let i = 0; i < 70; i++) { const gr = c.createRadialGradient(r() * w2, r() * h2, 0, r() * w2, r() * h2, 30 + r() * 70); gr.addColorStop(0, 'rgba(255,255,255,0.10)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, w2, h2); } });
  const hazes = [];
  for (let i = 0; i < 4; i++) {
    const hz = new THREE.Mesh(new THREE.PlaneGeometry(50, 12), new THREE.MeshBasicMaterial({ map: hazeTex, color: new THREE.Color(0x6a50ff).multiplyScalar(0.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    hz.position.set(x, 4 + i * 1.2, front + 6 + i * 7); hz.rotation.y = Math.PI; g.add(hz); hazes.push(hz);
  }
  // crowd on the dance floor
  const r = seeded(17);
  const spots = [];
  for (let i = 0; i < 300; i++) {
    const px = x - 15 + r() * 30, pz = front + 3 + r() * (zStage - 2.5 - front - 3);
    if (px < x - 8 && pz > zStage - 9) continue;                          // keep clear under the VIP booth
    spots.push({ pos: V(px, 0, pz), yaw: Math.PI + (r() - 0.5) * 0.8 });
  }
  const crowd = new Crowd(spots, { mode: 'club', seed: 9 });
  g.add(crowd.group);
  // VIP booth (raised, right of the DJ seen from the floor = -X side)
  const vip = new THREE.Group(); vip.position.set(x - 12.5, 0, zStage - 5.5); g.add(vip);
  const plat = new THREE.Mesh(new RoundedBoxGeometry(8, 1.4, 6, 2, 0.05), black); plat.position.y = 0.7; vip.add(plat);
  const ledEdge = new THREE.Mesh(new THREE.BoxGeometry(8, 0.05, 0.05), mat.emit(0xff3fd0, 4)); ledEdge.position.set(0, 1.38, -3.0); vip.add(ledEdge);
  const ledEdge2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 6), mat.emit(0xff3fd0, 4)); ledEdge2.position.set(4, 1.38, 0); vip.add(ledEdge2);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(8, 0.9, 0.04), mat.phys(0x9ab0ff, { transparent: true, opacity: 0.12, roughness: 0.05, depthWrite: false })); rail.position.set(0, 1.85, -2.95); vip.add(rail);
  const railTop = new THREE.Mesh(new THREE.BoxGeometry(8, 0.05, 0.08), mat.std(0xe0ae52, 0.3, 1)); railTop.position.set(0, 2.3, -2.95); vip.add(railTop);
  const rail2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.9, 6), rail.material); rail2.position.set(3.97, 1.85, 0); vip.add(rail2);
  const sofaM = mat.phys(0x2a1030, { roughness: 0.4, sheen: 0.6, sheenColor: new THREE.Color(0xff60c0) });
  const sofa = new THREE.Mesh(new RoundedBoxGeometry(6, 0.5, 0.9, 3, 0.15), sofaM); sofa.position.set(0, 1.65, 2.4); vip.add(sofa);
  const sback = new THREE.Mesh(new RoundedBoxGeometry(6, 0.8, 0.3, 3, 0.12), sofaM); sback.position.set(0, 2.1, 2.8); vip.add(sback);
  const vtable = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.06, 0.8, 2, 0.02), mat.phys(0x111114, { roughness: 0.1, clearcoat: 1 })); vtable.position.set(0, 1.85, 1.2); vip.add(vtable);
  const bucket = new THREE.Mesh(lathe([[0.001, 0], [0.12, 0], [0.15, 0.25], [0.001, 0.25]], 20), mat.std(0xd8d8de, 0.2, 1)); bucket.position.set(0.3, 1.88, 1.2); vip.add(bucket);
  const sparks = [];
  for (const [bx, bz] of [[0.25, 1.15], [0.38, 1.25]]) {
    const b = new THREE.Mesh(lathe([[0.001, 0], [0.04, 0], [0.04, 0.22], [0.015, 0.3], [0.015, 0.36]], 16), mat.phys(0x0c2a14, { roughness: 0.1, clearcoat: 1 })); b.position.set(bx, 1.95, bz); vip.add(b);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(0xffd9a0).multiplyScalar(3), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    sp.position.set(bx, 2.4, bz); sp.scale.set(0.35, 0.5, 1); vip.add(sp); sparks.push(sp);
  }
  const vipLight = new THREE.PointLight(0xff4fd0, 16, 12, 2); vipLight.position.set(0, 4.2, 0.5); vip.add(vipLight);
  const vipKey = new THREE.PointLight(0x6a8bff, 18, 12, 2); vipKey.position.set(2.5, 3.2, -2.5); vip.add(vipKey);
  const vipFace = new THREE.PointLight(0xe8e0ff, 14, 9, 2); vipFace.position.set(-1.2, 3.6, 0); vip.add(vipFace);
  // club lights
  const lights = [];
  for (const [lx, ly, lz, col, k] of [[x, 8, zStage - 4, 0x6a5aff, 140], [x - 10, 6, front + 8, 0xff3fd0, 80], [x + 10, 6, front + 8, 0x3a6bff, 80], [x, 3, zStage + 3.5, 0xffffff, 30]]) {
    const l = new THREE.PointLight(col, k, 40, 2); l.position.set(lx, ly, lz); g.add(l); lights.push(l);
  }
  const strobe = new THREE.PointLight(0xffffff, 0, 60, 1.5); strobe.position.set(x, 9, (front + zStage) / 2); g.add(strobe);
  // confetti
  const NC = 900;
  const conf = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.06, 0.09), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.4, metalness: 0.6, emissive: new THREE.Color(0x222222) }), NC);
  conf.frustumCulled = false;
  const cr = seeded(33), confP = [];
  const pal = [0xffd36a, 0xffffff, 0xb070ff, 0x6a9bff, 0xff6ad0];
  for (let i = 0; i < NC; i++) { confP.push([x - 14 + cr() * 28, zStage - 18 + cr() * 18, cr(), cr() * 6, 0.6 + cr() * 0.8]); conf.setColorAt(i, new THREE.Color(pal[i % 5])); }
  g.add(conf);
  scene.add(g);
  return { group: g, crowd, ledTex, boothTex, beams, lasers, hazes, lights, strobe, conf, confP, vip, sparks, cols, zStage, boothPos: V(x, 1.2, zStage + 1.0) };
}

function drawLED(tex, t, drop) {
  const c = tex.userData.canvas, g = c.getContext('2d'), w = c.width, h = c.height;
  g.fillStyle = '#04030a'; g.fillRect(0, 0, w, h);
  const p = beatPulse(t, DROP, 5);
  const n = 32;
  for (let i = 0; i < n; i++) {
    const v = 0.3 + 0.7 * Math.abs(Math.sin(i * 0.7 + t * 3.1)) * (0.6 + 0.4 * p);
    const hue = (200 + i * 4 + t * 20) % 360;
    g.fillStyle = `hsla(${hue},90%,${45 + 20 * p}%,0.9)`;
    const bw = w / n;
    g.fillRect(i * bw + 2, h - v * h, bw - 4, v * h);
  }
  // tunnel rings
  g.strokeStyle = `rgba(160,120,255,${0.25 + 0.5 * p})`; g.lineWidth = 3;
  for (let k = 0; k < 6; k++) { const rr = ((t * 60 + k * 40) % 240); g.beginPath(); g.ellipse(w / 2, h / 2, rr * 1.4, rr * 0.55, 0, 0, Math.PI * 2); g.stroke(); }
  if (drop > 0) {
    g.fillStyle = `rgba(255,255,255,${drop})`; g.font = 'bold 120px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = '#ff40d0'; g.shadowBlur = 30; g.fillText('NOCTA', w / 2, h / 2); g.shadowBlur = 0;
  }
  tex.needsUpdate = true;
}

function drawBooth(tex, t) {
  const c = tex.userData.canvas, g = c.getContext('2d'), w = c.width, h = c.height;
  g.fillStyle = '#05040a'; g.fillRect(0, 0, w, h);
  const p = beatPulse(t, DROP, 5);
  for (let i = 0; i < 48; i++) {
    const v = Math.abs(Math.sin(i * 0.9 + t * 4)) * (0.5 + 0.5 * p);
    g.fillStyle = i % 2 ? '#3a6bff' : '#b040ff';
    g.fillRect(i * (w / 48) + 1, h - v * h * 0.8, w / 48 - 2, v * h * 0.8);
  }
  g.fillStyle = '#ffffff'; g.font = 'bold 64px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = '#ff40d0'; g.shadowBlur = 20; g.fillText('NOCTA', w / 2, h / 2); g.shadowBlur = 0;
  tex.needsUpdate = true;
}

// animate the club at time t; djDrop = time of the big drop (DJ hands up, confetti)
export function updateClub(C, t, djDrop) {
  const dropK = clamp((t - djDrop) / 0.15);
  const after = t - djDrop;
  const pulse = beatPulse(t, DROP, 6);
  drawLED(C.ledTex, t, dropK * Math.exp(-Math.max(0, after) / 2.5));
  drawBooth(C.boothTex, t);
  // crowd: hands go up on the drop
  const hype = after > 0 ? 1 : clamp(0.45 + 0.3 * Math.sin(t * 0.7));
  C.crowd.update(t, hype);
  // moving heads sweep
  for (const b of C.beams) {
    const a = t * 0.9 + b.i * 0.7;
    b.head.rotation.set(0.35 * Math.sin(a) + (b.tz > 0 ? 0.25 : -0.25), 0, 0.5 * Math.sin(a * 0.7 + b.i));
    b.b.material.opacity = 0.55 + 0.45 * pulse;
  }
  // laser fans
  C.lasers.forEach((L, li) => {
    const base = (li % 2 ? -1 : 1) * 0.6 * Math.sin(t * 0.8 + li);
    L.fan.forEach((pv, k) => {
      const spread = (k - 3) * 0.16 * (1 + 0.5 * Math.sin(t * 1.3));
      pv.rotation.set(0.9 + 0.25 * Math.sin(t * 1.1 + li) + (li > 2 ? 0.3 : 0), 0, base + spread);
      pv.visible = (Math.floor((t - DROP) / (BEAT / 2)) + k + li) % 5 !== 0 || after > 0;
    });
  });
  for (const hz of C.hazes) hz.material.opacity = 0.8 + 0.2 * Math.sin(t + hz.position.z);
  // strobes: on off-beats after the DJ drop, and a fast burst just before it
  const sp = beatPhase(t, DROP);
  let s = 0;
  if (after > 0) s = sp < 0.12 ? 1 : 0;
  if (after > -0.9 && after < 0) s = (Math.floor(t * 16) % 2) * 0.6;
  C.strobe.intensity = s * 400;
  C.lights[0].intensity = 140 * (0.7 + 0.6 * pulse);
  // confetti
  const conf = C.conf, d = new THREE.Object3D();
  for (let i = 0; i < C.confP.length; i++) {
    const [cx, cz, cr, rot, sp2] = C.confP[i];
    const tt = after - cr * 0.6;
    if (tt < 0) { d.position.set(0, -50, 0); }
    else {
      const y = 11 + 3 * cr - tt * (1.1 + sp2 * 0.6) + (tt < 0.4 ? 6 * tt : 2.4);
      d.position.set(cx + Math.sin(tt * 2 + rot) * 0.6, Math.max(y, 0.05), cz + Math.cos(tt * 1.7 + rot) * 0.6);
      d.rotation.set(tt * 5 + rot, tt * 3 + rot * 2, tt * 4);
    }
    d.updateMatrix(); conf.setMatrixAt(i, d.matrix);
  }
  conf.instanceMatrix.needsUpdate = true;
  for (const spk of C.sparks) { const f = 0.7 + 0.3 * Math.sin(t * 40 + spk.position.x * 9); spk.scale.set(0.35 * f, 0.55 * f, 1); }
  C.cols.forEach((c, i) => { c.material.color.setScalar(1); c.material.color.set(i % 2 ? 0x3a6bff : 0xa040ff).multiplyScalar(1 + 2.5 * pulse); });
}
