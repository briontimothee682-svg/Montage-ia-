// Shared helpers for the L'Apéretik reel: maths, easing, noise, texture loading, materials.
// World units are centimetres, y is up.
import * as THREE from 'three';

export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const prog = (t, a, b) => clamp((t - a) / (b - a));
export const lerp = (a, b, p) => a + (b - a) * p;
export const smooth = p => p * p * (3 - 2 * p);
export const easeOut = p => 1 - Math.pow(1 - p, 3);
export const easeOut5 = p => 1 - Math.pow(1 - p, 5);
export const easeIn = p => p * p * p;
export const easeInOut = p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
export const easeInOut5 = p => (p < 0.5 ? 16 * p ** 5 : 1 - Math.pow(-2 * p + 2, 5) / 2);
export const easeBack = (p, s = 1.7) => { p -= 1; return 1 + (s + 1) * p * p * p + s * p * p; };
export const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const deg = d => THREE.MathUtils.degToRad(d);

export function seeded(seed) {
  let s = (seed * 2654435761) >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// cheap smooth 3D value noise (deterministic)
function hash3(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  let r = 0;
  for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
    const k = (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w);
    r += k * hash3(xi + dx, yi + dy, zi + dz);
  }
  return r;
}
export const fbm3 = (x, y, z, o = 3) => { let a = 0, f = 1, s = 0, t = 0; for (let i = 0; i < o; i++) { a += noise3(x * f, y * f, z * f) * (s = 1 / f); t += s; f *= 2; } return a / t; };

// camera shake / handheld drift
export function drift(t, amp, seed = 1) {
  return v3((noise3(t * 0.7, seed, 0) - 0.5) * amp, (noise3(seed, t * 0.6, 3) - 0.5) * amp, (noise3(5, seed, t * 0.5) - 0.5) * amp);
}

// ------------------------------------------------------------ textures
const loader = new THREE.TextureLoader();
const cache = new Map();
export const TEX = '/assets/laperetik/tex/';
export async function preload(names) {
  await Promise.all(names.map(async n => {
    const t = await loader.loadAsync(`${TEX}${n}.png`);
    cache.set(n, t);
  }));
}
export function tex(name, { color = true, repeat = [1, 1], wrap = true, aniso = 8 } = {}) {
  const base = cache.get(name);
  if (!base) throw new Error('texture not preloaded: ' + name);
  const t = base.clone();
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (wrap) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

export function canvasTex(canvas, color = true) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

// ------------------------------------------------------------ geometry helpers
export function jitterGeometry(geo, amp, freq, seed) {
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = noise3(v.x * freq + seed, v.y * freq, v.z * freq) - 0.5;
    const n2 = noise3(v.x * freq + 11, v.y * freq + seed, v.z * freq + 7) - 0.5;
    const n3 = noise3(v.x * freq + 23, v.y * freq + 3, v.z * freq + seed) - 0.5;
    p.setXYZ(i, v.x + n * amp, v.y + n2 * amp, v.z + n3 * amp);
  }
  geo.computeVertexNormals();
  return geo;
}

export function shiftUV(geo, du, dv, s = 1) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * s + du, uv.getY(i) * s + dv);
  return geo;
}

export function lathe(profile, segs = 96) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segs);
}

// smooth profile helper: [[r, y], ...] -> densified catmull-rom curve
export function smoothProfile(pts, n = 120) {
  const c = new THREE.SplineCurve(pts.map(([r, y]) => new THREE.Vector2(r, y)));
  return c.getSpacedPoints(n).map(p => [Math.max(0.0001, p.x), p.y]);
}

// uv generator for extruded shapes: caps mapped to the shape bbox, walls along the outline
export function bboxUV(minx, miny, w, h, wallScale = 0.1) {
  return {
    generateTopUV(g, v, a, b, c) {
      const f = i => new THREE.Vector2((v[i * 3] - minx) / w, (v[i * 3 + 1] - miny) / h);
      return [f(a), f(b), f(c)];
    },
    generateSideWallUV(g, v, a, b, c, d) {
      const P = i => [v[i * 3], v[i * 3 + 1], v[i * 3 + 2]];
      const [ax, ay, az] = P(a), [bx, by, bz] = P(b), [cx, cy, cz] = P(c), [dx, dy, dz] = P(d);
      const s = (x, y) => (Math.atan2(y - (miny + h / 2), x - (minx + w / 2)) / (2 * Math.PI) + 0.5);
      return [new THREE.Vector2(s(ax, ay), az * wallScale), new THREE.Vector2(s(bx, by), bz * wallScale),
              new THREE.Vector2(s(cx, cy), cz * wallScale), new THREE.Vector2(s(dx, dy), dz * wallScale)];
    },
  };
}

export function setShadow(obj, cast = true, receive = true) {
  obj.traverse(o => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = receive; } });
  return obj;
}

export function canvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}
