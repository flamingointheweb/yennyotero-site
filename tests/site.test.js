const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html':'text/html', '.css':'text/css', '.webp':'image/webp', '.pdf':'application/pdf', '.js':'text/javascript' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404); return res.end('not found');
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

const results = [];
const ok = (n, m='') => results.push(['PASS', n, m]);
const bad = (n, m='') => results.push(['FAIL', n, m]);

(async () => {
  await new Promise(r => server.listen(8099, r));
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});

  const errors = [];
  const bad404 = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('JS error: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.googleapis|favicon|ERR_TUNNEL/.test(m.text())) errors.push('console: ' + m.text().slice(0,120)); });
  page.on('response', r => { if (r.status() >= 400) bad404.push(r.status() + ' ' + r.url().replace('http://localhost:8099','')); });

  await page.goto('http://localhost:8099/', { waitUntil: 'networkidle' });

  // ---- tiles render
  const tiles = await page.locator('.tile').count();
  tiles === 6 ? ok('strip renders 6 tiles') : bad('strip tiles', 'got ' + tiles);

  // ---- all strip images actually loaded (not broken)
  const broken = await page.$$eval('img', is => is.filter(i => i.hasAttribute('src') && (!i.complete || i.naturalWidth === 0)).map(i => i.getAttribute('src')));
  broken.length === 0 ? ok('all homepage images load') : bad('broken images', broken.join(', '));

  // ---- lightbox opens
  await page.locator('.tile').first().click();
  await page.waitForTimeout(250);
  const vis = await page.locator('#lb').isVisible();
  vis ? ok('lightbox opens on click') : bad('lightbox does not open');
  const title = (await page.locator('#lbTitle').textContent() || '').trim();
  title.length > 5 ? ok('lightbox shows a description', '"' + title + '"') : bad('lightbox description empty');

  // image inside overlay fits the viewport
  const box = await page.locator('#lbImg').boundingBox();
  box && box.height <= 900 ? ok('overlay image fits viewport', Math.round(box.height) + 'px tall') : bad('overlay image too tall', JSON.stringify(box));

  // ---- arrow key navigation
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(150);
  const t2 = (await page.locator('#lbTitle').textContent() || '').trim();
  t2 !== title ? ok('arrow keys move between images') : bad('arrow keys do nothing');

  // ---- escape closes and scroll is restored
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const closed = !(await page.locator('#lb').isVisible());
  closed ? ok('escape closes the overlay') : bad('escape does not close');
  const ov = await page.evaluate(() => document.body.style.overflow);
  ov === '' ? ok('page scrolling restored after close') : bad('scroll still locked', 'overflow=' + ov);

  // ---- scrolling actually works after closing
  await page.evaluate(() => window.scrollTo(0, 600));
  const y = await page.evaluate(() => window.scrollY);
  y > 300 ? ok('page scrolls after closing overlay', y + 'px') : bad('page will not scroll', 'scrollY=' + y);

  // ---- case study links
  for (const [name, href] of [['Bachata Connect','work/bachata-connect.html'],['TSB','work/tsb.html'],
      ['Oslo','work/oslo-university-hospital.html'],['Amplifon','work/amplifon.html']]) {
    const r = await page.request.get('http://localhost:8099/' + href);
    r.status() === 200 ? ok('case study reachable: ' + name) : bad('case study ' + name, 'HTTP ' + r.status());
  }

  // ---- CV
  const cv = await page.request.get('http://localhost:8099/Yenny-Otero-CV.pdf');
  const buf = await cv.body();
  (cv.status() === 200 && buf.slice(0,4).toString() === '%PDF')
    ? ok('CV downloads as a valid PDF', Math.round(buf.length/1024) + 'KB')
    : bad('CV broken', 'HTTP ' + cv.status());

  // ---- each case study page: images load, no horizontal scroll
  for (const href of ['work/bachata-connect.html','work/tsb.html','work/oslo-university-hospital.html','work/amplifon.html']) {
    const p2 = await ctx.newPage();
    const errs = [];
    p2.on('pageerror', e => errs.push(e.message));
    p2.on('response', r => { if (r.status() >= 400) bad404.push(r.status() + ' ' + r.url().replace('http://localhost:8099','')); });
    await p2.goto('http://localhost:8099/' + href, { waitUntil: 'networkidle' });
    const br = await p2.$$eval('img', is => is.filter(i => i.hasAttribute('src') && (!i.complete || i.naturalWidth === 0)).map(i => i.getAttribute('src')));
    const over = await p2.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    const label = href.split('/')[1].replace('.html','');
    br.length === 0 && !over && errs.length === 0
      ? ok('case study renders clean: ' + label)
      : bad('case study ' + label, [br.join(','), over ? 'horizontal scroll' : '', errs.join(';')].filter(Boolean).join(' | '));
    await p2.close();
  }

  // ---- phone width, homepage + one case study
  for (const url of ['/', '/work/bachata-connect.html']) {
    const m = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await m.goto('http://localhost:8099' + url, { waitUntil: 'networkidle' });
    const over = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    over ? bad('phone width ' + url, 'page scrolls sideways') : ok('no sideways scroll at 390px: ' + url);
    if (url === '/') {
      await m.locator('.tile').first().click();
      await m.waitForTimeout(250);
      const v = await m.locator('#lb').isVisible();
      v ? ok('lightbox works on phone') : bad('lightbox fails on phone');
    }
    await m.close();
  }

  // ---- tap target sizes on phone
  const m2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await m2.goto('http://localhost:8099/', { waitUntil: 'networkidle' });
  const small = await m2.$$eval('a.btn, .bar nav a, .lines a', els =>
    els.filter(e => e.offsetParent !== null).map(e => ({ t: (e.textContent||'').trim().slice(0,20), h: Math.round(e.getBoundingClientRect().height) }))
       .filter(x => x.h < 24));
  small.length === 0 ? ok('tap targets are reasonable on phone') : bad('small tap targets', JSON.stringify(small));
  await m2.close();

  // ---- no image is ever stretched or squashed (pages + every lightbox image), desktop and phone
  const ratioErr = i => Math.abs((i.clientWidth / i.clientHeight) / (i.naturalWidth / i.naturalHeight) - 1);
  for (const w of [1440, 390]) {
    const ap = await browser.newPage({ viewport: { width: w, height: 900 } });
    const distorted = [];
    for (const pg of ['/', '/work/bachata-connect.html', '/work/tsb.html', '/work/oslo-university-hospital.html', '/work/amplifon.html']) {
      await ap.goto('http://localhost:8099' + pg, { waitUntil: 'networkidle' });
      await ap.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 25)); } });
      const d = await ap.$$eval('img', (is, f) => { const e = new Function('return ' + f)(); return is.filter(i => i.complete && i.naturalWidth && i.offsetWidth && ['fill', ''].includes(getComputedStyle(i).objectFit) && e(i) > 0.01).map(i => i.getAttribute('src')); }, ratioErr.toString());
      d.forEach(s => distorted.push(pg + ' ' + s));
      if (pg === '/') {
        const n = await ap.locator('.tile').count();
        for (let k = 0; k < n; k++) {
          await ap.locator('.tile').nth(k).click(); await ap.waitForTimeout(200);
          const e = await ap.$eval('#lbImg', (i, f) => new Function('return ' + f)()(i), ratioErr.toString());
          if (e > 0.01) distorted.push('lightbox ' + (await ap.getAttribute('#lbImg', 'src')));
          await ap.keyboard.press('Escape');
        }
      }
    }
    distorted.length === 0 ? ok('no image distorted at ' + w + 'px (pages and lightbox)') : bad('distorted images at ' + w + 'px', distorted.join(', '));
    await ap.close();
  }

  errors.length === 0 ? ok('no JavaScript errors on the homepage') : bad('JS errors', errors.join(' | '));
  bad404.length === 0 ? ok('no failed requests anywhere') : bad('failed requests', [...new Set(bad404)].join(', '));

  await browser.close();
  server.close();

  const f = results.filter(r => r[0] === 'FAIL');
  console.log('\n' + results.map(r => (r[0] === 'PASS' ? '  ok  ' : '  XX  ') + r[1] + (r[2] ? '  — ' + r[2] : '')).join('\n'));
  console.log('\n' + (results.length - f.length) + ' passed, ' + f.length + ' failed');
})();
