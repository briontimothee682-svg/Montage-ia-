// TIM DESIGN product video (the Instagram Reel shown on the phone): three products on a marble plinth.
// window.renderAt(t) renders the frame at time t (0..3 s).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';

const W = 1080, H = 1920;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, p) => a + (b - a) * p;
const ease = p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
function studioEnv() {
  const s = new THREE.Scene(); s.background = new THREE.Color(0x1c1915);
  const box = (w, h, x, y, z, k, col) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m); };
  box(8, 5, 2, 7, 7, 8.5, 0xfff0da); box(2, 10, -9, 1, 3, 5.5, 0xffe2bc); box(1.6, 9, 8, 0, -4, 3.2, 0xa8c0ff); box(14, 2, 0, -7, 5, 1.0, 0xffffff); box(12, 12, 0, 10, 0, 0.7, 0xfff4e6);
  return pmrem.fromScene(s, 0.015).texture;
}
scene.environment = studioEnv();
const camera = new THREE.PerspectiveCamera(32, W / H, 10, 20000);

const canvasTex = (w, h, draw, srgb = true) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8; return t; };
// backdrop: teal to amber gradient wall
const wall = new THREE.Mesh(new THREE.SphereGeometry(7000, 64, 32), new THREE.MeshBasicMaterial({ side: THREE.BackSide, map: canvasTex(1024, 1024, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#070b1c'); g.addColorStop(0.5, '#101a3c'); g.addColorStop(1, '#0a0d18'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  const r = x.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, w * 0.7); r.addColorStop(0, 'rgba(255,214,160,0.32)'); r.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = r; x.fillRect(0, 0, w, h);
}) }));
wall.position.set(0, 0, 0); wall.rotation.y = Math.PI * 0.5; scene.add(wall);
// marble plinth
const marbleTex = canvasTex(1024, 512, (x, w, h) => {
  x.fillStyle = '#121212'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) { x.strokeStyle = `rgba(${200 + Math.random() * 40},${180 + Math.random() * 30},${140 + Math.random() * 30},${0.05 + Math.random() * 0.18})`; x.lineWidth = 0.5 + Math.random() * 2.5; x.beginPath(); let px = Math.random() * w, py = Math.random() * h; x.moveTo(px, py); for (let k = 0; k < 12; k++) { px += (Math.random() - 0.3) * 90; py += (Math.random() - 0.5) * 50; x.lineTo(px, py); } x.stroke(); }
});
const marble = new THREE.MeshPhysicalMaterial({ map: marbleTex, roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.1, envMapIntensity: 0.5 });
const plinth = new THREE.Mesh(new THREE.CylinderGeometry(560, 580, 220, 128), marble);
plinth.position.y = -110; plinth.receiveShadow = true; scene.add(plinth);
const rim = new THREE.Mesh(new THREE.TorusGeometry(560, 3, 12, 160), new THREE.MeshPhysicalMaterial({ color: 0xc6a056, metalness: 1, roughness: 0.3 }));
rim.rotation.x = Math.PI / 2; scene.add(rim);

