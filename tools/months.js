const p = require('puppeteer-core');
(async () => {
  const b = await p.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
  const pg = await b.newPage();
  await pg.goto('https://sierrastems.com/diy/?v=' + Date.now(), { waitUntil: 'networkidle0' });
  const opts = await pg.$$eval('select[name=month] option', o => o.map(x => x.value));
  console.log(opts.join(','));
  for (const m of ['March', 'July', 'October']) {
    await pg.select('select[name=month]', m);
    await new Promise(r => setTimeout(r, 2500));
    console.log(m, await pg.$eval('[data-count]', e => e.textContent));
  }
  await b.close();
})();
