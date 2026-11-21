/**
 * SierraStems order intake.
 *
 * Receives order requests from the website (/order/), appends each one to the
 * "Orders" sheet, and emails a summary. Deploy as a web app (see README, "Orders").
 *
 * The site POSTs JSON with Content-Type text/plain so the browser sends a
 * "simple" request with no CORS preflight. Apps Script can't answer preflights,
 * so keep it that way.
 */

var ORDER_EMAIL = '[ORDER EMAIL]';   // where order summaries go; comma-separate for several
var SHEET_NAME = 'Orders';
var HEADERS = ['Timestamp', 'Reference', 'List', 'Name or business', 'Contact', 'Email', 'Phone',
  'Date', 'Price month', 'Fulfillment', 'Fulfillment fee', 'Line items (JSON)', 'Flowers subtotal',
  'Off-season subtotal', 'Labor and packaging', 'Transportation', 'Estimated total', 'Below minimum', 'Notes'];

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    // Honeypot: bots fill the hidden "website" field. Pretend it worked.
    if (data.website) return json_({ ok: true, id: '' });

    var business = clean_(data.business, 200);
    if (!business) return json_({ ok: false, error: 'Business name is required.' });
    if (!clean_(data.email, 200) && !clean_(data.phone, 50)) {
      return json_({ ok: false, error: 'Email or phone is required.' });
    }

    // Recompute totals from the line items rather than trusting the client.
    var items = (Array.isArray(data.items) ? data.items : []).slice(0, 200).map(function (i) {
      var price = Number(i.price) || 0;
      var qty = Math.max(0, Math.floor(Number(i.qty) || 0));
      return {
        name: clean_(i.name, 120), variety: clean_(i.variety, 120), color: clean_(i.color, 60),
        stem_length: clean_(i.stem_length, 40), unit: clean_(i.unit, 60),
        price: price, qty: qty, line_total: round2_(price * qty),
        farm: clean_(i.farm, 120), region: clean_(i.region, 120), month: clean_(i.month, 20),
        nevada_county: !!i.nevada_county, listed: i.listed !== false
      };
    }).filter(function (i) { return i.qty > 0; });

    var subtotal = 0, offseason = 0;
    items.forEach(function (i) { subtotal += i.line_total; if (!i.nevada_county) offseason += i.line_total; });
    subtotal = round2_(subtotal); offseason = round2_(offseason);

    var tz = Session.getScriptTimeZone() || 'America/Los_Angeles';
    var now = new Date();
    var ref = 'SS-' + Utilities.formatDate(now, tz, 'yyMMdd-HHmm') + '-' + Math.floor(Math.random() * 900 + 100);
    var fee = data.fulfillment_fee === null || data.fulfillment_fee === undefined ? 'Quoted' : Number(data.fulfillment_fee);

    var isDiy = data.list === 'diy';
    var labor = round2_(Number(data.labor_fee) || 0);
    var transport = round2_(Number(data.transport_fee) || 0);
    var order = {
      ref: ref,
      list: isDiy ? 'DIY wedding' : 'Florist',
      months: clean_(data.price_months, 120),
      labor: labor,
      transport: transport,
      total: round2_(subtotal + labor + transport + (typeof fee === 'number' ? fee : 0)),
      business: business,
      contact: clean_(data.contact, 200),
      email: clean_(data.email, 200),
      phone: clean_(data.phone, 50),
      need_by: clean_(data.need_by, 20),
      fulfillment: clean_(data.fulfillment, 120),
      fee: fee,
      items: items,
      subtotal: subtotal,
      offseason: offseason,
      below_minimum: !!data.below_minimum,
      notes: clean_(data.notes, 4000)
    };

    sheet_().appendRow([
      now, ref, order.list, order.business, order.contact, order.email, order.phone, order.need_by,
      order.months, order.fulfillment, fee, JSON.stringify(items), subtotal, offseason,
      labor, transport, order.total, order.below_minimum ? 'YES' : '', order.notes
    ].map(safeCell_));

    sendEmail_(order);
    return json_({ ok: true, id: ref });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'Server error. Please email your order instead.' });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

// Visiting the web app URL in a browser shows this. Handy to confirm it is live.
function doGet() {
  return json_({ ok: true, service: 'SierraStems orders' });
}

/* ---------- Helpers ---------- */

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sh;
}

