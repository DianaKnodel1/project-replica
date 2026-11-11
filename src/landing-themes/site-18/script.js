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

  // Bewerbungsformular der Website: Bewerbung an das Portal senden.
  function fieldKey(el) {
    var k = el.getAttribute('name') || el.getAttribute('placeholder') || '';
    if (!k) { var l = el.closest('label'); if (l) k = l.textContent || ''; }
    if (!k && el.id) { var lb = document.querySelector('label[for="' + el.id + '"]'); if (lb) k = lb.textContent || ''; }
    return String(k).replace(/\*/g, '').trim();
  }
  function niceLabel(el) {
    var l = el.getAttribute('placeholder') || '';
    if (!l) { var lb = el.closest('label') || (el.id && document.querySelector('label[for="' + el.id + '"]')); if (lb) l = lb.textContent || ''; }
    return String(l || el.getAttribute('name') || 'Angabe').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
  }
  function collect(box) {
    var d = { extra: [] }, invalid = null;
    Array.prototype.forEach.call(box.querySelectorAll('input, select, textarea'), function (el) {
      if (el.type === 'button' || el.type === 'submit' || el.type === 'hidden' || el.readOnly) return;
      if (!invalid && el.checkValidity && !el.checkValidity()) invalid = el;
      if (el.type === 'checkbox' || el.type === 'radio') { if (el.type === 'radio' && el.checked) d.extra.push(niceLabel(el) + ': ' + el.value); return; }
      var v = String(el.value || '').trim(); if (!v) return;
      var k = fieldKey(el), lk = k.toLowerCase();
      if (/e-?mail/.test(lk) || el.type === 'email') d.email = v;
      else if (/vorname|first/.test(lk)) d.first = v;
      else if (/nachname|last/.test(lk)) d.last = v;
      else if (/telefon|phone|^tel|mobil/.test(lk) || el.type === 'tel') d.phone = v;
      else if (/plz|postal|postleitzahl/.test(lk)) d.plz = v;
      else if (/wohnort|^ort|city|stadt/.test(lk)) d.city = v;
      else if (/^name$|vor- und nachname|vollständiger name|ihr name|^name /.test(lk) || lk === 'name' || lk === 'full_name') d.full = v;
      else d.extra.push(niceLabel(el) + ': ' + v);
    });
    return { d: d, invalid: invalid };
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-lv-apply]'), function (box) {
    var btn = box.querySelector('[data-lv-apply-send]');
    var status = box.querySelector('[data-lv-apply-status]');
    var thanks = box.parentNode && box.parentNode.querySelector('[data-lv-apply-thanks]');
    if (!btn) return;
    var label = btn.textContent;
    function say(msg, state) { if (status) { status.textContent = msg; status.setAttribute('data-state', state); } }
    btn.addEventListener('click', function () {
      var c = collect(box);
      if (c.invalid) { say('Bitte füllen Sie alle Pflichtfelder korrekt aus.', 'error'); try { c.invalid.reportValidity(); } catch (_) {} return; }
      var d = c.d;
      var full = d.full || [d.first, d.last].filter(Boolean).join(' ');
      if (!full || !d.email) { say('Bitte geben Sie Name und E-Mail an.', 'error'); return; }
      if (!d.first && !d.last && d.full) { var parts = d.full.split(/\s+/); d.first = parts.shift(); d.last = parts.join(' '); }
      var endpoint = String(window.PORTAL_API || '').trim();
      if (!/^https?:\/\//i.test(endpoint)) { say('Das Bewerbungsformular ist gerade nicht erreichbar. Bitte kontaktieren Sie uns direkt.', 'error'); return; }
      var data = { full_name: full, first_name: d.first || null, last_name: d.last || null, email: d.email, phone: d.phone || null,
        postal_code: d.plz || null, city: d.city || null, message: d.extra.length ? d.extra.join('\n').slice(0, 2000) : null,
        flow_type: window.FLOW_TYPE || 'classic', dsgvo_consent: true, consent_timestamp: new Date().toISOString() };
      data.domain = (location.hostname || '').replace(/^www\./, '');
      if (window.TENANT_ID) data.tenant_id = window.TENANT_ID;
      if (window.PORTAL_URL) data.portal_url = window.PORTAL_URL;
      if (window.SOURCE_SLUG) data.source_slug = window.SOURCE_SLUG;
      btn.disabled = true; btn.textContent = 'Wird gesendet …'; say('', '');
      fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(function (r) { return r.text().then(function (t) { var b = null; try { b = t ? JSON.parse(t) : null; } catch (_) {} if (!r.ok || !b || b.success !== true) throw new Error('send'); return b; }); })
        .then(function (res) {
          try { if (typeof window.fbq === 'function') window.fbq('track', 'Lead'); } catch (_) {}
          box.style.display = 'none';
          if (thanks) { thanks.hidden = false; thanks.style.display = ''; }
          var tm = /\/buchen\/([^/?#]+)/.exec((res && res.redirect_url) || '');
          var host = thanks || box.parentNode;
          if (tm && window.LandingBooking && host) {
            var slot = document.createElement('div'); slot.id = 'booking-inline-host'; slot.style.marginTop = '24px'; host.appendChild(slot);
            window.LandingBooking.renderInline(slot, tm[1], { emailStatus: (res && res.email_status) || null });
          } else if (res && res.redirect_url && /^https?:\/\//i.test(res.redirect_url) && host) {
            var a = document.createElement('a'); a.href = res.redirect_url; a.textContent = 'Jetzt Termin vereinbaren →'; a.className = 'lvx-apply-next'; host.appendChild(a);
          }
          try { (thanks || box).scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
        })
        .catch(function () { btn.disabled = false; btn.textContent = label; say('Senden fehlgeschlagen. Bitte versuchen Sie es erneut.', 'error'); });
    });
  });
})();
