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
const easeIn3 = p => p * p * p;
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
renderer.toneMappingExposure = 1.08;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);
const pmrem = new THREE.PMREMGenerator(renderer);
function studioEnv() {
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x1c1915);
  const box = (w, h, x, y, z, k, col) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m);
  };
  box(8, 5, 2, 7, 7, 5.5, 0xfff0da);     // large key softbox, top front right
  box(2, 10, -9, 1, 3, 3.6, 0xffe2bd);   // warm strip light, left
  box(1.6, 9, 8, 0, -4, 2.6, 0xd6e8ff);  // cool rim strip, right back
  box(14, 2, 0, -7, 5, 1.0, 0xffffff);   // soft floor bounce
  box(4, 4, -3, 6, -8, 1.5, 0xffd9a8);   // back kicker
  box(12, 12, 0, 10, 0, 0.7, 0xfff4e6);  // overhead fill
  return pmrem.fromScene(s, 0.015).texture;
}
scene.environment = studioEnv();

const camera = new THREE.PerspectiveCamera(FOV, W / H, 10, 12000);
camera.position.set(0, 0, CAM_Z);

const key = new THREE.DirectionalLight(0xffe4b8, 2.3); key.position.set(900, 1400, 2200); scene.add(key);
const rim = new THREE.DirectionalLight(0xfff3dd, 1.1); rim.position.set(-1400, -400, -800); scene.add(rim);
const fill = new THREE.AmbientLight(0x3a2c18, 0.6); scene.add(fill);
const sweep = new THREE.PointLight(0xfff0d0, 0, 1600, 1.2); scene.add(sweep);
const amber = new THREE.PointLight(0xff9a3c, 0, 0, 1); scene.add(amber);
const cool = new THREE.PointLight(0x7fb0ff, 0, 0, 1); scene.add(cool);

const target = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
const composer = new EffectComposer(renderer, target);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.18, 0.45, 0.97);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ------------------------------------------------------------ materials
const gold = new THREE.MeshPhysicalMaterial({ color: 0xd4ad5f, metalness: 1.0, roughness: 0.34, envMapIntensity: 0.9, clearcoat: 0.25, clearcoatRoughness: 0.25 });
const goldBrushed = new THREE.MeshStandardMaterial({ color: 0xc09a4c, metalness: 1.0, roughness: 0.42, envMapIntensity: 0.85 });
const blackGloss = new THREE.MeshPhysicalMaterial({ color: 0x0d0d0d, metalness: 0.5, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.06 });
const blackMatte = new THREE.MeshStandardMaterial({ color: 0x141414, metalness: 0.2, roughness: 0.6 });
const cream = new THREE.MeshPhysicalMaterial({ color: 0xa39b8d, metalness: 0.15, roughness: 0.55, clearcoat: 0.4, clearcoatRoughness: 0.3 });
const steel = new THREE.MeshStandardMaterial({ color: 0xd6d4d0, metalness: 1.0, roughness: 0.22, envMapIntensity: 0.9 });

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
  const faceMat = new THREE.MeshStandardMaterial({ map: logoTex, metalness: 0.35, roughness: 0.4, emissive: 0xffffff, emissiveMap: logoTex, emissiveIntensity: 0.26 });
  const front = new THREE.Mesh(new THREE.CircleGeometry(286, 128), faceMat); front.position.z = 20.5; g.add(front);
  const back = front.clone(); back.rotation.y = Math.PI; back.position.z = -20.5; g.add(back);
  for (const [r, tube, z] of [[300, 7, 20], [300, 7, -20], [330, 3, 0]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 16, 160), gold); ring.position.z = z; g.add(ring);
  }
  return g;
}

// ---- realistic materials + procedural textures for the tools
const canvasTex2 = (w, h, draw, srgb = true) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; };
const knurlTex = canvasTex2(256, 256, (x, w, h) => {          // diamond knurl for clipper grips (bump)
  x.fillStyle = '#808080'; x.fillRect(0, 0, w, h); x.lineWidth = 5;
  for (let i = -w; i < 2 * w; i += 16) {
    x.strokeStyle = '#ffffff'; x.beginPath(); x.moveTo(i, 0); x.lineTo(i + h, h); x.stroke();
    x.strokeStyle = '#000000'; x.beginPath(); x.moveTo(i + 8, 0); x.lineTo(i + 8 - h, h); x.stroke();
  }
}, false);
knurlTex.repeat.set(3, 5);
const brushLines = canvasTex2(512, 64, (x, w, h) => {          // fine brushed-metal lines
  const id = x.createImageData(w, h);
  for (let px = 0; px < w * h; px++) { const yy = Math.floor(px / w); const v = 128 + 60 * Math.sin(yy * 1.7 + Math.sin(px * 0.013) * 2) + (Math.random() - 0.5) * 70; id.data[px * 4] = id.data[px * 4 + 1] = id.data[px * 4 + 2] = v; id.data[px * 4 + 3] = 255; }
  x.putImageData(id, 0, 0);
}, false);
brushLines.repeat.set(1, 6);
const polishedGold = new THREE.MeshPhysicalMaterial({ color: 0xd6af62, metalness: 1, roughness: 0.27, clearcoat: 0.35, clearcoatRoughness: 0.2, envMapIntensity: 0.95 });
const brushedGold2 = new THREE.MeshPhysicalMaterial({ color: 0xc29b4e, metalness: 1, roughness: 0.4, roughnessMap: brushLines, bumpMap: brushLines, bumpScale: 0.4, anisotropy: 0.7, envMapIntensity: 1.2 });
const mirrorSteel = new THREE.MeshPhysicalMaterial({ color: 0xdedee2, metalness: 1, roughness: 0.1, clearcoat: 0.6, clearcoatRoughness: 0.05, envMapIntensity: 1.0 });
const brushedSteel = new THREE.MeshPhysicalMaterial({ color: 0xcfcfd3, metalness: 1, roughness: 0.3, roughnessMap: brushLines, anisotropy: 0.85, envMapIntensity: 1.0 });
const softTouch = new THREE.MeshPhysicalMaterial({ color: 0x1a1a1a, metalness: 0, roughness: 0.55, clearcoat: 0.2, clearcoatRoughness: 0.5, sheen: 0.5, sheenColor: new THREE.Color(0x3a3a3a), sheenRoughness: 0.8 });
const knurlGold = new THREE.MeshPhysicalMaterial({ color: 0xd0a85a, metalness: 1, roughness: 0.42, bumpMap: knurlTex, bumpScale: 2.4, envMapIntensity: 0.9 });
const knurlBlack = new THREE.MeshPhysicalMaterial({ color: 0x141414, metalness: 0.5, roughness: 0.55, bumpMap: knurlTex, bumpScale: 2.2 });
const rubberBlack = new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.85, metalness: 0 });
const acetate = new THREE.MeshPhysicalMaterial({ color: 0x0c0c0c, metalness: 0, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.03 });
const tube = (pts, r, mat, seg = 64) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), seg, r, 16, false), mat);

// barber shears: mirror steel blades, offset gold rings with inserts, finger rest, adjustable pivot screw
function scissors() {
  const g = new THREE.Group();
  const halves = [];
  for (const side of [-1, 1]) {
    const h = new THREE.Group();
    const s = new THREE.Shape();
    s.moveTo(-9, -6); s.lineTo(-16, 50); s.quadraticCurveTo(-18, 200, -3, 318); s.lineTo(1, 322);
    s.quadraticCurveTo(10, 190, 9, 50); s.lineTo(9, -6); s.lineTo(-9, -6);
    const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 3, bevelEnabled: true, bevelThickness: 1.6, bevelSize: 1.8, bevelSegments: 4, curveSegments: 32 }), brushedSteel);
    const z0 = side > 0 ? 7 : -2;
    blade.position.z = z0; if (side > 0) blade.scale.x = -1;
    h.add(blade);
    const ringR = side > 0 ? 44 : 38;                       // finger ring larger than thumb ring
    const rc = [-side * (side > 0 ? 70 : 52), side > 0 ? -175 : -150, z0 + 2];
    h.add(tube([[0, -4, z0 + 2], [-side * 10, -50, z0 + 2], [-side * 26, -95, z0 + 2], [rc[0] + side * ringR * 0.55, rc[1] + ringR * 0.75, z0 + 2]], 7.5, polishedGold));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(ringR, 8.5, 24, 80), polishedGold); ring.scale.set(1, 0.86, 1); ring.position.set(...rc); h.add(ring);
    const insert = new THREE.Mesh(new THREE.TorusGeometry(ringR - 7, 3.2, 12, 64), rubberBlack); insert.scale.set(1, 0.86, 1); insert.position.set(rc[0], rc[1], rc[2]); h.add(insert);
    if (side > 0) h.add(tube([[rc[0] - 30, rc[1] - 30, z0 + 2], [rc[0] - 48, rc[1] - 62, z0 + 2], [rc[0] - 40, rc[1] - 90, z0 + 2], [rc[0] - 22, rc[1] - 96, z0 + 2]], 6, polishedGold, 32));
    g.add(h); halves.push({ h, side });
  }
  const screw = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 22, 48), polishedGold); screw.rotation.x = Math.PI / 2; screw.position.z = 3; g.add(screw);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(9, 11, 10, 32), mirrorSteel); knob.rotation.x = Math.PI / 2; knob.position.z = 17; g.add(knob);
  const slot = new THREE.Mesh(new THREE.BoxGeometry(14, 2.4, 3), rubberBlack); slot.position.z = 22.5; g.add(slot);
  g.userData.setOpen = deg => { for (const { h, side } of halves) h.rotation.z = side * THREE.MathUtils.degToRad(deg / 2); };
  return g;
}

