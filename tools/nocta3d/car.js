// Black Volkswagen Golf 8 GTI (stylized): body built from extruded side profiles, glossy clear-coat
// paint, LED light bar with the red GTI line, X fog lights, red calipers, and a full cockpit for the POV.
// Car faces +Z, origin on the ground between the wheels, driver on the left (+X).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { V, canvasTex, mat, glowTex, lathe } from './lib.js';

export const CAR = { len: 4.29, width: 1.79, height: 1.46, wheelR: 0.33, wheelBase: 2.63, track: 1.55 };

function profileShape() {
  // side profile in (z forward, y up); z from -2.14 (rear) to 2.15 (front)
  const s = new THREE.Shape();
  const fr = 1.33, rr = -1.30, ar = 0.40;
  s.moveTo(-2.10, 0.30);
  s.lineTo(rr - ar - 0.04, 0.30);
  s.absarc(rr, 0.33, ar, Math.PI, 0, true);
  s.lineTo(fr - ar, 0.30);
  s.absarc(fr, 0.33, ar, Math.PI, 0, true);
  s.lineTo(2.08, 0.30);
  s.quadraticCurveTo(2.17, 0.32, 2.16, 0.52);
  s.quadraticCurveTo(2.15, 0.78, 2.02, 0.84);      // nose
  s.quadraticCurveTo(1.55, 0.95, 0.95, 1.0);        // hood
  s.lineTo(0.9, 0.42);                              // firewall (hollow cabin)
  s.lineTo(-1.62, 0.42);                            // cabin floor
  s.lineTo(-1.66, 1.0);                             // behind the rear seats
  s.lineTo(-1.98, 1.0);
  s.quadraticCurveTo(-2.14, 0.98, -2.15, 0.78);     // tail
  s.quadraticCurveTo(-2.16, 0.40, -2.10, 0.30);
  return s;
}

function greenhouseShape() {
  const s = new THREE.Shape();
  s.moveTo(0.95, 0.99);
  s.quadraticCurveTo(0.35, 1.32, 0.0, 1.43);        // windshield up to the roof
  s.lineTo(-1.2, 1.44);
  s.quadraticCurveTo(-1.72, 1.42, -1.98, 1.02);     // roof spoiler and rear glass
  s.lineTo(0.95, 0.99);
  return s;
}

function extrudeCentered(shape, width, bevel) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: width - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 5, curveSegments: 24 });
  g.translate(0, 0, -(width - 2 * bevel) / 2);
  g.rotateY(-Math.PI / 2);        // shape x (length) -> world z, extrusion -> world x
  g.computeVertexNormals();
  return g;
}

export function logoTex() {
  return canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#e8eaee'; g.lineWidth = 9; g.beginPath(); g.arc(64, 64, 54, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 8; g.lineJoin = 'miter';
    g.beginPath(); g.moveTo(36, 26); g.lineTo(64, 74); g.lineTo(92, 26); g.stroke();
    g.beginPath(); g.moveTo(18, 52); g.lineTo(40, 104); g.lineTo(64, 66); g.lineTo(88, 104); g.lineTo(110, 52); g.stroke();
  });
}

function wheel(paint) {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(lathe([[0.235, -0.115], [0.29, -0.115], [0.325, -0.1], [0.335, 0], [0.325, 0.1], [0.29, 0.115], [0.235, 0.115]], 40), mat.std(0x101012, 0.85));
  tire.rotation.z = Math.PI / 2; g.add(tire);
  const rimM = mat.phys(0x1a1b1f, { metalness: 0.9, roughness: 0.3, clearcoat: 1 });
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.2, 40, 1, true), rimM);
  rim.rotation.z = Math.PI / 2; g.add(rim);
  const face = new THREE.Group(); g.add(face);
  for (let i = 0; i < 5; i++) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.05), rimM);
    sp.position.set(0.09, 0, 0); sp.rotation.x = (i / 5) * Math.PI * 2; sp.translateY(0.11); face.add(sp);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 16), rimM); hub.rotation.z = Math.PI / 2; hub.position.x = 0.1; face.add(hub);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.03, 30), mat.std(0x55585e, 0.4, 0.9)); disc.rotation.z = Math.PI / 2; disc.position.x = 0.03; g.add(disc);
  const cal = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.12, 0.14, 2, 0.02), mat.std(0xc8141e, 0.35, 0.2));
  cal.position.set(0.06, 0.12, -0.08); g.add(cal);
  g.userData.spin = face;
  return g;
}

