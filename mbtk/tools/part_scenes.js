/* ---------- variables de scène ---------- */
let GLOWRECT, sceneA, sceneB, phone, cards = [], argMeshes = [], poster, trades = [], laptop, bokehs = [], dust, dustB, contact, sunA, envA, envB;
let PAGE = {}, TIMER, TIMER_TEX;
const SHMAP = isMobile ? 1024 : 2048;
const LAYERS = {};
const FAR = []; // éléments du couloir masqués quand on le voit à travers l'écran du téléphone

function makeDust(n, box, seed, col) {
  const pos = new Float32Array(n * 3), R2 = rng(seed);
  for (let i = 0; i < n; i++) { pos[i * 3] = box[0] + R2() * (box[3] - box[0]); pos[i * 3 + 1] = R2() * (box[4] - box[1]); pos[i * 3 + 2] = box[2] + R2() * (box[5] - box[2]); }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(dg, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uT: { value: 0 }, uFocus: { value: 3 }, uAp: { value: 10 }, uY0: { value: box[1] }, uYH: { value: box[4] - box[1] }, uCol: { value: new THREE.Color(col || 0xffb873) } },
    vertexShader: `uniform float uT,uFocus,uAp,uY0,uYH;varying float vA;void main(){vec3 p=position;p.y=uY0+mod(p.y+uT*.05,uYH);p.x+=sin(uT*.3+position.z*3.)*.08;
      vec4 mv=modelViewMatrix*vec4(p,1.);float d=-mv.z;float coc=clamp(uAp*abs(1.-uFocus/d),1.5,40.);gl_PointSize=(coc+2.)*${Q.toFixed(2)};vA=.55/(1.+coc*coc*.02);gl_Position=projectionMatrix*mv;}`,
    fragmentShader: 'uniform vec3 uCol;varying float vA;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,.35,d)*vA;gl_FragColor=vec4(uCol*a*1.4,a);}'
  }));
}

