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
import { prog, lerp, clamp, smooth, easeOut, easeInOut, easeInOut5, easeIn, easeBack, v3, deg, seeded, noise3, tex } from './lib.js';
import { BOX, foodMaterials, makeBox, makeContents, rosemary } from './food.js';
import { beerBottle, wineBottle, wineGlass, terrineJar, bokehLights } from './props.js';
import * as SETS from './sets.js';

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
    fragmentShader: 'uniform sampler2D map; uniform vec3 col; uniform float amp; varying float vA; void main(){ float a = texture2D(map, gl_PointCoord).a; gl_FragColor = vec4(col * a * vA * amp, 1.0); }',
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
    'label_beer', 'label_beer_neck', 'label_wine', 'label_terrine', 'logo_mask']);
  M = foodMaterials();
  box = makeBox(M, U); scene.add(box); lid = box.userData.lid;
  ({ group: contents, pieces } = makeContents(M)); box.add(contents);
  makeSmoke(box); makeSparks(box);

  // tables
  walnut = new THREE.Group(); scene.add(walnut);
  walnut.add(texturedPlane(1600, 1600, 'walnut', [24, 24], 'walnut_bump', 1.2, 0.42, { color: 0xffffff }));
  walnut.add(gradientSphere(0x2e1d12, 0x140d08, 0x7a4a20));
  oak = new THREE.Group(); scene.add(oak);
  oak.add(texturedPlane(1600, 1600, 'oak', [20, 20], 'oak_bump', 2.0, 0.7));
  oak.add(gradientSphere(0x3b2718, 0x1d140c, 0x9a5c26));
  oak.add(linenCloth());
  propsS2 = new THREE.Group(); oak.add(propsS2);
  const wg = wineGlass(0.42); wg.position.set(-16, 0, -38); propsS2.add(wg);
  const bb = beerBottle(); bb.position.set(15, 0, -50); bb.rotation.y = 0.6; propsS2.add(bb);
  const wb = wineBottle(); wb.position.set(-30, 0, 38); wb.rotation.y = 2.2; propsS2.add(wb);
  const tj = terrineJar(); tj.position.set(-50, 0, 29); propsS2.add(tj);
  const wg2 = wineGlass(0.35); wg2.position.set(-30, 0, -10); propsS2.add(wg2);
  const bk = bokehLights(40, 7, [600, 120, 60], 0xffbe70, 4.5); bk.position.set(0, 40, -420); oak.add(bk);
  const bk2 = bk.clone(); bk2.rotation.y = Math.PI; bk2.position.set(0, 40, 420); oak.add(bk2);

  // studio for the exploded view
  studio = new THREE.Group(); scene.add(studio);
  sky = gradientSphere(0xf4ecdf, 0xa8784c, 0xffe7c2); studio.add(sky);
  studioFloor = new THREE.Mesh(new THREE.CircleGeometry(900, 64), new THREE.MeshStandardMaterial({ color: 0xe9d6b8, roughness: 0.9 }));
  studioFloor.rotation.x = -Math.PI / 2; studioFloor.receiveShadow = true; studio.add(studioFloor);

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
  Object.assign(ctx, { box, lid, contents });
  // Instagram grid thumbnails are snapshots of the real 3D shots
  const snap = (t) => { setup(t); renderer.setRenderTarget(null); renderer.render(scene, camera); return renderer.domElement; };
  await sets.makeTiles(snap);
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
    if (pc.obj.userData.morph) pc.obj.morphTargetInfluences[0] = 0.85 * ee;
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
  if (crumbs) crumbs.visible = false;
  smokePuffs.forEach(m => (m.visible = false));
  sweepLight.intensity = 0; glowLight.intensity = 0;
}

