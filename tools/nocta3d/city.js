// Annecy at night: sky, mountains, the lake, the lakeside road with streetlights and plane trees,
// the old town, the apartment building and the NOCTA club exterior with its queue.
// World: lake to the north (-Z), road along +X at z = -45, town to the south (+Z).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { V, clamp, lerp, smooth, seeded, canvasTex, mat, glowTex } from './lib.js';

export const ROAD_Z = -44.5;          // centre of the eastbound lane
export const CLUB = { x: 410, front: -28, back: 14, w: 50, h: 13 };
export const APT = { x: 0, z: 70, floor: 18 };   // apartment: window faces -Z at z = APT.z - 3.2

function rnd01(r, a, b) { return a + (b - a) * r(); }

// ------------------------------------------------------------------ sky & environment
export function skyTexture() {
  return canvasTex(1024, 1024, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0.0, '#03050f');
    gr.addColorStop(0.32, '#071034');
    gr.addColorStop(0.47, '#14215a');
    gr.addColorStop(0.5, '#2a2f6e');
    gr.addColorStop(0.53, '#14183a');
    gr.addColorStop(1.0, '#04050c');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const r = seeded(91);
    for (let i = 0; i < 1400; i++) {
      const y = Math.pow(r(), 1.6) * h * 0.46, x = r() * w, s = r();
      g.fillStyle = `rgba(255,255,255,${0.25 + 0.75 * s * s})`;
      g.fillRect(x, y, s > 0.97 ? 2 : 1, s > 0.97 ? 2 : 1);
    }
  });
}

export function buildSky(scene) {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(6000, 48, 32), new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false, toneMapped: true }));
  sky.renderOrder = -10;
  scene.add(sky);
  // moon + halo, above the mountains to the north-east
  const moonDir = V(0.45, 0.32, -1).normalize();
  const moon = new THREE.Mesh(new THREE.CircleGeometry(60, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff6e0).multiplyScalar(2.2), fog: false, toneMapped: false }));
  moon.position.copy(moonDir.clone().multiplyScalar(5500)); moon.lookAt(0, 0, 0); scene.add(moon);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(0x8fa6ff).multiplyScalar(0.7), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
  halo.scale.set(1400, 1400, 1); halo.position.copy(moon.position.clone().multiplyScalar(0.98)); scene.add(halo);
  return { sky, moonDir };
}

export function nightEnvironment(renderer) {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide })));
  const r = seeded(5);
  for (let i = 0; i < 60; i++) {   // warm city lights near the horizon
    const a = r() * Math.PI * 2, y = -2 + r() * 6;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.6 + r() * 1.4, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(r() < 0.75 ? 0xffa850 : 0x9a6bff).multiplyScalar(4 + r() * 6) }));
    m.position.set(Math.cos(a) * 45, y, Math.sin(a) * 45); s.add(m);
  }
  const top = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x1a2450).multiplyScalar(1.5), side: THREE.DoubleSide }));
  top.position.y = 30; top.rotation.x = Math.PI / 2; s.add(top);
  const pm = new THREE.PMREMGenerator(renderer);
  return pm.fromScene(s, 0.02).texture;
}

// ------------------------------------------------------------------ mountains
function ridge(x, seed, scale) {
  let h = 0, a = 1, f = 1;
  for (let o = 0; o < 5; o++) {
    h += a * (1 - Math.abs(Math.sin(x * f * scale + seed * 1.7 + o * 2.3)));
    a *= 0.5; f *= 2.1;
  }
  return h / 1.94;
}

