// 3D layer of the ATELIER 47 reel. window.renderAt(t) draws the frame for time t (seconds).
// World units = pixels on the z=0 plane: P(x, y) maps a 1080x1920 screen position to world space.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const W = 1080, H = 1920, BEAT = 0.5;
const FOV = 30;
const CAM_Z = (H / 2) / Math.tan(THREE.MathUtils.degToRad(FOV / 2));

// ------------------------------------------------------------ helpers
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const easeOut = p => 1 - Math.pow(1 - p, 3);
const easeInOut = p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const easeBack = (p, s = 1.6) => { p -= 1; return 1 + (s + 1) * p * p * p + s * p * p; };
const lerp = (a, b, p) => a + (b - a) * p;
const beat = (t, start) => (t < start ? 0 : Math.exp(-(((t - start) % BEAT) / BEAT) * 6));
const P = (x, y, z = 0) => new THREE.Vector3(x - W / 2, H / 2 - y, z);
function seeded(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// ------------------------------------------------------------ renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

const camera = new THREE.PerspectiveCamera(FOV, W / H, 10, 12000);
camera.position.set(0, 0, CAM_Z);

const key = new THREE.DirectionalLight(0xffd9a0, 2.6); key.position.set(900, 1400, 2200); scene.add(key);
const rim = new THREE.DirectionalLight(0xfff3dd, 1.6); rim.position.set(-1400, -400, -800); scene.add(rim);
const fill = new THREE.AmbientLight(0x3a2c18, 0.6); scene.add(fill);
const sweep = new THREE.PointLight(0xfff0d0, 0, 1600, 1.2); scene.add(sweep);

const target = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
const composer = new EffectComposer(renderer, target);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.32, 0.5, 0.93);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ------------------------------------------------------------ materials
const gold = new THREE.MeshStandardMaterial({ color: 0xd8b064, metalness: 1.0, roughness: 0.24, envMapIntensity: 1.25 });
const goldBrushed = new THREE.MeshStandardMaterial({ color: 0xc9a24b, metalness: 1.0, roughness: 0.38, envMapIntensity: 1.1 });
const blackGloss = new THREE.MeshStandardMaterial({ color: 0x0d0d0d, metalness: 0.55, roughness: 0.28 });
const blackMatte = new THREE.MeshStandardMaterial({ color: 0x141414, metalness: 0.2, roughness: 0.6 });
const cream = new THREE.MeshStandardMaterial({ color: 0xcfc8ba, metalness: 0.05, roughness: 0.6 });
const steel = new THREE.MeshStandardMaterial({ color: 0xe9e2d2, metalness: 1.0, roughness: 0.18 });

// ------------------------------------------------------------ assets
const texLoader = new THREE.TextureLoader();
async function tex(url) { const t = await texLoader.loadAsync(url); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
async function font(url) { const json = await new Promise((res, rej) => new TTFLoader().load(url, res, undefined, rej)); return new Font(json); }

function textMesh(str, fnt, mat, width, depth = 34) {
  const g = new TextGeometry(str, { font: fnt, size: 100, height: depth, curveSegments: 6, bevelEnabled: true, bevelThickness: 5, bevelSize: 3, bevelSegments: 3 });
  g.computeBoundingBox();
  const b = g.boundingBox;
  g.translate(-(b.max.x + b.min.x) / 2, -(b.max.y + b.min.y) / 2, -(b.max.z + b.min.z) / 2);
  const m = new THREE.Mesh(g, mat);
  const s = width / (b.max.x - b.min.x);
  m.scale.set(s, s, s);
  const grp = new THREE.Group(); grp.add(m); grp.userData.h = (b.max.y - b.min.y) * s;
  return grp;
}

// ------------------------------------------------------------ models
function medallion(logoTex) {
  const g = new THREE.Group();
  const rimGeo = new THREE.CylinderGeometry(300, 300, 40, 128, 1, false);
  rimGeo.rotateX(Math.PI / 2);
  g.add(new THREE.Mesh(rimGeo, gold));
  const faceMat = new THREE.MeshStandardMaterial({ map: logoTex, metalness: 0.35, roughness: 0.4, emissive: 0xffffff, emissiveMap: logoTex, emissiveIntensity: 0.45 });
  const front = new THREE.Mesh(new THREE.CircleGeometry(286, 128), faceMat); front.position.z = 20.5; g.add(front);
  const back = front.clone(); back.rotation.y = Math.PI; back.position.z = -20.5; g.add(back);
  for (const [r, tube, z] of [[300, 7, 20], [300, 7, -20], [330, 3, 0]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 16, 160), gold); ring.position.z = z; g.add(ring);
  }
  return g;
}

