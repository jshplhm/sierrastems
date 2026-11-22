/* Order page: one form for either price list (florist 'trade' or 'diy'). */
(function () {
  'use strict';
  var SS = window.SS;
  var root = document.querySelector('[data-order-root]');
  if (!SS || !root) return;

  var esc = SS.escapeHtml;
  var C = SS.config;
  var $ = function (sel) { return document.querySelector(sel); };
  var form = root.querySelector('[data-order-form]');
  var linesEl = root.querySelector('[data-lines]');
  var emptyEl = root.querySelector('[data-empty-order]');
  var addMore = root.querySelector('[data-add-more]');
  var syncNote = root.querySelector('[data-sync-note]');
  var errEl = root.querySelector('[data-form-error]');
  var submitBtn = root.querySelector('[data-submit]');
  var missing = {};

  /* ---------- Which list ---------- */
  var tradeN = SS.carts.trade.items().length;
  var diyN = SS.carts.diy.items().length;
  var unlocked = SS.trade.isUnlocked();
  var mode = new URLSearchParams(location.search).get('list');
  if (mode !== 'trade' && mode !== 'diy') {
    if (tradeN && unlocked) mode = 'trade';
    else if (diyN) mode = 'diy';
    else if (tradeN) mode = 'trade';
    else mode = unlocked ? 'trade' : 'diy';
  }
  var isDiy = mode === 'diy';
  var cart = SS.carts[mode];
  var locked = !isDiy && !unlocked;

  var fulfillment = [];
  try { fulfillment = JSON.parse(document.getElementById(isDiy ? 'ss-fulfillment-diy' : 'ss-fulfillment').textContent) || []; } catch (e) { fulfillment = []; }

  /* Tabs when both lists have something in them. */
  if (tradeN && diyN) {
    var tabs = $('[data-list-tabs]');
    tabs.hidden = false;
    Array.prototype.forEach.call(tabs.querySelectorAll('[data-tab]'), function (a) {
      var n = a.dataset.tab === 'trade' ? tradeN : diyN;
      a.querySelector('[data-tab-count]').textContent = '(' + n + ')';
      if (a.dataset.tab === mode) a.setAttribute('aria-current', 'page');
    });
  }

  /* Wording and fields for this list. */
  root.querySelector('[data-items-title]').textContent = isDiy ? 'DIY wedding flowers' : 'Florist order';
  root.querySelector('[data-business-label]').textContent = isDiy ? 'Your name' : 'Business name';
  form.elements.business.setAttribute('autocomplete', isDiy ? 'name' : 'organization');
  root.querySelector('[data-date-label]').textContent = isDiy ? 'Wedding date' : 'Event or need-by date';
  root.querySelector('[data-notes]').placeholder = isDiy
    ? 'Colors, venue, guest count, and when you would like to pick up.'
    : 'Color direction, substitutions you will or will not accept, pickup time.';
  root.querySelector('[data-add-more-link]').href = isDiy ? C.diyUrl : C.availabilityUrl;
  Array.prototype.forEach.call(form.querySelectorAll('[data-fulfillment]'), function (fs) {
    var on = fs.dataset.fulfillment === mode;
    fs.hidden = !on;
    fs.disabled = !on;
  });
  if (locked) {
    root.querySelector('[data-locked]').hidden = false;
    form.hidden = true;
    emptyEl.hidden = true;
  }

  var d = new Date();
  form.elements.need_by.min = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

  function currentFulfillment() {
    var v = (form.querySelector('input[name="fulfillment-' + mode + '"]:checked') || {}).value;
    for (var i = 0; i < fulfillment.length; i++) if (fulfillment[i].id === v) return fulfillment[i];
    return fulfillment[0] || { id: '', label: '', short: '', fee: 0 };
  }

  /* ---------- Lines ---------- */
  function lineHtml(l) {
    var label = esc(l.name + (l.variety ? ' ' + l.variety : ''));
    var max = l.qty_available != null ? ' max="' + l.qty_available + '"' : '';
    var meta = isDiy
      ? [esc(l.unit), SS.money(l.price) + (/^per\s+/i.test(l.unit) ? ' ' + esc(l.unit.toLowerCase()) : ' a bunch'), esc(l.month) + ' prices'].join(' · ')
      : [esc(l.color), esc(l.stem_length), esc(l.unit)].filter(Boolean).join(' · ') + ' · ' + SS.money(l.price) + ' each';
    var source = isDiy ? '' : '<p class="line-source">' + esc(l.farm) + (l.region ? ', ' + esc(l.region) : '') +
      (l.nevada_county ? ' <span class="badge">Nevada County grown</span>' : '') + '</p>';
    return '<li class="line' + (missing[l.id] ? ' is-missing' : '') + '" data-id="' + esc(l.id) + '">' +
      '<div class="line-main">' +
        '<p class="line-name"><strong>' + esc(l.name) + '</strong>' + (l.variety ? ' ' + esc(l.variety) : '') + '</p>' +
        '<p class="line-meta">' + meta + '</p>' + source +
        (missing[l.id] ? '<p class="line-flag">Not on this week\'s list. We will check and confirm.</p>' : '') +
      '</div>' +
      '<div class="line-side">' +
        '<span class="qty">' +
          '<button type="button" class="qty-btn" data-step="-1" aria-label="One fewer ' + label + '">&minus;</button>' +
          '<input type="number" inputmode="numeric" min="0"' + max + ' step="1" value="' + l.qty + '" aria-label="Quantity of ' + label + '">' +
          '<button type="button" class="qty-btn" data-step="1" aria-label="One more ' + label + '">+</button>' +
        '</span>' +
        '<span class="line-total">' + SS.money(l.price * l.qty) + '</span>' +
        '<button type="button" class="link-btn line-remove" data-remove aria-label="Remove ' + label + '">Remove</button>' +
      '</div>' +
    '</li>';
  }

  function renderLines() {
    if (locked) return;
    var lines = cart.items();
    linesEl.innerHTML = lines.map(lineHtml).join('');
    emptyEl.hidden = lines.length > 0;
    document.documentElement.classList.toggle('has-order', lines.length > 0);
    addMore.hidden = lines.length === 0;
    summarize();
  }

  function round2(n) { return Math.round(n * 100) / 100; }
  function wholeMoney(n) { return SS.money(n).replace(/\.00$/, ''); }

  function summarize() {
    var lines = cart.items();
    var t = cart.totals(lines);
    var f = currentFulfillment();
    var fee = typeof f.fee === 'number' ? f.fee : null;
    var labor = 0, transport = 0;
    if (isDiy && t.subtotal > 0) {
      labor = round2(t.subtotal * (Number(C.diy.laborPct) || 0) / 100);
      transport = Number(C.diy.transport) || 0;
    }
    root.querySelector('[data-row-labor]').hidden = !isDiy;
    root.querySelector('[data-row-transport]').hidden = !isDiy;
    root.querySelector('[data-labor]').textContent = SS.money(labor);
    root.querySelector('[data-transport]').textContent = SS.money(transport);
    root.querySelector('[data-subtotal]').textContent = SS.money(t.subtotal);
    root.querySelector('[data-fee-label]').textContent = f.short || 'Fulfillment';
    root.querySelector('[data-fee]').textContent = fee === 0 ? 'Free' : (fee == null ? (f.fee_label || 'Quoted') : SS.money(fee) + (f.fee_suffix ? ' ' + f.fee_suffix : ''));
    var total = round2(t.subtotal + labor + transport + (fee || 0));
    root.querySelector('[data-total]').textContent = SS.money(total) + (fee == null ? ' + delivery' : '');

    var warn = root.querySelector('[data-minimum]');
    var msg = '';
    if (isDiy) {
      var dmin = Number(C.diy.minimum) || 0;
      if (t.subtotal > 0 && t.subtotal < dmin) {
        msg = 'Flowers total ' + SS.money(t.subtotal) + '. The order minimum is ' + wholeMoney(dmin) + ', so add ' +
          SS.money(dmin - t.subtotal) + ' more. You can still send this and we will talk it through.';
      }
    } else {
      var min = Number(C.minimum) || 0;
      if (t.offseason > 0 && t.offseason < min) {
        msg = 'Off-season stems total ' + SS.money(t.offseason) + '. The off-season minimum is ' + wholeMoney(min) +
          ', so add ' + SS.money(min - t.offseason) + ' more. You can still send this and we will talk it through.';
      }
      var imin = Number(C.inseasonMinimum) || 0;
      if (t.offseason === 0 && t.subtotal > 0 && t.subtotal < imin) {
        msg = 'Flowers total ' + SS.money(t.subtotal) + '. The in-season minimum is ' + wholeMoney(imin) +
          ', so add ' + SS.money(imin - t.subtotal) + ' more. You can still send this and we will talk it through.';
      }
    }
    warn.textContent = msg;
    warn.hidden = !msg;
    return { totals: t, fulfillment: f, fee: fee, labor: labor, transport: transport, total: total, below: !!msg };
  }

  function setLineQty(li, qty) {
    var l = cart.get(li.dataset.id);
    if (!l) return;
    var applied = cart.set(l, qty);
    if (!applied) { renderLines(); return; }
    li.querySelector('input').value = applied;
    li.querySelector('.line-total').textContent = SS.money(l.price * applied);
    summarize();
  }

  linesEl.addEventListener('click', function (e) {
    var li = e.target.closest('.line');
    if (!li) return;
    if (e.target.closest('[data-remove]')) { cart.remove(li.dataset.id); renderLines(); return; }
    var b = e.target.closest('.qty-btn');
    if (b) setLineQty(li, (parseInt(li.querySelector('input').value, 10) || 0) + Number(b.dataset.step));
  });
  linesEl.addEventListener('change', function (e) {
    if (e.target.matches('input[type=number]')) setLineQty(e.target.closest('.line'), e.target.value);
  });

  function paintRadios() {
    Array.prototype.forEach.call(form.querySelectorAll('.radio-card'), function (c) {
      c.classList.toggle('is-checked', c.querySelector('input').checked);
    });
  }
  form.addEventListener('change', function (e) {
    if (/^fulfillment-/.test(e.target.name)) { paintRadios(); summarize(); }
  });

  /* Florist lines: bring prices and stock up to this week's list. */
  if (!isDiy && !locked) {
    SS.loadAvailability().then(function (data) {
      if (data.source === 'fallback') return;
      var byId = {};
      data.items.forEach(function (i) { byId[i.id] = i; });
      var changed = false, notes = [];
      var lines = cart.items().map(function (l) {
        var cur = byId[l.id];
        if (!cur) { missing[l.id] = true; return l; }
        var next = Object.assign({}, l, { price: cur.price, qty_available: cur.qty_available, nevada_county: cur.nevada_county, farm: cur.farm, region: cur.region });
        if (cur.price !== l.price) { changed = true; notes.push(l.name + ' price is now ' + SS.money(cur.price) + '.'); }
        if (cur.qty_available != null && l.qty > cur.qty_available) {
          next.qty = cur.qty_available; changed = true;
          notes.push(l.name + ' reduced to ' + cur.qty_available + ', all we have this week.');
        }
        return next;
      }).filter(function (l) { return l.qty > 0; });
      if (changed) cart.replace(lines);
      if (notes.length) { syncNote.textContent = 'Updated to this week\'s list: ' + notes.join(' '); syncNote.hidden = false; }
      renderLines();
    });
  }

  /* ---------- Submit ---------- */
  function showError(html) { errEl.innerHTML = html; errEl.hidden = false; }

  function mailtoFallback(p) {
    var body = (isDiy ? 'DIY wedding order' : 'Florist order') + '\n\nName: ' + p.business + '\nContact: ' + p.contact +
      '\nEmail: ' + p.email + '\nPhone: ' + p.phone + '\nDate: ' + p.need_by + '\nFulfillment: ' + p.fulfillment + '\n\n' +
      p.items.map(function (i) { return i.qty + ' x ' + i.name + (i.variety ? ' ' + i.variety : '') + ' (' + i.unit + ') ' + SS.money(i.line_total); }).join('\n') +
      '\n\nFlowers: ' + SS.money(p.subtotal) + (isDiy ? '\nLabor and packaging: ' + SS.money(p.labor_fee) + '\nTransportation: ' + SS.money(p.transport_fee) : '') +
      '\nEstimated total: ' + SS.money(p.estimated_total) + '\n\nNotes: ' + p.notes;
    return 'mailto:' + encodeURIComponent(C.email || '') + '?subject=' + encodeURIComponent((isDiy ? 'DIY order: ' : 'Florist order: ') + p.business) + '&body=' + encodeURIComponent(body);
  }

  function buildPayload() {
    var s = summarize();
    var el = form.elements;
    var lines = cart.items();
    var months = [];
    lines.forEach(function (l) { if (l.month && months.indexOf(l.month) === -1) months.push(l.month); });
    return {
      list: mode,
      business: el.business.value.trim(),
      contact: el.contact.value.trim(),
      email: el.email.value.trim(),
      phone: el.phone.value.trim(),
      need_by: el.need_by.value,
      price_months: months.join(', '),
      fulfillment: s.fulfillment.label,
      fulfillment_id: s.fulfillment.id,
      fulfillment_fee: s.fee,
      items: lines.map(function (l) {
        return {
          name: l.name, variety: l.variety || '', color: l.color || '', stem_length: l.stem_length || '', unit: l.unit,
          price: l.price, qty: l.qty, line_total: round2(l.price * l.qty),
          farm: l.farm || '', region: l.region || '', month: l.month || '',
          nevada_county: !!l.nevada_county, listed: !missing[l.id]
        };
      }),
      subtotal: s.totals.subtotal,
      offseason_subtotal: isDiy ? 0 : s.totals.offseason,
      labor_fee: s.labor,
      transport_fee: s.transport,
      estimated_total: s.total,
      below_minimum: s.below,
      notes: el.notes.value.trim(),
      website: el.website.value,
      page: location.href
    };
  }

  function validate(p) {
    var el = form.elements;
    [el.business, el.email, el.phone].forEach(function (f) { f.removeAttribute('aria-invalid'); });
    if (!p.business) { el.business.setAttribute('aria-invalid', 'true'); el.business.focus(); return isDiy ? 'Add your name.' : 'Add your business name.'; }
    if (!p.email && !p.phone) { el.email.setAttribute('aria-invalid', 'true'); el.email.focus(); return 'Add an email or phone number so we can confirm.'; }
    if (p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) { el.email.setAttribute('aria-invalid', 'true'); el.email.focus(); return 'Check the email address.'; }
    if (!p.items.length && !p.notes) return 'Add flowers from the list, or tell us what you need in the notes.';
    return '';
  }

  function confirmSent(ref, p) {
    cart.clear();
    var confirmEl = root.querySelector('[data-confirm]');
    var via = p.email ? 'email at ' + p.email : 'phone at ' + p.phone;
    confirmEl.querySelector('[data-confirm-text]').textContent = 'We will confirm your flowers, ' + (isDiy ? 'pickup or delivery' : 'fulfillment') + ', and total by ' + via + '.';
    confirmEl.querySelector('[data-confirm-ref]').textContent = ref ? 'Reference ' + ref : '';
    root.classList.add('is-sent');
    $('.tool-head').hidden = true;
    confirmEl.hidden = false;
    window.scrollTo(0, 0);
    confirmEl.focus({ preventScroll: true });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    errEl.hidden = true;
    var p = buildPayload();
    var msg = validate(p);
    if (msg) { showError(esc(msg)); return; }
    if (p.website) { confirmSent('', p); return; } /* honeypot: quietly drop bots */

    var hasEmail = C.email && C.email.indexOf('[') !== 0;
    if (!C.endpoint) {
      showError(hasEmail
        ? 'Online ordering is not connected yet. <a href="' + esc(mailtoFallback(p)) + '">Send this order by email</a> instead.'
        : 'Online ordering opens soon. <a href="' + esc(C.orderUrl.replace(/order\/$/, 'contact/')) + '">Contact us</a> to order in the meantime.');
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';
    fetch(C.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, /* simple request: no CORS preflight */
      body: JSON.stringify(p)
    })
      .then(function (res) { return res.json(); })
      .then(function (r) {
        if (!r || !r.ok) throw new Error((r && r.error) || 'Order not saved');
        confirmSent(r.id, p);
      })
      .catch(function (err) {
        if (window.console) console.warn('[SierraStems] Order submit failed:', err);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send order request';
        showError('That did not go through. Try again' + (hasEmail ? ', or <a href="' + esc(mailtoFallback(p)) + '">send this order by email</a>.' : '.'));
      });
  });

  paintRadios();
  renderLines();
})();
