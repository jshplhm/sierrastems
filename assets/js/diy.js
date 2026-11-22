/* DIY page: monthly price guide by the bunch. */
(function () {
  'use strict';
  var SS = window.SS;
  var list = document.querySelector('[data-list]');
  if (!SS || !list) return;

  var cart = SS.carts.diy;
  var esc = SS.escapeHtml;
  var form = document.querySelector('[data-filters]');
  var monthSel = form.elements.month;
  var chipsEl = form.querySelector('[data-category-chips]');
  var countEl = document.querySelector('[data-count]');
  var emptyEl = document.querySelector('[data-empty]');
  var bar = document.querySelector('[data-order-bar]');
  var MONTH_KEY = 'ss-diy-month';
  var items = [], byId = {}, state = { q: '', group: '' }, current = null;

  function remembered() {
    try { return window.localStorage.getItem(MONTH_KEY); } catch (e) { return null; }
  }
  function remember(m) {
    try { window.localStorage.setItem(MONTH_KEY, m); } catch (e) { /* fine */ }
  }

  function rowHtml(i) {
    var line = cart.get(i.id);
    var q = line ? line.qty : 0;
    var label = esc(i.name);
    return '<li class="stem-row' + (q ? ' in-order' : '') + '" data-id="' + esc(i.id) + '">' +
      '<span class="c-name"><strong>' + esc(i.name) + '</strong></span>' +
      '<span class="c-meta"><span class="c-unit">' + esc(i.unit) + '</span></span>' +
      '<span class="c-price">' + SS.money(i.price) + '<small>/' + (/^per\s+/i.test(i.unit) ? esc(i.unit.replace(/^per\s+/i, '').toLowerCase()) : (/^case/i.test(i.unit) ? 'case' : (i.unit === '1 stem' ? 'stem' : 'bunch'))) + '</small></span>' +
      '<span class="c-qty"><span class="qty">' +
        '<button type="button" class="qty-btn" data-step="-1" aria-label="One fewer bunch of ' + label + '">&minus;</button>' +
        '<input type="number" inputmode="numeric" min="0" step="1" value="' + (q || '') + '" placeholder="0" aria-label="Bunches of ' + label + '">' +
        '<button type="button" class="qty-btn" data-step="1" aria-label="One more bunch of ' + label + '">+</button>' +
      '</span></span>' +
    '</li>';
  }

  function matches(i) {
    if (state.group && i.group !== state.group) return false;
    if (state.q) {
      var hay = (i.name + ' ' + i.group).toLowerCase();
      var words = state.q.split(/\s+/);
      for (var w = 0; w < words.length; w++) if (words[w] && hay.indexOf(words[w]) === -1) return false;
    }
    return true;
  }

  function render() {
    var shown = items.filter(matches);
    var grouped = !state.group && !state.q;
    var html = '', last = null;
    shown.forEach(function (i) {
      if (grouped && i.group !== last) {
        html += '<li class="group-head" aria-hidden="true">' + esc(i.group) + '</li>';
        last = i.group;
      }
      html += rowHtml(i);
    });
    list.innerHTML = html;
    countEl.textContent = !items.length ? '' : (shown.length === items.length ? items.length + ' items for ' + current : shown.length + ' of ' + items.length + ' items for ' + current);
    if (items.length && !shown.length) {
      emptyEl.innerHTML = 'Nothing matches. <button type="button" class="link-btn" data-clear>Clear search</button>';
      emptyEl.hidden = false;
    } else if (items.length) {
      emptyEl.hidden = true;
    }
  }

  function buildChips() {
    Array.prototype.slice.call(chipsEl.querySelectorAll('[data-category]:not([data-category=""])')).forEach(function (b) { b.remove(); });
    var groups = [];
    items.forEach(function (i) { if (groups.indexOf(i.group) === -1) groups.push(i.group); });
    groups.forEach(function (g) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.dataset.category = g;
      b.setAttribute('aria-pressed', String(state.group === g));
      b.textContent = g;
      chipsEl.appendChild(b);
    });
    if (groups.indexOf(state.group) === -1) setGroup('');
  }

  function setGroup(g) {
    state.group = g;
    Array.prototype.forEach.call(chipsEl.querySelectorAll('[data-category]'), function (c) {
      c.setAttribute('aria-pressed', String(c.dataset.category === g));
    });
  }

  function paintBar() {
    var lines = cart.items();
    var n = lines.length;
    bar.classList.toggle('is-visible', n > 0);
    document.body.classList.toggle('has-order-bar', n > 0);
    bar.querySelector('[data-bar-count]').textContent = n + (n === 1 ? ' item' : ' items');
    bar.querySelector('[data-bar-total]').textContent = SS.money(cart.totals(lines).subtotal);
  }

  function show(month) {
    current = month;
    monthSel.value = month;
    remember(month);
    list.setAttribute('aria-busy', 'true');
    SS.loadDiy(month).then(function (data) {
      if (data.month !== current) return; /* a later pick won */
      list.removeAttribute('aria-busy');
      items = data.items;
      byId = {};
      items.forEach(function (i) { byId[i.id] = i; });
      buildChips();
      if (!items.length) {
        list.innerHTML = '';
        countEl.textContent = '';
        emptyEl.innerHTML = (data.error ? 'The ' + esc(month) + ' list did not load. Refresh to try again, or ' : 'The ' + esc(month) + ' list is not posted yet. ') + '<a href="' + esc(SS.config.orderUrl.replace(/order\/$/, 'contact/')) + '">' + (data.error ? 'contact us' : 'Contact us') + '</a> for ' + esc(month) + ' prices, or pick another month.';
        emptyEl.hidden = false;
        return;
      }
      emptyEl.hidden = true;
      render();
    });
  }

  function setQty(row, qty) {
    var item = byId[row.dataset.id];
    if (!item) return;
    var applied = cart.set(item, qty);
    row.querySelector('input').value = applied || '';
    row.classList.toggle('in-order', applied > 0);
  }

  /* Events */
  monthSel.addEventListener('change', function () { show(monthSel.value); });
  form.addEventListener('input', function (e) {
    if (e.target.name === 'q') { state.q = e.target.value.trim().toLowerCase(); render(); }
  });
  chipsEl.addEventListener('click', function (e) {
    var b = e.target.closest('[data-category]');
    if (!b) return;
    setGroup(b.dataset.category);
    render();
  });
  emptyEl.addEventListener('click', function (e) {
    if (!e.target.closest('[data-clear]')) return;
    form.elements.q.value = '';
    state.q = '';
    setGroup('');
    render();
  });
  list.addEventListener('click', function (e) {
    var b = e.target.closest('.qty-btn');
    if (!b) return;
    var row = b.closest('.stem-row');
    setQty(row, (parseInt(row.querySelector('input').value, 10) || 0) + Number(b.dataset.step));
  });
  list.addEventListener('change', function (e) {
    if (e.target.matches('input[type=number]')) setQty(e.target.closest('.stem-row'), e.target.value);
  });
  list.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.matches('input[type=number]')) { e.preventDefault(); e.target.blur(); }
  });
  document.addEventListener('ss:cart', paintBar);

  var start = remembered();
  if (SS.months.indexOf(start) === -1) start = SS.months[new Date().getMonth()];
  show(start);
  paintBar();
})();
