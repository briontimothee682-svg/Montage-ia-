// Renders the 3D layer of the L'Apéretik reel to PNG frames with headless Chromium (SwiftShader).
// Usage: node tools/laperetik/render.js frames <outDir> <startFrame> <endFrame> [step]
//        node tools/laperetik/render.js test <outDir> <t> [<t> ...]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const FPS = 24;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.json': 'application/json' };

(async () => {
  const [mode, outDir, ...rest] = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(600000);
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.error('page:', m.text()); });
  page.on('pageerror', e => console.error('pageerror:', e.message));
  await page.route('http://local/**', async route => {
    const u = new URL(route.request().url());
    const f = path.join(ROOT, decodeURIComponent(u.pathname));
    if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: 'nf' });
    route.fulfill({ status: 200, body: fs.readFileSync(f), contentType: MIME[path.extname(f)] || 'application/octet-stream' });
  });
  await page.goto('http://local/tools/laperetik/web/scene.html');
  await page.waitForFunction(() => window.__ready !== undefined, null, { timeout: 120000 });
  await page.evaluate(() => window.__ready);
  if (process.env.EVAL) await page.evaluate(process.env.EVAL);
  fs.mkdirSync(outDir, { recursive: true });
  const shot = async (t, file) => {
    const ta = Date.now();
    await page.evaluate(t => window.renderAt(t), t);
    if (process.env.PROFILE) console.log('render', Date.now() - ta, 'ms');
    for (let attempt = 0; ; attempt++) {
      try { await page.screenshot({ path: file, type: 'png', clip: { x: 0, y: 0, width: 1080, height: 1920 }, timeout: 600000 }); break; }
      catch (e) { if (attempt >= 2) throw e; console.error('retry screenshot', file); }
    }
  };
  if (mode === 'test') {
    for (const ts of rest) { const t0 = Date.now(); await shot(parseFloat(ts), path.join(outDir, `t${parseFloat(ts).toFixed(2)}.png`)); console.log(ts, Date.now() - t0, 'ms'); }
  } else {
    const a = parseInt(rest[0]), b = parseInt(rest[1]), step = parseInt(rest[2] || '1');
    for (let fi = a; fi < b; fi += step) {
      const file = path.join(outDir, `f${String(fi).padStart(4, '0')}.png`);
      if (fs.existsSync(file) && !process.env.FORCE) continue;
      const t0 = Date.now();
      await shot(fi / FPS, file);
      if (fi % 24 === 0) console.log('frame', fi, Date.now() - t0, 'ms');
    }
  }
  await browser.close();
})();
