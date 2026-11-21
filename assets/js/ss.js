/* SierraStems shared script: availability loader, order list, header menu. */
(function () {
  'use strict';

  var C = window.SS_CONFIG || {};
  var memory = {};

  /* ---------- Storage (every access wrapped: private mode, blocked storage) ---------- */
  function storage() {
    try { return window.localStorage; } catch (e) { return null; }
  }
  function getItem(key) {
    var s = storage();
    if (s) { try { var v = s.getItem(key); if (v !== null) return v; } catch (e) { /* fall through */ } }
    return memory[key] === undefined ? null : memory[key];
  }
  function setItem(key, value) {
    memory[key] = value;
    var s = storage();
    if (s) { try { if (value === null) s.removeItem(key); else s.setItem(key, value); } catch (e) { /* memory only */ } }
  }

  /* One order list per price list: 'trade' (florists) and 'diy' (DIY weddings). */
  var CART_KEYS = { trade: 'ss-order-v1', diy: 'ss-order-diy-v1' };
  function makeCart(list) {
    var key = CART_KEYS[list];
    function read() {
      try {
        var v = JSON.parse(getItem(key) || '[]');
        return Array.isArray(v) ? v.filter(function (i) { return i && i.id && i.qty > 0; }) : [];
      } catch (e) { return []; }
    }
    function write(items) {
      setItem(key, JSON.stringify(items));
      document.dispatchEvent(new CustomEvent('ss:cart', { detail: { list: list, items: items } }));
    }
    return {
      list: list,
      items: read,
      get: function (id) {
        var all = read();
        for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
        return null;
      },
      set: function (item, qty) {
        qty = Math.max(0, Math.floor(Number(qty) || 0));
        if (item.qty_available != null && item.qty_available >= 0) qty = Math.min(qty, item.qty_available);
        var current = read();
        var pos = current.findIndex(function (i) { return i.id === item.id; });
        var all = current.filter(function (i) { return i.id !== item.id; });
        if (qty > 0) {
          var line = {};
          Object.keys(item).forEach(function (k) { if (k !== 'updated' && k !== 'active' && k !== 'image_url') line[k] = item[k]; });
          line.qty = qty;
          if (pos < 0) all.push(line); else all.splice(pos, 0, line);
        }
        write(all);
        return qty;
      },
      remove: function (id) { write(read().filter(function (i) { return i.id !== id; })); },
      replace: write,
      clear: function () { write([]); },
      totals: function (items) {
        items = items || read();
        var sub = 0, off = 0;
        items.forEach(function (i) {
          var t = (Number(i.price) || 0) * i.qty;
          sub += t;
          if (!i.nevada_county) off += t;
        });
        return { subtotal: round2(sub), offseason: round2(off) };
      }
    };
  }
  var carts = { trade: makeCart('trade'), diy: makeCart('diy') };
  var cart = carts.trade;

  /* ---------- Trade code ---------- */
  var TRADE_KEY = 'ss-trade';
  function sha256(text) {
    if (!window.crypto || !crypto.subtle || !window.TextEncoder) return Promise.reject(new Error('No crypto'));
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    });
  }
  var trade = {
    isUnlocked: function () { return !!C.tradeHash && getItem(TRADE_KEY) === C.tradeHash; },
    unlock: function (code) {
      return sha256(String(code || '').trim().toLowerCase()).then(function (h) {
        if (h !== C.tradeHash) return false;
        setItem(TRADE_KEY, h);
        document.dispatchEvent(new CustomEvent('ss:trade', { detail: true }));
        return true;
      });
    },
    lock: function () {
      setItem(TRADE_KEY, null);
      document.dispatchEvent(new CustomEvent('ss:trade', { detail: false }));
    }
  };

  /* ---------- Formatting ---------- */
  function round2(n) { return Math.round(n * 100) / 100; }
  var moneyFmt = (window.Intl && Intl.NumberFormat) ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }) : null;
  function money(n) { return moneyFmt ? moneyFmt.format(n || 0) : '$' + (n || 0).toFixed(2); }

  function parseDate(v) {
    if (!v) return null;
    var s = String(v).trim(), m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return new Date(+m[1], +m[2] - 1, +m[3]);
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))) return new Date(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[1] - 1, +m[2]);
    var d = new Date(s);
    return isNaN(d) ? null : d;
  }
  function formatDate(d) {
    return d ? d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '';
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function slug(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  var COLORS = [
    ['hot pink', '#d14d86'], ['dusty rose', '#c9969a'], ['white', '#fbfaf6'], ['cream', '#f1e8d2'], ['ivory', '#f4eedf'],
    ['blush', '#efcfc6'], ['peach', '#f2bf9e'], ['apricot', '#efb07f'], ['coral', '#ec8a6e'], ['orange', '#e3803e'],
    ['rust', '#a9532f'], ['yellow', '#ecc94b'], ['gold', '#d3a640'], ['red', '#b6282f'], ['burgundy', '#6b1e2b'],
    ['wine', '#6a2433'], ['plum', '#5e2b4b'], ['purple', '#6e4a8e'], ['mauve', '#b48a9a'], ['lavender', '#b9a8d6'],
    ['blue', '#6f8fbf'], ['green', '#7f9a6b'], ['chocolate', '#4a2e25'], ['brown', '#7a5236'], ['pink', '#e7a3b5'],
    ['black', '#2a2224'], ['mixed', 'conic-gradient(#efcfc6, #b6282f, #ecc94b, #7f9a6b, #efcfc6)']
  ];
  function colorSwatch(name) {
    var n = String(name || '').toLowerCase();
    for (var i = 0; i < COLORS.length; i++) if (n.indexOf(COLORS[i][0]) !== -1) return COLORS[i][1];
    return '#cfc8bb';
  }

  /* ---------- CSV ---------- */
  function parseRows(text) {
    var rows = [], row = [], field = '', q = false, i = 0, c;
    text = String(text).replace(/^﻿/, '');
    for (; i < text.length; i++) {
      c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
        } else field += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += c;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
  }
  function parseCSV(text) {
    var rows = parseRows(text);
    if (!rows.length) return [];
    var head = rows.shift().map(function (h) { return h.trim().toLowerCase().replace(/\s+/g, '_'); });
    return rows.filter(function (r) { return r.some(function (v) { return v.trim() !== ''; }); }).map(function (r) {
      var o = {};
      head.forEach(function (h, j) { o[h] = (r[j] || '').trim(); });
      return o;
    });
  }

  function bool(v) {
    if (typeof v === 'boolean') return v;
    return /^(true|yes|y|1|x)$/i.test(String(v == null ? '' : v).trim());
  }
  function num(v) {
    if (typeof v === 'number') return v;
    var n = parseFloat(String(v == null ? '' : v).replace(/[$,\s]/g, ''));
    return isNaN(n) ? null : n;
  }
  function normalize(r) {
    var item = {
      name: String(r.name || '').trim(),
      variety: String(r.variety || '').trim(),
      category: String(r.category || '').trim().toLowerCase(),
      color: String(r.color || '').trim(),
      stem_length: String(r.stem_length || '').trim(),
      unit: String(r.unit || '').trim() || 'Stem',
      price: num(r.price),
      qty_available: num(r.qty_available),
      farm: String(r.farm || '').trim(),
      region: String(r.region || '').trim(),
      nevada_county: bool(r.nevada_county),
      image_url: String(r.image_url || '').trim(),
      active: r.active === undefined || r.active === null || r.active === '' ? false : bool(r.active),
      updated: parseDate(r.updated)
    };
    if (item.qty_available != null) item.qty_available = Math.max(0, Math.floor(item.qty_available));
    item.id = slug([item.name, item.variety, item.color, item.unit, item.farm].join(' '));
    return item;
  }
  function finish(rows, source, error) {
    var items = rows.map(normalize).filter(function (i) { return i.active && i.name; });
    var updated = null;
    items.forEach(function (i) { if (i.updated && (!updated || i.updated > updated)) updated = i.updated; });
    return { items: items, updated: updated, source: source, error: error || null };
  }
  function fallbackRows() {
    var el = document.getElementById('ss-fallback');
    if (!el) return [];
    try { return JSON.parse(el.textContent) || []; } catch (e) { return []; }
  }

  var loading = null;
  function loadAvailability() {
    if (loading) return loading;
    if (!C.csv) {
      loading = Promise.resolve(finish(fallbackRows(), 'sample'));
      return loading;
    }
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 8000);
    loading = fetch(C.csv, { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (text) {
        if (/^\s*</.test(text)) throw new Error('Not a CSV. Check the published link format.');
        var rows = parseCSV(text);
        if (!rows.length || !('name' in rows[0])) throw new Error('CSV has no name column');
        return finish(rows, 'live');
      })
      .catch(function (err) {
        if (window.console) console.warn('[SierraStems] Live availability failed, using saved list:', err);
        return finish(fallbackRows(), 'fallback', err);
      })
      .then(function (r) { clearTimeout(timer); return r; });
    return loading;
  }

  /* ---------- DIY price guide ---------- */
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function diyUrl(month) {
    var urls = C.diyUrls || {};
    if (urls[month]) return urls[month];
    if (C.diySheetId) {
      return 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(C.diySheetId) +
        '/gviz/tq?tqx=out:csv&headers=0&sheet=' + encodeURIComponent(month);
    }
    return '';
  }
  /* A month tab looks like: title row, note row ("Order minimum..."), then
     Category, Item, Stems/Bunch, Price. Find the header row instead of assuming it. */
  function parseDiy(text, month) {
    var rows = parseRows(text), h = -1, note = '', cols = {};
    for (var r = 0; r < rows.length && h < 0; r++) {
      var cells = rows[r].map(function (c) { return c.trim().toLowerCase(); });
      if (cells.indexOf('item') !== -1 && cells.some(function (c) { return c.indexOf('price') === 0; })) {
        h = r;
        cells.forEach(function (c, j) {
          if (c === 'category') cols.category = j;
          else if (c === 'item') cols.item = j;
          else if (c.indexOf('stem') !== -1 || c.indexOf('bunch') !== -1) cols.bunch = j;
          else if (c.indexOf('price') === 0) cols.price = j;
        });
      } else {
        var joined = rows[r].join(' ').trim();
        if (/minimum|fee/i.test(joined)) note = joined;
      }
    }
    if (h < 0) throw new Error('No Item/Price header row');
    var items = [];
    rows.slice(h + 1).forEach(function (row) {
      var price = num(row[cols.price]);
      var item = String(row[cols.item] || '').trim();
      if (price == null || !item) return;
      items.push(normalizeDiy({ category: row[cols.category], item: item, bunch: row[cols.bunch], price: price }, month));
    });
    return { items: items, note: note };
  }
  function normalizeDiy(r, month) {
    var category = String(r.category || '').trim();
    var item = String(r.item || '').trim();
    var bunch = String(r.bunch == null ? '' : r.bunch).trim();
    var group = category.split(' - ')[0].trim() || 'Other';
    /* Rose rows put the grade in Category and the length in Item: "Ecuadorian Roses - Specialty", "50 cm". */
    var isLength = /^\d+\s*cm\b|^\d+\s*cm\s*-/i.test(item);
    var name = isLength ? category + ', ' + item.toLowerCase().replace(/\s+/g, ' ') : item;
    var unit;
    if (/^gb$/i.test(bunch)) unit = 'Grower bunch';
    else if (/^per\b/i.test(bunch)) unit = bunch;
    else if (/^(\d+)\s*bu\b/i.test(bunch)) unit = 'Case of ' + bunch.match(/^\d+/)[0] + ' bunches';
    else if (/^1$/.test(bunch)) unit = '1 stem';
    else if (/^[\d\s-]+$/.test(bunch)) unit = bunch.replace(/\s+/g, '') + ' stems';
    else unit = bunch || 'Bunch';
    return {
      id: slug([month, category, item, bunch].join(' ')),
      list: 'diy', month: month, group: group, name: name, unit: unit,
      price: Number(r.price) || 0, nevada_county: false
    };
  }
  var diyCache = {};
  function loadDiy(month) {
    if (diyCache[month]) return diyCache[month];
    var url = diyUrl(month);
    function sample(source, err) {
      var el = document.getElementById('ss-diy-sample'), rows = [];
      try { rows = JSON.parse(el.textContent) || []; } catch (e) { rows = []; }
      return { month: month, items: rows.map(function (r) { return normalizeDiy(r, month); }), note: '', source: source, error: err || null };
    }
    if (!url) {
      /* Sample only while nothing is set up; once the guide is connected, a month with no link is just not posted. */
      var configured = !!C.diySheetId || Object.keys(C.diyUrls || {}).length > 0;
      diyCache[month] = Promise.resolve(configured ? { month: month, items: [], note: '', source: 'missing', error: null } : sample('sample'));
      return diyCache[month];
    }
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 8000);
    diyCache[month] = fetch(url, { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.text(); })
      .then(function (text) {
        if (/^\s*</.test(text)) throw new Error('Not a CSV. Is the sheet shared or published?');
        var parsed = parseDiy(text, month);
        if (!parsed.items.length) throw new Error('No priced rows');
        return { month: month, items: parsed.items, note: parsed.note, source: 'live', error: null };
      })
      .catch(function (err) {
        if (window.console) console.warn('[SierraStems] DIY guide for ' + month + ' did not load:', err);
        return { month: month, items: [], note: '', source: 'missing', error: err };
      })
      .then(function (r) { clearTimeout(timer); return r; });
    return diyCache[month];
  }

  function updatedText(data) {
    var t = data.updated ? 'Last updated: ' + formatDate(data.updated) : '';
    if (data.source === 'sample') t = (t ? t + '. ' : '') + 'Sample list.';
    if (data.source === 'fallback') t = (t ? t + '. ' : '') + 'Showing our saved list; the live list did not load.';
    return t;
  }

  /* ---------- Header: menu + order count ---------- */
  function initHeader() {
    var btn = document.querySelector('.nav-toggle');
    var header = document.querySelector('.site-header');
    if (btn && header) {
      btn.addEventListener('click', function () {
        var open = btn.getAttribute('aria-expanded') !== 'true';
        btn.setAttribute('aria-expanded', String(open));
        header.classList.toggle('nav-open', open);
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && header.classList.contains('nav-open')) {
          header.classList.remove('nav-open');
          btn.setAttribute('aria-expanded', 'false');
          btn.focus();
        }
      });
    }
    var badge = document.querySelector('[data-cart-count]');
    function paint() {
      if (!badge) return;
      var n = carts.trade.items().length + carts.diy.items().length;
      badge.textContent = String(n);
      badge.hidden = n === 0;
      badge.setAttribute('aria-label', n + (n === 1 ? ' item' : ' items') + ' in order');
    }
    paint();
    document.addEventListener('ss:cart', paint);
    window.addEventListener('storage', function (e) { if (e.key === CART_KEYS.trade || e.key === CART_KEYS.diy) paint(); });
    var orderLink = document.querySelector('.order-link');
    if (orderLink) orderLink.addEventListener('click', function () {
      /* Send people to the list they have been filling. */
      var t = carts.trade.items().length, d = carts.diy.items().length;
      if (d && !t) orderLink.href = C.orderUrl + '?list=diy';
      else if (t && !d) orderLink.href = C.orderUrl + '?list=trade';
    });
  }

  window.SS = {
    config: C,
    cart: cart,
    carts: carts,
    trade: trade,
    months: MONTHS,
    loadDiy: loadDiy,
    parseDiy: parseDiy,
    money: money,
    escapeHtml: escapeHtml,
    colorSwatch: colorSwatch,
    formatDate: formatDate,
    parseCSV: parseCSV,
    loadAvailability: loadAvailability,
    updatedText: updatedText
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initHeader);
  else initHeader();
})();
