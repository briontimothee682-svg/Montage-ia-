"""Construit mbtk_lancement.html : src.html + logo + bande-son (mix.mp3 / sfx.mp3) en base64.
Usage : python3 build.py <dossier_audio>"""
import base64, os, sys, io
D = os.path.dirname(os.path.abspath(__file__))
aud = sys.argv[1] if len(sys.argv) > 1 else D
b64 = lambda p: base64.b64encode(open(p, 'rb').read()).decode()
s = open(os.path.join(D, 'src.html')).read()
s = s.replace('__LOGO__', b64(os.path.join(D, 'logo_mbtk.png')))
s = s.replace('__MIX__', b64(os.path.join(aud, 'mix.mp3'))).replace('__SFX__', b64(os.path.join(aud, 'sfx.mp3')))
out = os.path.join(D, '..', 'mbtk_lancement.html')
open(out, 'w').write(s)
print(out, round(len(s) / 1e6, 2), 'Mo')
