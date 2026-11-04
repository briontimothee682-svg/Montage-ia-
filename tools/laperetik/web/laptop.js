// Silver aluminium laptop, a hand on the trackpad (SDF + marching cubes), and the Instagram screen UI.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { v3, deg, clamp, prog, lerp, smooth, easeOut, easeInOut, easeBack, seeded, canvas, canvasTex, tex } from './lib.js';

export const LAP = { W: 31.3, D: 22.1, T: 1.55, SW: 29.6, SH: 18.5, OPEN: deg(108) };
export const SCR = { w: 1600, h: 1000 };

const alu = () => new THREE.MeshPhysicalMaterial({ color: 0xc4c6c8, metalness: 1, roughness: 0.34, clearcoat: 0.1, envMapIntensity: 1.1 });

// ------------------------------------------------------------ laptop
export function makeLaptop(screenMat) {
  const g = new THREE.Group();
  const A = alu();
  const base = new THREE.Mesh(new RoundedBoxGeometry(LAP.W, LAP.T, LAP.D, 4, 0.5), A); base.position.y = LAP.T / 2; g.add(base);
  const well = new THREE.Mesh(new THREE.PlaneGeometry(27.6, 11.6), new THREE.MeshStandardMaterial({ color: 0x1b1b1c, roughness: 0.7 }));
  well.rotation.x = -Math.PI / 2; well.position.set(0, LAP.T + 0.005, -4.2); g.add(well);
  // keys
  const keyGeo = new RoundedBoxGeometry(1.55, 0.18, 1.5, 2, 0.12);
  const keyMat = new THREE.MeshStandardMaterial({ color: 0x0f0f10, roughness: 0.55 });
  const rows = [[14, 1.55, -9.25], [14, 1.55, -7.55], [14, 1.55, -5.85], [13, 1.55, -4.15], [12, 1.55, -2.45], [11, 1.55, -0.75]];
  let n = 0; const keys = new THREE.InstancedMesh(keyGeo, keyMat, 90); const m4 = new THREE.Matrix4();
  rows.forEach(([cnt, w, z], r) => {
    const total = 27.0, step = total / cnt;
    for (let i = 0; i < cnt; i++) {
      const sx = r === 5 && i === 5 ? 3.4 : 1;
      m4.makeScale(r === 0 ? 1 : sx, 1, r === 0 ? 0.55 : 1).setPosition(-total / 2 + step * (i + 0.5), LAP.T + 0.1, z + (r === 0 ? 0.35 : 0));
      if (r === 5 && (i === 4 || i === 6)) continue;
      keys.setMatrixAt(n++, m4);
    }
  });
  keys.count = n; g.add(keys);
  const pad = new THREE.Mesh(new RoundedBoxGeometry(14.5, 0.02, 9.2, 2, 0.008), new THREE.MeshPhysicalMaterial({ color: 0xb9bbbd, metalness: 0.6, roughness: 0.22, clearcoat: 0.6 }));
  pad.position.set(0, LAP.T + 0.005, 5.6); g.add(pad);
  const notch = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, 0.6), A); notch.position.set(0, LAP.T * 0.5, LAP.D / 2 - 0.1); g.add(notch);
  // lid, hinged at the back edge
  const hinge = new THREE.Group(); hinge.position.set(0, LAP.T, -LAP.D / 2 + 0.4); g.add(hinge);
  const lid = new THREE.Group(); hinge.add(lid);
  const shell = new THREE.Mesh(new RoundedBoxGeometry(LAP.W, 21.5, 0.55, 4, 0.25), A); shell.position.set(0, 21.5 / 2, -0.3); lid.add(shell);
  const bezel = new THREE.Mesh(new THREE.PlaneGeometry(LAP.W - 0.3, 21.2), new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.15, clearcoat: 1 }));
  bezel.position.set(0, 21.5 / 2, 0.0); lid.add(bezel);
  // the display: two halves so it can open like a window
  const halves = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(side * LAP.SW / 2, 21.5 / 2 + 0.2, 0.06); lid.add(pivot);
    const geo = new THREE.PlaneGeometry(LAP.SW / 2, LAP.SH);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, side < 0 ? uv.getX(i) * 0.5 : 0.5 + uv.getX(i) * 0.5);
    const m = new THREE.Mesh(geo, screenMat); m.position.x = -side * LAP.SW / 4; pivot.add(m);
    const back = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.4 })); back.rotation.y = Math.PI; back.position.copy(m.position); back.position.z = -0.01; pivot.add(back);
    halves.push(pivot);
  }
  hinge.rotation.x = -(LAP.OPEN - Math.PI / 2);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData = { hinge, lid, halves, screenCenterLocal: v3(0, 21.5 / 2 + 0.2, 0.05) };
  return g;
}