function scissors() {
  const g = new THREE.Group();
  const halves = [];
  for (const side of [-1, 1]) {
    const h = new THREE.Group();
    const s = new THREE.Shape();
    s.moveTo(-14, 0); s.lineTo(-24, 70); s.lineTo(-12, 215); s.quadraticCurveTo(0, 278, 5, 272);
    s.lineTo(16, 200); s.lineTo(18, 70); s.lineTo(14, 0); s.lineTo(-14, 0);
    const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 7, bevelEnabled: true, bevelThickness: 2, bevelSize: 2, bevelSegments: 2 }), gold);
    if (side > 0) blade.scale.x = -1;
    blade.position.z = side > 0 ? 9 : 0;
    h.add(blade);
    const shank = new THREE.Mesh(new THREE.BoxGeometry(16, 120, 9), gold);
    shank.position.set(-side * 18, -62, blade.position.z + 4); shank.rotation.z = side * 0.28; h.add(shank);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(50, 12, 20, 64), gold);
    ring.position.set(-side * 50, -165, blade.position.z + 4); h.add(ring);
    g.add(h); halves.push({ h, side });
  }
  const screw = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 30, 32), steel);
  screw.rotation.x = Math.PI / 2; screw.position.z = 8; g.add(screw);
  g.userData.setOpen = deg => { for (const { h, side } of halves) h.rotation.z = side * THREE.MathUtils.degToRad(deg / 2); };
  return g;
}

function razor() {
  const g = new THREE.Group();
  const hs = new THREE.Shape();
  hs.moveTo(-320, -26); hs.lineTo(-10, -22); hs.quadraticCurveTo(10, 0, -10, 22); hs.lineTo(-320, 26); hs.quadraticCurveTo(-345, 0, -320, -26);
  const handle = new THREE.Mesh(new THREE.ExtrudeGeometry(hs, { depth: 20, bevelEnabled: true, bevelThickness: 4, bevelSize: 4, bevelSegments: 3 }), blackGloss);
  handle.position.z = -10; g.add(handle);
  for (const x of [-20, -300]) { const pin = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 34, 24), gold); pin.rotation.x = Math.PI / 2; pin.position.set(x, 0, 2); g.add(pin); }
  const inlay = new THREE.Mesh(new THREE.BoxGeometry(220, 5, 3), gold); inlay.position.set(-165, 0, 16); g.add(inlay);
  const bs = new THREE.Shape();
  bs.moveTo(0, -10); bs.lineTo(40, -14); bs.lineTo(250, -18); bs.quadraticCurveTo(285, -12, 280, 30); bs.lineTo(60, 40); bs.quadraticCurveTo(10, 30, 0, 10); bs.lineTo(0, -10);
  const blade = new THREE.Group();
  const bm = new THREE.Mesh(new THREE.ExtrudeGeometry(bs, { depth: 4, bevelEnabled: true, bevelThickness: 1.5, bevelSize: 1.5, bevelSegments: 2 }), gold);
  bm.position.z = -2; blade.add(bm);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(230, 3, 7), steel); edge.position.set(150, 34, 0); edge.rotation.z = -0.03; blade.add(edge);
  g.add(blade);
  g.userData.setOpen = o => { blade.rotation.z = THREE.MathUtils.degToRad(lerp(178, 8, o)); };
  return g;
}

