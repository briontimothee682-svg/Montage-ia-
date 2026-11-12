// The living room: floor-to-ceiling window over Annecy, dark grey sofa, two armchairs, oak coffee
// table on a thick beige rug, unlabeled bottles, beer bottles, glasses, spread playing cards, lamps.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { V, seeded, canvasTex, mat, lathe, glowTex } from './lib.js';
import { APT } from './city.js';

export function buildApartment(scene) {
  const g = new THREE.Group();
  const F = APT.floor, z0 = APT.z;               // room centre
  const W = 9, D = 7.2, Hh = 3.4;
  const zWin = z0 - 3.2, zBack = zWin + D;
  const rr = seeded(8);
  // walls / floor / ceiling
  const wood = canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#6b4a32'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) {
      const y = i * 32; c.fillStyle = `rgba(${i % 2 ? '0,0,0' : '255,220,180'},${0.05 + rr() * 0.05})`; c.fillRect(0, y, w, 32);
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, y, w, 1.5);
      for (let k = 0; k < 40; k++) { c.strokeStyle = `rgba(40,20,10,${0.08 + rr() * 0.1})`; c.beginPath(); const yy = y + rr() * 32; c.moveTo(rr() * w, yy); c.lineTo(rr() * w, yy + (rr() - 0.5) * 3); c.stroke(); }
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(rr() * w, y, 1.5, 32);
    }
  }, { repeat: [3, 4] });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.55, metalness: 0.0, envMapIntensity: 0.15 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, F + 0.001, z0 + 0.4); floor.receiveShadow = true; g.add(floor);
  const wallM = mat.std(0xb9b0a6, 0.9);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat.std(0x2c2926, 0.95)); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, F + Hh, z0 + 0.4); g.add(ceil);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(W, Hh), wallM); back.position.set(0, F + Hh / 2, zBack); back.rotation.y = Math.PI; back.receiveShadow = true; g.add(back);
  for (const sx of [1, -1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(D, Hh), wallM); side.position.set(sx * W / 2, F + Hh / 2, z0 + 0.4); side.rotation.y = -sx * Math.PI / 2; side.receiveShadow = true; g.add(side);
  }
  // window: frames + glass
  const frameM = mat.std(0x16171b, 0.4, 0.6);
  for (let i = 0; i <= 6; i++) {
    const mx = -W / 2 + i * (W / 6);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.07, Hh, 0.1), frameM); m.position.set(mx, F + Hh / 2, zWin); g.add(m);
  }
  for (const y of [0.04, Hh - 0.05]) { const m = new THREE.Mesh(new THREE.BoxGeometry(W, 0.1, 0.12), frameM); m.position.set(0, F + y, zWin); g.add(m); }
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(W, Hh), mat.phys(0x8aa0c0, { transparent: true, opacity: 0.09, roughness: 0.02, metalness: 0.3, envMapIntensity: 2.2, depthWrite: false }));
  glass.position.set(0, F + Hh / 2, zWin + 0.01); g.add(glass);
  // curtains on the sides
  const curtainM = mat.std(0xcfc4b4, 0.95, 0, { side: THREE.DoubleSide });
  for (const sx of [1, -1]) {
    const cg = new THREE.PlaneGeometry(0.9, Hh - 0.1, 24, 1);
    const p = cg.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, 0.05 * Math.sin(p.getX(i) * 22));
    cg.computeVertexNormals();
    const c = new THREE.Mesh(cg, curtainM); c.position.set(sx * (W / 2 - 0.5), F + Hh / 2, zWin + 0.25); g.add(c);
  }
  // rug (thick, soft)
  const rugTex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#cbb79a'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) { c.fillStyle = `rgba(${rr() < 0.5 ? '255,250,240' : '90,70,50'},${0.05 + rr() * 0.08})`; c.fillRect(rr() * w, rr() * h, 2, 2); }
    c.strokeStyle = 'rgba(120,95,70,0.35)'; c.lineWidth = 6; c.strokeRect(14, 14, w - 28, h - 28);
  }, { repeat: [2, 2] });
  const rug = new THREE.Mesh(new RoundedBoxGeometry(3.4, 0.035, 2.7, 3, 0.015), new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1, bumpMap: rugTex, bumpScale: 2 }));
  rug.position.set(0, F + 0.018, z0 - 0.75); rug.receiveShadow = true; g.add(rug);

  // sofa (dark grey) with its back to the window
  const fabric = new THREE.MeshStandardMaterial({ color: 0x3a3c42, roughness: 0.95, bumpMap: rugTex, bumpScale: 0.6 });
  const sofa = new THREE.Group(); sofa.position.set(0, F, z0 - 2.15); g.add(sofa);
  const sb = (w, h, d, x, y, z, m = fabric) => { const b = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, Math.min(w, h, d) * 0.3), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; sofa.add(b); return b; };
  sb(2.5, 0.28, 0.95, 0, 0.2, 0);
  sb(1.18, 0.16, 0.72, -0.6, 0.42, 0.09); sb(1.18, 0.16, 0.72, 0.6, 0.42, 0.09);
  sb(2.5, 0.52, 0.24, 0, 0.62, -0.36);
  sb(0.95, 0.4, 0.2, -0.62, 0.66, -0.2).rotation.x = -0.18; sb(0.95, 0.4, 0.2, 0.62, 0.66, -0.2).rotation.x = -0.18;
  sb(0.22, 0.58, 0.95, -1.35, 0.33, 0); sb(0.22, 0.58, 0.95, 1.35, 0.33, 0);
  sb(0.4, 0.35, 0.12, -1.0, 0.62, -0.12, mat.std(0x8a6a4a, 0.95)).rotation.z = 0.2;
  // armchairs (warm boucle), Lucas left (-X), Inès right (+X), facing the table
  const boucle = new THREE.MeshStandardMaterial({ color: 0xc9b9a2, roughness: 1, bumpMap: rugTex, bumpScale: 1.5 });
  const chairs = [];
  for (const sx of [-1, 1]) {
    const ch = new THREE.Group(); ch.position.set(sx * 1.12, F, z0 - 0.45); ch.rotation.y = -sx * (Math.PI / 2 - 0.35); g.add(ch);
    const cb = (w, h, d, x, y, z) => { const b = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, Math.min(w, h, d) * 0.35), boucle); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; ch.add(b); };
    cb(0.9, 0.28, 0.85, 0, 0.22, 0); cb(0.7, 0.14, 0.62, 0, 0.42, 0.06); cb(0.9, 0.55, 0.22, 0, 0.62, -0.33); cb(0.2, 0.5, 0.85, -0.38, 0.4, 0); cb(0.2, 0.5, 0.85, 0.38, 0.4, 0);
    chairs.push(ch);
  }
  // coffee table (oak)
  const oak = new THREE.MeshStandardMaterial({ map: wood, color: 0xd9b48a, roughness: 0.4 });
  const table = new THREE.Group(); table.position.set(0, F, z0 - 0.75); g.add(table);
  const top = new THREE.Mesh(new RoundedBoxGeometry(1.12, 0.06, 0.72, 3, 0.02), oak); top.position.y = 0.4; top.castShadow = top.receiveShadow = true; table.add(top);
  for (const [lx, lz] of [[-0.48, -0.29], [0.48, -0.29], [-0.48, 0.29], [0.48, 0.29]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.38, 10), oak); l.position.set(lx, 0.19, lz); table.add(l); }
  const shelf = new THREE.Mesh(new RoundedBoxGeometry(1.02, 0.03, 0.62, 2, 0.01), oak); shelf.position.y = 0.12; table.add(shelf);
  // bottles and glasses on the table
  const T = 0.43;
  const glassM = mat.phys(0xffffff, { transparent: true, opacity: 0.28, roughness: 0.02, metalness: 0.0, clearcoat: 1, envMapIntensity: 2 });
  const amber = mat.phys(0x7a3a0a, { transparent: true, opacity: 0.85, roughness: 0.05, clearcoat: 1 });
  const brown = mat.phys(0x3a1a06, { transparent: true, opacity: 0.92, roughness: 0.08, clearcoat: 1, envMapIntensity: 1.8 });
  const capM = mat.std(0x1a1a1a, 0.4, 0.6), goldCap = mat.std(0xc8a050, 0.3, 1);
  const bottle = (prof, m, x, z, cap, liquid) => {
    const b = new THREE.Mesh(lathe(prof, 28), m); b.position.set(x, T, z); b.castShadow = true; table.add(b);
    if (liquid) { const l = new THREE.Mesh(lathe(prof.filter(p => p[1] < liquid).map(([r, y]) => [r * 0.92, y]), 24), amber); l.position.copy(b.position); table.add(l); }
    const top = prof[prof.length - 1];
    const c = new THREE.Mesh(new THREE.CylinderGeometry(top[0] + 0.004, top[0] + 0.004, 0.035, 16), cap); c.position.set(x, T + top[1] + 0.012, z); table.add(c);
  };
  bottle([[0.001, 0], [0.045, 0.0], [0.048, 0.01], [0.048, 0.17], [0.04, 0.2], [0.016, 0.24], [0.015, 0.29]], glassM, -0.25, -0.12, goldCap, 0.13);        // whisky
  bottle([[0.001, 0], [0.036, 0.0], [0.038, 0.01], [0.038, 0.22], [0.03, 0.26], [0.013, 0.3], [0.013, 0.34]], glassM, -0.08, -0.2, capM, null);           // vodka
  for (const [bx, bz] of [[0.3, -0.18], [0.4, -0.04], [0.18, 0.2]]) bottle([[0.001, 0], [0.03, 0], [0.031, 0.01], [0.031, 0.13], [0.024, 0.17], [0.011, 0.2], [0.011, 0.235]], brown, bx, bz, goldCap, null);
  for (const [gx, gz] of [[-0.38, 0.15], [-0.12, 0.2], [0.05, -0.02], [0.44, 0.22]]) {
    const gl = new THREE.Mesh(lathe([[0.001, 0], [0.038, 0], [0.04, 0.005], [0.042, 0.09], [0.038, 0.09], [0.036, 0.012], [0.001, 0.012]], 24), glassM); gl.position.set(gx, T, gz); table.add(gl);
    const liq = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.034, 0.03, 20), amber); liq.position.set(gx, T + 0.03, gz); table.add(liq);
  }
  // playing cards spread on the table
  const cardFace = canvasTex(64, 96, (c, w, h) => { c.fillStyle = '#f6f3ee'; c.fillRect(0, 0, w, h); c.fillStyle = '#c8142a'; c.font = 'bold 22px serif'; c.fillText('♥', 8, 24); c.font = 'bold 40px serif'; c.fillText('♥', 18, 66); c.strokeStyle = '#ccc'; c.strokeRect(1, 1, w - 2, h - 2); });
  const cardFace2 = canvasTex(64, 96, (c, w, h) => { c.fillStyle = '#f6f3ee'; c.fillRect(0, 0, w, h); c.fillStyle = '#111'; c.font = 'bold 22px serif'; c.fillText('♠', 8, 24); c.font = 'bold 40px serif'; c.fillText('♠', 18, 66); c.strokeStyle = '#ccc'; c.strokeRect(1, 1, w - 2, h - 2); });
  const cardBack = canvasTex(64, 96, (c, w, h) => { c.fillStyle = '#7a1020'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 2; c.strokeRect(5, 5, w - 10, h - 10); for (let i = -h; i < w; i += 8) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + h, h); c.stroke(); } });
  const cg = new THREE.PlaneGeometry(0.063, 0.088);
  for (let i = 0; i < 14; i++) {
    const m = new THREE.MeshStandardMaterial({ map: i < 9 ? cardBack : (i % 2 ? cardFace : cardFace2), roughness: 0.6, side: THREE.DoubleSide });
    const c = new THREE.Mesh(cg, m);
    const a = -0.9 + i * 0.13;
    c.position.set(0.05 + Math.cos(a) * 0.18 + (i > 9 ? (rr() - 0.5) * 0.3 : 0), T + 0.001 + i * 0.0006, 0.12 + Math.sin(a) * 0.08);
    c.rotation.set(-Math.PI / 2, 0, a + (rr() - 0.5) * 0.3); table.add(c);
  }
  // lamps
  const lampShade = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc890).multiplyScalar(0.85), side: THREE.DoubleSide });
  const floorLamp = new THREE.Group(); floorLamp.position.set(2.9, F, z0 - 1.7); g.add(floorLamp);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.55, 8), mat.std(0x1a1a1a, 0.4, 0.8)); pole.position.y = 0.78; floorLamp.add(pole);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.24, 0.3, 24, 1, true), lampShade); shade.position.y = 1.62; floorLamp.add(shade);
  const tableLamp = new THREE.Group(); tableLamp.position.set(-2.9, F, z0 - 1.9); g.add(tableLamp);
  const sideT = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.55, 0.5, 2, 0.04), oak); sideT.position.y = 0.275; tableLamp.add(sideT);
  const base = new THREE.Mesh(lathe([[0.001, 0], [0.09, 0], [0.11, 0.12], [0.06, 0.26], [0.02, 0.3]], 20), mat.std(0x2a3a4a, 0.3, 0.2)); base.position.y = 0.55; tableLamp.add(base);
  const sh2 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.22, 24, 1, true), lampShade); sh2.position.y = 0.96; tableLamp.add(sh2);
  const l1 = new THREE.PointLight(0xffb36a, 6, 0, 2); l1.position.set(2.9, F + 1.35, z0 - 1.55); l1.castShadow = true; l1.shadow.mapSize.set(1024, 1024); l1.shadow.bias = -0.002; l1.shadow.radius = 4; g.add(l1);
  const l2 = new THREE.PointLight(0xffa860, 4, 0, 2); l2.position.set(-2.85, F + 0.8, z0 - 1.75); g.add(l2);
  for (const [lx, lz] of [[2.9, z0 - 1.7], [-2.9, z0 - 1.9]]) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(0xffb060).multiplyScalar(0.8), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); sp.position.set(lx, F + (lx > 0 ? 1.55 : 0.95), lz); sp.scale.set(0.9, 0.9, 1); g.add(sp); }
  const fill = new THREE.HemisphereLight(0x4a4658, 0x2a2018, 0.45); g.add(fill);
  // design pendant above the coffee table: warm key on the faces
  const pend = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat.std(0x1a1a1a, 0.4, 0.7, { side: THREE.DoubleSide }));
  pend.position.set(0, F + 2.35, z0 - 0.6); g.add(pend);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), mat.emit(0xffd29a, 3)); bulb.position.set(0, F + 2.3, z0 - 0.6); g.add(bulb);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1.05, 6), mat.std(0x111111, 0.5)); cord.position.set(0, F + 2.87, z0 - 0.6); g.add(cord);
  const l3 = new THREE.PointLight(0xffc27a, 5, 0, 2); l3.position.set(0, F + 2.1, z0 - 0.3); l3.castShadow = false; g.add(l3);
  const moon = new THREE.DirectionalLight(0x7f95ff, 0.35); moon.position.set(2, F + 8, zWin - 10); moon.target.position.set(0, F, z0); g.add(moon, moon.target);
  // shelf, plant, frames on the walls
  const plantM = mat.std(0x2c5a2e, 0.8);
  const pot = new THREE.Mesh(lathe([[0.001, 0], [0.17, 0], [0.2, 0.42], [0.001, 0.42]], 20), mat.std(0x2a2a2e, 0.6)); pot.position.set(-3.9, F, z0 - 2.6); g.add(pot);
  for (let i = 0; i < 16; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), plantM); leaf.scale.set(1, 0.25, 0.55);
    const a = rr() * Math.PI * 2, hgt = 0.6 + rr() * 1.0;
    leaf.position.set(-3.9 + Math.cos(a) * 0.3, F + hgt, z0 - 2.6 + Math.sin(a) * 0.3); leaf.rotation.set(rr(), a, 0.6); g.add(leaf);
  }
  for (const [fx, w2, col] of [[-1.6, 1.0, '#2b4a6e'], [0.3, 0.7, '#7a3a5a'], [1.7, 0.9, '#c89a4a']]) {
    const art = canvasTex(128, 128, (c, w, h) => { const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, col); gr.addColorStop(1, '#111'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 4; c.beginPath(); c.arc(w * 0.6, h * 0.45, w * 0.25, 0, Math.PI * 2); c.stroke(); });
    const fr = new THREE.Mesh(new THREE.BoxGeometry(w2 + 0.06, w2 * 0.75 + 0.06, 0.03), frameM); fr.position.set(fx, F + 1.7, zBack - 0.02); g.add(fr);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(w2, w2 * 0.75), new THREE.MeshStandardMaterial({ map: art, roughness: 0.6 })); pic.position.set(fx, F + 1.7, zBack - 0.04); pic.rotation.y = Math.PI; g.add(pic);
  }
  scene.add(g);
  return {
    group: g, glass, lamps: [l1, l2, l3], zWin,
    seats: {
      // seat surface centres and facing yaw
      malik: [V(-0.55, F + 0.5, z0 - 2.05), 0],
      chloe: [V(0.55, F + 0.5, z0 - 2.05), 0],
      lucas: [V(-1.09, F + 0.49, z0 - 0.42), Math.PI / 2 - 0.35],
      ines: [V(1.09, F + 0.49, z0 - 0.42), -Math.PI / 2 + 0.35],
    },
    tableTop: V(0, F + T, z0 - 0.75),
  };
}
