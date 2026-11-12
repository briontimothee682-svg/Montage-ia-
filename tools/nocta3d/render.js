// Renders frames of the NOCTA animated film with headless Chromium.
//   node render.js shot <id> <t0> <t1> <outDir> [fps] [w h]   -> PNG frames f0000.png ...
//   node render.js test <name> <outPng> [args json]            -> one still from window.renderTest
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.json': 'application/json' };

(async () => {
  const args = process.argv.slice(2);
  const mode = args[0];
  let W = 1080, H = 1920;
  if (mode === 'shot' && args[7]) { W = parseInt(args[6]); H = parseInt(args[7]); }
  if (mode === 'test' && args[4]) { const s = args[4].split('x'); W = parseInt(s[0]); H = parseInt(s[1]); }
  if (mode === 'multi' && args[3]) { const s = args[3].split('x'); W = parseInt(s[0]); H = parseInt(s[1]); }
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(600000);
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.error('page:', m.text()); });
  page.on('pageerror', e => { console.error('pageerror:', e.message); if (!global.__started) process.exit(1); });
  await page.route('http://local/**', async route => {
    const u = new URL(route.request().url());
    const f = path.join(ROOT, decodeURIComponent(u.pathname));
    if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: 'nf' });
    route.fulfill({ status: 200, body: fs.readFileSync(f), contentType: MIME[path.extname(f)] || 'application/octet-stream' });
  });
  await page.goto(`http://local/tools/nocta3d/index.html?w=${W}&h=${H}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 300000 });
  global.__started = true;
  const grab = async (file) => {
    for (let attempt = 0; ; attempt++) {
      try { await page.screenshot({ path: file, type: 'png', clip: { x: 0, y: 0, width: W, height: H }, timeout: 600000 }); break; }
      catch (e) { if (attempt >= 2) throw e; console.error('retry', file); }
    }
  };
  if (mode === 'info') {
    const r = await page.evaluate(([s, tt]) => window.debugInfo(s, tt), [args[1], parseFloat(args[2])]);
    console.log(JSON.stringify(r));
  } else if (mode === 'multi') {
    const list = JSON.parse(args[1]);
    fs.mkdirSync(args[2], { recursive: true });
    for (const [id, t, dbg] of list) {
      const t0 = Date.now();
      await page.evaluate((d) => { window.debugCam = d || null; }, dbg || null);
      await page.evaluate(([s, tt]) => window.renderShot(s, tt), [id, t]);
      const f = path.join(args[2], `${id}_${t.toFixed(2)}.png`);
      await grab(f);
      console.log(id, t, Date.now() - t0, 'ms');
    }
  } else if (mode === 'test') {
    const t0 = Date.now();
    await page.evaluate(([n, a]) => window.renderTest(n, a), [args[1], JSON.parse(args[3] || '{}')]);
    await grab(args[2]);
    console.log('test', args[1], Date.now() - t0, 'ms');
  } else {
    const [id, t0, t1, outDir] = [args[1], parseFloat(args[2]), parseFloat(args[3]), args[4]];
    const fps = parseFloat(args[5] || '24');
    fs.mkdirSync(outDir, { recursive: true });
    const n0 = Math.round(t0 * fps), n1 = Math.round(t1 * fps);
    const tStart = Date.now();
    for (let fi = n0; fi < n1; fi++) {
      const file = path.join(outDir, `f${String(fi).padStart(5, '0')}.png`);
      if (fs.existsSync(file)) continue;
      await page.evaluate(([s, t]) => window.renderShot(s, t), [id, fi / fps]);
      await grab(file);
      if ((fi - n0) % 12 === 0) console.log(`${id} frame ${fi} (${((Date.now() - tStart) / 1000 / (fi - n0 + 1)).toFixed(2)} s/frame)`);
    }
  }
  await browser.close();
})();
