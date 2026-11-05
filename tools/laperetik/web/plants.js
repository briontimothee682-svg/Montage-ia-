// Procedural house plants and a warm room: olive tree, fiddle-leaf fig, eucalyptus in a vase, hanging pothos,
// plaster walls with baked leaf shadows, a window with late sun, a wooden floor and furniture.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { tex, seeded, v3, deg, lathe, smoothProfile, noise3 } from './lib.js';

const MAT = {};
function mats() {
  if (MAT.ok) return MAT;
  const leaf = (k, rough) => new THREE.MeshStandardMaterial({ map: tex(`leaf_${k}`, { wrap: false }), bumpMap: tex(`leaf_${k}_bump`, { color: false, wrap: false }), bumpScale: 1.2, alphaTest: 0.45, side: THREE.DoubleSide, roughness: rough });
  MAT.olive = leaf('olive', 0.62); MAT.ficus = leaf('ficus', 0.38); MAT.euca = leaf('euca', 0.55); MAT.pothos = leaf('pothos', 0.42);
  MAT.bark = new THREE.MeshStandardMaterial({ color: 0x6e5a44, roughness: 0.9, bumpMap: tex('oak_bump', { color: false, repeat: [0.2, 2] }), bumpScale: 3 });
  MAT.stem = new THREE.MeshStandardMaterial({ color: 0x55603c, roughness: 0.7 });
  MAT.terra = new THREE.MeshStandardMaterial({ map: tex('terracotta'), bumpMap: tex('terracotta_bump', { color: false }), bumpScale: 1.5, roughness: 0.85 });
  MAT.glaze = new THREE.MeshPhysicalMaterial({ color: 0xe8dcc6, roughness: 0.35, clearcoat: 0.5 });
  MAT.soil = new THREE.MeshStandardMaterial({ color: 0x3a2a1e, roughness: 1 });
  MAT.ok = true;
  return MAT;
}

function leafGeo(len, width, bend = 0.25, fold = 0.25) {
  const g = new THREE.PlaneGeometry(width, len, 4, 8);
  g.translate(0, len / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), k = y / len;
    p.setZ(i, bend * k * k * len + Math.abs(x) * fold);
  }
  g.computeVertexNormals();
  return g;
}

function pot(h, r, mat = mats().terra) {
  const g = new THREE.Group();
  const prof = smoothProfile([[r * 0.72, 0], [r * 0.8, h * 0.08], [r, h * 0.86], [r * 1.06, h * 0.9], [r * 1.06, h], [r * 0.96, h], [r * 0.9, h * 0.92]], 40);
  g.add(new THREE.Mesh(lathe(prof, 48), mat));
  const soil = new THREE.Mesh(new THREE.CircleGeometry(r * 0.9, 32), mats().soil); soil.rotation.x = -Math.PI / 2; soil.position.y = h * 0.9; g.add(soil);
  return g;
}

// leaves scattered along a set of curves, as one instanced mesh
function leavesOn(curves, geo, mat, count, rnd, { tipBias = 0.6, spread = 1.0, scale = [0.8, 1.2] } = {}) {
  const im = new THREE.InstancedMesh(geo, mat, count);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const c = curves[Math.floor(rnd() * curves.length)];
    const u = 1 - Math.pow(rnd(), 1 + tipBias);
    const p = c.getPointAt(Math.min(0.999, u));
    const tng = c.getTangentAt(Math.min(0.999, u));
    const yaw = Math.atan2(tng.x, tng.z) + (rnd() - 0.5) * Math.PI * 2 * spread;
    e.set(deg(25 + rnd() * 70), yaw, (rnd() - 0.5) * 0.8, 'YXZ'); q.setFromEuler(e);
    const sc = scale[0] + rnd() * (scale[1] - scale[0]); s.set(sc, sc, sc);
    m4.compose(p, q, s); im.setMatrixAt(i, m4);
  }
  im.castShadow = true; im.receiveShadow = true;
  return im;
}

function curve(pts) { return new THREE.CatmullRomCurve3(pts.map(p => v3(...p))); }

