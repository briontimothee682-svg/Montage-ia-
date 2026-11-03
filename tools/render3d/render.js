// Renders the 3D layer to PNG frames. Usage: node render.js <outDir> <startFrame> <endFrame> [step] | node render.js test <t> ...
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const FPS = 30;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.json': 'application/json' };

(async () => {
  const args = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(300000);
  page.on('console', m => { if (m.type() === 'error') console.error('page:', m.text()); });
  page.on('pageerror', e => console.error('pageerror:', e.message));
  await page.route('http://local/**', async route => {
    const u = new URL(route.request().url());
    const f = path.join(ROOT, decodeURIComponent(u.pathname));
    if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: 'nf' });
    route.fulfill({ status: 200, body: fs.readFileSync(f), contentType: MIME[path.extname(f)] || 'application/octet-stream' });
  });
  const PAGE = process.env.PAGE || 'scene';
  await page.goto(`http://local/tools/render3d/${PAGE}.html`);
  await page.waitForFunction(() => window.__ready !== undefined, null, { timeout: 120000 });
  await page.evaluate(() => window.__ready);
  const shot = async (t, file) => {
    const fi = Math.round(t * FPS);
    const scr = (PAGE === 'scene' && t >= 17 && t < 30.5) ? `/exports/screen/s${String(fi).padStart(4, '0')}.png` : null;
    await page.evaluate(([t, s]) => window.renderAt(t, s), [t, scr]);
    for (let attempt = 0; ; attempt++) {
      try { await page.screenshot({ path: file, type: 'png', clip: { x: 0, y: 0, width: 1080, height: 1920 }, timeout: 300000 }); break; }
      catch (e) { if (attempt >= 2) throw e; console.error('retry screenshot', file); }
    }
  };
  if (args[0] === 'test') {
    const out = path.join(ROOT, 'exports', 'test3d'); fs.mkdirSync(out, { recursive: true });
    for (const ts of args.slice(1)) { const t0 = Date.now(); await shot(parseFloat(ts), path.join(out, `t${parseFloat(ts).toFixed(2)}.png`)); console.log(ts, Date.now() - t0, 'ms'); }
  } else {
    const [outDir, a, b] = [args[0], parseInt(args[1]), parseInt(args[2])];
    fs.mkdirSync(outDir, { recursive: true });
    for (let fi = a; fi < b; fi++) {
      await shot(fi / FPS, path.join(outDir, `f${String(fi).padStart(4, '0')}.png`));
      if (fi % 50 === 0) console.log('frame', fi);
    }
  }
  await browser.close();
})();
