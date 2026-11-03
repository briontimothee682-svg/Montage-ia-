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
const camera = new THREE.PerspectiveCamera(32, W / H, 10, 10000);

const canvasTex = (w, h, draw, srgb = true) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8; return t; };
// backdrop: teal to amber gradient wall
const wall = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshBasicMaterial({ map: canvasTex(512, 1024, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#070b1c'); g.addColorStop(0.5, '#101a3c'); g.addColorStop(1, '#0a0d18'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  const r = x.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, w * 0.7); r.addColorStop(0, 'rgba(255,214,160,0.32)'); r.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = r; x.fillRect(0, 0, w, h);
}) }));
wall.position.set(0, 400, -3200); scene.add(wall);
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
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(158, 158, 56, 128), gold); lid.position.y = 103; jar.add(lid);
  const lidTop = new THREE.Mesh(new THREE.CircleGeometry(156, 96), new THREE.MeshPhysicalMaterial({ map: canvasTex(512, 512, (x, w, h) => { x.fillStyle = '#c9a24b'; x.fillRect(0, 0, w, h); for (let r = 30; r < w / 2; r += 3) { x.strokeStyle = `rgba(255,240,200,${0.05 + 0.08 * Math.random()})`; x.beginPath(); x.arc(w / 2, h / 2, r, 0, Math.PI * 2); x.stroke(); } x.fillStyle = '#6e5320'; x.font = '700 58px PoppinsB, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('TIM DESIGN', w / 2, h / 2); }), metalness: 1, roughness: 0.32 }));
  lidTop.rotation.x = -Math.PI / 2; lidTop.position.y = 131.5; jar.add(lidTop);
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
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(40, 44, 60, 64), gold); collar.position.y = 210; oil.add(collar);
  const bulb = new THREE.Mesh(new THREE.CapsuleGeometry(30, 60, 12, 32), new THREE.MeshPhysicalMaterial({ color: 0x0c0c0c, roughness: 0.4, clearcoat: 0.6 })); bulb.position.y = 290; oil.add(bulb);
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
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 60, 24), gold); stem.position.y = 310; sh.add(stem);
  const head = new THREE.Mesh(new THREE.BoxGeometry(150, 34, 46), gold); head.position.set(40, 352, 0); sh.add(head);
  sh.position.set(300, 230, 40); g.add(sh);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(g);
  products = { g, jar, oil, sh };
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

window.renderAt = async t => {
  await ready;
  const a = lerp(-0.55, 0.55, ease(prog(t, 0, 3)));            // slow orbit around the products
  const r = 3150;
  camera.position.set(Math.sin(a) * r, 520 - 120 * prog(t, 0, 3), Math.cos(a) * r);
  camera.lookAt(0, 170, 0);
  bokeh.uniforms.focus.value = camera.position.distanceTo(new THREE.Vector3(40, 170, -80));
  products_glow.lookAt(camera.position);
  products.jar.rotation.y = -0.4 + t * 0.25; products.sh.rotation.y = -0.15 + t * 0.12;
  const sp = prog(t, 0.6, 1.8);
  products.sweep.intensity = 4 * Math.sin(sp * Math.PI); products.sweep.position.set(lerp(-900, 900, sp), 500, 700);
  composer.render();
  return true;
};
window.__ready = ready.then(() => true);