// screen shader: UI canvas over the Reel render target, emissive
export function screenMaterial(uiTex, reelTex) {
  return new THREE.ShaderMaterial({
    uniforms: { ui: { value: uiTex }, reel: { value: reelTex }, rect: { value: new THREE.Vector4(0, 0, 1, 1) }, gain: { value: 1.0 }, flash: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `uniform sampler2D ui, reel; uniform vec4 rect; uniform float gain, flash; varying vec2 vUv;
      vec3 toLin(vec3 c){ return pow(c, vec3(2.2)); }
      void main(){
        vec4 u = texture2D(ui, vUv);
        vec2 r = (vUv - rect.xy) / rect.zw;
        vec3 rc = (r.x >= 0.0 && r.x <= 1.0 && r.y >= 0.0 && r.y <= 1.0) ? texture2D(reel, r).rgb : vec3(0.0);
        vec3 c = mix(rc, toLin(u.rgb), u.a);
        c = mix(c, vec3(1.0, 0.93, 0.8), flash);
        gl_FragColor = vec4(c * gain, 1.0);
      }`,
    side: THREE.FrontSide,
  });
}

// ------------------------------------------------------------ hand (signed distance field -> marching cubes)
function sdCapsule(px, py, pz, a, b, ra, rb) {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const pax = px - a[0], pay = py - a[1], paz = pz - a[2];
  const h = clamp((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz));
  const dx = pax - bax * h, dy = pay - bay * h, dz = paz - baz * h;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - lerp(ra, rb, h);
}
function smin(a, b, k) { const h = clamp(0.5 + 0.5 * (b - a) / k); return lerp(b, a, h) - k * h * (1 - h); }
function sdEllipsoid(px, py, pz, c, r) {
  const x = (px - c[0]) / r[0], y = (py - c[1]) / r[1], z = (pz - c[2]) / r[2];
  const k0 = Math.sqrt(x * x + y * y + z * z);
  const x1 = x / r[0], y1 = y / r[1], z1 = z / r[2];
  const k1 = Math.sqrt(x1 * x1 + y1 * y1 + z1 * z1);
  return k0 * (k0 - 1) / Math.max(k1, 1e-6);
}

// right hand, palm down, index finger on the trackpad. Local frame: x right, y up, -z toward the screen. cm.
export function makeHand() {
  const fingers = [
    // [knuckle, mid, distal, tip], radii
    { p: [[-2.6, 1.9, -3.6], [-3.1, 1.1, -7.3], [-3.3, 0.35, -9.7], [-3.35, 0.2, -11.2]], r: [0.95, 0.82, 0.72, 0.66] },  // index (extended to the pad)
    { p: [[-0.6, 2.1, -3.9], [-0.7, 1.6, -7.0], [-0.5, 0.6, -8.9], [-0.3, 0.15, -9.8]], r: [0.98, 0.86, 0.75, 0.68] },     // middle (relaxed curl)
    { p: [[1.3, 1.95, -3.6], [1.6, 1.4, -6.4], [1.75, 0.5, -8.0], [1.8, 0.15, -8.8]], r: [0.92, 0.8, 0.7, 0.63] },         // ring
    { p: [[3.0, 1.6, -3.0], [3.5, 1.05, -5.3], [3.7, 0.35, -6.6], [3.75, 0.1, -7.3]], r: [0.8, 0.7, 0.6, 0.55] },          // little
  ];
  const thumb = { p: [[-3.2, 0.8, 1.2], [-4.6, 0.5, -1.6], [-5.2, 0.4, -3.6], [-5.4, 0.35, -4.9]], r: [1.25, 1.0, 0.86, 0.75] };
  const sdf = (x, y, z) => {
    let d = sdEllipsoid(x, y, z, [0.2, 1.6, -0.6], [4.3, 1.25, 3.8]);
    d = smin(d, sdCapsule(x, y, z, [0.6, 1.4, 2.0], [1.6, 1.8, 9.0], 2.7, 2.6), 1.6);                 // wrist / forearm
    for (const f of [...fingers, thumb]) {
      let fd = 1e9;
      for (let i = 0; i < 3; i++) fd = Math.min(fd, sdCapsule(x, y, z, f.p[i], f.p[i + 1], f.r[i], f.r[i + 1]));
      d = smin(d, fd, f === thumb ? 1.2 : 0.9);
    }
    return d;
  };
  const RES = 84, HALF = 9.5, C = v3(-0.6, 1.0, -1.0);
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xd9a083, roughness: 0.52, sheen: 0.5, sheenColor: new THREE.Color(0xffc2a8), sheenRoughness: 0.5, clearcoat: 0.08, emissive: 0x2a0c06, emissiveIntensity: 0.6 });
  const mc = new MarchingCubes(RES, mat, false, false, 180000);
  mc.isolation = 0;
  const f = mc.field, size = mc.size;
  for (let k = 0; k < size; k++) for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const x = C.x + ((i - size / 2) / (size / 2)) * HALF, y = C.y + ((j - size / 2) / (size / 2)) * HALF, z = C.z + ((k - size / 2) / (size / 2)) * HALF;
    f[i + size * j + size * size * k] = -sdf(x, y, z);
  }
  mc.update();
  const src = mc.geometry;
  const geo = new THREE.BufferGeometry();
  const cnt = mc.count;
  geo.setAttribute('position', new THREE.BufferAttribute(src.attributes.position.array.slice(0, cnt * 3), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(src.attributes.normal.array.slice(0, cnt * 3), 3));
  geo.scale(HALF, HALF, HALF); geo.translate(C.x, C.y, C.z);
  const g = new THREE.Group();
  const skin = new THREE.Mesh(geo, mat); g.add(skin);
  // fingernails
  const nailMat = new THREE.MeshPhysicalMaterial({ color: 0xe8b7a4, roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.2 });
  for (const fg of [...fingers, thumb]) {
    const a = v3(...fg.p[2]), b = v3(...fg.p[3]);
    const dir = b.clone().sub(a).normalize();
    const r = fg.r[3];
    const nail = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), nailMat);
    nail.scale.set(r * 0.72, r * 0.18, r * 1.05);
    nail.position.copy(a.clone().lerp(b, 0.62)).add(v3(0, r * 0.86, 0));
    nail.lookAt(nail.position.clone().add(dir)); nail.rotateX(0);
    g.add(nail);
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData.indexTip = v3(...fingers[0].p[3]);
  return g;
}

