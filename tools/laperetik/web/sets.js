// Shots 5-9: laptop + Instagram (20-34 s), price poster (34-42 s), shop & toast (42-48 s), business card & end (48-56 s).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { v3, deg, clamp, prog, lerp, smooth, easeOut, easeOut5, easeIn, easeInOut, easeInOut5, easeBack, seeded, noise3, tex, canvas, canvasTex } from './lib.js';
import { BOX, pieceFactories, rosemary, hideUnderLid } from './food.js';
import { beerBottle, wineBottle, wineGlass, terrineJar, bokehLights } from './props.js';
import { makeLaptop, screenMaterial, makeHand, InstaUI, ReelsUI, typeLine, SCR, LAP } from './laptop.js';

const S = {};   // module state
window.__S = S;

async function loadFonts() {
  const list = [['Inter', 400], ['Inter', 500], ['Inter', 600], ['Inter', 700], ['Oswald', 400], ['Oswald', 500], ['Oswald', 600], ['Oswald', 700], ['Playfair Display', 700], ['Playfair Display', 800]];
  for (const [fam, w] of list) {
    const f = new FontFace(fam, `url(/assets/laperetik/fonts/${fam.replace(' ', '')}-${w}.ttf)`, { weight: String(w) });
    await f.load(); document.fonts.add(f);
  }
  const it = new FontFace('Playfair Display', 'url(/assets/laperetik/fonts/PlayfairDisplay-400i.ttf)', { weight: '400', style: 'italic' });
  await it.load(); document.fonts.add(it);
}

function loadImage(url) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; }); }