// professional cordless clipper: pebble body in brushed gold, knurled grip, toothed steel blade set, taper lever
function clipper() {
  const g = new THREE.Group();
  const prof = new THREE.Shape();
  prof.moveTo(-58, -190); prof.lineTo(58, -190); prof.quadraticCurveTo(70, -190, 70, -170);
  prof.lineTo(78, 140); prof.quadraticCurveTo(80, 185, 40, 190); prof.lineTo(-40, 190); prof.quadraticCurveTo(-80, 185, -78, 140);
  prof.lineTo(-70, -170); prof.quadraticCurveTo(-70, -190, -58, -190);
  const bodyGeo = new THREE.ExtrudeGeometry(prof, { depth: 56, bevelEnabled: true, bevelThickness: 18, bevelSize: 14, bevelSegments: 12, curveSegments: 24 });
  bodyGeo.translate(0, 0, -28);
  g.add(new THREE.Mesh(bodyGeo, softTouch));
  const gp = new THREE.Shape(); gp.moveTo(-50, -150); gp.lineTo(50, -150); gp.lineTo(56, 70); gp.quadraticCurveTo(0, 92, -56, 70); gp.lineTo(-50, -150);
  const gripGeo = new THREE.ExtrudeGeometry(gp, { depth: 4, bevelEnabled: true, bevelThickness: 2, bevelSize: 2, bevelSegments: 3 });
  for (const z of [46.5, -50.5]) { const grip = new THREE.Mesh(gripGeo, knurlGold); grip.position.z = z; g.add(grip); }
  // blade assembly
  const head = new THREE.Mesh(new RoundedBoxGeometry(172, 34, 66, 4, 8), rubberBlack); head.position.y = 205; g.add(head);
  const tb = new THREE.Shape(); tb.moveTo(-86, 0); tb.lineTo(86, 0); tb.lineTo(86, 18);
  for (let i = 0; i < 30; i++) { const x = 86 - i * (172 / 30); tb.lineTo(x - 1, 46); tb.lineTo(x - 4.5, 46); tb.lineTo(x - 172 / 30, 18); }
  tb.lineTo(-86, 18); tb.lineTo(-86, 0);
  const fixed = new THREE.Mesh(new THREE.ExtrudeGeometry(tb, { depth: 5, bevelEnabled: true, bevelThickness: 1, bevelSize: 0.8, bevelSegments: 2 }), mirrorSteel);
  fixed.position.set(0, 214, 8); g.add(fixed);
  const mv = fixed.clone(); mv.material = new THREE.MeshPhysicalMaterial({ color: 0x2a2a2a, metalness: 1, roughness: 0.2 }); mv.scale.set(0.82, 0.7, 1); mv.position.set(0, 214, 15); g.add(mv);
  for (const x of [-48, 48]) { const sc = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 6, 24), mirrorSteel); sc.rotation.x = Math.PI / 2; sc.position.set(x, 222, 22); g.add(sc); }
  g.add(tube([[80, 150, 0], [96, 120, 0], [100, 70, 6], [92, 40, 10]], 7, polishedGold, 32));
  const lever = new THREE.Mesh(new THREE.SphereGeometry(12, 24, 16), polishedGold); lever.position.set(92, 38, 10); g.add(lever);
  const sw = new THREE.Mesh(new RoundedBoxGeometry(30, 62, 14, 4, 6), polishedGold); sw.position.set(0, 112, 50); g.add(sw);
  const led = new THREE.Mesh(new THREE.CircleGeometry(4, 16), new THREE.MeshBasicMaterial({ color: 0x9fffd0, toneMapped: false })); led.position.set(0, 160, 47.5); g.add(led);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(52, 58, 20, 48), polishedGold); cap.position.y = -205; cap.scale.z = 0.75; g.add(cap);
  return g;
}

function comb() {
  const s = new THREE.Shape();
  const L = 380, sp = 54, teeth = 28, tw = 6.5, tl = 96;
  s.moveTo(-L / 2 + 10, sp / 2); s.lineTo(L / 2 - 10, sp / 2); s.quadraticCurveTo(L / 2, sp / 2, L / 2, sp / 2 - 10); s.lineTo(L / 2, -sp / 2);
  for (let i = teeth - 1; i >= 0; i--) {
    const x = -L / 2 + 6 + i * ((L - 12) / teeth);
    const len = i < 12 ? tl : tl * 0.78;
    s.lineTo(x + tw, -sp / 2); s.lineTo(x + tw - 0.6, -sp / 2 - len + 3); s.quadraticCurveTo(x + tw / 2, -sp / 2 - len - 2, x + 0.6, -sp / 2 - len + 3); s.lineTo(x, -sp / 2);
  }
  s.lineTo(-L / 2, -sp / 2); s.lineTo(-L / 2, sp / 2 - 10); s.quadraticCurveTo(-L / 2, sp / 2, -L / 2 + 10, sp / 2);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 8, bevelEnabled: true, bevelThickness: 2, bevelSize: 1.4, bevelSegments: 3, curveSegments: 8 });
  geo.translate(0, 40, -4);
  const g = new THREE.Group(); g.add(new THREE.Mesh(geo, acetate));
  const band = new THREE.Mesh(new THREE.BoxGeometry(L - 40, 5, 11), polishedGold); band.position.set(0, 74, 0); g.add(band);
  return g;
}

// shaving brush: lathe-turned resin handle, gold collar, two-band badger knot
const badgerTex = canvasTex2(64, 512, (x, w, h) => {
  const gr = x.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#f4eee2'); gr.addColorStop(0.28, '#efe6d6'); gr.addColorStop(0.42, '#3a2c22'); gr.addColorStop(0.62, '#2a2019'); gr.addColorStop(0.78, '#d9cfbf'); gr.addColorStop(1, '#c8bca9');
  x.fillStyle = gr; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) { x.strokeStyle = `rgba(${Math.random() < 0.5 ? '255,250,240' : '40,30,22'},${0.15 + Math.random() * 0.25})`; x.lineWidth = 0.6; const xx = Math.random() * w; x.beginPath(); x.moveTo(xx, 0); x.lineTo(xx + (Math.random() - 0.5) * 2, h); x.stroke(); }
});
badgerTex.wrapS = THREE.RepeatWrapping; badgerTex.repeat.set(8, 1);
function brush() {
  const g = new THREE.Group();
  const hp = [[0, -175], [50, -175], [57, -165], [54, -150], [38, -110], [34, -60], [40, -20], [50, 0], [52, 8], [0, 8]].map(([x, y]) => new THREE.Vector2(x, y));
  g.add(new THREE.Mesh(new THREE.LatheGeometry(hp, 96), acetate));
  const band = new THREE.Mesh(new THREE.CylinderGeometry(54, 54, 16, 96), polishedGold); band.position.y = 4; g.add(band);
  const band2 = new THREE.Mesh(new THREE.TorusGeometry(51, 2.5, 12, 96), polishedGold); band2.rotation.x = Math.PI / 2; band2.position.y = -120; g.add(band2);
  const bp = [];
  for (let i = 0; i <= 28; i++) { const a = i / 28; bp.push(new THREE.Vector2(lerp(46, 0, Math.pow(a, 2.2)) + 30 * Math.sin(a * Math.PI) * (1 - a), 12 + a * 165)); }
  bp[bp.length - 1].x = 0;
  const knot = new THREE.Mesh(new THREE.LatheGeometry(bp, 96), new THREE.MeshStandardMaterial({ map: badgerTex, color: 0xb8b0a4, roughness: 0.95, bumpMap: badgerTex, bumpScale: 1.5 }));
  knot.rotation.y = Math.PI; g.add(knot);
  return g;
}