function clipper() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(72, 250, 12, 48), goldBrushed);
  body.scale.z = 0.62; g.add(body);
  const grip = new THREE.Mesh(new THREE.CapsuleGeometry(56, 150, 8, 32), blackMatte);
  grip.scale.set(1, 1, 0.3); grip.position.set(0, -50, 34); g.add(grip);
  const head = new THREE.Mesh(new RoundedBoxGeometry(170, 50, 70, 4, 10), blackGloss); head.position.y = 210; g.add(head);
  for (let i = 0; i < 17; i++) {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(6, 34, 12), steel);
    tooth.position.set(-80 + i * 10, 248, 18); g.add(tooth);
  }
  const blade2 = new THREE.Mesh(new THREE.BoxGeometry(172, 10, 20), steel); blade2.position.set(0, 236, 10); g.add(blade2);
  const lever = new THREE.Mesh(new RoundedBoxGeometry(18, 70, 18, 3, 6), gold); lever.position.set(76, 120, 0); g.add(lever);
  const sw = new THREE.Mesh(new RoundedBoxGeometry(34, 60, 14, 3, 6), gold); sw.position.set(0, 40, 46); g.add(sw);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(14, 18, 40, 24), blackGloss); cord.position.y = -220; g.add(cord);
  return g;
}

function comb() {
  const s = new THREE.Shape();
  const L = 380, sp = 52, teeth = 26, tw = 7, tl = 92;
  s.moveTo(-L / 2, sp / 2); s.lineTo(L / 2, sp / 2); s.lineTo(L / 2, -sp / 2);
  for (let i = teeth - 1; i >= 0; i--) {
    const x = -L / 2 + 6 + i * ((L - 12) / teeth);
    const len = i < 10 ? tl : tl * 0.8;
    s.lineTo(x + tw, -sp / 2); s.lineTo(x + tw - 1, -sp / 2 - len); s.lineTo(x + 1, -sp / 2 - len); s.lineTo(x, -sp / 2);
  }
  s.lineTo(-L / 2, -sp / 2); s.lineTo(-L / 2, sp / 2);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 8, bevelEnabled: true, bevelThickness: 1.5, bevelSize: 1.2, bevelSegments: 2 });
  geo.translate(0, 40, -4);
  const g = new THREE.Group(); g.add(new THREE.Mesh(geo, blackGloss));
  const band = new THREE.Mesh(new THREE.BoxGeometry(L - 20, 6, 12), gold); band.position.set(0, 70, 0); g.add(band);
  return g;
}

function brush() {
  const g = new THREE.Group();
  const hp = [[0, -170], [52, -170], [56, -160], [40, -110], [36, -40], [48, 0], [52, 10], [0, 10]].map(([x, y]) => new THREE.Vector2(x, y));
  g.add(new THREE.Mesh(new THREE.LatheGeometry(hp, 64), blackGloss));
  const band = new THREE.Mesh(new THREE.CylinderGeometry(54, 54, 18, 64), gold); band.position.y = 4; g.add(band);
  const bp = [];
  for (let i = 0; i <= 20; i++) { const a = i / 20; bp.push(new THREE.Vector2(lerp(46, 0, Math.pow(a, 1.8)) + 22 * Math.sin(a * Math.PI) * (1 - a), 12 + a * 150)); }
  bp[bp.length - 1].x = 0;
  const bristles = new THREE.Mesh(new THREE.LatheGeometry(bp, 64), cream); g.add(bristles);
  return g;
}

function jar() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(110, 110, 110, 96), blackGloss));
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(116, 116, 40, 96), gold); lid.position.y = 74; g.add(lid);
  const t = new THREE.Mesh(new THREE.TorusGeometry(116, 4, 12, 96), gold); t.rotation.x = Math.PI / 2; t.position.y = 94; g.add(t);
  return g;
}

