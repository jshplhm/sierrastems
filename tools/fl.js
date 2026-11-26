const p = require('puppeteer-core');
const out = process.argv[2];
const H = 'f19a336b55b94a20ad07766814fa4870260140229f5ec559de4221031388a045';
const base = process.argv[3] || 'http://localhost:4010';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await p.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
  for (const w of [480, 954]) {
    const ctx = await b.createBrowserContext();
    const pg = await ctx.newPage();
    pg.on('pageerror', e => console.log('ERR', e.message));
    await pg.setViewport({ width: w, height: 1000 });
    await pg.evaluateOnNewDocument(h => window.localStorage.setItem('ss-trade', h), H);
    await pg.goto(base + '/availability/?v=' + Date.now(), { waitUntil: 'networkidle0' });
    await wait(1500);
    console.log(w, 'week:', await pg.$eval('[data-count]', e => e.textContent), '|', await pg.$eval('[data-updated]', e => e.textContent));
    await pg.screenshot({ path: `${out}/fl-week-${w}.png` });
    let btns = await pg.$$('[data-list] .qty-btn[data-step="1"]');
    await btns[0].click(); await btns[0].click();
    await pg.select('select[name=list]', 'March');
    await wait(2500);
    console.log(w, 'march:', await pg.$eval('[data-count]', e => e.textContent), '|', await pg.$eval('[data-updated]', e => e.textContent), '|', await pg.$eval('h1', e => e.textContent));
    btns = await pg.$$('[data-list] .qty-btn[data-step="1"]');
    await btns[0].click(); await btns[2].click();
    await wait(400);
    await pg.screenshot({ path: `${out}/fl-march-${w}.png` });
    await pg.goto(base + '/order/?list=trade', { waitUntil: 'networkidle0' });
    await wait(2500);
    console.log(await pg.$$eval('.line', ls => ls.map(l => l.innerText.replace(/\s+/g, ' ').slice(0, 110)).join('\n')));
    await pg.screenshot({ path: `${out}/fl-order-${w}.png`, fullPage: true });
    await ctx.close();
  }
  await b.close();
})();
