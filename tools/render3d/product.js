// TIM DESIGN product commercial shown in the Instagram Reel: five quick cinematic shots, warm golden light.
//  A hero bottle on stone & moss with leaf shadows · B macro dropper + falling drop · C macro golden liquid with bubbles
//  D label close-up pan · E hero line-up of the three products.  window.renderAt(t), t in 0..3 s.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const W = 1080, H = 1920;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, p) => a + (b - a) * p;
const ease = p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const easeOut = p => 1 - Math.pow(1 - p, 3);
function seeded(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
{
  const s = new THREE.Scene(); s.background = new THREE.Color(0x3a2410);
  const box = (w, h, x, y, z, k, col) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m); };
  box(8, 5, -3, 7, 6, 7, 0xffe0b0); box(2, 10, 9, 1, 2, 4, 0xffc888); box(12, 2, 0, -7, 5, 1.2, 0xffd9a8); box(12, 12, 0, 10, 0, 0.8, 0xfff0dc);
  scene.environment = pmrem.fromScene(s, 0.02).texture;
}
const camera = new THREE.PerspectiveCamera(30, W / H, 5, 30000);
const canvasTex = (w, h, draw, srgb = true) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };

// ---- warm sunset backdrop ----------------------------------------------------------------------------------
const sky = new THREE.Mesh(new THREE.SphereGeometry(12000, 64, 32), new THREE.MeshBasicMaterial({ side: THREE.BackSide, map: canvasTex(64, 1024, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#3a1e0a'); g.addColorStop(0.35, '#9a5a20'); g.addColorStop(0.5, '#d89a48'); g.addColorStop(0.62, '#b8742c'); g.addColorStop(1, '#2a1406');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
}) }));
scene.add(sky);
const wall = new THREE.Mesh(new THREE.PlaneGeometry(9000, 7000), new THREE.MeshStandardMaterial({ color: 0xd9a05a, roughness: 0.95 }));
wall.position.set(0, 1500, -2600); wall.receiveShadow = true; scene.add(wall);

// ---- materials ---------------------------------------------------------------------------------------------
const gold = new THREE.MeshPhysicalMaterial({ color: 0xf2cf7e, metalness: 1, roughness: 0.2, clearcoat: 0.4, clearcoatRoughness: 0.12, envMapIntensity: 1.5 });
const softBlack = new THREE.MeshPhysicalMaterial({ color: 0x151515, roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.4, sheen: 0.4, sheenColor: new THREE.Color(0x404040) });
const labelMat = (name, sub, dark = true, w = 1024, h = 512) => {
  const draw = (x, foilOnly) => {
    if (!foilOnly) {
      x.fillStyle = dark ? '#121212' : '#ece4d2'; x.fillRect(0, 0, w, h);
      const id = x.getImageData(0, 0, w, h);
      for (let i = 0; i < id.data.length; i += 4) { const n = (Math.random() - 0.5) * (dark ? 10 : 16); id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; }
      x.putImageData(id, 0, 0);
    } else { x.fillStyle = '#000'; x.fillRect(0, 0, w, h); }
    const foil = foilOnly ? '#ffffff' : '#e3be68';
    x.strokeStyle = foil; x.lineWidth = 5; x.strokeRect(w * 0.29, 40, w * 0.42, h - 80);
    x.fillStyle = foil; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '700 76px PoppinsB, sans-serif'; x.fillText('TIM', w / 2, h * 0.32);
    x.font = '600 50px PoppinsB, sans-serif'; x.fillText('DESIGN', w / 2, h * 0.47);
    if (!foilOnly) {
      x.fillStyle = dark ? '#ece5d8' : '#1a1a1a'; x.font = '500 34px PoppinsB, sans-serif'; x.fillText(name, w / 2, h * 0.66);
      x.fillStyle = dark ? '#a9a193' : '#5a5a5a'; x.font = '400 24px PoppinsB, sans-serif'; x.fillText(sub, w / 2, h * 0.77);
    }
  };
  const map = canvasTex(w, h, x => draw(x, false));
  const metal = canvasTex(w, h, x => draw(x, true), false);
  const rough = canvasTex(w, h, x => { draw(x, true); const id = x.getImageData(0, 0, w, h); for (let i = 0; i < id.data.length; i += 4) { const v = id.data[i] > 128 ? 70 : 215; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; } x.putImageData(id, 0, 0); }, false);
  [map, metal, rough].forEach(t => { t.wrapS = THREE.ClampToEdgeWrapping; });
  return new THREE.MeshPhysicalMaterial({ map, metalnessMap: metal, metalness: 1, roughnessMap: rough, roughness: 1, bumpMap: metal, bumpScale: 1.2, envMapIntensity: 0.9 });
};
function stone(r, seed) {
  let g0 = new THREE.IcosahedronGeometry(r, 5); g0.deleteAttribute('normal'); g0.deleteAttribute('uv');
  const g = mergeVertices(g0), p = g.attributes.position, rr = seeded(seed), v = new THREE.Vector3();
  const f = [rr() * 6, rr() * 6, rr() * 6];
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = v.clone().normalize(); const d = 1 + 0.09 * Math.sin(n.x * 3 + f[0]) * Math.cos(n.y * 4 + f[1]) + 0.05 * Math.sin(n.z * 7 + f[2]); v.multiplyScalar(d); v.y *= 0.55; p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals();
  { const uv = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); uv[i * 2] = 0.5 + Math.atan2(v.z, v.x) / 6.283; uv[i * 2 + 1] = 0.5 + v.y / (2 * r); } g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); }
  const tex = canvasTex(512, 512, (x, w, h) => { x.fillStyle = '#7d7266'; x.fillRect(0, 0, w, h); for (let i = 0; i < 6000; i++) { const c = 90 + Math.random() * 80; x.fillStyle = `rgba(${c},${c * 0.93},${c * 0.85},0.35)`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } });
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, bumpMap: tex, bumpScale: 3, envMapIntensity: 0.5 }));
  m.castShadow = m.receiveShadow = true; return m;
}
function moss(n, cx, cz, spread, y, seed) {
  const rr = seeded(seed), geo = new THREE.SphereGeometry(1, 10, 8);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), n);
  const d = new THREE.Object3D();
  for (let i = 0; i < n; i++) { const a = rr() * 6.28, r = Math.sqrt(rr()) * spread; d.position.set(cx + Math.cos(a) * r, y + rr() * 10, cz + Math.sin(a) * r * 0.7); d.scale.setScalar(2.5 + rr() * 6); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix); mesh.setColorAt(i, new THREE.Color().setHSL(0.2 + rr() * 0.06, 0.4, 0.1 + rr() * 0.1)); }
  mesh.castShadow = mesh.receiveShadow = true; return mesh;
}