function sendEmail_(o) {
  if (!ORDER_EMAIL || ORDER_EMAIL.indexOf('[') === 0) return;
  var money = function (n) { return typeof n === 'number' ? '$' + n.toFixed(2) : String(n); };
  var rows = o.items.map(function (i) {
    return '<tr>' +
      td_(i.qty) +
      td_('<b>' + esc_(i.name) + '</b> ' + esc_(i.variety) + '<br><span style="color:#69655d">' +
        esc_([i.color, i.stem_length, i.unit].filter(String).join(' · ')) + '<br>' +
        (i.month ? esc_(i.month) + ' prices' : esc_(i.farm) + (i.region ? ', ' + esc_(i.region) : '')) + (i.nevada_county ? ' · Nevada County grown' : '') +
        (i.listed ? '' : ' · <b style="color:#94523b">not on current list</b>') + '</span>') +
      td_(money(i.price), true) + td_(money(i.line_total), true) +
      '</tr>';
  }).join('');

  var html =
    '<div style="font-family:Helvetica,Arial,sans-serif;color:#2b2a28;max-width:640px">' +
    '<h2 style="font-family:Georgia,serif;font-weight:normal;color:#24392e;margin:0 0 4px">' + esc_(o.list) + ' order: ' + esc_(o.business) + '</h2>' +
    '<p style="color:#69655d;margin:0 0 16px">' + esc_(o.ref) + '</p>' +
    (o.below_minimum ? '<p style="background:#f3e4dc;border-left:3px solid #94523b;padding:10px 12px">Below the order minimum.</p>' : '') +
    '<table style="border-collapse:collapse;width:100%;font-size:14px;margin-bottom:16px">' +
    kv_('Contact', o.contact) + kv_('Email', o.email) + kv_('Phone', o.phone) +
    kv_('Date', o.need_by) + kv_('Price month', o.months) + kv_('Fulfillment', o.fulfillment + ' (' + money(o.fee) + ')') +
    '</table>' +
    '<table style="border-collapse:collapse;width:100%;font-size:14px">' +
    '<tr style="text-align:left;color:#69655d">' + th_('Qty') + th_('Stem') + th_('Each', true) + th_('Total', true) + '</tr>' +
    (rows || '<tr><td colspan="4" style="padding:8px 0">No stems listed. See notes.</td></tr>') +
    '<tr>' + td_('') + td_('Flowers') + td_('') + td_(money(o.subtotal), true) + '</tr>' +
    (o.labor ? '<tr>' + td_('') + td_('Labor and packaging') + td_('') + td_(money(o.labor), true) + '</tr>' : '') +
    (o.transport ? '<tr>' + td_('') + td_('Transportation') + td_('') + td_(money(o.transport), true) + '</tr>' : '') +
    '<tr>' + td_('') + td_('<b>Estimated total</b>') + td_('') + td_('<b>' + money(o.total) + '</b>', true) + '</tr>' +
    '</table>' +
    (o.notes ? '<h3 style="font-size:14px;margin:20px 0 4px">Notes</h3><p style="white-space:pre-wrap;margin:0">' + esc_(o.notes) + '</p>' : '') +
    '</div>';

  var text = o.list + ' order: ' + o.business + ' (' + o.ref + ')\n' +
    'Contact: ' + o.contact + '\nEmail: ' + o.email + '\nPhone: ' + o.phone + '\nNeed by: ' + o.need_by +
    '\nFulfillment: ' + o.fulfillment + ' (' + money(o.fee) + ')\n\n' +
    o.items.map(function (i) { return i.qty + ' x ' + i.name + ' ' + i.variety + ' (' + i.unit + ') ' + money(i.line_total); }).join('\n') +
    '\n\nFlowers: ' + money(o.subtotal) + (o.labor ? '\nLabor and packaging: ' + money(o.labor) : '') +
    (o.transport ? '\nTransportation: ' + money(o.transport) : '') + '\nEstimated total: ' + money(o.total) +
    (o.below_minimum ? '\nBELOW ORDER MINIMUM' : '') +
    '\n\nNotes: ' + o.notes;

  var opts = { htmlBody: html, name: 'SierraStems Orders' };
  if (o.email) opts.replyTo = o.email;
  MailApp.sendEmail(ORDER_EMAIL, o.list + ' order: ' + o.business + ' · ' + money(o.total), text, opts);
}

function kv_(k, v) {
  return v ? '<tr><td style="padding:3px 16px 3px 0;color:#69655d;width:110px">' + esc_(k) + '</td><td style="padding:3px 0">' + esc_(v) + '</td></tr>' : '';
}
function th_(s, right) { return '<th style="padding:6px 8px 6px 0;border-bottom:1px solid #e1dacc;font-weight:normal' + (right ? ';text-align:right' : '') + '">' + s + '</th>'; }
function td_(s, right) { return '<td style="padding:8px 8px 8px 0;border-bottom:1px solid #e1dacc;vertical-align:top' + (right ? ';text-align:right;white-space:nowrap' : '') + '">' + s + '</td>'; }

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function clean_(v, max) { return String(v === null || v === undefined ? '' : v).trim().slice(0, max || 500); }
function round2_(n) { return Math.round(n * 100) / 100; }
function esc_(s) {
  return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
// Stop text that starts with = + - @ from running as a spreadsheet formula.
function safeCell_(v) {
  return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v;
}

/** Run once from the editor to check the sheet and email work. */
function testOrder() {
  var res = doPost({ postData: { contents: JSON.stringify({
    business: 'Test Florist', contact: 'Test', email: '', phone: '555-0100', need_by: '2027-05-01',
    fulfillment: 'Pickup, Nevada City studio', fulfillment_fee: 0,
    items: [{ name: 'Dahlia', variety: 'Café au Lait', unit: 'Bunch of 5', price: 18, qty: 2, farm: 'SierraStems Farm', region: 'Nevada County', nevada_county: true }],
    notes: 'Test order from the script editor. Delete this row.'
  }) } });
  console.log(res.getContent());
}