// ------------------------------------------------------------ shots
function shotLogo(t) {
  show(['walnut', 'box']);
  scene.background = null; scene.fog = new THREE.FogExp2(0x1a110a, 0.0032);
  renderer.toneMappingExposure = 1.0;
  contents.visible = false; lid.position.set(0, lid.userData.closedY, 0); lid.rotation.set(0, 0, 0);
  box.position.set(0, 0, 0); box.rotation.set(0, 0, 0);
  const c = v3(0, 0, 0);
  setKey(c, v3(-1, 1.1, 0.5), 140, 40, 3.0); setRim(c, v3(0.8, 0.5, -1), 2.0);
  hemi.intensity = 0.35;
  // branding
  const rev = clamp((t - 0.25) / 2.3);
  U.uReveal.value = rev < 1 ? rev : 1.2;
  U.uEmber.value = 1 - prog(t, 2.6, 3.3);
  const sw = prog(t, 2.5, 3.1);
  U.uSweep.value = lerp(-0.3, 1.7, easeInOut(sw)); U.uSweepAmp.value = Math.sin(sw * Math.PI) * 1.4;
  const ep = emberPos(Math.min(rev, 0.999));
  glowLight.position.set(ep.x, lid.userData.closedY + 1.0, ep.z); glowLight.intensity = (t > 0.25 && t < 2.7 ? 1 : 0) * 14 * U.uEmber.value;
  sparks.visible = t < 3.0; updateSparks(t, lid.userData.closedY);
  // smoke: puffs born along the burn path, rising and widening
  const top = lid.userData.closedY;
  smokePuffs.forEach((m, i) => {
    const b = 0.3 + i * 0.052, age = t - b;
    const life = 1.8;
    if (age < 0 || age > life) { m.visible = false; return; }
    const r0 = emberPos(clamp((b - 0.25) / 2.3, 0, 0.999));
    m.visible = true;
    const k = age / life;
    m.position.set(r0.x + Math.sin(i * 1.7 + age * 1.3) * 0.8 * k, top + 0.4 + age * 5.5, r0.z + Math.cos(i * 2.3) * 0.6 * k);
    m.scale.setScalar(1.2 + k * 7);
    m.quaternion.copy(camera.quaternion);
    m.material.opacity = Math.sin(Math.PI * Math.min(1, k * 1.15)) * 0.16;
  });
  // camera: ECU tracking the ember, opening up to the whole logo, then a fast pull-back with a 15° rotation
  const lidC = v3(0, top, 0);
  const R = BOX.LOGO_D / 2;
  let pos, at, fov = 30, roll = 0, samples = 1;
  const pA = prog(t, 0, 2.55);
  const eA = easeInOut(pA);
  const at0 = v3(0, top, -R * 0.42), at1 = v3(0, top, 0);
  at = at0.clone().lerp(at1, smooth(prog(t, 0.6, 2.4)));
  const d0 = 34, d1 = 64;
  const d = lerp(d0, d1, easeInOut(prog(t, 0.2, 2.7)));
  pos = at.clone().add(v3(Math.sin(deg(-12 + 10 * eA)) * Math.cos(deg(62)) * d, Math.sin(deg(62 - 4 * eA)) * d, Math.cos(deg(-12 + 10 * eA)) * Math.cos(deg(62)) * d));
  roll = deg(-4 + 4 * eA);
  const pB = prog(t, 2.95, 3.75);
  if (pB > 0) {
    const e = easeInOut5(pB);
    const finalAt = v3(0, 4.5, 0);
    const finalPos = orbitPos(finalAt, deg(15), deg(30), 118);
    const aPos = pos.clone(), aAt = at.clone();
    pos = aPos.lerp(finalPos, e); at = aAt.lerp(finalAt, e);
    // add an arc to the move
    pos.y += Math.sin(e * Math.PI) * 12;
    roll = lerp(roll, 0, e) + deg(15) * Math.sin(e * Math.PI) * 0.6;
    samples = pB > 0.02 && pB < 0.98 ? 10 : 1;
  }
  look(pos, at, fov, roll);
  setDOF(pos.distanceTo(t < 2.95 ? v3(ep.x * 0 , top, at.z) : at), t < 3.0 ? 0.0009 : 0.00025, 0.014);
  dustA.visible = true; dustA.position.set(0, 0, 0); dustA.material.uniforms.t.value = t; dustA.material.uniforms.size.value = t < 3 ? 0.25 : 0.5;
  crumbs.visible = false;
  return { samples, shutter: 1 / 40 };
}