let A;
const ready = (async () => {
  try { const ff = new FontFace('PoppinsB', 'url(/assets/fonts/Poppins-SemiBold.ttf)'); await ff.load(); document.fonts.add(ff); } catch (e) {}
  A = {};
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -120; ground.receiveShadow = true; scene.add(ground);
  const s1 = stone(420, 3); s1.position.set(0, -60, 0); scene.add(s1);
  const s2 = stone(260, 9); s2.position.set(-340, -90, 200); scene.add(s2);
  const s3 = stone(300, 21); s3.position.set(340, -80, 160); scene.add(s3);
  scene.add(moss(1400, 0, 0, 330, 150, 5), moss(700, -330, 200, 200, 70, 6), moss(700, 330, 160, 220, 80, 7));
  // beard oil (hero)
  const oil = new THREE.Group();
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xc69456, roughness: 0.02, metalness: 0, clearcoat: 1, transmission: 0.9, thickness: 8, ior: 1.52, attenuationColor: new THREE.Color(0xa86a22), attenuationDistance: 260, envMapIntensity: 1.3, specularIntensity: 1 });
  oil.add(new THREE.Mesh(new THREE.CylinderGeometry(78, 80, 300, 128), glassMat));
  const shoulder = new THREE.Mesh(new THREE.SphereGeometry(80, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2), glassMat); shoulder.scale.y = 0.45; shoulder.position.y = 150; oil.add(shoulder);
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(72, 74, 236, 96), new THREE.MeshPhysicalMaterial({ color: 0xc8882a, roughness: 0.1, transmission: 0.55, thickness: 120, attenuationColor: new THREE.Color(0x9a5410), attenuationDistance: 110, ior: 1.47 }));
  liquid.position.y = -28; oil.add(liquid);
  const lab = new THREE.Mesh(new THREE.CylinderGeometry(81.5, 81.5, 170, 96, 1, true, -Math.PI * 0.55, Math.PI * 1.1), labelMat('Huile à barbe', 'Bois de cèdre · 30 ml'));
  lab.position.y = -20; oil.add(lab);
  const dropG = new THREE.Group(); dropG.position.y = 210; oil.add(dropG);
  dropG.add(new THREE.Mesh(new THREE.CylinderGeometry(40, 44, 60, 64), gold));
  const bulb = new THREE.Mesh(new THREE.CapsuleGeometry(30, 60, 12, 32), new THREE.MeshPhysicalMaterial({ color: 0x0c0c0c, roughness: 0.4, clearcoat: 0.6 })); bulb.position.y = 80; dropG.add(bulb);
  const pip = new THREE.Mesh(new THREE.CylinderGeometry(9, 5, 200, 24), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, transmission: 0.95, thickness: 4, ior: 1.5 })); pip.position.y = -130; dropG.add(pip);
  const pipOil = new THREE.Mesh(new THREE.CylinderGeometry(6, 3.5, 120, 16), new THREE.MeshPhysicalMaterial({ color: 0xd88a2c, roughness: 0.1, transmission: 0.4, thickness: 10 })); pipOil.position.y = -168; dropG.add(pipOil);
  const drop = new THREE.Mesh(new THREE.SphereGeometry(14, 32, 16), new THREE.MeshPhysicalMaterial({ color: 0xf0a84a, roughness: 0.03, transmission: 0.45, thickness: 22, ior: 1.47, emissive: 0x5a2c06, emissiveIntensity: 1 }));
  oil.add(drop);
  oil.position.set(0, 330, 0); oil.rotation.y = 0.2; scene.add(oil);
  // pomade jar + shampoo for the line-up
  const jar = new THREE.Group();
  const jb = new THREE.Mesh(new THREE.CylinderGeometry(150, 152, 150, 128, 1, true), labelMat('Cire coiffante', 'Tenue forte · fini mat')); jb.rotation.y = -Math.PI * 0.5; jar.add(jb);
  const jbot = new THREE.Mesh(new THREE.CylinderGeometry(152, 152, 4, 128), softBlack); jbot.position.y = -75; jar.add(jbot);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(158, 158, 56, 128), gold); lid.position.y = 103; jar.add(lid);
  jar.position.set(-340, 205, 230); jar.scale.setScalar(0.8); scene.add(jar);
  const shp = new THREE.Group();
  const sp = [[0, -230], [120, -230], [128, -220], [128, 160], [110, 205], [52, 232], [40, 240], [0, 240]].map(([x, y]) => new THREE.Vector2(x, y));
  shp.add(new THREE.Mesh(new THREE.LatheGeometry(sp, 96), softBlack));
  const shl = new THREE.Mesh(new THREE.CylinderGeometry(129.5, 129.5, 220, 96, 1, true, -Math.PI * 0.5, Math.PI), labelMat('Shampoing', 'Cheveux & barbe · 250 ml', false)); shl.position.y = -20; shp.add(shl);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(36, 40, 40, 48), gold); neck.position.y = 262; shp.add(neck);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 60, 24), gold); stem.position.y = 310; shp.add(stem);
  const head = new THREE.Mesh(new THREE.BoxGeometry(150, 34, 46), gold); head.position.set(40, 352, 0); shp.add(head);
  shp.position.set(345, 330, 180); shp.scale.setScalar(0.75); scene.add(shp);
  [oil, jar, shp].forEach(o => o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }));
  Object.assign(A, { oil, dropG, drop, jar, shp });
  // sun through leaves: spot light with a leaf cookie
  const leafTex = canvasTex(1024, 1024, (x, w, h) => {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h);
    const rr = seeded(77);
    for (let i = 0; i < 90; i++) { x.save(); x.translate(rr() * w, rr() * h); x.rotate(rr() * 6.28); x.fillStyle = `rgba(0,0,0,${0.55 + rr() * 0.4})`; const L = 40 + rr() * 110; x.beginPath(); x.ellipse(0, 0, L, L * 0.38, 0, 0, Math.PI * 2); x.fill(); x.restore(); }
  });
  const sun = new THREE.SpotLight(0xffc27a, 3.2, 0, 0.75, 0.35, 0);
  sun.position.set(-1800, 2600, 1600); sun.target.position.set(0, 150, 0); sun.map = leafTex; sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.radius = 4; sun.shadow.camera.near = 500; sun.shadow.camera.far = 9000;
  scene.add(sun, sun.target);
  const rim = new THREE.SpotLight(0xffb060, 1.6, 0, 0.5, 0.7, 0); rim.position.set(1500, 900, -1400); rim.target.position.set(0, 300, 0); scene.add(rim, rim.target);
  scene.add(new THREE.AmbientLight(0x5a3a1c, 0.35));
  A.sun = sun;
  // macro liquid set, far from the main set: animated golden liquid + bubbles
  const liq = new THREE.Group(); liq.position.set(20000, 0, 0); scene.add(liq);
  const lc = document.createElement('canvas'); lc.width = 512; lc.height = 1024;
  A.liqCtx = lc.getContext('2d'); A.liqTex = new THREE.CanvasTexture(lc); A.liqTex.colorSpace = THREE.SRGBColorSpace;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(1400, 2600), new THREE.MeshBasicMaterial({ map: A.liqTex })); back.position.z = -400; liq.add(back);
  const bubMat = new THREE.MeshPhysicalMaterial({ color: 0xffe2b0, roughness: 0, transmission: 1, thickness: 30, ior: 1.33, clearcoat: 1, envMapIntensity: 1.6 });
  const rb = seeded(12);
  A.bubbles = [...Array(46).keys()].map(() => { const b = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), bubMat); b.userData = { r: lerp(8, 70, Math.pow(rb(), 2)), x: lerp(-600, 600, rb()), y0: lerp(-1300, 1300, rb()), z: lerp(-250, 250, rb()), v: lerp(120, 420, rb()), ph: rb() * 6.28 }; liq.add(b); return b; });
  A.liq = liq;
})();