export function buildMountains(scene) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0x0d1428, roughness: 0.95, vertexColors: true });
  const ranges = [
    { cx: 0, cz: -3600, len: 9000, ang: 0, h: 1500, seed: 1 },
    { cx: -3200, cz: -1600, len: 4200, ang: Math.PI / 2.3, h: 1300, seed: 2 },
    { cx: 3300, cz: -1700, len: 4200, ang: -Math.PI / 2.4, h: 1400, seed: 3 },
    { cx: 1200, cz: 2800, len: 7000, ang: Math.PI, h: 900, seed: 4 },
  ];
  for (const R of ranges) {
    const geo = new THREE.PlaneGeometry(R.len, 1, 260, 24);
    const p = geo.attributes.position;
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), v = (p.getY(i) + 0.5);       // v: 0 bottom .. 1 top
      const peak = R.h * (0.35 + 0.65 * ridge(x / R.len, R.seed, 9));
      const y = v * peak, depth = (1 - v) * 650;
      p.setXYZ(i, x, y - 30, depth);
      const snow = smooth((v - 0.82) / 0.18) * smooth((peak - R.h * 0.75) / (R.h * 0.2));
      const c = new THREE.Color(0x0b1226).lerp(new THREE.Color(0x3a4a78), snow * 0.8).lerp(new THREE.Color(0x111a36), 0.3 * (1 - v));
      col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(R.cx, 0, R.cz); mesh.rotation.y = R.ang;
    g.add(mesh);
  }
  // a few village lights on the slopes
  const lr = seeded(77);
  const pts = [];
  for (let i = 0; i < 160; i++) {
    const a = lr() * Math.PI * 2;
    const d = 1700 + lr() * 1500;
    pts.push(Math.cos(a) * d * 1.3, 20 + lr() * 260, -1500 + Math.sin(a) * d * 0.8);
  }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.add(new THREE.Points(pg, new THREE.PointsMaterial({ color: new THREE.Color(0xffb76a).multiplyScalar(2.5), size: 3.5, sizeAttenuation: false, toneMapped: false })));
  scene.add(g);
  return g;
}