export function oliveTree(seed = 1, H = 150) {
  const M = mats(), rnd = seeded(seed), g = new THREE.Group();
  g.add(pot(38, 24));
  const trunk = curve([[0, 30, 0], [3, 60, 2], [-2, 90, 1], [2, H * 0.62, -2]]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(trunk, 30, 2.6, 8), M.bark));
  const branches = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rnd(), y0 = H * (0.5 + rnd() * 0.14), L = 30 + rnd() * 30;
    const c = curve([[0, y0, 0], [Math.cos(a) * L * 0.5, y0 + 12 + rnd() * 10, Math.sin(a) * L * 0.5], [Math.cos(a) * L, y0 + 22 + rnd() * 22, Math.sin(a) * L]]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(c, 12, 0.9, 6), M.bark)); branches.push(c);
  }
  g.add(leavesOn(branches, leafGeo(7, 1.5, 0.15, 0.1), M.olive, 900, rnd, { tipBias: 0.2, spread: 1 }));
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function ficus(seed = 2, H = 120) {
  const M = mats(), rnd = seeded(seed), g = new THREE.Group();
  g.add(pot(32, 20));
  const stems = [];
  for (let i = 0; i < 4; i++) {
    const a = rnd() * Math.PI * 2, top = H * (0.75 + rnd() * 0.25), lean = 8 + rnd() * 10;
    const c = curve([[0, 28, 0], [Math.cos(a) * lean * 0.3, top * 0.6, Math.sin(a) * lean * 0.3], [Math.cos(a) * lean, top, Math.sin(a) * lean]]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(c, 16, 0.8, 6), M.stem)); stems.push(c);
  }
  g.add(leavesOn(stems, leafGeo(26, 17, 0.12, 0.35), M.ficus, 46, rnd, { tipBias: 0.9, spread: 0.6, scale: [0.75, 1.15] }));
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function eucalyptusVase(seed = 3, H = 70) {
  const M = mats(), rnd = seeded(seed), g = new THREE.Group();
  const vp = smoothProfile([[5, 0], [9, 6], [11, 16], [8, 26], [4.5, 32], [5.2, 34]], 40);
  g.add(new THREE.Mesh(lathe(vp, 48), M.glaze));
  const stems = [];
  for (let i = 0; i < 8; i++) {
    const a = rnd() * Math.PI * 2, out = 10 + rnd() * 18, top = H * (0.7 + rnd() * 0.4);
    const c = curve([[0, 30, 0], [Math.cos(a) * out * 0.3, top * 0.75, Math.sin(a) * out * 0.3], [Math.cos(a) * out, top, Math.sin(a) * out]]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(c, 14, 0.35, 5), M.stem)); stems.push(c);
  }
  g.add(leavesOn(stems, leafGeo(5, 4.4, 0.05, 0.05), M.euca, 220, rnd, { tipBias: -0.3, spread: 0.5 }));
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function pothosHanging(seed = 4, drop = 70) {
  const M = mats(), rnd = seeded(seed), g = new THREE.Group();
  const p = pot(18, 13, M.glaze); g.add(p);
  for (const a of [0, 2.1, 4.2]) {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 60, 4), new THREE.MeshStandardMaterial({ color: 0xc8b08a })); rope.position.set(Math.cos(a) * 11, 45, Math.sin(a) * 11); rope.rotation.set(Math.sin(a) * 0.18, 0, -Math.cos(a) * 0.18); g.add(rope);
  }
  const vines = [];
  for (let i = 0; i < 7; i++) {
    const a = rnd() * Math.PI * 2, r0 = 10;
    const len = drop * (0.5 + rnd() * 0.6);
    const c = curve([[Math.cos(a) * r0, 16, Math.sin(a) * r0], [Math.cos(a) * (r0 + 6), 12, Math.sin(a) * (r0 + 6)], [Math.cos(a) * (r0 + 9), -len * 0.5, Math.sin(a) * (r0 + 9)], [Math.cos(a) * (r0 + 8 + rnd() * 6), -len, Math.sin(a) * (r0 + 8)]]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(c, 20, 0.3, 5), M.stem)); vines.push(c);
  }
  g.add(leavesOn(vines, leafGeo(8, 6.4, 0.1, 0.2), M.pothos, 120, rnd, { tipBias: -0.2, spread: 0.7 }));
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// sprigs lying flat on a table (top-down shots)
export function tableSprig(seed = 5, kind = 'olive', n = 14) {
  const M = mats(), rnd = seeded(seed), g = new THREE.Group();
  const c = curve([[0, 0.3, 0], [8, 0.4, 2], [16, 0.5, 1], [24, 0.45, -2]]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(c, 20, 0.22, 5), kind === 'olive' ? M.bark : M.stem));
  const geo = kind === 'olive' ? leafGeo(6.5, 1.4, 0.05, 0.05) : leafGeo(4.5, 4.0, 0.02, 0.02);
  const im = new THREE.InstancedMesh(geo, kind === 'olive' ? M.olive : M.euca, n);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let i = 0; i < n; i++) {
    const u = 0.08 + (i / n) * 0.9, p = c.getPointAt(u), tg = c.getTangentAt(u);
    const side = i % 2 ? 1 : -1;
    const yaw = Math.atan2(tg.x, tg.z) + side * deg(50 + rnd() * 25);
    q.setFromEuler(new THREE.Euler(deg(-86), yaw, 0, 'YXZ'));
    m4.compose(p.clone().add(v3(0, 0.2, 0)), q, v3(1, 1, 1).multiplyScalar(0.85 + rnd() * 0.3)); im.setMatrixAt(i, m4);
  }
  im.castShadow = true; im.receiveShadow = true; g.add(im);
  return g;
}