function drawLiquid(t) {
  const x = A.liqCtx, w = 512, h = 1024;
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#5a2a06'); g.addColorStop(0.5, '#c07a22'); g.addColorStop(1, '#4a2204'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) {
    const cx = w * (0.5 + 0.45 * Math.sin(i * 1.7 + t * 0.9)), cy = h * (0.5 + 0.45 * Math.sin(i * 2.3 + t * 0.6 + 1)), r = 60 + 70 * (0.5 + 0.5 * Math.sin(i + t * 1.3));
    const rg = x.createRadialGradient(cx, cy, 0, cx, cy, r); rg.addColorStop(0, 'rgba(255,214,130,0.42)'); rg.addColorStop(1, 'rgba(255,170,60,0)');
    x.fillStyle = rg; x.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  }
  A.liqTex.needsUpdate = true;
}

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType }));
composer.addPass(new RenderPass(scene, camera));
const bokeh = new BokehPass(scene, camera, { focus: 3000, aperture: 0.0002, maxblur: 0.008 });
composer.addPass(bokeh);
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.22, 0.6, 0.94));
composer.addPass(new OutputPass());

const CUTS = [0.6, 1.25, 1.8, 2.35];
window.renderAt = async t => {
  await ready;
  const shot = CUTS.filter(c => t >= c).length;  // 0..4
  const look = (px, py, pz, tx, ty, tz, aperture) => { camera.position.set(px, py, pz); camera.lookAt(tx, ty, tz); bokeh.uniforms.focus.value = camera.position.distanceTo(new THREE.Vector3(tx, ty, tz)); bokeh.uniforms.aperture.value = aperture; };
  // dropper rises, a golden drop forms at the tip and falls
  A.dropG.position.y = 210 + 520 * easeOut(prog(t, 0.0, 0.7));
  const form = easeOut(prog(t, 0.65, 0.95)), fall = prog(t, 0.95, 1.25);
  A.drop.visible = t > 0.65 && fall < 1;
  A.drop.position.set(0, A.dropG.position.y - 246 - fall * fall * 330, 0);
  A.drop.scale.set(Math.max(0.01, form), Math.max(0.01, form) * (1.2 + fall * 0.5), Math.max(0.01, form));
  A.liq.visible = shot === 2;
  A.sun.intensity = 3.2 * (0.92 + 0.08 * Math.sin(t * 5));
  A.oil.rotation.y = 0.2;
  if (shot === 0) {            // A: hero bottle, slow push-in
    const p = ease(prog(t, 0, 0.6));
    look(lerp(-260, -120, p), lerp(620, 560, p), lerp(2500, 2050, p), 0, 470, 0, 0.00022);
  } else if (shot === 1) {     // B: macro on the dropper tip and the falling drop
    const p = prog(t, 0.6, 1.25), ty = 330 + A.dropG.position.y - 246 + lerp(40, -200, ease(p));
    look(lerp(170, 110, p), ty + 30, lerp(640, 560, p), 0, ty, 0, 0.0009);
  } else if (shot === 2) {     // C: macro golden liquid with rising bubbles
    drawLiquid(t);
    A.bubbles.forEach(b => { const u = b.userData; b.scale.setScalar(u.r); b.position.set(u.x + 30 * Math.sin(t * 2 + u.ph), ((u.y0 + u.v * t + 1300) % 2600) - 1300, u.z); });
    const p = prog(t, 1.25, 1.8);
    look(20000 + lerp(-60, 60, p), lerp(-80, 80, p), 1500, 20000, 0, 0, 0.0005);
  } else if (shot === 3) {     // D: label close-up pan
    const p = ease(prog(t, 1.8, 2.35));
    A.oil.rotation.y = 0.2 + lerp(-0.5, 0.4, p);
    look(lerp(-180, 160, p), 320, 520, 0, 310, 0, 0.0006);
  } else {                     // E: hero line-up, slow pull-out
    const p = ease(prog(t, 2.35, 3.0));
    look(lerp(150, 0, p), lerp(700, 760, p), lerp(3300, 3900, p), 0, 330, 0, 0.00012);
  }
  composer.render();
  return true;
};
window.__ready = ready.then(() => true);