const gold = new THREE.MeshPhysicalMaterial({ color: 0xf2cf7e, metalness: 1, roughness: 0.2, clearcoat: 0.4, clearcoatRoughness: 0.12, envMapIntensity: 1.6 });
const softBlack = new THREE.MeshPhysicalMaterial({ color: 0x151515, roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.4, sheen: 0.4, sheenColor: new THREE.Color(0x404040) });
const labelMat = (name, sub, dark = true, w = 1024, h = 512) => {
  const draw = (x, foilOnly) => {
    if (!foilOnly) {
      x.fillStyle = dark ? '#121212' : '#ece4d2'; x.fillRect(0, 0, w, h);
      const id = x.getImageData(0, 0, w, h);
      for (let i = 0; i < id.data.length; i += 4) { const n = (Math.random() - 0.5) * (dark ? 10 : 16); id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; }
      x.putImageData(id, 0, 0);
    } else { x.fillStyle = '#000'; x.fillRect(0, 0, w, h); }
    const foil = foilOnly ? '#ffffff' : '#d9b45f';
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
  return new THREE.MeshPhysicalMaterial({ map, metalnessMap: metal, metalness: 1, roughnessMap: rough, roughness: 1, bumpMap: metal, bumpScale: 1.2, envMapIntensity: 0.9 });
};
const label = (name, sub, w = 1024, h = 512, dark = true) => canvasTex(w, h, (x) => {
  x.fillStyle = dark ? '#0f0f0f' : '#efe7d6'; x.fillRect(0, 0, w, h);
  x.strokeStyle = '#c9a24b'; x.lineWidth = 6; x.strokeRect(w * 0.29, 40, w * 0.42, h - 80);
  x.fillStyle = '#c9a24b'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '700 76px PoppinsB, sans-serif'; x.fillText('TIM', w / 2, h * 0.32);
  x.font = '600 50px PoppinsB, sans-serif'; x.fillText('DESIGN', w / 2, h * 0.47);
  x.fillStyle = dark ? '#f3eee3' : '#1a1a1a'; x.font = '500 34px PoppinsB, sans-serif'; x.fillText(name, w / 2, h * 0.66);
  x.fillStyle = dark ? '#b9b1a2' : '#5a5a5a'; x.font = '400 24px PoppinsB, sans-serif'; x.fillText(sub, w / 2, h * 0.77);
});

let products, products_glow;
const ready = (async () => {
  try { const ff = new FontFace('PoppinsB', 'url(/assets/fonts/Poppins-SemiBold.ttf)'); await ff.load(); document.fonts.add(ff); } catch (e) {}
  const g = new THREE.Group();
  // 1. pomade jar
  const jar = new THREE.Group();
  const jb = new THREE.Mesh(new THREE.CylinderGeometry(150, 152, 150, 128, 1, true), labelMat('Cire coiffante', 'Tenue forte · fini mat'));
  jar.add(jb);
  const jbot = new THREE.Mesh(new THREE.CylinderGeometry(152, 152, 4, 128), softBlack); jbot.position.y = -75; jar.add(jbot);
  const lidG = new THREE.Group(); lidG.position.y = 103; jar.add(lidG);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(158, 158, 56, 128), gold); lidG.add(lid);
  const lidTop = new THREE.Mesh(new THREE.CircleGeometry(156, 96), new THREE.MeshPhysicalMaterial({ map: canvasTex(512, 512, (x, w, h) => { x.fillStyle = '#c9a24b'; x.fillRect(0, 0, w, h); for (let r = 30; r < w / 2; r += 3) { x.strokeStyle = `rgba(255,240,200,${0.05 + 0.08 * Math.random()})`; x.beginPath(); x.arc(w / 2, h / 2, r, 0, Math.PI * 2); x.stroke(); } x.fillStyle = '#6e5320'; x.font = '700 58px PoppinsB, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('TIM DESIGN', w / 2, h / 2); }), metalness: 1, roughness: 0.32 }));
  lidTop.rotation.x = -Math.PI / 2; lidTop.position.y = 28.5; lidG.add(lidTop);
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(140, 140, 6, 96), new THREE.MeshPhysicalMaterial({ color: 0x2a2015, roughness: 0.35, clearcoat: 0.6 })); wax.position.y = 70; jar.add(wax);
  jar.position.set(-290, 75, 140); jb.rotation.y = -Math.PI * 0.5; g.add(jar);
  // 2. beard oil: amber glass, gold dropper
  const oil = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(78, 80, 300, 128), new THREE.MeshPhysicalMaterial({ color: 0xc98a4a, roughness: 0.02, metalness: 0, clearcoat: 1, transmission: 0.92, thickness: 8, ior: 1.52, attenuationColor: new THREE.Color(0x9a4a12), attenuationDistance: 220, envMapIntensity: 1.2, specularIntensity: 1 }));
  oil.add(glass);
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(72, 74, 236, 96), new THREE.MeshPhysicalMaterial({ color: 0xb8661c, roughness: 0.1, transmission: 0.6, thickness: 120, attenuationColor: new THREE.Color(0x7a3006), attenuationDistance: 90, ior: 1.47 }));
  liquid.position.y = -28; oil.add(liquid);
  const shoulder = new THREE.Mesh(new THREE.SphereGeometry(80, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2), glass.material); shoulder.scale.y = 0.45; shoulder.position.y = 150; oil.add(shoulder);
  const lab = new THREE.Mesh(new THREE.CylinderGeometry(81.5, 81.5, 170, 96, 1, true, -Math.PI * 0.55, Math.PI * 1.1), labelMat('Huile à barbe', 'Bois de cèdre · 30 ml'));
  lab.position.y = -20; oil.add(lab);
  const dropG = new THREE.Group(); dropG.position.y = 210; oil.add(dropG);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(40, 44, 60, 64), gold); dropG.add(collar);
  const bulb = new THREE.Mesh(new THREE.CapsuleGeometry(30, 60, 12, 32), new THREE.MeshPhysicalMaterial({ color: 0x0c0c0c, roughness: 0.4, clearcoat: 0.6 })); bulb.position.y = 80; dropG.add(bulb);
  const pipette = new THREE.Mesh(new THREE.CylinderGeometry(9, 5, 200, 24), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, transmission: 0.95, thickness: 4, ior: 1.5 })); pipette.position.y = -130; dropG.add(pipette);
  const drop = new THREE.Mesh(new THREE.SphereGeometry(18, 32, 16), new THREE.MeshPhysicalMaterial({ color: 0xf0a84a, roughness: 0.04, transmission: 0.35, thickness: 20, ior: 1.47, emissive: 0x6a3608, emissiveIntensity: 1.2 })); drop.scale.y = 1.25; oil.add(drop);
  oil.position.set(40, 150, -80); g.add(oil);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshBasicMaterial({ map: canvasTex(256, 256, (x, w, h) => { const r = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); r.addColorStop(0, 'rgba(255,190,120,0.55)'); r.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = r; x.fillRect(0, 0, w, h); }), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.position.set(40, 260, -700); scene.add(glow); products_glow = glow;
  // 3. shampoo: matte black bottle, gold pump
  const sh = new THREE.Group();
  const sp = [[0, -230], [120, -230], [128, -220], [128, 160], [110, 205], [52, 232], [40, 240], [0, 240]].map(([x, y]) => new THREE.Vector2(x, y));
  const shb = new THREE.Mesh(new THREE.LatheGeometry(sp, 96), softBlack); sh.add(shb);
  const shl = new THREE.Mesh(new THREE.CylinderGeometry(129.5, 129.5, 220, 96, 1, true, -Math.PI * 0.5, Math.PI), labelMat('Shampoing', 'Cheveux & barbe · 250 ml', false));
  shl.position.y = -20; sh.add(shl);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(36, 40, 40, 48), gold); neck.position.y = 262; sh.add(neck);
  const pumpG = new THREE.Group(); sh.add(pumpG);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 60, 24), gold); stem.position.y = 310; pumpG.add(stem);
  const head = new THREE.Mesh(new THREE.BoxGeometry(150, 34, 46), gold); head.position.set(40, 352, 0); pumpG.add(head);
  sh.position.set(300, 230, 40); g.add(sh);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(g);
  products = { g, jar, oil, sh, lidG, dropG, drop, pumpG };
  // turntable: plinth + products rotate together
  const turn = new THREE.Group(); scene.remove(g); turn.add(g); scene.add(turn); products.turn = turn;
  // gold dust drifting up through the light
  const N = 320, pos = new Float32Array(N * 3), base = [];
  for (let i = 0; i < N; i++) base.push([(Math.random() - 0.5) * 2200, Math.random() * 1600 - 300, (Math.random() - 0.5) * 1600, Math.random() * 6.28, 40 + Math.random() * 90]);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dot = canvasTex(64, 64, (x, w, h) => { const r = x.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,236,190,1)'); r.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = r; x.fillRect(0, 0, w, h); });
  products.dust = new THREE.Points(pg, new THREE.PointsMaterial({ size: 14, map: dot, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xf2cf7e, opacity: 0.6 }));
  products.dust.userData = { base, pos }; scene.add(products.dust);
  // lights
  const key = new THREE.DirectionalLight(0xffe2b8, 2.6); key.position.set(900, 1600, 1400); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -900, right: 900, top: 900, bottom: -900, near: 100, far: 5000 }); key.shadow.bias = -0.0005; key.shadow.radius = 6;
  scene.add(key);
  const rimL = new THREE.SpotLight(0x8fb0ff, 3.2, 0, 0.5, 0.7, 1); rimL.position.set(-1400, 800, -900); scene.add(rimL);
  const amber = new THREE.SpotLight(0xffa24a, 2.8, 0, 0.55, 0.7, 1); amber.position.set(1300, 600, -700); scene.add(amber);
  scene.add(new THREE.AmbientLight(0x30261a, 0.5));
  products.sweep = new THREE.PointLight(0xfff0d8, 0, 1800, 1.2); scene.add(products.sweep);
})();

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType }));
composer.addPass(new RenderPass(scene, camera));
const bokeh = new BokehPass(scene, camera, { focus: 3000, aperture: 0.00018, maxblur: 0.006 });
composer.addPass(bokeh);
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.16, 0.5, 0.97));
composer.addPass(new OutputPass());

