// Drinks and table props: craft beer bottle, red wine bottle, wine glass, terrine jar, string-light bokeh.
import * as THREE from 'three';
import { tex, lathe, smoothProfile, v3, deg, seeded } from './lib.js';

let glassMats = null;
function mats() {
  if (glassMats) return glassMats;
  const drops = tex('droplets', { color: false, repeat: [3, 2] });
  glassMats = {
    // fake glass (no transmission pass): glossy tinted shells with environment reflections
    amber: new THREE.MeshPhysicalMaterial({ color: 0x6a3008, roughness: 0.05, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.04, bumpMap: drops, bumpScale: 3.2, transparent: true, opacity: 0.58, envMapIntensity: 2.3, specularIntensity: 1, sheen: 0.5, sheenColor: new THREE.Color(0xffa040), sheenRoughness: 0.35, depthWrite: false }),
    beer: new THREE.MeshPhysicalMaterial({ color: 0x8a4208, roughness: 0.25, emissive: 0xb85a10, emissiveIntensity: 0.42, sheen: 0.6, sheenColor: new THREE.Color(0xffb050) }),
    crown: new THREE.MeshStandardMaterial({ color: 0xc9a15b, metalness: 1, roughness: 0.28 }),
    darkGlass: new THREE.MeshPhysicalMaterial({ color: 0x1c0a0e, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.6, sheen: 0.5, sheenColor: new THREE.Color(0x8a1028), sheenRoughness: 0.35 }),
    clear: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.03, transparent: true, opacity: 0.16, envMapIntensity: 2.2, specularIntensity: 1, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide }),
    wine: new THREE.MeshPhysicalMaterial({ color: 0x4a0612, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.9, sheen: 0.6, sheenColor: new THREE.Color(0xc0203a), envMapIntensity: 1.2 }),
    cap: new THREE.MeshStandardMaterial({ color: 0xc9a15b, metalness: 1, roughness: 0.3 }),
    capsule: new THREE.MeshPhysicalMaterial({ color: 0x4a0f18, metalness: 0.7, roughness: 0.35, clearcoat: 0.6 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xcfcac0, metalness: 1, roughness: 0.25 }),
    seal: new THREE.MeshStandardMaterial({ color: 0xd2752e, roughness: 0.55 }),
  };
  return glassMats;
}

function labelBand(texName, r, y0, y1, arc = 160, rot = 0) {
  const m = new THREE.MeshStandardMaterial({ map: tex(texName, { wrap: false }), roughness: 0.75 });
  const g = new THREE.CylinderGeometry(r, r, y1 - y0, 64, 1, true, deg(-arc / 2) + rot, deg(arc));
  const mesh = new THREE.Mesh(g, m); mesh.position.y = (y0 + y1) / 2;
  return mesh;
}

