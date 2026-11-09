/* ---- pictogrammes téléphone (décrocher / raccrocher), tracés vectoriels nets ---- */
const ICON_CALL = new Path2D('M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z');
const ICON_END = new Path2D('M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z');
function drawIcon(g, path, cx, cy, size, col) { g.save(); g.translate(cx - size / 2, cy - size / 2); g.scale(size / 24, size / 24); g.fillStyle = col; g.fill(path); g.restore(); }
/* ---- appel entrant façon iPhone : « faire glisser pour répondre » (curseur et texte animés dans le shader) ---- */
const SLY = 1860, SLX0 = 90, SLW = 900, SLH = 180;
function pageIncoming() {
  const { c, g } = mk(Math.round(SCW * PXS), Math.round(SCH * PXS)); g.scale(PXS, PXS); callBg(g, false); statusBar(g, '#F5EAE0');
  txt(g, 'appel mobile…', 540, 340, F(500, 42, 's'), 'rgba(245,234,224,.72)', 'center');
  txt(g, 'MBTK Design', 540, 452, F(700, 90, 'u'), '#F5EAE0', 'center');
  g.save(); g.strokeStyle = '#E8B27A'; g.lineWidth = 3; for (let i = 1; i <= 3; i++) { g.beginPath(); g.arc(540, 900, 250 + i * 34, 0, Math.PI * 2); g.globalAlpha = .28 / i; g.stroke(); } g.restore();
  creamLogoCircle(g, 540, 900, 250);
  // actions secondaires (rappel / message), au-dessus du curseur comme sur iPhone
  const by = 1545;
  [[250, 'Me rappeler'], [830, 'Message']].forEach(([x, l]) => { g.fillStyle = 'rgba(245,234,224,.16)'; g.beginPath(); g.arc(x, by, 62, 0, 7); g.fill(); txt(g, l, x, by + 112, F(500, 34, 's'), 'rgba(245,234,224,.8)', 'center'); });
  g.strokeStyle = '#F5EAE0'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.arc(250, by, 25, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(250, by - 13); g.lineTo(250, by); g.lineTo(261, by + 8); g.stroke();
  g.fillStyle = '#F5EAE0'; rr(g, 800, by - 22, 60, 42, 12); g.fill(); g.beginPath(); g.moveTo(812, by + 16); g.lineTo(806, by + 32); g.lineTo(826, by + 18); g.fill();
  // rail du curseur : verre fumé, léger reflet
  g.save(); g.fillStyle = 'rgba(16,5,14,.42)'; rr(g, SLX0, SLY - SLH / 2, SLW, SLH, SLH / 2); g.fill();
  g.fillStyle = lingrad(g, 0, SLY - SLH / 2, 0, SLY + SLH / 2, [[0, 'rgba(255,255,255,.10)'], [.5, 'rgba(255,255,255,.02)'], [1, 'rgba(255,255,255,.06)']]); rr(g, SLX0, SLY - SLH / 2, SLW, SLH, SLH / 2); g.fill();
  g.strokeStyle = 'rgba(245,234,224,.20)'; g.lineWidth = 2; rr(g, SLX0 + 1, SLY - SLH / 2 + 1, SLW - 2, SLH - 2, SLH / 2 - 1); g.stroke(); g.restore();
  homeBar(g, 'rgba(245,234,224,.85)');
  return c;
}
function knobTex() {
  const s = 2, { c, g } = mk(192 * s, 192 * s); g.scale(s, s);
  g.save(); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 16; g.shadowOffsetY = 4; g.fillStyle = '#fff'; g.beginPath(); g.arc(96, 96, 74, 0, 7); g.fill(); g.restore();
  g.fillStyle = lingrad(g, 0, 22, 0, 170, [[0, '#ffffff'], [1, '#ece6e2']]); g.beginPath(); g.arc(96, 96, 74, 0, 7); g.fill();
  drawIcon(g, ICON_CALL, 96, 96, 92, '#34C759');
  return c;
}
function slideTextTex() {
  const s = 2, { c, g } = mk(720 * s, 120 * s); g.scale(s, s);
  txt(g, 'faire glisser pour répondre', 360, 76, F(500, 44, 's'), '#fff', 'center');
  return c;
}
/* ---- pages construites en "calques" : fond + éléments qui peuvent sortir de l'écran en 3D ---- */
const CALL_BTNS = ['silence', 'clavier', 'haut-parleur', 'ajouter', 'vidéo', 'contacts'].map((l, i) => ({ l, i, x: [250, 540, 830][i % 3], y: i < 3 ? 1290 : 1560 }));
function drawCallButton(g, b) {
  const { x, y, i, l } = b;
  g.fillStyle = 'rgba(245,234,224,.16)'; g.beginPath(); g.arc(x, y, 98, 0, 7); g.fill();
  g.strokeStyle = 'rgba(245,234,224,.22)'; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#F5EAE0'; g.strokeStyle = '#F5EAE0'; g.lineWidth = 7; g.lineCap = 'round';
  if (i === 0) { rr(g, x - 16, y - 40, 32, 56, 16); g.fill(); g.beginPath(); g.arc(x, y + 2, 30, 0, Math.PI); g.stroke(); g.beginPath(); g.moveTo(x, y + 32); g.lineTo(x, y + 44); g.stroke(); }
  if (i === 1) { for (let a = 0; a < 3; a++) for (let c = 0; c < 3; c++) { g.beginPath(); g.arc(x - 26 + a * 26, y - 26 + c * 26, 8, 0, 7); g.fill(); } }
  if (i === 2) { g.beginPath(); g.moveTo(x - 34, y - 14); g.lineTo(x - 16, y - 14); g.lineTo(x + 6, y - 34); g.lineTo(x + 6, y + 34); g.lineTo(x - 16, y + 14); g.lineTo(x - 34, y + 14); g.closePath(); g.fill(); g.beginPath(); g.arc(x + 12, y, 24, -.8, .8); g.stroke(); }
  if (i === 3) { g.lineWidth = 9; g.beginPath(); g.moveTo(x - 28, y); g.lineTo(x + 28, y); g.moveTo(x, y - 28); g.lineTo(x, y + 28); g.stroke(); }
  if (i === 4) { rr(g, x - 38, y - 22, 52, 44, 10); g.fill(); g.beginPath(); g.moveTo(x + 18, y - 4); g.lineTo(x + 38, y - 18); g.lineTo(x + 38, y + 18); g.lineTo(x + 18, y + 4); g.fill(); }
  if (i === 5) { g.beginPath(); g.arc(x, y - 12, 16, 0, 7); g.fill(); g.beginPath(); g.arc(x, y + 34, 32, Math.PI, 0); g.fill(); }
  txt(g, l, x, y + 150, F(500, 34, 's'), 'rgba(245,234,224,.9)', 'center');
}
const PAGES = {};
function defPages() {
  PAGES.call = {
    base: g => { callBg(g, true); statusBar(g, '#F5EAE0'); g.fillStyle = '#34C759'; rr(g, 62, 74, 140, 58, 29); g.fill(); txt(g, '17:42', 132, 114, F(600, 42, 's'), '#fff', 'center'); homeBar(g, 'rgba(245,234,224,.85)'); },
    heroes: [
      { k: 'name', box: [90, 370, 900, 112], h: .11, d: .1, draw: g => txt(g, 'MBTK Design', 540, 452, F(700, 90, 'u'), '#F5EAE0', 'center') },
      { k: 'avatar', box: [320, 640, 440, 440], h: .21, d: 0, draw: g => creamLogoCircle(g, 540, 860, 190) },
      ...CALL_BTNS.map((b, i) => ({ k: 'b' + i, box: [b.x - 108, b.y - 108, 216, 300], h: .045 + (i % 3 === 1 ? .03 : 0) + (i < 3 ? .02 : 0), d: .2 + i * .05, draw: g => drawCallButton(g, b) })),
      { k: 'end', box: [430, 1770, 220, 220], h: .14, d: .45, draw: g => { g.fillStyle = '#EB4D3D'; g.beginPath(); g.arc(540, 1880, 100, 0, 7); g.fill(); drawIcon(g, ICON_END, 540, 1882, 128, '#fff'); } }
    ]
  };
  PAGES.tt = {
    base: g => {
      g.fillStyle = '#121212'; g.fillRect(0, 0, SCW, SCH); statusBar(g, '#fff');
      g.strokeStyle = '#fff'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(84, 236); g.lineTo(60, 212); g.lineTo(84, 188); g.stroke();
      txt(g, 'MBTK Design', 540, 230, F(700, 46, 's'), '#fff', 'center');
      g.beginPath(); g.arc(940, 210, 22, 0, 7); g.stroke(); g.beginPath(); g.moveTo(1000, 196); g.lineTo(1030, 196); g.moveTo(1000, 212); g.lineTo(1030, 212); g.moveTo(1000, 228); g.lineTo(1030, 228); g.stroke();
      g.fillStyle = '#fff'; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) { rr(g, 160 + a * 16, 1490 + b * 16, 12, 12, 2); g.fill(); }
      g.fillRect(90, 1552, 300, 5); g.fillStyle = '#444'; g.fillRect(390, 1552, 600, 2);
      g.strokeStyle = '#888'; g.lineWidth = 5; rr(g, 520, 1500, 40, 34, 6); g.stroke(); heart(g, 880, 1520, 38, '#888');
      for (let i = 3; i < 9; i++) { const col = i % 3, row = Math.floor(i / 3); thumb(g, col * 361, 1562 + row * 482, 358, 478, i); }
    },
    heroes: [
      { k: 'avatar', box: [360, 520, 360, 360], h: .22, d: 0, draw: g => {
        g.save(); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 30; g.beginPath(); g.arc(540, 700, 160, 0, 7); g.fillStyle = '#F5EAE0'; g.fill(); g.restore(); drawLogo(g, 540, 704, 240);
        g.fillStyle = '#20D5EC'; g.beginPath(); g.arc(650, 820, 34, 0, 7); g.fill(); g.strokeStyle = '#121212'; g.lineWidth = 8; g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 7; g.beginPath(); g.moveTo(636, 820); g.lineTo(664, 820); g.moveTo(650, 806); g.lineTo(650, 834); g.stroke(); } },
      { k: 'handle', box: [240, 888, 600, 76], h: .12, d: .12, draw: g => txt(g, '@mbtkdesign', 540, 940, F(700, 50, 's'), '#fff', 'center') },
      { k: 'follow', box: [150, 1000, 600, 124], h: .27, d: .2, draw: g => { g.fillStyle = '#FE2C55'; rr(g, 150, 1000, 600, 124, 18); g.fill(); txt(g, "S'abonner", 450, 1080, F(700, 54, 's'), '#fff', 'center'); } },
      { k: 'msg', box: [770, 1000, 160, 124], h: .13, d: .26, draw: g => { g.fillStyle = '#2b2b2b'; rr(g, 770, 1000, 160, 124, 18); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 6; rr(g, 822, 1040, 56, 42, 8); g.stroke(); } },
      { k: 'bio', box: [90, 1168, 900, 282], h: .07, d: .3, draw: g => { BIO.forEach((l, i) => txt(g, l, 540, 1210 + i * 52, F(500, 38, 's'), '#e8e8e8', 'center')); txt(g, '🔗 ' + CFG.site, 540, 1430, F(700, 38, 's'), '#fff', 'center'); } },
      ...[0, 1, 2].map(i => ({ k: 'th' + i, box: [i * 361, 1562, 358, 478], h: .05 + (i === 1 ? .05 : 0), d: .35 + i * .05, draw: g => thumb(g, i * 361, 1562, 358, 478, i) }))
    ]
  };
  PAGES.ig = {
    base: g => {
      g.fillStyle = '#000'; g.fillRect(0, 0, SCW, SCH); statusBar(g, '#fff');
      txt(g, 'mbtkdesign', 60, 238, F(700, 54, 's'), '#fff'); g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); g.moveTo(352, 210); g.lineTo(366, 224); g.lineTo(380, 210); g.stroke();
      rr(g, 846, 186, 52, 52, 14); g.stroke(); g.beginPath(); g.moveTo(872, 198); g.lineTo(872, 226); g.moveTo(858, 212); g.lineTo(886, 212); g.stroke();
      g.beginPath(); g.moveTo(950, 196); g.lineTo(1020, 196); g.moveTo(950, 214); g.lineTo(1020, 214); g.moveTo(950, 232); g.lineTo(1020, 232); g.stroke();
      g.fillStyle = '#fff'; g.fillRect(0, 1640, 360, 4); g.fillStyle = '#333'; g.fillRect(360, 1641, 720, 2);
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) { g.fillStyle = '#fff'; rr(g, 150 + a * 18, 1574 + b * 18, 13, 13, 2); g.fill(); }
      for (let i = 3; i < 9; i++) { const col = i % 3, row = Math.floor(i / 3); thumb(g, col * 361, 1648 + row * 482, 358, 478, i + 4); }
    },
    heroes: [
      { k: 'avatar', box: [44, 534, 312, 312], h: .22, d: 0, draw: g => {
        g.save(); g.lineWidth = 12; g.strokeStyle = lingrad(g, 60, 820, 330, 540, [[0, '#FEDA75'], [.4, '#FA7E1E'], [.7, '#D62976'], [1, '#962FBF']]); g.beginPath(); g.arc(200, 690, 146, 0, 7); g.stroke(); g.restore();
        g.beginPath(); g.arc(200, 690, 128, 0, 7); g.fillStyle = '#F5EAE0'; g.fill(); drawLogo(g, 200, 694, 190); } },
      { k: 'name', box: [390, 600, 660, 150], h: .12, d: .1, draw: g => { txt(g, 'MBTK Design', 400, 660, F(700, 54, 's'), '#fff'); txt(g, 'Agence de marketing', 400, 728, F(500, 38, 's'), '#a8a8a8'); } },
      { k: 'bio', box: [40, 868, 1000, 284], h: .07, d: .18, draw: g => { BIO.forEach((l, i) => txt(g, l, 60, 912 + i * 52, F(500, 38, 's'), '#f0f0f0')); txt(g, '🔗 ' + CFG.site, 60, 1124, F(600, 38, 's'), '#E0F1FF'); } },
      { k: 'follow', box: [60, 1170, 640, 112], h: .27, d: .22, draw: g => { g.fillStyle = '#0095F6'; rr(g, 60, 1170, 640, 112, 22); g.fill(); txt(g, "S'abonner", 380, 1244, F(700, 50, 's'), '#fff', 'center'); } },
      { k: 'contact', box: [720, 1170, 300, 112], h: .13, d: .28, draw: g => { g.fillStyle = '#262626'; rr(g, 720, 1170, 300, 112, 22); g.fill(); txt(g, 'Contacter', 870, 1244, F(600, 40, 's'), '#fff', 'center'); } },
      { k: 'hl', box: [30, 1312, 1020, 240], h: .09, d: .32, draw: g => ['Pubs', 'Logos', 'Reels', 'Avis', 'Offres'].forEach((l, i) => {
        const x = 130 + i * 205; g.strokeStyle = '#3a3a3a'; g.lineWidth = 4; g.beginPath(); g.arc(x, 1400, 78, 0, 7); g.stroke();
        g.save(); g.beginPath(); g.arc(x, 1400, 68, 0, 7); g.clip(); thumb(g, x - 70, 1330, 140, 140, i + 2); g.restore();
        txt(g, l, x, 1530, F(500, 32, 's'), '#fff', 'center'); }) },
      ...[0, 1, 2].map(i => ({ k: 'th' + i, box: [i * 361, 1648, 358, 478], h: .05 + (i === 1 ? .05 : 0), d: .38 + i * .05, draw: g => thumb(g, i * 361, 1648, 358, 478, i + 4) }))
    ]
  };
}
function renderPage(spec, withHeroes) { const { c, g } = mk(Math.round(SCW * PXS), Math.round(SCH * PXS)); g.scale(PXS, PXS); spec.base(g); if (withHeroes) spec.heroes.forEach(hh => { g.save(); hh.draw(g); g.restore(); }); return c; }
const LPAD = 36;
function renderLayer(hh) { const [x, y, w, h] = hh.box; const { c, g } = mk(Math.round((w + 2 * LPAD) * PXS), Math.round((h + 2 * LPAD) * PXS)); g.scale(PXS, PXS); g.translate(LPAD - x, LPAD - y); hh.draw(g); return c; }
function shadowOf(cv, r = 16) {
  const S = mk(cv.width, cv.height); S.g.drawImage(cv, 0, 0); S.g.globalCompositeOperation = 'source-in'; S.g.fillStyle = '#000'; S.g.fillRect(0, 0, cv.width, cv.height);
  const out = softShape(cv.width, cv.height, r, g => g.drawImage(S.c, 0, 0)); S.c.width = S.c.height = 1; return out;
}