// ------------------------------------------------------------ Instagram UI (French, warm palette)
const CREAMW = '#fbf8f3', ESP = '#3a2a1f', GOLD = '#c9a15b', CAR = '#a8784c', MUTED = '#8a7a6c', LINE = '#e6ddd0';

function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
function icon(c, name, x, y, s, col, fill = false, lw = 2.4) {
  c.save(); c.translate(x, y); c.scale(s / 24, s / 24); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = lw; c.lineJoin = 'round'; c.lineCap = 'round';
  c.beginPath();
  if (name === 'heart') {
    c.moveTo(12, 21); c.bezierCurveTo(4, 15, 1, 11, 1, 7.5); c.bezierCurveTo(1, 4, 3.6, 1.8, 6.6, 1.8); c.bezierCurveTo(9, 1.8, 11, 3.2, 12, 5.2);
    c.bezierCurveTo(13, 3.2, 15, 1.8, 17.4, 1.8); c.bezierCurveTo(20.4, 1.8, 23, 4, 23, 7.5); c.bezierCurveTo(23, 11, 20, 15, 12, 21); c.closePath();
    fill ? c.fill() : c.stroke();
  } else if (name === 'comment') { c.arc(12, 12, 9.5, deg(60), deg(400)); c.lineTo(3, 22); c.closePath(); c.stroke(); }
  else if (name === 'share') { c.moveTo(22, 2); c.lineTo(2, 9); c.lineTo(11, 13); c.lineTo(15, 22); c.closePath(); c.moveTo(22, 2); c.lineTo(11, 13); c.stroke(); }
  else if (name === 'save') { c.moveTo(5, 2); c.lineTo(19, 2); c.lineTo(19, 22); c.lineTo(12, 16); c.lineTo(5, 22); c.closePath(); c.stroke(); }
  else if (name === 'home') { c.moveTo(3, 10); c.lineTo(12, 2.5); c.lineTo(21, 10); c.lineTo(21, 21); c.lineTo(15, 21); c.lineTo(15, 14); c.lineTo(9, 14); c.lineTo(9, 21); c.lineTo(3, 21); c.closePath(); c.stroke(); }
  else if (name === 'search') { c.arc(10.5, 10.5, 7.5, 0, Math.PI * 2); c.moveTo(16, 16); c.lineTo(22, 22); c.stroke(); }
  else if (name === 'explore') { c.arc(12, 12, 10, 0, Math.PI * 2); c.moveTo(16, 8); c.lineTo(10, 10); c.lineTo(8, 16); c.lineTo(14, 14); c.closePath(); c.stroke(); }
  else if (name === 'reels') { rr(c, 2, 2, 20, 20, 5); c.moveTo(2, 8); c.lineTo(22, 8); c.moveTo(8, 2); c.lineTo(11, 8); c.moveTo(14, 2); c.lineTo(17, 8); c.moveTo(10, 11.5); c.lineTo(15.5, 14.8); c.lineTo(10, 18); c.closePath(); c.stroke(); }
  else if (name === 'msg') { c.moveTo(22, 2); c.lineTo(2, 9); c.lineTo(11, 13); c.lineTo(15, 22); c.closePath(); c.stroke(); }
  else if (name === 'plus') { rr(c, 2, 2, 20, 20, 6); c.moveTo(12, 7); c.lineTo(12, 17); c.moveTo(7, 12); c.lineTo(17, 12); c.stroke(); }
  else if (name === 'more') { for (const xx of [5, 12, 19]) { c.moveTo(xx + 1.6, 12); c.arc(xx, 12, 1.6, 0, Math.PI * 2); } c.fill(); }
  else if (name === 'grid') { for (const a of [2, 9.3, 16.6]) for (const b of [2, 9.3, 16.6]) c.rect(a, b, 5.4, 5.4); c.stroke(); }
  else if (name === 'reelSmall') { rr(c, 3, 3, 18, 18, 4); c.moveTo(10, 8.5); c.lineTo(16, 12); c.lineTo(10, 15.5); c.closePath(); c.stroke(); }
  else if (name === 'x') { c.moveTo(4, 4); c.lineTo(20, 20); c.moveTo(20, 4); c.lineTo(4, 20); c.stroke(); }
  c.restore();
}
function cursor(c, x, y, s = 1, press = 0) {
  c.save(); c.translate(x, y); c.scale(s * (1 - press * 0.12), s * (1 - press * 0.12));
  c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 30); c.lineTo(7.5, 23); c.lineTo(12.5, 34); c.lineTo(17, 32); c.lineTo(12, 21.5); c.lineTo(22, 21.5); c.closePath();
  c.fillStyle = '#111'; c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = 6; c.shadowOffsetY = 2;
  c.stroke(); c.shadowColor = 'transparent'; c.fill(); c.restore();
}
function font(w, s, fam = 'Inter') { return `${w} ${s}px ${fam}`; }

