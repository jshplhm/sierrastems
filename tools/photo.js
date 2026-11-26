const p = require('puppeteer-core');
const H = 'f19a336b55b94a20ad07766814fa4870260140229f5ec559de4221031388a045';
const base = process.argv[2] || 'http://localhost:4010';
const out = '' + (process.env.OUT || '/tmp') + '';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await p.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
  for (const w of [480, 1200]) {
    const ctx = await b.createBrowserContext();
    const pg = await ctx.newPage();
    pg.on('pageerror', e => console.log('ERR', e.message));
    await pg.setViewport({ width: w, height: 1000 });
    await pg.evaluateOnNewDocument(h => window.localStorage.setItem('ss-trade', h), H);
    await pg.goto(base + '/availability/?v=' + Date.now(), { waitUntil: 'networkidle0' });
    await wait(800);
    await pg.select('select[name=list]', process.argv[3] === 'week' ? '' : (process.argv[3] || 'November'));
    await wait(3000);
    const n = await pg.$$eval('.stem-row .c-img img', i => i.length);
    const total = await pg.$$eval('.stem-row:not(.stem-header)', i => i.length);
    const broken = await pg.$$eval('.stem-row .c-img img', i => i.filter(x => x.complete && x.naturalWidth === 0).length);
    console.log(w, 'rows', total, 'with photo', n, 'broken', broken);
    await pg.evaluate(() => window.scrollTo(0, 250));
    await wait(800);
    await pg.screenshot({ path: `${out}/photo-${w}.png` });
    await ctx.close();
  }
  await b.close();
})();