function buildSceneA() {
  sceneA = new THREE.Scene(); sceneA.background = new THREE.Color(0x0a0306);
  envA = makeEnv(0);
  // table en noyer
  const wal = walnutTex();
  const wc = T(wal.color, { repeat: [8 / 6, 6 / 3], aniso: MAXANI }), wr = T(wal.rough, { repeat: [8 / 6, 6 / 3], linear: true });
  const tableMat = new THREE.MeshPhysicalMaterial({ map: wc, roughnessMap: wr, roughness: 1, metalness: 0, envMap: envA, envMapIntensity: .6, clearcoat: .4, clearcoatRoughness: .25 });
  tableMat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP=(modelMatrix*vec4(transformed,1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <dithering_fragment>',
      `#include <dithering_fragment>
       float bl=smoothstep(.15,.55,sin((vWP.x*.8+vWP.z*.55)*5.2)*.5+.5);
       float spot=exp(-pow(length((vWP.xz-vec2(-.2,-.1))*vec2(.55,.8)),2.)*.6);
       gl_FragColor.rgb*=mix(.72,1.18,bl*spot+.25*(1.-spot));
       gl_FragColor.rgb+=vec3(.35,.03,.07)*exp(-pow(length(vWP.xz-vec2(1.3,.4)),2.)*.35)*.35;
       gl_FragColor.rgb+=vec3(.02,.04,.14)*exp(-pow(length(vWP.xz-vec2(-1.6,.6)),2.)*.3)*.5;`);
  };
  const top = new THREE.Mesh(new THREE.PlaneGeometry(8, 6), tableMat); top.rotation.x = -Math.PI / 2; top.position.z = -.5; top.receiveShadow = true; sceneA.add(top);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(8, .12, .06), new THREE.MeshStandardMaterial({ color: 0x2e1a0f, roughness: .5, envMap: envA })); edge.position.set(0, -.06, -3.5); sceneA.add(edge);
  // fond : salle à manger bordeaux / soubassement marine, fenêtre et suspension floues
  const bd = new THREE.Mesh(new THREE.PlaneGeometry(30, 14), new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 vUv;void main(){vec2 p=vUv;
      vec3 deep=vec3(.05,.007,.018);vec3 bord=vec3(.30,.022,.05);vec3 navy=vec3(.010,.018,.07);
      vec3 wall=mix(bord*.7,deep,smoothstep(.45,.95,p.y));
      vec3 c=mix(navy*1.6,wall,smoothstep(.392,.398,p.y));
      c+=vec3(.9,.8,.7)*.06*exp(-pow((p.y-.398)*300.,2.));
      vec2 w=p-vec2(.37,.6);
      float win=smoothstep(.075,.07,abs(w.x))*smoothstep(.12,.115,abs(w.y));
      float mull=1.-(1.-smoothstep(.002,.004,abs(w.x)))*.85; mull*=1.-(1.-smoothstep(.002,.004,abs(w.y-.01)))*.85;
      c=mix(c,vec3(1.1,.6,.3)*.85,win*mull);
      c+=vec3(1.,.5,.22)*.35*exp(-dot(w*vec2(3.,2.2),w*vec2(3.,2.2))*5.);
      c+=bord*.9*exp(-pow(length((p-vec2(.7,.52))*vec2(1.2,1.8)),2.)*5.);
      c+=vec3(.08,.14,.5)*.5*exp(-pow(length((p-vec2(.12,.5))*vec2(1.5,1.6)),2.)*5.);
      c+=vec3(1.,.62,.3)*1.3*exp(-pow(length((p-vec2(.585,.8))*vec2(14.,10.)),2.));
      gl_FragColor=vec4(c,1.);}`
  }));
  bd.position.set(0, 3, -8); sceneA.add(bd);
  // bokeh lumineux (ambre, bordeaux, bleu marine)
  const disc = new THREE.CircleGeometry(1, 24); const R = rng(11);
  for (let i = 0; i < 52; i++) {
    const col = [new THREE.Color(2.6, 1.25, .6), new THREE.Color(2.1, .28, .48), new THREE.Color(2.4, 1.9, 1.5), new THREE.Color(.6, .9, 2.8)][i % 4];
    const m = new THREE.Mesh(disc, new THREE.MeshBasicMaterial({ color: col })); const s = .025 + R() * .045;
    m.scale.setScalar(s); m.position.set((R() - .5) * 12, .4 + R() * 5.5, -5 - R() * 2.6); sceneA.add(m); bokehs.push(m);
  }
  // lumières : clé ambrée, halo bordeaux, contre-jour bleu marine
  sceneA.add(new THREE.HemisphereLight(0xffe1c4, 0x1a0a1a, .4));
  sunA = new THREE.DirectionalLight(0xffc28a, 2.3); sunA.position.set(-5, 4.4, -3.2); sunA.target.position.set(0, .5, 0); sceneA.add(sunA, sunA.target);
  sunA.castShadow = true; sunA.shadow.mapSize.set(SHMAP, SHMAP); const sc = sunA.shadow.camera; sc.left = -3.5; sc.right = 3.5; sc.top = 3.5; sc.bottom = -3.5; sc.near = 1; sc.far = 16; sunA.shadow.bias = -.0004; sunA.shadow.normalBias = .02;
  const spot = new THREE.SpotLight(0xc4304f, 4.2, 16, .6, 1, 1.4); spot.position.set(4.6, 3.4, 2.6); spot.target.position.set(0, .6, 0); sceneA.add(spot, spot.target);
  const blue = new THREE.DirectionalLight(0x4d6fe0, 1.1); blue.position.set(-3.5, 2.2, -4.5); blue.target.position.set(0, 1, 0); sceneA.add(blue, blue.target);
  const rim = new THREE.PointLight(0xe8b27a, .9, 12, 2); rim.position.set(-2.4, 2.8, 3.2); sceneA.add(rim);
  // ombre de contact
  contact = new THREE.Mesh(new THREE.PlaneGeometry(PW * 1.7, PH * 1.35), new THREE.MeshBasicMaterial({ map: T(contactShadowTex()), transparent: true, depthWrite: false, opacity: .85 }));
  contact.rotation.x = -Math.PI / 2; contact.position.y = .002; sceneA.add(contact);
  // téléphone + calques 3D
  phone = buildPhone(envA); sceneA.add(phone);
  buildLayers();
  // cartes
  const cardTex = [cardInsta(), cardReel(), cardTikTok(), cardCanva()];
  cardTex.forEach((cv, i) => { const m = panelMesh(.6, .8, .05, .022, T(cv), envA, { glow: i % 2 ? 0xc0405e : 0x4d6fe0 }); m.visible = false; sceneA.add(m); cards.push(m); });
  for (let i = 0; i < 5; i++) { const m = panelMesh(1, 380 / 1720, .028, .012, T(argPanel(i)), envA, { emi: 1, coat: .5 }); m.visible = false; sceneA.add(m); argMeshes.push(m); }
  poster = panelMesh(1, 1.5, .02, .008, T(bigPoster()), envA, { emi: .92, rough: .45, coat: .5, body: 0x5e1426 }); poster.visible = false; sceneA.add(poster);
  for (let i = 0; i < 6; i++) { const m = panelMesh(.62, .93, .03, .016, T(tradePoster(i)), envA, { emi: .9, glow: i % 2 ? 0x4d6fe0 : 0xc0405e, body: 0x1a0a10 }); m.visible = false; sceneA.add(m); trades.push(m); }
  dust = makeDust(160, [-3, 0, -3, 3, 3.5, 3], 5, 0x9a6a40); sceneA.add(dust);
}

function buildLayers() {
  for (const key of ['call', 'tt', 'ig']) {
    const spec = PAGES[key]; const grp = new THREE.Group(); grp.visible = false; phone.add(grp);
    const items = [];
    const add = (k, box, h, d, tex, shc, pad) => {
      const [x, y, w, hh] = box; const cw = w + 2 * pad, ch = hh + 2 * pad;
      const pw = cw / SCW * SW, ph = ch / SCH * SH;
      const lx = ((x + w / 2) / SCW - .5) * SW, ly = (.5 - (y + hh / 2) / SCH) * SH;
      const sm = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ map: T(shc), transparent: true, depthWrite: false, opacity: 0 }));
      sm.position.set(lx, ly, SZ + .0006); sm.renderOrder = 2; grp.add(sm);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
      m.position.set(lx, ly, SZ + .0012); m.renderOrder = 3 + Math.round(h * 100); grp.add(m);
      items.push({ k, m, sm, lx, ly, h, d });
    };
    spec.heroes.forEach(hh => { const cv = renderLayer(hh); const shc = shadowOf(cv); add(hh.k, hh.box, hh.h, hh.d, T(cv), shc, LPAD); });
    if (key === 'call') { const tc = mk(480, 96); txt(tc.g, '00:00', 240, 70, F(500, 54, 's'), '#fff', 'center'); add('timer', [300, 504, 480, 96], .11, .14, TIMER_TEX, shadowOf(tc.c), 0); tc.c.width = tc.c.height = 1; }
    const f = items.find(i => i.k === 'follow'); let glow = null;
    if (f) {
      glow = new THREE.Mesh(new THREE.PlaneGeometry(f.m.geometry.parameters.width * 1.22, f.m.geometry.parameters.height * 1.7), new THREE.MeshBasicMaterial({ map: GLOWRECT, color: key === 'tt' ? new THREE.Color(1.3, .12, .35) : new THREE.Color(.1, .5, 1.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
      glow.renderOrder = 2; grp.add(glow);
    }
    LAYERS[key] = { grp, items, follow: f, glow };
  }
}

/* ---------- textures de la maison ---------- */
function runnerTex() {
  const { c, g } = mk(512, 1024);
  g.fillStyle = '#6e1a2e'; g.fillRect(0, 0, 512, 1024);
  const id = g.getImageData(0, 0, 512, 1024), d = id.data;
  for (let y = 0; y < 1024; y++) for (let x = 0; x < 512; x++) { const n = (N1(x / 3, y / 3, 512 / 3, 1024 / 3) - .5) * 26 + (N2(x * .9, y * .9, 460, 920) - .5) * 14; const i = (y * 512 + x) * 4; d[i] += n; d[i + 1] += n * .5; d[i + 2] += n * .6; }
  g.putImageData(id, 0, 0);
  g.fillStyle = '#e9dccb'; g.fillRect(26, 0, 14, 1024); g.fillRect(472, 0, 14, 1024);
  g.fillStyle = '#16224d'; g.fillRect(48, 0, 8, 1024); g.fillRect(456, 0, 8, 1024);
  for (let k = 0; k < 4; k++) { const y = 128 + k * 256; g.save(); g.translate(256, y); g.rotate(Math.PI / 4); g.strokeStyle = '#e9dccb'; g.lineWidth = 8; g.strokeRect(-58, -58, 116, 116); g.fillStyle = '#16224d'; g.fillRect(-30, -30, 60, 60); g.restore(); }
  return c;
}
function doorTex() {
  const { c, g } = mk(512, 1024);
  g.fillStyle = '#18234c'; g.fillRect(0, 0, 512, 1024);
  const id = g.getImageData(0, 0, 512, 1024), d = id.data;
  for (let y = 0; y < 1024; y++) for (let x = 0; x < 512; x++) { const n = (N1(x / 40, y / 2, 512 / 40, 512) - .5) * 10; const i = (y * 512 + x) * 4; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(id, 0, 0);
  for (const [y, h] of [[70, 400], [530, 420]]) {
    g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(70, y, 372, 6); g.fillRect(70, y, 6, h);
    g.fillStyle = 'rgba(255,255,255,.10)'; g.fillRect(70, y + h - 6, 372, 6); g.fillRect(436, y, 6, h);
    g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(100, y + 30, 312, h - 60);
  }
  return c;
}
function wainscotTex() {
  const { c, g } = mk(1024, 256);
  g.fillStyle = '#0f1838'; g.fillRect(0, 0, 1024, 256);
  for (let k = 0; k < 2; k++) { const x = 40 + k * 512;
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x, 40, 432, 5); g.fillRect(x, 40, 5, 176);
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x, 211, 432, 5); g.fillRect(x + 427, 40, 5, 176); }
  return c;
}
function rugTex() {
  const { c, g } = mk(1024, 1024);
  g.fillStyle = '#e6dccd'; g.fillRect(0, 0, 1024, 1024);
  const id = g.getImageData(0, 0, 1024, 1024), d = id.data;
  for (let y = 0; y < 1024; y++) for (let x = 0; x < 1024; x++) { const n = (N2(x / 2, y / 2, 512, 512) - .5) * 30 + (N1(x / 30, y / 30, 1024 / 30, 1024 / 30) - .5) * 14; const i = (y * 1024 + x) * 4; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(id, 0, 0);
  g.strokeStyle = '#7d1f35'; g.lineWidth = 26; g.strokeRect(60, 60, 904, 904);
  g.strokeStyle = '#16224d'; g.lineWidth = 10; g.strokeRect(104, 104, 816, 816);
  g.fillStyle = '#7d1f35'; for (let k = 0; k < 12; k++) { const t = 150 + k * 66; [[t, 140], [t, 884], [140, t], [884, t]].forEach(([x, y]) => { g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillRect(-10, -10, 20, 20); g.restore(); }); }
  return c;
}
function skyTex() {
  const { c, g } = mk(512, 512);
  g.fillStyle = lingrad(g, 0, 0, 0, 512, [[0, '#0B1633'], [.38, '#26214d'], [.62, '#7a2a4a'], [.78, '#c5604a'], [.86, '#E8B27A'], [1, '#f0c58e']]); g.fillRect(0, 0, 512, 512);
  const R = rng(9); g.fillStyle = '#0a0d1e';
  let x = 0; while (x < 512) { const w = 20 + R() * 50, h = 40 + R() * 120; g.fillRect(x, 512 - h, w, h); for (let k = 0; k < 6; k++) { if (R() < .55) { g.fillStyle = R() < .5 ? '#ffcf8a' : '#ffe9c4'; g.fillRect(x + 4 + R() * (w - 10), 512 - h + 6 + R() * (h - 12), 3, 4); g.fillStyle = '#0a0d1e'; } } x += w + 2; }
  return c;
}
function leafTex() {
  const { c, g } = mk(256, 256);
  g.translate(128, 140); g.fillStyle = '#2f5a30';
  g.beginPath(); g.moveTo(0, 110); g.bezierCurveTo(-120, 60, -120, -90, 0, -118); g.bezierCurveTo(120, -90, 120, 60, 0, 110); g.fill();
  g.globalCompositeOperation = 'destination-out';
  for (let k = -3; k <= 3; k++) { if (!k) continue; g.save(); g.rotate(k * .32); g.fillRect(-4, -130, 8, 70); g.restore(); }
  g.globalCompositeOperation = 'source-over'; g.strokeStyle = '#4c7d43'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, 105); g.lineTo(0, -110); g.stroke();
  return c;
}
function knitTex() {
  const { c, g } = mk(256, 256); const id = g.createImageData(256, 256), d = id.data;
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const cx = x % 32, v = Math.abs(Math.sin((y / 16 + (cx < 16 ? 0 : .5)) * Math.PI)) * Math.sin(cx / 32 * Math.PI);
    const n = N1(x / 2, y / 2, 128, 128) * .3; const t = .55 + .45 * v + n * .3;
    const i = (y * 256 + x) * 4; d[i] = 140 * t; d[i + 1] = 34 * t; d[i + 2] = 56 * t; d[i + 3] = 255;
  }
  g.putImageData(id, 0, 0); return c;
}

/* ---------- tissus : carreau de matelassage (couleur + relief), tissage fin ---------- */
function fabricTile(base, opt = {}) {
  // une tuile = un carreau de couette (ou un motif de lin) ; couleur avec fibres + carte de normales assortie
  const S2 = 512, C = mk(S2, S2), Nn = mk(S2, S2);
  const cd = C.g.createImageData(S2, S2), nd = Nn.g.createImageData(S2, S2);
  const hgt = new Float32Array(S2 * S2), R = rng(opt.seed || 3);
  const per = opt.thread || 3.2;
  for (let y = 0; y < S2; y++) for (let x = 0; x < S2; x++) {
    const wv = Math.sin(x / per * Math.PI) * Math.sin(y / per * Math.PI);
    const fib = (N2(x / 1.5, y * .7, S2 / 1.5, S2 * .7) - .5);
    let h = .5 + .14 * wv + .1 * fib;
    if (opt.seam) { const ex = Math.min(x, S2 - 1 - x), ey = Math.min(y, S2 - 1 - y), e = Math.min(ex, ey); h -= .55 * Math.exp(-e * e / 30); }
    hgt[y * S2 + x] = h;
  }
  for (let y = 0; y < S2; y++) for (let x = 0; x < S2; x++) {
    const i = y * S2 + x, h = hgt[i];
    const hx = hgt[y * S2 + ((x + 1) % S2)] - hgt[y * S2 + ((x - 1 + S2) % S2)], hy = hgt[((y + 1) % S2) * S2 + x] - hgt[((y - 1 + S2) % S2) * S2 + x];
    const st = opt.strength || 2.2; let nx = -hx * st, ny = hy * st, nz = 1; const l = Math.hypot(nx, ny, nz);
    nd.data[i * 4] = (nx / l * .5 + .5) * 255; nd.data[i * 4 + 1] = (ny / l * .5 + .5) * 255; nd.data[i * 4 + 2] = (nz / l * .5 + .5) * 255; nd.data[i * 4 + 3] = 255;
    const v = .88 + (h - .5) * .5 + (R() - .5) * .05 + (N1(x / 40, y / 40, S2 / 40, S2 / 40) - .5) * .1;
    cd.data[i * 4] = base[0] * v; cd.data[i * 4 + 1] = base[1] * v; cd.data[i * 4 + 2] = base[2] * v; cd.data[i * 4 + 3] = 255;
  }
  C.g.putImageData(cd, 0, 0); Nn.g.putImageData(nd, 0, 0);
  if (opt.seam) { C.g.strokeStyle = 'rgba(0,0,0,.35)'; C.g.lineWidth = 2; C.g.setLineDash([7, 5]); C.g.strokeRect(3, 3, S2 - 6, S2 - 6); }
  const rp = opt.repeat || [1, 1];
  return { map: T(C.c, { repeat: rp, aniso: MAXANI }), normal: T(Nn.c, { repeat: rp, linear: true, aniso: MAXANI }) };
}

/* ---------- drapé de tissu (couette matelassée, drap, plaid) ---------- */
function drapeMap(o) {
  const rad = o.rad || .06;
  const drape = d => { if (d <= 0) return [0, 0]; const arc = Math.PI * rad / 2; if (d < arc) { const a = d / rad; return [rad * Math.sin(a), rad - rad * Math.cos(a)]; } return [rad, rad + Math.min(d - arc, o.hang || .28)]; };
  return (x, z) => {
    let y = o.top; const ax = Math.abs(x), sx = Math.sign(x) || 1;
    const dx = drape(ax - o.half); let nx = sx * (Math.min(ax, o.half) + dx[0]); y -= dx[1];
    const dz = o.foot != null ? drape(z - o.foot) : [0, 0]; let nz = (o.foot != null ? Math.min(z, o.foot) : z) + dz[0]; y -= dz[1];
    const onTop = clamp(1 - Math.max(ax - o.half, o.foot != null ? z - o.foot : -1, 0) * 8);
    const s = o.seed || 0;
    // grands plis souples + plis fins + gonflant
    const w = (.012 * Math.sin(x * 6 + z * 3 + s) + .009 * Math.sin(x * 2.6 - z * 8.5 + 1.3 + s) + .014 * (fbm(N1, (x + 2 + s) * 2.4, (z + 2) * 2.4, 4) - .5) * 2 + .004 * Math.sin(x * 19 + z * 6 + s)) * (o.wr || 1);
    y += w * (.55 + .45 * onTop) + (o.puff || .02) * onTop;
    // plis rayonnants autour du portable
    if (o.dip) { const lx = x - o.dip[0], lz = z - o.dip[1], r = Math.hypot(lx, lz), a = Math.atan2(lz, lx); y -= .01 * Math.exp(-r * r * 22) * onTop; y += .006 * Math.sin(a * 7) * Math.exp(-Math.pow(r - .32, 2) * 40) * onTop; }
    if (o.fold != null) { const fz = z - o.fold; y += .032 * Math.exp(-fz * fz * 240) * onTop; }
    // matelassage : chaque carreau gonfle entre les coutures
    if (o.quilt) {
      const q = Math.pow(Math.abs(Math.sin(Math.PI * (x + o.w / 2) / o.quilt) * Math.sin(Math.PI * (z - o.z0) / o.quilt)), .55) * o.qh;
      if (onTop > .5) y += q; else if (ax > o.half) nx += sx * q * .8; else nz += q * .8;
    }
    if (ax > o.half + .05) nx += .007 * Math.sin(z * 26 + x + s) + .004 * Math.sin(z * 61 + s);
    return [nx, y, nz];
  };
}
function drapeGeo(o) {
  const g = new THREE.PlaneGeometry(o.w, o.z1 - o.z0, o.sx || 150, o.sz || 120); g.rotateX(-Math.PI / 2); g.translate(0, 0, (o.z0 + o.z1) / 2);
  const P = g.attributes.position, map = drapeMap(o);
  for (let i = 0; i < P.count; i++) { const r = map(P.getX(i), P.getZ(i)); P.setXYZ(i, r[0], r[1], r[2]); }
  g.computeVertexNormals(); return g;
}
// ourlet épais qui suit le bord du tissu (donne l'épaisseur de la couette)
function hemGeo(o, r) {
  const map = drapeMap(o), pts = [], n = 60;
  for (let k = 0; k <= n; k++) pts.push(V3(...map(-o.w / 2, o.z0 + (o.z1 - o.z0) * k / n)));
  if (o.foot != null) for (let k = 1; k < n; k++) pts.push(V3(...map(-o.w / 2 + o.w * k / n, o.z1)));
  for (let k = n; k >= 0; k--) pts.push(V3(...map(o.w / 2, o.z0 + (o.z1 - o.z0) * k / n)));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 500, r, 10, false);
}
function pillowGeo(sx, sy, sz, seed) {
  const g = new THREE.SphereGeometry(1, 96, 64), p = g.attributes.position;
  const f = a => Math.sign(a) * Math.pow(Math.abs(a), .26);
  for (let i = 0; i < p.count; i++) {
    const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
    const x = f(vx), z = f(vz);
    const m = Math.max(Math.abs(x), Math.abs(z));
    const prof = Math.pow(Math.max(0, (1 - Math.pow(Math.abs(x), 5)) * (1 - Math.pow(Math.abs(z), 5))), .55);
    let y = Math.sign(vy) * Math.pow(Math.abs(vy), .8) * prof;
    // plis de tissu qui partent des coins + creux au centre
    const ang = Math.atan2(z, x);
    y += Math.sign(vy) * (Math.sin(ang * 8 + seed) * .06 * Math.pow(m, 3) + (N1(x * 3 + seed, z * 3, 0, 0) - .5) * .14 * prof - .05 * Math.exp(-(x * x + z * z) * 6));
    const corner = Math.pow(Math.abs(x * z), 6) * .05;
    p.setXYZ(i, x * sx * (1 + corner), y * sy, z * sz * (1 + corner));
  }
  g.computeVertexNormals();
  // passepoil (couture) sur tout le tour
  const pts = []; for (let k = 0; k < 160; k++) { const a = k / 160 * Math.PI * 2; const x = f(Math.cos(a)), z = f(Math.sin(a)); const corner = Math.pow(Math.abs(x * z), 6) * .05; pts.push(V3(x * sx * (1 + corner), 0, z * sz * (1 + corner))); }
  const pipe = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 320, Math.min(sx, sz) * .028, 8, true);
  return { body: g, pipe };
}

/* ---------- MacBook bordeaux détaillé : alu sablé, clavier en relief, trackpad, haut-parleurs, écran fin ---------- */
function dotsTex() { const { c, g } = mk(128, 512); g.fillStyle = '#5c1628'; g.fillRect(0, 0, 128, 512); g.fillStyle = '#12050a'; for (let y = 4; y < 512; y += 7) for (let x = 5; x < 128; x += 7) { g.beginPath(); g.arc(x + ((y / 7 | 0) % 2 ? 3.5 : 0), y, 1.8, 0, 7); g.fill(); } return T(c); }
function sandTex() { const { c, g } = mk(256, 256); const id = g.createImageData(256, 256), d = id.data, R = rng(31); for (let i = 0; i < d.length; i += 4) { const v = 118 + (R() - .5) * 70; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; } g.putImageData(id, 0, 0); return T(c, { linear: true, repeat: [10, 10] }); }
function buildMac(env) {
  const g = new THREE.Group();
  const LW = .312, LD = .221, BH = .0155;
  const alu = new THREE.MeshPhysicalMaterial({ color: 0x7a1c33, metalness: .9, roughness: .36, roughnessMap: sandTex(), envMap: env, envMapIntensity: 1.5, clearcoat: .2, clearcoatRoughness: .3 });
  const base = new THREE.Mesh(slab(LW, LD, .014, BH, .0035), alu); base.rotation.x = -Math.PI / 2; base.position.y = BH / 2; base.castShadow = base.receiveShadow = true; g.add(base);
  const notchF = new THREE.Mesh(new THREE.BoxGeometry(.06, .004, .006), new THREE.MeshStandardMaterial({ color: 0x3a0c18, roughness: .5 })); notchF.position.set(0, BH - .002, LD / 2 - .002); g.add(notchF);
  // clavier : cuvette sombre + touches en relief (une seule géométrie instanciée)
  const wz = -LD / 2 + .072;
  const well = new THREE.Mesh(shapeGeo(.274, .114, .006), new THREE.MeshStandardMaterial({ color: 0x12050a, roughness: .75 })); well.rotation.x = -Math.PI / 2; well.position.set(0, BH + .0002, wz); g.add(well);
  const rows = [{ h: .55, u: Array(14).fill(1) }, { h: 1, u: [...Array(13).fill(1), 1.4] }, { h: 1, u: [1.4, ...Array(12).fill(1), 1] }, { h: 1, u: [1.75, ...Array(11).fill(1), 1.65] }, { h: 1, u: [2.25, ...Array(10).fill(1), 2.15] }, { h: 1, u: [1, 1, 1, 1.25, 5.5, 1.25, 1, 1, 1] }];
  const P = .0186, kg = slab(.0162, .0162, .0035, .0016, .0006); kg.rotateX(-Math.PI / 2);
  const total = rows.reduce((a, r) => a + r.u.length, 0);
  const keys = new THREE.InstancedMesh(kg, new THREE.MeshPhysicalMaterial({ color: 0x0d0d10, roughness: .5, clearcoat: .15, envMap: env, envMapIntensity: .5 }), total);
  const mtx = new THREE.Matrix4(), q0 = new THREE.Quaternion(); let n = 0, zz = wz - .052;
  rows.forEach(r => {
    const sum = r.u.reduce((a, b) => a + b, 0); let x = -sum * P / 2; const rowH = P * (r.h === 1 ? 1 : .62);
    r.u.forEach(u => { const w = u * P; mtx.compose(V3(x + w / 2, BH + .0012, zz + rowH / 2), q0, V3((w - .0024) / .0162, 1, (rowH - .0024) / .0162)); keys.setMatrixAt(n++, mtx); x += w; });
    zz += rowH;
  });
  keys.castShadow = true; g.add(keys);
  const tp = new THREE.Mesh(slab(.128, .08, .006, .0008, .0003), new THREE.MeshPhysicalMaterial({ color: 0x6a1a2c, metalness: .5, roughness: .42, clearcoat: .15, clearcoatRoughness: .4, envMap: env, envMapIntensity: .9 })); tp.rotation.x = -Math.PI / 2; tp.position.set(0, BH + .0001, LD / 2 - .049); g.add(tp);
  const spk = dotsTex(); for (const sx of [-1, 1]) { const sp = new THREE.Mesh(new THREE.PlaneGeometry(.013, .108), new THREE.MeshStandardMaterial({ map: spk, roughness: .6 })); sp.rotation.x = -Math.PI / 2; sp.position.set(sx * .147, BH + .0003, wz); g.add(sp); }
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(.0055, .0055, LW - .07, 20), new THREE.MeshStandardMaterial({ color: 0x220810, metalness: .7, roughness: .35, envMap: env })); hinge.rotation.z = Math.PI / 2; hinge.position.set(0, BH, -LD / 2 + .004); g.add(hinge);
  // écran
  const lid = new THREE.Group(); lid.position.set(0, BH, -LD / 2 + .004); lid.rotation.x = -16 * DEG; g.add(lid);
  const LH = LD - .004;
  const lidB = new THREE.Mesh(slab(LW, LH, .012, .0055, .0018), alu); lidB.position.set(0, LH / 2, -.0028); lidB.castShadow = true; lid.add(lidB);
  const bez = new THREE.Mesh(shapeGeo(LW - .003, LH - .003, .011), new THREE.MeshPhysicalMaterial({ color: 0x040405, roughness: .1, clearcoat: 1, envMap: env })); bez.position.set(0, LH / 2, .0002); lid.add(bez);
  const DW = .296, DH = DW / 1.54, dy = LH / 2 + .003;
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(DW, DH), siteMat); disp.position.set(0, dy, .0006); lid.add(disp);
  const notch = new THREE.Mesh(shapeGeo(.03, .0085, .003), new THREE.MeshBasicMaterial({ color: 0x020202 })); notch.position.set(0, dy + DH / 2 - .0035, .0009); lid.add(notch);
  const cam = new THREE.Mesh(new THREE.CircleGeometry(.0013, 16), new THREE.MeshPhysicalMaterial({ color: 0x0a1a12, roughness: .1, clearcoat: 1 })); cam.position.set(0, dy + DH / 2 - .0035, .001); lid.add(cam);
  const refl = new THREE.Mesh(new THREE.PlaneGeometry(DW + .004, DH + .004), new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: .03, metalness: 0, clearcoat: 1, transparent: true, opacity: .14, envMap: env, envMapIntensity: 2.2, depthWrite: false })); refl.position.set(0, dy, .0012); lid.add(refl);
  const spill = new THREE.PointLight(0xc26a8a, .12, .5, 2); spill.position.set(0, .1, -.06); g.add(spill);
  const ls = new THREE.Mesh(new THREE.PlaneGeometry(LW * 1.35, LD * 1.5), new THREE.MeshBasicMaterial({ map: T(softRectTex(256, 256, 40, 26, 20)), transparent: true, opacity: .6, depthWrite: false })); ls.rotation.x = -Math.PI / 2; ls.position.y = .002; g.add(ls);
  g.userData.disp = disp;
  return g;
}
function shadeTex() { const { c, g } = mk(16, 256); const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.12, '#b98a5c'); gr.addColorStop(.7, '#7a5638'); gr.addColorStop(1, '#a87a50'); g.fillStyle = gr; g.fillRect(0, 0, 16, 256); return T(c); }
function washTex() { const { c, g } = mk(128, 256); const gr = g.createRadialGradient(64, 128, 0, 64, 128, 128); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.4, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.setTransform(.5, 0, 0, 1, 32, 0); g.fillStyle = gr; g.fillRect(0, 0, 128, 256); return T(c); }

/* ---------- la maison : couloir + chambre ---------- */
const PB = V3(.9, 1.25, 12.0), PS = 1.5; // cadre du "portail" dans le couloir (écran du téléphone × 1.5)
function buildHouse() {
  sceneB = new THREE.Scene(); sceneB.background = new THREE.Color(0x07040a);
  envB = makeEnv(1);
  const S = m => { m.castShadow = true; m.receiveShadow = true; sceneB.add(m); return m; };
  const far = m => { FAR.push(m); return m; };
  const boxM = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return S(m); };
  const plane = (w, h, mat, x, y, z, rx, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, 0); m.receiveShadow = true; sceneB.add(m); return m; };
  // matériaux
  const bordT = T(plasterTex(1024, 1024, [66, 14, 27], [118, 32, 50]), { repeat: [2, 1.2] });
  const bordB = T(plasterTex(512, 512, [100, 100, 100], [160, 160, 160]), { repeat: [4, 2.4], linear: true });
  const creamT = T(plasterTex(1024, 512, [172, 162, 152], [200, 190, 180]), { repeat: [3, 1] });
  const floorT = T(oakTex(1024, 1024, 8), { repeat: [2.2, 10.3], aniso: MAXANI });
  const oakT = T(oakTex(512, 1024, 0), { aniso: MAXANI });
  const weave = T(weaveTex(), { repeat: [60, 60], linear: true });
  const wallMat = new THREE.MeshStandardMaterial({ map: bordT, bumpMap: bordB, bumpScale: .0015, roughness: .93, envMap: envB, envMapIntensity: .25 });
  const creamWall = new THREE.MeshStandardMaterial({ map: creamT, bumpMap: bordB, bumpScale: .001, roughness: .9, envMap: envB, envMapIntensity: .25 });
  const creamPaint = new THREE.MeshStandardMaterial({ color: 0xece2d4, roughness: .45, envMap: envB, envMapIntensity: .5 });
  const moldMat = new THREE.MeshStandardMaterial({ color: 0x1b2754, roughness: .38, envMap: envB, envMapIntensity: .7 });
  const navyPaint = new THREE.MeshStandardMaterial({ map: T(wainscotTex(), { repeat: [7, 1] }), roughness: .42, envMap: envB, envMapIntensity: .6 });
  const oakMat = new THREE.MeshStandardMaterial({ map: oakT, roughness: .5, envMap: envB, envMapIntensity: .55 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a063, metalness: 1, roughness: .28, envMap: envB, envMapIntensity: 1.4 });
  const floorMat = new THREE.MeshStandardMaterial({ map: floorT, roughness: .42, envMap: envB, envMapIntensity: .55 });
  // sol (coupé en deux pour le portail)
  const fl1 = plane(4.4, 13.75, floorMat, 0, 0, 5.325, -Math.PI / 2); fl1.material.map.repeat.set(2.2, 6.9);
  const fl2 = far(plane(1.3, 6.85, floorMat, .9, 0, 15.625, -Math.PI / 2)); { const uv = fl2.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * .65 / 2.2, uv.getY(i) * 3.4 / 6.9); }
  // ---------- chambre
  plane(4.4, 2.6, wallMat, 0, 1.3, -1.55);
  plane(4.75, 2.6, wallMat, 2.2, 1.3, .825, 0, -Math.PI / 2);
  plane(4.4, 4.75, creamPaint, 0, 2.6, .825, Math.PI / 2);
  // mur gauche avec fenêtre (laisse passer le soleil du soir)
  for (const [len, cz, h, cy] of [[4.75, .825, .85, .425], [4.75, .825, .45, 2.375], [.8, -1.15, 1.3, 1.5], [2.35, 2.025, 1.3, 1.5]]) boxM(.1, h, len, wallMat, -2.25, cy, cz);
  // mur avant avec porte (bordeaux côté chambre, crème côté couloir)
  const fw = [creamWall, creamWall, creamWall, creamWall, creamWall, wallMat];
  for (const [w, cx, h, cy] of [[2.65, -.875, 2.6, 1.3], [.85, 1.775, 2.6, 1.3], [.9, .9, .5, 2.35]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, .1), fw); m.position.set(cx, cy, 3.25); S(m); }
  // fenêtre : ciel du soir, encadrement, vitre
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.4), new THREE.MeshBasicMaterial({ map: T(skyTex()), color: new THREE.Color(1.1, 1.1, 1.1) })); sky.position.set(-3.1, 1.55, .05); sky.rotation.y = Math.PI / 2; sceneB.add(sky);
  for (const [w, h, d, x, y, z] of [[.24, .05, 1.72, -2.16, .83, .05], [.12, .06, 1.66, -2.2, 2.16, .05], [.12, 1.36, .06, -2.2, 1.5, -.76], [.12, 1.36, .06, -2.2, 1.5, .86], [.05, 1.3, .04, -2.2, 1.5, .05], [.05, .04, 1.6, -2.2, 1.6, .05]]) boxM(w, h, d, creamPaint, x, y, z);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.3), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .04, transparent: true, opacity: .12, envMap: envB, envMapIntensity: 1.5, depthWrite: false })); glass.position.set(-2.21, 1.5, .05); glass.rotation.y = Math.PI / 2; sceneB.add(glass);
  // rideaux en lin
  const linen = new THREE.MeshStandardMaterial({ color: 0xe9ddca, roughness: .95, bumpMap: weave, bumpScale: .0006, side: THREE.DoubleSide, envMap: envB, envMapIntensity: .2 });
  for (const [z0, z1] of [[-1.3, -.62], [.72, 1.42]]) {
    const cg = new THREE.PlaneGeometry(z1 - z0, 2.3, 60, 4); const p = cg.attributes.position;
    for (let i = 0; i < p.count; i++) { const u = p.getX(i); p.setZ(i, Math.sin(u * 42) * .028 + Math.sin(u * 17 + 1) * .015); }
    cg.computeVertexNormals(); const cm = new THREE.Mesh(cg, linen); cm.rotation.y = Math.PI / 2; cm.position.set(-2.1, 1.33, (z0 + z1) / 2); S(cm);
  }
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, 2.9, 12), brass); rod.rotation.x = Math.PI / 2; rod.position.set(-2.1, 2.48, .05); sceneB.add(rod);
  // plinthes
  for (const [w, x, z, ry] of [[4.4, 0, -1.54, 0], [4.75, 2.19, .825, -Math.PI / 2], [4.75, -2.19, .825, Math.PI / 2]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, .09, .015), creamPaint); b.position.set(x, .045, z); b.rotation.y = ry; sceneB.add(b); }
  // tapis
  const rug = plane(2.7, 3.2, new THREE.MeshStandardMaterial({ map: T(rugTex(), { aniso: MAXANI }), roughness: .97, bumpMap: weave, bumpScale: .001, envMap: envB, envMapIntensity: .15 }), 0, .006, -.15, -Math.PI / 2);
  // lit (cadre en chêne clair)
  const frame = new THREE.Mesh(slab(1.72, 2.12, .05, .26, .02), oakMat); frame.rotation.x = -Math.PI / 2; frame.position.set(0, .25, -.45); S(frame);
  for (const [x, z] of [[-.8, -1.45], [.8, -1.45], [-.8, .55], [.8, .55]]) boxM(.07, .14, .07, oakMat, x, .07, z);
  const head = new THREE.Mesh(slab(1.8, .86, .03, .06, .012), oakMat); head.position.set(0, .8, -1.5); S(head);
  for (let i = 0; i < 9; i++) { const sl = new THREE.Mesh(new THREE.BoxGeometry(.012, .78, .012), new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: .7 })); sl.position.set(-.8 + i * .2, .8, -1.465); sceneB.add(sl); }
  const matt = new THREE.Mesh(slab(1.56, 2.0, .06, .2, .05), new THREE.MeshStandardMaterial({ color: 0xf1ebe3, roughness: .9 })); matt.rotation.x = -Math.PI / 2; matt.position.set(0, .48, -.45); S(matt);
  // couette marine matelassée (carreaux de 25 cm, coutures, ourlet épais), drap crème replié, plaid bordeaux en maille
  const DUV = { w: 2.2, z0: -1.3, z1: .95, top: .625, half: .78, foot: .57, fold: -.9, dip: [.08, -.3], sx: 220, sz: 200, quilt: .25, qh: .016, seed: 0 };
  const qt = fabricTile([18, 28, 70], { seam: true, repeat: [DUV.w / .25, (DUV.z1 - DUV.z0) / .25], seed: 4 });
  const duvetMat = new THREE.MeshPhysicalMaterial({ map: qt.map, normalMap: qt.normal, normalScale: new THREE.Vector2(.9, .9), roughness: .9, envMap: envB, envMapIntensity: .3, side: THREE.DoubleSide });
  const duvet = new THREE.Mesh(drapeGeo(DUV), duvetMat); S(duvet);
  const hem = new THREE.Mesh(hemGeo(DUV, .022), new THREE.MeshPhysicalMaterial({ color: 0x0f1a40, roughness: .9, envMap: envB, envMapIntensity: .3 })); S(hem);
  const SHT = { w: 2.18, z0: -1.0, z1: -.84, top: .655, half: .785, sx: 160, sz: 20, puff: .03, wr: .7, seed: 2 };
  const lin = fabricTile([240, 232, 220], { repeat: [12, 1], thread: 2.6, strength: 1.6, seed: 7 });
  const sheet = new THREE.Mesh(drapeGeo(SHT), new THREE.MeshStandardMaterial({ map: lin.map, normalMap: lin.normal, normalScale: new THREE.Vector2(.7, .7), roughness: .88, side: THREE.DoubleSide, envMap: envB, envMapIntensity: .25 })); S(sheet);
  const sheetHem = new THREE.Mesh(hemGeo(SHT, .012), sheet.material); S(sheetHem);
  const knit = T(knitTex(), { repeat: [10, 3] });
  const THR = { w: 2.3, z0: .12, z1: .56, top: .69, half: .8, hang: .34, sx: 160, sz: 50, puff: .015, wr: 1.3, seed: 5 };
  const knitMat = new THREE.MeshStandardMaterial({ map: knit, bumpMap: knit, bumpScale: .0025, roughness: .95, side: THREE.DoubleSide, envMap: envB, envMapIntensity: .2 });
  const thr = new THREE.Mesh(drapeGeo(THR), knitMat); S(thr);
  S(new THREE.Mesh(hemGeo(THR, .014), knitMat));
  // coussins (lin) avec passepoil
  const pil = (sx, sy, sz, col, pos, rot, seed) => {
    const geo = pillowGeo(sx, sy, sz, seed);
    const tile = fabricTile(col, { repeat: [5, 5], thread: 2.8, strength: 1.4, seed });
    const mat = new THREE.MeshStandardMaterial({ map: tile.map, normalMap: tile.normal, normalScale: new THREE.Vector2(.8, .8), roughness: .93, envMap: envB, envMapIntensity: .25 });
    const m = new THREE.Mesh(geo.body, mat); m.position.set(...pos); m.rotation.set(...rot); S(m);
    const pp = new THREE.Mesh(geo.pipe, new THREE.MeshStandardMaterial({ color: new THREE.Color(col[0] / 255 * .82, col[1] / 255 * .82, col[2] / 255 * .82).convertSRGBToLinear(), roughness: .85 })); m.add(pp); pp.castShadow = true;
    return m;
  };
  pil(.36, .11, .23, [244, 230, 210], [-.4, .76, -1.3], [-1.05, .04, .03], 1);
  pil(.36, .11, .23, [246, 234, 214], [.4, .76, -1.29], [-1.07, -.05, -.03], 2);
  pil(.24, .085, .17, [158, 42, 67], [.16, .76, -1.1], [-.88, .18, .1], 3);
  pil(.22, .08, .16, [230, 212, 192], [-.2, .75, -1.09], [-.84, -.22, -.08], 4);
  pil(.18, .07, .13, [22, 34, 77], [-.02, .74, -1.0], [-.8, .05, .02], 5);
  // ombres douces entre coussins, tête de lit et couette
  { const aoT = T(softRectTex(256, 256, 34, 40, 40));
    const aoM = (w, h, x, y, z, rx, op) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: aoT, transparent: true, opacity: op, depthWrite: false })); m.position.set(x, y, z); m.rotation.x = rx; sceneB.add(m); };
    aoM(1.7, .5, 0, .78, -1.462, 0, .5); aoM(1.6, .55, 0, .69, -1.12, -Math.PI / 2, .4); }
  // tables de chevet, lampes, déco
  const lampShade = new THREE.MeshStandardMaterial({ color: 0xf3e3cc, emissive: new THREE.Color(1.4, .8, .4), emissiveMap: shadeTex(), roughness: .9, side: THREE.DoubleSide });
  for (const sx of [-1, 1]) {
    const ns = new THREE.Mesh(slab(.48, .4, .02, .5, .01), oakMat); ns.rotation.x = -Math.PI / 2; ns.position.set(sx * 1.22, .25, -1.25); S(ns);
    const dr = new THREE.Mesh(new THREE.BoxGeometry(.4, .004, .004), new THREE.MeshBasicMaterial({ color: 0x3a2618 })); dr.position.set(sx * 1.22, .33, -1.049); sceneB.add(dr);
    const kn = new THREE.Mesh(new THREE.SphereGeometry(.012, 12, 8), brass); kn.position.set(sx * 1.22, .4, -1.045); sceneB.add(kn);
    const lb = new THREE.Mesh(new THREE.CylinderGeometry(.055, .085, .28, 32), new THREE.MeshPhysicalMaterial({ color: sx < 0 ? 0x16224d : 0xe9dccd, roughness: .25, clearcoat: .8, envMap: envB })); lb.position.set(sx * 1.22, .64, -1.32); S(lb);
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(.12, .18, .22, 40, 1, true), lampShade); sh.position.set(sx * 1.22, .89, -1.32); sceneB.add(sh);
    const l = new THREE.PointLight(0xffa860, sx > 0 ? 1.15 : .85, 5, 2); l.position.set(sx * 1.22, .86, -1.32); sceneB.add(l);
  }
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(.04, .036, .09, 32), new THREE.MeshPhysicalMaterial({ color: 0xf2e9dc, roughness: .2, clearcoat: 1, envMap: envB })); mug.position.set(1.08, .545, -1.16); S(mug);
  const mh = new THREE.Mesh(new THREE.TorusGeometry(.024, .007, 10, 24), mug.material); mh.position.set(1.123, .55, -1.16); mh.rotation.y = Math.PI / 2; sceneB.add(mh);
  [[0x16224d, .0], [0x9e2a43, .032], [0xe9dccd, .062]].forEach(([c, y], k) => boxM(.22 - k * .02, .03, .15, new THREE.MeshStandardMaterial({ color: c, roughness: .7 }), -1.12 + k * .01, .515 + y, -1.18 + k * .01));
  // plante
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(.16, .12, .34, 32), new THREE.MeshPhysicalMaterial({ color: 0x9e2a43, roughness: .35, clearcoat: .6, envMap: envB })); pot.position.set(-1.78, .17, 1.45); S(pot);
  const leafM = new THREE.MeshStandardMaterial({ map: T(leafTex()), transparent: true, alphaTest: .5, side: THREE.DoubleSide, roughness: .6 });
  const R = rng(21); for (let i = 0; i < 9; i++) { const lf = new THREE.Mesh(new THREE.PlaneGeometry(.38, .38), leafM); const a = i / 9 * Math.PI * 2; lf.position.set(-1.78 + Math.cos(a) * .14, .55 + R() * .55, 1.45 + Math.sin(a) * .14); lf.rotation.set(-.4 - R() * .5, a + 1.2, R() * .6); lf.castShadow = true; sceneB.add(lf); }
  // cadres
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x15100e, roughness: .4, envMap: envB });
  const mat = new THREE.MeshStandardMaterial({ color: 0xf1e8dc, roughness: .9 });
  const hang = (tex, w, h, x, y, z, ry, fr) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry || 0; sceneB.add(g); if (fr) fr.push(g);
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, .03), frameMat); b.castShadow = true; g.add(b);
    const m1 = new THREE.Mesh(new THREE.PlaneGeometry(w - .05, h - .05), mat); m1.position.z = .0155; g.add(m1);
    const a = new THREE.Mesh(new THREE.PlaneGeometry(w * .72, w * .72 * 1.5), new THREE.MeshStandardMaterial({ map: tex, roughness: .55, envMap: envB, envMapIntensity: .3 })); a.position.z = .016; g.add(a);
    return g;
  };
  const big = T(bigPoster());
  hang(big, .64, .9, -.05, 1.75, -1.53);
  // MacBook bordeaux (modèle détaillé)
  laptop = buildMac(envB); laptop.position.set(.08, .652, -.3); laptop.rotation.y = -.32; sceneB.add(laptop);
  // ombres de contact (occlusion)
  const ao = (w, d, x, y, z, op) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: T(softRectTex(256, 256, 30, 40, 30)), transparent: true, opacity: op, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); sceneB.add(m); return m; };
  ao(2.05, 2.5, 0, .009, -.45, .6); ao(.62, .55, 1.22, .009, -1.25, .55); ao(.62, .55, -1.22, .009, -1.25, .55); ao(.45, .45, -1.78, .009, 1.45, .5);
  const vg = T(vGradTex(0, .55));
  const strip = (w, x, z, ry, y = .2, h = .4, op = 1) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: vg, transparent: true, depthWrite: false, opacity: op })); m.position.set(x, y, z); m.rotation.y = ry; sceneB.add(m); return m; };
  strip(4.4, 0, -1.53, 0); strip(4.75, 2.18, .825, -Math.PI / 2); strip(4.75, -2.18, .825, Math.PI / 2);
  // ---------- couloir (marine + crème, tapis bordeaux, appliques laiton)
  const seg = [[3.3, 12.2, false], [12.2, 19, true]];
  for (const [z0, z1, isFar] of seg) {
    const L = z1 - z0, cz = (z0 + z1) / 2; const reg = m => isFar ? far(m) : m;
    for (const [x, ry] of [[.3, Math.PI / 2], [1.5, -Math.PI / 2]]) {
      const w = reg(plane(L, 2.5, creamWall, x, 1.25, cz, 0, ry));
      const wc = reg(new THREE.Mesh(new THREE.BoxGeometry(L, 1.0, .02), navyPaint)); wc.rotation.y = ry; wc.position.set(x + (x < 1 ? .01 : -.01), .5, cz); wc.receiveShadow = true; sceneB.add(wc);
      const rail = reg(new THREE.Mesh(new THREE.BoxGeometry(L, .05, .035), creamPaint)); rail.rotation.y = ry; rail.position.set(x + (x < 1 ? .018 : -.018), 1.0, cz); sceneB.add(rail);
      const bb = reg(new THREE.Mesh(new THREE.BoxGeometry(L, .1, .03), creamPaint)); bb.rotation.y = ry; bb.position.set(x + (x < 1 ? .02 : -.02), .05, cz); sceneB.add(bb);
      reg(strip(L, x + (x < 1 ? .035 : -.035), cz, ry, .2, .4, .8));
    }
    reg(plane(1.2, L, creamPaint, .9, 2.5, cz, Math.PI / 2));
    const rn = reg(plane(.72, L - .4, new THREE.MeshStandardMaterial({ map: T(runnerTex(), { repeat: [1, (L - .4) / 1.4] }), roughness: .96, bumpMap: weave, bumpScale: .001, envMap: envB, envMapIntensity: .15 }), .9, .006, cz, -Math.PI / 2));
    for (let z = z0 + 1; z < z1; z += 2) {
      const sp = reg(new THREE.Mesh(new THREE.CircleGeometry(.05, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.1, .78, .5) }))); sp.rotation.x = Math.PI / 2; sp.position.set(.9, 2.495, z); sceneB.add(sp);
      const tr = reg(new THREE.Mesh(new THREE.TorusGeometry(.06, .009, 10, 32), creamPaint)); tr.rotation.x = Math.PI / 2; tr.position.set(.9, 2.494, z); sceneB.add(tr);
    }
    for (const [x, sd] of [[.3, 1], [1.5, -1]]) {
      const cor = reg(new THREE.Mesh(new THREE.BoxGeometry(.07, .08, L), creamPaint)); cor.position.set(x + sd * .035, 2.46, cz); cor.castShadow = false; sceneB.add(cor);
      const nf = Math.floor((L - .3) / 1.05), mold = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), moldMat, nf * 4); const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(); let c = 0;
      for (let f = 0; f < nf; f++) { const zc = z0 + .25 + f * 1.05 + .45; const xs = x + sd * .028;
        for (const [py, pz, sy, szz] of [[.82, zc, .022, .82], [.2, zc, .022, .82], [.51, zc - .4, .64, .022], [.51, zc + .4, .64, .022]]) { m4.compose(V3(xs, py, pz), qq, V3(.016, sy, szz)); mold.setMatrixAt(c++, m4); } }
      reg(mold); sceneB.add(mold);
    }
  }
  far(plane(1.2, 2.5, creamWall, .9, 1.25, 19, 0, Math.PI));
  // portes marine
  const dTex = T(doorTex());
  const door = (x, z, side, isFar) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2; sceneB.add(g); if (isFar) FAR.push(g);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(.82, 2.02, .04), [navyPaint, navyPaint, navyPaint, navyPaint, new THREE.MeshStandardMaterial({ map: dTex, roughness: .4, envMap: envB, envMapIntensity: .6 }), navyPaint]); leaf.position.set(0, 1.01, .03); g.add(leaf);
    for (const [w, h, px, py] of [[.07, 2.12, -.45, 1.06], [.07, 2.12, .45, 1.06], [.97, .07, 0, 2.1]]) { const c = new THREE.Mesh(new THREE.BoxGeometry(w, h, .05), creamPaint); c.position.set(px, py, .03); g.add(c); }
    for (const [py, ph] of [[1.5, .74], [.58, .8]]) { const pnl = new THREE.Mesh(slab(.56, ph, .01, .014, .005), navyPaint); pnl.position.set(0, py, .055); g.add(pnl); }
    for (const py of [.25, 1.0, 1.75]) { const hg = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .09, 12), brass); hg.position.set(-.41, py, .045); g.add(hg); }
    const k = new THREE.Mesh(new THREE.SphereGeometry(.028, 16, 12), brass); k.position.set(.32, 1.0, .07); g.add(k);
    const kp = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .01, 16), brass); kp.rotation.x = Math.PI / 2; kp.position.set(.32, 1.0, .052); g.add(kp);
  };
  door(.3, 6.2, 1); door(1.5, 9.4, -1); door(.3, 14.9, 1, true); door(1.5, 16.8, -1, true);
  // porte de la chambre, ouverte
  const bdoor = new THREE.Group(); bdoor.position.set(1.33, 0, 3.18); bdoor.rotation.y = -.15; sceneB.add(bdoor);
  const bl = new THREE.Mesh(new THREE.BoxGeometry(.04, 2.02, .82), navyPaint); bl.position.set(0, 1.01, -.41); bl.castShadow = true; bdoor.add(bl);
  for (const [w, h, px, py] of [[.07, 2.12, .41, 1.06], [.07, 2.12, 1.39, 1.06], [1.05, .07, .9, 2.13]]) { boxM(w, h, .04, creamPaint, px, py, 3.18); boxM(w, h, .04, creamPaint, px, py, 3.32); }
  // tableaux MBTK dans le couloir
  const fr = [];
  hang(T(tradePoster(2)), .5, .72, .33, 1.55, 8.3, Math.PI / 2);
  hang(big, .56, .8, 1.47, 1.55, 5.4, -Math.PI / 2);
  hang(T(tradePoster(3)), .5, .72, 1.47, 1.55, 11.4, -Math.PI / 2);
  hang(T(tradePoster(1)), .5, .72, .33, 1.55, 10.6, Math.PI / 2);
  hang(T(tradePoster(5)), .5, .72, .33, 1.55, 13.0, Math.PI / 2, fr);
  hang(T(tradePoster(4)), .5, .72, 1.47, 1.55, 14.2, -Math.PI / 2, fr);
  fr.forEach(f => FAR.push(f));
  // console en chêne avec vase et livres
  { const cz = 7.5, cx = .46;
    boxM(.28, .03, .95, oakMat, cx, .8, cz);
    for (const [dx, dz] of [[-.1, -.42], [.1, -.42], [-.1, .42], [.1, .42]]) boxM(.025, .8, .025, oakMat, cx + dx, .4, cz + dz);
    const vase = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [.06, 0], [.075, .08], [.05, .2], [.035, .26], [.045, .3]].map(([a, b]) => new THREE.Vector2(a, b)), 40), new THREE.MeshPhysicalMaterial({ color: 0x9e2a43, roughness: .25, clearcoat: .8, envMap: envB })); vase.position.set(cx, .815, cz - .2); S(vase);
    for (let k = 0; k < 5; k++) { const st = new THREE.Mesh(new THREE.CylinderGeometry(.003, .003, .5, 6), new THREE.MeshStandardMaterial({ color: 0x6b5233 })); st.position.set(cx + (k - 2) * .02, 1.32, cz - .2 + Math.sin(k) * .03); st.rotation.set(Math.sin(k * 2) * .25, 0, (k - 2) * .12); sceneB.add(st); }
    [[0x16224d, 0], [0xe9dccd, .03], [0x9e2a43, .055]].forEach(([c, y], k) => boxM(.2 - k * .02, .028, .15, new THREE.MeshStandardMaterial({ color: c, roughness: .7 }), cx, .83 + y, cz + .2));
  }
  // appliques
  const wash = washTex();
  const globe = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, .95, .55) });
  for (const [x, z] of [[.31, 4.6], [1.49, 7.4], [.31, 9.6], [1.49, 12.6], [.31, 15.9], [1.49, 18.0]]) {
    const g = new THREE.Group(); g.position.set(x, 1.85, z); sceneB.add(g); if (z > 12.2) FAR.push(g);
    const pl = new THREE.Mesh(new THREE.CylinderGeometry(.055, .055, .015, 24), brass); pl.rotation.z = Math.PI / 2; g.add(pl);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .12, 8), brass); arm.rotation.z = Math.PI / 2; arm.position.x = x < 1 ? .06 : -.06; g.add(arm);
    const gl = new THREE.Mesh(new THREE.SphereGeometry(.06, 24, 16), globe); gl.position.set(x < 1 ? .13 : -.13, .03, 0); g.add(gl);
    const ws = new THREE.Mesh(new THREE.PlaneGeometry(.75, 1.5), new THREE.MeshBasicMaterial({ map: wash, color: new THREE.Color(.45, .3, .17), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); ws.rotation.y = x < 1 ? Math.PI / 2 : -Math.PI / 2; ws.position.set(x < 1 ? .007 : -.007, .05, 0); g.add(ws);
  }
  for (const z of [4.9, 8.7, 12.5]) { const l = new THREE.PointLight(0xffb070, .5, 5.5, 2); l.position.set(.9, 2.05, z); sceneB.add(l); }
  // lumières de la chambre
  sceneB.add(new THREE.HemisphereLight(0xffd2a8, 0x1a0c12, .3));
  const sun = new THREE.DirectionalLight(0xffb070, 2.6); sun.position.set(-6.2, 2.7, .6); sun.target.position.set(0, .6, -.3); sceneB.add(sun, sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(SHMAP, SHMAP); const sc = sun.shadow.camera; sc.left = -3.2; sc.right = 3.2; sc.top = 3.2; sc.bottom = -3.2; sc.near = .5; sc.far = 14; sun.shadow.bias = -.0005; sun.shadow.normalBias = .015;
  const fill = new THREE.PointLight(0x6a80d8, .3, 4.5, 2); fill.position.set(-1.6, 1.6, .1); sceneB.add(fill);
  dustB = makeDust(80, [-2.1, .5, -.9, .6, 2.3, 1.0], 8, 0x7a5a3c); sceneB.add(dustB);
}