// ------------------------------------------------------------------ lake, road, lights, trees
function asphaltTex() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#1b1c20'; g.fillRect(0, 0, w, h);
    const r = seeded(3);
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.04 + r() * 0.06})`; g.fillRect(r() * w, r() * h, 2, 2); }
    // lane marking (dashed) along u, edge lines
    g.fillStyle = 'rgba(235,235,225,0.85)';
    for (let x = 0; x < w; x += 128) g.fillRect(x, h / 2 - 3, 70, 6);
    g.fillRect(0, 10, w, 5); g.fillRect(0, h - 15, w, 5);
  }, { repeat: [400, 1] });
}

export function buildLakefront(scene) {
  const g = new THREE.Group();
  // lake
  const lake = new THREE.Mesh(new THREE.PlaneGeometry(12000, 7000), new THREE.MeshStandardMaterial({ color: 0x050a16, roughness: 0.08, metalness: 0.9 }));
  lake.rotation.x = -Math.PI / 2; lake.position.set(0, -0.6, -3560); g.add(lake);
  // promenade grass and quay
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(2600, 11), mat.std(0x0e1a12, 0.95));
  grass.rotation.x = -Math.PI / 2; grass.position.set(0, 0.01, -55.5); g.add(grass);
  const quay = new THREE.Mesh(new THREE.BoxGeometry(2600, 1.2, 1.2), mat.std(0x3a3a40, 0.8));
  quay.position.set(0, -0.2, -61.2); g.add(quay);
  // road + sidewalk
  const road = new THREE.Mesh(new THREE.PlaneGeometry(2600, 10), new THREE.MeshStandardMaterial({ map: asphaltTex(), roughness: 0.32, metalness: 0.35 }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0.02, -45); g.add(road);
  const walk = new THREE.Mesh(new THREE.PlaneGeometry(2600, 6), mat.std(0x4a4a50, 0.7));
  walk.rotation.x = -Math.PI / 2; walk.position.set(0, 0.06, -37); g.add(walk);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2600, 1200), mat.std(0x1a1a1e, 0.9));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0.0, 560); g.add(ground);

  // streetlights (lake side) + light pools + reflections on the water
  const lights = [];
  const poleG = new THREE.CylinderGeometry(0.07, 0.1, 7.5, 8); poleG.translate(0, 3.75, 0);
  const armG = new THREE.BoxGeometry(0.08, 0.08, 2.0); armG.translate(0, 7.45, 0.95);
  const headG = new THREE.BoxGeometry(0.35, 0.16, 0.7); headG.translate(0, 7.38, 1.85);
  const bulbG = new THREE.BoxGeometry(0.28, 0.04, 0.6); bulbG.translate(0, 7.29, 1.85);
  const N = 90, x0 = -1200, step = 26;
  const poles = new THREE.InstancedMesh(mergeGeometries([poleG, armG, headG]), mat.std(0x2a2d33, 0.5, 0.6), N);
  const bulbs = new THREE.InstancedMesh(bulbG, mat.emit(0xffb35a, 6), N);
  const poolTex = glowTex();
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: poolTex, color: new THREE.Color(0xff9a40).multiplyScalar(0.55), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), N);
  const d = new THREE.Object3D();
  for (let i = 0; i < N; i++) {
    const x = x0 + i * step;
    d.position.set(x, 0, -51); d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1); d.updateMatrix();
    poles.setMatrixAt(i, d.matrix); bulbs.setMatrixAt(i, d.matrix);
    d.position.set(x, 0.07, -49.4); d.rotation.set(-Math.PI / 2, 0, 0); d.scale.set(16, 13, 1); d.updateMatrix();
    pools.setMatrixAt(i, d.matrix);
    lights.push(V(x, 7.3, -49.2));
  }
  g.add(poles, bulbs, pools);
  const poles2 = new THREE.InstancedMesh(poles.geometry, poles.material, N), bulbs2 = new THREE.InstancedMesh(bulbG, bulbs.material, N), pools2 = new THREE.InstancedMesh(pools.geometry, pools.material, N);
  for (let i = 0; i < N; i++) {
    const x = x0 + 13 + i * step;
    d.position.set(x, 0, -38.6); d.rotation.set(0, Math.PI, 0); d.scale.set(1, 1, 1); d.updateMatrix();
    poles2.setMatrixAt(i, d.matrix); bulbs2.setMatrixAt(i, d.matrix);
    d.position.set(x, 0.075, -40.4); d.rotation.set(-Math.PI / 2, 0, 0); d.scale.set(14, 11, 1); d.updateMatrix();
    pools2.setMatrixAt(i, d.matrix);
  }
  g.add(poles2, bulbs2, pools2);
  // water reflection streaks (billboards around Y, updated per frame)
  const streakTex = canvasTex(64, 256, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.15, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    const gx = c.createLinearGradient(0, 0, w, 0);
    gx.addColorStop(0, 'rgba(0,0,0,1)'); gx.addColorStop(0.5, 'rgba(0,0,0,0)'); gx.addColorStop(1, 'rgba(0,0,0,1)');
    c.globalCompositeOperation = 'destination-out'; c.fillStyle = gx; c.fillRect(0, 0, w, h);
    const r = seeded(9); c.globalCompositeOperation = 'destination-out';
    for (let y = 0; y < h; y += 3) { c.fillStyle = `rgba(0,0,0,${r() * 0.7})`; c.fillRect(0, y, w, 2); }
  });
  const streaks = [];
  const sm = new THREE.MeshBasicMaterial({ map: streakTex, color: new THREE.Color(0xffa04a).multiplyScalar(1.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  for (let i = 0; i < N; i += 1) {
    const st = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 40), sm);
    st.position.set(lights[i].x, 0.05, -82); st.userData.base = st.position.clone();
    g.add(st); streaks.push(st);
  }
  // plane trees between road and lake
  const tr = seeded(12);
  const trunkG = new THREE.CylinderGeometry(0.18, 0.28, 4, 7); trunkG.translate(0, 2, 0);
  const crownG = new THREE.IcosahedronGeometry(2.6, 1); crownG.translate(0, 5.6, 0);
  const NT = 100;
  const trunks = new THREE.InstancedMesh(trunkG, mat.std(0x2a2420, 0.9), NT);
  const crowns = new THREE.InstancedMesh(crownG, mat.std(0x16301c, 0.9), NT);
  for (let i = 0; i < NT; i++) {
    d.position.set(x0 + 13 + i * 26 + (tr() - 0.5) * 4, 0, -56 + (tr() - 0.5) * 3); d.rotation.set(0, tr() * 6, 0);
    const s = 0.8 + tr() * 0.5; d.scale.set(s, s, s); d.updateMatrix();
    trunks.setMatrixAt(i, d.matrix); crowns.setMatrixAt(i, d.matrix);
    crowns.setColorAt(i, new THREE.Color(0x1b3a20).multiplyScalar(0.7 + tr() * 0.6));
  }
  g.add(trunks, crowns);
  scene.add(g);
  return { group: g, lights, streaks };
}

// update reflection streaks to face the camera (vertical in screen space)
export function updateStreaks(streaks, cam) {
  for (const s of streaks) {
    const b = s.userData.base;
    const dx = cam.position.x - b.x, dz = cam.position.z - b.z;
    const ang = Math.atan2(dx, dz);
    s.rotation.set(-Math.PI / 2, 0, -ang + Math.PI);
    const dist = Math.hypot(dx, dz);
    s.scale.set(1, clamp(dist / 60, 0.6, 3), 1);
  }
}

// ------------------------------------------------------------------ town
function facadeTextures(seed) {
  const r = seeded(seed);
  const cols = 16, rows = 16;
  const wall = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#d8cfc0'; g.fillRect(0, 0, w, h);
    const cw = w / cols, rh = h / rows;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      g.fillStyle = '#2a2622'; g.fillRect(i * cw + cw * 0.28, j * rh + rh * 0.2, cw * 0.44, rh * 0.55);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(i * cw + cw * 0.22, j * rh + rh * 0.75, cw * 0.56, rh * 0.06);
      if (r() < 0.5) { g.fillStyle = '#4a5a52'; g.fillRect(i * cw + cw * 0.16, j * rh + rh * 0.2, cw * 0.1, rh * 0.55); g.fillRect(i * cw + cw * 0.74, j * rh + rh * 0.2, cw * 0.1, rh * 0.55); }
    }
  }, { repeat: [1, 1] });
  const lit = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const cw = w / cols, rh = h / rows;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      if (r() < 0.38) {
        const warm = r();
        g.fillStyle = warm < 0.7 ? `rgb(255,${170 + r() * 50},${90 + r() * 50})` : (warm < 0.9 ? 'rgb(255,235,200)' : 'rgb(150,170,255)');
        g.globalAlpha = 0.55 + r() * 0.45;
        g.fillRect(i * cw + cw * 0.28, j * rh + rh * 0.2, cw * 0.44, rh * 0.55);
        g.globalAlpha = 1;
      }
    }
  });
  wall.wrapS = wall.wrapT = lit.wrapS = lit.wrapT = THREE.RepeatWrapping;
  return { wall, lit };
}

function boxUV(geo, w, h, d, u0, v0, winW = 3.2, winH = 3.1) {
  // per-face world-unit UVs so windows keep their size
  const uv = geo.attributes.uv;
  const sizes = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [fw, fh] = sizes[f];
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, u0 + uv.getX(i) * fw / winW / 16, v0 + uv.getY(i) * fh / winH / 16);
    }
  }
}

export function buildTown(scene) {
  const g = new THREE.Group();
  const r = seeded(2024);
  const tex = facadeTextures(7);
  const pal = [0xd9b48a, 0xe2c79a, 0xc98f6b, 0xe8d8b8, 0xb9a48c, 0xd6a07a, 0xcfc2a8, 0xa9b4b8];
  const bodies = [], roofs = [], flat = [];
  const place = (x, z, w, d, h, roofType, color) => {
    const b = new THREE.BoxGeometry(w, h, d);
    boxUV(b, w, h, d, r(), r());
    b.translate(x, h / 2, z);
    const c = new THREE.Color(color).multiplyScalar(0.55 + r() * 0.25);
    const col = new Float32Array(b.attributes.position.count * 3);
    for (let i = 0; i < col.length; i += 3) col.set([c.r, c.g, c.b], i);
    b.setAttribute('color', new THREE.BufferAttribute(col, 3));
    bodies.push(b);
    if (roofType === 'gable') {
      const rh = Math.min(w, d) * 0.42;
      const shape = new THREE.Shape(); shape.moveTo(-w / 2 - 0.4, 0); shape.lineTo(w / 2 + 0.4, 0); shape.lineTo(0, rh); shape.closePath();
      const rg = new THREE.ExtrudeGeometry(shape, { depth: d + 0.8, bevelEnabled: false });
      rg.translate(0, 0, -(d + 0.8) / 2); rg.translate(x, h, z);
      const rc = new THREE.Color(r() < 0.6 ? 0x8a4a34 : 0x3c4048).multiplyScalar(0.5 + r() * 0.3);
      const rcol = new Float32Array(rg.attributes.position.count * 3);
      for (let i = 0; i < rcol.length; i += 3) rcol.set([rc.r, rc.g, rc.b], i);
      rg.setAttribute('color', new THREE.BufferAttribute(rcol, 3));
      rg.deleteAttribute('uv');
      roofs.push(rg);
    } else {
      const fg = new THREE.BoxGeometry(w + 0.3, 0.5, d + 0.3); fg.translate(x, h + 0.25, z); fg.deleteAttribute('uv');
      const fc = new THREE.Color(0x2a2a30); const fcol = new Float32Array(fg.attributes.position.count * 3);
      for (let i = 0; i < fcol.length; i += 3) fcol.set([fc.r, fc.g, fc.b], i);
      fg.setAttribute('color', new THREE.BufferAttribute(fcol, 3));
      flat.push(fg);
    }
  };
  // old town blocks south of the road
  for (let bx = -620; bx < 640; bx += 34) {
    for (let bz = -30; bz < 520; bz += 30) {
      if (Math.abs(bx - 0) < 40 && Math.abs(bz - 70) < 30) continue;            // apartment building plot
      if (Math.abs(bx - CLUB.x) < 45 && bz < 40) continue;
      const nx = 2 + Math.floor(r() * 2);
      for (let k = 0; k < nx; k++) {
        const w = 9 + r() * 5, d = 10 + r() * 8;
        const x = bx + k * 11 + (r() - 0.5) * 2, z = bz + 6 + (r() - 0.5) * 4;
        if (r() < 0.12) continue;
        const far = clamp((bz - 50) / 400);
        const h = 9 + r() * 10 + far * 4 + (bz > 200 ? r() * 8 : 0);
        place(x, z, w, d, h, r() < 0.78 ? 'gable' : 'flat', pal[Math.floor(r() * pal.length)]);
      }
    }
  }
  // church with spire
  const ch = new THREE.BoxGeometry(8, 30, 8); boxUV(ch, 8, 30, 8, 0.1, 0.1, 6, 8); ch.translate(-140, 15, 40);
  const cc = new THREE.Color(0xc8b89a).multiplyScalar(0.7); const ccol = new Float32Array(ch.attributes.position.count * 3);
  for (let i = 0; i < ccol.length; i += 3) ccol.set([cc.r, cc.g, cc.b], i);
  ch.setAttribute('color', new THREE.BufferAttribute(ccol, 3)); bodies.push(ch);
  let sp = new THREE.ConeGeometry(5.8, 16, 4); sp.rotateY(Math.PI / 4); sp.translate(-140, 38, 40); sp.deleteAttribute('uv'); sp = sp.toNonIndexed(); sp.deleteAttribute('normal'); sp.computeVertexNormals();
  const scol = new Float32Array(sp.attributes.position.count * 3); const sc = new THREE.Color(0x30343c);
  for (let i = 0; i < scol.length; i += 3) scol.set([sc.r, sc.g, sc.b], i);
  sp.setAttribute('color', new THREE.BufferAttribute(scol, 3)); roofs.push(sp);

  const bodyMat = new THREE.MeshStandardMaterial({ map: tex.wall, emissiveMap: tex.lit, emissive: new THREE.Color(0xffffff), emissiveIntensity: 1.6, vertexColors: true, roughness: 0.85 });
  const town = new THREE.Mesh(mergeGeometries(bodies), bodyMat);
  const roofMesh = new THREE.Mesh(mergeGeometries(roofs), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }));
  const flatMesh = new THREE.Mesh(mergeGeometries(flat), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
  town.receiveShadow = roofMesh.receiveShadow = true;
  g.add(town, roofMesh, flatMesh);
  // spire floodlight glow
  const sg = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(0xffd29a).multiplyScalar(0.5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  sg.position.set(-140, 30, 44); sg.scale.set(40, 60, 1); g.add(sg);
  scene.add(g);
  return g;
}

// ------------------------------------------------------------------ apartment building exterior
export function buildApartmentBuilding(scene) {
  const g = new THREE.Group();
  const wz = APT.z - 3.2;                     // window plane
  const m = mat.std(0x2c2e34, 0.7, 0.2);
  const add = (w, h, d, x, y, z, mm = m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mm); b.position.set(x, y, z); g.add(b); return b; };
  // slabs and walls around the apartment opening (opening: x in [-4.5, 4.5], y in [APT.floor, APT.floor+3.1])
  const F = APT.floor;
  add(30, F, 16, 0, F / 2, APT.z + 4.5);                       // below
  add(30, 9, 16, 0, F + 3.1 + 4.5, APT.z + 4.5);               // above
  add(10.5, 3.1, 16, -9.75, F + 1.55, APT.z + 4.5);            // left
  add(10.5, 3.1, 16, 9.75, F + 1.55, APT.z + 4.5);             // right
  // other lit windows on the facade
  const lit = mat.emit(0xffc58a, 1.4), dark = mat.std(0x101218, 0.2, 0.6);
  const rr = seeded(31);
  for (let fl = 0; fl < 10; fl++) for (let i = 0; i < 6; i++) {
    const x = -12.5 + i * 5, y = 1.5 + fl * 3.1;
    if (Math.abs(y - (F + 1.5)) < 1.6 && Math.abs(x) < 6) continue;
    const win = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.2), rr() < 0.45 ? lit : dark);
    win.position.set(x, y, APT.z - 3.52); win.rotation.y = Math.PI; g.add(win);
  }
  // balconies rails
  scene.add(g);
  return g;
}

// ------------------------------------------------------------------ NOCTA club exterior
export function buildClubExterior(scene, font) {
  const g = new THREE.Group();
  const { x, front, back, w, h } = CLUB;
  const black = mat.std(0x0b0b10, 0.55, 0.3);
  const add = (bw, bh, bd, bx, by, bz, mm = black) => { const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mm); b.position.set(bx, by, bz); g.add(b); return b; };
  // facade with the door opening (3.4 x 3.4 at x)
  const d = back - front;
  add(w / 2 - 1.7, h, 0.6, x - w / 4 - 0.85, h / 2, front);
  add(w / 2 - 1.7, h, 0.6, x + w / 4 + 0.85, h / 2, front);
  add(3.4, h - 3.4, 0.6, x, 3.4 + (h - 3.4) / 2, front);
  add(0.6, h, d, x - w / 2, h / 2, front + d / 2);
  add(0.6, h, d, x + w / 2, h / 2, front + d / 2);
  add(w, h, 0.6, x, h / 2, back);
  add(w, 0.6, d, x, h, front + d / 2);
  // neon outlines (blue / violet / magenta)
  const neon = (col, k, pts, r = 0.07) => {
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, pts.length * 4), r, 8, false), mat.emit(col, k));
    g.add(tube); return tube;
  };
  const fz = front - 0.35;
  neon(0x3a6bff, 4, [V(x - w / 2, 0.4, fz), V(x - w / 2, h - 0.3, fz), V(x + w / 2, h - 0.3, fz), V(x + w / 2, 0.4, fz)]);
  neon(0xa040ff, 4, [V(x - w / 2 + 1.2, 1.2, fz), V(x - w / 2 + 1.2, h - 1.4, fz), V(x - 6, h - 1.4, fz)]);
  neon(0xa040ff, 4, [V(x + w / 2 - 1.2, 1.2, fz), V(x + w / 2 - 1.2, h - 1.4, fz), V(x + 6, h - 1.4, fz)]);
  neon(0xff3fd0, 4, [V(x - 2.2, 0.2, fz), V(x - 2.2, 3.9, fz), V(x + 2.2, 3.9, fz), V(x + 2.2, 0.2, fz)], 0.06);
  // vertical light fins
  for (let i = 0; i < 8; i++) {
    const fx = x - w / 2 + 4 + i * ((w - 8) / 7);
    if (Math.abs(fx - x) < 7) continue;
    neon(i % 2 ? 0x3a6bff : 0xff3fd0, 3, [V(fx, 1.0, fz), V(fx, h - 2.6, fz)], 0.05);
  }
  // NOCTA sign
  let sign = null;
  if (font) {
    const tg = new (font.TextGeometry)('NOCTA', { font: font.font, size: 3.2, height: 0.25, curveSegments: 10, bevelEnabled: false });
    tg.computeBoundingBox(); const bb = tg.boundingBox;
    tg.translate(-(bb.max.x + bb.min.x) / 2, 0, 0);
    sign = new THREE.Mesh(tg, mat.emit(0xff5ae0, 5));
    sign.position.set(x, 6.4, fz - 0.4); sign.rotation.y = Math.PI;
    g.add(sign);
    const back2 = new THREE.Mesh(tg, mat.emit(0xa040ff, 1.5));
    back2.position.copy(sign.position).add(V(0, 0, 0.12)); back2.rotation.y = Math.PI; back2.scale.set(1.02, 1.04, 1); g.add(back2);
  }
  // forecourt + coloured light spill
  const court = new THREE.Mesh(new THREE.PlaneGeometry(w + 20, 10), new THREE.MeshStandardMaterial({ color: 0x15151c, roughness: 0.3, metalness: 0.4 }));
  court.rotation.x = -Math.PI / 2; court.position.set(x, 0.08, front - 5); g.add(court);
  for (const [cx, col] of [[x - 12, 0x3a6bff], [x, 0xff3fd0], [x + 12, 0xa040ff]]) {
    const spill = new THREE.Mesh(new THREE.PlaneGeometry(22, 14), new THREE.MeshBasicMaterial({ map: glowTex(), color: new THREE.Color(col).multiplyScalar(0.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    spill.rotation.x = -Math.PI / 2; spill.position.set(cx, 0.1, front - 4); g.add(spill);
  }
  // velvet ropes along the queue (to the left of the door, seen from the road)
  const gold = mat.std(0xe0ae52, 0.25, 1), velvet = mat.std(0x7a0f22, 0.6);
  const qz = front - 2.6;
  const posts = [];
  for (let i = 0; i < 9; i++) {
    const px = x - 3.2 - i * 2.4;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 1.0, 10), gold); post.position.set(px, 0.5, qz); g.add(post);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), gold); ball.position.set(px, 1.02, qz); g.add(ball);
    posts.push(V(px, 0.92, qz));
  }
  for (let i = 0; i < posts.length - 1; i++) {
    const a = posts[i], b = posts[i + 1];
    const mid = a.clone().lerp(b, 0.5).add(V(0, -0.22, 0));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 12, 0.025, 6), velvet));
  }
  // haze lights on the facade
  const lights = [];
  for (const [lx, col] of [[x - 8, 0x4a6bff], [x + 8, 0xff3fd0], [x, 0xa040ff]]) {
    const l = new THREE.PointLight(col, 60, 30, 2); l.position.set(lx, 4, front - 3); g.add(l); lights.push(l);
  }
  scene.add(g);
  return { group: g, sign, lights, qz };
}