// pomade jar: black glass body, knurled gold lid engraved TIM DESIGN
const lidTopTex = canvasTex2(512, 512, (x, w, h) => {
  x.fillStyle = '#c9a24b'; x.fillRect(0, 0, w, h);
  for (let r = 40; r < w / 2; r += 3) { x.strokeStyle = `rgba(255,240,200,${0.05 + 0.08 * Math.random()})`; x.beginPath(); x.arc(w / 2, h / 2, r, 0, Math.PI * 2); x.stroke(); }
  x.fillStyle = '#6e5320'; x.font = 'bold 64px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('TIM DESIGN', w / 2, h / 2);
  x.strokeStyle = '#6e5320'; x.lineWidth = 4; x.beginPath(); x.arc(w / 2, h / 2, w * 0.4, 0, Math.PI * 2); x.stroke();
});
function jar() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(110, 112, 110, 128), softTouch));
  const ridges = canvasTex2(512, 32, (x, w, h) => { for (let i = 0; i < w; i += 6) { x.fillStyle = (i / 6) % 2 ? '#202020' : '#e0e0e0'; x.fillRect(i, 0, 6, h); } }, false);
  ridges.repeat.set(6, 1);
  const lidSide = new THREE.MeshPhysicalMaterial({ color: 0xc6a056, metalness: 1, roughness: 0.36, bumpMap: ridges, bumpScale: 1.4 });
  const lidTop = new THREE.MeshPhysicalMaterial({ map: lidTopTex, metalness: 1, roughness: 0.34, bumpMap: lidTopTex, bumpScale: 0.8 });
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(116, 116, 40, 128), [lidSide, lidTop, lidTop]); lid.position.y = 74; g.add(lid);
  const t = new THREE.Mesh(new THREE.TorusGeometry(116, 4, 12, 128), polishedGold); t.rotation.x = Math.PI / 2; t.position.y = 94; g.add(t);
  return g;
}

function razor() {
  const g = new THREE.Group();
  const hs = new THREE.Shape();
  hs.moveTo(-320, -26); hs.lineTo(-10, -22); hs.quadraticCurveTo(10, 0, -10, 22); hs.lineTo(-320, 26); hs.quadraticCurveTo(-345, 0, -320, -26);
  const handle = new THREE.Mesh(new THREE.ExtrudeGeometry(hs, { depth: 20, bevelEnabled: true, bevelThickness: 5, bevelSize: 4, bevelSegments: 6, curveSegments: 24 }), acetate);
  handle.position.z = -10; g.add(handle);
  for (const x of [-20, -300]) { const pin = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 34, 24), gold); pin.rotation.x = Math.PI / 2; pin.position.set(x, 0, 2); g.add(pin); }
  const inlay = new THREE.Mesh(new THREE.BoxGeometry(220, 5, 3), gold); inlay.position.set(-165, 0, 16); g.add(inlay);
  const bs = new THREE.Shape();
  bs.moveTo(0, -10); bs.lineTo(40, -14); bs.lineTo(250, -18); bs.quadraticCurveTo(285, -12, 280, 30); bs.lineTo(60, 40); bs.quadraticCurveTo(10, 30, 0, 10); bs.lineTo(0, -10);
  const blade = new THREE.Group();
  const bm = new THREE.Mesh(new THREE.ExtrudeGeometry(bs, { depth: 4, bevelEnabled: true, bevelThickness: 1.5, bevelSize: 1.5, bevelSegments: 3 }), brushedSteel);
  bm.position.z = -2; blade.add(bm);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(230, 3, 7), polishedGold); edge.position.set(150, 34, 0); edge.rotation.z = -0.03; blade.add(edge);
  g.add(blade);
  g.userData.setOpen = o => { blade.rotation.z = THREE.MathUtils.degToRad(lerp(178, 8, o)); };
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

const blackGlass = new THREE.MeshPhysicalMaterial({ color: 0x070707, metalness: 0.25, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.03 });
const titanium = new THREE.MeshPhysicalMaterial({ color: 0xc6a056, metalness: 1, roughness: 0.32, clearcoat: 0.3, clearcoatRoughness: 0.2 });
const blackTi = new THREE.MeshPhysicalMaterial({ color: 0x161616, metalness: 1, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.05 });
const lensGlass = new THREE.MeshPhysicalMaterial({ color: 0x05060a, metalness: 0.1, roughness: 0.02, clearcoat: 1, clearcoatRoughness: 0 });
const holoAdd = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });

function rrShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function flatShape(w, h, r) {   // rounded-rectangle plane with 0..1 UVs (for the screen texture)
  const geo = new THREE.ShapeGeometry(rrShape(w, h, r), 32);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  return geo;
}

// iPhone Pro style smartphone, all black: continuous rounded corners, rounded titanium edges,
// Dynamic Island, triangular triple camera, Action button. No Apple logo (trademark).
function phone(screenTex, logoTex) {
  const g = new THREE.Group();
  const bodyGeo = new THREE.ExtrudeGeometry(rrShape(588, 1228, 88), { depth: 36, bevelEnabled: true, bevelThickness: 10, bevelSize: 6, bevelSegments: 10, curveSegments: 28 });
  bodyGeo.translate(0, 0, -18);
  g.add(new THREE.Mesh(bodyGeo, [blackGlass, blackTi]));            // caps = glass, sides = black titanium
  const scrMat = new THREE.MeshBasicMaterial({ map: screenTex, color: 0x000000, toneMapped: false });
  const scr = new THREE.Mesh(flatShape(556, 1196, 72), scrMat); scr.position.z = 28.4; g.add(scr);
  const island = new THREE.Mesh(new THREE.ShapeGeometry(rrShape(150, 44, 22), 16), new THREE.MeshBasicMaterial({ color: 0x000000 })); island.position.set(0, 556, 28.8); g.add(island);
  const lensDot = new THREE.Mesh(new THREE.CircleGeometry(8, 24), new THREE.MeshPhysicalMaterial({ color: 0x0a0c14, roughness: 0.05, clearcoat: 1 })); lensDot.position.set(48, 556, 29); g.add(lensDot);
  const coat = new THREE.Mesh(flatShape(556, 1196, 72), new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.02, clearcoat: 1, transparent: true, opacity: 0.05 }));
  coat.position.z = 28.9; coat.visible = false; g.add(coat);
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(556, 10), holoAdd(0xfff1c8, 0)); scan.position.z = 29.2; g.add(scan);
  // buttons: side button (right), Action button + volume (left)
  for (const [x, y, h] of [[301, 260, 160], [-301, 470, 62], [-301, 345, 110], [-301, 215, 110]]) {
    const b = new THREE.Mesh(new RoundedBoxGeometry(10, h, 18, 4, 4.5), blackTi); b.position.set(x, y, 0); g.add(b);
  }
  // back: engraved Atelier 47 logo + camera plateau
  const back = new THREE.Mesh(new THREE.CircleGeometry(120, 96), new THREE.MeshStandardMaterial({ map: logoTex, metalness: 0.4, roughness: 0.35, color: 0x3a3a3a, emissive: 0xffffff, emissiveMap: logoTex, emissiveIntensity: 0.08 }));
  back.rotation.y = Math.PI; back.position.set(0, 20, -28.6); g.add(back);
  const backRing = new THREE.Mesh(new THREE.TorusGeometry(124, 3, 12, 96), blackTi); backRing.position.set(0, 20, -28.6); g.add(backRing);
  const bumpGeo = new THREE.ExtrudeGeometry(rrShape(250, 250, 66), { depth: 6, bevelEnabled: true, bevelThickness: 3, bevelSize: 3, bevelSegments: 6, curveSegments: 20 });
  const bump = new THREE.Mesh(bumpGeo, [blackGlass, blackTi]); bump.position.set(150, 455, -37); g.add(bump);
  for (const [x, y] of [[195, 500], [195, 410], [105, 455]]) {
    const ringM = new THREE.Mesh(new THREE.CylinderGeometry(48, 48, 14, 64), blackTi); ringM.rotation.x = Math.PI / 2; ringM.position.set(x, y, -44); g.add(ringM);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(37, 37, 15, 64), lensGlass); lens.rotation.x = Math.PI / 2; lens.position.set(x, y, -45); g.add(lens);
    const inner = new THREE.Mesh(new THREE.CircleGeometry(16, 32), new THREE.MeshPhysicalMaterial({ color: 0x02030a, roughness: 0, clearcoat: 1 })); inner.rotation.y = Math.PI; inner.position.set(x, y, -52.7); g.add(inner);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(7, 24), holoAdd(0x6a7cff, 0.3)); dot.rotation.y = Math.PI; dot.position.set(x + 9, y + 9, -52.8); g.add(dot);
  }
  const flash = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 4, 32), new THREE.MeshStandardMaterial({ color: 0xfff6dc, emissive: 0x7a6a40, roughness: 0.3 }));
  flash.rotation.x = Math.PI / 2; flash.position.set(100, 525, -41); g.add(flash);
  const lidar = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 4, 32), lensGlass); lidar.rotation.x = Math.PI / 2; lidar.position.set(100, 385, -41); g.add(lidar);
  const ripple = new THREE.Mesh(new THREE.TorusGeometry(1, 0.025, 8, 64), holoAdd(0xf3eee3, 0)); ripple.position.set(0, 120, 120); g.add(ripple);
  g.userData = { scrMat, scan, ripple };
  return g;
}

