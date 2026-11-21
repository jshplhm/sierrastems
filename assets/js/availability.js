/* Availability page: filters, list, quantity inputs, sticky order bar. */
(function () {
  'use strict';
  var SS = window.SS;
  var list = document.querySelector('[data-list]');
  if (!SS || !list) return;

  var form = document.querySelector('[data-filters]');
  var chips = form.querySelectorAll('[data-category]');
  var colorSel = form.elements.color;
  var countEl = document.querySelector('[data-count]');
  var emptyEl = document.querySelector('[data-empty]');
  var bar = document.querySelector('[data-order-bar]');
  var items = [];
  var byId = {};
  var state = { q: '', category: '', color: '', nc: false };
  var esc = SS.escapeHtml;

  function unitWord(unit) {
    return /^bunch/i.test(unit) ? 'bunch' : (/^stem/i.test(unit) ? 'stem' : unit.toLowerCase());
  }

  function rowHtml(i) {
    var inCart = SS.cart.get(i.id);
    var q = inCart ? inCart.qty : 0;
    var soldOut = i.qty_available === 0;
    var label = esc(i.name + (i.variety ? ' ' + i.variety : ''));
    var img = i.image_url
      ? '<img src="' + esc(i.image_url) + '" alt="" width="96" height="96" loading="lazy" decoding="async">'
      : '';
    var source = esc(i.farm) + (i.farm && i.region ? ', ' : '') + esc(i.region);
    var max = i.qty_available != null ? ' max="' + i.qty_available + '"' : '';
    return '' +
      '<li class="stem-row' + (q ? ' in-order' : '') + (soldOut ? ' sold-out' : '') + '" data-id="' + esc(i.id) + '">' +
        '<span class="c-img">' + img + '</span>' +
        '<span class="c-name"><strong>' + esc(i.name) + '</strong>' + (i.variety ? ' <span class="variety">' + esc(i.variety) + '</span>' : '') + '</span>' +
        '<span class="c-meta">' +
          '<span class="c-color"><i class="dot" style="background:' + SS.colorSwatch(i.color) + '"></i>' + esc(i.color || '') + '</span>' +
          '<span class="c-length">' + esc(i.stem_length) + '</span>' +
          '<span class="c-unit">' + esc(i.unit) + '</span>' +
        '</span>' +
        '<span class="c-price">' + (i.price != null ? SS.money(i.price) + '<small>/' + esc(unitWord(i.unit)) + '</small>' : 'Ask') + '</span>' +
        '<span class="c-avail">' + (i.qty_available == null ? '' : (soldOut ? 'Sold out' : i.qty_available + ' avail.')) + '</span>' +
        '<span class="c-source">' + source + (i.nevada_county ? ' <span class="badge">Nevada County grown</span>' : '') + '</span>' +
        '<span class="c-qty">' +
          '<span class="qty"' + (soldOut ? ' aria-disabled="true"' : '') + '>' +
            '<button type="button" class="qty-btn" data-step="-1" aria-label="One fewer ' + label + '"' + (soldOut ? ' disabled' : '') + '>&minus;</button>' +
            '<input type="number" inputmode="numeric" min="0"' + max + ' step="1" value="' + (q || '') + '" placeholder="0" aria-label="Quantity of ' + label + ', ' + esc(i.unit) + '"' + (soldOut ? ' disabled' : '') + '>' +
            '<button type="button" class="qty-btn" data-step="1" aria-label="One more ' + label + '"' + (soldOut ? ' disabled' : '') + '>+</button>' +
          '</span>' +
        '</span>' +
      '</li>';
  }

  function matches(i) {
    if (state.category && i.category !== state.category) return false;
    if (state.color && i.color.toLowerCase() !== state.color) return false;
    if (state.nc && !i.nevada_county) return false;
    if (state.q) {
      var hay = [i.name, i.variety, i.color, i.category, i.farm, i.region].join(' ').toLowerCase();
      var words = state.q.split(/\s+/);
      for (var w = 0; w < words.length; w++) if (words[w] && hay.indexOf(words[w]) === -1) return false;
    }
    return true;
  }

  function render() {
    var shown = items.filter(matches);
    list.innerHTML = shown.map(rowHtml).join('');
    countEl.textContent = shown.length === items.length
      ? items.length + ' stems'
      : shown.length + ' of ' + items.length + ' stems';
    emptyEl.hidden = shown.length > 0 || items.length === 0;
  }

  function buildFilters() {
    var colors = {};
    items.forEach(function (i) { if (i.color) colors[i.color.toLowerCase()] = i.color; });
    Object.keys(colors).sort().forEach(function (k) {
      var o = document.createElement('option');
      o.value = k; o.textContent = colors[k];
      colorSel.appendChild(o);
    });
    var cats = {};
    items.forEach(function (i) { if (i.category) cats[i.category] = true; });
    var group = form.querySelector('[data-category-chips]');
    Array.prototype.forEach.call(chips, function (b) {
      if (b.dataset.category && !cats[b.dataset.category]) b.hidden = true;
      delete cats[b.dataset.category];
    });
    Object.keys(cats).forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.dataset.category = c;
      b.setAttribute('aria-pressed', 'false');
      b.textContent = c.charAt(0).toUpperCase() + c.slice(1);
      group.appendChild(b);
    });
    chips = form.querySelectorAll('[data-category]');
  }

  function paintBar() {
    if (!SS.trade.isUnlocked()) return;
    var lines = SS.cart.items();
    var n = lines.length;
    bar.classList.toggle('is-visible', n > 0);
    document.body.classList.toggle('has-order-bar', n > 0);
    bar.querySelector('[data-bar-count]').textContent = n + (n === 1 ? ' item' : ' items');
    bar.querySelector('[data-bar-total]').textContent = SS.money(SS.cart.totals(lines).subtotal);
  }

  function setQty(row, qty) {
    var item = byId[row.dataset.id];
    if (!item) return;
    var applied = SS.cart.set(item, qty);
    var input = row.querySelector('input');
    input.value = applied || '';
    row.classList.toggle('in-order', applied > 0);
  }

  /* Events */
  form.addEventListener('input', function (e) {
    if (e.target.name === 'q') { state.q = e.target.value.trim().toLowerCase(); render(); }
  });
  form.addEventListener('change', function (e) {
    if (e.target.name === 'color') state.color = e.target.value;
    if (e.target.name === 'nc') state.nc = e.target.checked;
    render();
  });
  form.addEventListener('click', function (e) {
    var b = e.target.closest('[data-category]');
    if (!b) return;
    state.category = b.dataset.category;
    Array.prototype.forEach.call(chips, function (c) { c.setAttribute('aria-pressed', String(c === b)); });
    render();
  });
  document.querySelector('[data-clear]').addEventListener('click', function () {
    form.reset();
    state = { q: '', category: '', color: '', nc: false };
    Array.prototype.forEach.call(chips, function (c) { c.setAttribute('aria-pressed', String(c.dataset.category === '')); });
    render();
  });

  list.addEventListener('click', function (e) {
    var b = e.target.closest('.qty-btn');
    if (!b) return;
    var row = b.closest('.stem-row');
    var input = row.querySelector('input');
    setQty(row, (parseInt(input.value, 10) || 0) + Number(b.dataset.step));
  });
  list.addEventListener('change', function (e) {
    if (e.target.matches('input[type=number]')) setQty(e.target.closest('.stem-row'), e.target.value);
  });
  list.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.matches('input[type=number]')) { e.preventDefault(); e.target.blur(); }
  });
  document.addEventListener('ss:cart', paintBar);

  var started = false;
  function start() {
    if (started || !SS.trade.isUnlocked()) return;
    started = true;
    load();
  }

  /* Trade gate */
  var gateForm = document.querySelector('[data-gate-form]');
  var gateErr = document.querySelector('[data-gate-error]');
  gateForm.addEventListener('submit', function (e) {
    e.preventDefault();
    gateErr.hidden = true;
    var btn = gateForm.querySelector('button');
    btn.disabled = true;
    SS.trade.unlock(gateForm.elements.code.value).then(function (ok) {
      btn.disabled = false;
      if (!ok) { gateErr.hidden = false; gateForm.elements.code.select(); return; }
      gateForm.reset();
      document.documentElement.classList.add('trade-ok');
      start();
    }).catch(function () {
      btn.disabled = false;
      gateErr.textContent = 'This browser cannot check the code. Try another browser, or contact us.';
      gateErr.hidden = false;
    });
  });
  document.querySelector('[data-lock]').addEventListener('click', function () {
    SS.trade.lock();
    document.documentElement.classList.remove('trade-ok');
    bar.classList.remove('is-visible');
    document.body.classList.remove('has-order-bar');
    gateForm.elements.code.focus();
  });

  function load() {
  SS.loadAvailability().then(function (data) {
    items = data.items;
    items.forEach(function (i) { byId[i.id] = i; });
    document.querySelector('[data-updated]').textContent = SS.updatedText(data);
    document.querySelector('.stem-table').classList.toggle('has-images', items.some(function (i) { return !!i.image_url; }));
    buildFilters();
    render();
    paintBar();
    if (!items.length) {
      list.innerHTML = '';
      countEl.textContent = 'The list is being updated. Check back soon, or contact us for what is cutting.';
    }
  });
  }

  start();
})();