const easeOut = p => 1 - Math.pow(1 - p, 3);
const easeBack = (p, k = 1.6) => { p -= 1; return 1 + (k + 1) * p * p * p + k * p * p; };
window.renderAt = async t => {
  await ready;
  const P = products;
  // camera: sweeping arc that pushes in on the products
  const e = ease(prog(t, 0, 3));
  const a = lerp(-0.75, 0.6, e), r = lerp(3500, 2950, e);
  camera.position.set(Math.sin(a) * r, lerp(760, 430, e), Math.cos(a) * r);
  camera.lookAt(0, lerp(220, 200, e), 0);
  bokeh.uniforms.focus.value = camera.position.distanceTo(new THREE.Vector3(40, 200, -80));
  // turntable
  P.turn.rotation.y = -0.5 + t * 0.32;
  // products rise one after the other and float
  [[P.jar, 75, 0.15], [P.oil, 150, 0.3], [P.sh, 230, 0.45]].forEach(([o, y0, st], i) => {
    const up = easeBack(prog(t, st, st + 0.7), 1.4);
    o.position.y = y0 + 90 * up + 14 * Math.sin(t * 3 + i * 1.7) * up;
    o.rotation.z = 0.05 * Math.sin(t * 2.2 + i) * up;
  });
  P.jar.rotation.y = -0.4 + t * 0.6;
  // pomade lid lifts and spins open
  const lq = easeOut(prog(t, 0.6, 1.3));
  P.lidG.position.y = 103 + 170 * lq; P.lidG.rotation.set(0.28 * lq, t * 3.2 * lq, 0.12 * lq);
  // dropper rises out of the beard oil, a golden drop forms and falls
  const dq = easeOut(prog(t, 1.0, 1.6));
  P.dropG.position.y = 210 + 240 * dq; P.dropG.rotation.z = -0.25 * dq;
  const tipY = P.dropG.position.y - 230, tipX = Math.sin(0.25 * dq) * 230;
  const fall = prog(t, 1.85, 2.35), form = easeOut(prog(t, 1.55, 1.85));
  P.drop.visible = t > 1.55 && fall < 1;
  P.drop.position.set(tipX, tipY - 14 - fall * fall * 420, 0);
  P.drop.scale.set(form, form * (1.25 + fall * 0.4), form);
  // shampoo pump presses on the beat
  const pq = Math.sin(Math.PI * prog(t, 2.2, 2.55));
  P.pumpG.position.y = -28 * pq;
  // light sweeps and gold dust
  const sp = prog(t, 0.3, 1.5), sp2 = prog(t, 1.9, 2.9);
  const sv = sp > 0 && sp < 1 ? sp : sp2;
  P.sweep.intensity = 5 * Math.sin(clamp(sv) * Math.PI); P.sweep.position.set(lerp(-1000, 1000, clamp(sv)), 520, 800);
  const { base, pos } = P.dust.userData;
  base.forEach(([x, y, z, ph, v], i) => { pos[i * 3] = x + 30 * Math.sin(t + ph); pos[i * 3 + 1] = ((y + v * t + 300) % 1600) - 300; pos[i * 3 + 2] = z; });
  P.dust.geometry.attributes.position.needsUpdate = true;
  products_glow.lookAt(camera.position);
  composer.render();
  return true;
};
window.__ready = ready.then(() => true);
