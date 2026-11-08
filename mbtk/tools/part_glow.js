// flou doux sans ctx.filter (non supporté sur les anciens iPhone) : dessin en basse résolution, moyenne 3×3, agrandissement lissé
function softShape(w, h, r, drawFn) {
  const k = Math.max(1, r / 2.5), sw = Math.max(4, Math.round(w / k)), sh = Math.max(4, Math.round(h / k));
  const A = mk(sw, sh); A.g.imageSmoothingEnabled = true; A.g.imageSmoothingQuality = 'high'; A.g.scale(sw / w, sh / h); drawFn(A.g);
  const B = mk(sw, sh); B.g.globalCompositeOperation = 'lighter'; B.g.globalAlpha = 1 / 9;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) B.g.drawImage(A.c, i, j);
  const C = mk(w, h); C.g.imageSmoothingEnabled = true; C.g.imageSmoothingQuality = 'high'; C.g.drawImage(B.c, 0, 0, w, h);
  A.c.width = A.c.height = B.c.width = B.c.height = 1; return C.c;
}
function glowTex() { const A = mk(256, 256); const g = A.g; const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); return A.c; }
function rectGlowTex() { return softShape(256, 320, 40, g => { g.fillStyle = '#fff'; rr(g, 46, 46, 164, 228, 26); g.fill(); }); }
function contactShadowTex() { return softShape(256, 512, 46, g => { g.fillStyle = 'rgba(0,0,0,0.9)'; rr(g, 60, 60, 136, 392, 34); g.fill(); }); }
function softRectTex(w, h, inset, r, rad, col) { return softShape(w, h, r, g => { g.fillStyle = col || 'rgba(0,0,0,1)'; rr(g, inset, inset, w - 2 * inset, h - 2 * inset, rad); g.fill(); }); }
function vGradTex(a0, a1) { const A = mk(4, 256); const gr = A.g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, `rgba(0,0,0,${a0})`); gr.addColorStop(1, `rgba(0,0,0,${a1})`); A.g.fillStyle = gr; A.g.fillRect(0, 0, 4, 256); return A.c; }
