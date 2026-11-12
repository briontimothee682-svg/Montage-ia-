// Entry point: renderer, post-processing, motion-blur accumulation, per-shot cameras.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { V, clamp, lerp, smooth, keys, easeInOut, easeOut, seeded, bar, DROP, beatPulse } from './lib.js';
import { Film, SHOTS, carX } from './film.js';
import { APT, CLUB, updateStreaks } from './city.js';

const qs = new URLSearchParams(location.search);
const W = parseInt(qs.get('w') || '1080'), H = parseInt(qs.get('h') || '1920');

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(50, W / H, 0.03, 15000);
const target = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
const composer = new EffectComposer(renderer, target);
const renderPass = new RenderPass(new THREE.Scene(), camera);
composer.addPass(renderPass);
const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.55, 0.55, 1.05);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const accum = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
const quad = new FullScreenQuad(new THREE.ShaderMaterial({
  uniforms: { tex: { value: null }, k: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  fragmentShader: 'uniform sampler2D tex; uniform float k; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tex, vUv).rgb * k, 1.); }',
  depthTest: false, depthWrite: false,
}));

const film = new Film();
film.camera = camera;

// smooth noise for handheld / vibration
function shake(t, amp, freq, seed) {
  const s = seed * 13.7;
  return V(
    Math.sin(t * freq * 1.0 + s) * 0.6 + Math.sin(t * freq * 2.3 + s * 2) * 0.4,
    Math.sin(t * freq * 1.3 + s * 3) * 0.6 + Math.sin(t * freq * 2.9 + s) * 0.4,
    Math.sin(t * freq * 0.9 + s * 5) * 0.5,
  ).multiplyScalar(amp);
}

function path(t, ks) {
  // ks: [[t, Vector3], ...] -> Catmull-Rom through points, parametrised by time
  if (t <= ks[0][0]) return ks[0][1].clone();
  if (t >= ks[ks.length - 1][0]) return ks[ks.length - 1][1].clone();
  let i = 0; while (t > ks[i + 1][0]) i++;
  const p0 = ks[Math.max(0, i - 1)][1], p1 = ks[i][1], p2 = ks[i + 1][1], p3 = ks[Math.min(ks.length - 1, i + 2)][1];
  const u = (t - ks[i][0]) / (ks[i + 1][0] - ks[i][0]);
  const c = new THREE.CatmullRomCurve3([p0, p1, p2, p3], false, 'centripetal');
  return c.getPoint((1 + u) / 3);
}

function setCam(pos, look, fov, roll = 0) {
  if (window.debugCam) {
    const d = window.debugCam;
    const L = d.carRel ? (v => film.car.root.localToWorld(V(...v))) : (v => V(...v));
    pos = L(d.pos); look = L(d.look); fov = d.fov || fov; roll = 0;
    film.car.body.visible = !d.hideBody;
    film.cast.lucas.headGroup.visible = true;
    if (d.hide) for (const n of d.hide) film.cast[n].root.visible = false;
  } else film.car.body.visible = true;
  camera.position.copy(pos);
  camera.up.set(0, 1, 0);
  camera.lookAt(look);
  if (roll) camera.rotateZ(roll);
  camera.fov = fov; camera.aspect = W / H; camera.updateProjectionMatrix();
}

const F = APT.floor, Z0 = APT.z, ZWIN = APT.z - 3.2;

function stage(id, t) {
  const f = film;
  f.cast.lucas.headGroup.visible = true;
  bloom.strength = 0.55;
  renderer.toneMappingExposure = 1.0;
  if (id === '01' || id === '02' || (id === '03a' && t < 11.62)) {
    if (id === '01') {
      const p = easeInOut(t / 6.0);
      setCam(V(0.03, F + 0.52 + 0.05 * p, Z0 + 2.45 - 0.6 * p).add(shake(t, 0.006, 1.2, 1)), V(0, F + 1.0 + 0.04 * p, Z0 - 1.5), 74 - 4 * p);
    } else if (id === '02') {
      const c = V(0, F + 0.95, Z0 - 1.05);
      const th = keys(t, [[6.0, 0.12], [9.6, -0.55]], p => p);
      const rise = smooth((t - 9.5) / 1.5);
      const r = lerp(3.1, 2.3, rise);
      const pos = V(c.x + Math.sin(th) * r, lerp(F + 1.0, F + 1.5, rise), c.z + Math.cos(th) * r + rise * 0.8);
      const look = c.clone().lerp(V(0, F + 1.55, ZWIN), smooth((t - 9.7) / 1.2));
      setCam(pos.add(shake(t, 0.006, 1.1, 2)), look, lerp(58, 56, rise));
    } else {
      // 03a, inside part: fly over the table to the glass
      const pos = path(t, [[10.875, V(0.45, F + 1.5, Z0 + 1.6)], [11.0, V(0.4, F + 1.5, Z0 + 0.9)], [11.3, V(0.12, F + 1.3, Z0 - 1.2)], [11.5, V(0, F + 1.4, ZWIN)], [11.85, V(0, F + 2.6, ZWIN - 14)]]);
      const ahead = path(t + 0.06, [[10.875, V(0.45, F + 1.5, Z0 + 1.6)], [11.0, V(0.4, F + 1.5, Z0 + 0.9)], [11.3, V(0.12, F + 1.3, Z0 - 1.2)], [11.5, V(0, F + 1.4, ZWIN)], [11.85, V(0, F + 2.6, ZWIN - 14)]]);
      setCam(pos, ahead.clone().add(V(0, -0.15, 0)).lerp(V(0, F + 1.3, ZWIN - 30), 0.6), 66);
    }
    f.apartment(t, id === '03a' ? '02' : id, camera);
    f.car.root.visible = id === '03a';
    if (id === '03a') f.placeCar(Math.max(t, 11), false);
    const glassHit = Math.exp(-Math.abs(t - DROP) / 0.05);
    bloom.strength = 0.55 + 1.6 * glassHit;
    renderer.toneMappingExposure = 1.0 + 0.8 * glassHit;
    return;
  }
  if (id === '03a') {
    // over the rooftops, down to the road behind the car
    f.show(['aptExt', 'city', 'car', 'apt']);
    f.lightsFor(l => l === f.moon || l === f.ambient || f.car.beams.includes(l));
    f.scene.fog = new THREE.FogExp2(0x0b1230, 0.0009);
    f.scene.environmentIntensity = 0.6;
    const cx = carX(13.34);
    const ks = [[11.5, V(0, F + 1.4, ZWIN)], [11.85, V(0, F + 2.6, ZWIN - 14)], [12.4, V(6, 27, -2)], [12.9, V(cx - 40, 15, -30)], [13.34, V(cx - 14, 6, -42.6)], [13.6, V(carX(13.6) - 11, 5.0, -42.6)]];
    const pos = path(t, ks), ahead = path(t + 0.05, ks);
    const yawRate = Math.atan2(ahead.x - pos.x, -(ahead.z - pos.z));
    setCam(pos, ahead.clone().add(V(0, -0.6, 0)), 66, -0.25 * smooth((t - 12.3) / 0.4) * (1 - smooth((t - 13.0) / 0.3)));
    for (const h of Object.values(f.cast)) h.root.visible = false;
    f.placeCar(t, t > 12.6);
    updateStreaks(f.lake.streaks, camera);
    return;
  }
  // ------------------------------------------------------------------ car shots
  if (id === '03b' || id === '04' || id === '05' || (id === '06')) {
    f.show(id === '06' ? ['city', 'car', 'clubExt'] : ['city', 'car']);
    f.lightsFor(l => l === f.moon || l === f.ambient || f.car.beams.includes(l) || l === f.cabinLight || l === f.passLight || (l === f.carKey && id !== '04') || (id === '06' && f.clubExt.lights.includes(l)));
    f.ambient.color.set(0x3a4a8a); f.ambient.intensity = 0.25;
    f.scene.fog = new THREE.FogExp2(0x0b1230, 0.0008);
    f.scene.environmentIntensity = 0.7;
    for (const h of Object.values(f.cast)) h.root.visible = true;
    const car = f.placeCar(t);
    const L = v => f.car.root.localToWorld(v.clone());
    // streetlight sweeping over the cabin
    const lampPhase = ((car.x + 1200) % 26) / 26;
    f.passLight.position.copy(L(V(1.2, 2.6, 6 - lampPhase * 26)));
    f.passLight.intensity = 6 * Math.exp(-(((lampPhase - 0.25) / 0.15) ** 2));
    f.cabinLight.position.copy(L(V(0.0, 1.2, 0.38)));
    f.carKey.position.copy(L(V(-3.5, 3.2, 1.5)));
    const lamp2 = ((car.x + 1200 - 13) % 26) / 26;
    f.carKey.intensity = 6 + 14 * Math.exp(-(((lamp2 - 0.5) / 0.18) ** 2));
    updateStreaks(f.lake.streaks, camera);
    if (id === '06') f.stageClub(t);
    if (id === '03b') {
      const eye = f.driverEye(t);
      const rel = [[13.22, V(0, 6.4, -15)], [13.34, V(0, 6, -14)], [14.0, V(0, 2.3, -4.5)], [14.45, V(0.1, 1.95, 0.4)], [14.8, V(0.3, 1.5, 3.0)], [15.19, f.car.root.worldToLocal(eye.clone())], [15.32, f.car.root.worldToLocal(eye.clone())]];
      const p = path(t, rel);
      const pitch = keys(t, [[13.34, -0.45], [14.2, -0.12], [15.19, -0.06]]);
      const look = L(p.clone().add(V(0, Math.tan(pitch) * 10, 10)));
      setCam(L(p), look, keys(t, [[13.34, 66], [15.19, 72]]));
      f.cast.lucas.headGroup.visible = camera.position.distanceTo(eye) > 0.35;
      return;
    }
    if (id === '04') {
      const eye = f.driverEye(t);
      const vib = shake(t, 0.004, 9, 3).add(shake(t, 0.012, 0.8, 4));
      setCam(eye.clone().add(vib), L(V(0.37 + 0.3 * Math.sin(t * 0.3), -0.7, 12)), 88, 0.01 * Math.sin(t * 0.7));
      f.cast.lucas.headGroup.visible = false;
      return;
    }
    if (id === '05') {
      const eye = f.car.root.worldToLocal(f.driverEye(t));
      const rel = [[20.6, eye.clone()], [20.72, eye.clone()], [21.05, V(0.05, 1.15, 0.45)], [21.35, V(-0.6, 1.16, 0.45)], [21.6, V(-1.15, 1.1, 0.3)], [22.0, V(-3.6, 0.72, 0.8)], [22.7, V(-8.8, 0.5, 0.9)], [24.6, V(-9.6, 0.46, 0.3)]];
      const p = path(t, rel);
      const lk = path(t, [[20.6, V(0.37, -1.6, 12)], [20.72, V(0.37, -1.6, 12)], [21.1, V(-4, 0.2, 7)], [21.5, V(-9, 0.6, 1.5)], [21.85, V(-4, 0.7, 9)], [22.25, V(0, 0.7, 2.5)], [22.7, V(0, 0.75, 0.0)], [24.7, V(0, 0.75, -0.1)]]);
      setCam(L(p).add(shake(t, 0.01, 3, 5)), L(lk), keys(t, [[20.72, 88], [22.4, 52]]));
      f.cast.lucas.headGroup.visible = t > 20.95;
      return;
    }
    // 06: rise into the sky and reveal the club
    const club = V(CLUB.x, 6.5, CLUB.front);
    const p0 = L(V(-9.6, 0.46, 0.3));
    const ks = [[24.3, L(V(-9.6, 0.46, 0.3))], [24.41, p0], [25.1, L(V(-7.5, 4.5, 4))], [25.9, V(carX(25.9) + 14, 22, -47)], [26.9, V(CLUB.x - 18, 34, CLUB.front - 50)], [29.2, V(CLUB.x - 8, 17, CLUB.front - 36)]];
    const pos = path(t, ks);
    const look = L(V(0, 0.6, 0)).lerp(club, smooth((t - 25.2) / 1.3)).lerp(V(CLUB.x, 3, CLUB.front - 2), smooth((t - 27.5) / 1.5));
    setCam(pos.add(shake(t, 0.04, 0.7, 6)), look, 50);
    return;
  }
  // ------------------------------------------------------------------ club
  f.stageClub(t);
  f.djSpot.position.set(CLUB.x, 7, f.club.boothPos.z - 7); f.djSpot.target.position.set(CLUB.x, 2.4, f.club.boothPos.z + 0.8);
  f.ambient.color.set(0x5a3a9a); f.ambient.intensity = 0.45;
  if (id === '07') {
    f.show(t > 30.7 ? ['clubExt', 'clubInt'] : ['clubExt', 'clubInt', 'car', 'city']);
    f.placeCar(t, false);
    for (const h of Object.values(f.cast)) h.root.visible = false;
    const inside = t > 30.2;
    f.lightsFor(l => l === f.ambient || (inside ? (f.club.group.children.includes(l) || l === f.club.strobe || l === f.djSpot) : (f.clubExt.lights.includes(l) || l === f.moon || f.car.beams.includes(l) || f.club.lights[0] === l)));
    f.scene.fog = inside ? new THREE.FogExp2(0x140a26, 0.03) : new THREE.FogExp2(0x0b1230, 0.0012);
    f.scene.environmentIntensity = inside ? 0.25 : 0.6;
    const ks = [[28.9, V(CLUB.x - 8.3, 17.5, CLUB.front - 36.5)], [29.02, V(CLUB.x - 8, 17, CLUB.front - 36)], [29.5, V(CLUB.x - 2, 6, CLUB.front - 16)], [29.95, V(CLUB.x, 2.2, CLUB.front - 5)], [30.25, V(CLUB.x, 1.9, CLUB.front)], [30.6, V(CLUB.x, 2.6, CLUB.front + 4)], [31.4, V(CLUB.x - 3, 2.9, CLUB.front + 12)], [32.3, V(CLUB.x + 2.5, 2.7, CLUB.front + 20)], [33.2, V(CLUB.x - 1.5, 2.9, CLUB.front + 27)], [34.2, V(CLUB.x + 1, 2.6, CLUB.front + 31.5)], [35.47, V(CLUB.x, 2.45, CLUB.front + 33.6)], [36.6, V(CLUB.x, 2.4, CLUB.front + 34.2)]];
    const pos = path(t, ks), ahead = path(t + 0.08, ks);
    const dj = V(CLUB.x, 2.75, f.club.boothPos.z + 0.8);
    const look = ahead.clone().add(V(0, -0.1, 0)).lerp(dj, smooth((t - 34.6) / 0.8));
    setCam(pos.add(shake(t, 0.015, 2.2, 7)), look, 64, 0.12 * Math.sin(t * 1.7) * (1 - smooth((t - 34.8) / 0.6)));
    bloom.strength = 0.7 + 0.5 * f.club.strobe.intensity / 400;
    return;
  }
  // 08: VIP
  f.show(['clubInt']);
  f.lightsFor(l => l === f.ambient || f.club.group.children.includes(l) || l === f.club.strobe || f.club.vip.children.includes(l) || l === f.djSpot);
  f.scene.fog = new THREE.FogExp2(0x140a26, 0.028);
  f.scene.environmentIntensity = 0.3;
  for (const h of Object.values(f.cast)) h.root.visible = true;
  f.car.root.visible = false;
  const vip = f.club.vip; vip.updateMatrixWorld(true);
  const Lv = v => vip.localToWorld(v.clone());
  const th = keys(t, [[36.2, -0.42], [41.2, 0.38]], p => p);
  const c = Lv(V(2.2, 2.85, 0.0));
  const r = 4.3;
  const pos = Lv(V(2.2 - r * Math.cos(th), 3.05 + 0.08 * Math.sin(t * 1.3), r * Math.sin(th)));
  film.camera.position.copy(pos);
  f.vipDance(t);
  setCam(pos.add(shake(t, 0.02, 1.6, 8)), c.add(V(0, -0.15, 0)), 56, 0.03 * Math.sin(t * 0.9));
  const end = smooth((t - 40.7) / 0.3);
  f.club.strobe.intensity = Math.max(f.club.strobe.intensity, 900 * end);
  bloom.strength = 0.7 + 0.5 * f.club.strobe.intensity / 400 + 1.5 * end;
}

const SAMPLES = { '01': 1, '02': 1, '03a': 3, '03b': 3, '04': 2, '05': 3, '06': 2, '07': 2, '08': 1 };

window.renderShot = (id, t) => {
  const n = SAMPLES[id] || 1;
  if (n === 1) {
    stage(id, t);
    renderPass.scene = film.scene;
    composer.renderToScreen = true;
    composer.render();
    return;
  }
  composer.renderToScreen = false;
  renderer.setRenderTarget(accum); renderer.setClearColor(0x000000, 1); renderer.clear();
  for (let i = 0; i < n; i++) {
    const ts = t + ((i + 0.5) / n - 0.5) * (0.5 / 24);
    stage(id, ts);
    renderPass.scene = film.scene;
    composer.render();
    renderer.setRenderTarget(accum);
    quad.material.uniforms.tex.value = composer.readBuffer.texture;
    quad.material.uniforms.k.value = 1 / n;
    quad.material.blending = THREE.AdditiveBlending; quad.material.transparent = true;
    renderer.autoClear = false;
    quad.render(renderer);
    renderer.autoClear = true;
  }
  renderer.setRenderTarget(null);
  quad.material.uniforms.tex.value = accum.texture;
  quad.material.uniforms.k.value = 1;
  quad.material.blending = THREE.NoBlending; quad.material.transparent = false;
  quad.render(renderer);
};

window.renderTest = (name, a = {}) => window.renderShot(name, a.t);
window.film = film;
window.debugInfo = (id, t) => {
  stage(id, t);
  const h = film.cast.lucas, sw = film.car.steer;
  const P = o => o.getWorldPosition(new THREE.Vector3()).toArray().map(v => +v.toFixed(3));
  const car = film.car.root;
  const rel = o => car.worldToLocal(o.getWorldPosition(new THREE.Vector3())).toArray().map(v => +v.toFixed(3));
  return { cam: car.worldToLocal(camera.position.clone()).toArray().map(v => +v.toFixed(3)), wristL: rel(h.arm.L.wr), wristR: rel(h.arm.R.wr), shL: rel(h.arm.L.sh), elL: rel(h.arm.L.el), head: rel(h.headGroup), hips: rel(h.hips), wheel: rel(sw), visible: h.root.visible, armVisible: h.arm.L.sh.visible };
};

(async () => {
  await film.build(renderer);
  film.cabinLight = new THREE.PointLight(0xff5a64, 0.8, 2.0, 2); film.scene.add(film.cabinLight);
  film.carKey = new THREE.PointLight(0xc8d2ff, 12, 18, 1.6); film.scene.add(film.carKey); film.allLights.push(film.carKey);
  film.djSpot = new THREE.SpotLight(0xc8d4ff, 120, 25, 0.35, 0.6, 1.5); film.scene.add(film.djSpot, film.djSpot.target); film.allLights.push(film.djSpot);
  film.passLight = new THREE.PointLight(0xffa24a, 0, 9, 2); film.scene.add(film.passLight);
  film.allLights.push(film.cabinLight, film.passLight);
  window.__ready = true;
})();
