// Screenshots every gallery page. Usage: node tests/shot.js [name ...]   (defaults to all html files in tests/gallery)
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
(async () => {
  const dir = path.join(__dirname, 'gallery');
  const names = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(dir).filter((f) => f.endsWith('.html')).map((f) => f.replace('.html', ''));
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 800 }, deviceScaleFactor: 2 });
  for (const n of names) { await p.goto('file://' + path.join(dir, n + '.html')); await p.waitForTimeout(300); await p.screenshot({ path: path.join(dir, n + '.png'), fullPage: true }); console.log(`gallery/${n}.png`); }
  await b.close();
})();
