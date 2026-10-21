/* Visitor and click tracking, sent to Umami (see README-analytics.md).
   Plausible, GoatCounter and Vercel Web Analytics also work if their script tag is loaded instead.
   Nothing is sent from previews or localhost, so test traffic never pollutes the numbers. */
(function () {
  var LIVE_HOSTS = ['yennyotero.com', 'www.yennyotero.com'];
  if (LIVE_HOSTS.indexOf(location.hostname) === -1) return;

  // Send an event to whichever provider is loaded. Silent if none is.
  function track(name, props) {
    try {
      if (window.umami && typeof window.umami.track === 'function') { window.umami.track(name, props || {}); return; }
      if (typeof window.va === 'function') { window.va('event', { name: name, data: props || {} }); return; }
      if (typeof window.plausible === 'function') { window.plausible(name, { props: props || {} }); return; }
      if (typeof window.goatcounter === 'object' && window.goatcounter.count) {
        window.goatcounter.count({ path: name, title: JSON.stringify(props || {}), event: true }); return;
      }
    } catch (e) { /* never let tracking break the page */ }
  }

  // Which application sent them here: yennyotero.com/?from=anima
  var from = null;
  try {
    from = new URLSearchParams(location.search).get('from');
    if (from) {
      from = from.slice(0, 40);
      sessionStorage.setItem('yo_from', from);
    } else {
      from = sessionStorage.getItem('yo_from');
    }
  } catch (e) { /* private mode */ }

  var page = location.pathname.replace(/\/index\.html$/, '/') || '/';
  function base(extra) {
    var o = { page: page };
    if (from) o.from = from;
    for (var k in extra) o[k] = extra[k];
    return o;
  }

  if (from) track('visit-from-application', base({}));

  // ---- clicks that matter
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a') : null;

    if (a) {
      var href = a.getAttribute('href') || '';
      if (/\.pdf($|\?)/i.test(href)) { track('cv-download', base({})); return; }
      if (href.indexOf('mailto:') === 0) { track('email-click', base({})); return; }
      if (href.indexOf('linkedin.com') > -1) { track('linkedin-click', base({})); return; }
      if (href.indexOf('work/') > -1) {
        track('case-study-open', base({ study: href.split('/').pop().replace('.html', '') })); return;
      }
      if (/^https?:/i.test(href)) { track('outbound-click', base({ url: href })); return; }
    }

    var tile = e.target.closest ? e.target.closest('.tile') : null;
    if (tile) {
      var cap = tile.querySelector('.cap');
      track('image-open', base({ image: cap ? cap.textContent.trim() : 'unknown' }));
    }
  }, true);

  // ---- did they actually read it
  var marks = [50, 90], hit = {};
  function onScroll() {
    var h = document.documentElement;
    var denom = h.scrollHeight - h.clientHeight;
    if (denom < 400) return; // short page, depth means nothing
    var pct = (h.scrollTop / denom) * 100;
    for (var i = 0; i < marks.length; i++) {
      var m = marks[i];
      if (pct >= m && !hit[m]) { hit[m] = 1; track('scrolled-' + m, base({})); }
    }
    if (hit[50] && hit[90]) window.removeEventListener('scroll', onScroll);
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  // ---- stayed longer than a glance
  var engaged = false;
  setTimeout(function () { if (!engaged) { engaged = true; track('stayed-30s', base({})); } }, 30000);
})();