function shotBox(t) {
  show(['oak', 'box']);
  scene.background = null; scene.fog = new THREE.FogExp2(0x2a1c12, 0.0026);
  renderer.toneMappingExposure = 1.0;
  contents.visible = t > 5.9;
  poseContents(0);
  U.uReveal.value = 1.2; U.uEmber.value = 0; U.uSweepAmp.value = 0; glowLight.intensity = 0;
  smokePuffs.forEach(m => (m.visible = false));
  box.position.set(0, 0.08, 0); box.rotation.set(0, 0, 0);
  const c = v3(0, 0, 0);
  setKey(c, v3(-1, 0.9, 0.35), 150, 45, 3.2); setRim(c, v3(0.6, 0.45, -1), 2.4);
  hemi.intensity = 0.5;
  // lid lifts on the drop (6.0 s), floats tilted, then drifts out of frame
  const top = lid.userData.closedY;
  const l1 = easeOut(prog(t, 6.0, 6.9)), l2 = easeInOut(prog(t, 8.1, 9.3));
  lid.position.set(l2 * 34, top + l1 * 13 + Math.sin((t - 6) * 2.2) * 0.4 * l1 + l2 * 60, l2 * -10);
  lid.rotation.set(deg(-17) * l1 + Math.sin((t - 6) * 1.7) * 0.03 * l1, deg(8) * l1, deg(6) * l1 - deg(20) * l2);
  // camera: slow 180° orbit at table height, then rise into a perfect top-down view
  const at = v3(0, 5.5, 0).lerp(v3(0, 4, 0), smooth(prog(t, 8, 9.8)));
  const az = deg(lerp(-25, 155, easeInOut(prog(t, 4.0, 8.6))));
  const el = deg(lerp(13, 89.6, easeInOut(prog(t, 7.9, 9.8))));
  const d = lerp(112, 104, prog(t, 4, 10));
  look(orbitPos(at, az, el, d), at, 34);
  setDOF(d, 0.0007, 0.024);
  dustA.visible = true; dustA.material.uniforms.t.value = t; dustA.material.uniforms.size.value = 0.6;
  crumbs.visible = false;
  return { samples: 1 };
}

function studioLook() {
  show(['studio', 'box']);
  scene.background = null; scene.fog = new THREE.Fog(0xd9c2a0, 400, 1400);
  renderer.toneMappingExposure = 0.95;
  const c = v3(0, 15, 0);
  setKey(c, v3(-1, 1.0, 0.45), 200, 70, 3.4); setRim(c, v3(0.7, 0.35, -1), 3.0);
  hemi.intensity = 0.7;
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
  poseContents(t); crumbsAt(t);
  lid.position.set(30, 200, -40);
  const at = v3(0, 4, 0).lerp(v3(0, 19, 0), easeInOut(prog(t, 10.15, 13.6)));
  const az = deg(lerp(155, 200, easeInOut(prog(t, 10.0, 15.0))));
  const el = deg(lerp(89.6, 16, easeInOut(prog(t, 10.15, 13.6))));
  const d = lerp(104, 142, easeInOut(prog(t, 10.1, 13.4)));
  look(orbitPos(at, az, el, d), at, 34);
  setDOF(d, 0.00022, 0.01);
  dustA.visible = false;
  return { samples: t < 10.4 ? 6 : 1, shutter: 1 / 48 };
}

