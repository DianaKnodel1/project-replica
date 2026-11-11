(function () {
  // Mobiles Menü: Desktop-Navigation in ein aufklappbares Panel spiegeln.
  var burger = document.querySelector('header button[aria-label="Menü"], header button[aria-label="Menü öffnen"]');
  var header = document.querySelector('header');
  if (burger && header) {
    var desk = header.querySelector('nav');
    var panel = document.createElement('div');
    panel.className = 'lvx-mnav';
    if (desk) Array.prototype.forEach.call(desk.querySelectorAll('a'), function (a) {
      var c = a.cloneNode(true); c.removeAttribute('class'); panel.appendChild(c);
    });
    header.appendChild(panel);
    burger.setAttribute('aria-expanded', 'false');
    burger.addEventListener('click', function () {
      var open = panel.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    panel.addEventListener('click', function (e) { if (e.target.tagName === 'A') panel.classList.remove('is-open'); });
  }

  // Kontaktformular: Anfrage an das Portal (Admin-Postfach) senden.
  function apiOrigin() {
    try { return new URL(String(window.PORTAL_API || '')).origin; } catch (_) { return ''; }
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-lv-contact]'), function (box) {
    var btn = box.querySelector('[data-lv-contact-send]');
    var status = box.querySelector('[data-lv-contact-status]');
    if (!btn) return;
    function say(msg, state) { if (status) { status.textContent = msg; status.setAttribute('data-state', state); } }
    btn.addEventListener('click', function () {
      var data = { name: '', email: '', phone: '', message: '' };
      Array.prototype.forEach.call(box.querySelectorAll('input, textarea'), function (el) {
        var n = (el.name || el.id || el.placeholder || '').toLowerCase();
        var v = String(el.value || '').trim();
        if (!v || el.type === 'checkbox') return;
        if (el.tagName === 'TEXTAREA') data.message += (data.message ? '\n' : '') + v;
        else if (el.type === 'email' || n.indexOf('mail') >= 0) data.email = v;
        else if (el.type === 'tel' || n.indexOf('tel') >= 0 || n.indexOf('phone') >= 0) data.phone = v;
        else if (!data.name && (n.indexOf('name') >= 0 || n.indexOf('ihr') >= 0)) data.name = v;
        else data.message = (data.message ? data.message + '\n' : '') + (el.placeholder || n) + ': ' + v;
      });
      var cb = box.querySelector('input[type=checkbox][required]');
      if (cb && !cb.checked) return say('Bitte stimmen Sie der Datenverarbeitung zu.', 'error');
      if (!data.name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email) || !data.message) {
        return say('Bitte Name, gültige E-Mail und Nachricht ausfüllen.', 'error');
      }
      var origin = apiOrigin();
      if (!origin) return say('Senden ist gerade nicht möglich. Bitte schreiben Sie uns eine E-Mail.', 'error');
      data.domain = (location.hostname || '').replace(/^www\./, '');
      if (window.TENANT_ID) data.tenant_id = window.TENANT_ID;
      btn.disabled = true; say('Wird gesendet …', 'busy');
      fetch(origin + '/api/public/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
        .then(function () {
          Array.prototype.forEach.call(box.querySelectorAll('input, textarea'), function (el) { if (el.type !== 'checkbox') el.value = ''; else el.checked = false; });
          say('Vielen Dank! Ihre Nachricht ist bei uns angekommen. Wir melden uns schnellstmöglich.', 'ok');
        })
        .catch(function () { say('Senden fehlgeschlagen. Bitte versuchen Sie es erneut oder schreiben Sie uns eine E-Mail.', 'error'); })
        .then(function () { btn.disabled = false; });
    });
  });
})();