export class InstaUI {
  constructor(tiles, logoImg) {
    this.cv = canvas(SCR.w, SCR.h); this.c = this.cv.getContext('2d');
    this.tex = canvasTex(this.cv, false); this.tex.colorSpace = THREE.NoColorSpace;
    this.tiles = tiles; this.logo = logoImg;
    // layout
    this.grid = { x: 470, y: 560, w: 292, h: 389, gap: 6 };
    this.followBtn = { x: 900, y: 92, w: 140, h: 44 };
    this.heart = { x: 1338, y: 470 };
  }
  tileRect(i) { const g = this.grid; const col = i % 3, row = Math.floor(i / 3); return { x: g.x + col * (g.w + g.gap), y: g.y + row * (g.h + g.gap), w: g.w, h: g.h }; }
  profile(c, st) {
    c.fillStyle = CREAMW; c.fillRect(0, 0, SCR.w, SCR.h);
    // sidebar
    c.fillStyle = '#fffdf9'; c.fillRect(0, 0, 250, SCR.h); c.fillStyle = LINE; c.fillRect(250, 0, 1.5, SCR.h);
    c.fillStyle = ESP; c.font = font(700, 30, 'Playfair Display'); c.fillText("L'Apéretik", 34, 74);
    const nav = [['home', 'Accueil'], ['search', 'Recherche'], ['explore', 'Découvrir'], ['reels', 'Reels'], ['msg', 'Messages'], ['heart', 'Notifications'], ['plus', 'Créer']];
    nav.forEach(([n, l], i) => { icon(c, n, 34, 140 + i * 66, 28, ESP); c.fillStyle = ESP; c.font = font(500, 21); c.fillText(l, 84, 162 + i * 66); });
    c.save(); c.beginPath(); c.arc(48, 140 + 7 * 66 + 14, 15, 0, Math.PI * 2); c.clip(); c.fillStyle = '#f4ecdf'; c.fill(); c.drawImage(this.logo, 33, 140 + 7 * 66 - 1, 30, 30); c.restore();
    c.fillStyle = ESP; c.font = font(700, 21); c.fillText('Profil', 84, 162 + 7 * 66);
    // header
    const ax = 560, ay = 190;
    const grd = c.createLinearGradient(ax - 95, ay - 95, ax + 95, ay + 95); grd.addColorStop(0, '#e3c27a'); grd.addColorStop(1, '#a8784c');
    c.beginPath(); c.arc(ax, ay, 96, 0, Math.PI * 2); c.fillStyle = grd; c.fill();
    c.beginPath(); c.arc(ax, ay, 90, 0, Math.PI * 2); c.fillStyle = CREAMW; c.fill();
    c.beginPath(); c.arc(ax, ay, 85, 0, Math.PI * 2); c.fillStyle = '#f4ecdf'; c.fill();
    c.drawImage(this.logo, ax - 74, ay - 74, 148, 148);
    c.fillStyle = ESP; c.font = font(500, 30); c.fillText('laperetik', 720, 125);
    const fb = this.followBtn, fk = st.followed;
    rr(c, fb.x, fb.y, fb.w, fb.h, 10); c.fillStyle = fk > 0.5 ? '#efe7da' : GOLD; c.fill();
    c.fillStyle = fk > 0.5 ? ESP : '#fff'; c.font = font(700, 20); c.textAlign = 'center'; c.fillText(fk > 0.5 ? 'Suivi(e) ⌄' : 'Suivre', fb.x + fb.w / 2, fb.y + 29);
    if (st.followPress > 0) { c.globalAlpha = st.followPress * 0.25; rr(c, fb.x, fb.y, fb.w, fb.h, 10); c.fillStyle = '#000'; c.fill(); c.globalAlpha = 1; }
    rr(c, 1052, 92, 150, 44, 10); c.fillStyle = '#efe7da'; c.fill(); c.fillStyle = ESP; c.fillText('Contacter', 1127, 121);
    c.textAlign = 'left'; icon(c, 'more', 1222, 102, 26, ESP);
    const followers = 1248 + (fk > 0.5 ? 1 : 0);
    c.font = font(400, 22); c.fillStyle = ESP;
    const stat = (x, n, l) => { c.font = font(700, 22); c.fillText(n, x, 190); const w = c.measureText(n).width; c.font = font(400, 22); c.fillText(l, x + w + 7, 190); };
    stat(720, '36', 'publications'); stat(910, followers.toLocaleString('fr-FR').replace(/ /g, ' '), 'followers'); stat(1135, '182', 'suivi(e)s');
    c.font = font(700, 21); c.fillText("L'Apéretik · Box apéro & produits locaux", 720, 245);
    c.font = font(400, 20); c.fillStyle = ESP;
    c.fillText("Chassez le naturel, il revient à l'apéro", 720, 276);
    c.fillText('Fromages · charcuterie · bières & vins locaux', 720, 304);
    c.fillStyle = CAR; c.font = font(600, 20); c.fillText('Nouveau à Annecy · Allée de Rioz Busson', 720, 332);
    // highlights
    ['Box', 'Fromages', 'Charcut’', 'Bières', 'Vins'].forEach((l, i) => {
      const x = 560 + i * 140, y = 420;
      c.beginPath(); c.arc(x, y, 40, 0, Math.PI * 2); c.strokeStyle = '#d9cbb6'; c.lineWidth = 2; c.stroke();
      c.beginPath(); c.arc(x, y, 35, 0, Math.PI * 2); c.fillStyle = ['#f4ecdf', '#e9c97e', '#b35a4a', '#c98a3a', '#6e2a35'][i]; c.fill();
      c.fillStyle = ESP; c.font = font(600, 16); c.textAlign = 'center'; c.fillText(l, x, y + 64); c.textAlign = 'left';
    });
    // tabs
    c.fillStyle = LINE; c.fillRect(470, 515, 888, 1.5); c.fillStyle = ESP; c.fillRect(640, 514, 130, 2.5);
    c.font = font(700, 15); c.fillStyle = ESP; icon(c, 'grid', 650, 528, 15, ESP, false, 2.4); c.fillText('PUBLICATIONS', 672, 541);
    c.fillStyle = MUTED; c.fillText('REELS', 860, 541); c.fillText('IDENTIFIÉ(E)', 1010, 541);
    // grid
    for (let i = 0; i < 6; i++) {
      const r = this.tileRect(i);
      if (r.y > SCR.h) break;
      const t = this.tiles[i];
      c.save(); c.beginPath(); c.rect(r.x, r.y, r.w, r.h); c.clip();
      if (t) c.drawImage(t, r.x, r.y, r.w, r.h); else { c.fillStyle = '#eee'; c.fillRect(r.x, r.y, r.w, r.h); }
      if (i === 1 || i === 4) icon(c, 'reelSmall', r.x + r.w - 40, r.y + 12, 28, '#fff', false, 2.6);
      if (st.hover === i) { c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(r.x, r.y, r.w, r.h); }
      c.restore();
    }
  }
  // Reel opened full screen: transparent hole over the Reel render target + overlay icons
  reel(c, st) {
    c.clearRect(0, 0, SCR.w, SCR.h);
    const g = c.createLinearGradient(0, SCR.h - 260, 0, SCR.h); g.addColorStop(0, 'rgba(20,12,6,0)'); g.addColorStop(1, 'rgba(20,12,6,0.55)');
    c.fillStyle = g; c.fillRect(0, SCR.h - 260, SCR.w, 260);
    // right rail
    const hx = this.heart.x, hy = this.heart.y;
    const pop = st.likePop;
    const s = 46 * (1 + 0.45 * Math.sin(Math.min(1, pop * 1.4) * Math.PI) * (pop > 0 ? 1 : 0));
    c.save(); c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = 8;
    if (st.liked) icon(c, 'heart', hx - s / 2, hy - s / 2, s, '#e0303a', true); else icon(c, 'heart', hx - s / 2, hy - s / 2, s, '#fff', false, 2.2);
    c.restore();
    c.fillStyle = '#fff'; c.font = font(600, 18); c.textAlign = 'center';
    c.fillText(st.liked ? '2 418' : '2 417', hx, hy + 48);
    icon(c, 'comment', hx - 21, hy + 80, 42, '#fff', false, 2.2); c.fillText('186', hx, hy + 150);
    icon(c, 'share', hx - 21, hy + 182, 42, '#fff', false, 2.2); c.fillText('97', hx, hy + 250);
    icon(c, 'save', hx - 20, hy + 282, 40, '#fff', false, 2.2);
    c.textAlign = 'left';
    // golden particles burst from the heart
    if (pop > 0 && pop < 1) {
      const rnd = seeded(5);
      for (let i = 0; i < 26; i++) {
        const a = rnd() * Math.PI * 2, sp = 60 + rnd() * 120, r = sp * easeOut(pop);
        c.globalAlpha = (1 - pop) * 0.95; c.fillStyle = i % 3 ? '#e8c477' : '#fff1c9';
        c.beginPath(); c.arc(hx + Math.cos(a) * r, hy + Math.sin(a) * r, 3 + rnd() * 4, 0, Math.PI * 2); c.fill();
      }
      c.globalAlpha = 1;
    }
    // author line
    c.save(); c.beginPath(); c.arc(300, SCR.h - 150, 26, 0, Math.PI * 2); c.clip(); c.fillStyle = '#f4ecdf'; c.fill(); c.drawImage(this.logo, 276, SCR.h - 174, 48, 48); c.restore();
    c.fillStyle = '#fff'; c.font = font(700, 22); c.fillText('laperetik', 340, SCR.h - 143);
    rr(c, 460, SCR.h - 170, 92, 38, 9); c.strokeStyle = '#fff'; c.lineWidth = 1.8; c.stroke(); c.font = font(600, 18); c.fillText('Suivre', 479, SCR.h - 145);
    c.font = font(400, 20); c.fillText('La Box Apéro · produits locaux, circuit court', 276, SCR.h - 96);
    // close button
    icon(c, 'x', SCR.w - 70, 40, 28, '#fff', false, 2.4);
  }
  draw(st) {
    const c = this.c;
    c.save();
    if (st.mode === 'profile') this.profile(c, st);
    else if (st.mode === 'reel') this.reel(c, st);
    else if (st.mode === 'opening') {
      // profile behind (dimmed), a growing transparent hole where the Reel expands
      this.profile(c, st);
      c.fillStyle = `rgba(20,12,6,${0.55 * st.k})`; c.fillRect(0, 0, SCR.w, SCR.h);
      const r = st.rect;
      c.save(); c.globalCompositeOperation = 'destination-out'; c.fillRect(r.x, r.y, r.w, r.h); c.restore();
    }
    if (st.cursor) cursor(c, st.cursor.x, st.cursor.y, 1.15, st.press || 0);
    c.restore();
    this.tex.needsUpdate = true;
  }
}