export class Golf {
  constructor() {
    this.root = new THREE.Group();
    this.body = new THREE.Group(); this.root.add(this.body);
    const paint = mat.phys(0x08080b, { metalness: 0.6, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 2.4 });
    this.paint = paint;
    const lower = new THREE.Mesh(extrudeCentered(profileShape(), CAR.width, 0.11), paint);
    this.body.add(lower);
    const glass = mat.phys(0x050608, { metalness: 0.1, roughness: 0.04, clearcoat: 1, transparent: true, opacity: 0.86, envMapIntensity: 1.6 });
    this.glass = glass;
    const gh = new THREE.Mesh(extrudeCentered(greenhouseShape(), CAR.width - 0.3, 0.14), glass);
    this.body.add(gh);
    this.greenhouse = gh;
    for (const sx of [1, -1]) {   // doors close the hollow cabin from the outside
      const door = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.62, 2.6, 3, 0.025), paint);
      door.position.set(sx * 0.865, 0.71, -0.35); this.body.add(door);
      const handle = new THREE.Mesh(new RoundedBoxGeometry(0.02, 0.025, 0.16, 2, 0.008), mat.std(0x1a1a1e, 0.4, 0.6));
      handle.position.set(sx * 0.9, 0.9, sx > 0 ? 0.2 : 0.2); this.body.add(handle);
      const handle2 = handle.clone(); handle2.position.z = -1.0; this.body.add(handle2);
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.55, 0.004), mat.std(0x000000, 0.9)); seam.position.set(sx * 0.897, 0.7, -0.55); this.body.add(seam);
    }
    const roof = new THREE.Mesh(new RoundedBoxGeometry(1.42, 0.05, 1.5, 3, 0.02), paint);
    roof.position.set(0, 1.43, -0.55); this.body.add(roof);
    // black trim, sills, splitter, diffuser
    const trim = mat.std(0x0c0c0e, 0.6);
    const sill = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.08, 1.9, 2, 0.02), trim);
    for (const sx of [1, -1]) { const s2 = sill.clone(); s2.position.set(sx * 0.9, 0.33, 0.02); this.body.add(s2); }
    const splitter = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.04, 0.2, 2, 0.015), trim); splitter.position.set(0, 0.3, 2.08); this.body.add(splitter);
    // mirrors
    for (const sx of [1, -1]) {
      const mir = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.12, 0.1, 2, 0.03), paint); mir.position.set(sx * 0.98, 1.05, 0.7); this.body.add(mir);
    }
    // front: honeycomb grille, LED light bar, red GTI line, headlights, X fog lights, logo
    const grille = new THREE.Mesh(new RoundedBoxGeometry(1.25, 0.24, 0.05, 2, 0.02), mat.std(0x08080a, 0.4, 0.4));
    grille.position.set(0, 0.47, 2.14); this.body.add(grille);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.018, 0.02), mat.emit(0xdfe8ff, 1.3)); bar.position.set(0, 0.79, 2.06); this.body.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.012, 0.02), mat.emit(0xff1020, 1.6)); red.position.set(0, 0.755, 2.07); this.body.add(red);
    this.lightsOn = [];
    for (const sx of [1, -1]) {
      const hl = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.07, 0.06, 2, 0.02), mat.emit(0xe6eeff, 1.5)); hl.position.set(sx * 0.66, 0.8, 1.99); hl.rotation.y = sx * 0.35; this.body.add(hl);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), mat.emit(0xe8eeff, 1.6));
      for (const [dx, dy] of [[0, 0], [0.035, 0.03], [-0.035, 0.03], [0.035, -0.03], [-0.035, -0.03]]) {
        const d2 = dot.clone(); d2.position.set(sx * (0.56 + dx), 0.45 + dy, 2.1); this.body.add(d2);
      }
      const tl = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.07, 0.05, 2, 0.02), mat.emit(0xff0a14, 1.8)); tl.position.set(sx * 0.58, 0.9, -2.1); tl.rotation.y = -sx * 0.3; this.body.add(tl);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(0xc8d6ff).multiplyScalar(0.45), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      glow.position.set(sx * 0.66, 0.8, 2.1); glow.scale.set(0.8, 0.4, 1); this.body.add(glow);
      const tg = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(0xff1a20).multiplyScalar(0.6), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      tg.position.set(sx * 0.58, 0.9, -2.2); tg.scale.set(0.9, 0.4, 1); this.body.add(tg);
    }
    const logo = new THREE.Mesh(new THREE.CircleGeometry(0.085, 32), new THREE.MeshStandardMaterial({ map: logoTex(), transparent: true, metalness: 0.9, roughness: 0.2 }));
    logo.position.set(0, 0.66, 2.13); this.body.add(logo);
    const logoR = logo.clone(); logoR.position.set(0, 0.86, -2.15); logoR.rotation.y = Math.PI; this.body.add(logoR);
    // GTI badge (red), honeycomb texture would be too fine at this scale
    const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.035), new THREE.MeshBasicMaterial({ map: canvasTex(128, 40, (c) => { c.fillStyle = '#d01020'; c.font = 'bold 34px sans-serif'; c.fillText('GTI', 26, 32); }), transparent: true }));
    badge.position.set(-0.45, 0.52, 2.155); this.body.add(badge);
    // wheels
    this.wheels = [];
    for (const [sx, sz] of [[1, 1.33], [-1, 1.33], [1, -1.30], [-1, -1.30]]) {
      const w = wheel(paint); w.position.set(sx * 0.775, 0.335, sz); if (sx < 0) w.rotation.y = Math.PI;
      this.root.add(w); this.wheels.push(w);
    }
    // headlight beams
    this.beams = [];
    for (const sx of [1, -1]) {
      const sl = new THREE.SpotLight(0xe8f0ff, 60, 70, 0.42, 0.6, 1.6);
      sl.position.set(sx * 0.66, 0.8, 2.1); sl.target.position.set(sx * 0.5, 0, 18);
      this.root.add(sl, sl.target); this.beams.push(sl);
    }
    this.buildCockpit();
    this.root.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  }

  buildCockpit() {
    const c = new THREE.Group(); this.cockpit = c; this.root.add(c);
    const dark = mat.std(0x141418, 0.7), soft = mat.std(0x1e1e24, 0.8);
    const dash = new THREE.Mesh(new RoundedBoxGeometry(1.62, 0.22, 0.55, 3, 0.08), dark); dash.position.set(0, 0.93, 0.95); c.add(dash);
    const top = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.06, 0.4, 3, 0.03), soft); top.position.set(0, 1.05, 1.05); c.add(top);
    // red ambient light strips
    this.ambient = mat.emit(0xff1830, 2.5);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.008, 0.008), this.ambient); strip.position.set(0, 0.99, 0.69); c.add(strip);
    for (const sx of [1, -1]) {
      const ds = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.9), this.ambient); ds.position.set(sx * 0.8, 0.95, 0.15); c.add(ds);
      const door = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.5, 1.2, 2, 0.03), soft); door.position.set(sx * 0.84, 0.75, 0.1); c.add(door);
    }
    // digital cockpit + touchscreen (canvas textures, redrawn per frame)
    this.clusterTex = canvasTex(512, 200, () => {});
    const cl = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.117), new THREE.MeshBasicMaterial({ map: this.clusterTex, toneMapped: false }));
    cl.position.set(0.37, 1.04, 0.86); cl.rotation.x = -0.25; cl.rotation.y = Math.PI; c.add(cl);
    const hood = new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.05, 0.12, 2, 0.02), dark); hood.position.set(0.37, 1.1, 0.84); c.add(hood);
    this.screenTex = canvasTex(400, 240, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#120614'); gr.addColorStop(1, '#2a0a18'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(255,40,70,0.9)'; g.lineWidth = 3; g.beginPath(); g.moveTo(30, 180); g.bezierCurveTo(120, 120, 220, 200, 370, 80); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = '22px sans-serif'; g.fillText('Annecy', 30, 40); g.fillStyle = 'rgba(255,60,90,0.9)'; g.fillText('130 BPM  ▶', 230, 40);
    });
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.15), new THREE.MeshBasicMaterial({ map: this.screenTex, toneMapped: false }));
    sc.position.set(0, 1.08, 0.8); sc.rotation.x = -0.35; sc.rotation.y = Math.PI; c.add(sc);
    // steering wheel: flat bottom
    const sw = new THREE.Group(); sw.position.set(0.37, 0.94, 0.47); sw.rotation.x = -0.4; c.add(sw); this.steer = sw;
    const pts = [];
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      let x = Math.sin(a) * 0.185, y = Math.cos(a) * 0.185;
      if (y < -0.15) y = -0.15 + (y + 0.15) * 0.15;
      pts.push(V(x, y, 0));
    }
    const rimG = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 96, 0.017, 10, true);
    const leather = mat.std(0x18181c, 0.65);
    sw.add(new THREE.Mesh(rimG, leather));
    const stitch = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => p.clone().multiplyScalar(1.0)), true), 96, 0.0175, 6, true), new THREE.MeshBasicMaterial({ color: 0xc81424, wireframe: true, transparent: true, opacity: 0.25 }));
    const hubM = mat.std(0x1c1c20, 0.5, 0.3);
    const hub = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.1, 0.05, 2, 0.02), hubM); hub.position.z = 0.02; sw.add(hub);
    for (const [x, y, r] of [[-0.1, 0, 0], [0.1, 0, 0], [0, -0.09, Math.PI / 2]]) {
      const sp = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.035, 0.02, 2, 0.01), hubM); sp.position.set(x, y, 0.015); sp.rotation.z = r; sw.add(sp);
    }
    const lg = new THREE.Mesh(new THREE.CircleGeometry(0.03, 32), new THREE.MeshStandardMaterial({ map: logoTex(), transparent: true, metalness: 0.9, roughness: 0.25 }));
    lg.position.z = 0.047; lg.rotation.y = Math.PI; sw.add(lg);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.3, 12), dark); col.rotation.x = Math.PI / 2 - 0.4; col.position.set(0.37, 0.9, 0.62); c.add(col);
    // seats (GTI tartan centre)
    const tartan = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#1a1a1e'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(200,20,36,0.85)'; g.lineWidth = 3;
      for (let i = 0; i < w; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
      g.strokeStyle = 'rgba(120,120,130,0.6)'; g.lineWidth = 1;
      for (let i = 8; i < w; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
    }, { repeat: [3, 3] });
    const seatM = new THREE.MeshStandardMaterial({ map: tartan, roughness: 0.9 });
    for (const sx of [1, -1]) {
      const base = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.14, 0.52, 3, 0.05), seatM); base.position.set(sx * 0.37, 0.5, -0.05); c.add(base);
      const back = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.7, 0.14, 3, 0.05), seatM); back.position.set(sx * 0.37, 0.88, -0.36); back.rotation.x = -0.22; c.add(back);
      const hr = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.16, 0.1, 3, 0.04), dark); hr.position.set(sx * 0.37, 1.32, -0.47); hr.rotation.x = -0.2; c.add(hr);
    }
    const rear = new THREE.Mesh(new RoundedBoxGeometry(1.35, 0.14, 0.55, 3, 0.05), seatM); rear.position.set(0, 0.52, -1.0); c.add(rear);
    const rearB = new THREE.Mesh(new RoundedBoxGeometry(1.35, 0.6, 0.14, 3, 0.05), seatM); rearB.position.set(0, 0.86, -1.3); rearB.rotation.x = -0.18; c.add(rearB);
    const liner = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.02, 2.1), mat.std(0x0d0d10, 0.95)); liner.position.set(0, 1.4, -0.45); c.add(liner);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.02, 3.0), mat.std(0x101012, 0.95)); floor.position.set(0, 0.36, -0.2); c.add(floor);
    // inner A-pillars and mirror
    for (const sx of [1, -1]) {
      const ap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.62, 8), dark); ap.position.set(sx * 0.7, 1.2, 0.6); ap.rotation.x = 0.95; ap.rotation.z = -sx * 0.12; c.add(ap);
    }
    const mirror = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.06, 0.03, 2, 0.015), dark); mirror.position.set(0, 1.33, 0.48); c.add(mirror);
    // windshield (inner, nearly clear)
    this.windshield = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), mat.phys(0x9ab0d0, { transparent: true, opacity: 0.06, roughness: 0.02, metalness: 0.0, depthWrite: false }));
    this.windshield.position.set(0, 1.2, 0.62); this.windshield.rotation.x = -0.95 + Math.PI; c.add(this.windshield);
  }

  drawCluster(speed, t) {
    const cv = this.clusterTex.userData.canvas, g = cv.getContext('2d');
    const w = cv.width, h = cv.height;
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0a0610'); gr.addColorStop(1, '#170812'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const arc = (cx, val, col) => {
      g.lineWidth = 12; g.strokeStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.arc(cx, 120, 70, Math.PI * 0.8, Math.PI * 2.2); g.stroke();
      g.strokeStyle = col; g.beginPath(); g.arc(cx, 120, 70, Math.PI * 0.8, Math.PI * (0.8 + 1.4 * val)); g.stroke();
    };
    arc(110, speed / 180, '#ff2a48'); arc(400, 0.35 + 0.25 * Math.abs(Math.sin(t * 3)), '#ff2a48');
    g.fillStyle = '#ffffff'; g.font = 'bold 54px sans-serif'; g.textAlign = 'center'; g.fillText(String(Math.round(speed)), 110, 140);
    g.font = '18px sans-serif'; g.fillStyle = '#ff6a80'; g.fillText('km/h', 110, 168);
    g.fillStyle = '#ffffff'; g.font = 'bold 26px sans-serif'; g.fillText('GTI', 256, 60);
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.font = '18px sans-serif'; g.fillText('22:58', 256, 175);
    this.clusterTex.needsUpdate = true;
  }

  // place the car: position on the ground, heading (yaw), wheel spin distance
  update(pos, yaw, dist, t) {
    this.root.position.copy(pos);
    this.root.rotation.set(0, yaw, 0);
    const rot = dist / CAR.wheelR;
    for (const w of this.wheels) w.userData.spin.rotation.x = rot * (w.rotation.y ? -1 : 1);
    for (const w of this.wheels) w.children[0].rotation.x = 0;
    this.body.position.y = 0.006 * Math.sin(t * 23) + 0.004 * Math.sin(t * 7.3);
  }
}
