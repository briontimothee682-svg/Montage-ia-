// The Box Apéro: round birch-wood box (Ø30 cm, 8 cm deep) with a branded lid, and everything inside it.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { tex, seeded, jitterGeometry, shiftUV, bboxUV, noise3, v3, deg } from './lib.js';

export const BOX = { R: 15, H: 8.2, T: 0.32, LID_R: 15.38, LID_H: 2.7, LOGO_D: 29.2 };   // the logo fills the whole lid

// ------------------------------------------------------------ materials (created after preload)
export function foodMaterials() {
  const M = {};
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);
  M.birchBand = std({ map: tex('birch_band'), bumpMap: tex('birch_band_bump', { color: false }), bumpScale: 0.6, roughness: 0.84, envMapIntensity: 0.55, color: 0xffffff });
  M.birchBandIn = std({ map: tex('birch_band', { repeat: [1, 1] }), roughness: 0.85, envMapIntensity: 0.5, color: 0xeadfcc, side: THREE.BackSide });
  M.birchInner = std({ map: tex('birch_inner'), roughness: 0.75 });
  M.birchEdge = std({ map: tex('birch_inner', { repeat: [4, 0.05] }), roughness: 0.7, color: 0xf1e2c6 });
  M.parchment = std({ color: 0x6e4a2c, roughness: 0.9, side: THREE.DoubleSide });   // dark kraft liner, invisible between the pieces
  M.comte = phys({ map: tex('comte'), bumpMap: tex('comte_bump', { color: false }), bumpScale: 0.9, roughness: 0.56, sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xffe6b0), emissive: 0x3a2608, emissiveIntensity: 0.32 });
  M.comteRind = std({ map: tex('comte_rind'), bumpMap: tex('comte_rind_bump', { color: false }), bumpScale: 2, roughness: 0.8 });
  M.tomme = phys({ map: tex('tomme', { repeat: [0.14, 0.14] }), bumpMap: tex('tomme_bump', { color: false, repeat: [0.14, 0.14] }), bumpScale: 1.5, roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color(0xfff1d6), emissive: 0x2e2410, emissiveIntensity: 0.2 });
  M.tommeRind = std({ map: tex('tomme_rind', { repeat: [0.3, 0.3] }), bumpMap: tex('tomme_rind_bump', { color: false, repeat: [0.3, 0.3] }), bumpScale: 2.5, roughness: 0.9 });
  M.blue = phys({ map: tex('blue', { repeat: [0.16, 0.16] }), bumpMap: tex('blue_bump', { color: false, repeat: [0.16, 0.16] }), bumpScale: 1.6, roughness: 0.58, sheen: 0.3, sheenColor: new THREE.Color(0xffffff), emissive: 0x242018, emissiveIntensity: 0.2 });
  M.blueRind = std({ color: 0xd9d0bc, roughness: 0.85, bumpMap: tex('tomme_rind_bump', { color: false, repeat: [0.4, 0.4] }), bumpScale: 1.5 });
  M.ham = phys({ map: tex('ham'), bumpMap: tex('ham_bump', { color: false }), bumpScale: 0.8, roughness: 0.42, clearcoat: 0.2, clearcoatRoughness: 0.45, sheen: 0.85, sheenColor: new THREE.Color(0xffb0a0), side: THREE.DoubleSide, alphaTest: 0.5, emissive: 0x8a2a1c, emissiveIntensity: 0.38 });   // thin and translucent
  M.sauFace = phys({ map: tex('saucisson_face'), bumpMap: tex('saucisson_face_bump', { color: false }), bumpScale: 1.5, roughness: 0.55, clearcoat: 0.1, clearcoatRoughness: 0.5, emissive: 0x220606, emissiveIntensity: 0.25 });
  M.sauSkin = std({ map: tex('saucisson_skin'), bumpMap: tex('saucisson_skin_bump', { color: false }), bumpScale: 2.5, roughness: 0.85 });
  M.coppa = phys({ map: tex('coppa'), bumpMap: tex('coppa_bump', { color: false }), bumpScale: 1.0, roughness: 0.4, clearcoat: 0.3, clearcoatRoughness: 0.35, sheen: 0.5, sheenColor: new THREE.Color(0xff8a7a), side: THREE.DoubleSide, alphaTest: 0.5, emissive: 0x2a0606, emissiveIntensity: 0.25 });
  M.toast = std({ map: tex('toast', { wrap: false }), bumpMap: tex('toast_bump', { color: false, wrap: false }), bumpScale: 3, roughness: 0.82 });
  M.crust = std({ map: tex('crust'), bumpMap: tex('crust_bump', { color: false }), bumpScale: 2, roughness: 0.8 });
  M.walnut = std({ map: tex('walnut_kernel'), bumpMap: tex('walnut_kernel_bump', { color: false }), bumpScale: 4, roughness: 0.7 });
  M.apricot = phys({ map: tex('apricot'), bumpMap: tex('apricot_bump', { color: false }), bumpScale: 5, roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.3, emissive: 0x3a1400, emissiveIntensity: 0.3 });
  M.rosemary = std({ color: 0x4f5a3c, roughness: 0.7 });
  M.stem = std({ color: 0x6b5a3e, roughness: 0.8 });
  return M;
}