// giant-type "website" backdrop for the Reel (cream, espresso type)
export function reelBackdrop(logoImg) {
  const cv = canvas(2048, 1280), c = cv.getContext('2d');
  const g = c.createRadialGradient(1024, 600, 100, 1024, 640, 1300); g.addColorStop(0, '#f8f1e6'); g.addColorStop(1, '#e8d6bb');
  c.fillStyle = g; c.fillRect(0, 0, 2048, 1280);
  c.fillStyle = '#3a2a1f'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = "700 430px Oswald"; c.save(); c.translate(1024, 640); c.scale(1, 1.18); c.fillText("L'APÉRETIK", 0, 0); c.restore();
  c.font = '600 30px Oswald'; c.textAlign = 'left'; c.fillStyle = '#3a2a1f';
  c.drawImage(logoImg, 70, 46, 86, 86);
  c.fillText('BOX APÉRO', 1270, 96); c.fillText('PRODUITS', 1470, 96); c.fillText('BOUTIQUE', 1660, 96);
  c.fillStyle = '#c9a15b'; c.beginPath(); c.roundRect(1850, 66, 140, 50, 25); c.fill(); c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText('COMMANDER', 1920, 97);
  c.textAlign = 'left'; c.fillStyle = '#a8784c'; c.font = '600 34px Oswald'; c.fillText('LA BOX APÉRO', 90, 1080);
  c.fillStyle = '#3a2a1f'; c.font = '400 26px Inter'; c.fillText('Fromages, charcuterie et pain grillé de nos', 90, 1130); c.fillText('producteurs locaux, réunis dans une boîte en bois.', 90, 1166);
  c.textAlign = 'right'; c.font = '600 26px Oswald'; c.fillStyle = '#a8784c'; c.fillText('100 % LOCAL · CIRCUIT COURT', 1960, 1150);
  const t = canvasTex(cv); return t;
}
