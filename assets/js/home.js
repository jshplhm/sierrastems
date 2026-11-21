/* Home: first six stems from this week's list. */
(function () {
  'use strict';
  var SS = window.SS;
  var grid = document.querySelector('[data-preview]');
  if (!SS || !grid) return;
  var esc = SS.escapeHtml;

  SS.loadAvailability().then(function (data) {
    var el = document.querySelector('[data-updated]');
    if (el) el.textContent = SS.updatedText(data);
    var six = data.items.slice(0, 6);
    if (!six.length) {
      grid.outerHTML = '<p>The list is being updated. Check back soon.</p>';
      return;
    }
    grid.innerHTML = six.map(function (i) {
      return '<li class="preview-card">' +
        '<a href="' + esc(SS.config.availabilityUrl) + '">' +
          '<span class="pc-top"><i class="dot" style="background:' + SS.colorSwatch(i.color) + '"></i>' + esc(i.color) +
            (i.nevada_county ? '<span class="badge">Nevada County grown</span>' : '') + '</span>' +
          '<span class="pc-name">' + esc(i.name) + '</span>' +
          '<span class="pc-variety">' + esc(i.variety) + '</span>' +
          '<span class="pc-foot"><span>' + esc(i.unit) + (i.stem_length ? ', ' + esc(i.stem_length) : '') + '</span>' +
            '<strong>' + (!SS.trade.isUnlocked() ? '<span class="trade-only">For florists</span>' : (i.price != null ? SS.money(i.price) : '')) + '</strong></span>' +
          '<span class="pc-source">' + esc(i.farm) + (i.region ? ', ' + esc(i.region) : '') + '</span>' +
        '</a></li>';
    }).join('');
  });
})();