// lid top: matte birch veneer with the logo printed in its own black (#151515), no glare
export function lidTopMaterial(U) {
  const mat = new THREE.MeshStandardMaterial({ map: tex('birch_top', { wrap: false }), bumpMap: tex('birch_top_bump', { color: false, wrap: false }), bumpScale: 0.4, roughness: 0.86, envMapIntensity: 0.5 });
  const fx = tex('logo_fx', { color: false, wrap: false });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uFx = { value: fx };
    for (const k of ['uReveal', 'uLogoScale']) sh.uniforms[k] = U[k];
    sh.fragmentShader = 'uniform sampler2D uFx; uniform float uReveal, uLogoScale;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec2 luv = (vMapUv - 0.5) / uLogoScale + 0.5;
        float inside = step(0.0, luv.x) * step(luv.x, 1.0) * step(0.0, luv.y) * step(luv.y, 1.0);
        vec4 fx = texture2D(uFx, luv) * inside;
        float shown = smoothstep(fx.b - 0.02, fx.b + 0.02, uReveal);
        float ink = fx.r * shown;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.0075), ink);
        float lidInk = ink;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.95, lidInk);`);
  };
  mat.customProgramCacheKey = () => 'lidtop2';
  return mat;
}

// ------------------------------------------------------------ box
export function makeBox(M, U) {
  const { R, H, T, LID_R, LID_H } = BOX;
  const box = new THREE.Group(); box.name = 'box';
  const base = new THREE.Group(); box.add(base);
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 180, 1, true), M.birchBand); outer.position.y = H / 2; base.add(outer);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(R - T, R - T, H - 0.4, 180, 1, true), M.birchBandIn); inner.position.y = H / 2 + 0.2; base.add(inner);
  const rim = new THREE.Mesh(new THREE.RingGeometry(R - T, R, 180, 1), M.birchEdge); rim.rotation.x = -Math.PI / 2; rim.position.y = H; base.add(rim);
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.02, R + 0.02, 0.4, 180), M.birchBand); bottom.position.y = 0.2; base.add(bottom);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R - T, 120), M.birchInner); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.41; base.add(floor);
  // overlapping veneer seam with its little staples
  const seam = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.06, R + 0.06, H - 0.1, 12, 1, true, deg(200), deg(9)), M.birchBand);
  seam.position.y = H / 2; base.add(seam);
  // parchment liner (false floor) so the food is heaped generously up to the rim
  const lg = new THREE.CircleGeometry(R - T - 0.05, 96, 0, Math.PI * 2);
  const lgp = new THREE.PlaneGeometry(2 * R, 2 * R, 90, 90);
  const pp = lgp.attributes.position;
  for (let i = 0; i < pp.count; i++) {
    const x = pp.getX(i), y = pp.getY(i), r = Math.hypot(x, y);
    const k = Math.min(1, r / (R - T - 0.1));
    const s = k > 1 ? 1 : 1;
    const z = (noise3(x * 0.25, y * 0.25, 3) - 0.5) * 0.9 + Math.pow(Math.max(0, k - 0.82) / 0.18, 2) * 1.8;
    const sc = Math.min(1, (R - T - 0.15) / Math.max(r, 0.0001));
    pp.setXYZ(i, r > R - T - 0.15 ? x * sc : x, r > R - T - 0.15 ? y * sc : y, z * s);
  }
  lgp.computeVertexNormals();
  const liner = new THREE.Mesh(lgp, M.parchment); liner.rotation.x = -Math.PI / 2; liner.position.y = 3.3; base.add(liner);
  lg.dispose();

  // lid (origin = centre of its top surface)
  const lid = new THREE.Group(); lid.name = 'lid'; box.add(lid);
  const lb = new THREE.Mesh(new THREE.CylinderGeometry(LID_R, LID_R, LID_H, 180, 1, true), M.birchBand); lb.position.y = -LID_H / 2; lid.add(lb);
  const lbi = new THREE.Mesh(new THREE.CylinderGeometry(LID_R - 0.28, LID_R - 0.28, LID_H, 180, 1, true), M.birchBandIn); lbi.position.y = -LID_H / 2; lid.add(lbi);
  const lr = new THREE.Mesh(new THREE.RingGeometry(LID_R - 0.28, LID_R, 180, 1), M.birchEdge); lr.rotation.x = Math.PI / 2; lr.position.y = -LID_H; lid.add(lr);
  const topMat = lidTopMaterial(U);
  const top = new THREE.Mesh(new THREE.CircleGeometry(LID_R, 180), topMat); top.rotation.x = -Math.PI / 2; top.position.y = 0.0; lid.add(top);
  const under = new THREE.Mesh(new THREE.CircleGeometry(LID_R - 0.28, 120), M.birchInner); under.rotation.x = Math.PI / 2; under.position.y = -0.3; lid.add(under);
  const lidEdge = new THREE.Mesh(new THREE.TorusGeometry(LID_R - 0.02, 0.05, 6, 180), M.birchEdge); lidEdge.rotation.x = Math.PI / 2; lid.add(lidEdge);
  lid.userData.closedY = H + 0.32;
  lid.position.y = lid.userData.closedY;
  box.userData = { base, lid, top };
  box.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  liner.castShadow = false;
  return box;
}

// ------------------------------------------------------------ food pieces
function cheeseCube(M, rnd, size, rind) {
  const s = size * (0.9 + rnd() * 0.2);
  const g = new RoundedBoxGeometry(s * (0.92 + rnd() * 0.16), s * (0.9 + rnd() * 0.14), s * (0.92 + rnd() * 0.16), 3, 0.09);
  jitterGeometry(g, 0.07, 1.3, rnd() * 100);
  shiftUV(g, rnd(), rnd(), 0.32);
  const mats = [M.comte, M.comte, M.comte, M.comte, M.comte, M.comte];
  if (rind) mats[Math.floor(rnd() * 6)] = M.comteRind;
  return new THREE.Mesh(g, mats);
}

function tommeSlice(M, rnd) {
  const L = 7.7 + rnd() * 0.5, A = deg(16 + rnd() * 4), d = 0.6;
  const paste = new THREE.Shape();
  paste.moveTo(0, 0);
  paste.absarc(0, 0, L - 0.45, -A / 2, A / 2, false);
  paste.lineTo(0, 0);
  const rind = new THREE.Shape();
  rind.absarc(0, 0, L, -A / 2, A / 2, false);
  rind.absarc(0, 0, L - 0.45, A / 2, -A / 2, true);
  const opts = { depth: d, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 20 };
  const gp = new THREE.ExtrudeGeometry(paste, opts);
  const gr = new THREE.ExtrudeGeometry(rind, opts);
  jitterGeometry(gp, 0.04, 2, rnd() * 50); jitterGeometry(gr, 0.04, 2, rnd() * 50);
  const g = new THREE.Group();
  const mp = new THREE.Mesh(gp, M.tomme), mr = new THREE.Mesh(gr, M.tommeRind);
  mp.position.x = mr.position.x = -L / 2; mp.position.z = mr.position.z = -d / 2;
  g.add(mp, mr);
  return g;
}

function blueWedge(M, rnd, R = 6, A = deg(42), h = 3.6) {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.absarc(0, 0, R - 0.25, -A / 2, A / 2, false); s.lineTo(0, 0);
  const r = new THREE.Shape(); r.absarc(0, 0, R, -A / 2, A / 2, false); r.absarc(0, 0, R - 0.25, A / 2, -A / 2, true);
  const opts = { depth: h, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 2, curveSegments: 24 };
  const gp = new THREE.ExtrudeGeometry(s, opts), gr = new THREE.ExtrudeGeometry(r, opts);
  jitterGeometry(gp, 0.08, 1.5, rnd() * 50); jitterGeometry(gr, 0.08, 1.5, rnd() * 50);
  const g = new THREE.Group();
  const a = new THREE.Mesh(gp, M.blue), b = new THREE.Mesh(gr, M.blueRind);
  for (const m of [a, b]) { m.rotation.x = -Math.PI / 2; m.position.set(-R / 2, -h / 2, 0); g.add(m); }
  return g;
}

function hamGeometry(rnd, L = 19, W = 6.4) {
  // folded state = a thin slice loosely gathered in irregular folds; morph target = the slice laid out
  const g = new THREE.PlaneGeometry(L, W, 260, 22);
  const p = g.attributes.position;
  const flat = new Float32Array(p.array.length);
  const fold = new Float32Array(p.array.length);
  const ph = rnd() * 9, bend = (rnd() - 0.5) * 0.6;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const u = x / L + 0.5, v = y / W + 0.5;
    const n1 = noise3(u * 7, v * 1.6, ph) - 0.5, n2 = noise3(u * 15, v * 3, ph + 4) - 0.5;
    flat[i * 3] = x; flat[i * 3 + 1] = y; flat[i * 3 + 2] = Math.sin(u * 6 + ph) * 0.5 + n1 * 0.6;
    // paper-thin slice gathered in many fine, uneven pleats (chiffonnade), with a ruffled edge
    const a = u * Math.PI * (10.5 + n1 * 2.5) + ph + n1 * 2.6;
    const amp = 0.62 + 0.3 * (noise3(u * 3, 1, ph) - 0.5) + v * 0.22;
    const edge = Math.pow(Math.abs(v - 0.5) * 2, 3);
    const cx = x * 0.46 + Math.sin(a) * 0.38 * amp;
    fold[i * 3] = cx;
    fold[i * 3 + 1] = y * (0.93 + 0.07 * Math.cos(a)) + cx * cx * bend * 0.08 + n2 * 0.3;
    fold[i * 3 + 2] = Math.cos(a) * amp * (0.8 + 0.2 * v) + n2 * 0.35 + n1 * 0.3 + Math.sin(u * 70 + v * 4 + ph) * 0.12 * edge;
  }
  p.array.set(fold);
  g.morphAttributes.position = [new THREE.Float32BufferAttribute(flat, 3)];
  g.computeVertexNormals();
  return g;
}

function hamRibbon(M, rnd) {
  const m = new THREE.Mesh(hamGeometry(rnd), M.ham);
  m.morphTargetInfluences = [0];
  m.userData.morph = true;
  return m;
}

function saucisson(M, rnd) {
  const r = 1.95 + rnd() * 0.35;
  const g = new THREE.CylinderGeometry(r, r * 0.985, 0.14, 48, 1);
  jitterGeometry(g, 0.03, 1.8, rnd() * 40);
  shiftUV(g, rnd(), 0, 1);
  const m = new THREE.Mesh(g, [M.sauSkin, M.sauFace, M.sauFace]);
  return m;
}

function coppa(M, rnd) {
  const S = 7.6 + rnd() * 0.7;
  const g = new THREE.PlaneGeometry(S, S, 40, 40);
  const p = g.attributes.position;
  const Rc = 3.6 + rnd() * 1.2, ph = rnd() * 10;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const a = y / Rc;
    const wob = (noise3(x * 0.4, y * 0.4, ph) - 0.5) * 0.8;
    p.setXYZ(i, x, Math.sin(a) * Rc, (1 - Math.cos(a)) * Rc + wob);
  }
  g.computeVertexNormals();
  return new THREE.Mesh(g, M.coppa);
}

function toast(M, rnd) {
  const rx = 4.6 + rnd() * 0.6, ry = 3.1 + rnd() * 0.4;
  const s = new THREE.Shape();
  const N = 48, ph = rnd() * 9;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const k = 1 + (noise3(Math.cos(a) * 1.5, Math.sin(a) * 1.5, ph) - 0.5) * 0.18 + (Math.sin(a) > 0 ? 0.08 * Math.sin(a) : 0);
    const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
    i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.75, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.22, bevelSegments: 3, curveSegments: 4,
    UVGenerator: bboxUV(-rx * 1.12, -ry * 1.12, rx * 2.24, ry * 2.24, 0.4) });
  jitterGeometry(g, 0.07, 1.2, rnd() * 30);
  g.translate(0, 0, -0.375);
  return new THREE.Mesh(g, [M.toast, M.crust]);
}

function walnutHalf(M, rnd) {
  const g = new THREE.SphereGeometry(1.0, 48, 32);
  const p = g.attributes.position, v = new THREE.Vector3(), ph = rnd() * 20;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const th = Math.atan2(v.z, v.x);
    let k = 1 + 0.10 * Math.sin(th * 4 + ph) + (noise3(v.x * 3 + ph, v.y * 3, v.z * 3) - 0.5) * 0.45;
    let x = v.x * 1.5 * k, y = v.y * k, z = v.z * 1.15 * k;
    y = y > 0 ? y * 0.75 : y * 0.12;
    const groove = Math.exp(-(x * x) / 0.05) * 0.35;
    y = y > 0 ? Math.max(0.05, y - groove) : y;
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return new THREE.Mesh(g, M.walnut);
}

function apricot(M, rnd) {
  const g = new THREE.SphereGeometry(1.6, 40, 24);
  const p = g.attributes.position, v = new THREE.Vector3(), ph = rnd() * 20;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = (noise3(v.x * 1.5 + ph, v.y * 1.5, v.z * 1.5) - 0.5) * 0.35;
    v.multiplyScalar(1 + n); v.y *= 0.42; v.z *= 0.85;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return new THREE.Mesh(g, M.apricot);
}

export function rosemary(M, seed = 3) {
  const rnd = seeded(seed);
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([v3(0, 0, 0), v3(3, 0.3, 0.5), v3(6, 0.5, 0.4), v3(9, 0.6, -0.3)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.09, 6), M.stem));
  const ng = new THREE.CapsuleGeometry(0.06, 1.3, 2, 6); ng.scale(1.6, 1, 0.6);
  for (let i = 0; i < 46; i++) {
    const u = 0.06 + (i / 46) * 0.92;
    const p = curve.getPointAt(u);
    const n = new THREE.Mesh(ng, M.rosemary);
    n.position.copy(p);
    const side = i % 2 ? 1 : -1;
    n.rotation.set(side * deg(55 + rnd() * 20), rnd() * 1, deg(70 + rnd() * 30) * (1 - u * 0.4));
    n.scale.setScalar(0.85 - u * 0.3);
    g.add(n);
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// returns [{ obj, rest: {p, q}, ex: {p, q}, spin: {axis, w}, kind, layer }]
// Only cheese (comté cubes, tomme, blue), thin saucisson slices and dry-cured ham, packed with no gap.
export function makeContents(M) {
  const rnd = seeded(2024);
  const pieces = [];
  const group = new THREE.Group(); group.name = 'contents';
  const FLOOR = 3.6;
  const add = (obj, kind, p, euler, layer) => {
    obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const q = new THREE.Quaternion().setFromEuler(euler);
    group.add(obj); obj.position.copy(p); obj.quaternion.copy(q);
    pieces.push({ obj, kind, layer, rest: { p: p.clone(), q: q.clone() } });
  };
  const polar = (r, a, y) => v3(Math.cos(a) * r, y, -Math.sin(a) * r);
  const SEC = deg(60);
  const sector = i => deg(30) + i * SEC;
  const J = (k = 1) => (rnd() - 0.5) * k;

  // centre: a saucisson rosette, thin slices overlapping like petals
  add(saucisson(M, rnd), 'sau', v3(0, FLOOR + 3.3, 0), new THREE.Euler(0, 0, 0), 2);
  for (const [r, n, tilt, y] of [[2.0, 6, 30, 3.0], [3.9, 9, 38, 2.5], [5.7, 12, 44, 1.9]]) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r;
      add(saucisson(M, rnd), 'sau', polar(r, a, FLOOR + y), new THREE.Euler(deg(tilt + J(6)), -a + Math.PI / 2, 0, 'YXZ'), 2);
    }
  }
  // comté cubes: two generous layers in two opposite sectors
  const cubeSector = s => {
    const a0 = sector(s);
    for (const [r, n, y] of [[7.6, 3, 1.3], [9.9, 3, 1.3], [12.2, 4, 1.3], [8.7, 3, 3.9], [11.0, 4, 3.9], [9.8, 2, 6.2]]) {
      const span = SEC * 0.9;
      for (let i = 0; i < n; i++) {
        const a = a0 - span / 2 + span * (i + 0.5) / n + J(0.06);
        add(cheeseCube(M, rnd, 2.55, rnd() < 0.3), 'cube', polar(r + J(0.3), a, FLOOR + y + J(0.25)), new THREE.Euler(J(0.3), rnd() * 3, J(0.3)), 0);
      }
    }
  };
  cubeSector(0); cubeSector(3);
  // jambon cru, thinly sliced and loosely folded, filling two sectors
  const hamSector = (s, n) => {
    for (let i = 0; i < n; i++) {
      const a = sector(s) + (i % 3 - 1) * 0.36 + J(0.08);
      const r = i < 3 ? 8.2 : 10.9;
      add(hamRibbon(M, rnd), 'ham', polar(r + J(0.5), a, FLOOR + 1.6 + (i % 2) * 0.6 + J(0.3)), new THREE.Euler(deg(-90 + J(14)), 0, -a + Math.PI / 2 + J(0.4), 'YXZ'), 2);
    }
  };
  hamSector(1, 5); hamSector(4, 5);
  // tomme slices fanned + blue cheese wedge
  for (let i = 0; i < 6; i++) {
    const a = sector(2) - 0.46 + i * 0.12;
    add(tommeSlice(M, rnd), 'tomme', polar(9.2, a, FLOOR + 1.2 + i * 0.45), new THREE.Euler(deg(-90 + 24), a, 0, 'YXZ'), 1);
  }
  add(blueWedge(M, rnd, 6.0, deg(40), 3.8), 'blue', polar(10.6, sector(2) + 0.42, FLOOR + 2.0), new THREE.Euler(0, sector(2) + 0.42 + Math.PI, 0), 1);
  // saucisson shingled flat in two arcs + ham on top of the last sector
  for (const [r, n, y] of [[12.1, 9, 1.0], [9.2, 7, 1.4], [6.9, 5, 1.8]]) for (let i = 0; i < n; i++) {
    const a = sector(5) - SEC * 0.45 + SEC * 0.9 * (i + 0.5) / n;
    add(saucisson(M, rnd), 'sau', polar(r + J(0.3), a, FLOOR + y + i * 0.09), new THREE.Euler(deg(20 + J(6)), -a + Math.PI / 2, 0, 'YXZ'), 2);
  }
  // a few more cubes along the inner ring so nothing shows through
  for (let s = 0; s < 6; s++) {
    if (s === 0 || s === 3) continue;
    const a = sector(s) + SEC / 2;
    add(cheeseCube(M, rnd, 2.4, false), 'cube', polar(7.3, a, FLOOR + 1.6), new THREE.Euler(J(0.3), rnd() * 3, J(0.3)), 0);
  }

  // keep every piece inside the box: pull it toward the centre until no vertex crosses the inner wall
  const RMAX = BOX.R - BOX.T - 0.25, v = new THREE.Vector3();
  for (const pc of pieces) {
    for (let iter = 0; iter < 4; iter++) {
      pc.obj.position.copy(pc.rest.p); pc.obj.quaternion.copy(pc.rest.q); pc.obj.updateMatrixWorld(true);
      let maxR = 0;
      pc.obj.traverse(o => {
        if (!o.isMesh) return;
        const pos = o.geometry.attributes.position;
        for (let i = 0; i < pos.count; i += 2) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); maxR = Math.max(maxR, Math.hypot(v.x, v.z)); }
      });
      pc.topY = 0;
      pc.obj.traverse(o => { if (!o.isMesh) return; const pos = o.geometry.attributes.position; for (let i = 0; i < pos.count; i += 3) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); pc.topY = Math.max(pc.topY, v.y); } });
      if (maxR <= RMAX) break;
      const dir = v3(pc.rest.p.x, 0, pc.rest.p.z); const len = dir.length() || 1;
      pc.rest.p.addScaledVector(dir.divideScalar(len), -(maxR - RMAX) - 0.05);
    }
    pc.obj.position.copy(pc.rest.p);
  }

  // exploded view: layers above the box (cheese low, charcuterie mid, bread high), spread outwards
  const LAYER_Y = [17, 24, 31, 38, 25];
  for (const pc of pieces) {
    const r = Math.hypot(pc.rest.p.x, pc.rest.p.z), a = Math.atan2(-pc.rest.p.z, pc.rest.p.x);
    const spread = 1.35 + rnd() * 0.3;
    const y = LAYER_Y[pc.layer] + (rnd() - 0.5) * 5 + (pc.rest.p.y - FLOOR) * 0.8;
    pc.ex = { p: polar(r * spread + 1.5, a + (rnd() - 0.5) * 0.2, y), q: pc.rest.q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler((rnd() - 0.5) * 1.6, (rnd() - 0.5) * 1.6, (rnd() - 0.5) * 1.6))) };
    pc.spin = { axis: v3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(), w: 0.25 + rnd() * 0.45 };
    if (pc.kind === 'sau') pc.spin.w = 0.9 + rnd() * 0.5;
    pc.delay = rnd() * 0.12 + (pc.layer === 0 ? 0 : pc.layer * 0.03);
  }
  return { group, pieces };
}

export const pieceFactories = { cheeseCube, hamRibbon, saucisson, toast, walnutHalf, apricot, coppa };

// pieces heaped above the rim are only shown while the lid is high enough not to cut through them
export function hideUnderLid(pieces, lid) {
  const under = lid.position.y - 0.3 - Math.abs(Math.sin(lid.rotation.x)) * BOX.LID_R;
  for (const pc of pieces) if (pc.topY !== undefined) pc.obj.visible = !(pc.topY > BOX.H - 0.15 && under < pc.topY + 0.1 && pc.obj.position.distanceTo(pc.rest.p) < 0.5);
}
