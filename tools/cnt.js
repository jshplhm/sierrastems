const p = require('puppeteer-core');
const H = 'f19a336b55b94a20ad07766814fa4870260140229f5ec559de4221031388a045';
const base = process.argv[2] || 'http://localhost:4010';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await p.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
  const pg = await b.newPage();
  pg.on('pageerror', e => console.log('ERR', e.message));
  await pg.evaluateOnNewDocument(h => window.localStorage.setItem('ss-trade', h), H);
  await pg.goto(base + '/availability/?v=' + Date.now(), { waitUntil: 'networkidle0' });
  await wait(1000);
  for (const m of ["Valentine's Day", "Mother's Day"]) {
    await pg.select('select[name=list]', m);
    await wait(2500);
    const n = await pg.$$eval('[data-photo]', x => x.length);
    const rows = await pg.$$eval('.stem-row:not(.stem-header)', x => x.length);
    const srcs = await pg.$$eval('.c-photo img', x => x.map(i => i.dataset.src));
    let bad = 0;
    for (const s of srcs) { const r = await pg.evaluate(u => fetch(u).then(r => r.status), s); if (r !== 200) bad++; }
    console.log(m, 'rows', rows, 'photos', n, 'bad', bad);
  }
  await b.close();
})();
