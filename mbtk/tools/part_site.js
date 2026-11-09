/* ---------------- site en plein écran (version mobile, 1080 × 6400) : le "zoom dans l'ordi" ---------------- */
const SITE_H = 6400;
function sitePageMobile() {
  const W2 = 1080, Hh = SITE_H, { c, g } = mk(W2, Hh);
  g.fillStyle = lingrad(g, 0, 0, 0, Hh, [[0, '#3c0d33'], [.15, '#52102a'], [.45, '#4a0c22'], [.75, '#561027'], [1, '#2c0a24']]); g.fillRect(0, 0, W2, Hh);
  blob(g, 150, 500, 700, 'rgba(140,40,200,.4)'); blob(g, 950, 1900, 700, 'rgba(158,42,67,.45)'); blob(g, 100, 3600, 700, 'rgba(11,22,51,.6)'); blob(g, 980, 5200, 800, 'rgba(140,40,200,.3)');
  const H1 = (s, x, y, z, col, al) => txt(g, s, x, y, F(800, z || 72, 'u'), col || '#fff', al || 'left');
  const P = (s, x, y, z, col, w, al) => txt(g, s, x, y, F(w || 500, z || 36, 's'), col || 'rgba(255,255,255,.8)', al || 'left');
  const card = (x, y, w, h, hi) => { g.fillStyle = hi ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.07)'; rr(g, x, y, w, h, 28); g.fill(); g.strokeStyle = hi ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.14)'; g.lineWidth = hi ? 3 : 2; g.stroke(); };
  const lines = (x, y, n, w) => { for (let k = 0; k < n; k++) { g.fillStyle = 'rgba(255,255,255,.28)'; rr(g, x, y + k * 30, w - k * 40, 14, 7); g.fill(); } };
  // barre de navigation
  g.fillStyle = 'rgba(20,4,14,.55)'; g.fillRect(0, 0, W2, 140);
  g.fillStyle = '#F5EAE0'; g.beginPath(); g.arc(90, 70, 40, 0, 7); g.fill(); drawLogo(g, 90, 72, 60);
  P('MBTK Design', 150, 84, 40, '#fff', 700);
  g.fillStyle = '#FFD23F'; rr(g, 700, 38, 250, 64, 32); g.fill(); P('Devis gratuit', 825, 82, 30, '#2a0b17', 700, 'center');
  g.fillStyle = '#fff'; for (let k = 0; k < 3; k++) rr(g, 985, 48 + k * 18, 50, 7, 3), g.fill();
  // héros
  let y = 250;
  P('▸ VIDÉOS À LA DEMANDE, GÉNÉRÉES PAR IA', 70, y, 28, '#d58bff', 700);
  ["Des vidéos", "générées par", "l'IA, livrées en", "quelques jours"].forEach((l, i) => H1(l, 66, y + 110 + i * 96, 84, i === 2 ? '#fff' : '#fff'));
  P("Je crée des vidéos accrocheuses sur commande,", 70, y + 560, 36);
  P("sans tournage ni matériel, pour booster ta", 70, y + 608, 36);
  P("visibilité. Pas d'abonnement obligatoire.", 70, y + 656, 36);
  g.fillStyle = '#fff'; rr(g, 70, y + 720, 440, 104, 52); g.fill(); P('Voir les réalisations', 290, y + 786, 34, '#3a0c2c', 700, 'center');
  g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 3; rr(g, 540, y + 720, 470, 104, 52); g.stroke(); P('Réserver un appel', 775, y + 786, 34, '#fff', 600, 'center');
  [['250+', 'VIDÉOS PRODUITES'], ['3,2M', 'VUES GÉNÉRÉES'], ['98%', 'CLIENTS SATISFAITS']].forEach(([a, b], i) => { H1(a, 70 + i * 330, y + 950, 64); P(b, 70 + i * 330, y + 1000, 24, 'rgba(255,255,255,.6)', 700); });
  // maquette téléphone MBTK
  g.save(); g.translate(540, y + 1420); g.rotate(-.05); g.shadowColor = 'rgba(200,60,255,.55)'; g.shadowBlur = 70; g.fillStyle = '#111'; rr(g, -170, -300, 340, 600, 50); g.fill(); g.shadowBlur = 0;
  g.save(); rr(g, -155, -285, 310, 570, 40); g.clip(); g.fillStyle = lingrad(g, 0, -285, 0, 285, [[0, '#E8B27A'], [.5, '#9E2A43'], [1, '#0B1633']]); g.fillRect(-155, -285, 310, 570);
  for (let k = 0; k < 18; k++) { g.strokeStyle = `rgba(255,235,200,${.38 - k * .02})`; g.lineWidth = 4; g.beginPath(); g.moveTo(0, -20); g.lineTo(-155 + k * 18, -285); g.stroke(); }
  g.fillStyle = '#F5EAE0'; g.beginPath(); g.arc(0, -90, 66, 0, 7); g.fill(); drawLogo(g, 0, -88, 100);
  g.fillStyle = 'rgba(255,255,255,.92)'; g.beginPath(); g.arc(0, 80, 46, 0, 7); g.fill(); play(g, 6, 80, 40, '#9E2A43');
  g.restore(); g.restore();
  // pour qui
  y = 2050;
  P('POUR QUI ?', 70, y, 28, '#d58bff', 700); H1('Tu te reconnais dans', 70, y + 90, 64); H1("l'un de ces profils ?", 70, y + 170, 64);
  ['Créateurs de contenu', 'Artisans & commerçants', 'Marques & produits', 'Auto-entrepreneurs'].forEach((l, i) => { const x = 70 + (i % 2) * 480, yy = y + 240 + Math.floor(i / 2) * 330; card(x, yy, 460, 300); g.fillStyle = '#5ee0e6'; g.beginPath(); g.arc(x + 60, yy + 64, 26, 0, 7); g.fill(); P(l, x + 34, yy + 150, 34, '#fff', 700); lines(x + 34, yy + 190, 3, 380); });
  // services
  y = 2950;
  P('SERVICES', 70, y, 28, '#d58bff', 700); H1("Tout ce qu'il faut pour", 70, y + 90, 62); H1('exister sur les réseaux', 70, y + 168, 62);
  ['Vidéos IA', 'Montage & cover', 'Scripts & accroches', 'Pubs Instagram', 'Visuels & affiches', 'Stratégie'].forEach((l, i) => { const x = 70 + (i % 2) * 480, yy = y + 230 + Math.floor(i / 2) * 230; card(x, yy, 460, 200); P(l, x + 34, yy + 80, 36, '#fff', 700); lines(x + 34, yy + 116, 2, 360); });
  // comment ça marche
  y = 3900;
  P('COMMENT ÇA MARCHE', 70, y, 28, '#FFD23F', 700); H1('Une commande, livrée', 70, y + 90, 62); H1('en quelques jours', 70, y + 168, 62);
  ['Brief', 'Script', 'Création', 'Livraison'].forEach((l, i) => { const yy = y + 240 + i * 120; H1('0' + (i + 1), 70, yy + 70, 58, '#9aa6ff'); P(l, 200, yy + 52, 40, '#fff', 700); lines(200, yy + 74, 1, 600); });
  // tarifs
  y = 4660;
  P('TARIFS', 540, y, 28, '#d58bff', 700, 'center'); H1('Des vidéos à la demande,', 540, y + 90, 58, '#fff', 'center'); H1('sans abonnement', 540, y + 166, 58, '#fff', 'center');
  [['Vidéo unique', '89€'], ['Pack 3 vidéos', '229€'], ['Pack 5 vidéos', '359€']].forEach(([a, b], i) => { const x = 50 + i * 333, yy = y + 250; card(x, yy, 313, 470, i === 1); if (i === 1) { g.fillStyle = '#FFD23F'; rr(g, x + 66, yy - 24, 180, 48, 24); g.fill(); P('POPULAIRE', x + 156, yy + 10, 24, '#2a0b17', 700, 'center'); } P(a, x + 30, yy + 80, 30, '#fff', 700); H1(b, x + 30, yy + 180, 70); for (let k = 0; k < 3; k++) { check(g, x + 44, yy + 250 + k * 50, 22, '#5ee0a0', 5); g.fillStyle = 'rgba(255,255,255,.35)'; rr(g, x + 72, yy + 242 + k * 50, 190 - k * 30, 14, 7); g.fill(); } g.fillStyle = i === 1 ? '#7c5cff' : 'rgba(255,255,255,.14)'; rr(g, x + 30, yy + 400, 253, 50, 25); g.fill(); });
  // FAQ
  y = 5480;
  H1('Questions fréquentes', 540, y, 58, '#fff', 'center');
  for (let i = 0; i < 4; i++) { card(70, y + 50 + i * 104, 940, 84); g.fillStyle = 'rgba(255,255,255,.55)'; rr(g, 104, y + 86 + i * 104, 420 + (i * 97) % 220, 14, 7); g.fill(); P('+', 975, y + 106 + i * 104, 40, '#fff', 600, 'right'); }
  // contact
  y = 6020;
  H1('Prêt à faire décoller', 70, y, 64); H1('ta visibilité ?', 70, y + 80, 64, '#E8B27A');
  g.fillStyle = '#7c5cff'; rr(g, 70, y + 140, 480, 100, 50); g.fill(); P('Me contacter', 310, y + 204, 36, '#fff', 700, 'center');
  P('🔗 ' + CFG.site + '  ·  ' + CFG.handle, 70, y + 310, 34, 'rgba(255,255,255,.85)', 600);
  return c;
}