function pocketWatch() {
  const g = new THREE.Group();
  const caseGeo = new THREE.CylinderGeometry(120, 120, 34, 96); caseGeo.rotateX(Math.PI / 2);
  g.add(new THREE.Mesh(caseGeo, gold));
  const face = new THREE.Mesh(new THREE.CircleGeometry(104, 96), blackGloss); face.position.z = 17.5; g.add(face);
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(110, 7, 16, 96), gold); bezel.position.z = 17; g.add(bezel);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    const m = new THREE.Mesh(new THREE.BoxGeometry(i % 3 === 0 ? 8 : 5, i % 3 === 0 ? 22 : 14, 4), gold);
    m.position.set(Math.sin(a) * 86, Math.cos(a) * 86, 19); m.rotation.z = -a; g.add(m);
  }
  const mk = (len, wd) => { const p = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(wd, len, 4), gold); m.position.y = len / 2 - 8; p.add(m); p.position.z = 22; g.add(p); return p; };
  const hourH = mk(58, 9), minH = mk(84, 6);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 10, 24), gold); pin.rotation.x = Math.PI / 2; pin.position.z = 25; g.add(pin);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 30, 32), gold); crown.position.y = 138; g.add(crown);
  const bow = new THREE.Mesh(new THREE.TorusGeometry(30, 6, 12, 48), gold); bow.position.y = 176; g.add(bow);
  g.userData.setTime = a => { minH.rotation.z = -a * 12; hourH.rotation.z = -a; };
  return g;
}

function phone(screenTex) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new RoundedBoxGeometry(612, 1252, 40, 8, 74), gold));
  const body = new THREE.Mesh(new RoundedBoxGeometry(600, 1240, 52, 8, 70), blackGloss); g.add(body);
  const scrMat = new THREE.MeshBasicMaterial({ map: screenTex, color: 0xd8d8d8, toneMapped: false });
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(560, 1200), scrMat); scr.position.z = 26.5; g.add(scr);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(560, 1200), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.05, transparent: true, opacity: 0.025 }));
  glass.position.z = 27; g.add(glass);
  const ripple = new THREE.Mesh(new THREE.TorusGeometry(1, 0.025, 8, 64), new THREE.MeshBasicMaterial({ color: 0xf3eee3, transparent: true, opacity: 0, toneMapped: false }));
  ripple.position.set(32 + 248 - 280, 600 - 480, 30); g.add(ripple);
  g.userData = { scrMat, ripple };
  return g;
}

// ------------------------------------------------------------ build
const ready = (async () => {
  const [logoTex, fBold, fXB] = await Promise.all([
    tex('/assets/logo_atelier47.png'),
    font('/assets/fonts/Poppins-Bold.ttf'),
    font('/assets/fonts/Poppins-ExtraBold.ttf'),
  ]);
  const O = {};
  O.medal = medallion(logoTex);
  O.scissors = scissors();
  O.razor = razor();
  O.clipper = clipper();
  O.comb = comb();
  O.brush = brush();
  O.jar = jar();
  O.watch = pocketWatch();
  O.orbit = [scissors(), razor(), clipper(), comb(), brush(), jar()];
  O.orbitG = new THREE.Group(); O.orbit.forEach(o => O.orbitG.add(o));
  O.coupe = textMesh('COUPE', fXB, cream, 820);
  O.nette = textMesh('NETTE', fXB, gold, 820);
  O.barbe = textMesh('BARBE', fXB, cream, 800);
  O.soignee = textMesh('SOIGNÉE', fXB, gold, 900);
  O.tarifs = textMesh('NOS TARIFS', fBold, gold, 760, 28);
  O.abo = textMesh('ABONNEZ-VOUS', fXB, gold, 920, 30);
  O.abo2 = textMesh('ABONNEZ-VOUS', fXB, gold, 740, 30);
  O.horaires = textMesh('HORAIRES', fBold, gold, 640, 28);
  O.screenTex = new THREE.Texture(); O.screenTex.colorSpace = THREE.SRGBColorSpace;
  O.phone = phone(O.screenTex);
  for (const k of Object.keys(O)) if (O[k].isObject3D) scene.add(O[k]);
  // gold dust
  const N = 420, rnd = seeded(47), pos = new Float32Array(N * 3), base = [];
  for (let i = 0; i < N; i++) base.push([lerp(-800, 800, rnd()), lerp(-1150, 1150, rnd()), lerp(-1800, 900, rnd()), rnd() * 6.28, lerp(15, 45, rnd())]);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.4, 'rgba(230,190,110,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const dust = new THREE.Points(geo, new THREE.PointsMaterial({ size: 16, map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xe6c27a, opacity: 0.55 }));
  scene.add(dust);
  O.dust = { dust, base, pos };
  window.__O = O;
  return O;
})();

