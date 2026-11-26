# Helper scripts (not part of the site)

Run from a folder that has `puppeteer-core` installed (`npm i puppeteer-core@22.15.0 --cache <somewhere writable>`; ~/.npm has a permissions problem on this Mac). Chrome path is hard-coded to /Applications/Google Chrome.app. Screenshots go to `$OUT` (default /tmp).

- `photomap.py <saved htmlview.html>` prints JSON Item -> Google Drive file id from the Photo Links column.
  Get the html with: `curl -sL "https://docs.google.com/spreadsheets/d/10O2GSk8-nz15t84NOYJjPSVHqO6MUC4KGYoblx9WwSc/htmlview/sheet?headers=true&gid=<GID>" -o tab.html`
  Then add a block to `_data/florist_photos.yml` (list name -> item -> id; strip "(per stem)" from item names) and save each photo:
  `curl -sL "https://drive.google.com/thumbnail?id=<ID>&sz=w960" -o /tmp/x.jpg && sips -s formatOptions 72 /tmp/x.jpg --out assets/images/florist/<ID>.jpg`
- `fl.js <outdir> [base]` florist list: this week + March, adds stems, checks the order page.
- `photo.js [base] [week|Month]` counts photo buttons. `pdrop.js [base]` opens/closes a photo. `cnt.js [base]` holiday lists photo count + broken images.
- `vkale.js [base]` prints rows matching a regex on a couple of lists (edit the regex/list inside).
- `months.js` DIY month menu + item counts on the live site.
- Local server: `bundle exec jekyll serve --port 4010 --detach` (does NOT rebuild on change: `pkill -f "jekyll serve"` and start again).
