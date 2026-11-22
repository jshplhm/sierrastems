# Sierra Stems

Wholesale flower site for Sierra Stems in Nevada City, serving Tahoe, Truckee, Nevada County, and Sacramento. It has two price lists:

- **Florists** (`/availability/`): the weekly California grown list, behind a trade code.
- **DIY weddings** (`/diy/`): the monthly price guide by the bunch, open to everyone.

It's a static Jekyll site with plain CSS and JavaScript, deployed to GitHub Pages. Both lists are read from Google Sheets, and orders from either list go to a Google Apps Script that logs them to a sheet and emails you.

```
_config.yml              Site settings: sheet URL, order URL, contact details, terms
_data/availability.yml   Sample stems, shown only if the live sheet can't be read
_data/fulfillment.yml    Florist pickup and delivery options and fees
_data/fulfillment_diy.yml  DIY pickup and delivery options
_data/diy_months.yml     Months with a posted wholesale list; prices in assets/data/diy/<Month>.json
_data/seasonality.yml    The month chart on /sourcing/
_data/images.yml         Photo slots: file name and alt text for each
assets/images/           Drop real photos here
assets/js/ss.js          Shared code: CSV loader, order list, header menu
assets/js/availability.js, diy.js, order.js, home.js
apps-script/Code.gs      Order intake (paste into Google Apps Script)
docs/availability-template.csv
```

## Before launch: fill in the placeholders

Search the repo for `[` placeholders:

| Where | What |
|---|---|
| `_config.yml` → `business` | email, phone, Instagram handle |
| `_config.yml` → `terms` | order cutoff, payment terms; DIY minimum and fees are set to $500 / $50 / 15% |
| `_config.yml` → `url` | your real domain |
| `apps-script/Code.gs` | `ORDER_EMAIL` |
| `_data/images.yml` + `assets/images/` | real photos and alt text |
| `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `assets/images/og-default.jpg` | logo and share image |

Read through the substitution and quality wording on `/terms/` and the crop windows in `_data/seasonality.yml`. Both are drafts.

## Local development

You need Ruby 3.x and Bundler.

```sh
bundle install
bundle exec jekyll serve
```

Then open http://localhost:4000. Restart the server after you change `_config.yml`.

## Deploy to GitHub Pages

1. Create a GitHub repo and push this folder to its `main` branch.
2. In the repo, go to **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.
3. Every push to `main` runs `.github/workflows/pages.yml`, which builds the site and publishes it. Watch progress in the **Actions** tab.

Until the custom domain is set, the site lives at `https://<user>.github.io/<repo>/`. The workflow handles that sub-path for you.

## Custom domain

1. In **Settings → Pages → Custom domain**, enter `sierrastems.com` (or `www.sierrastems.com`) and save.
2. At your domain registrar, add these DNS records:
   - Apex (`sierrastems.com`): four `A` records pointing to `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`. Optionally add `AAAA` records for `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`.
   - `www`: a `CNAME` record pointing to `<user>.github.io`.
3. Wait for DNS to update, from minutes up to a few hours, then tick **Enforce HTTPS**.
4. Make sure `url` in `_config.yml` matches the domain. Canonical links, the sitemap, and share tags all use it.

## Weekly florist list (Google Sheet)

### Set up once

1. Create a Google Sheet. Import `docs/availability-template.csv` with **File → Import → Upload → Replace current sheet**, or paste the header row:

   `name, variety, category, color, stem_length, unit, price, qty_available, farm, region, nevada_county, image_url, active, updated`

2. Rename the tab to `Availability`.
3. Go to **File → Share → Publish to web**. Under **Link**, choose the **Availability** tab (not "Entire document") and **Comma-separated values (.csv)**, then click **Publish**.
4. Copy the link. It looks like `https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?gid=0&single=true&output=csv`.
5. Paste it into `_config.yml` as `availability_csv_url`, then commit and push.

Publishing to the web makes that tab public. Keep wholesale costs, customer data, and orders in a different spreadsheet.

### Columns

| Column | Example | Notes |
|---|---|---|
| name | Garden Rose | Required |
| variety | Juliet | |
| category | focal | `focal`, `filler`, or `textural`. Other words get their own filter chip |
| color | Peach | Drives the color filter and swatch dot |
| stem_length | 50 cm | Free text |
| unit | Bunch of 10 | Or `Stem` |
| price | 42 | Price per unit. `$` is fine |
| qty_available | 24 | Units available. `0` shows Sold out. Order inputs can't go above it |
| farm | Sierra Stems Farm | |
| region | Nevada County | |
| nevada_county | TRUE | TRUE shows the badge and exempts the stem from the minimum |
| image_url | https://... | Optional thumbnail. Must be a public image URL |
| active | TRUE | Only TRUE rows show on the site |
| updated | 2026-11-20 | The latest date across active rows becomes "Last updated" |

### Each week