function gradSphere(top, bottom, glow, dir = v3(0, 0.3, -1)) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { cTop: { value: new THREE.Color(top) }, cBot: { value: new THREE.Color(bottom) }, cGlow: { value: new THREE.Color(glow) }, gDir: { value: dir.clone().normalize() } },
    vertexShader: 'varying vec3 vW; void main(){ vW = (modelMatrix * vec4(position,1.)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW,1.); }',
    fragmentShader: `uniform vec3 cTop, cBot, cGlow, gDir; varying vec3 vW;
      void main(){ vec3 d = normalize(vW - cameraPosition); vec3 c = mix(cBot, cTop, smoothstep(-0.55, 0.65, d.y)); c += cGlow * pow(max(dot(d, gDir), 0.0), 4.0) * 0.7; gl_FragColor = vec4(c, 1.0); }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(2400, 48, 24), mat); m.renderOrder = -10; m.frustumCulled = false;
  return m;
}
function plane(w, h, mat, rotX = -Math.PI / 2) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.rotation.x = rotX; m.receiveShadow = true; return m; }
const gold = () => new THREE.MeshPhysicalMaterial({ color: 0xe2b866, metalness: 1, roughness: 0.22, clearcoat: 0.5, clearcoatRoughness: 0.2 });

function heartMesh(size = 6) {
  const s = new THREE.Shape();
  s.moveTo(0, -0.9); s.bezierCurveTo(-0.6, -0.4, -1.1, 0.0, -1.1, 0.42); s.bezierCurveTo(-1.1, 0.85, -0.75, 1.1, -0.48, 1.1); s.bezierCurveTo(-0.22, 1.1, -0.05, 0.92, 0, 0.75);
  s.bezierCurveTo(0.05, 0.92, 0.22, 1.1, 0.48, 1.1); s.bezierCurveTo(0.75, 1.1, 1.1, 0.85, 1.1, 0.42); s.bezierCurveTo(1.1, 0.0, 0.6, -0.4, 0, -0.9);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.18, bevelSize: 0.14, bevelSegments: 5, curveSegments: 24 });
  g.center(); g.scale(size / 2.2, size / 2.2, size / 2.2);
  return new THREE.Mesh(g, gold());
}
function followIcon(size = 6) {
  const g = new THREE.Group(), m = gold();
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 16), m); head.position.set(-0.3, 0.55, 0); g.add(head);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.75, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), m); body.position.set(-0.3, -0.55, 0); body.scale.set(1, 0.8, 0.45); g.add(body);
  const p1 = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.22, 0.22, 3, 0.1), m); p1.position.set(0.75, 0.0, 0); g.add(p1);
  const p2 = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.9, 0.22, 3, 0.1), m); p2.position.set(0.75, 0.0, 0); g.add(p2);
  g.scale.setScalar(size / 2); return g;
}

// ------------------------------------------------------------ build
export async function build(B) {
  const { scene, renderer, M, U, makeBox } = B;
  S.B = B;
  await loadFonts();
  const logoImg = await loadImage('/assets/laperetik/tex/logo_mask.png').then(img => {
    const c = canvas(512, 512), x = c.getContext('2d'); x.drawImage(img, 0, 0, 512, 512);
    const d = x.getImageData(0, 0, 512, 512); for (let i = 0; i < d.data.length; i += 4) { const a = d.data[i]; d.data[i] = 21; d.data[i + 1] = 21; d.data[i + 2] = 21; d.data[i + 3] = a; }
    x.putImageData(d, 0, 0); return c;
  });
  S.logoImg = logoImg;
  const groups = {};

  // ---------------- desk + laptop
  const desk = new THREE.Group(); groups.desk = desk; scene.add(desk);
  desk.add(plane(600, 400, new THREE.MeshStandardMaterial({ map: tex('desk', { repeat: [7, 5] }), bumpMap: tex('desk_bump', { color: false, repeat: [7, 5] }), bumpScale: 1.2, roughness: 0.55 })));
  const wall = plane(900, 400, new THREE.MeshStandardMaterial({ map: tex('wall', { repeat: [3, 1.5] }), roughness: 0.95, color: 0xcaa883 }), 0); wall.position.set(0, 150, -95); desk.add(wall);
  desk.add(gradSphere(0x3a2618, 0x1b120b, 0x8a5222));
  S.reelRT = new THREE.WebGLRenderTarget(720, 1280, { samples: 4, type: THREE.HalfFloatType });
  S.ui = null;
  S.screenMat = screenMaterial(null, S.reelRT.texture);
  S.laptop = makeLaptop(S.screenMat); desk.add(S.laptop);
  // lamp, mug, notebook
  {
    const brass = new THREE.MeshStandardMaterial({ color: 0xb8894a, metalness: 1, roughness: 0.3 });
    const lamp = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(7, 8, 1.5, 40), brass); base.position.y = 0.75; lamp.add(base);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 42, 12), brass); arm.position.set(0, 21, 0); arm.rotation.z = 0.15; lamp.add(arm);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(9, 12, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.5, side: THREE.DoubleSide })); shade.position.set(-4, 44, 3); shade.rotation.z = 0.5; lamp.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(2.6, 20, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.75, 0.45).multiplyScalar(6) })); bulb.position.set(-2.6, 40, 3); lamp.add(bulb);
    const pl = new THREE.PointLight(0xffb066, 2000, 160, 1.8); pl.position.set(-2, 38, 3); lamp.add(pl);
    lamp.position.set(-46, 0, -38); desk.add(lamp); S.lampLight = pl;
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 3.9, 9.5, 40), new THREE.MeshPhysicalMaterial({ color: 0xeee3d2, roughness: 0.3, clearcoat: 0.6 })); mug.position.set(30, 4.75, -16); desk.add(mug);
    const cof = new THREE.Mesh(new THREE.CircleGeometry(3.8, 32), new THREE.MeshPhysicalMaterial({ color: 0x2a160a, roughness: 0.1, clearcoat: 1 })); cof.rotation.x = -Math.PI / 2; cof.position.set(30, 8.8, -16); desk.add(cof);
    const nb = new THREE.Mesh(new RoundedBoxGeometry(15, 1.2, 21, 2, 0.3), new THREE.MeshStandardMaterial({ map: tex('label_terrine', { wrap: false }), color: 0xc09060, roughness: 0.8 })); nb.position.set(-30, 0.6, 12); nb.rotation.y = 0.4; desk.add(nb);
    const bk = bokehLights(30, 17, [500, 160, 30], 0xffc078, 3); bk.position.set(0, 60, -90); desk.add(bk);
  }
  // hand on the trackpad
  S.hand = makeHand(); desk.add(S.hand);
  S.handBase = v3(1.6, LAP.T + 0.03, 17.4);   // index and middle fingertips rest on the trackpad
  desk.traverse(o => { if (o.isMesh && !o.material.isShaderMaterial) { o.castShadow = o.castShadow ?? true; o.receiveShadow = true; } });

  // the box that comes out of the screen and goes back in
  S.popBox = makeBox(M, U); S.popHolder = new THREE.Group(); S.popHolder.add(S.popBox); desk.add(S.popHolder);
  S.popBox.rotation.x = Math.PI / 2;   // lid faces the holder's +z, logo top toward its +y
  S.popBox.position.set(0, 0, -4.4); // pivot at the middle of the box
  S.popHolder.visible = false;

  // vertical Reel set (9:16), rendered into the laptop screen and, after the dive, directly
  S.reel = new THREE.Group(); S.reel.position.set(5000, 0, 0); scene.add(S.reel); groups.reel = S.reel;
  {
    const bc = canvas(512, 910), bx = bc.getContext('2d');
    const g = bx.createRadialGradient(256, 420, 40, 256, 455, 620); g.addColorStop(0, '#e6c393'); g.addColorStop(0.6, '#d6a86e'); g.addColorStop(1, '#b98450');
    bx.fillStyle = g; bx.fillRect(0, 0, 512, 910);
    const bd = new THREE.Mesh(new THREE.PlaneGeometry(330, 586), new THREE.MeshBasicMaterial({ map: canvasTex(bc) })); bd.position.set(0, 0, -95); S.reel.add(bd);
    S.lines = [];
    [[38, false, 1], [0, true, -1], [-38, false, 1]].forEach(([y, filled, dir]) => {
      const t = typeLine("L'APÉRETIK", filled);
      const h = 33, w = 150;
      t.repeat.set(w / (h * t.userData.aspect) * t.userData.k, 1);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
      m.position.set(0, y, -60); S.reel.add(m); S.lines.push({ m, t, dir });
    });
  }
  S.reelBox = makeBox(M, U); S.reel.add(S.reelBox);
  const rc = B.makeContents(M); S.reelBox.add(rc.group); S.reelContents = rc.group; S.reelPieces = rc.pieces;
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ map: tex('softdot', { wrap: false }), color: 0x3a2a1f, transparent: true, opacity: 0.3, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.set(0, -22, 0); S.reel.add(sh); S.reelShadow = sh;
  S.reelCam = new THREE.PerspectiveCamera(34, 9 / 16, 1, 3000);

  // ---------------- poster studio
  const poster = new THREE.Group(); groups.poster = poster; scene.add(poster);
  poster.add(gradSphere(0xe2c08e, 0xb07a48, 0xf0cf98, v3(0, 0.2, -1)));
  const pf = plane(1400, 1400, new THREE.MeshStandardMaterial({ color: 0xd9b585, roughness: 0.92 })); poster.add(pf);
  {
    const board = new THREE.Group();
    const front = new THREE.Mesh(new THREE.PlaneGeometry(40, 60), new THREE.MeshStandardMaterial({ map: tex('poster', { wrap: false }), roughness: 0.8 })); front.position.z = 0.36; board.add(front);
    const core = new THREE.Mesh(new RoundedBoxGeometry(40.6, 60.6, 0.7, 2, 0.15), new THREE.MeshStandardMaterial({ color: 0xa87c50, roughness: 0.8 })); board.add(core);
    const oakM = new THREE.MeshStandardMaterial({ map: tex('oak', { repeat: [0.2, 0.2] }), roughness: 0.6 });
    const foot = new THREE.Mesh(new RoundedBoxGeometry(34, 3, 12, 2, 0.6), oakM); foot.position.set(0, -31.5, 1); board.add(foot);
    const slot = new THREE.Mesh(new RoundedBoxGeometry(41, 2.5, 2.2, 2, 0.4), oakM); slot.position.set(0, -29.6, 0.2); board.add(slot);
    board.position.set(0, 33, 0); board.rotation.y = deg(-12); poster.add(board); S.board = board;
    board.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    S.posterProducts = [];
    const pb = beerBottle(); pb.position.set(-15, 58, -38); poster.add(pb); S.posterProducts.push({ o: pb, base: pb.position.clone(), ph: 0, w: 0.5, tilt: 0.25 });
    const pw = wineBottle(); pw.position.set(16, 50, -68); poster.add(pw); S.posterProducts.push({ o: pw, base: pw.position.clone(), ph: 2, w: -0.4, tilt: -0.2 });
    const pt = terrineJar(); pt.scale.setScalar(1.1); pt.position.set(-1, 71, -54); poster.add(pt); S.posterProducts.push({ o: pt, base: pt.position.clone(), ph: 4, w: 0.6, tilt: 0.15 });
    poster.add(bokehLights(24, 41, [500, 200, 40], 0xffe2b0, 3).translateZ(-400).translateY(80));
  }

  // ---------------- shop interior
  const shop = new THREE.Group(); groups.shop = shop; scene.add(shop);
  shop.add(gradSphere(0x2a1a10, 0x140c07, 0x7a4a20));
  shop.add(plane(800, 800, new THREE.MeshStandardMaterial({ map: tex('oak', { repeat: [6, 6] }), roughness: 0.6, color: 0x9c7a58 })));
  {
    const wallM = new THREE.MeshStandardMaterial({ map: tex('wall', { repeat: [3, 1.5] }), roughness: 0.95, color: 0xd0b08a });
    const bw = plane(600, 320, wallM, 0); bw.position.set(0, 160, -40); shop.add(bw);
    const woodM = new THREE.MeshStandardMaterial({ map: tex('desk', { repeat: [2, 0.2] }), roughness: 0.6, color: 0xb88a5c });
    const rndS = seeded(61);
    const bottleTypes = [beerBottle(), wineBottle(), terrineJar()];
    for (let u = -1; u <= 1; u++) {
      const ux = u * 128;
      for (let k = 0; k < 5; k++) {
        const y = 30 + k * 44;
        const sh = new THREE.Mesh(new RoundedBoxGeometry(120, 2.6, 30, 2, 0.4), woodM); sh.position.set(ux, y, -24); shop.add(sh);
        let x = ux - 54;
        while (x < ux + 52) {
          const r = rndS();
          let o;
          if (k >= 3) { o = r < 0.6 ? bottleTypes[1].clone() : bottleTypes[0].clone(); }
          else if (k === 2) { o = r < 0.5 ? bottleTypes[0].clone() : bottleTypes[2].clone(); }
          else { o = r < 0.7 ? bottleTypes[2].clone() : bottleTypes[1].clone(); }
          const wdt = o === null ? 8 : (o.children.length > 4 ? 10 : 8.4);
          o.position.set(x + 4, y + 1.3, -22 + (rndS() - 0.5) * 6); o.rotation.y = (rndS() - 0.5) * 0.8;
          shop.add(o); x += wdt + 1 + rndS() * 2;
        }
      }
      const side = new THREE.Mesh(new RoundedBoxGeometry(3, 230, 32, 2, 0.5), woodM); side.position.set(ux - 61.5, 115, -24); shop.add(side);
    }
    const counter = new THREE.Mesh(new RoundedBoxGeometry(220, 95, 70, 3, 1.5), new THREE.MeshStandardMaterial({ map: tex('oak', { repeat: [1.2, 0.5] }), roughness: 0.55 }));
    counter.position.set(0, 47.5, 80); shop.add(counter);
    const top = new THREE.Mesh(new RoundedBoxGeometry(230, 4, 78, 3, 1.5), new THREE.MeshStandardMaterial({ map: tex('walnut', { repeat: [1.5, 0.5] }), bumpMap: tex('walnut_bump', { color: false, repeat: [1.5, 0.5] }), bumpScale: 0.6, roughness: 0.35 }));
    top.position.set(0, 97, 80); shop.add(top); S.counterTop = 99;
    // pendant lights
    S.pendants = [];
    for (const px of [-70, 0, 70]) {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(13, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1c1a18, metalness: 0.6, roughness: 0.35, side: THREE.DoubleSide }));
      dome.position.set(px, 178, 62); shop.add(dome);
      const inner = new THREE.Mesh(new THREE.CircleGeometry(12.6, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.78, 0.5).multiplyScalar(4) })); inner.rotation.x = Math.PI / 2; inner.position.set(px, 178.2, 62); shop.add(inner);
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 120, 6), new THREE.MeshStandardMaterial({ color: 0x111111 })); cord.position.set(px, 251, 62); shop.add(cord);
      const l = new THREE.SpotLight(0xffc47e, px === 0 ? 3000 : 6500, 400, deg(55), 0.6, 1.6); l.position.set(px, 174, 62); l.target.position.set(px, 0, 62); shop.add(l, l.target); S.pendants.push(l);
    }
    // welcome slate on the counter
    const sc = canvas(1024, 640), x = sc.getContext('2d');
    x.fillStyle = '#2b2622'; x.fillRect(0, 0, 1024, 640); x.strokeStyle = '#b08a5a'; x.lineWidth = 34; x.strokeRect(17, 17, 990, 606);
    x.fillStyle = '#f4ecdf'; x.textAlign = 'center'; x.font = 'italic 400 150px "Playfair Display"'; x.fillText('Bienvenue !', 512, 300);
    x.font = '500 58px Oswald'; x.fillStyle = '#e2c27f'; x.fillText('PRODUITS LOCAUX · CIRCUIT COURT', 512, 450);
    const slate = new THREE.Mesh(new RoundedBoxGeometry(32, 20, 1.2, 2, 0.4), [0, 0, 0, 0, 0, 0].map((_, i) => i === 4 ? new THREE.MeshStandardMaterial({ map: canvasTex(sc), roughness: 0.8 }) : new THREE.MeshStandardMaterial({ color: 0x8a6440 })));
    slate.position.set(-27, S.counterTop + 9.5, 84); slate.rotation.set(deg(-12), deg(24), 0); shop.add(slate);
    for (const [x, y, z, r] of [[30, 0, 76, 0.3], [30, 3.9, 76, 0.9], [44, 0, 70, -0.4]]) {
      const mb = makeBox(M, U); mb.scale.setScalar(0.46); mb.position.set(x, S.counterTop + y, z); mb.rotation.y = r; shop.add(mb);
    }
    shop.add(bokehLights(20, 63, [400, 60, 20], 0xffc078, 2.5).translateY(240).translateZ(-30));
    shop.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }
  // the toast: open box on the table at golden hour, bottles and glasses clinking
  const toast = new THREE.Group(); groups.toast = toast; scene.add(toast);
  toast.add(gradSphere(0x5a3418, 0x1c110a, 0xffa040, v3(-0.6, 0.15, -1)));
  toast.add(plane(1600, 1600, new THREE.MeshStandardMaterial({ map: tex('oak', { repeat: [20, 20] }), bumpMap: tex('oak_bump', { color: false, repeat: [20, 20] }), bumpScale: 2, roughness: 0.65 })));
  S.clink = { b1: beerBottle(), b2: beerBottle(), g1: wineGlass(0.45), g2: wineGlass(0.4) };
  for (const o of Object.values(S.clink)) toast.add(o);
  const sl = bokehLights(36, 71, [520, 70, 40], 0xffc070, 2.8); sl.position.set(0, 70, -260); toast.add(sl);
  const sl2 = bokehLights(20, 72, [300, 40, 40], 0xffb060, 3.4); sl2.position.set(0, 40, -150); toast.add(sl2);
  S.glint = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex('softdot', { wrap: false }), color: new THREE.Color(1, 0.85, 0.55).multiplyScalar(2.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  toast.add(S.glint);

  // ---------------- business card
  const cardMatF = new THREE.MeshPhysicalMaterial({ map: tex('card_front', { wrap: false }), metalnessMap: tex('card_front_foil', { color: false, wrap: false }), metalness: 1, roughness: 0.42, bumpMap: tex('card_front_deboss', { color: false, wrap: false }), bumpScale: -1.5, sheen: 0.3, sheenColor: new THREE.Color(0xffffff) });
  cardMatF.roughnessMap = null;
  const cardMatB = new THREE.MeshPhysicalMaterial({ map: tex('card_back', { wrap: false }), metalnessMap: tex('card_back_foil', { color: false, wrap: false }), metalness: 1, roughness: 0.38 });
  const edge = new THREE.MeshStandardMaterial({ color: 0xf0e8da, roughness: 0.9 });
  const cg = new THREE.BoxGeometry(8.5, 0.07, 5.5);
  // BoxGeometry groups: px nx py ny pz nz -> top (py) = front, bottom (ny) = back
  S.card = new THREE.Mesh(cg, [edge, edge, cardMatF, cardMatB, edge, edge]);
  S.card.castShadow = true; S.card.receiveShadow = true;
  const cardSet = new THREE.Group(); groups.card = cardSet; scene.add(cardSet); cardSet.add(S.card);
  {
    const rr = seeded(81);
    for (let i = 0; i < 7; i++) {
      const w = pieceFactories.walnutHalf(M, rr); w.scale.setScalar(1.25);
      const a = deg(200 + i * 22 + rr() * 10), r = 19 + rr() * 4;
      w.position.set(Math.cos(a) * r, 0.5, Math.sin(a) * r); w.rotation.y = rr() * 6; cardSet.add(w);
    }
    const rm = rosemary(M, 5); rm.scale.setScalar(1.5); rm.position.set(14, 0.4, 19); rm.rotation.y = deg(30); cardSet.add(rm);
    const rm2 = rosemary(M, 9); rm2.scale.setScalar(1.3); rm2.position.set(-24, 0.4, -12); rm2.rotation.y = deg(-70); cardSet.add(rm2);
    cardSet.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }
  // 3D QR code that comes out of the business card at the end (modules extruded on a cream plate, scannable)
  {
    const qr = await fetch('/assets/laperetik/tex/qr.json').then(r => r.json());
    const n = qr.n, quiet = 2, cell = 0.5, codeW = (n + quiet * 2) * cell;
    const g = new THREE.Group();
    const pc = canvas(1024, 1280), px = pc.getContext('2d');
    px.fillStyle = '#f6eee2'; px.fillRect(0, 0, 1024, 1280);
    px.strokeStyle = '#c9a15b'; px.lineWidth = 14; px.beginPath(); px.roundRect(26, 26, 972, 1228, 60); px.stroke();
    px.fillStyle = '#3a2a1f'; px.textAlign = 'center'; px.font = '700 96px Oswald'; px.fillText('SCANNEZ-MOI', 512, 150);
    const W_ = codeW + 1.6, H_ = codeW * 1.25;
    const plate = new THREE.Mesh(new RoundedBoxGeometry(W_, H_, 0.7, 3, 0.3), [0, 1, 2, 3, 4, 5].map(i => i === 4 ? new THREE.MeshStandardMaterial({ map: canvasTex(pc), roughness: 0.85 }) : new THREE.MeshStandardMaterial({ color: 0xe9dcc6, roughness: 0.85 })));
    g.add(plate);
    const codeY = -(H_ - codeW) / 2 + 0.8;      // the code sits in the lower part, the title above
    const dark = []; qr.m.forEach((row, y) => row.forEach((v, x) => { if (v) dark.push([x, y]); }));
    const mod = new THREE.InstancedMesh(new RoundedBoxGeometry(cell * 1.0, cell * 1.0, 0.36, 1, 0.03), new THREE.MeshStandardMaterial({ color: 0x2a1e16, roughness: 0.7 }), dark.length);
    const m4 = new THREE.Matrix4();
    dark.forEach(([x, y], i) => { m4.makeTranslation((x + quiet + 0.5) * cell - codeW / 2, codeY + codeW / 2 - (y + quiet + 0.5) * cell, 0.35 + 0.18); mod.setMatrixAt(i, m4); });
    g.add(mod);
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const holder = new THREE.Group(); holder.add(g); cardSet.add(holder); holder.visible = false;
    S.qr = holder; S.qrInner = g; S.qrW = W_;
  }
  S.groups = groups;
  return api;
}

// ------------------------------------------------------------ tiles for the Instagram grid (snapshots of the real 3D scene)
async function makeTiles(snap) {
  const T = [], tw = 584, th = 778;
  const mk = () => { const c = canvas(tw, th); return [c, c.getContext('2d')]; };
  const crop = (src, ctx, cx, cy, w) => { const h = w * th / tw; ctx.drawImage(src, cx - w / 2, cy - h / 2, w, h, 0, 0, tw, th); };
  const L = S.logoImg;
  { const [c, x] = mk(); x.fillStyle = '#3a2a1f'; x.fillRect(0, 0, tw, th); x.fillStyle = '#c9a15b'; x.textAlign = 'center'; x.font = '700 120px Oswald'; x.fillText('NOUVEAU', tw / 2, 360); x.font = '700 104px Oswald'; x.fillText('À ANNECY', tw / 2, 480);
    x.fillStyle = '#f4ecdf'; x.font = 'italic 400 40px "Playfair Display"'; x.fillText('Box apéro & produits locaux', tw / 2, 580); T.push(c); }
  { const [c, x] = mk(); crop(snap(3.9), x, 540, 1000, 900); x.fillStyle = '#3a2a1f'; x.textAlign = 'center'; x.font = '700 76px Oswald'; x.fillText('LA BOX APÉRO', tw / 2, 120); T.push(c); }
  { const [c, x] = mk(); crop(snap(9.9), x, 540, 960, 1000); T.push(c); }
  { const [c, x] = mk(); x.fillStyle = '#f4ecdf'; x.fillRect(0, 0, tw, th); x.drawImage(L, tw / 2 - 190, 150, 380, 380); x.fillStyle = '#3a2a1f'; x.textAlign = 'center'; x.font = 'italic 400 38px "Playfair Display"'; x.fillText('Chassez le naturel,', tw / 2, 620); x.fillText("il revient à l'apéro", tw / 2, 668); T.push(c); }
  { const [c, x] = mk(); crop(snap(12.6), x, 540, 900, 1000); x.fillStyle = '#3a2a1f'; x.textAlign = 'center'; x.font = '700 60px Oswald'; x.fillText('100 % LOCAL', tw / 2, 110); T.push(c); }
  { const [c, x] = mk(); x.fillStyle = '#c9a15b'; x.fillRect(0, 0, tw, th); x.fillStyle = '#3a2a1f'; x.textAlign = 'center'; x.font = '700 84px Oswald'; x.fillText('PRODUCTEURS', tw / 2, 360); x.fillText('LOCAUX', tw / 2, 460); x.font = '600 40px Oswald'; x.fillText('BIO · AOP · IGP', tw / 2, 560); T.push(c); }
  S.ui = new ReelsUI([T[2], T[0], null, T[5]], S.logoImg);
  S.screenMat.uniforms.ui.value = S.ui.tex;
}

// ------------------------------------------------------------ screen choreography (20 - 28.6 s)
// two-finger scroll through the Reels feed, land on the L'Apéretik Reel, like it, the box comes out of the
// screen and goes back in as the camera dives into the Reel.
const SCROLLS = [[20.3, 20.7, 0, 1], [20.85, 21.3, 1, 2]];
const feedP = t => {
  let p = 0;
  for (const [a, b, p0, p1] of SCROLLS) if (t >= a) p = lerp(p0, p1, easeInOut5(prog(t, a, b)));
  return p;
};
const CURSOR = [[20.0, 1240, 720], [30, 1240, 720]];
const CUR = (pts, t) => {
  if (t <= pts[0][0]) return { x: pts[0][1], y: pts[0][2] };
  for (let i = 0; i < pts.length - 1; i++) {
    const [ta, xa, ya] = pts[i], [tb, xb, yb] = pts[i + 1];
    if (t <= tb) { const e = easeInOut(prog(t, ta, tb)); return { x: lerp(xa, xb, e), y: lerp(ya, yb, e) }; }
  }
  const l = pts[pts.length - 1]; return { x: l[1], y: l[2] };
};
const press = (t, at) => Math.max(0, 1 - Math.abs(t - at) / 0.07);
const LIKE = 99, POP_OUT = 21.45, CIRC0 = 22.15, CIRC1 = 24.0, POP_IN = 24.75, ZOOM0 = 24.1, ZOOM1 = 25.4;

function screenState(t) {
  const p = feedP(t);
  const st = { p, cursor: CUR(CURSOR, t), press: press(t, LIKE), liked: t >= LIKE, likePop: t >= LIKE ? prog(t, LIKE, LIKE + 0.7) : 0,
    chrome: 1 - smooth(prog(t, 24.55, 25.25)) };
  st.rect = S.ui.reelRect(S.ui.ours, p);
  st.reelT = t - 21.0;
  return st;
}

function reelPose(rt, boxVisible = true) {
  // box rotating 360° in front of the giant type, slow push of the Reel camera
  const b = S.reelBox;
  b.visible = boxVisible;
  b.position.set(0, -8 + Math.sin(rt * 1.4) * 1.0, 0);
  b.rotation.set(deg(24), -deg(25) + (rt / 6.5) * Math.PI * 2, 0);
  const lid = b.userData.lid;
  const lo = smooth(prog(rt, 5.3, 6.0)) * (1 - smooth(prog(rt, 7.0, 7.5)));
  lid.position.set(0, lid.userData.closedY + lo * 13, -lo * 3); lid.rotation.set(-deg(16) * lo, 0, 0);
  S.reelContents.visible = lo > 0.001;
  hideUnderLid(S.reelPieces, lid);
  S.reelShadow.material.opacity = boxVisible ? 0.3 : 0;
  S.lines.forEach((l, i) => { l.t.offset.x = (rt * 0.035 * l.dir + i * 0.17) % 1; });
  const cam = S.reelCam;
  const k = Math.max(0, rt);
  cam.position.set(5000, 6 - k * 0.25, 150 - k * 2.4); cam.up.set(0, 1, 0); cam.lookAt(5000, -4 - k * 0.15, 0);
  cam.fov = 34; cam.aspect = 9 / 16; cam.updateProjectionMatrix();
}

function renderReel(t, st, boxVisible) {
  const { renderer, scene } = S.B;
  reelPose(st.reelT, boxVisible);
  const big = t > 24.4;
  const w = big ? 1080 : 720, h = big ? 1920 : 1280;
  if (S.reelRT.width !== w) S.reelRT.setSize(w, h);
  const vis = [];
  scene.children.forEach(c => { if (c !== S.reel && c.visible && !c.isLight) { vis.push(c); c.visible = false; } });
  S.reel.visible = true;
  const bg = scene.background, fog = scene.fog; scene.background = null; scene.fog = null;
  renderer.setRenderTarget(S.reelRT); renderer.render(scene, S.reelCam); renderer.setRenderTarget(null);
  scene.background = bg; scene.fog = fog;
  vis.forEach(c => (c.visible = true)); S.reel.visible = false;
}

function screenUpdate(t, boxVisible) {
  const st = screenState(t);
  S.ui.draw(st);
  const r = st.rect;
  S.screenMat.uniforms.rect.value.set(r.x / SCR.w, 1 - (r.y + r.h) / SCR.h, r.w / SCR.w, r.h / SCR.h);
  if (r.y < SCR.h && r.y + r.h > 0) renderReel(t, st, boxVisible);
  S.screenMat.uniforms.gain.value = 1.0;
  return st;
}

function placeHand(st, t) {
  // two fingers slide toward the screen during each scroll, lift slightly and come back
  let dz = 0, lift = 0;
  for (const [a, b] of SCROLLS) {
    const k = prog(t, a - 0.05, b - 0.1), back = prog(t, b - 0.1, b + 0.2);
    dz += -2.6 * easeInOut(k) * (1 - easeInOut(back));
    lift += Math.sin(Math.PI * back) * 0.35;
  }
  const dx = (st.cursor.x - 1240) * 0.0062, dzc = (st.cursor.y - 720) * 0.0062;
  const tap = st.press * 0.16;
  S.hand.position.set(S.handBase.x + dx, S.handBase.y + lift - tap, S.handBase.z + dz + dzc);
  S.hand.rotation.set(0, deg(7) + dx * 0.02, 0);
}

// ------------------------------------------------------------ shots
function deskLights(ctx, t) {
  const c = v3(0, 6, -4);
  ctx.setKey(c, v3(-1.1, 1.3, 0.5), 220, 70, 2.4, 0xffd09a); ctx.setRim(c, v3(0.6, 0.6, -1), 1.6);
  ctx.hemi.intensity = 0.45;
  ctx.scene.background = null; ctx.scene.fog = new THREE.FogExp2(0x2a1c12, 0.0018);
  ctx.renderer.toneMappingExposure = 1.0;
}
function screenWorld() {
  const p = S.laptop.userData.screenCenterLocal.clone();
  S.laptop.updateMatrixWorld(true);
  const w = S.laptop.userData.lid.localToWorld(p.clone());
  const n = v3(0, 0, 1).applyQuaternion(S.laptop.userData.lid.getWorldQuaternion(new THREE.Quaternion()));
  return { c: w, n };
}
function povCam(D, elev, side = 4, lowerAim = 2.5) {
  const { c, n } = screenWorld();
  const dir = n.clone().applyAxisAngle(v3(1, 0, 0), -deg(elev)).normalize();
  const pos = c.clone().add(dir.multiplyScalar(D)).add(v3(side, 0, 0));
  return { pos, at: c.clone().add(v3(0, -lowerAim, 0)) };
}

function popPose(t, ctx) {
  // the box leaves the Reel, goes round in circles in front of the Mac, then spirals back into the screen
  const { c, n } = screenWorld();
  const lidQ = S.laptop.userData.lid.getWorldQuaternion(new THREE.Quaternion());
  const up = v3(0, 1, 0).applyQuaternion(lidQ), right = v3(1, 0, 0).applyQuaternion(lidQ);
  const C = c.clone().addScaledVector(n, 13).addScaledVector(up, -0.5);
  const RX = 5.6, RY = 7.0;
  const start = c.clone().addScaledVector(n, 0.6).addScaledVector(up, -1.2);
  const ring = (th, r, depth) => c.clone().addScaledVector(n, depth).addScaledVector(up, -0.5 * r).addScaledVector(right, Math.cos(th) * RX * r).addScaledVector(up, Math.sin(th) * RY * r);
  let pos, sc, th = 0;
  if (t < CIRC0) {
    const k = easeInOut(prog(t, POP_OUT, CIRC0));
    pos = start.clone().lerp(ring(0, 1, 13), k); pos.addScaledVector(n, Math.sin(k * Math.PI) * 2.5); sc = lerp(0.17, 0.32, k);
  } else if (t < CIRC1) {
    th = Math.PI * 3 * easeInOut(prog(t, CIRC0, CIRC1));
    pos = ring(th, 1, 13 + Math.sin(th * 2) * 1.0); sc = 0.32;
  } else {
    const kb = easeIn(prog(t, CIRC1, POP_IN));
    th = Math.PI * 3 + Math.PI * 1.6 * kb;
    pos = ring(th, 1 - kb, lerp(13, 0.6, kb)); sc = lerp(0.32, 0.17, kb);
  }
  S.popHolder.visible = t >= POP_OUT && t < POP_IN;
  S.popHolder.position.copy(pos); S.popHolder.scale.setScalar(sc);
  // always facing the camera so the logo stays readable, banking into the turns
  S.popHolder.up.copy(up); S.popHolder.lookAt(ctx.camera.position);
  S.popHolder.rotateZ(-Math.sin(th) * 0.18); S.popHolder.rotateY(Math.cos(th) * 0.28);
  S.popBox.rotation.set(Math.PI / 2, 0, Math.sin(t * 0.9) * 0.06);
  return t >= POP_OUT && t < POP_IN;
}

const api = {
  get groups() { return S.groups; },
  makeTiles,
  shotLaptop(t, ctx) {
    ctx.show(['desk']); deskLights(ctx, t);
    S.laptop.userData.halves.forEach(h => (h.rotation.y = 0));
    const outside = t >= POP_OUT && t < POP_IN;
    const st = screenUpdate(t, !outside);
    placeHand(st, t); S.hand.visible = true;
    // exterior view (pulls back a little while the box circles), then a spiral dive that sucks us into the Reel
    const k = easeInOut(prog(t, 20.0, ZOOM0));
    const away = smooth(prog(t, 21.6, 22.4)) * (1 - smooth(prog(t, 23.6, 24.2)));
    let { pos, at } = povCam(lerp(62, 56, k) + away * 9, lerp(15, 11, k), lerp(5, 3, k), lerp(5.5, 3.5, k) - away * 1.5);
    const w = prog(t, 20.0, 20.4);
    let samples = 1;
    if (w < 1) { const e = easeOut5(w); pos.add(v3(0, (1 - e) * 20, (1 - e) * 30)); samples = w < 0.9 ? 5 : 1; }
    const z = easeInOut5(prog(t, ZOOM0, ZOOM1));
    const { c, n } = screenWorld();
    const lidQ = S.laptop.userData.lid.getWorldQuaternion(new THREE.Quaternion());
    const lidUp = v3(0, 1, 0).applyQuaternion(lidQ);
    const rr = st.rect, rc = c.clone()
      .add(v3(1, 0, 0).applyQuaternion(lidQ).multiplyScalar(((rr.x + rr.w / 2) / SCR.w - 0.5) * LAP.SW))
      .add(lidUp.clone().multiplyScalar(-((rr.y + rr.h / 2) / SCR.h - 0.5) * LAP.SH));
    const fillD = (rr.h / SCR.h * LAP.SH / 2) / Math.tan(deg(23));
    ctx.look(pos, at, 46);
    if (z > 0) {
      const q0 = ctx.camera.quaternion.clone();
      const endPos = rc.clone().add(n.clone().multiplyScalar(fillD));
      const m = new THREE.Matrix4().lookAt(endPos, rc, lidUp); const q1 = new THREE.Quaternion().setFromRotationMatrix(m);
      // spiral: the path curls around the axis of the dive while the camera rolls a full turn
      const curl = Math.sin(z * Math.PI) * 9;
      const side = v3(1, 0, 0).applyQuaternion(lidQ);
      const spiralOff = side.clone().multiplyScalar(Math.cos(z * Math.PI * 2) * curl).add(lidUp.clone().multiplyScalar(Math.sin(z * Math.PI * 2) * curl));
      pos = pos.clone().lerp(endPos, z).add(spiralOff);
      ctx.camera.position.copy(pos); ctx.camera.quaternion.slerpQuaternions(q0, q1, z);
      ctx.camera.rotateZ(Math.PI * 2 * easeInOut(prog(t, ZOOM0 + 0.1, ZOOM1)));
      ctx.camera.fov = 46; ctx.camera.updateProjectionMatrix();
      samples = z > 0.04 && z < 0.97 ? 6 : 1;
    }
    popPose(t, ctx);                          // after the camera, so the box faces this frame's lens
    ctx.setDOF(ctx.camera.position.distanceTo(c), lerp(0.0009, 0.0, smooth(prog(t, ZOOM0, ZOOM0 + 0.8))), 0.014);
    const d = ctx.dust(); d.visible = z < 0.5; d.position.set(0, 0, 0); d.material.uniforms.t.value = t; d.material.uniforms.size.value = 0.45;
    return { samples, shutter: 1 / 36 };
  },
  shotFollow(t, ctx) {
    // inside the Reel: the same set and camera as the screen texture, now rendered full frame
    ctx.show([]);
    if (t > 28.9) { ctx.scene.background = new THREE.Color(0xfffaf3); ctx.scene.fog = null; ctx.dust().visible = false; ctx.setDOF(0, 0, 0); return { samples: 1 }; }  // covered by the profile page
    S.reel.visible = true;
    deskLights(ctx, t);                       // identical lighting to the screen render, so the cut is seamless
    ctx.scene.background = new THREE.Color(0xb98450); ctx.scene.fog = null;
    ctx.dust().visible = false;
    reelPose(t - 21.0, true);
    const cam = S.reelCam;
    ctx.camera.position.copy(cam.position); ctx.camera.quaternion.copy(cam.quaternion);
    ctx.camera.fov = cam.fov; ctx.camera.updateProjectionMatrix();
    ctx.setDOF(0, 0, 0);
    return { samples: 1 };
  },
  shotPoster(t, ctx) {
    ctx.show(['poster']);
    const c = v3(0, 35, 0);
    ctx.setKey(c, v3(-1, 1.1, 0.8), 260, 90, 3.0, 0xffd6a4); ctx.setRim(c, v3(0.3, 0.6, -1), 4.5, 0xffc070);
    ctx.hemi.intensity = 0.75;
    ctx.scene.background = null; ctx.scene.fog = new THREE.Fog(0xc99a64, 500, 1500);
    ctx.renderer.toneMappingExposure = 0.84;
    S.posterProducts.forEach((p, i) => {
      const a = t - 34;
      p.o.position.copy(p.base).add(v3(0, Math.sin(a * 1.1 + p.ph) * 1.8, 0));
      p.o.rotation.set(p.tilt + Math.sin(a * 0.8 + p.ph) * 0.06, a * p.w + p.ph, Math.sin(a * 0.6) * 0.05 + p.tilt * 0.5);
    });
    const k = easeInOut(prog(t, 34, 42));
    const e = easeOut5(prog(t, 34.0, 34.9));
    const pos = v3(lerp(10, -8, k), lerp(46, 41, k), lerp(205, 160, k) + (1 - e) * 60);
    const at = v3(lerp(-2, -4, k), 39, 0);
    ctx.look(pos, at, 30);
    ctx.setDOF(pos.distanceTo(v3(0, 33, 0)), 0.0009, 0.018);
    const d = ctx.dust(); d.visible = true; d.position.set(0, 0, 40); d.material.uniforms.t.value = t; d.material.uniforms.size.value = 0.7;
    return { samples: e < 0.95 ? 6 : 1, shutter: 1 / 48 };
  },
  shotShop(t, ctx) {
    if (t < 45) {
      ctx.show(['shop', 'box']);
      ctx.box.position.set(0, S.counterTop, 80); ctx.box.rotation.set(0, 0, 0); ctx.contents.visible = false;
      const lid = ctx.lid; lid.position.set(0, lid.userData.closedY, 0); lid.rotation.set(0, 0, 0);
      ctx.U.uReveal.value = 1.2; ctx.U.uEmber.value = 0; ctx.U.uSweepAmp.value = 0;
      // the box is handed across the counter toward the customer
      const s = easeInOut(prog(t, 42.35, 43.6));
      ctx.box.position.z = lerp(52, 92, s); ctx.box.position.x = lerp(-6, 0, s); ctx.box.rotation.y = lerp(-0.25, 0.1, s);
      ctx.box.position.y = S.counterTop + Math.sin(s * Math.PI) * 1.5;
      const c = v3(0, 100, 40);
      ctx.setKey(c, v3(-0.8, 1.4, 0.7), 400, 220, 1.4, 0xffcf96); ctx.setRim(c, v3(0.4, 0.5, -1), 1.2);
      ctx.hemi.intensity = 0.35;
      ctx.scene.background = null; ctx.scene.fog = new THREE.FogExp2(0x24160d, 0.0012);
      ctx.renderer.toneMappingExposure = 1.05;
      const k = easeInOut(prog(t, 42, 45));
      const pos = v3(lerp(30, 8, k), lerp(138, 130, k), lerp(215, 178, k));
      const at = v3(lerp(8, 0, k), lerp(110, 106, k), 40);
      ctx.look(pos, at, 38);
      ctx.setDOF(pos.distanceTo(ctx.box.position), 0.00035, 0.014);
      const d = ctx.dust(); d.visible = true; d.position.set(0, 80, 60); d.material.uniforms.t.value = t; d.material.uniforms.size.value = 1.2;
      return { samples: 1 };
    }
    // the toast at golden hour
    ctx.show(['toast', 'box']);
    ctx.box.position.set(0, 0.08, 0); ctx.box.rotation.set(0, deg(30), 0); ctx.contents.visible = true; ctx.poseContents(0); ctx.pieces.forEach(pc => (pc.obj.visible = true));
    const lid = ctx.lid; lid.position.set(-34, 1.6, -12); lid.rotation.set(deg(4), 0, deg(-3));   // lid leaning on the table
    const c = v3(0, 10, 0);
    ctx.setKey(c, v3(-1, 0.42, -0.35), 260, 80, 3.6, 0xffb562); ctx.setRim(c, v3(0.5, 0.35, -1), 3.4, 0xff9a40);
    ctx.hemi.intensity = 0.35;
    ctx.scene.background = null; ctx.scene.fog = new THREE.FogExp2(0x3a2210, 0.0016);
    ctx.renderer.toneMappingExposure = 1.0;
    const { b1, b2, g1, g2 } = S.clink;
    const cb = easeOut(prog(t, 45.3, 46.25)), rb = prog(t, 46.25, 46.9);
    const meet = v3(0, 44, -4);
    const back = Math.sin(clamp(rb) * Math.PI) * 1.2 * (1 - rb);
    b1.position.copy(meet).add(v3(-10.8 - (1 - cb) * 44 - back, -21.2 - (1 - cb) * 10, 0)); b1.rotation.set(0, 0.4, deg(-24) + (1 - cb) * 0.2);
    b2.position.copy(meet).add(v3(10.8 + (1 - cb) * 44 + back, -21.2 - (1 - cb) * 10, 1.0)); b2.rotation.set(0, -0.6, deg(24) - (1 - cb) * 0.2);
    const cg = easeOut(prog(t, 46.3, 47.2)), rg = prog(t, 47.2, 47.9);
    const meetG = v3(0, 46, -26);
    const backG = Math.sin(clamp(rg) * Math.PI) * 1.0 * (1 - rg);
    g1.position.copy(meetG).add(v3(-7.8 - (1 - cg) * 50 - backG, -14 - (1 - cg) * 14, 0)); g1.rotation.set(0, 0, deg(-14));
    g2.position.copy(meetG).add(v3(7.8 + (1 - cg) * 50 + backG, -14 - (1 - cg) * 14, 0)); g2.rotation.set(0, 0, deg(14));
    g1.visible = g2.visible = t > 46.25;
    // glint on contact
    const gl = Math.max(Math.max(0, 1 - Math.abs(t - 46.25) / 0.12), Math.max(0, 1 - Math.abs(t - 47.2) / 0.12));
    S.glint.visible = gl > 0; S.glint.scale.setScalar(2 + gl * 5);
    S.glint.position.copy(t < 46.8 ? meet.clone().add(v3(0, 0.4, 2)) : meetG.clone().add(v3(0, -1.5, 3)));
    S.glint.quaternion.copy(ctx.camera.quaternion); S.glint.material.opacity = gl;
    const k = easeInOut(prog(t, 45, 48));
    const pos = v3(lerp(-14, 10, k), lerp(40, 36, k), lerp(112, 98, k));
    const at = v3(0, lerp(24, 28, k), 0);
    ctx.look(pos, at, 36);
    ctx.setDOF(pos.distanceTo(v3(0, 34, 0)), 0.0007, 0.02);
    const d = ctx.dust(); d.visible = true; d.position.set(0, 0, 0); d.material.uniforms.t.value = t; d.material.uniforms.size.value = 0.9;
    return { samples: 1 };
  },
  shotCard(t, ctx) {
    ctx.show(['card', 'box', 'walnut']);
    ctx.box.position.set(0, 0, 0); ctx.box.rotation.set(0, 0, 0); ctx.contents.visible = false;
    const lid = ctx.lid; lid.position.set(0, lid.userData.closedY, 0); lid.rotation.set(0, 0, 0);
    ctx.U.uReveal.value = 1.2; ctx.U.uEmber.value = 0;
    const top = lid.userData.closedY + 0.04;
    const c = v3(0, 0, 0);
    ctx.setKey(c, v3(-1, 1.15, 0.45), 150, 45, 3.0); ctx.setRim(c, v3(0.8, 0.5, -1), 2.0);
    ctx.hemi.intensity = 0.4;
    ctx.scene.background = null; ctx.scene.fog = new THREE.FogExp2(0x1a110a, 0.003);
    ctx.renderer.toneMappingExposure = 1.0;
    // card: slow-motion fall, landing on the lid beside the logo, then a 3D flip to show the QR side
    const rest = v3(7.8, top + 0.035, 9.6), restRot = deg(-28);
    const f = prog(t, 48.0, 49.45), fe = 1 - Math.pow(1 - f, 2.2);
    const card = S.card;
    if (t < 49.45) {
      card.position.set(lerp(-6, rest.x, fe), lerp(top + 46, rest.y, fe), lerp(-6, rest.z, fe));
      card.rotation.set(Math.sin(f * 5.2) * 0.5 * (1 - f), restRot + (1 - f) * 2.2, Math.cos(f * 4.1) * 0.35 * (1 - f));
    } else {
      const fl = easeInOut(prog(t, 49.75, 50.55));
      card.position.set(rest.x, rest.y + Math.sin(fl * Math.PI) * 3.2 + Math.max(0, 1 - (t - 49.45) / 0.12) * 0.25 * 0, rest.z);
      card.rotation.set(0, restRot, 0);
      card.rotateOnAxis(v3(1, 0, 0), Math.PI * fl);
      if (fl > 0.5) card.position.y = rest.y + Math.sin(fl * Math.PI) * 3.2 + 0.0;
    }
    // golden sweep across the card foil
    const sw = prog(t, 50.2, 51.1);
    ctx.sweepLight.intensity = 0; ctx.sweepLight.distance = 60;
    ctx.sweepLight.position.set(lerp(-6, 22, sw), top + 9, lerp(18, 2, sw));
    // camera: 3/4 view of the fall, then rise to a top-down shot, settle, hold still for the last 2 s
    const rise = easeInOut(prog(t, 50.4, 52.0));
    const at = v3(lerp(3, 0, rise), lerp(top - 1, 3, rise), lerp(4, 0.4, rise));
    const az = deg(lerp(18, 0, rise)), el = deg(lerp(34, 89.5, rise));
    const D = lerp(78, 154, rise) - easeOut(prog(t, 52, 54)) * 7;
    const p = v3(at.x + Math.sin(az) * Math.cos(el) * D, at.y + Math.sin(el) * D, at.z + Math.cos(az) * Math.cos(el) * D);
    ctx.look(p, at, 34);
    ctx.setDOF(p.distanceTo(v3(rest.x, top, rest.z)), rise > 0.9 ? 0.00008 : 0.0005, 0.012);
    // the QR code rises out of the card in 3D, spinning, and settles facing the camera, big enough to scan
    const qk = prog(t, 50.9, 52.3);
    S.qr.visible = t >= 50.9;
    let samples = 1;
    if (S.qr.visible) {
      const e = easeOut5(qk);
      const from = v3(rest.x, top + 0.4, rest.z), to = v3(2.0, 40, 12.5);
      const pos = from.clone().lerp(to, e); pos.y += Math.sin(e * Math.PI) * 6;
      pos.y += Math.sin((t - 52.3) * 1.6) * 0.25 * smooth(prog(t, 52.3, 53));
      S.qr.position.copy(pos);
      S.qr.scale.setScalar(lerp(0.17, 0.86, easeBack(clamp(qk * 1.05), 1.2)));
      S.qr.up.set(0, 0, -1); S.qr.lookAt(ctx.camera.position);
      S.qrInner.rotation.set(0, (1 - e) * Math.PI * 0.9, -(1 - e) * Math.PI * 2);
      if (t > 54) { S.qr.position.y = to.y; }           // still for the last 2 s
      samples = qk > 0.03 && qk < 0.7 ? 4 : 1;
    }
    const d = ctx.dust(); d.visible = t < 52; d.material.uniforms.t.value = t;
    return { samples, shutter: 1 / 40 };
  },
  beforeRender(t) {},
};
