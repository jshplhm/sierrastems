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
    await wait(2000);
    const btns = await pg.$$('[data-photo]');
    const loadedBefore = await pg.$$eval('.c-photo img[src]', i => i.length);
    console.log(w, 'photo buttons', btns.length, 'thumbs', await pg.$$eval('.c-img img', i => i.length), 'loaded before click', loadedBefore);
    await pg.evaluate(() => window.scrollTo(0, 250));
    await wait(300);
    await pg.screenshot({ path: `${out}/pdrop-closed-${w}.png` });
    await btns[0].click();
    await wait(1200);
    await pg.screenshot({ path: `${out}/pdrop-open-${w}.png` });
    await btns[0].click();
    await wait(300);
    console.log(w, 'closed again', await pg.$eval('.c-photo', e => e.hidden));
    await ctx.close();
  }
  await b.close();
})();