function shotMacro(t) {
  studioLook();
  poseContents(t); crumbsAt(t);
  // macro fly-through between floating pieces, rack focus from one to the next
  const pick = k => pieces.find(p => p.kind === k);
  const tg = [pieces.filter(p => p.kind === 'cube')[3], pieces.filter(p => p.kind === 'sau')[4], pieces.filter(p => p.kind === 'toast')[2], pieces.filter(p => p.kind === 'tomme')[1]];
  const times = [15.0, 15.95, 16.85, 17.75, 18.45];
  let seg = 0; while (seg < 3 && t > times[seg + 1]) seg++;
  const lt = prog(t, times[seg], times[seg + 1]);
  const DIST = { cube: 10, ham: 16, sau: 10, toast: 13, tomme: 13 };
  const posOf = (pc, side) => {
    const p = pc.obj.position.clone();
    const out = v3(p.x, 0, p.z).normalize().applyAxisAngle(v3(0, 1, 0), side * 0.35);
    return p.clone().add(out.multiplyScalar(DIST[pc.kind] || 10)).add(v3(0, 2.2, 0));
  };
  const A = tg[seg], B = tg[Math.min(seg + 1, 3)];
  const pa = posOf(A, -1), pb = posOf(B, 1);
  const e = easeInOut(lt);
  let pos = pa.clone().lerp(pb, e);
  const out = pos.clone().setY(0).normalize();
  pos.add(out.multiplyScalar(Math.sin(e * Math.PI) * 3));
  const atA = A.obj.position, atB = B.obj.position;
  let at = atA.clone().lerp(atB, smooth(clamp((lt - 0.35) / 0.5)));
  let fov = 26, samples = 1;
  // rack focus: focus pulls to the next piece in the second half of each segment
  let focus = lerp(pos.distanceTo(atA), pos.distanceTo(atB), smooth(clamp((lt - 0.45) / 0.35)));
  if (seg === 3 && lt > 0.99) { /* hold */ }
  // pull back for the snap-back and the lid
  const pb2 = prog(t, 18.35, 18.95);
  if (pb2 > 0) {
    const fin = orbitPos(v3(0, 6, 0), deg(208), deg(24), 120);
    const e2 = easeInOut5(pb2);
    pos = pos.lerp(fin, e2); at = at.clone().lerp(v3(0, 6, 0), e2); fov = lerp(26, 32, e2);
    focus = lerp(focus, 120, e2);
    samples = pb2 > 0.05 && pb2 < 0.95 ? 8 : 1;
  }
  if (t > 18.95) {
    const k = prog(t, 18.95, 20.0);
    pos = orbitPos(v3(0, 6, 0), deg(208 + 6 * k), deg(24 + 4 * k), 120 - 6 * k); at = v3(0, 6, 0); fov = 32; focus = pos.distanceTo(at);
    if (t > 19.3) samples = 4;
  }
  look(pos, at, fov);
  setDOF(focus, pb2 > 0.5 ? 0.00025 : 0.004, pb2 > 0.5 ? 0.008 : 0.02);
  // lid falls back and closes with a clap at ~19.95 s
  const top = lid.userData.closedY;
  const kl = prog(t, 19.3, 19.93);
  if (t < 19.3) lid.position.set(30, 200, -40);
  else {
    const y = top + (1 - easeIn(kl)) * 34;
    lid.position.set(0, y, 0); lid.rotation.set(deg(-14) * (1 - easeIn(kl)), 0, deg(5) * (1 - kl));
    if (kl >= 1) { const b = prog(t, 19.93, 20.0); lid.position.y = top + Math.sin(b * Math.PI) * 0.35; lid.rotation.set(0, 0, 0); }
  }
  dustA.visible = false;
  return { samples, shutter: 1 / 48 };
}

const SHOTS = [
  [0, 4, shotLogo], [4, 10, shotBox], [10, 15, shotExplode], [15, 20, shotMacro],
  [20, 27, t => sets.shotLaptop(t, ctx)], [27, 34, t => sets.shotFollow(t, ctx)], [34, 42, t => sets.shotPoster(t, ctx)],
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
  const n = Math.min(6, Math.max(1, info0.samples || 1)), shutter = info0.shutter || 1 / 48;
  renderer.setRenderTarget(accRT); renderer.setClearColor(0x000000, 1); renderer.clear();
  for (let i = 0; i < n; i++) {
    const ts = n > 1 ? t + (i / (n - 1) - 0.5) * shutter : t;
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