1. Edit the sheet: update prices and quantities, set `active` to FALSE for anything out, add new rows, and set `updated` to today on rows you touched.
2. That's it. Google refreshes the published CSV within about 5 minutes, and the site reads it on every page load. You don't need to change code or redeploy.

If the sheet can't be reached, the site shows `_data/availability.yml` with a note saying the live list didn't load. To keep that backup current, export the sheet as CSV now and then and update the YAML.

Changing a row's name, variety, color, unit, or farm gives it a new identity. Any copy of it already in a customer's order list then shows as "not on this week's list". Price and quantity changes carry over automatically.

## Trade code

The florist list asks for a trade code before it shows prices. The site stores only its SHA-256 hash in `_config.yml` as `trade_code_sha256`. To change the code:

```sh
printf 'newcode' | shasum -a 256
```

Paste the hash into `_config.yml` and push. Everyone who entered the old code is asked for the new one. Codes are not case-sensitive.

This keeps brides from casually seeing wholesale prices. It is not real security: the published florist sheet link is in the page source, and anyone determined can open it. Every order is a request, and Brittany confirms the business before anything is final.

## DIY price guide (Google Sheet)

The site reads Brittany's "Wholesale price guide" live (diy_sheet_id in _config.yml, tab named after each month). Only months listed in `_data/diy_months.yml` appear in the month menu, because Google returns the FIRST tab when asked for a tab that does not exist. When she adds a month tab, add the month to that list. `assets/data/diy/<Month>.json` is a saved copy used if the live read fails.

The DIY guide has one tab per month. Each tab has a title row, a note row, then `Category, Item, Stems/Bunch, Price`. The site finds the header row itself and ignores the rows above it.

1. If the guide is an `.xlsx` file in Drive, open it and choose **File → Save as Google Sheets**. The site can't read `.xlsx`.
2. Name each tab with its full month name: `January`, `February`, and so on.
3. Click **Share**, set **General access** to **Anyone with the link: Viewer**, and copy the ID from the URL (the long part between `/d/` and `/edit`).
4. Paste it into `_config.yml` as `diy_sheet_id` and push.

Alternative: publish each month tab as CSV (**File → Share → Publish to web**) and list the links under `diy_csv_urls` in `_config.yml`, one per month. A link set for a month takes priority over the sheet ID.

Couples pick their wedding month, and the site loads that month's tab. A month with no tab says "not posted yet". Rows whose Item is a length (like `50 CM`) are named from the Category, for example "Ecuadorian Roses - Specialty, 50 cm". `GB` shows as "Grower bunch", `20 bu` as "Case of 20 bunches", and `Per Foot` is priced per foot.

DIY orders add the labor and packaging percent and the transportation fee from `_config.yml` → `terms`, and warn below the DIY minimum.

## Orders (Google Apps Script)

1. Create a new Google Sheet called "Sierra Stems Orders". Keep it separate from the availability sheet.
2. In that sheet, open **Extensions → Apps Script**, delete the starter code, and paste in `apps-script/Code.gs`.
3. Set `ORDER_EMAIL` at the top. Use commas for more than one address.
4. Click **Save**. Choose `testOrder` in the function menu and click **Run**. Approve the permissions; it needs Sheets and Gmail. An "Orders" tab should appear with a test row, and an email should arrive. Delete the test row.
5. Click **Deploy → New deployment**, set the type (gear icon) to **Web app**, and set:
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Click **Deploy** and copy the **Web app URL**, which ends in `/exec`.
7. Paste it into `_config.yml` as `order_endpoint`, then commit and push.
8. Place a test order on the live site.

When you edit the script later, use **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**. That keeps the same URL. A **New deployment** creates a new URL, and the site would keep calling the old one.

Each row records which list the order came from (Florist or DIY wedding), the DIY price month, labor and transportation fees, and an estimated total. The email subject starts with "Florist order" or "DIY wedding order".

How it works: the site sends the order as `text/plain` so the browser skips the CORS preflight that Apps Script can't answer. The script recomputes totals from the line items, blocks spreadsheet formula injection, drops honeypot bots, and replies with JSON `{ ok, id }`. If `order_endpoint` is empty or the request fails, the order page offers to send the order by email instead.

## Photos

Placeholders are in `assets/images/`. To replace one, save a JPG with the same file name at about the listed size: 1600×1067 for landscape slots, 1200×1500 for portrait. Then rewrite its alt text in `_data/images.yml` to describe the real photo. Keep files under about 300 KB; export at quality 70 to 75.

## SEO

- Each page sets its own `title` and `description` in front matter. `jekyll-seo-tag` writes the title, meta description, canonical link, and Open Graph and Twitter tags.
- LocalBusiness (`WholesaleStore`) JSON-LD is in `_includes/schema.html` and reads from `_config.yml`. Phone, email, and Instagram are left out until you replace the placeholders.
- `jekyll-sitemap` builds `/sitemap.xml`, and `robots.txt` points to it.
- After launch, add the domain in Google Search Console and submit the sitemap.
