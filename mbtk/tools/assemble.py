"""Assemble la v2 : part_*.js + src_v1.html -> src.html (avec repères __LOGO__/__MIX__/__SFX__)."""
import os, re
D = os.path.dirname(os.path.abspath(__file__))
s = open(os.path.join(D, 'src_v1.html')).read()
part = lambda n: open(os.path.join(D, n)).read()

def cut(s, a, b, new, keep_b=True):
    i = s.index(a); j = s.index(b, i)
    return s[:i] + new + (s[j:] if keep_b else s[j + len(b):])

def rep(s, a, b, count=1):
    assert a in s, a[:80]
    return s.replace(a, b, count)

# ---- style
s = rep(s, "#hand{position:absolute;font-size:120px;left:700px;top:905px;opacity:0;filter:drop-shadow(0 8px 18px rgba(0,0,0,.5))}",
        "#hand{position:absolute;font-size:120px;left:0;top:0;opacity:0;filter:drop-shadow(0 8px 18px rgba(0,0,0,.5))}\n"
        "#t10{top:470px;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:50px}\n"
        ".url{display:inline-block;padding:14px 40px;border-radius:999px;background:var(--cream);color:var(--bordD);text-shadow:none;box-shadow:0 12px 30px rgba(20,3,9,.45)}")
s = rep(s, "#grain{position:absolute;inset:-64px;opacity:.075;", "#grain{position:absolute;inset:-64px;opacity:.06;")
s = rep(s, "background:linear-gradient(180deg,rgba(24,4,11,.62) 0%,rgba(24,4,11,.38) 45%,rgba(24,4,11,0) 100%)}",
        "background:linear-gradient(180deg,rgba(18,6,20,.66) 0%,rgba(18,6,20,.4) 45%,rgba(18,6,20,0) 100%)}")
# ---- DOM
s = rep(s, '    <div class="tx" id="t9">Services · Réalisations · Tarifs</div>\n',
        '    <div class="tx" id="t9">Services · Réalisations · Tarifs</div>\n    <div class="tx" id="t10"><span class="url" id="urlTxt">ton-site.fr</span></div>\n')
s = rep(s, '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>',
        '<script>window.MBTK_AUDIO={mix:"__MIX__",sfx:"__SFX__"};</script>\n<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>')
s = rep(s, "MBTK DESIGN — vidéo de lancement (9:16, 1080×1920, 60 fps, ≈36 s)", "MBTK DESIGN — vidéo de lancement (9:16, 1080×1920, 60 fps, 58 s, avec bande-son)")
# ---- constantes
s = rep(s, "const W = 1080, H = 1920, DUR = 36;", "const W = 1080, H = 1920, DUR = 58;")
s = rep(s, "const Q = QS.has('q') ? parseFloat(QS.get('q')) : 1;", "const Q = QS.has('q') ? parseFloat(QS.get('q')) : (isMobile ? 1 : 1.5);")
s = rep(s, "(isMobile ? 32 : 44)", "(isMobile ? 32 : 48)")
s = rep(s, "const TANH = Math.tan(FOV * DEG / 2);", "let TANH = Math.tan(FOV * DEG / 2);")
# ---- flous sans ctx.filter
s = cut(s, "function glowTex()", "/* ---------------- écrans du téléphone", part('part_glow.js') + "\n")
# ---- pages
s = cut(s, "function pageInCall() {", "function timerCanvas()", "")
s = cut(s, "function pageTikTok() {", "/* ---------------- cartes 3D (768×1024)", part('part_pages.js') + "\n")
# vignettes signées MBTK
s = rep(s, "  play(g, x + 34, y + h - 34, 22, 'rgba(255,255,255,.9)');\n  g.restore();",
        "  play(g, x + 34, y + h - 34, 22, 'rgba(255,255,255,.9)');\n  txt(g, 'MBTK', x + 18, y + 40, F(800, Math.max(14, w * .065), 'u'), light ? '#9E2A43' : '#E8B27A');\n  g.restore();")
# site : maquette de téléphone aux couleurs MBTK
s = rep(s, "txt(g, 'TIM', 0, -60, F(900, 46, 'u'), '#fff', 'center');", "g.fillStyle = '#F5EAE0'; g.beginPath(); g.arc(0, -70, 46, 0, 7); g.fill(); drawLogo(g, 0, -69, 70);")
s = rep(s, "lingrad(g, 0, -218, 0, 228, [[0, '#ff8a3c'], [.5, '#c4162a'], [1, '#2a0510']])", "lingrad(g, 0, -218, 0, 228, [[0, '#E8B27A'], [.5, '#9E2A43'], [1, '#0B1633']])")
# ---- écran, téléphone
s = cut(s, "/* ---------- shader écran du téléphone ---------- */", "function panelMesh(", part('part_screen.js') + "\n")
# ---- scènes
s = cut(s, "/* ---------- variables de scène ---------- */", "/* ---------- post-production ---------- */", part('part_scenes.js') + "\n")
# ---- post, animation, son, lecture
i = s.index("/* ---------- post-production ---------- */"); j = s.index("init();\n</script>")
s = s[:i] + part('part_rest.js') + s[j + len("init();\n"):]
open(os.path.join(D, 'src.html'), 'w').write(s)
print('src.html', len(s))
