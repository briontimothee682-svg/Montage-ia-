// L'Apéretik launch reel — 3D layer. window.renderAt(t) draws the frame at time t (seconds).
// 56 s, 24 fps, 1080x1920. Cuts: 0 logo · 4 box · 10 explosion · 15 macro · 20 laptop · 27 follow · 34 poster · 42 shop · 48 card.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import * as L from './lib.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { prog, lerp, clamp, smooth, easeOut, easeInOut, easeInOut5, easeIn, easeBack, v3, deg, seeded, noise3, tex } from './lib.js';
import { BOX, foodMaterials, makeBox, makeContents, rosemary, hideUnderLid } from './food.js';
import { beerBottle, wineBottle, wineGlass, terrineJar, bokehLights } from './props.js';
import * as SETS from './sets.js';
import { room, oliveTree, ficus, eucalyptusVase, pothosHanging, sideboard, tableSprig } from './plants.js';

const W = 1080, H = 1920;
const params = new URLSearchParams(location.search);

// ------------------------------------------------------------ renderer & post
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, W / H, 0.5, 6000);
const pmrem = new THREE.PMREMGenerator(renderer);

function warmStudioEnv() {
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x1d140d);
  const panel = (w, h, x, y, z, k, col) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m);
  };
  panel(10, 7, -8, 4, 3, 5.0, 0xffcf8f);   // big golden-hour key, left
  panel(6, 6, 7, 3, 5, 1.3, 0xfff0dc);     // soft cream fill, right
  panel(14, 3, 0, 9, 0, 1.0, 0xfff4e4);    // overhead
  panel(3, 9, 6, 1, -8, 2.6, 0xffb46a);    // golden rim strip, back right
  panel(16, 2, 0, -6, 4, 0.5, 0xf2d6b0);   // table bounce
  return pmrem.fromScene(s, 0.02).texture;
}
const ENV = warmStudioEnv();
scene.environment = ENV;

const key = new THREE.DirectionalLight(0xffd29a, 3.2);
key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0003; key.shadow.normalBias = 0.04; key.shadow.radius = 4;
scene.add(key, key.target);
const rim = new THREE.DirectionalLight(0xffb866, 2.2); scene.add(rim, rim.target);
const hemi = new THREE.HemisphereLight(0xfff0da, 0x3a2a1f, 0.55); scene.add(hemi);
const glowLight = new THREE.PointLight(0xff8a30, 0, 40, 2); scene.add(glowLight);
const sweepLight = new THREE.PointLight(0xffd79a, 0, 80, 1.6); scene.add(sweepLight);

function setKey(target, dir, dist, size, intensity = 3.2, color = 0xffd29a) {
  key.target.position.copy(target); key.position.copy(target).add(dir.clone().normalize().multiplyScalar(dist));
  key.intensity = intensity; key.color.set(color);
  Object.assign(key.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: 1, far: dist * 2.5 });
  key.shadow.camera.updateProjectionMatrix();
}
function setRim(target, dir, intensity = 2.2, color = 0xffb866) {
  rim.target.position.copy(target); rim.position.copy(target).add(dir.clone().normalize().multiplyScalar(100)); rim.intensity = intensity; rim.color.set(color);
}

const target = new THREE.WebGLRenderTarget(W, H, { samples: 2, type: THREE.HalfFloatType });
const composer = new EffectComposer(renderer, target);
composer.renderToScreen = false;
composer.addPass(new RenderPass(scene, camera));
const dof = new BokehPass(scene, camera, { focus: 100, aperture: 0.0001, maxblur: 0.01 });
composer.addPass(dof);
composer.addPass(new ShaderPass({ uniforms: { tDiffuse: { value: null } }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }', fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); c.rgb = clamp(c.rgb, 0.0, 60.0); if (c.r != c.r || c.g != c.g || c.b != c.b) c.rgb = vec3(0.0); gl_FragColor = c; }' }));
const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.22, 0.55, 0.92);
bloom.enabled = false;   // no glow, no glare
composer.addPass(bloom);
composer.addPass(new OutputPass());
window.__dbg = { bloom, dof, composer, scene, renderer };

// motion-blur accumulation
const accRT = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const accMat = new THREE.ShaderMaterial({
  uniforms: { tex: { value: null }, k: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  fragmentShader: 'uniform sampler2D tex; uniform float k; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tex, vUv).rgb * k, 1.0); }',
  depthTest: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending,
});
const quadScene = new THREE.Scene(); quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), accMat));

// ------------------------------------------------------------ shared uniforms
const U = { uReveal: { value: 0 }, uEmber: { value: 0 }, uSweep: { value: -1 }, uSweepAmp: { value: 0 }, uLogoScale: { value: (BOX.LOGO_D / 0.72) / (2 * BOX.LID_R) } };

// ------------------------------------------------------------ world
let M, box, lid, contents, pieces;
const G = {};            // set groups toggled per shot

