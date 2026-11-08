/* Runs the exported blog without a server. It answers the blog's own requests (reactions, posting delay, intake form,
   live settings) from the files in this folder and from this visitor's browser. Written by tipsfyp.site's "Download my blog". */
(function () {
  'use strict';
  var C = window.TF_STATIC; if (!C) return;
  var realFetch = window.fetch ? window.fetch.bind(window) : null;
  var KP = 'tf_' + C.slug + '_';
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(KP + k); if (v === null) localStorage.removeItem(KP + k); else localStorage.setItem(KP + k, v); } catch (e) {} return null; }
  function jget(k, d) { try { var x = JSON.parse(ls(k)); return x == null ? d : x; } catch (e) { return d; } }
  function jset(k, v) { ls(k, JSON.stringify(v)); }
  var first = parseInt(ls('first') || '0', 10); if (!first) { first = Date.now(); ls('first', String(first)); }
  function elapsed() { return Math.floor((Date.now() - first) / 1000); }
  function now() { return Math.floor(Date.now() / 1000); }
  function JR(o) { return Promise.resolve(new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } })); }
  function TR(s) { return Promise.resolve(new Response(s, { status: 200, headers: { 'Content-Type': 'text/plain' } })); }
  function params(init) {
    var o = {}, b = init && init.body; if (!b) return o;
    try {
      if (typeof b === 'string') { try { var j = JSON.parse(b); if (j && typeof j === 'object') return j; } catch (e) {} new URLSearchParams(b).forEach(function (v, k) { o[k] = v; }); }
      else if (window.URLSearchParams && b instanceof URLSearchParams) b.forEach(function (v, k) { o[k] = v; });
      else if (window.FormData && b instanceof FormData) b.forEach(function (v, k) { if (typeof v === 'string') o[k] = v; });
    } catch (e) {}
    return o;
  }
  function allPostNodes() { return [].slice.call(document.querySelectorAll('#posts .bm-post[data-post-id]')); }

  /* ---------- the blog's own requests, answered locally ---------- */
  function liveExtras(q, p) {
    var a = q.get('a') || p.a || '';
    if (a === 'boot') {
      var b = C.boot || {};
      return JR({ ok: true, me: null, sound: b.sound || { on: false, min: 0, cost: 0, last: 0 }, read: b.read || { on: false, min: 0 }, admin: null, asVisitor: false, pace: { on: false, options: [], current: 0, native: 0 }, layout: null,
        pinned: b.pinned || 0, social: b.social || [], away: b.away || [], x: b.x || { emoji: {}, es: {}, amb: { kind: 'off', vol: 30 } }, xv: 'static', autoSeo: false, tags: [], tgv: '', mine: {}, pointsUrl: '#', lv: 0, css: '', ts: now(), sv: '' });
    }
    if (a === 'tick') return JR({ ok: true, last: 0, events: [], ts: now() });
    if (a === 'ping') return JR({ ok: true });
    return JR({ ok: true });
  }
  /* posts that appear one by one, exactly like the live blog: the same timing, the typing indicator and the pop-up */
  function dripFeed() {
    var d = C.drip || { on: false, plan: [] }, el = elapsed(), html = [], next = null;
    (d.plan || []).forEach(function (s) { if (s.at <= el) (s.html || []).forEach(function (h) { html.push(h); }); else if (next === null || s.at < next) next = s.at; });
    return JR({ ok: true, html: html, done: next === null, next_due_in_seconds: next === null ? null : Math.max(1, next - el) });
  }
  function react(p) {
    var id = String(p.post_id || ''), em = String(p.emoji || ''); if (!id || !em) return JR({ ok: false, error: 'Invalid reaction' });
    var st = jget('react', {}), list = st[id] || [], i = list.indexOf(em), active;
    if (i >= 0) { list.splice(i, 1); active = false; } else { list.push(em); active = true; }
    st[id] = list; jset('react', st);
    var btn = document.querySelector('.bm-reaction-btn[data-emoji="' + (window.CSS && CSS.escape ? CSS.escape(em) : em) + '"][onclick*="bmReact(' + id + ',"]'), base = 0;
    if (btn) { var cn = btn.querySelector('.bm-reaction-count'); base = parseInt(btn.getAttribute('data-tf-base') || (cn ? cn.textContent : '0'), 10) || 0; btn.setAttribute('data-tf-base', String(base)); }
    return JR({ ok: true, active: active, count: base + (active ? 1 : 0) });
  }
  function intake(p) {
    var name = String(p.name || '').trim(), phone = String(p.phone || '').trim(), email = String(p.email || '').trim();
    if (!name || !phone || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return JR({ ok: false, error: 'Please fill in your full name, phone number, and a valid email address.' });
    var I = C.intake || {}, when = new Date().toISOString();
    function send(url, data) { if (!url || !/^https:\/\//i.test(url) || !realFetch) return; try { realFetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(data).toString(), keepalive: true }).catch(function () {}); } catch (e) {} }
    send(I.email, { name: name, email: email, page_title: I.title || '', submitted_at: when });
    send(I.details, { name: name, phone: phone, gender: String(p.gender || ''), page_title: I.title || '', submitted_at: when });
    ls('intake', '1');
    return JR({ ok: true, redirect_url: I.exec || '', save_number_phone: I.savePhone || null, save_number_contact_name: I.saveName || null, account: null, exec_link: !!I.exec });
  }
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var m = /\/api\/([a-z0-9\-]+)\.php/i.exec(url);
    if (!m) return realFetch ? realFetch(input, init) : Promise.reject(new Error('fetch'));
    var name = m[1].toLowerCase(), q; try { q = new URL(url, location.href).searchParams; } catch (e) { q = new URLSearchParams(''); }
    var p = params(init);
    switch (name) {
      case 'live-extras': return liveExtras(q, p);
      case 'drip-feed': return dripFeed();
      case 'react': return react(p);
      case 'intake-submit': return intake(p);
      case 'vapid-public-key': return TR('');
      case 'comments-feed': return JR({ ok: true, comments: [], html: '' });
      case 'poll-results': return JR({ ok: true, options: [] });
      case 'comment': return JR({ ok: false, error: 'Comments are not available on this copy of the blog.' });
      case 'vote': return JR({ ok: false, error: 'Voting is not available on this copy of the blog.' });
      case 'ask-ai': return JR({ ok: false, error: 'Ask AI is not available on this copy of the blog.' });
      default: return JR({ ok: true });
    }
  };
  if (navigator.sendBeacon) { var sb = navigator.sendBeacon.bind(navigator); navigator.sendBeacon = function (u, d) { if (/\/api\//.test(String(u))) return true; return sb(u, d); }; }

  /* ---------- reactions you already made stay lit and counted ---------- */
  function paintReacts(root) {
    var st = jget('react', {});
    [].forEach.call((root || document).querySelectorAll('.bm-reaction-btn[data-emoji]'), function (b) {
      var oc = b.getAttribute('onclick') || '', m = /bmReact\((\d+)/.exec(oc); if (!m) return;
      var cn = b.querySelector('.bm-reaction-count'); if (!b.hasAttribute('data-tf-base')) b.setAttribute('data-tf-base', String(parseInt(cn ? cn.textContent : '0', 10) || 0));
      var mine = (st[m[1]] || []).indexOf(b.getAttribute('data-emoji')) >= 0, base = parseInt(b.getAttribute('data-tf-base'), 10) || 0;
      b.classList.toggle('active', mine); if (cn) cn.textContent = base + (mine ? 1 : 0);
    });
  }
  /* ---------- "5m ago" times, counted from when this visitor first saw each post ---------- */
  function ago(sec) { if (sec < 45) return 'just now'; var m = Math.round(sec / 60); if (m < 60) return m + 'm ago'; var h = Math.round(m / 60); if (h < 24) return h + 'h ago'; return Math.round(h / 24) + 'd ago'; }
  function paintTimes() {
    var seen = jget('seen', {}), changed = false;
    allPostNodes().forEach(function (n) {
      var id = n.getAttribute('data-post-id'), t = n.querySelector('time'); if (!t) return;
      if (!seen[id]) { seen[id] = Date.now(); changed = true; }
      t.textContent = ago((Date.now() - seen[id]) / 1000);
    });
    if (changed) jset('seen', seen);
  }
  /* ---------- install as an app ---------- */
  function regSW() { if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return; try { navigator.serviceWorker.register('sw.js', { scope: './' }).catch(function () {}); } catch (e) {} }

  function ready() {
    paintReacts(); paintTimes(); setInterval(paintTimes, 30000);
    if (C.dial) [].forEach.call(document.querySelectorAll('#bmIntakeForm input[type="tel"], #bmIntakeForm input[name="phone"]'), function (i) { if (!i.placeholder) i.placeholder = C.dial + ' …'; });
    var host = document.getElementById('posts');
    if (host && window.MutationObserver) new MutationObserver(function () { paintReacts(host); paintTimes(); }).observe(host, { childList: true });
    [].forEach.call(document.querySelectorAll('a[href]'), function (a) { var h = a.getAttribute('href') || ''; if (C.purchaseUrl && h === C.purchaseUrl) { a.target = '_blank'; a.rel = 'noopener'; } });
    var ov = document.getElementById('bmIntakeOverlay'); if (ov && ls('intake') === '1') ov.setAttribute('data-tf-done', '1');
    regSW();
    if (C.probe && realFetch && /^https?:$/.test(location.protocol)) realFetch(C.probe, { method: 'HEAD', cache: 'no-store' }).then(function (x) { if (!x.ok) notice('Your pictures, sounds and videos did not upload. Upload the uploads folder (it must sit next to index.html), then reload.'); }).catch(function () {});
  }
  function notice(t) {
    if (document.getElementById('tfNotice')) return; var d = document.createElement('div'); d.id = 'tfNotice'; d.setAttribute('role', 'alert');
    d.style.cssText = 'position:fixed;left:8px;right:8px;top:8px;z-index:2147483647;background:#7c2d12;color:#fff;font:14px/1.45 system-ui,sans-serif;padding:12px 40px 12px 14px;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.4)';
    d.textContent = t; var x = document.createElement('button'); x.textContent = '×'; x.setAttribute('aria-label', 'Close'); x.style.cssText = 'position:absolute;right:8px;top:6px;background:none;border:0;color:#fff;font-size:22px;cursor:pointer'; x.onclick = function () { d.remove(); }; d.appendChild(x); document.body.appendChild(d);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();
