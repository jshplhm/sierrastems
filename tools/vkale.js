const p = require('puppeteer-core');
const H = 'f19a336b55b94a20ad07766814fa4870260140229f5ec559de4221031388a045';
const base = process.argv[2] || 'http://localhost:4010';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await p.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
  const pg = await b.newPage();
  pg.on('pageerror', e => console.log('ERR', e.message));
  await pg.setViewport({ width: 954, height: 1000 });
  await pg.evaluateOnNewDocument(h => window.localStorage.setItem('ss-trade', h), H);
  await pg.goto(base + '/availability/?v=' + Date.now(), { waitUntil: 'networkidle0' });
  await wait(1000);
  for (const m of ["", "November"]) {
    await pg.select('select[name=list]', m);
    await wait(2500);
    const rows = await pg.$$eval('.stem-row', rs => rs.filter(r => /magnolia/i.test(r.textContent)).map(r => r.innerText.replace(/\s+/g, ' ').replace(/ − \+$/, '')));
    console.log((m || 'This week') + ':\n  ' + rows.join('\n  '));
  }
  await b.close();
})();