export function beerBottle(label = 'label_beer') {
  const M = mats();
  const g = new THREE.Group();
  const prof = smoothProfile([[0.01, 0], [2.7, 0.05], [3.05, 0.5], [3.1, 2], [3.1, 13.2], [2.9, 15.2], [2.0, 17.3], [1.38, 18.8], [1.3, 21.5], [1.42, 22.2], [1.42, 22.6], [0.01, 22.6]], 140);
  // the beer inside (glowing amber where the light comes through), with an air gap in the neck
  const liq = smoothProfile([[0.01, 0.35], [2.6, 0.4], [2.92, 0.8], [2.95, 13.1], [2.75, 15.1], [1.88, 17.2], [1.2, 18.7], [1.15, 19.9], [0.01, 19.9]], 100);
  const beer = new THREE.Mesh(lathe(liq, 64), M.beer); g.add(beer);
  const body = new THREE.Mesh(lathe(prof, 72), M.amber); body.renderOrder = 2; g.add(body);
  // crown cap with its crimped skirt
  const cg = new THREE.CylinderGeometry(1.5, 1.62, 0.7, 126, 2);
  const cp = cg.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i), z = cp.getZ(i), y = cp.getY(i), a = Math.atan2(z, x), r = Math.hypot(x, z);
    if (r > 0.2) { const k = 1 + 0.055 * Math.max(0, Math.cos(a * 21)) * (y < 0.2 ? 1 : 0.3); cp.setXYZ(i, x * k, y, z * k); }
  }
  cg.computeVertexNormals();
  const cap = new THREE.Mesh(cg, M.crown); cap.position.y = 22.9; g.add(cap);
  g.add(labelBand(label, 3.13, 4.0, 11.0, 170));
  const neck = labelBand(label + '_neck', 1.34, 19.6, 21.1, 300); g.add(neck);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function wineBottle(label = 'label_wine') {
  const M = mats();
  const g = new THREE.Group();
  const prof = smoothProfile([[0.01, 0.8], [2.2, 0.35], [3.55, 0.05], [3.75, 1.0], [3.75, 20.0], [3.5, 22.2], [2.2, 24.0], [1.52, 25.5], [1.45, 29.6], [1.6, 30.0], [1.6, 30.6], [0.01, 30.6]], 160);
  g.add(new THREE.Mesh(lathe(prof, 72), M.darkGlass));
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.62, 1.58, 4.6, 32), M.capsule); cap.position.y = 28.5; g.add(cap);
  g.add(labelBand(label, 3.78, 6.0, 15.5, 150));
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function wineGlass(fill = 0.42) {
  const M = mats();
  const g = new THREE.Group();
  const outer = smoothProfile([[0.01, 0], [3.5, 0.02], [3.6, 0.18], [1.0, 0.35], [0.33, 0.9], [0.3, 7.6], [0.9, 8.6], [3.0, 10.0], [4.25, 12.6], [4.1, 15.6], [3.45, 18.6]], 120);
  const inner = smoothProfile([[3.38, 18.6], [4.0, 15.6], [4.12, 12.6], [2.9, 10.1], [0.6, 8.9], [0.01, 8.8]], 80);
  const prof = outer.concat(inner);
  g.add(new THREE.Mesh(lathe(prof, 80), M.clear));
  const fy = 8.9 + fill * 9;
  const wineProf = smoothProfile([[0.01, 8.95], [0.6, 9.0], [2.85, 10.15], [4.0, 12.6], [4.05, Math.min(fy, 15.5)]], 60);
  wineProf.push([0.01, Math.min(fy, 15.5)]);
  g.add(new THREE.Mesh(lathe(wineProf, 64), M.wine));
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function terrineJar() {
  const M = mats();
  const g = new THREE.Group();
  const prof = smoothProfile([[0.01, 0], [4.0, 0.05], [4.55, 0.6], [4.6, 7.2], [4.3, 7.8], [4.3, 8.2], [0.01, 8.2]], 80);
  g.add(new THREE.Mesh(lathe(prof, 64), M.clear));
  const pt = new THREE.MeshStandardMaterial({ map: tex('terrine', { repeat: [1.5, 0.8] }), bumpMap: tex('terrine_bump', { color: false, repeat: [1.5, 0.8] }), bumpScale: 3, roughness: 0.7 });
  const pate = new THREE.Mesh(new THREE.CylinderGeometry(4.35, 4.3, 6.4, 48), pt); pate.position.y = 3.5; g.add(pate);
  const fat = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.35, 0.5, 48), new THREE.MeshStandardMaterial({ color: 0xf2e6cf, roughness: 0.6 })); fat.position.y = 6.9; g.add(fat);
  const lidProf = smoothProfile([[0.01, 9.4], [2.5, 9.25], [4.1, 8.8], [4.4, 8.4], [4.4, 8.3]], 40);
  g.add(new THREE.Mesh(lathe(lidProf, 64), M.clear));
  const seal = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.18, 8, 64), M.seal); seal.rotation.x = Math.PI / 2; seal.position.y = 8.25; g.add(seal);
  const clip = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.07, 6, 64, Math.PI), M.metal); clip.position.y = 8.6; clip.rotation.y = Math.PI / 2; g.add(clip);
  g.add(labelBand('label_terrine', 4.63, 2.0, 5.6, 120));
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function bokehLights(n, seed, spread, color = 0xffc27a, size = 1.2) {
  const rnd = seeded(seed);
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(size, 10, 8);
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2 + rnd() * 4), toneMapped: false }));
    m.position.set((rnd() - 0.5) * spread[0], (rnd() - 0.2) * spread[1], (rnd() - 0.5) * spread[2]);
    g.add(m);
  }
  return g;
}