let screenUrl = null;
async function setScreen(O, url) {
  if (url === screenUrl) return;
  screenUrl = url;
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  O.screenTex.image = img; O.screenTex.needsUpdate = true;
}

function place(obj, v) { obj.position.copy(v); }

// ------------------------------------------------------------ timeline
window.renderAt = async (t, screen) => {
  const O = await ready;
  for (const k of Object.keys(O)) if (O[k] && O[k].isObject3D) O[k].visible = false;
  sweep.intensity = 0;

  // camera: slow handheld drift + push on every beat
  const bp = beat(t, 3.5) * (t < 29.5 ? 1 : 0);
  camera.position.set(18 * Math.sin(t * 0.7), 14 * Math.sin(t * 0.9 + 1), CAM_Z - 60 * bp);
  camera.lookAt(0, 0, 0);
  camera.rotation.z = 0.004 * Math.sin(t * 0.6);

  // gold dust with parallax
  { const { dust, base, pos } = O.dust; dust.visible = true;
    base.forEach(([x, y, z, ph, v], i) => { pos[i * 3] = x + 30 * Math.sin(t * 0.5 + ph); pos[i * 3 + 1] = ((y + v * t + 1150) % 2300) - 1150; pos[i * 3 + 2] = z; });
    dust.geometry.attributes.position.needsUpdate = true; }

  // S1 hook 0-3.5: medallion flies in spinning
  if (t < 3.5) {
    const m = O.medal; m.visible = true;
    const p = easeOut(prog(t, 0.0, 1.2));
    place(m, P(540, 740, lerp(-2600, 0, p)));
    m.rotation.set(0.12 * Math.sin(t * 0.9), lerp(Math.PI * 4, 0, p) + 0.22 * Math.sin(t * 1.3) * p, 0.03 * Math.sin(t));
    m.scale.setScalar(1.02);
    const sp = prog(t, 1.3, 2.3);
    if (sp > 0 && sp < 1) { sweep.intensity = 3.5 * Math.sin(sp * Math.PI); sweep.position.set(lerp(-700, 700, sp), 960 - 740 + 300, 400); }
  }

  // S2 kinetic 3.5-7.5
  if (t >= 3.5 && t < 7.5) {
    const first = t < 5.5, t0 = first ? 3.5 : 5.5;
    const A = first ? O.coupe : O.barbe, B = first ? O.nette : O.soignee;
    for (const [obj, st, y] of [[A, t0, 900], [B, t0 + 0.5, 1120]]) {
      const p = prog(t, st, st + 0.32);
      if (p <= 0) continue;
      obj.visible = true;
      const e = easeBack(p, 1.3);
      place(obj, P(540, y, lerp(1800, 0, easeOut(p))));
      obj.rotation.set(lerp(-1.1, 0, e) + 0.05 * Math.sin((t - st) * 2.2), 0.16 * Math.sin((t - st) * 1.6), 0);
      obj.scale.setScalar(1 + 0.03 * beat(t, t0));
    }
    const tool = first ? O.scissors : O.razor; tool.visible = true;
    const ip = easeBack(prog(t, t0 + 0.05, t0 + 0.5));
    place(tool, P(540, first ? 560 : 590, lerp(-1500, 0, easeOut(prog(t, t0, t0 + 0.5)))));
    tool.scale.setScalar(first ? 1.05 * Math.max(0.01, ip) : 1.0 * Math.max(0.01, ip));
    if (first) {
      tool.userData.setOpen(lerp(8, 46, 0.5 + 0.5 * Math.sin((t - t0) * Math.PI * 2 / (BEAT * 2))));
      tool.rotation.set(0.35 * Math.sin((t - t0) * 1.4), (t - t0) * 1.8, Math.PI / 2 + 0.25);
    } else {
      tool.userData.setOpen(easeInOut(prog(t, t0 + 0.2, t0 + 1.1)));
      tool.rotation.set(0.5 + 0.2 * Math.sin((t - t0) * 1.2), 0.6 * Math.sin((t - t0) * 0.9), -0.25);
      tool.position.x += 90;
    }
  }

  // S3 salon 7.5-12: tool showcase (comb, clipper, brush)
  if (t >= 7.5 && t < 12.0) {
    const items = [[O.comb, 230, 0.62, 7.6], [O.clipper, 540, 0.78, 7.75], [O.brush, 850, 0.9, 7.9]];
    for (const [obj, x, sc, st] of items) {
      const p = easeOut(prog(t, st, st + 0.6));
      if (p <= 0) continue;
      obj.visible = true;
      place(obj, P(lerp(x < 540 ? -400 : x > 540 ? 1480 : 540, x, p), 720 + (x === 540 ? lerp(900, 0, p) : 0), lerp(-900, 0, p)));
      obj.position.y += 14 * Math.sin(t * 2 + x);
      obj.scale.setScalar(sc * (1 + 0.04 * beat(t, 8.0)));
      obj.rotation.set(0.25 * Math.sin(t * 0.9 + x), (t - st) * 1.3 + x, x === 230 ? 0.5 : x === 850 ? -0.35 : 0.15);
    }
  }

  // S4 prices 12-17: 3D title
  if (t >= 12.0 && t < 17.0) {
    const o = O.tarifs; const p = prog(t, 12.0, 12.5);
    o.visible = p > 0;
    place(o, P(540, 320, lerp(-1200, 0, easeOut(p))));
    o.rotation.set(0.08 * Math.sin(t * 1.4), lerp(-Math.PI / 2, 0, easeBack(p, 1.2)) + 0.14 * Math.sin((t - 12) * 1.1), 0);
    const sp = prog(t, 15.2, 16.0);
    if (sp > 0 && sp < 1) { sweep.intensity = 3 * Math.sin(sp * Math.PI); sweep.position.set(lerp(-600, 600, sp), 960 - 320 + 150, 300); }
  }

  // S5 instagram 17-23: 3D phone + 3D title
  if (t >= 17.0 && t < 23.0) {
    const ph = O.phone; ph.visible = true;
    if (screen) await setScreen(O, screen);
    const p = easeOut(prog(t, 17.0, 17.85));
    place(ph, P(540, lerp(2700, 1185, p), lerp(-400, 0, p)));
    const s = t - 17.85;
    ph.rotation.set(lerp(0.55, 0.07, p) + 0.03 * Math.sin(s * 1.3), lerp(0.75, -0.12, p) + 0.09 * Math.sin(s * 1.05), lerp(-0.25, 0, p));
    const tap = prog(t, 19.5, 20.1);
    ph.scale.setScalar(1 - 0.02 * Math.sin(Math.PI * prog(t, 19.5, 19.75)));
    const rp = ph.userData.ripple;
    rp.scale.setScalar(lerp(10, 150, easeOut(tap))); rp.material.opacity = tap > 0 && tap < 1 ? 1 - tap : 0;
    const a = O.abo; const ap = prog(t, 18.3, 18.75);
    a.visible = ap > 0;
    place(a, P(540, 330, lerp(1500, 0, easeOut(ap))));
    a.rotation.set(lerp(-1.2, 0, easeBack(ap, 1.3)) + 0.05 * Math.sin(t * 2), 0.12 * Math.sin((t - 18.3) * 1.3), 0);
    a.scale.setScalar(1 + 0.04 * beat(t, 19.0));
    const sp = ((t - 19.0) % 1.6) / 1.6;
    if (t > 19.0) { sweep.intensity = 2.5 * Math.sin(sp * Math.PI); sweep.position.set(lerp(-700, 700, sp), 960 - 330 + 160, 260); }
  }

  // S6 hours 23-26.5: pocket watch + 3D title
  if (t >= 23.0 && t < 26.5) {
    const w = O.watch; w.visible = true;
    const p = easeBack(prog(t, 23.0, 23.5));
    place(w, P(540, 420, lerp(-1500, 0, easeOut(prog(t, 23.0, 23.5)))));
    w.scale.setScalar(Math.max(0.01, p));
    w.rotation.set(0.15 * Math.sin(t * 1.1), 0.5 * Math.sin((t - 23) * 1.2), 0);
    w.userData.setTime(lerp(0, Math.PI * 2 * 1.5, easeOut(prog(t, 23.0, 24.4))) + 0.25);
    const h = O.horaires; const hp = prog(t, 23.15, 23.6);
    h.visible = hp > 0;
    place(h, P(540, 625, lerp(1400, 0, easeOut(hp))));
    h.rotation.set(lerp(-1.1, 0, easeBack(hp, 1.3)), 0.12 * Math.sin((t - 23) * 1.3), 0);
  }

  // S7 end 26.5-30: medallion + orbiting tools + 3D title
  if (t >= 26.5) {
    const m = O.medal; m.visible = true;
    const p = easeOut(prog(t, 26.5, 27.4));
    place(m, P(540, 700, lerp(-2600, 0, p)));
    m.rotation.set(0.1 * Math.sin(t), lerp(-Math.PI * 3, 0, p) + 0.2 * Math.sin(t * 1.2) * p, 0);
    m.scale.setScalar(0.92);
    const og = O.orbitG; og.visible = true; place(og, P(540, 700));
    og.rotation.set(1.22, 0, 0.12);
    const op = easeOut(prog(t, 26.8, 27.6));
    O.orbit.forEach((o, i) => {
      o.visible = true;
      const a = i / O.orbit.length * Math.PI * 2 + (t - 26.5) * 0.9;
      const r = lerp(150, 470, op);
      o.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
      o.rotation.set(-1.22 + 0.3 * Math.sin(t + i), (t - 26.5) * 1.5 + i, 0.4 * Math.sin(t * 0.8 + i));
      o.scale.setScalar(0.42 * op);
      if (o.userData.setOpen) o.userData.setOpen(i === 0 ? 30 : 0.9);
    });
    const a2 = O.abo2; const ap = prog(t, 27.1, 27.55);
    a2.visible = ap > 0;
    place(a2, P(540, 1100, lerp(1400, 0, easeOut(ap))));
    a2.rotation.set(lerp(-1.1, 0, easeBack(ap, 1.3)) + 0.04 * Math.sin(t * 2), 0.1 * Math.sin((t - 27) * 1.2), 0);
    a2.scale.setScalar(1 + 0.035 * beat(t, 27.5));
    const sp = prog(t, 27.6, 28.6);
    if (sp > 0 && sp < 1) { sweep.intensity = 3.5 * Math.sin(sp * Math.PI); sweep.position.set(lerp(-700, 700, sp), 960 - 700 + 300, 420); }
  }

  composer.render();
  return true;
};
window.__ready = ready.then(() => true);