// a warm room around a dining table: plaster walls with leaf shadows, a window with late sun, a floor and plants
export function room({ radius = 320, floorY = -76, windowAz = -60, plants = [], tableTop = true } = {}) {
  const g = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.CircleGeometry(radius + 10, 64), new THREE.MeshStandardMaterial({ map: tex('desk', { repeat: [8, 8] }), color: 0x8a6a4c, roughness: 0.6 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = floorY; floor.receiveShadow = true; g.add(floor);
  const wallH = 340;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, wallH, 96, 1, true), new THREE.MeshStandardMaterial({ map: tex('wall_leafy', { repeat: [4, 1] }), roughness: 0.95, side: THREE.BackSide }));
  wall.position.y = floorY + wallH / 2; wall.receiveShadow = true; g.add(wall);
  // window with late warm sun
  const wz = deg(windowAz), wr = radius - 2;
  const win = new THREE.Group(); win.position.set(Math.sin(wz) * wr, floorY + 150, Math.cos(wz) * wr); win.lookAt(0, floorY + 150, 0);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(130, 160), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.86, 0.62).multiplyScalar(1.5) })); win.add(glow);
  const frameM = new THREE.MeshStandardMaterial({ color: 0xe9dfcf, roughness: 0.6 });
  for (const [w, h, x, y] of [[140, 6, 0, 83], [140, 6, 0, -83], [6, 172, -67, 0], [6, 172, 67, 0], [4, 160, 0, 0], [130, 4, 0, 20]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 5), frameM); b.position.set(x, y, 2); win.add(b);
  }
  g.add(win);
  if (tableTop) {
    const legM = new THREE.MeshStandardMaterial({ map: tex('oak', { repeat: [0.2, 1] }), roughness: 0.6 });
    for (const [x, z] of [[-100, -70], [100, -70], [-100, 70], [100, 70]]) {
      const leg = new THREE.Mesh(new RoundedBoxGeometry(7, -floorY - 4, 7, 2, 1), legM); leg.position.set(x, floorY / 2 - 2, z); leg.castShadow = true; g.add(leg);
    }
  }
  for (const [fn, az, r, rot, s] of plants) {
    const p = fn(); const a = deg(az);
    p.position.set(Math.sin(a) * r, floorY, Math.cos(a) * r); p.rotation.y = rot; p.scale.setScalar(s || 1); g.add(p);
  }
  return g;
}

export function sideboard(w = 150, h = 82, d = 45) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ map: tex('walnut', { repeat: [1, 0.5] }), roughness: 0.5 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 1.5), m); body.position.y = h / 2; g.add(body);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
