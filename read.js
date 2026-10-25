/* Short read / Full read on the case pages.
   Each page decides its starting mode in <head>, before first paint, by adding
   "read-short" to <html>. This file wires up the buttons. Without it, or without
   JavaScript, the toggle stays hidden and the whole story shows. */
(function () {
  var d = document.documentElement;
  var r = document.getElementById('reads');
  var f = document.getElementById('full');
  if (!r || !f) return;
  var buttons = r.querySelectorAll('[data-mode]');
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var LIVE = /(^|\.)yennyotero\.com$/;

  function set(mode, byUser) {
    d.classList.toggle('read-short', mode === 'short');
    for (var i = 0; i < buttons.length; i++) {
      if (buttons[i].parentNode.className === 'tabs') {
        buttons[i].setAttribute('aria-pressed', buttons[i].getAttribute('data-mode') === mode ? 'true' : 'false');
      }
    }
    if (!byUser) return;
    if (mode === 'full') {
      f.setAttribute('tabindex', '-1');
      f.focus({ preventScroll: true });
      f.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
    } else {
      r.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
    }
    if (LIVE.test(location.hostname) && window.umami) {
      try { window.umami.track('read-mode', { mode: mode, page: location.pathname }); } catch (e) { /* never break the page */ }
    }
  }

  for (var i = 0; i < buttons.length; i++) {
    buttons[i].addEventListener('click', function (e) {
      set(e.currentTarget.getAttribute('data-mode'), true);
    });
  }
  set(d.classList.contains('read-short') ? 'short' : 'full', false);
})();