function holoPanel(texture, w, h, depth = 8, rounded = false) {
  const g = new THREE.Group();
  const front = new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.05, toneMapped: false, side: THREE.DoubleSide });
  if (rounded) {
    for (let k = 0; k < 3; k++) {  // stacked layers give the rounded card a visible thickness
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), k === 0 ? front : new THREE.MeshBasicMaterial({ map: texture, color: 0x5a4520, transparent: true, alphaTest: 0.05, toneMapped: false }));
      m.position.z = -k * depth / 2; g.add(m);
    }
  } else {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), [titanium, titanium, titanium, titanium, front, blackGlass]));
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.1, h * 1.1), holoAdd(0xc9a24b, 0.06)); glow.position.z = -depth; g.add(glow);
  }
  g.userData.front = front;
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
  O.phone = phone(O.screenTex, logoTex);
  const H5 = '/exports/holo/';
  const [tilesT, banT, follA, follB, pricesT, addrT] = await Promise.all([
    Promise.all([...Array(9).keys()].map(i => tex(`${H5}tile${i}.png`))),
    Promise.all([...Array(2).keys()].map(i => tex(`${H5}banner${i}.png`))),
    tex(`${H5}card_follow.png`), tex(`${H5}card_followed.png`), tex(`${H5}card_prices.png`), tex(`${H5}card_address.png`)]);
  O.s5 = new THREE.Group();
  O.s5.add(O.phone);
  O.tiles = tilesT.map(tx => { const p = holoPanel(tx, 176, 176, 8); O.s5.add(p); return p; });
  const IGL = await (await fetch(`${H5}ig_layout.json`)).json();
  const notifDefs = [
    { tap: IGL.profileAt, from: IGL.follow, banner: false, tex: follA, texB: follB, swapAt: 20.95, w: 820, h: 260, to: [0, 540, 380], scale: 0.82, yaw: 0 },
    { tap: IGL.notifs[0][1], from: IGL.banner, banner: true, bi: 0, tex: pricesT, w: 560, h: 340, to: [-250, -20, 360], scale: 0.8, yaw: 0.2 },
    { tap: IGL.notifs[1][1], from: IGL.banner, banner: true, bi: 1, tex: addrT, w: 560, h: 230, to: [205, -330, 400], scale: 0.8, yaw: -0.2 },
  ];
  O.IGL = IGL; O.IGF = IGL.followers;
  O.N = notifDefs.map((d, i) => {
    const g = new THREE.Group();
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(520, 130), new THREE.MeshBasicMaterial({ map: d.banner ? banT[d.bi] : null, transparent: true, toneMapped: false, depthWrite: false, opacity: d.banner ? 1 : 0 }));
    banner.visible = d.banner;
    g.add(banner);
    let card = null;
    if (d.tex) { card = holoPanel(d.tex, d.w, d.h, 10, true); card.children.forEach(c => { c.material.transparent = true; c.material.depthWrite = false; }); g.add(card); }
    g.userData = { banner, card };
    O.s5.add(g);
    return { ...d, g, texA: d.tex };
  });
  // big follower counter card (number redrawn every frame)
  try { const ff = new FontFace('PoppinsB', 'url(/assets/fonts/Poppins-Bold.ttf)'); await ff.load(); document.fonts.add(ff); } catch (e) {}
  const cc = document.createElement('canvas'); cc.width = 840; cc.height = 340;
  O.counterCtx = cc.getContext('2d'); O.counterTex = new THREE.CanvasTexture(cc); O.counterTex.colorSpace = THREE.SRGBColorSpace;
  O.counter = new THREE.Mesh(new THREE.PlaneGeometry(420, 170), new THREE.MeshBasicMaterial({ map: O.counterTex, transparent: true, toneMapped: false, depthWrite: false }));
  O.s5.add(O.counter);
  O.drawCounter = (n, plus) => {
    const x = O.counterCtx, w = 840, h = 340;
    x.clearRect(0, 0, w, h);
    x.fillStyle = 'rgba(16,15,13,0.96)'; x.strokeStyle = 'rgba(216,176,100,1)'; x.lineWidth = 6;
    x.beginPath(); x.roundRect(6, 6, w - 12, h - 12, 56); x.fill(); x.stroke();
    x.fillStyle = '#d8b064'; x.font = '600 50px PoppinsB, sans-serif'; x.textAlign = 'left'; x.textBaseline = 'middle';
    x.fillText('ABONNÉS', 60, 82);
    x.fillStyle = '#f3eee3'; x.font = '700 150px PoppinsB, sans-serif'; x.fillText(String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '), 54, 222);
    if (plus > 0) { x.fillStyle = `rgba(120,230,140,${Math.min(1, plus)})`; x.font = '700 64px PoppinsB, sans-serif'; x.textAlign = 'right'; x.fillText('▲', w - 60, 82); }
    O.counterTex.needsUpdate = true;
  };
  // 3D hearts flying out of the like button, comment bubbles out of the comment button
  const hs = new THREE.Shape();
  hs.moveTo(0, -18); hs.bezierCurveTo(-4, -14, -26, -2, -26, 12); hs.bezierCurveTo(-26, 24, -12, 30, 0, 18); hs.bezierCurveTo(12, 30, 26, 24, 26, 12); hs.bezierCurveTo(26, -2, 4, -14, 0, -18);
  const heartGeo = new THREE.ExtrudeGeometry(hs, { depth: 8, bevelEnabled: true, bevelThickness: 4, bevelSize: 3, bevelSegments: 6, curveSegments: 24 }); heartGeo.center();
  O.hearts = [...Array(18).keys()].map(i => { const h = new THREE.Mesh(heartGeo, new THREE.MeshPhysicalMaterial({ color: i % 5 === 4 ? 0xd8b064 : 0xff2d55, metalness: i % 5 === 4 ? 1 : 0.1, roughness: 0.25, clearcoat: 1, emissive: i % 5 === 4 ? 0x000000 : 0x5a0010, transparent: true })); O.s5.add(h); return h; });
  const bubbleTex = kind => canvasTex2(256, 160, (x, w, h) => {
    x.fillStyle = 'rgba(28,26,22,0.96)'; x.strokeStyle = 'rgba(201,162,75,0.9)'; x.lineWidth = 5;
    x.beginPath(); x.roundRect(8, 8, w - 16, h - 40, 34); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(50, h - 34); x.lineTo(36, h - 8); x.lineTo(80, h - 34); x.closePath(); x.fill();
    x.translate(w / 2, (h - 32) / 2);
    if (kind === 0) { x.fillStyle = '#ff2d55'; x.beginPath(); x.moveTo(0, 26); x.bezierCurveTo(-40, 0, -24, -30, 0, -12); x.bezierCurveTo(24, -30, 40, 0, 0, 26); x.fill(); }
    if (kind === 1) { x.fillStyle = '#ff8a1e'; x.beginPath(); x.moveTo(0, -34); x.bezierCurveTo(26, -6, 28, 24, 0, 30); x.bezierCurveTo(-28, 24, -22, -4, -8, -14); x.bezierCurveTo(-6, 2, 4, 4, 0, -34); x.fill(); x.fillStyle = '#ffd36a'; x.beginPath(); x.arc(0, 14, 11, 0, Math.PI * 2); x.fill(); }
    if (kind === 2) { x.strokeStyle = '#d8b064'; x.lineWidth = 7; x.beginPath(); x.arc(-16, 18, 11, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.arc(16, 18, 11, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.moveTo(-9, 9); x.lineTo(18, -30); x.moveTo(9, 9); x.lineTo(-18, -30); x.stroke(); }
    if (kind === 3) { x.fillStyle = '#d8b064'; x.font = 'bold 54px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('47', 0, 2); }
  });
  O.bubbles = [0, 1, 2, 3, 1].map(k => { const b = new THREE.Mesh(new THREE.PlaneGeometry(128, 80), new THREE.MeshBasicMaterial({ map: bubbleTex(k), transparent: true, toneMapped: false, depthWrite: false })); O.s5.add(b); return b; });
  // ---- business card + QR code
  const linTex = async url => { const t = await texLoader.loadAsync(url); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 8; return t; };
  const [rectoC, rectoMe, rectoRo, rectoBu, versoC, versoMe, versoRo, versoBu] = await Promise.all([
    tex(`${H5}card_recto.png`), linTex(`${H5}card_recto_metal.png`), linTex(`${H5}card_recto_rough.png`), linTex(`${H5}card_recto_bump.png`),
    tex(`${H5}card_verso.png`), linTex(`${H5}card_verso_metal.png`), linTex(`${H5}card_verso_rough.png`), linTex(`${H5}card_verso_bump.png`)]);
  const qr = await (await fetch(`${H5}qr.json`)).json();
  const face = (map, metal, rough, bump) => new THREE.MeshPhysicalMaterial({ map, metalnessMap: metal, metalness: 1, roughnessMap: rough, roughness: 1, bumpMap: bump, bumpScale: 1.0, clearcoat: 0.08, clearcoatRoughness: 0.6, envMapIntensity: 0.75 });
  const edgeGold = new THREE.MeshPhysicalMaterial({ color: 0xc6a056, metalness: 1, roughness: 0.32, clearcoat: 0.3 });
  O.card = new THREE.Mesh(new RoundedBoxGeometry(860, 557, 10, 6, 26), [edgeGold, edgeGold, edgeGold, edgeGold, face(rectoC, rectoMe, rectoRo, rectoBu), face(versoC, versoMe, versoRo, versoBu)]);
  // QR plate with raised modules (instanced)
  const QS = qr.size / 2, mat = qr.matrix, NQ = mat.length + 8, cell = QS / NQ;
  O.qr = new THREE.Group();
  const plate = new THREE.Mesh(new RoundedBoxGeometry(QS + 10, QS + 10, 6, 4, 12), new THREE.MeshStandardMaterial({ color: 0xbdb6a8, roughness: 0.85, metalness: 0, envMapIntensity: 0.5 }));
  O.qr.add(plate);
  for (const [w, h, x, y] of [[QS + 34, 4, 0, (QS + 30) / 2], [QS + 34, 4, 0, -(QS + 30) / 2], [4, QS + 34, (QS + 30) / 2, 0], [4, QS + 34, -(QS + 30) / 2, 0]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 8), edgeGold); b.position.set(x, y, 0); O.qr.add(b);
  }
  const mods = [];
  mat.forEach((row, r) => row.forEach((v, c) => { if (v) mods.push([(c + 4 + 0.5) * cell - QS / 2, QS / 2 - (r + 4 + 0.5) * cell]); }));
  const modMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(cell * 1.02, cell * 1.02, 16), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.65, metalness: 0.1 }), mods.length);
  O.qr.add(modMesh);
  const maxD = Math.hypot(QS / 2, QS / 2);
  O.qrMods = { modMesh, mods, maxD, dummy: new THREE.Object3D() };
  O.laser = new THREE.Group();
  O.laser.add(new THREE.Mesh(new THREE.PlaneGeometry(QS + 60, 5), holoAdd(0xffe7b0, 0.95)));
  const lg2 = new THREE.Mesh(new THREE.PlaneGeometry(QS + 60, 40), holoAdd(0xffc860, 0.25)); O.laser.add(lg2);
  O.laser.position.z = 22; O.qr.add(O.laser);
  O.brackets = [];
  for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const g = new THREE.Group();
    const a1 = new THREE.Mesh(new THREE.BoxGeometry(46, 5, 5), holoAdd(0xffd890, 0.9)); a1.position.set(-sx * 20, 0, 0);
    const a2 = new THREE.Mesh(new THREE.BoxGeometry(5, 46, 5), holoAdd(0xffd890, 0.9)); a2.position.set(0, -sy * 20, 0);
    g.add(a1, a2); g.position.set(sx * (QS / 2 + 40), sy * (QS / 2 + 40), 14); O.qr.add(g); O.brackets.push(g);
  }
  O.qrSpot = new THREE.Vector3(-(qr.center[0] / qr.card[0] - 0.5) * 860, (0.5 - qr.center[1] / qr.card[1]) * 557, -5.5);
  // ---- real-looking set for the phone: walnut counter, wall with cyan light, salon bokeh, props, stand
  const woodTex = canvasTex2(1024, 1024, (x, w, h) => {
    x.fillStyle = '#21150d'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 420; i++) {
      const y0 = Math.random() * h, amp = 4 + Math.random() * 14, ph = Math.random() * 6.28, sh = Math.random();
      x.strokeStyle = sh < 0.5 ? `rgba(70,44,24,${0.25 + Math.random() * 0.35})` : `rgba(12,7,4,${0.3 + Math.random() * 0.4})`;
      x.lineWidth = 0.6 + Math.random() * 2.4; x.beginPath();
      for (let xx = 0; xx <= w; xx += 16) x.lineTo(xx, y0 + Math.sin(xx * 0.008 + ph) * amp + Math.sin(xx * 0.031 + ph * 2) * amp * 0.3);
      x.stroke();
    }
  });
  woodTex.repeat.set(2, 2);
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(3600, 3000), new THREE.MeshStandardMaterial({ map: woodTex, color: 0xd8c2a8, roughness: 0.5, metalness: 0, envMapIntensity: 0.06, bumpMap: woodTex, bumpScale: 0.6 }));
  desk.rotation.x = -Math.PI / 2; desk.position.set(0, -640, -500);
  const wallTex = canvasTex2(1024, 1024, (x, w, h) => {
    x.fillStyle = '#06080a'; x.fillRect(0, 0, w, h);
    let g1 = x.createRadialGradient(w * 0.74, h * 0.38, 0, w * 0.74, h * 0.38, w * 0.55); g1.addColorStop(0, 'rgba(40,175,205,0.65)'); g1.addColorStop(0.45, 'rgba(18,90,115,0.3)'); g1.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g1; x.fillRect(0, 0, w, h);
    let g2 = x.createRadialGradient(w * 0.18, h * 0.62, 0, w * 0.18, h * 0.62, w * 0.45); g2.addColorStop(0, 'rgba(210,140,60,0.38)'); g2.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g2; x.fillRect(0, 0, w, h);
    x.shadowColor = 'rgba(90,230,255,1)'; x.shadowBlur = 40; x.fillStyle = 'rgba(170,245,255,0.9)'; x.fillRect(w * 0.84, h * 0.05, 8, h * 0.62);
    const sh = x.createLinearGradient(0, h * 0.55, 0, h); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.85)'); x.shadowBlur = 0; x.fillStyle = sh; x.fillRect(0, 0, w, h);
  });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(6400, 4400), new THREE.MeshBasicMaterial({ map: wallTex }));
  wall.position.set(0, 600, -2700);
  const bokehTex = canvasTex2(128, 128, (x, w, h) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(0.7, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  O.env = new THREE.Group();
  O.env.add(desk, wall);
  const rb = seeded(31);
  for (let i = 0; i < 26; i++) {
    const warm = rb() < 0.75, sz = lerp(70, 260, rb());
    const b = new THREE.Mesh(new THREE.PlaneGeometry(sz, sz), new THREE.MeshBasicMaterial({ map: bokehTex, color: warm ? 0xffb860 : 0x6fe0ff, transparent: true, opacity: lerp(0.05, 0.16, rb()), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    b.position.set(lerp(-1700, 1700, rb()), lerp(-350, 1100, rb()), lerp(-2300, -1300, rb())); O.env.add(b);
  }
  const standMat = blackTi;
  const standBase = new THREE.Mesh(new RoundedBoxGeometry(400, 16, 230, 4, 7), standMat); standBase.position.set(0, -632, 10); O.env.add(standBase);
  const lip = new THREE.Mesh(new RoundedBoxGeometry(400, 30, 16, 4, 6), standMat); lip.position.set(0, -610, 50); O.env.add(lip);
  const sup = new THREE.Mesh(new RoundedBoxGeometry(300, 300, 14, 4, 6), standMat); sup.position.set(0, -480, -70); sup.rotation.x = -0.22; O.env.add(sup);
  const pScis = scissors(); pScis.userData.setOpen(14); pScis.rotation.set(-Math.PI / 2, 0, 0.9); pScis.position.set(-360, -628, 460); pScis.scale.setScalar(0.62); O.env.add(pScis);
  const pComb = comb(); pComb.rotation.set(-Math.PI / 2, 0, -0.35); pComb.position.set(360, -633, 420); pComb.scale.setScalar(0.62); O.env.add(pComb);
  const pJar = jar(); pJar.position.set(-420, -640 + 40, -320); pJar.scale.setScalar(0.72); O.env.add(pJar);
  const pBrush = brush(); pBrush.position.set(430, -640 + 120, -380); pBrush.scale.setScalar(0.7); O.env.add(pBrush);
  O.s5.add(O.env);
  O.scrLight = new THREE.PointLight(0xfff2dc, 0, 2600, 1.4); O.scrLight.position.set(0, -80, 220); O.phone.add(O.scrLight);
  O.lines = [];
  for (let i = 0; i < 5; i++) { const l = new THREE.Mesh(new THREE.PlaneGeometry(760, 3), holoAdd(i % 2 ? 0x9eefff : 0xfff6e6, 0)); l.position.z = 29.6; O.phone.add(l); O.lines.push(l); }
  O.hud = [new THREE.Mesh(new THREE.TorusGeometry(470, 1.8, 8, 200), holoAdd(0xd8b064, 0.55)), new THREE.Mesh(new THREE.TorusGeometry(530, 1.0, 8, 200), holoAdd(0xd8b064, 0.35))];
  O.hud.forEach(h => O.s5.add(h));
  const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx; };
  const burstTex = canvasTex(1024, 1024, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,240,205,0.9)'); g.addColorStop(0.18, 'rgba(255,190,90,0.35)'); g.addColorStop(0.55, 'rgba(160,90,20,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.translate(w / 2, h / 2);
    for (let i = 0; i < 28; i++) {
      x.rotate(Math.PI * 2 / 28);
      const lg = x.createLinearGradient(0, 0, 0, -w / 2);
      lg.addColorStop(0, 'rgba(255,225,160,0.32)'); lg.addColorStop(1, 'rgba(255,200,120,0)');
      x.fillStyle = lg; const wd = i % 2 ? 10 : 22;
      x.beginPath(); x.moveTo(-wd, 0); x.lineTo(0, -w / 2); x.lineTo(wd, 0); x.closePath(); x.fill();
    }
  });
  O.burst = new THREE.Mesh(new THREE.PlaneGeometry(1700, 1700), new THREE.MeshBasicMaterial({ map: burstTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, color: 0xffffff }));
  O.burst.position.z = -260; O.s5.add(O.burst);
  const edgeTex = canvasTex(512, 1024, (x, w, h) => {
    x.shadowColor = 'rgba(255,200,110,1)'; x.shadowBlur = 46; x.strokeStyle = 'rgba(255,225,160,1)'; x.lineWidth = 10;
    const r = 70, m = 56; x.beginPath(); x.roundRect(m, m, w - 2 * m, h - 2 * m, r); x.stroke(); x.stroke();
  });
  O.edge = new THREE.Mesh(new THREE.PlaneGeometry(612 * 512 / 400, 1252 * 1024 / 912), new THREE.MeshBasicMaterial({ map: edgeTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  O.edge.position.z = -34; O.phone.add(O.edge);
  const glareTex = canvasTex(512, 64, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0.0, 'rgba(255,255,255,0)'); g.addColorStop(0.44, 'rgba(255,248,230,0)'); g.addColorStop(0.5, 'rgba(255,248,230,0.55)'); g.addColorStop(0.56, 'rgba(255,248,230,0)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
  glareTex.wrapS = THREE.ClampToEdgeWrapping;
  O.glare = new THREE.Mesh(flatShape(556, 1196, 72), new THREE.MeshBasicMaterial({ map: glareTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0 }));
  O.glare.position.z = 29.4; O.glare.rotation.z = 0; O.phone.add(O.glare);
  const glareGeo = O.glare.geometry; const uv = glareGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); uv.setXY(i, u * 0.8 + v * 0.45, v); }
  for (let k = 0; k < 24; k++) { const tick = new THREE.Mesh(new THREE.BoxGeometry(3, 18, 1), holoAdd(0xd8b064, 0.6)); const a = k / 24 * Math.PI * 2; tick.position.set(Math.cos(a) * 470, Math.sin(a) * 470, 0); tick.rotation.z = a + Math.PI / 2; O.hud[0].add(tick); }
  // light trails and the follow burst share one additive point cloud
  const NT = 9 * 18 + 3 * 18 + 80;
  O.fx = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: 9, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, map: null, toneMapped: false }));
  O.fx.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NT * 3), 3));
  O.fx.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(NT * 3), 3));
  O.s5.add(O.fx);
  for (const k of Object.keys(O)) if (O[k].isObject3D && !O[k].parent) scene.add(O[k]);
  // gold dust
  const N = 420, rnd = seeded(47), pos = new Float32Array(N * 3), base = [];
  for (let i = 0; i < N; i++) base.push([lerp(-800, 800, rnd()), lerp(-1150, 1150, rnd()), lerp(-1800, 900, rnd()), rnd() * 6.28, lerp(15, 45, rnd())]);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.4, 'rgba(230,190,110,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const dust = new THREE.Points(geo, new THREE.PointsMaterial({ size: 16, map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xe6c27a, opacity: 0.55 }));
  scene.add(dust);
  O.fx.material.map = dust.material.map;
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
  sweep.intensity = 0; amber.intensity = 0; cool.intensity = 0; bloom.strength = 0.32;

  // camera: slow handheld drift + push on every beat
  const bp = beat(t, 3.5) * (t < 36.0 ? 1 : 0);
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
    const items = [[O.comb, 225, 0.72, 7.6], [O.clipper, 540, 0.92, 7.75], [O.brush, 860, 1.0, 7.9]];
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

  // S5 instagram 17-25: iPhone on its stand; the salon's post plays (likes, comments), then the profile
  // (followers counting up); sections rise out of the screen as 3D cards; posts build a wall.
  if (t >= 17.0 && t < 25.0) {
    const G = O.s5, ph = O.phone, L = O.IGL;
    G.visible = true; ph.visible = true; O.env.visible = true;
    if (screen) await setScreen(O, screen);
    // camera: angled close-up on the post (like the reference), then back to a frontal view
    const zin = easeInOut(prog(t, 18.0, 18.5)) * (1 - easeInOut(prog(t, 19.95, 20.35)));
    G.position.copy(P(540, 1185 - 230 * zin, 0));
    G.rotation.set(0.05 + 0.03 * Math.sin((t - 17) * 0.8) + 0.1 * zin, 0.2 * Math.sin((t - 18.2) * 0.55) * (1 - zin) - 0.5 * zin, 0.04 * zin);
    G.scale.setScalar(1 + 0.32 * zin);
    const p = easeOut(prog(t, 17.0, 17.95));
    const s = Math.max(0, t - 17.95);
    const bt = beat(t, 18.0);
    const tapT = [18.42, L.profileAt, 20.92, ...O.N.slice(1).map(n => n.tap)];
    const taps = tapT.map(x => Math.sin(Math.PI * prog(t, x - 0.05, x + 0.15))).reduce((a, b) => Math.max(a, b), 0);
    const spin = Math.PI * 2 * easeInOut(prog(t, 23.4, 23.85));
    const exit = easeIn3(prog(t, 24.82, 25.0));
    const land = Math.exp(-s * 7) * Math.sin(s * 22) * 18 * (s > 0 ? 1 : 0), lift = 110 * Math.sin(Math.PI * prog(t, 23.35, 23.9));
    ph.position.set(lerp(260, 0, p), lerp(1500, 0, p) + Math.abs(land) + lift, lerp(-500, 0, p) + 14 * bt - 22 * taps + 2600 * exit);
    ph.rotation.set(lerp(-0.6, 0.0, p) + 0.015 * Math.sin(s * 1.3) + 0.03 * taps - 0.5 * exit,
                    lerp(Math.PI + 1.1, -0.06, easeInOut(prog(t, 17.0, 17.95))) + 0.04 * Math.sin(s * 1.05) + spin,
                    lerp(-0.35, 0, p) + 0.01 * Math.sin(s * 0.9) + 0.25 * exit);
    ph.scale.setScalar((1 + 0.012 * bt) * (1 - 0.015 * taps));
    const on = prog(t, 17.85, 18.25);
    const flash = [17.95, L.profileAt, 20.92, ...O.N.slice(1).map(n => n.tap), L.tilesOut, 24.72].map(e => Math.exp(-Math.pow((t - e) / 0.07, 2))).reduce((a, b) => Math.max(a, b), 0);
    ph.userData.scrMat.color.setScalar(0.92 * easeOut(on) + 1.2 * flash);
    O.scrLight.intensity = (1.4 * easeOut(on) + 9 * flash) * p;
    const lk = prog(t, 17.62, 17.98);
    O.lines.forEach((l, i) => { l.material.opacity = lk > 0 && lk < 1 ? Math.sin(lk * Math.PI) : 0; l.rotation.z = [0.6, -0.9, 1.25, -0.35, 0.15][i]; const d = lerp(-520, 520, lk) * (i % 2 ? 1 : -1); l.position.set(Math.cos(l.rotation.z + 1.57) * d * 0.4, Math.sin(l.rotation.z + 1.57) * d, 29.6); });
    const sc = ph.userData.scan; sc.material.opacity = on > 0 && on < 1 ? 0.9 : 0; sc.position.y = lerp(600, -600, on);
    const Cw = P(540, 1185), la = (t - 17) * 1.5;
    amber.position.set(Cw.x + Math.cos(la) * 760, Cw.y + Math.sin(la * 0.8) * 520, 520 + 220 * Math.sin(la));
    cool.position.set(Cw.x - Math.cos(la) * 760, Cw.y - Math.sin(la * 0.8) * 520, 420);
    amber.intensity = 3.0 * p * (1 + 0.5 * bt); cool.intensity = 2.0 * p;
    bloom.strength = 0.34 + 0.16 * bt * p + 0.2 * taps + 0.35 * flash;
    const hue = 0.09 + 0.035 * Math.sin((t - 17) * 1.7);
    O.edge.visible = false;
    O.burst.visible = true; O.burst.rotation.z = (t - 17) * 0.25; O.burst.scale.setScalar(Math.max(0.01, p) * (1 + 0.08 * bt + 0.2 * taps));
    O.burst.material.color.setHSL(hue - 0.02, 0.85, 0.08 + 0.08 * bt + 0.15 * taps);
    O.burst.position.set(0, 0, -300);
    const gl = O.glare; gl.visible = true;
    const glareAt = [18.15, L.profileAt, 21.9, 23.6].map(g0 => prog(t, g0, g0 + 0.45)).find(q => q > 0 && q < 1);
    gl.material.opacity = glareAt !== undefined ? Math.sin(glareAt * Math.PI) * 0.32 : 0;
    gl.material.map.offset.x = glareAt !== undefined ? lerp(-0.9, 0.9, glareAt) : 0;
    G.updateMatrixWorld(true);
    const phoneLocal = v => v.clone().applyMatrix4(ph.matrix);
    const hp = easeOut(prog(t, 20.35, 20.9));
    O.hud.forEach((h, i) => { h.visible = hp > 0; h.scale.setScalar(Math.max(0.01, hp) * (1 + 0.02 * bt)); h.rotation.set(1.32 + i * 0.08, 0.12 * i, (t - 18) * (i ? -0.35 : 0.5)); h.position.set(0, -40 + i * 30, 0); });
    const fxPos = O.fx.geometry.attributes.position.array, fxCol = O.fx.geometry.attributes.color.array; fxCol.fill(0);
    let fi = 0;
    const trail = (a, b, k, n = 18) => { for (let j = 0; j < n && fi < fxCol.length / 3; j++) { const u = j / (n - 1) * k; const q = a.clone().lerp(b, u); q.y += Math.sin(u * Math.PI) * 50; fxPos[fi * 3] = q.x; fxPos[fi * 3 + 1] = q.y; fxPos[fi * 3 + 2] = q.z; const c = Math.pow(j / (n - 1), 2) * 0.9 * Math.sin(k * Math.PI); fxCol[fi * 3] = c; fxCol[fi * 3 + 1] = c * 0.78; fxCol[fi * 3 + 2] = c * 0.45; fi++; } };
    const back = easeInOut(prog(t, 24.45, 24.8));
    const faceCam = (k, extraY = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(0.08 * Math.sin(t * 1.3 + extraY), -G.rotation.y * 0.7 + extraY, 0));
    // likes: 3D hearts out of the like button
    const hIcon = phoneLocal(new THREE.Vector3(L.heart[0], L.heart[1], 34));
    O.hearts.forEach((h, i) => {
      const st = 18.45 + i * 0.075, q = prog(t, st, st + 1.15);
      h.visible = q > 0 && q < 1;
      if (!h.visible) return;
      const r = seeded(500 + i);
      const drift = lerp(-90, 90, r()), up = lerp(260, 480, r()), out = lerp(120, 320, r());
      h.position.set(hIcon.x + drift * q + 30 * Math.sin(q * 9 + i), hIcon.y + up * easeOut(q), hIcon.z + out * q);
      h.rotation.set(0.3 * Math.sin(q * 6 + i), -G.rotation.y * 0.6 + 0.4 * Math.sin(q * 4 + i), 0.3 * Math.sin(q * 5 + i));
      h.scale.setScalar(easeBack(clamp(q * 3), 2.2) * lerp(0.9, 1.4, r()) * (1 - 0.3 * q));
      h.material.opacity = clamp((1 - q) * 3.5);
    });
    // comments: bubbles out of the comment button
    const cIcon = phoneLocal(new THREE.Vector3(L.comment[0], L.comment[1], 34));
    O.bubbles.forEach((b, i) => {
      const st = 18.9 + i * 0.2, q = prog(t, st, st + 1.2);
      b.visible = q > 0 && q < 1;
      if (!b.visible) return;
      b.position.set(cIcon.x + 80 + i * 40 + 40 * q, cIcon.y + 140 * easeOut(q) + i * 30, cIcon.z + 160 * easeOut(q));
      b.quaternion.copy(faceCam(1, 0.1));
      b.scale.setScalar(easeBack(clamp(q * 3), 2) * 1.7);
      b.material.opacity = clamp((1 - q) * 3);
    });
    // sections rising out of the screen (follow card from the follow button, then the notification banners)
    O.N.forEach((n, i) => {
      const grp = n.g, { banner, card } = grp.userData;
      const lift2 = easeOut(prog(t, n.tap + 0.05, n.tap + 0.6));
      const k = lift2 * (1 - back);
      grp.visible = t >= n.tap + 0.05 && back < 1;
      if (!grp.visible) return;
      const start = phoneLocal(new THREE.Vector3(n.from[0], n.from[1], 33));
      const dst = new THREE.Vector3(...n.to); dst.y += 12 * Math.sin(t * 1.8 + i * 2); dst.x += 6 * Math.sin(t * 1.2 + i);
      const home = back > 0 ? phoneLocal(new THREE.Vector3(0, 0, 30)) : start;
      grp.position.copy((back > 0 ? home : start).clone().lerp(dst, back > 0 ? 1 - back : lift2));
      grp.position.y += Math.sin(lift2 * Math.PI) * 90 * (1 - back);
      grp.quaternion.copy(ph.quaternion.clone().slerp(faceCam(k, n.yaw), back > 0 ? 1 - back : lift2));
      if (n.banner) { banner.material.opacity = clamp(1 - lift2 * 2.4); banner.visible = banner.material.opacity > 0.01; banner.scale.setScalar(lerp(1, 1.15, lift2)); }
      if (card) {
        const co = clamp((lift2 - (n.banner ? 0.22 : 0.02)) / 0.35) * (1 - back * 0.2);
        card.visible = co > 0.01;
        card.children.forEach(c => { c.material.opacity = co; });
        const s0 = n.banner ? 520 / n.w : 0.25;
        card.scale.setScalar(lerp(s0, n.scale, easeOut(clamp((lift2 - 0.05) / 0.8))) * lerp(1, 0.25, back) * (1 + 0.03 * bt));
        if (n.texB) card.children[0].material.map = t >= n.swapAt ? n.texB : n.texA;
      }
      if ((lift2 > 0 && lift2 < 1) || (back > 0 && back < 1)) trail(start, grp.position, lift2 < 1 ? lift2 : 1 - back);
    });
    // follow pressed on the card -> gold burst
    const bpq = prog(t, 20.95, 21.75), fc = O.N[0].g;
    const rnd = seeded(99);
    for (let j = 0; j < 80; j++) {
      const a = rnd() * Math.PI * 2, el = (rnd() - 0.5) * 1.6, spd = lerp(220, 620, rnd());
      if (bpq > 0 && bpq < 1 && fi < fxCol.length / 3) {
        const d = easeOut(bpq) * spd;
        fxPos[fi * 3] = fc.position.x + Math.cos(a) * Math.cos(el) * d; fxPos[fi * 3 + 1] = fc.position.y - 70 + Math.sin(el) * d - 120 * bpq * bpq; fxPos[fi * 3 + 2] = fc.position.z + 60 + Math.sin(a) * Math.cos(el) * d * 0.6;
        const c = (1 - bpq) * 1.1; fxCol[fi * 3] = c; fxCol[fi * 3 + 1] = c * 0.82; fxCol[fi * 3 + 2] = c * 0.5;
      }
      fi++;
    }
    const press = Math.sin(Math.PI * prog(t, 20.85, 21.02));
    if (fc.visible) fc.position.z -= 40 * press;
    // follower counter rises from the profile stats and counts up
    {
      const cq = easeOut(prog(t, 21.0, 21.55)), k = cq * (1 - back);
      const cnt = O.counter; cnt.visible = k > 0.001;
      if (cnt.visible) {
        const n = Math.round(lerp(O.IGF[0], O.IGF[1], easeInOut(prog(t, 21.0, 23.2))));
        O.drawCounter(Math.max(n, O.IGF[0] + 1), t < 23.2 ? 1 : 0);
        const start = phoneLocal(new THREE.Vector3(105, 425, 33));
        const dst = new THREE.Vector3(-250, 300, 420); dst.y += 10 * Math.sin(t * 2.1);
        cnt.position.copy(start.clone().lerp(dst, k));
        cnt.quaternion.copy(ph.quaternion.clone().slerp(faceCam(k, 0.22), k));
        cnt.scale.setScalar(lerp(0.2, 1, k) * (1 + 0.05 * Math.sin(Math.PI * ((t * 6) % 1)) * (t > 21.0 && t < 23.2)));
        if (cq > 0 && cq < 1) trail(start, cnt.position, cq);
      }
    }
    // the profile grid posts fly out and build a wall behind the phone
    const WALL = [];
    for (const y of [430, 40, -350]) for (const x of [-430, 0, 430]) WALL.push([x, y, -380]);
    O.tiles.forEach((tl, i) => {
      const st = L.tilesOut + i * 0.05, out = easeOut(prog(t, st, st + 0.55));
      const k = out * (1 - back);
      tl.visible = k > 0.001;
      if (!tl.visible) return;
      const start = phoneLocal(new THREE.Vector3(L.grid[i][0], L.grid[i][1], 33));
      const dst = new THREE.Vector3(...WALL[i]); dst.y += 10 * Math.sin(t * 2 + i); dst.z += 20 * Math.sin(t * 1.5 + i);
      tl.position.copy(start.clone().lerp(dst, k));
      tl.position.z += Math.sin(k * Math.PI) * 300;
      tl.quaternion.copy(ph.quaternion.clone().slerp(faceCam(k, 0.1 * Math.sin(i)), k));
      tl.scale.setScalar(lerp(L.gridT / 176, 1.3, k) * (1 + 0.04 * bt));
      if (out > 0 && out < 1) trail(start, tl.position, out);
    });
    O.fx.visible = true; O.fx.geometry.attributes.position.needsUpdate = true; O.fx.geometry.attributes.color.needsUpdate = true;
    // 3D title arrives with the follow
    const a = O.abo; const ap = prog(t, L.profileAt, L.profileAt + 0.45);
    a.visible = ap > 0;
    place(a, P(540, 330, lerp(1500, 0, easeOut(ap))));
    a.rotation.set(lerp(-1.2, 0, easeBack(ap, 1.3)) + 0.05 * Math.sin(t * 2), 0.12 * Math.sin((t - 20.25) * 1.3), 0);
    a.scale.setScalar(1 + 0.04 * beat(t, 20.5));
    const spq = ((t - 21.0) % 1.6) / 1.6;
    if (t > 21.0) { sweep.intensity = 2.5 * Math.sin(spq * Math.PI); sweep.position.set(lerp(-700, 700, spq), 960 - 330 + 160, 260); }
  }

  // S6 hours 25-28.5: pocket watch + 3D title
  if (t >= 25 && t < 28.5) {
    const w = O.watch; w.visible = true;
    const p = easeBack(prog(t, 25, 25.5));
    place(w, P(540, 420, lerp(-1500, 0, easeOut(prog(t, 25, 25.5)))));
    w.scale.setScalar(Math.max(0.01, p));
    w.rotation.set(0.15 * Math.sin(t * 1.1), 0.5 * Math.sin((t - 23) * 1.2), 0);
    w.userData.setTime(lerp(0, Math.PI * 2 * 1.5, easeOut(prog(t, 25, 26.4))) + 0.25);
    const h = O.horaires; const hp = prog(t, 25.15, 25.6);
    h.visible = hp > 0;
    place(h, P(540, 625, lerp(1400, 0, easeOut(hp))));
    h.rotation.set(lerp(-1.1, 0, easeBack(hp, 1.3)), 0.12 * Math.sin((t - 23) * 1.3), 0);
  }

  // S6b business card 28.5-33: flies in, flips recto/verso, the QR code rises out in 3D and gets scanned
  if (t >= 28.5 && t < 33) {
    const cd = O.card; cd.visible = true;
    const fin = easeOut(prog(t, 28.5, 29.3));
    const flip = easeInOut(prog(t, 29.6, 30.15));
    const up = easeInOut(prog(t, 30.75, 31.35));
    place(cd, P(540, lerp(840, 700, up), lerp(-2600, 0, fin) + 160 * Math.sin(Math.PI * flip)));
    cd.rotation.set(lerp(0.7, 0.12, fin) - 0.32 * up + 0.04 * Math.sin(t * 1.3), lerp(-Math.PI * 4, 0, fin) + Math.PI * flip + 0.1 * Math.sin((t - 29.3) * 1.1) * fin, lerp(-0.4, 0, fin) + 0.03 * Math.sin(t));
    cd.scale.setScalar(1 + 0.015 * beat(t, 29));
    const sp1 = prog(t, 29.25, 29.85), sp2 = prog(t, 30.2, 30.8);
    const spv = sp1 > 0 && sp1 < 1 ? sp1 : sp2 > 0 && sp2 < 1 ? sp2 : -1;
    if (spv >= 0) { sweep.intensity = 2.2 * Math.sin(spv * Math.PI); sweep.position.set(lerp(-800, 800, spv), 960 - 800 + 250, 450); }
    amber.intensity = 1.1 * fin; cool.intensity = 0.6 * fin;
    const la = (t - 28.5) * 1.3;
    amber.position.set(Math.cos(la) * 800, 960 - 820 + Math.sin(la) * 400, 600); cool.position.set(-Math.cos(la) * 800, 960 - 820 - Math.sin(la) * 400, 500);
    // QR code
    const rise = prog(t, 30.15, 30.75);
    const q = O.qr; q.visible = rise > 0;
    if (q.visible) {
      cd.updateMatrixWorld(true);
      const spot = O.qrSpot.clone().add(new THREE.Vector3(0, 0, -6)); const spotW = cd.localToWorld(spot.clone());
      const cq = cd.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0)));
      const target = P(540, 1255, 330);
      q.position.copy(spotW.clone().lerp(target, up));
      q.position.z += Math.sin(Math.PI * up) * 220;
      const tq = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.05 * Math.sin(t * 1.4), 0.12 * Math.sin(t * 0.9), 0));
      q.quaternion.copy(cq.clone().slerp(tq, up));
      q.scale.setScalar(lerp(1, 1.45, up) * (1 + 0.02 * beat(t, 31.5)));
      const { modMesh, mods, maxD, dummy } = O.qrMods;
      mods.forEach(([x, y], i) => {
        const delay = Math.hypot(x, y) / maxD * 0.45;
        const h = easeBack(prog(rise, delay, delay + 0.5), 2.2);
        dummy.position.set(x, y, 3 + 8 * h);
        dummy.scale.set(1, 1, Math.max(0.02, h));
        dummy.updateMatrix(); modMesh.setMatrixAt(i, dummy.matrix);
      });
      modMesh.instanceMatrix.needsUpdate = true;
      const sc = prog(t, 31.35, 32.55);
      O.laser.visible = sc > 0 && sc < 1;
      O.laser.position.y = (O.qr.children[0].geometry.parameters.height / 2) * Math.cos(sc * Math.PI * 2);
      O.brackets.forEach((b, i) => { const bp = easeBack(prog(t, 31.3 + i * 0.05, 31.6 + i * 0.05)); b.visible = bp > 0; b.scale.setScalar(Math.max(0.01, bp) * (1 + 0.06 * beat(t, 31.5))); });
    }
    bloom.strength = 0.22 + 0.1 * beat(t, 29);
  }

  // S7 end 33-36.5: medallion + orbiting tools + 3D title
  if (t >= 33) {
    const m = O.medal; m.visible = true;
    const p = easeOut(prog(t, 33, 33.9));
    place(m, P(540, 700, lerp(-2600, 0, p)));
    m.rotation.set(0.1 * Math.sin(t), lerp(-Math.PI * 3, 0, p) + 0.2 * Math.sin(t * 1.2) * p, 0);
    m.scale.setScalar(0.92);
    const og = O.orbitG; og.visible = true; place(og, P(540, 700));
    og.rotation.set(1.22, 0, 0.12);
    const op = easeOut(prog(t, 33.3, 34.1));
    O.orbit.forEach((o, i) => {
      o.visible = true;
      const a = i / O.orbit.length * Math.PI * 2 + (t - 33) * 0.9;
      const r = lerp(150, 470, op);
      o.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
      o.rotation.set(-1.22 + 0.3 * Math.sin(t + i), (t - 33) * 1.5 + i, 0.4 * Math.sin(t * 0.8 + i));
      o.scale.setScalar(0.42 * op);
      if (o.userData.setOpen) o.userData.setOpen(i === 0 ? 30 : 0.9);
    });
    const a2 = O.abo2; const ap = prog(t, 33.6, 34.05);
    a2.visible = ap > 0;
    place(a2, P(540, 1100, lerp(1400, 0, easeOut(ap))));
    a2.rotation.set(lerp(-1.1, 0, easeBack(ap, 1.3)) + 0.04 * Math.sin(t * 2), 0.1 * Math.sin((t - 33.5) * 1.2), 0);
    a2.scale.setScalar(1 + 0.035 * beat(t, 32));
    const sp = prog(t, 34.1, 35.1);
    if (sp > 0 && sp < 1) { sweep.intensity = 3.5 * Math.sin(sp * Math.PI); sweep.position.set(lerp(-700, 700, sp), 960 - 700 + 300, 420); }
  }

  bloom.strength *= 0.55; sweep.intensity *= 0.5; amber.intensity *= 0.65; cool.intensity *= 0.7;
  composer.render();
  return true;
};
window.__ready = ready.then(() => true);