function gradientSphere(top, bottom, glow) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { cTop: { value: new THREE.Color(top) }, cBot: { value: new THREE.Color(bottom) }, cGlow: { value: new THREE.Color(glow) }, gDir: { value: v3(0, 0.3, -1).normalize() } },
    vertexShader: 'varying vec3 vW; void main(){ vW = (modelMatrix * vec4(position,1.)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW,1.); }',
    fragmentShader: `uniform vec3 cTop, cBot, cGlow, gDir; varying vec3 vW;
      void main(){ vec3 d = normalize(vW - cameraPosition); float h = d.y;
        vec3 c = mix(cBot, cTop, smoothstep(-0.55, 0.65, h));
        c += cGlow * pow(max(dot(d, gDir), 0.0), 5.0) * 0.6;
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(2500, 48, 24), mat);
  m.renderOrder = -10; m.frustumCulled = false;
  return m;
}

function texturedPlane(w, h, texName, rep, bump, bumpScale, rough = 0.6, extra = {}) {
  const mat = new THREE.MeshStandardMaterial({ map: tex(texName, { repeat: rep }), roughness: rough, ...extra });
  if (bump) { mat.bumpMap = tex(bump, { color: false, repeat: rep }); mat.bumpScale = bumpScale; }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.rotation.x = -Math.PI / 2; m.receiveShadow = true;
  return m;
}

function linenCloth() {
  const g = new THREE.PlaneGeometry(80, 56, 160, 110);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const wr = (noise3(x * 0.06, y * 0.05, 4) - 0.5) * 1.2 + Math.max(0, Math.sin(x * 0.18 + noise3(x * 0.03, y * 0.02, 1) * 6)) * 0.35 * (noise3(x * 0.02, y * 0.03, 9));
    const under = Math.hypot(x - 4, y + 2) < 16.5 ? -0.0 : 0;
    p.setZ(i, Math.max(0.05, wr * 0.6 + 0.4) + under);
  }
  g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ map: tex('linen', { repeat: [5, 3.5] }), bumpMap: tex('linen_bump', { color: false, repeat: [5, 3.5] }), bumpScale: 2.5, roughness: 0.85 });
  const m = new THREE.Mesh(g, mat); m.rotation.x = -Math.PI / 2; m.rotation.z = deg(14); m.receiveShadow = true;
  // flatten under the box
  const q = g.attributes.position; const c = v3(0, 0, 0);
  for (let i = 0; i < q.count; i++) {
    const x = q.getX(i), y = q.getY(i);
    const wx = x * Math.cos(deg(14)) - y * Math.sin(deg(14)), wz = -(x * Math.sin(deg(14)) + y * Math.cos(deg(14)));
    const d = Math.hypot(wx - c.x, wz - c.z);
    if (d < 17) q.setZ(i, 0.05); else if (d < 21) q.setZ(i, lerp(0.05, q.getZ(i), (d - 17) / 4));
  }
  g.computeVertexNormals();
  return m;
}

// dust motes floating in the light
function dust(n, size, spread, seed) {
  const rnd = seeded(seed);
  const pos = new Float32Array(n * 3), ph = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos[i * 3] = (rnd() - 0.5) * spread[0]; pos[i * 3 + 1] = rnd() * spread[1]; pos[i * 3 + 2] = (rnd() - 0.5) * spread[2]; ph[i] = rnd() * 100; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('ph', new THREE.BufferAttribute(ph, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 }, size: { value: size }, map: { value: tex('softdot', { wrap: false }) }, col: { value: new THREE.Color(1.0, 0.82, 0.55) }, amp: { value: 1 } },
    vertexShader: `uniform float t, size; attribute float ph; varying float vA;
      void main(){ vec3 p = position; p.x += sin(t*0.3 + ph)*2.0; p.y += sin(t*0.21 + ph*1.7)*1.5 + t*0.4; p.z += cos(t*0.25 + ph)*2.0;
        vec4 mv = modelViewMatrix * vec4(p,1.); gl_Position = projectionMatrix * mv; gl_PointSize = size * (300.0 / -mv.z);
        vA = 0.5 + 0.5*sin(t*1.3 + ph*3.0); }`,
    fragmentShader: 'uniform sampler2D map; uniform vec3 col; uniform float amp; varying float vA; void main(){ float a = texture2D(map, gl_PointCoord).a; gl_FragColor = vec4(col * a * vA * amp * 0.45, 1.0); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false;
  return pts;
}

// hot sparks thrown off the burn front
const SPARKS = 140;
let sparks;
function makeSparks(parent) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3));
  g.setAttribute('a', new THREE.BufferAttribute(new Float32Array(SPARKS), 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex('softdot', { wrap: false }) } },
    vertexShader: 'attribute float a; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); gl_Position = projectionMatrix * mv; gl_PointSize = (0.18 + a * 0.25) * (900.0 / -mv.z); vA = a; }',
    fragmentShader: 'uniform sampler2D map; varying float vA; void main(){ float m = texture2D(map, gl_PointCoord).a; gl_FragColor = vec4(vec3(1.0, 0.55, 0.16) * m * vA * 6.0, 1.0); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  sparks = new THREE.Points(g, mat); sparks.frustumCulled = false; parent.add(sparks);
}
function updateSparks(t, top) {
  const pos = sparks.geometry.attributes.position, al = sparks.geometry.attributes.a;
  const rnd = seeded(91);
  for (let i = 0; i < SPARKS; i++) {
    const b = 0.25 + (i / SPARKS) * 2.3 + rnd() * 0.02, life = 0.35 + rnd() * 0.4, age = t - b;
    const vx = (rnd() - 0.5) * 14, vy = 4 + rnd() * 10, vz = (rnd() - 0.5) * 14;
    if (age < 0 || age > life) { al.setX(i, 0); pos.setXYZ(i, 0, -100, 0); continue; }
    const e = emberPos(clamp((b - 0.25) / 2.3, 0, 0.999));
    pos.setXYZ(i, e.x + vx * age, top + 0.1 + vy * age - 22 * age * age, e.z + vz * age);
    al.setX(i, (1 - age / life) * (0.6 + rnd() * 0.4));
  }
  pos.needsUpdate = true; al.needsUpdate = true;
}

// smoke puffs for the branding
const smokePuffs = [];
function makeSmoke(parent) {
  const mat0 = new THREE.MeshBasicMaterial({ map: tex('smoke', { wrap: false }), transparent: true, depthWrite: false, opacity: 0, color: 0xf3e6d4 });
  for (let i = 0; i < 46; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat0.clone());
    m.renderOrder = 5; parent.add(m); smokePuffs.push(m);
  }
}

function emberPos(rev) {
  // position (lid-local x,z in cm) of the burn front for a reveal value (inverse of the logo_fx order map)
  const R = BOX.LOGO_D / 2;
  let r, th;
  if (rev < 0.30 && rev < 0.12 + 0.0) { r = 0.95; th = rev / 0.30; }
  else if (rev < 0.42) { r = 0.72; th = (rev - 0.12) / 0.40; }
  else if (rev < 0.58) { r = 0.52; th = (rev - 0.42) / 0.22; }
  else { const yy = 0.28 + (rev - 0.58) / 0.40 * 0.44; return { x: (Math.sin(rev * 40) * 0.12) * R * 2, z: (yy - 0.5) * 2 * R, r: 0 }; }
  th *= Math.PI * 2;
  return { x: Math.sin(th) * r * R, z: -Math.cos(th) * r * R, r };
}

let oak, walnut, studio, studioFloor, sky, dustA, crumbs, propsS2, card;
let sets = {};

async function build() {
  await L.preload(['birch_band', 'birch_band_bump', 'birch_top', 'birch_top_bump', 'birch_inner', 'logo_fx', 'walnut', 'walnut_bump', 'oak', 'oak_bump', 'desk', 'desk_bump',
    'linen', 'linen_bump', 'comte', 'comte_bump', 'comte_rind', 'comte_rind_bump', 'tomme', 'tomme_bump', 'tomme_rind', 'tomme_rind_bump', 'blue', 'blue_bump', 'ham', 'ham_bump',
    'saucisson_face', 'saucisson_face_bump', 'saucisson_skin', 'saucisson_skin_bump', 'coppa', 'coppa_bump', 'toast', 'toast_bump', 'crust', 'crust_bump', 'walnut_kernel', 'walnut_kernel_bump',
    'apricot', 'apricot_bump', 'terrine', 'terrine_bump', 'smoke', 'softdot', 'droplets', 'wall', 'poster', 'card_front', 'card_front_foil', 'card_front_deboss', 'card_back', 'card_back_foil',
    'label_beer', 'label_beer_neck', 'label_wine', 'label_terrine', 'logo_mask',
    'leaf_olive', 'leaf_olive_bump', 'leaf_ficus', 'leaf_ficus_bump', 'leaf_euca', 'leaf_euca_bump', 'leaf_pothos', 'leaf_pothos_bump', 'wall_leafy', 'wall_plain', 'terracotta', 'terracotta_bump']);
  M = foodMaterials();
  box = makeBox(M, U); scene.add(box); lid = box.userData.lid;
  ({ group: contents, pieces } = makeContents(M)); box.add(contents);
  makeSmoke(box); makeSparks(box);

  // tables
  walnut = new THREE.Group(); scene.add(walnut);
  walnut.add(texturedPlane(1600, 1600, 'walnut', [24, 24], 'walnut_bump', 1.2, 0.42, { color: 0xffffff }));
  walnut.add(gradientSphere(0x2e1d12, 0x140d08, 0x7a4a20));
  oak = new THREE.Group(); scene.add(oak);
  oak.add(texturedPlane(240, 170, 'oak', [3, 2.1], 'oak_bump', 2.0, 0.7));
  // a warm dining room around the table: plants, a sideboard with eucalyptus, a window with late sun
  const deco = () => { const g = new THREE.Group(); g.add(sideboard()); const v = eucalyptusVase(7); v.position.set(-30, 82, 0); g.add(v); const v2 = eucalyptusVase(8, 55); v2.position.set(40, 82, 4); v2.scale.setScalar(0.8); g.add(v2); return g; };
  const hang = () => { const g = pothosHanging(5, 80); g.position.y = 205; return g; };
  oak.add(room({ radius: 300, floorY: -76, windowAz: -62, plants: [[() => oliveTree(11, 140), 165, 120, 0.4], [deco, 205, 240, deg(25)], [() => ficus(12, 125), 140, 135, 0.8], [() => ficus(13, 120), 292, 140, 2.1], [hang, 238, 150, 0], [() => oliveTree(14, 135), 222, 135, 1.7], [() => oliveTree(15, 160), 60, 200, 1.1]] }));
  { const v = eucalyptusVase(16, 62); v.position.set(-30, 0, -46); oak.add(v); const v2 = eucalyptusVase(17, 50); v2.position.set(-46, 0, -17); v2.scale.setScalar(0.75); oak.add(v2); }
  oak.add(linenCloth());
  propsS2 = new THREE.Group(); oak.add(propsS2);
  const wg = wineGlass(0.42); wg.position.set(-16, 0, -38); propsS2.add(wg);
  const bb = beerBottle(); bb.position.set(15, 0, -50); bb.rotation.y = 0.6; propsS2.add(bb);
  const wb = wineBottle(); wb.position.set(-30, 0, 38); wb.rotation.y = 2.2; propsS2.add(wb);
  const tj = terrineJar(); tj.position.set(-50, 0, 29); propsS2.add(tj);
  const wg2 = wineGlass(0.35); wg2.position.set(-30, 0, -10); propsS2.add(wg2);


  // studio for the exploded view
  studio = new THREE.Group(); scene.add(studio);
  sky = gradientSphere(0xe8cc9e, 0x9c6a3e, 0xf2d3a0); studio.add(sky);
  // warm plaster set with leaf shadows and plants behind the floating products
  const plinth = () => { const g = new THREE.Group(); const b = new THREE.Mesh(new RoundedBoxGeometry(40, 70, 40, 2, 1), new THREE.MeshStandardMaterial({ color: 0xd9c4a2, roughness: 0.9 })); b.position.y = 35; b.castShadow = b.receiveShadow = true; g.add(b); const v = eucalyptusVase(21, 80); v.position.y = 70; g.add(v); return g; };
  const sroom = room({ radius: 250, floorY: 0, windowAz: -70, tableTop: false, plants: [[() => oliveTree(22, 150), 343, 205, 0.3], [plinth, 18, 150, 0.4], [() => ficus(23, 125), 305, 215, 1.2], [() => ficus(24, 115), 48, 215, 2.6]] });
  sroom.children[0].material.color.set(0xd8b48a);    // lighter floor for the floating products
  studio.add(sroom);
  studioFloor = new THREE.Group();

  dustA = dust(260, 0.55, [160, 90, 160], 3); scene.add(dustA);

  // golden crumbs of the explosion
  {
    const rnd = seeded(77), n = 380;
    const pos = new Float32Array(n * 3), vel = new Float32Array(n * 3), sz = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, r = rnd() * 12;
      pos.set([Math.cos(a) * r, 6 + rnd() * 2, Math.sin(a) * r], i * 3);
      vel.set([Math.cos(a) * (4 + rnd() * 16), 14 + rnd() * 30, Math.sin(a) * (4 + rnd() * 16)], i * 3);
      sz[i] = 0.25 + rnd() * 0.6;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('vel', new THREE.BufferAttribute(vel, 3)); g.setAttribute('sz', new THREE.BufferAttribute(sz, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { k: { value: 0 }, amp: { value: 1 }, map: { value: tex('softdot', { wrap: false }) } },
      vertexShader: `uniform float k; attribute vec3 vel; attribute float sz; varying float vS;
        void main(){ vec3 p = position + vel * k; vec4 mv = modelViewMatrix * vec4(p,1.); gl_Position = projectionMatrix * mv; gl_PointSize = sz * (900.0 / -mv.z); vS = sz; }`,
      fragmentShader: 'uniform sampler2D map; uniform float amp; varying float vS; void main(){ float a = texture2D(map, gl_PointCoord).a; gl_FragColor = vec4(vec3(1.0,0.72,0.35) * a * amp * 1.6, 1.0); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    crumbs = new THREE.Points(g, mat); crumbs.frustumCulled = false; box.add(crumbs);
  }

  sets = await SETS.build({ scene, renderer, M, U, box, lid, pieces, makeBox, makeContents, camera });
  Object.assign(ctx, { box, lid, contents, pieces });
  makeLabel('cheese', 'FROMAGES', 'de montagne, à la découpe');
  makeLabel('sau', 'SAUCISSON SEC', 'finement tranché');
  makeLabel('ham', 'JAMBON CRU', 'affiné, en chiffonnade');
  // Instagram grid thumbnails are snapshots of the real 3D shots
  const snap = (t) => { setup(t); renderer.setRenderTarget(null); renderer.render(scene, camera); return renderer.domElement; };
  await sets.makeTiles(snap);
}

// ------------------------------------------------------------ 3D product labels ("rubrique")
const labelGroup = new THREE.Group(); scene.add(labelGroup);
const LABELS = {};
function makeLabel(key, title, sub) {
  const cv = L.canvas(1024, 360), c = cv.getContext('2d');
  c.fillStyle = '#f6eee2'; c.beginPath(); c.roundRect(14, 14, 996, 332, 64); c.fill();
  c.strokeStyle = '#c9a15b'; c.lineWidth = 12; c.beginPath(); c.roundRect(14, 14, 996, 332, 64); c.stroke();
  c.fillStyle = '#3a2a1f'; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  c.font = '700 136px Oswald'; c.fillText(title, 512, 178);
  c.fillStyle = '#a8784c'; c.font = 'italic 400 72px "Playfair Display"'; c.fillText(sub, 512, 286);
  const g = new THREE.Group();
  const card = new THREE.Mesh(new THREE.PlaneGeometry(16, 5.625), new THREE.MeshBasicMaterial({ map: L.canvasTex(cv), transparent: true, depthWrite: false, depthTest: false, color: new THREE.Color(1.08, 1.06, 1.04) }));
  card.renderOrder = 30;
  const shCv = L.canvas(256, 96), sx = shCv.getContext('2d'); sx.filter = 'blur(10px)'; sx.fillStyle = 'rgba(30,18,10,0.55)'; sx.beginPath(); sx.roundRect(20, 20, 216, 56, 24); sx.fill();
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(17.5, 6.6), new THREE.MeshBasicMaterial({ map: L.canvasTex(shCv), transparent: true, depthWrite: false, depthTest: false }));
  shadow.renderOrder = 29; shadow.position.set(0.5, -0.6, -0.05);
  const holder = new THREE.Group(); holder.add(shadow, card); g.add(holder);
  const gold = new THREE.MeshBasicMaterial({ color: 0xd9b26a, depthTest: false });
  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 8), gold); line.renderOrder = 28; g.add(line);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 10), gold); dot.renderOrder = 28; g.add(dot);
  g.userData = { holder, line, dot };
  labelGroup.add(g); LABELS[key] = g;
}
const _r = new THREE.Vector3(), _u = new THREE.Vector3(), _d = new THREE.Vector3();
function placeLabel(key, anchor, ox, oy, scale, k) {
  const g = LABELS[key]; if (!g) return;
  g.visible = k > 0.002;
  if (!g.visible) return;
  camera.updateMatrixWorld();
  _r.set(1, 0, 0).applyQuaternion(camera.quaternion); _u.set(0, 1, 0).applyQuaternion(camera.quaternion);
  const { holder, line, dot } = g.userData;
  const pos = anchor.clone().addScaledVector(_r, ox).addScaledVector(_u, oy);
  const s = scale * Math.max(0.001, easeBack(clamp(k * 1.15), 1.4));
  holder.position.copy(pos); holder.quaternion.copy(camera.quaternion); holder.scale.setScalar(s);
  // leader line from the product to the nearest edge of the card
  const edge = pos.clone().addScaledVector(_u, -Math.sign(oy || 1) * 2.8 * scale);
  const lk = smooth(clamp(k * 1.6));
  const end = anchor.clone().lerp(edge, lk);
  _d.subVectors(end, anchor); const len = Math.max(0.001, _d.length());
  line.position.copy(anchor).addScaledVector(_d, 0.5); line.scale.set(scale, len, scale);
  line.quaternion.setFromUnitVectors(v3(0, 1, 0), _d.normalize());
  dot.position.copy(anchor); dot.scale.setScalar(scale * smooth(clamp(k * 3)));
}
function placeLabelScreen(key, anchor, sx, sy, frac, k) {
  // label centred at a fixed point of the frame (sx, sy in 0..1 from top-left), at the depth of its product
  camera.updateMatrixWorld();
  const ndc = anchor.clone().project(camera);
  const p = v3(sx * 2 - 1, 1 - sy * 2, ndc.z).unproject(camera);
  const depth = p.clone().sub(camera.position).dot(v3(0, 0, -1).applyQuaternion(camera.quaternion));
  const hw = depth * Math.tan(deg(camera.fov / 2)) * camera.aspect;
  const scale = frac * 2 * hw / 16;
  _r.set(1, 0, 0).applyQuaternion(camera.quaternion); _u.set(0, 1, 0).applyQuaternion(camera.quaternion);
  const off = p.clone().sub(anchor);
  placeLabel(key, anchor, off.dot(_r), off.dot(_u), scale, k);
}
function cluster(kind) {
  // centroid of a readable group of pieces: one sector of comté cubes, the saucisson rosette, one sector of ham
  const ang = pc => Math.atan2(-pc.rest.p.z, pc.rest.p.x);
  const near = (pc, a) => Math.abs(Math.atan2(Math.sin(ang(pc) - a), Math.cos(ang(pc) - a))) < 0.62;
  let sel;
  if (kind === 'cheese') sel = pieces.filter(pc => pc.kind === 'cube' && near(pc, deg(30)));
  else if (kind === 'sau') sel = pieces.filter(pc => pc.kind === 'sau' && Math.hypot(pc.rest.p.x, pc.rest.p.z) < 6.5);
  else sel = pieces.filter(pc => pc.kind === 'ham' && near(pc, deg(90)));
  const c = v3(0, 0, 0); sel.forEach(pc => c.add(pc.obj.position)); return c.divideScalar(Math.max(1, sel.length));
}

// ------------------------------------------------------------ piece choreography
const explodeK = p => (p <= 0 ? 0 : 0.82 * (1 - Math.exp(-p * 9)) + 0.18 * smooth(clamp(p / 6)));
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
function poseContents(t) {
  // 0 rest -> exploded at 10 s, back to rest between 18.7 and 19.35 s
  const SNAP0 = 18.7, SNAP1 = 19.35;
  for (const pc of pieces) {
    const p = t - 10 - pc.delay * 0.5;
    let e = explodeK(p), rotA = pc.spin.w * (2.2 * (1 - Math.exp(-Math.max(0, p) * 5)) + 0.35 * Math.max(0, p));
    let back = 0;
    if (t > SNAP0) {
      const pe = Math.min(t, SNAP0) - 10 - pc.delay * 0.5;
      const k = prog(t, SNAP0 + pc.delay * 0.6, SNAP1 - 0.12 + pc.delay * 0.3);
      back = easeInOut5(k);
      e = explodeK(pe);
      rotA = pc.spin.w * (2.2 * (1 - Math.exp(-pe * 5)) + 0.35 * pe);
    }
    if (t < 10 || t >= SNAP1 + 0.2) { e = 0; rotA = 0; back = 0; }
    const ee = e * (1 - back);
    const drift = Math.max(0, Math.min(t, SNAP0) - 10) * 0.25 * (1 - back);
    pc.obj.position.lerpVectors(pc.rest.p, pc.ex.p, ee); pc.obj.position.y += drift * (t > 10 ? 1 : 0);
    _q.slerpQuaternions(pc.rest.q, pc.ex.q, ee);
    _q2.setFromAxisAngle(pc.spin.axis, rotA * (1 - back));
    pc.obj.quaternion.copy(_q).multiply(_q2);
    if (pc.obj.userData.morph) pc.obj.morphTargetInfluences[0] = 0.28 * ee;
  }
}

// ------------------------------------------------------------ cameras
function look(pos, at, fov = 34, roll = 0) {
  camera.position.copy(pos); camera.up.set(0, 1, 0);
  camera.lookAt(at);
  if (roll) camera.rotateZ(roll);
  camera.fov = fov; camera.updateProjectionMatrix();
}
function orbitPos(at, az, el, d) {
  return v3(at.x + Math.sin(az) * Math.cos(el) * d, at.y + Math.sin(el) * d, at.z + Math.cos(az) * Math.cos(el) * d);
}
function setDOF(focus, aperture, maxblur = 0.012) {
  dof.uniforms.focus.value = focus; dof.uniforms.aperture.value = aperture; dof.uniforms.maxblur.value = maxblur;
  dof.enabled = aperture > 0;
}

function show(names) {
  for (const [k, g] of Object.entries({ walnut, oak, studio, ...sets.groups })) g.visible = names.includes(k);
  box.visible = names.includes('box');
  if (sparks) sparks.visible = false;
  labelGroup.visible = false;
  if (crumbs) crumbs.visible = false;
  smokePuffs.forEach(m => (m.visible = false));
  sweepLight.intensity = 0; glowLight.intensity = 0;
}

// ------------------------------------------------------------ shots
function shotLogo(t) {
  // logo presentation: the closed box on the oak table, the whole logo readable, soft warm light, no glare
  show(['oak', 'box']);
  scene.background = null; scene.fog = new THREE.FogExp2(0x9a7a58, 0.0011);
  renderer.toneMappingExposure = 1.0;
  contents.visible = false; poseContents(0);
  U.uReveal.value = 1.2;
  lid.position.set(0, lid.userData.closedY, 0); lid.rotation.set(0, 0, 0);
  box.position.set(0, 0.08, 0); box.rotation.set(0, 0, 0);
  const c = v3(0, 0, 0);
  setKey(c, v3(-0.8, 1.5, 0.45), 150, 45, 2.9, 0xffd6a6); setRim(c, v3(0.6, 0.45, -1), 1.8);
  hemi.intensity = 0.62;
  const k = easeInOut(prog(t, 0, 4));
  const at = v3(0, lerp(4.2, 5, k), lerp(-1.5, 0, k));
  look(orbitPos(at, deg(lerp(4, -10, k)), deg(lerp(60, 46, k)), lerp(112, 98, k)), at, 34);
  setDOF(lerp(112, 98, k), 0.00042, 0.014);
  dustA.visible = true; dustA.position.set(0, 0, 0); dustA.material.uniforms.t.value = t; dustA.material.uniforms.size.value = 0.45;
  return { samples: 1 };
}

function shotBox(t) {
  show(['oak', 'box']);
  scene.background = null; scene.fog = new THREE.FogExp2(0x9a7a58, 0.0011);
  renderer.toneMappingExposure = 1.0;
  contents.visible = t > 5.9;
  poseContents(0);
  U.uReveal.value = 1.2; U.uEmber.value = 0; U.uSweepAmp.value = 0; glowLight.intensity = 0;
  smokePuffs.forEach(m => (m.visible = false));
  box.position.set(0, 0.08, 0); box.rotation.set(0, 0, 0);
  const c = v3(0, 0, 0);
  setKey(c, v3(-0.8, 1.5, 0.45), 150, 45, 2.9, 0xffd6a6); setRim(c, v3(0.6, 0.45, -1), 1.8);
  hemi.intensity = 0.62;
  // lid lifts on the drop (6.0 s), floats tilted, then drifts out of frame
  const top = lid.userData.closedY;
  const l1 = easeOut(prog(t, 6.0, 6.9)), l2 = easeInOut(prog(t, 8.1, 9.3));
  lid.position.set(l2 * 34, top + l1 * 13 + Math.sin((t - 6) * 2.2) * 0.4 * l1 + l2 * 60, l2 * -10);
  lid.rotation.set(deg(-17) * l1 + Math.sin((t - 6) * 1.7) * 0.03 * l1, deg(8) * l1, deg(6) * l1 - deg(20) * l2);
  hideUnderLid(pieces, lid);
  // camera: slow 180° orbit at table height, then rise into a perfect top-down view
  // continues the logo presentation: down to table height, slow orbit, then rise into a perfect top-down view
  const at = v3(0, 5, 0).lerp(v3(0, 5.5, 0), smooth(prog(t, 4, 5.8))).lerp(v3(0, 4, 0), smooth(prog(t, 8, 9.8)));
  const az = deg(lerp(-10, 150, easeInOut(prog(t, 4.0, 8.6))));
  const el = deg(lerp(lerp(46, 15, easeInOut(prog(t, 4.0, 5.8))), 89.6, easeInOut(prog(t, 7.9, 9.8))));
  const d = lerp(lerp(98, 110, easeInOut(prog(t, 4.0, 5.8))), 104, prog(t, 5.8, 10));
  look(orbitPos(at, az, el, d), at, 34);
  setDOF(d, 0.0005, 0.016);
  dustA.visible = true; dustA.material.uniforms.t.value = t; dustA.material.uniforms.size.value = 0.6;
  crumbs.visible = false;
  return { samples: 1 };
}

function studioLook() {
  show(['studio', 'box']);
  scene.background = null; scene.fog = new THREE.Fog(0xc89c68, 400, 1400);
  renderer.toneMappingExposure = 0.95;
  const c = v3(0, 15, 0);
  setKey(c, v3(-1, 1.0, 0.45), 200, 70, 3.2); setRim(c, v3(0.7, 0.45, -1), 4.2, 0xffb45e);
  hemi.intensity = 0.62;
  U.uReveal.value = 1.2; U.uEmber.value = 0; U.uSweepAmp.value = 0; glowLight.intensity = 0;
  smokePuffs.forEach(m => (m.visible = false));
  box.position.set(0, 0, 0); box.rotation.set(0, 0, 0);
  contents.visible = true;
}

function crumbsAt(t) {
  const p = t - 10;
  crumbs.visible = p > 0 && t < 18.9;
  const k = 0.85 * (1 - Math.exp(-p * 7)) + 0.12 * p;
  crumbs.material.uniforms.k.value = Math.max(0, k);
  crumbs.material.uniforms.amp.value = clamp(1 - (t - 17.5) / 1.3);
}

function shotExplode(t) {
  studioLook();
  pieces.forEach(pc => (pc.obj.visible = true));
  poseContents(t); crumbsAt(t);
  lid.position.set(30, 200, -40);
  const at = v3(0, 4, 0).lerp(v3(0, 19, 0), easeInOut(prog(t, 10.15, 13.6)));
  const az = deg(lerp(155, 200, easeInOut(prog(t, 10.0, 15.0))));
  const el = deg(lerp(89.6, 16, easeInOut(prog(t, 10.15, 13.6))));
  const d = lerp(104, 142, easeInOut(prog(t, 10.1, 13.4)));
  look(orbitPos(at, az, el, d), at, 34);
  setDOF(d, 0.00022, 0.01);
  dustA.visible = false;
  wideLabels(t, d);
  return { samples: t < 10.4 ? 6 : 1, shutter: 1 / 48 };
}

function wideLabels(t, d, fade = 1) {
  labelGroup.visible = true;
  placeLabelScreen('cheese', cluster('cheese'), 0.32, 0.69, 0.36, prog(t, 11.55, 12.0) * fade);
  placeLabelScreen('sau', cluster('sau'), 0.66, 0.31, 0.36, prog(t, 11.95, 12.4) * fade);
  placeLabelScreen('ham', cluster('ham'), 0.34, 0.43, 0.36, prog(t, 12.35, 12.8) * fade);
}

function shotMacro(t) {
  studioLook();
  pieces.forEach(pc => (pc.obj.visible = true));
  poseContents(t); crumbsAt(t);
  // snap zooms on the beat: cheese, saucisson, ham, back wide; each product named by its 3D label
  const wide = () => { const at = v3(0, 19, 0); return { pos: orbitPos(at, deg(200), deg(16), 142), at, fov: 34, d: 142 }; };
  const close = (kind, side, k) => {
    const c = cluster(kind);
    const out = v3(c.x, 0, c.z); if (out.length() < 2) out.set(Math.sin(deg(200)), 0, Math.cos(deg(200)));
    out.normalize().applyAxisAngle(v3(0, 1, 0), side * 0.32);
    const D = kind === 'ham' ? lerp(60, 53, k) : lerp(50, 43, k);
    return { pos: c.clone().addScaledVector(out, D * Math.cos(deg(17))).add(v3(0, D * Math.sin(deg(17)), 0)), at: c, fov: 30, d: D };
  };
  const SNAP = [[15.0, 'cheese', -1], [16.0, 'sau', 1], [17.0, 'ham', -1], [18.0, 'wide', 0]];
  let i = 0; while (i < 3 && t >= SNAP[i + 1][0]) i++;
  const [t0, kind, side] = SNAP[i];
  const hold = prog(t, t0, t0 + 1.0);
  const poseOf = (j, h) => (SNAP[j][1] === 'wide' ? wide() : close(SNAP[j][1], SNAP[j][2], h));
  const prev = i === 0 ? wide() : poseOf(i - 1, 1);
  const cur = poseOf(i, hold);
  const e = easeInOut5(prog(t, t0, t0 + 0.24));
  let pos = prev.pos.clone().lerp(cur.pos, e), at = prev.at.clone().lerp(cur.at, e);
  let fov = lerp(prev.fov, cur.fov, e), focus = lerp(prev.d, cur.d, e);
  let samples = e > 0.02 && e < 0.98 ? 6 : 1;
  labelGroup.visible = true;
  const lab = { cheese: [-1, -1], sau: [1, 1], ham: [-1, 1] };
  if (t < 18.7) {
    for (const k of ['cheese', 'sau', 'ham']) {
      if (kind === 'wide') continue;
      const on = k === kind ? smooth(prog(t, t0 + 0.12, t0 + 0.4)) : 0;
      const sc = cur.d / 48 * 0.5;
      placeLabel(k, cluster(k), lab[k][0] * 6.5 * sc, lab[k][1] * 7.5 * sc, sc, on);
    }
  }
  // pull back for the snap-back and the lid
  const pb2 = prog(t, 18.55, 19.0);
  if (kind === 'wide') wideLabels(99, 142, smooth(prog(t, 18.1, 18.35)) * (1 - smooth(prog(t, 18.55, 18.75))));
  if (pb2 > 0) {
    const fin = orbitPos(v3(0, 6, 0), deg(208), deg(24), 120);
    const e2 = easeInOut5(pb2);
    pos = pos.lerp(fin, e2); at = at.clone().lerp(v3(0, 6, 0), e2); fov = lerp(fov, 32, e2);
    focus = lerp(focus, 120, e2);
    samples = pb2 > 0.05 && pb2 < 0.95 ? 6 : samples;
  }
  if (t > 19.0) {
    const k = prog(t, 19.0, 20.0);
    pos = orbitPos(v3(0, 6, 0), deg(208 + 6 * k), deg(24 + 4 * k), 120 - 6 * k); at = v3(0, 6, 0); fov = 32; focus = pos.distanceTo(at);
    if (t > 19.3) samples = 4;
  }
  look(pos, at, fov);
  setDOF(focus, t < 18.5 && kind !== 'wide' ? 0.0011 : 0.00025, 0.012);
  if (t < 18.7) for (const k of ['cheese', 'sau', 'ham']) if (LABELS[k].visible) { /* re-place after the final camera */ }
  // labels must follow the final camera of the frame
  if (t < 18.7 && kind !== 'wide') { for (const k of ['cheese', 'sau', 'ham']) placeLabelScreen(k, cluster(k), 0.5, 0.2, 0.62, k === kind ? smooth(prog(t, t0 + 0.12, t0 + 0.4)) : 0); }
  else if (kind === 'wide') wideLabels(99, 142, smooth(prog(t, 18.1, 18.35)) * (1 - smooth(prog(t, 18.55, 18.75))));
  else labelGroup.visible = false;
  // lid falls back and closes with a clap at ~19.95 s
  const top = lid.userData.closedY;
  const kl = prog(t, 19.3, 19.93);
  if (t < 19.3) lid.position.set(30, 200, -40);
  else {
    const y = top + (1 - easeIn(kl)) * 34;
    lid.position.set(0, y, 0); lid.rotation.set(deg(-14) * (1 - easeIn(kl)), 0, deg(5) * (1 - kl));
    if (kl >= 1) { const b = prog(t, 19.93, 20.0); lid.position.y = top + Math.sin(b * Math.PI) * 0.35; lid.rotation.set(0, 0, 0); }
  }
  hideUnderLid(pieces, lid);
  dustA.visible = false;
  return { samples, shutter: 1 / 48 };
}

const SHOTS = [
  [0, 4, shotLogo], [4, 10, shotBox], [10, 15, shotExplode], [15, 20, shotMacro],
  [20, 25.4, t => sets.shotLaptop(t, ctx)], [25.4, 34, t => sets.shotFollow(t, ctx)], [34, 42, t => sets.shotPoster(t, ctx)],
  [42, 48, t => sets.shotShop(t, ctx)], [48, 56.1, t => sets.shotCard(t, ctx)],
];
const ctx = { look, orbitPos, setDOF, setKey, setRim, hemi, key, rim, show, poseContents, U, glowLight, sweepLight, dust: () => dustA, scene, renderer, camera, smokePuffs };

function setup(t) {
  for (const [a, b, f] of SHOTS) if (t >= a && t < b) return f(t) || { samples: 1 };
  return shotLogo(t);
}

function lightVis() {
  for (const l of [glowLight, sweepLight, rim]) l.visible = l.intensity > 0.001;
}
window.renderAt = async (t) => {
  const info0 = setup(t); lightVis();
  const n = Math.min(12, Math.max(1, info0.samples || 1)), shutter = info0.shutter || 1 / 48;
  renderer.setRenderTarget(accRT); renderer.setClearColor(0x000000, 1); renderer.clear();
  for (let i = 0; i < n; i++) {
    let ts = n > 1 ? t + (i / (n - 1) - 0.5) * shutter : t;
    const shot = SHOTS.find(([a, b]) => t >= a && t < b);
    if (shot) ts = clamp(ts, shot[0], shot[1] - 1e-4);      // motion-blur samples never cross a cut
    if (n > 1) { setup(ts); lightVis(); }
    sets.beforeRender && sets.beforeRender(ts);
    composer.render();
    accMat.uniforms.tex.value = composer.readBuffer.texture; accMat.uniforms.k.value = 1 / n;
    accMat.blending = THREE.AdditiveBlending;
    renderer.setRenderTarget(accRT); renderer.autoClear = false; renderer.render(quadScene, quadCam); renderer.autoClear = true;
  }
  accMat.uniforms.tex.value = accRT.texture; accMat.uniforms.k.value = 1; accMat.blending = THREE.NoBlending;
  renderer.setRenderTarget(null); renderer.render(quadScene, quadCam);
  if (window.__finish) { const px = new Uint8Array(4); const gl = renderer.getContext(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
  return true;
};

window.__ready = build().then(() => true).catch(e => { console.error('build failed', e.stack || e); throw e; });
