// Shared helpers for the NOCTA animated film (units: meters, seconds).
import * as THREE from 'three';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const prog = (t, a, b) => clamp((t - a) / (b - a));
export const lerp = (a, b, p) => a + (b - a) * p;
export const smooth = p => { p = clamp(p); return p * p * (3 - 2 * p); };
export const easeInOut = p => { p = clamp(p); return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; };
export const easeOut = p => 1 - Math.pow(1 - clamp(p), 3);
export const easeIn = p => Math.pow(clamp(p), 3);
export const easeOutBack = (p, s = 1.7) => { p = clamp(p) - 1; return 1 + (s + 1) * p * p * p + s * p * p; };
export const deg = THREE.MathUtils.degToRad;

export function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// timeline (must match tools/nocta/timeline.py)
export const DROP = 11.5;
export const BAR = (41.0 - DROP) / 16;
export const BEAT = BAR / 4;
export const bar = n => DROP + n * BAR;
// pulse 1 -> 0 on every beat after `start`
export const beatPulse = (t, start = DROP, k = 6) => (t < start ? 0 : Math.exp(-(((t - start) % BEAT) / BEAT) * k));
export const beatPhase = (t, start = DROP) => (t < start ? 0 : ((t - start) % BEAT) / BEAT);

// piecewise keyframes: [[t, value], ...] with easing between keys
export function keys(t, ks, ease = easeInOut) {
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 0; i < ks.length - 1; i++) {
    const [t0, v0] = ks[i], [t1, v1] = ks[i + 1];
    if (t <= t1) {
      const p = ease((t - t0) / (t1 - t0));
      if (typeof v0 === 'number') return lerp(v0, v1, p);
      return v0.clone().lerp(v1, p);
    }
  }
  return ks[ks.length - 1][1];
}

// smooth camera path through points with a time curve
export function pathAt(points, p) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  return curve.getPoint(clamp(p));
}

export function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...opts.repeat); }
  t.userData.canvas = c;
  return t;
}

export function noiseTex(w, h, seed, draw) {
  const r = seeded(seed);
  return canvasTex(w, h, (g) => draw(g, r), { repeat: [1, 1] });
}

export const mat = {
  std: (color, rough = 0.6, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra }),
  phys: (color, extra = {}) => new THREE.MeshPhysicalMaterial({ color, ...extra }),
  emit: (color, k = 1, extra = {}) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: false, ...extra }),
  add: (color, k = 1, opacity = 1, extra = {}) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, ...extra }),
};

// radial glow sprite texture (white center -> transparent)
let _glow = null;
export function glowTex() {
  if (_glow) return _glow;
  _glow = canvasTex(128, 128, (g, w, h) => {
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    r.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  });
  return _glow;
}

export function glowSprite(color, size, k = 1, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(color).multiplyScalar(k), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  s.scale.set(size, size, 1);
  return s;
}

// lathe helper: profile [[r, y], ...] -> mesh geometry with elliptic section (depth factor)
export function lathe(profile, segs = 32, depth = 1, phiStart = 0, phiLength = Math.PI * 2) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y));
  const g = new THREE.LatheGeometry(pts, segs, phiStart, phiLength);
  if (depth !== 1) g.scale(1, 1, depth);
  g.computeVertexNormals();
  return g;
}

// tapered limb along -Y, from radius r0 at y=0 to r1 at y=-len, with rounded caps
export function limbGeo(len, r0, r1, segs = 20, bulge = 0.08) {
  const prof = [];
  const n = 14;
  for (let i = 0; i <= 4; i++) { const a = (i / 4) * Math.PI / 2; prof.push([r0 * Math.sin(a), r0 * Math.cos(a) * 0.6]); }
  for (let i = 1; i < n; i++) {
    const p = i / n;
    const r = lerp(r0, r1, p) * (1 + bulge * Math.sin(Math.PI * p));
    prof.push([r, -len * p]);
  }
  for (let i = 0; i <= 4; i++) { const a = (i / 4) * Math.PI / 2; prof.push([r1 * Math.cos(a), -len - r1 * Math.sin(a) * 0.6]); }
  prof.reverse();
  const pts = prof.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y));
  const g = new THREE.LatheGeometry(pts, segs);
  g.computeVertexNormals();
  return g;
}
