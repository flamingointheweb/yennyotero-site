const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html':'text/html', '.css':'text/css', '.webp':'image/webp', '.pdf':'application/pdf', '.js':'text/javascript' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  // Vercel serves its analytics script on the live site only; stand in with an empty one.
  if (p.startsWith('/_vercel/')) { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(''); }
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

  // ---- homepage content and structure
  const h1 = (await page.locator('h1').first().getAttribute('aria-label')) || '';
  h1 === 'I design products, then I build them.' ? ok('hero headline is exact') : bad('hero headline', h1);
  const meta = (await page.locator('.meta').first().textContent() || '').replace(/\s+/g, ' ').trim();
  meta === 'Design Engineer · London · Fluent: ES, EN, IT, NO · Product · AI' ? ok('hero meta line is exact') : bad('hero meta', meta);
  const btns = (await page.locator('.acts a').allTextContents()).map(x => x.replace(/\s+/g, ' ').trim());
  btns.length === 2 && /^Explore my work/.test(btns[0]) && /^Get in touch/.test(btns[1]) ? ok('hero buttons are exact') : bad('hero buttons', btns.join(' | '));
  for (const id of ['top', 'work', 'code', 'about', 'contact']) {
    (await page.locator('#' + id).count()) === 1 ? ok('section exists: #' + id) : bad('missing section #' + id);
  }
  (await page.locator('ol.titles li').count()) === 4 ? ok('work lists 4 cases') : bad('work case count', String(await page.locator('ol.titles li').count()));
  const body = await page.locator('body').textContent();
  const banned = ['1.7M', 'team of 15', 'employee 63', '+44 750', 'switched off for participants', 'Talks and archive'].filter(x => body.includes(x));
  banned.length === 0 ? ok('no retired or unsourced claims on the homepage') : bad('retired claims present', banned.join(', '));
  body.includes('employee 69') ? ok('Opera employee number is 69') : bad('employee number missing');

  // ---- Built in code tabs: each tab shows exactly its own panel
  const tabs = await page.locator('[role=tab]').count();
  tabs === 4 ? ok('code section has 4 tabs') : bad('tab count', String(tabs));
  let tabsOk = true;
  for (let k = 1; k <= tabs; k++) {
    await page.locator('#t' + k).click();
    const shown = await page.$$eval('[role=tabpanel]', ps => ps.filter(p => !p.hidden).map(p => p.id));
    if (shown.length !== 1 || shown[0] !== 'p' + k) tabsOk = false;
  }
  tabsOk ? ok('each tab shows only its own panel') : bad('tab panels do not match tabs');
  await page.locator('#t1').focus(); await page.keyboard.press('ArrowRight');
  (await page.$eval('#t2', e => e.getAttribute('aria-selected'))) === 'true' ? ok('arrow keys move between tabs') : bad('arrow keys do not move tabs');
  const ds = await page.locator('a[href="https://ds.yennyotero.com"]').count();
  ds >= 1 ? ok('design system demo link present') : bad('design system link', String(ds));

  // ---- every image loads once scrolled through (lazy images included)
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } scrollTo(0, 0); });
  await page.waitForTimeout(1200);
  const broken = await page.$$eval('img', is => is.filter(i => i.hasAttribute('src') && (!i.complete || i.naturalWidth === 0)).map(i => i.getAttribute('src')));
  broken.length === 0 ? ok('all homepage images load') : bad('broken images', broken.join(', '));

  // ---- contact: email and copy button
  (await page.locator('a[href="mailto:yenny@neonlighthouse.co.uk"]').count()) >= 1 ? ok('contact email link present') : bad('contact email missing');
  (await page.locator('#copyMail').count()) === 1 ? ok('copy email button present') : bad('copy button missing');

  // ---- work cards link to real case studies
  for (const href of ['work/bachata-connect.html', 'work/tsb.html', 'work/oslo-university-hospital.html', 'work/amplifon.html']) {
    (await page.locator('a.cs[href="' + href + '"]').count()) >= 1 ? ok('work card links to ' + href) : bad('work card link missing: ' + href);
  }

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
  for (const href of ['work/bachata-connect.html','work/tsb.html','work/oslo-university-hospital.html','work/amplifon.html','work/lego.html','work/orth.html','work/serova.html']) {
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
  for (const url of ['/', '/work/bachata-connect.html', '/work/lego.html', '/work/orth.html', '/work/serova.html']) {
    const m = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await m.goto('http://localhost:8099' + url, { waitUntil: 'networkidle' });
    const over = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    over ? bad('phone width ' + url, 'page scrolls sideways') : ok('no sideways scroll at 390px: ' + url);
    await m.close();
  }

  // ---- Short read on top, full story below, no toggle, on every case page
  for (const pg of ['bachata-connect','tsb','oslo-university-hospital','amplifon','lego','orth','serova','wise']) {
    const URL = 'http://localhost:8099/work/' + pg + '.html';
    const rp = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const rerr = [];
    rp.on('pageerror', e => rerr.push(e.message));
    await rp.goto(URL, { waitUntil: 'networkidle' });
    const summaryShown = await rp.locator('.reads .sum').isVisible();
    const fullShown = await rp.locator('#full').isVisible();
    const lines = await rp.locator('.sum > div').count();
    const noToggle = (await rp.locator('.reads button').count()) === 0 && (await rp.locator('[data-mode]').count()) === 0;
    const over = await rp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    const summaryBeforeFull = await rp.evaluate(() => {
      const s = document.querySelector('.reads').getBoundingClientRect().top;
      const f = document.querySelector('#full').getBoundingClientRect().top;
      return s < f;
    });
    const np = await (await browser.newContext({ javaScriptEnabled: false })).newPage();
    await np.goto(URL, { waitUntil: 'load' });
    const noJs = (await np.locator('#full').isVisible()) && (await np.locator('.reads .sum').isVisible());
    await np.close();
    const checks = { summaryShown, fullShownWithoutClicking: fullShown, fourLines: lines === 4, noToggle, summaryBeforeFull, noSidewaysScroll: !over, noJs, noErrors: rerr.length === 0 };
    const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
    failed.length === 0 ? ok('short read then full story, no clicking: ' + pg) : bad('short read and full story: ' + pg, failed.join(', ') + (rerr.length ? ' | ' + rerr.join(';') : ''));
    await rp.close();
  }

  // ---- tap target sizes on phone
  const m2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await m2.goto('http://localhost:8099/', { waitUntil: 'networkidle' });
  const small = await m2.$$eval('.acts a, .bar nav a, .lines a', els =>
    els.filter(e => e.offsetParent !== null).map(e => ({ t: (e.textContent||'').trim().slice(0,20), h: Math.round(e.getBoundingClientRect().height) }))
       .filter(x => x.h < 24));
  small.length === 0 ? ok('tap targets are reasonable on phone') : bad('small tap targets', JSON.stringify(small));
  await m2.close();

  // ---- no image is ever stretched or squashed (pages + every lightbox image), desktop and phone
  const ratioErr = i => Math.abs((i.clientWidth / i.clientHeight) / (i.naturalWidth / i.naturalHeight) - 1);
  for (const w of [1440, 390]) {
    const ap = await browser.newPage({ viewport: { width: w, height: 900 } });
    const distorted = [];
    for (const pg of ['/', '/work/bachata-connect.html', '/work/tsb.html', '/work/oslo-university-hospital.html', '/work/amplifon.html', '/work/lego.html', '/work/orth.html', '/work/serova.html', '/work/wise.html']) {
      await ap.goto('http://localhost:8099' + pg + (pg.startsWith('/work/') ? '#full' : ''), { waitUntil: 'networkidle' });
      await ap.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 25)); } });
      const d = await ap.$$eval('img', (is, f) => { const e = new Function('return ' + f)(); return is.filter(i => i.complete && i.naturalWidth && i.offsetWidth && ['fill', ''].includes(getComputedStyle(i).objectFit) && e(i) > 0.01).map(i => i.getAttribute('src')); }, ratioErr.toString());
      d.forEach(s => distorted.push(pg + ' ' + s));
    }
    distorted.length === 0 ? ok('no image distorted at ' + w + 'px') : bad('distorted images at ' + w + 'px', distorted.join(', '));
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
