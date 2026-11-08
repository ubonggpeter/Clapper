/* Live extras for a blog page: emoji sounds (cost points, heard by everyone present), auto-read (reads the blog aloud,
   plays audio/video, waits for poll votes) and the WhatsApp-style quick-post bar for blog owners the platform allows. */
(function () {
  if (window.__lx || typeof PAGE_ID === 'undefined') return; window.__lx = 1;
  var API = '/api/live-extras.php';
  if (false) { var gs = document.createElement('script'); gs.id = 'bmGateJs'; gs.src = 'assets/js/action-gate.js'; gs.async = true; document.head.appendChild(gs); }
  var S = { me: null, sound: { on: false, min: 0, cost: 0, last: 0 }, read: { on: false, min: 0 }, admin: null, pointsUrl: '' };
  var LS = { del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }, get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  var KEY_HEAR = 'lxHear_' + PAGE_ID, KEY_MAKE = 'lxMake_' + PAGE_ID;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function post(a, data) {
    var body = new URLSearchParams(Object.assign({ a: a, page_id: PAGE_ID }, data || {}));
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body, credentials: 'same-origin' }).then(function (r) { return r.json().catch(function () { return { ok: false, error: 'Bad reply' }; }); });
  }
  function get(a, q) { return fetch(API + '?a=' + a + '&page_id=' + PAGE_ID + (q || '') + '&_=' + Date.now(), { credentials: 'same-origin' }).then(function (r) { return r.json(); }); }

  /* ---------- toast ---------- */
  var toastEl, toastT;
  function toast(msg, link) {
    if (!toastEl) { toastEl = el('div', 'lx-toast'); document.body.appendChild(toastEl); }
    toastEl.innerHTML = esc(msg) + (link && link.href ? ' <a href="' + link.href + '">' + esc(link.text) + '</a>' : '') + (link && link.fn ? ' <button type="button" class="lx-tu">' + esc(link.text || 'Undo') + '</button>' : '');
    var tb = toastEl.querySelector('.lx-tu'); if (tb) tb.onclick = function () { toastEl.classList.remove('on'); clearTimeout(toastT); try { link.fn(); } catch (e) {} };
    toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('on'); }, link ? (link.fn ? 7000 : 7000) : 3800);
  }
  // every change a visitor makes to their own settings can be taken back for a few seconds
  function changed(msg, undo) { toast(msg, { text: 'Undo', fn: undo }); }

  /* ---------- sound engine (WebAudio, no files) ---------- */
  var AC = null;
  function ac() {
    if (!AC) { var C = window.AudioContext || window.webkitAudioContext; if (!C) return null; try { AC = new C(); } catch (e) { return null; } }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  }
  function noise(c, dur) { var n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; var s = c.createBufferSource(); s.buffer = b; return s; }
  function adsr(g, t, a, d, peak) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function tone(c, t, f0, f1, dur, type, peak, dest) {
    var o = c.createOscillator(), g = c.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    adsr(g, t, Math.min(0.02, dur / 3), dur, peak || 0.25); o.connect(g); g.connect(dest || c.destination); o.start(t); o.stop(t + dur + 0.05);
  }
  // a throaty "vowel": a buzzing oscillator pushed through two formant filters
  function vowel(c, t, f0, f1, dur, formants, peak) {
    var o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    var lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 6; lg.gain.value = 6; lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.1);
    adsr(g, t, 0.015, dur, peak); g.connect(c.destination);
    formants.forEach(function (fm) { var f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fm[0]; f.Q.value = fm[1]; o.connect(f); f.connect(g); });
    o.start(t); o.stop(t + dur + 0.05);
  }
  var SOUNDS = {
    laugh: function (c, t) { for (var i = 0; i < 6; i++) { var s = t + i * 0.16, f = 300 - i * 16; vowel(c, s, f * 1.3, f, 0.12, [[850, 5], [1350, 6]], 0.42 - i * 0.03);
      var n = noise(c, 0.1), hp = c.createBiquadFilter(), ng = c.createGain(); hp.type = 'highpass'; hp.frequency.value = 2500; adsr(ng, s, 0.01, 0.08, 0.05); n.connect(hp); hp.connect(ng); ng.connect(c.destination); n.start(s); n.stop(s + 0.12); } },
    yes: function (c, t) { tone(c, t, 660, 660, 0.12, 'triangle', 0.3); tone(c, t + 0.1, 990, 990, 0.25, 'triangle', 0.3); },
    heart: function (c, t) { [0, 0.26].forEach(function (d) { tone(c, t + d, 90, 50, 0.16, 'sine', 0.7); tone(c, t + d + 0.14, 80, 45, 0.14, 'sine', 0.55); }); [1320, 1760, 2093].forEach(function (f, i) { tone(c, t + 0.6 + i * 0.09, f, f, 0.3, 'sine', 0.12); }); },
    fire: function (c, t) { var n = noise(c, 1.2), bp = c.createBiquadFilter(), g = c.createGain(); bp.type = 'bandpass'; bp.Q.value = 0.9; bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(3200, t + 0.5); bp.frequency.exponentialRampToValueAtTime(900, t + 1.2); adsr(g, t, 0.25, 0.9, 0.5); n.connect(bp); bp.connect(g); g.connect(c.destination); n.start(t); n.stop(t + 1.25);
      for (var i = 0; i < 9; i++) { var s = t + 0.2 + Math.random() * 0.9, k = noise(c, 0.03), kg = c.createGain(); adsr(kg, s, 0.002, 0.03, 0.4); k.connect(kg); kg.connect(c.destination); k.start(s); k.stop(s + 0.04); } },
    wow: function (c, t) { vowel(c, t, 220, 360, 0.45, [[350, 6], [800, 7]], 0.5); vowel(c, t + 0.4, 360, 200, 0.5, [[300, 6], [870, 7]], 0.45); },
    sad: function (c, t) { [392, 370, 349, 262].forEach(function (f, i) { tone(c, t + i * 0.34, f, f * (i === 3 ? 0.8 : 0.98), i === 3 ? 0.9 : 0.34, 'sawtooth', 0.16); }); },
    clap: function (c, t) { for (var i = 0; i < 34; i++) { var s = t + i * 0.035 + Math.random() * 0.03, n = noise(c, 0.05), bp = c.createBiquadFilter(), g = c.createGain(); bp.type = 'bandpass'; bp.frequency.value = 1800 + Math.random() * 2500; bp.Q.value = 0.8; adsr(g, s, 0.002, 0.05, 0.35 * (1 - i / 50)); n.connect(bp); bp.connect(g); g.connect(c.destination); n.start(s); n.stop(s + 0.06); } },
    party: function (c, t) { var n = noise(c, 0.25), g = c.createGain(); adsr(g, t, 0.005, 0.2, 0.6); n.connect(g); g.connect(c.destination); n.start(t); n.stop(t + 0.26);
      [523, 659, 784, 1046].forEach(function (f, i) { tone(c, t + 0.1 + i * 0.09, f, f, 0.22, 'square', 0.14); }); tone(c, t + 0.5, 400, 900, 0.5, 'square', 0.1);
      for (var i = 0; i < 12; i++) { var s = t + 0.3 + Math.random() * 0.6; tone(c, s, 1500 + Math.random() * 2500, 800, 0.05, 'triangle', 0.15); } },
    grr: function (c, t) { vowel(c, t, 90, 70, 0.8, [[500, 3], [900, 3]], 0.6); },
    chime: function (c, t) { [1046, 1318, 1568].forEach(function (f, i) { tone(c, t + i * 0.12, f, f, 0.6, 'sine', 0.22); }); },
    pop: function (c, t) { tone(c, t, 400, 900, 0.12, 'sine', 0.4); tone(c, t + 0.1, 700, 500, 0.12, 'triangle', 0.2); }
  };
  var MAP = { '😂': 'laugh', '🤣': 'laugh', '😆': 'laugh', '😄': 'laugh', '😁': 'laugh', '👍': 'yes', '👌': 'yes', '✅': 'yes', '❤️': 'heart', '❤': 'heart', '😍': 'heart', '💖': 'heart', '🥰': 'heart', '🔥': 'fire', '😮': 'wow', '😲': 'wow', '😯': 'wow', '🤯': 'wow',
    '😢': 'sad', '😭': 'sad', '😞': 'sad', '👏': 'clap', '🙌': 'clap', '🎉': 'party', '🥳': 'party', '🎊': 'party', '😡': 'grr', '😠': 'grr', '🙏': 'chime', '💯': 'chime', '⭐': 'chime' };
  function synthSound(emoji) { var c = ac(); if (!c) return; try { (SOUNDS[MAP[emoji] || 'pop'])(c, c.currentTime + 0.02); } catch (e) {} }
  var esBuf = {}, MINE = {};
  function esFor(e) { var m = S.es || {}, b = String(e).replace(/\uFE0F/g, ''); return m[e] || m[b] || m[b + '\uFE0F'] || null; }
  function mineFor(e) { var b = String(e).replace(/\uFE0F/g, ''); return MINE[e] || MINE[b] || MINE[b + '\uFE0F'] || null; }
  function playUrl(url, fallback) {
    var c = ac(); if (!c) return;
    (esBuf[url] || (esBuf[url] = fetch(url, { credentials: 'same-origin' }).then(function (r) { return r.arrayBuffer(); }).then(function (ab) { return new Promise(function (ok, no) { c.decodeAudioData(ab, ok, no); }); }))).then(function (b) {
      var src = c.createBufferSource(), g = c.createGain(); src.buffer = b; g.gain.value = 0.95; src.connect(g); g.connect(c.destination); src.start(); }).catch(function () { delete esBuf[url]; if (fallback) fallback(); });
  }
  // a sound reference is "s:name" (a built-in sound) or "f:/path" (a recording or the blog's own sound file)
  function playRef(ref, emoji) {
    var c = ac(); if (!c || !ref) return false;
    if (ref.slice(0, 2) === 's:') { var f = SOUNDS[ref.slice(2)]; if (!f) return false; try { f(c, c.currentTime + 0.02); } catch (e) {} return true; }
    if (ref.slice(0, 2) === 'f:' && /^\/uploads\/audio\/[\w.-]+$/.test(ref.slice(2))) { playUrl(ref.slice(2), function () { synthSound(emoji); }); return true; }
    return false;
  }
  function playSound(emoji, ref) {
    if (ref && playRef(ref, emoji)) return;
    var url = esFor(emoji); if (!url) return synthSound(emoji); playUrl(url, function () { synthSound(emoji); });
  }
  function floatEmoji(emoji, who) {
    var f = el('div', 'lx-float', '<span>' + esc(emoji) + '</span>' + (who ? '<small>' + esc(who) + '</small>' : '')); f.style.left = (8 + Math.random() * 70) + '%';
    document.body.appendChild(f); setTimeout(function () { f.remove(); }, 2600);
  }

  /* ---------- dock + panels (sounds, pace, theme) ---------- */
  var tray, panels = {}, POS = {}, KEY_POS = 'lxPos_' + PAGE_ID, justDragged = 0;
  try { POS = JSON.parse(LS.get(KEY_POS) || '{}') || {}; } catch (e) { POS = {}; }
  function hearOn() { return LS.get(KEY_HEAR) !== '0'; }
  function makeOn() { return LS.get(KEY_MAKE) === '1'; }
  function canMake() { return S.sound.on && S.me && S.me.points >= Math.max(S.sound.min, S.sound.cost); }
  function icon3(name, size) { return window.LX3D ? LX3D.html(name, size || 34) : ''; }

  /* ----- the icon tray: one tidy bar above everything else; nothing floats over the blog unless the visitor drags it there ----- */
  var trayw = null, tab = null, KEY_HIDE = 'lxTrayHidden_' + PAGE_ID;
  function setTrayHidden(h) {
    LS.set(KEY_HIDE, h ? '1' : '0'); if (!trayw) return; trayw.classList.toggle('lx-collapsed', h);
    tab.innerHTML = '<span class="lx-chev2' + (h ? ' up' : '') + '"></span><span>' + (h ? 'Show icons' : 'Hide icons') + '</span>'; tab.setAttribute('aria-expanded', h ? 'false' : 'true'); measure();
  }
  function ensureDock() {
    if (!tray) {
      trayw = el('div', 'lx-trayw'); tab = el('button', 'lx-tab'); tab.type = 'button'; tray = el('div', 'lx-tray'); trayw.appendChild(tab); trayw.appendChild(tray); document.body.appendChild(trayw); document.body.classList.add('lx-tray-on');
      tab.onclick = function () { setTrayHidden(!trayw.classList.contains('lx-collapsed')); };
      setTrayHidden(LS.get(KEY_HIDE) === '1');
      if (window.ResizeObserver) { var ro = new ResizeObserver(measure); ro.observe(trayw); }
      window.addEventListener('resize', function () { measure(); $$('.lx-floating').forEach(function (n) { placeFloat(n, POS[n.getAttribute('data-lx-id')]); }); });
      setInterval(measure, 1500);
    }
    return tray;
  }
  function measure() {
    var th = trayw ? trayw.offsetHeight : 0, c = $('.lx-comp'), ch = c && getComputedStyle(c).display !== 'none' ? Math.round(c.getBoundingClientRect().height) : 0, r = document.documentElement.style;
    r.setProperty('--lx-comp', ch + 'px'); r.setProperty('--lx-bottom', (th + ch) + 'px');
    $$('.vx-fab>i').forEach(function (i) { i.classList.toggle('lx-zero', i.textContent.trim() === '0' || i.textContent.trim() === ''); });
  }
  function savePos() { LS.set(KEY_POS, JSON.stringify(POS)); }
  function placeFloat(n, p) { if (!p) return; var w = n.offsetWidth || 48, h = n.offsetHeight || 48, x = Math.max(4, Math.min(innerWidth - w - 4, p[0] * innerWidth)), y = Math.max(4, Math.min(innerHeight - h - 4, p[1] * innerHeight)); n.style.setProperty('--lx-x', x + 'px'); n.style.setProperty('--lx-y', y + 'px'); }
  function floatItem(n, p) { if (n.parentNode !== document.body) document.body.appendChild(n); n.classList.add('lx-floating'); placeFloat(n, p); }
  function homeItem(n, clientX) {
    n.classList.remove('lx-floating', 'lx-dragging'); n.style.removeProperty('--lx-x'); n.style.removeProperty('--lx-y'); delete POS[n.getAttribute('data-lx-id')]; savePos();
    var kids = $$('.lx-ti', ensureDock()), ref = null; kids.forEach(function (k) { if (!ref && clientX != null && k.getBoundingClientRect().left + k.offsetWidth / 2 > clientX) ref = k; }); tray.insertBefore(n, ref); measure();
  }
  var SHORT = { earn: 'Earn', ask: 'Ask AI', community: 'Community', bmp: 'Boost' };
  function tagItem(n, id, label, first) {
    n.classList.add('lx-ti'); n.setAttribute('data-lx-id', id); if (label) { n.setAttribute('title', label + ' (press and hold to move)'); n.setAttribute('aria-label', label); }
    var lb = n.querySelector(':scope > em.lx-lbl'); if (!lb) { lb = n.querySelector(':scope > em'); if (lb) lb.classList.add('lx-lbl'); }
    if (!lb) { lb = document.createElement('em'); lb.className = 'lx-lbl'; lb.textContent = SHORT[id] || label || id; n.appendChild(lb); }
    if (first) ensureDock().insertBefore(n, tray.firstChild); else ensureDock().appendChild(n);
    if (POS[id]) floatItem(n, POS[id]);
  }
  var ADOPT = [['.bm-rw-chip', 'earn', 'Earn points'], ['#bmAskAiToggle', 'ask', 'Ask AI'], ['.vx-fab', 'community', 'Community'], ['#bmBmpBtn', 'bmp', 'Boost points']];
  var adoptedN = 0;
  function adopt() { ADOPT.forEach(function (a) { var n = document.querySelector(a[0]); if (n && !n.__lxti) { n.__lxti = 1; tagItem(n, a[1], a[2], true); if (!n.classList.contains('lx-floating')) ensureDock().insertBefore(n, ensureDock().children[Math.min(adoptedN, ensureDock().children.length)] || null); adoptedN++; } }); }
  var adoptT = null; function adoptLater() { clearTimeout(adoptT); adoptT = setTimeout(function () { adopt(); if (tagStarted) applyTags(); }, 80); }
  function dockBtn(name, label, cls) {
    var b = el('button', 'lx-dbtn' + (cls ? ' ' + cls : ''), icon3(name, 30) + '<em>' + label + '</em>'); b.type = 'button'; b.__lxti = 1; tagItem(b, label.toLowerCase().replace(/[^a-z]/g, ''), label, false); return b;
  }
  // press and hold (touch) or drag (mouse) any icon to put it wherever you like; drop it back on the bar, or double-tap it, to tidy it away
  var drag = null, lastTap = 0;
  function startDrag(e) {
    var n = drag.n, r = n.getBoundingClientRect(); drag.on = true; drag.prev = POS[n.getAttribute('data-lx-id')] ? POS[n.getAttribute('data-lx-id')].slice() : null; drag.ox = drag.x - r.left; drag.oy = drag.y - r.top; if (navigator.vibrate) navigator.vibrate(12);
    document.body.appendChild(n); n.classList.add('lx-floating', 'lx-dragging'); n.style.setProperty('--lx-x', r.left + 'px'); n.style.setProperty('--lx-y', r.top + 'px'); tray.classList.add('lx-drop-ready'); if (trayw.classList.contains('lx-collapsed')) setTrayHidden(false);
    if (!LS.get('lxHint')) { LS.set('lxHint', '1'); }
  }
  document.addEventListener('pointerdown', function (e) {
    var n = e.target.closest && e.target.closest('.lx-ti'); if (!n || (e.pointerType === 'mouse' && e.button !== 0) || document.body.classList.contains('lx-rs')) return;
    e.stopPropagation();   // the platform's own per-button drag would fight this one
    drag = { n: n, x: e.clientX, y: e.clientY, on: false, id: e.pointerId, touch: e.pointerType !== 'mouse' };
    if (drag.touch) drag.t = setTimeout(function () { if (drag && !drag.on) startDrag(); }, 380);
  }, true);
  document.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return; if (drag.n.__lxti) e.stopPropagation();
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.on) { if (drag.touch) { if (Math.hypot(dx, dy) > 9) { clearTimeout(drag.t); drag = null; } return; } if (Math.hypot(dx, dy) > 6) startDrag(); else return; }
    e.preventDefault(); var n = drag.n, w = n.offsetWidth, h = n.offsetHeight, x = Math.max(4, Math.min(innerWidth - w - 4, e.clientX - drag.ox)), y = Math.max(4, Math.min(innerHeight - h - 4, e.clientY - drag.oy));
    n.style.setProperty('--lx-x', x + 'px'); n.style.setProperty('--lx-y', y + 'px'); tray.classList.toggle('lx-drop', e.clientY > trayw.getBoundingClientRect().top - 6);
  }, { capture: true, passive: false });
  document.addEventListener('touchmove', function (e) { if (drag && drag.on) e.preventDefault(); }, { passive: false });
  function endDrag(e) {
    if (!drag || (e && e.pointerId !== drag.id)) return; clearTimeout(drag.t); var d = drag; drag = null; if (!d.on) return;
    tray.classList.remove('lx-drop-ready', 'lx-drop'); d.n.classList.remove('lx-dragging'); justDragged = Date.now();
    var over = e && e.clientY > trayw.getBoundingClientRect().top - 6, id0 = d.n.getAttribute('data-lx-id'), prev = d.prev;
    var undoMove = function () { if (prev) { POS[id0] = prev; savePos(); floatItem(d.n, prev); } else homeItem(d.n, null); measure(); };
    if (over) { homeItem(d.n, e.clientX); if (prev) changed('Icon put back on the bar.', undoMove); } else { var r = d.n.getBoundingClientRect(); POS[id0] = [r.left / innerWidth, r.top / innerHeight]; savePos(); measure(); changed('Icon moved. Double-tap it to put it back.', undoMove); }
  }
  document.addEventListener('pointerup', endDrag, true); document.addEventListener('pointercancel', endDrag, true);
  document.addEventListener('click', function (e) { if (Date.now() - justDragged < 350 && e.target.closest && e.target.closest('.lx-ti')) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); } }, true);
  document.addEventListener('click', function (e) { var n = e.target.closest && e.target.closest('.lx-floating'); if (!n) return; var now = Date.now(); if (now - lastTap < 380 && n.__lastTapN === n) { e.preventDefault(); e.stopPropagation(); homeItem(n, null); lastTap = 0; return; } lastTap = now; n.__lastTapN = n; }, true);

  /* ----- instant click feedback + progress card for anything that takes a moment ----- */
  var PRESS = '.lx-ti,.bm-post-btn,.lx-menu button,.lx-rs-row button,.lx-send,.lx-ci,.bm-reaction-btn,.bm-poll-option,.lx-mr button';
  document.addEventListener('pointerdown', function (e) {
    var n = e.target.closest && e.target.closest(PRESS); if (!n) return; n.classList.add('lx-press'); var i3 = n.querySelector('.i3d'); if (i3) { i3.classList.add('lx-spin'); setTimeout(function () { i3.classList.remove('lx-spin'); }, 700); }
    setTimeout(function () { n.classList.remove('lx-press'); }, 450);
  }, true);
  var hud = null, hudTasks = [];
  function hudRender() {
    var shown = hudTasks.filter(function (t) { return t.shown; });
    if (!shown.length) { if (hud) { hud.remove(); hud = null; } return; }
    if (!hud) { hud = el('div', 'lx-hud'); document.body.appendChild(hud); }
    // update in place: rebuilding the buttons several times a second would swallow taps on Cancel / Done
    Array.prototype.slice.call(hud.children).forEach(function (c) { if (!shown.some(function (t) { return 't' + t.id === c.id; })) c.remove(); });
    shown.forEach(function (t) {
      var node = document.getElementById('t' + t.id);
      if (!node) { node = el('div', 'lx-task run', '<div class="lx-tt"><b></b><span></span></div><div class="lx-tb"><i></i></div><div class="lx-tr"></div>'); node.id = 't' + t.id; node.__st = ''; hud.appendChild(node); }
      $('b', node).textContent = t.label; $('span', node).textContent = t.state === 'fail' ? 'Failed' : Math.round(t.pct) + '%'; $('.lx-tb i', node).style.width = t.pct + '%';
      if (node.__st !== t.state) { node.__st = t.state; node.className = 'lx-task ' + t.state; var fin = t.state !== 'run'; $('.lx-tr', node).innerHTML = fin ? '<button type="button" data-t="' + t.id + '" data-a="done" class="ok">Done</button>' : '<button type="button" data-t="' + t.id + '" data-a="cancel">Cancel</button>'; }
    });
  }
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('.lx-hud button'); if (!b) return; e.stopPropagation(); var t = hudTasks.filter(function (x) { return x.id == b.getAttribute('data-t'); })[0]; if (!t) return; if (b.getAttribute('data-a') === 'cancel') t.cancel(); else t.close(); }, true);
  var taskId = 0;
  /** task('Saving…', { est: 1500, onCancel: fn, delay: 350 }) -> { set(pct), done(msg), fail(msg), cancelled } . Shows up only if it is still running after `delay` ms. */
  function task(label, opt) {
    opt = opt || {}; var t = { id: ++taskId, label: label, pct: 2, state: 'run', shown: false, cancelled: false }, tm = null, iv = null, t0 = Date.now();
    t.close = function () { clearInterval(iv); clearTimeout(tm); clearTimeout(t.ac); hudTasks = hudTasks.filter(function (x) { return x !== t; }); hudRender(); };
    t.set = function (p) { t.pct = Math.max(t.pct, Math.min(99, p)); t.est = false; if (t.shown) hudRender(); };
    t.done = function (msg) { if (t.state !== 'run') return; t.state = 'done'; t.pct = 100; clearInterval(iv); if (!t.shown) { t.close(); return; } if (msg) t.label = msg; hudRender(); t.ac = setTimeout(t.close, 2600); };
    t.fail = function (msg) { if (t.state !== 'run') return; t.state = 'fail'; clearInterval(iv); if (!t.shown) { t.close(); if (msg) toast(msg); return; } if (msg) t.label = msg; hudRender(); t.ac = setTimeout(t.close, 3500); };
    t.cancel = function () { if (t.state !== 'run') return; t.cancelled = true; t.state = 'cancel'; try { opt.onCancel && opt.onCancel(); } catch (x) {} t.close(); toast('Cancelled'); };
    t.est = opt.est !== 0; hudTasks.push(t);
    tm = setTimeout(function () { t.shown = true; hudRender(); }, opt.delay == null ? 350 : opt.delay);
    iv = setInterval(function () { if (t.est && t.state === 'run') { var span = opt.est || 3000, f = Math.min(0.92, (Date.now() - t0) / span); t.pct = Math.max(t.pct, 92 * (1 - Math.pow(1 - f, 2))); } if (t.shown) hudRender(); }, 160);
    return t;
  }
  // opening Ask AI / Community / the intake form: show progress until the thing is really on screen
  function watchOpen(label, test, max) { var t = task('Opening ' + label + '…', { est: 1400, delay: 250 }), n = 0; var iv = setInterval(function () { n += 1; if (t.state !== 'run') { clearInterval(iv); return; } var ok = false; try { ok = test(); } catch (x) {} if (ok) { clearInterval(iv); t.done(label + ' is open'); } else if (n * 120 > (max || 9000)) { clearInterval(iv); t.fail(label + ' is taking too long'); } }, 120); t.onCancelClose = function () {}; return t; }
  document.addEventListener('click', function (e) {
    var n = e.target.closest && e.target.closest('.lx-ti[data-lx-id=ask],.lx-ti[data-lx-id=community]'); if (n) { if (n.getAttribute('data-lx-id') === 'ask') { var t = watchOpen('Ask AI', function () { var p = document.getElementById('bmAskAiPanel'); return p && getComputedStyle(p).display !== 'none'; }); } else watchOpen('Community', function () { return !!document.querySelector('.vx-p.on'); }); return; }
    var b = e.target.closest && e.target.closest('.bm-post-btn'); if (b && /Intake|Join/i.test(b.textContent)) watchOpen('the form', function () { return !!document.querySelector('form input[name=email]') && document.querySelector('form input[name=email]').offsetParent !== null; });
    else if (b && /Download App/i.test(b.textContent)) { var t2 = task('Getting the app ready…', { est: 1800, delay: 300 }); setTimeout(function () { t2.done('Follow the install prompt'); }, 1700); }
  }, false);

  function getPanel(id) { if (!panels[id]) { panels[id] = el('div', 'lx-panel'); document.body.appendChild(panels[id]); } return panels[id]; }
  function togglePanel(id, render) { Object.keys(panels).forEach(function (k) { if (k !== id) panels[k].classList.remove('on'); }); var p = getPanel(id); render(p); p.classList.toggle('on'); }
  document.addEventListener('click', function (e) { Object.keys(panels).forEach(function (k) { var p = panels[k]; if (p.classList.contains('on') && !p.contains(e.target) && !(e.target.closest && e.target.closest('.lx-dbtn, .lx-tour'))) p.classList.remove('on'); }); });

  /* ---------- my own sound for an emoji (existing sound or a recording of at most 2 seconds) ---------- */
  function wavFrom(buf, maxSec) {
    var rate = 16000, n = Math.min(Math.floor(buf.duration * rate), Math.floor(maxSec * rate)), oc = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, Math.max(n, 1), rate), src = oc.createBufferSource();
    src.buffer = buf; src.connect(oc.destination); src.start(0);
    return oc.startRendering().then(function (r) {
      var d = r.getChannelData(0), peak = 0, i; for (i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i])); var k = peak > 0.01 ? Math.min(4, 0.9 / peak) : 1;
      var out = new DataView(new ArrayBuffer(44 + d.length * 2)), w = function (o, t) { for (var j = 0; j < t.length; j++) out.setUint8(o + j, t.charCodeAt(j)); };
      w(0, 'RIFF'); out.setUint32(4, 36 + d.length * 2, true); w(8, 'WAVE'); w(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true); out.setUint32(24, rate, true); out.setUint32(28, rate * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, d.length * 2, true);
      for (i = 0; i < d.length; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i] * k)) * 32767, true);
      return new Blob([out], { type: 'audio/wav' });
    });
  }
  function mySounds() {
    var m = el('div', 'lx-modal', '<div class="lx-mb lx-ms"><b class="lx-ph">' + icon3('speaker', 26) + ' My emoji sounds</b><p>Choose how each emoji sounds when <b>you</b> tap it. Your sound replaces the blog\'s own sound for you. Recordings are 2 seconds at most.</p><div id="lxMsBody"><i>Loading…</i></div><div class="lx-mr"><button type="button" data-x="1">Done</button></div></div>');
    document.body.appendChild(m); m.addEventListener('click', function (e) { if (e.target === m || (e.target.closest && e.target.closest('[data-x]'))) m.remove(); });
    var box = $('#lxMsBody', m), D = null, rec = null;
    function label(ref) { if (!ref) return 'Blog\'s sound'; if (ref.slice(0, 2) === 's:') { var f = (D.synth || []).filter(function (x) { return x[0] === ref.slice(2); })[0]; return f ? f[1] : 'Sound'; } return /\/vs-/.test(ref) ? 'My recording' : 'Blog sound'; }
    function paint() {
      if (!D.signed) { box.innerHTML = '<p class="lx-need">Join this blog to earn points first. <a href="' + S.pointsUrl + '">Join &amp; earn</a></p>'; return; }
      var ok = D.points >= D.need, opts = '<option value="">Pick an existing sound…</option>' + D.synth.map(function (x) { return '<option value="s:' + x[0] + '">' + esc(x[1]) + '</option>'; }).join('') + D.files.map(function (x) { return '<option value="f:' + esc(x[0]) + '">' + esc(x[1]) + '</option>'; }).join('');
      box.innerHTML = (ok ? '<p class="lx-ok">Each time you use your own sound it costs <b>' + D.cost + '</b> point' + (D.cost === 1 ? '' : 's') + '. You have <b>' + D.points + '</b>.</p>' : '<p class="lx-need">You need <b>' + D.need + '</b> points to set your own sounds. You have <b>' + D.points + '</b>. <a href="' + S.pointsUrl + '">Get points</a></p>') +
        (D.emojis.length ? D.emojis.map(function (e) { var r = mineFor(e); return '<div class="lx-mse" data-e="' + esc(e) + '"><span class="lx-mse-e">' + esc(e) + '</span><span class="lx-mse-n">' + esc(label(r)) + (r ? '' : ' <small>(default)</small>') + '</span><div class="lx-mse-b"><button type="button" data-a="play">▶</button><select data-a="pick"' + (ok ? '' : ' disabled') + '>' + opts + '</select><button type="button" data-a="rec"' + (ok ? '' : ' disabled') + '>● Record</button>' + (r ? '<button type="button" data-a="del" class="dng">Back to default</button>' : '') + '</div></div>'; }).join('') : '<p>No emojis to set yet.</p>');
    }
    function save(e, fd, done) { fd.append('a', 'mysound_set'); fd.append('page_id', PAGE_ID); fd.append('emoji', e); fetch(API, { method: 'POST', body: fd, credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (d) { if (d.ok) { MINE = d.mine || {}; D.mine = MINE; toast('Saved. It costs ' + D.cost + ' pt each time you use it.'); paint(); if (done) done(); } else { toast(d.error || 'Could not save.'); paint(); } }).catch(function () { toast('Network problem. Try again.'); }); }
    box.addEventListener('change', function (ev) {
      var sel = ev.target.closest('select[data-a=pick]'); if (!sel || !sel.value) return; var e = sel.closest('[data-e]').getAttribute('data-e'), fd = new FormData(); fd.append('mode', sel.value.slice(0, 2) === 's:' ? 'synth' : 'file'); fd.append('value', sel.value.slice(2));
      ac(); playRef(sel.value, e); save(e, fd);
    });
    box.addEventListener('click', function (ev) {
      var bt = ev.target.closest('button[data-a]'); if (!bt) return; var row = bt.closest('[data-e]'), e = row.getAttribute('data-e'), a = bt.getAttribute('data-a');
      if (a === 'play') { ac(); var r = mineFor(e); if (r) playRef(r, e); else playSound(e); }
      else if (a === 'del') { var fd = new FormData(); fd.append('a', 'mysound_del'); fd.append('page_id', PAGE_ID); fd.append('emoji', e); fetch(API, { method: 'POST', body: fd, credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (d) { if (d.ok) { MINE = d.mine || {}; D.mine = MINE; toast('Back to the blog\'s sound.'); paint(); } }); }
      else if (a === 'rec') {
        if (rec) { rec.stop(); return; }
        if (!navigator.mediaDevices || !window.MediaRecorder) { toast('Recording is not supported here. Pick an existing sound.'); return; }
        navigator.mediaDevices.getUserMedia({ audio: true }).then(function (st) {
          var ch = [], t0 = Date.now(), tm; rec = new MediaRecorder(st); bt.classList.add('rec'); bt.textContent = '■ 2.0s';
          rec.ondataavailable = function (x) { if (x.data.size) ch.push(x.data); };
          tm = setInterval(function () { var left = Math.max(0, 2 - (Date.now() - t0) / 1000); bt.textContent = '■ ' + left.toFixed(1) + 's'; }, 100);
          rec.onstop = function () { clearInterval(tm); st.getTracks().forEach(function (t) { t.stop(); }); var blob = new Blob(ch, { type: rec.mimeType || 'audio/webm' }); rec = null; bt.textContent = 'Saving…';
            blob.arrayBuffer().then(function (ab) { var c = ac(); return new Promise(function (ok, no) { c.decodeAudioData(ab, ok, no); }); }).then(function (buf) { return wavFrom(buf, 2); }).then(function (wav) { var fd = new FormData(); fd.append('mode', 'record'); fd.append('audio', new File([wav], 'mine.wav', { type: 'audio/wav' })); save(e, fd, function () { var r = mineFor(e); if (r) playRef(r, e); }); }).catch(function () { toast('Could not read the recording. Try again.'); paint(); }); };
          rec.start(); setTimeout(function () { if (rec && rec.state === 'recording') rec.stop(); }, 2000);
        }).catch(function () { toast('Allow the microphone to record a sound.'); });
      }
    });
    get('mysounds').then(function (d) { if (!d.ok) { box.textContent = 'Could not load. Try again.'; return; } D = d; MINE = d.mine || {}; paint(); }).catch(function () { box.textContent = 'Could not load. Try again.'; });
  }

  /* fill the little 3D icons the server leaves in notes (data-lx3d), now and for posts that arrive later */
  function paint3d(root) { if (!window.LX3D) return; [].forEach.call((root || document).querySelectorAll('[data-lx3d]:not([data-lx3d-done])'), function (e) { e.setAttribute('data-lx3d-done', '1'); e.innerHTML = icon3(e.getAttribute('data-lx3d'), e.classList.contains('lx-ic-s') ? 20 : 30); }); }
  /* make a note or bar draggable by touch or mouse (offset kept on this device, double-tap puts it back) */
  function lxDrag(el, key) {
    var k = 'lxNote_' + key + '_' + PAGE_ID, pos = { x: 0, y: 0 }, st = null;
    try { var o = JSON.parse(LS.get(k) || 'null'); if (o && isFinite(o.x) && isFinite(o.y)) pos = o; } catch (e) {}
    function fit() { var r = el.getBoundingClientRect(), W = window.innerWidth, dx = 0; el.style.translate = pos.x + 'px ' + pos.y + 'px'; r = el.getBoundingClientRect(); if (r.left < 6) dx = 6 - r.left; else if (r.right > W - 6) dx = W - 6 - r.right; if (dx) { pos.x += dx; el.style.translate = pos.x + 'px ' + pos.y + 'px'; } }
    function put(save) { pos.y = Math.max(-600, Math.min(600, pos.y)); fit(); if (save) { try { LS.set(k, JSON.stringify(pos)); } catch (e) {} } }
    el.classList.add('lx-draggable'); put(false);
    el.addEventListener('pointerdown', function (e) { if (e.target.closest('button, a, input')) return; st = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y, id: e.pointerId, moved: false }; try { el.setPointerCapture(e.pointerId); } catch (x) {} });
    el.addEventListener('pointermove', function (e) { if (!st || e.pointerId !== st.id) return; var dx = e.clientX - st.sx, dy = e.clientY - st.sy; if (!st.moved && Math.hypot(dx, dy) < 5) return; st.moved = true; el.classList.add('is-moving'); e.preventDefault(); pos.x = st.ox + dx; pos.y = st.oy + dy; put(false); });
    function end(e) { if (!st || (e && e.pointerId !== st.id)) return; var m = st.moved; st = null; el.classList.remove('is-moving'); try { el.releasePointerCapture(e.pointerId); } catch (x) {} if (m) put(true); }
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    el.addEventListener('dblclick', function () { pos = { x: 0, y: 0 }; put(true); });
    window.addEventListener('resize', function () { fit(); });
  }
  function dragNotes(root) { [].forEach.call((root || document).querySelectorAll('[data-lx-drag]:not([data-lx-dragged])'), function (e) { e.setAttribute('data-lx-dragged', '1'); lxDrag(e, e.getAttribute('data-lx-drag')); }); }
  function decorateNotes() { paint3d(); dragNotes(); }
  var decT = 0; function decSoon() { if (decT) return; decT = requestAnimationFrame(function () { decT = 0; decorateNotes(); }); }
  try { new MutationObserver(decSoon).observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
  decSoon(); window.addEventListener('load', decSoon);
  /* owner is looking at their own blog "as a visitor": a small draggable bar says so and puts them back */
  function asVisitorPill() {
    if (document.getElementById('lxAsVis')) return;
    var d = document.createElement('div'); d.id = 'lxAsVis'; d.className = 'lx-asvis'; d.setAttribute('role', 'status'); d.setAttribute('data-lx-drag', 'asvis');
    d.innerHTML = '<span class="lx-ic" data-lx3d="eye" aria-hidden="true"></span><span class="lx-nt"><b>Viewing as a visitor</b><small>Premium stays locked and your owner tools are hidden.</small></span><button type="button">Back to my view</button>';
    d.querySelector('button').onclick = function () { try { document.cookie = 'bm_asvis=;path=/;max-age=0;SameSite=Lax'; sessionStorage.setItem('lxToast', 'Back to your owner view.'); } catch (e) {} location.reload(); };
    document.body.appendChild(d); decorateNotes();
  }
  var KEY_AMB = 'lxAmbOff_' + PAGE_ID, KEY_AWAY = 'lxAwayOff';
  function setKeys() { return [KEY_HEAR, KEY_MAKE, KEY_THEME, KEY_AWAY, KEY_AMB, KEY_POS, KEY_HIDE]; }
  function snapshot() { var o = {}; setKeys().forEach(function (k) { o[k] = LS.get(k); }); return o; }
  function restoreSnap(o) { Object.keys(o).forEach(function (k) { if (o[k] == null) LS.del(k); else LS.set(k, o[k]); }); }
  // "Reset all my settings": theme, sounds, come-back audio, background sound, icon places and speed all go back to how the blog's owner set it up
  function resetAll() {
    var before = snapshot(), pace = S.pace && S.pace.current || 0;
    setKeys().forEach(function (k) { LS.del(k); });
    try { if (pace) sessionStorage.setItem('lxPaceUndo', String(pace)); } catch (e) {}
    var go = function () { try { sessionStorage.setItem('lxToast', 'Everything is back to default.'); sessionStorage.setItem('lxUndoAll', JSON.stringify(before)); } catch (e) {} location.reload(); };
    if (pace) post('pace', { minutes: 0 }).then(go); else go();
  }
  var DEF = ' <small class="lx-def">default</small>';
  function renderSound(panel) {
    var need = Math.max(S.sound.min, S.sound.cost), pts = S.me ? S.me.points : 0, amb = S.amb && S.amb.kind && S.amb.kind !== 'off' && window.LXAmbient;
    var h = '<b class="lx-ph">' + icon3('speaker', 26) + ' Sounds</b><p>Tap an emoji on a post and everyone here hears it.</p>' +
      (amb ? '<label class="lx-row lx-master"><input type="checkbox" id="lxAll" ' + (hearOn() && LXAmbient.enabled() ? 'checked' : '') + '> <span><b>All sounds</b> <small>(switch off to silence everything on this blog, including the ' + ({ waves: 'sea waves', bubbles: 'water bubbles', drops: 'water drops', rain: 'soft rain' }[S.amb.kind] || 'background sound') + ')</small></span></label>' : '') +
      '<label class="lx-row"><input type="checkbox" id="lxHear" ' + (hearOn() ? 'checked' : '') + '> <span>Hear emoji sounds from others' + DEF + '</span></label>' +
      (amb ? '<label class="lx-row"><input type="checkbox" id="lxAmb2"' + (LXAmbient.enabled() ? ' checked' : '') + '> <span>Background sound' + DEF + ' <small>(' + ({ waves: 'sea waves', bubbles: 'water bubbles', drops: 'water drops', rain: 'soft rain' }[S.amb.kind] || S.amb.kind) + ')</small></span></label>' : '') +
      '<label class="lx-row"><input type="checkbox" id="lxMake" ' + (makeOn() && canMake() ? 'checked' : '') + (canMake() ? '' : ' disabled') + '> <span>Make my own sounds <small>(' + S.sound.cost + ' pt each)</small></span></label>';
    if (!S.me) h += '<p class="lx-need">Join this blog to start earning points. <a href="' + S.pointsUrl + '">Join &amp; earn</a></p>';
    else if (!canMake()) h += '<p class="lx-need">You need <b>' + need + '</b> points to make sounds. You have <b>' + pts + '</b>. <a href="' + S.pointsUrl + '">Get points</a></p>';
    else h += '<p class="lx-ok">You have <b>' + pts + '</b> points.</p>';
    if (S.me) h += '<button type="button" class="lx-reset lx-mine" id="lxMine">My own emoji sounds</button>';
    h += '<button type="button" class="lx-reset" id="lxSndDef">Back to default</button>';
    panel.innerHTML = h;
    var hb = $('#lxHear', panel), mb = $('#lxMake', panel), ab = $('#lxAmb2', panel), al = $('#lxAll', panel);
    if (ab) ab.onchange = function () { var was = !ab.checked; LXAmbient.setEnabled(ab.checked); renderSound(panel); changed(ab.checked ? 'Background sound is on.' : 'Background sound is off.', function () { LXAmbient.setEnabled(was); renderSound(panel); }); };
    if (al) al.onchange = function () {
      var on = al.checked, h0 = LS.get(KEY_HEAR), m0 = LS.get(KEY_MAKE), a0 = LXAmbient.enabled();
      LS.set(KEY_HEAR, on ? '1' : '0'); if (!on) LS.set(KEY_MAKE, '0'); LXAmbient.setEnabled(on); renderSound(panel);
      changed(on ? 'All sounds are on.' : 'All sounds are off.', function () { if (h0 == null) LS.del(KEY_HEAR); else LS.set(KEY_HEAR, h0); if (m0 == null) LS.del(KEY_MAKE); else LS.set(KEY_MAKE, m0); LXAmbient.setEnabled(a0); renderSound(panel); });
    };
    if (hb) hb.onchange = function () { var was = !hb.checked; LS.set(KEY_HEAR, hb.checked ? '1' : '0'); ac(); if (hb.checked) playSound('👍'); changed(hb.checked ? 'You will hear everyone\'s sounds.' : 'Sounds from others are off.', function () { LS.set(KEY_HEAR, was ? '1' : '0'); renderSound(panel); }); };
    if (mb) mb.onchange = function () { var was = !mb.checked; LS.set(KEY_MAKE, mb.checked ? '1' : '0'); ac(); if (mb.checked) playSound('😂'); changed(mb.checked ? 'Your sounds are ON (' + S.sound.cost + ' pt each).' : 'Your sounds are off.', function () { LS.set(KEY_MAKE, was ? '1' : '0'); renderSound(panel); }); };
    var mn = $('#lxMine', panel); if (mn) mn.onclick = function () { panel.classList.remove('on'); mySounds(); };
    $('#lxSndDef', panel).onclick = function () { var hs = LS.get(KEY_HEAR), ms = LS.get(KEY_MAKE), a0 = window.LXAmbient ? LXAmbient.enabled() : true; LS.del(KEY_HEAR); LS.del(KEY_MAKE); if (window.LXAmbient) LXAmbient.setEnabled(true); renderSound(panel); changed('Sound settings are back to default.', function () { if (hs != null) LS.set(KEY_HEAR, hs); if (ms != null) LS.set(KEY_MAKE, ms); if (window.LXAmbient) LXAmbient.setEnabled(a0); renderSound(panel); }); };
  }
  function initSound() {
    if (!S.sound.on) return;
    var b = dockBtn('speaker', 'Sounds');
    b.onclick = function (e) { e.stopPropagation(); ac(); refreshMe().then(function () { togglePanel('sound', renderSound); }); };
    document.addEventListener('click', function (e) {
      var b2 = e.target.closest && e.target.closest('.bm-reaction-btn'); if (!b2) return; ac();
      if (b2.classList.contains('active')) return;          // un-reacting makes no sound
      if (!makeOn() || !canMake()) { if (!mineFor(b2.getAttribute('data-emoji')) && esFor(b2.getAttribute('data-emoji'))) playSound(b2.getAttribute('data-emoji')); return; }   // the owner gave this emoji its own sound: whoever taps it hears it (free, just for them)
      var holder = b2.closest('[data-post-id]'); var pid = holder && holder.getAttribute('data-post-id'); if (!pid) return;
      var emoji = b2.getAttribute('data-emoji');
      post('sound', { post_id: pid, emoji: emoji }).then(function (d) {
        if (d.ok) { playSound(emoji, d.ref); floatEmoji(emoji, 'You'); if (S.me) S.me.points = d.points; toast('-' + d.spent + ' pt · ' + d.points + ' left'); }
        else { if (!mineFor(emoji) && esFor(emoji)) playSound(emoji); if (!d.soft) { toast(d.error || 'Could not play the sound.', d.need ? { href: S.pointsUrl, text: 'Get points' } : null); if (d.need && d.have != null && S.me) S.me.points = d.have; } }
      });
    }, true);
  }
  function refreshMe() { return get('points').then(function (d) { if (d.ok) { if (d.signed) { S.me = S.me || { name: '' }; S.me.points = d.points; } else S.me = null; } }).catch(function () {}); }

  /* ---------- live tick: everyone's sounds, layout changes, deleted / edited / pinned posts ---------- */
  var tickTimer = null, lastId = 0, lv = -1, ets = 0, sv = '', knownN = -1, ticking = false, lastActive = Date.now();
  ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(function (ev) { window.addEventListener(ev, function () { lastActive = Date.now(); }, { passive: true, capture: true }); });
  function setLayoutCss(css) { var st = document.getElementById('lxLayoutCss'); if (!st) { st = document.createElement('style'); st.id = 'lxLayoutCss'; document.head.appendChild(st); } if (st.textContent !== css) st.textContent = css; }
  function setPinned(id, text) {
    var bar = document.getElementById('bmPinnedBar');
    if (!id) { if (bar) bar.remove(); return; }
    if (!bar) { bar = el('button', 'bm-pinned-bar', '<span class="bm-pinned-bar-label">Pinned</span> <span class="bm-pinned-bar-text"></span>'); bar.type = 'button'; bar.id = 'bmPinnedBar'; var th = document.getElementById('posts'); th.parentNode.insertBefore(bar, th); bar.addEventListener('click', function () { var t = document.querySelector('.bm-post[data-post-id="' + bar.getAttribute('data-pinned-post-id') + '"]'); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'center' }); }); }
    bar.setAttribute('data-pinned-post-id', id); if (text != null) { var tx = $('.bm-pinned-bar-text', bar); if (tx) tx.textContent = text; }
  }
  function renderBody(node, title, body) {
    var bub = $('.bm-post-bubble', node); if (!bub) return; var h2 = $(':scope > h2', bub);
    if (h2 && title != null) h2.textContent = title;
    var tgt = $('figcaption', bub) || $(':scope > p', bub); if (tgt && body != null) tgt.innerHTML = esc(body).replace(/\n/g, '<br>');
    var tm = $('time', node); if (tm && !/edited/.test(tm.textContent)) tm.textContent += ' · edited';
  }
  // social links in the footer, drawn with the 3D icons (everybody sees the same list; the owner can add more from the Social panel)
  var SOC = { whatsapp: 'wa', telegram: 'tg', instagram: 'ig', tiktok: 'tt', youtube: 'yt', facebook: 'fb', twitter: 'x', linkedin: 'in', website: 'web' };
  function renderSocial(list) {
    var foot = $('.bm-page-footer'); if (!foot) return; var box = $('.bm-footer-social', foot);
    if (!list || !list.length) { if (box) box.remove(); return; }
    if (!box) { box = el('div', 'bm-footer-social'); box.style.cssText = 'display:flex;justify-content:center;gap:14px;margin-bottom:14px;flex-wrap:wrap'; var after = $('.bm-footer-buttons', foot); if (after) after.after(box); else foot.insertBefore(box, foot.firstChild); }
    box.innerHTML = list.map(function (x) { return '<a href="' + esc(x.url) + '" target="_blank" rel="noopener noreferrer" aria-label="' + esc(x.platform) + '" title="' + esc(x.platform) + '">' + icon3(SOC[x.platform] || 'web', 40) + '</a>'; }).join('');
  }

  /* ---------- heads-up pop-up for a post that arrives while the visitor is reading something else ---------- */
  var notifEl = null, notifT = null, notifCount = 0, notifTarget = null;
  function snippetOf(node) {
    var b = node.querySelector && node.querySelector('.bm-post-bubble'); if (!b) return { t: 'New post', b: '' };
    var h = b.querySelector(':scope > h2'), c = b.querySelector('figcaption') || b.querySelector(':scope > p'), txt = (c ? c.textContent : '').replace(/\s+/g, ' ').trim(), head = h ? h.textContent.replace(/\s+/g, ' ').trim() : '';
    var kind = b.querySelector('.bm-poll') ? 'Poll' : b.querySelector('video') ? 'Video' : b.querySelector('audio') ? 'Voice message' : b.querySelector('img') ? 'Photo' : '';
    var body = head || txt || kind || 'New post'; if (head && txt) body = head + ': ' + txt; else if (kind && !head && !txt) body = kind;
    body = body.replace(/^\s+|\s+$/g, ''); if (body.length > 70) body = body.slice(0, 68).replace(/\s+\S*$/, '') + '…'; return { t: kind && (head || txt) ? kind : 'New post', b: body };
  }
  function hideNotif() { if (!notifEl) return; var n = notifEl; notifEl = null; clearTimeout(notifT); n.classList.remove('on'); notifCount = 0; setTimeout(function () { n.remove(); }, 260); }
  function notifyNew(nodes) {
    if (!nodes || !nodes.length || document.hidden) return; var last = nodes[nodes.length - 1], sn = snippetOf(last); notifTarget = last; notifCount += nodes.length;
    var logo = (document.querySelector('.bm-post-avatar img') || {}).src || '', name = ((document.querySelector('.bm-post-header') || {}).childNodes || [])[0]; name = name ? String(name.textContent || '').trim() : '';
    if (!name) name = (document.title || '').split(' - ')[0];
    var html = '<div class="lx-nt-ic">' + (logo ? '<img src="' + esc(logo) + '" alt="">' : '<b>' + esc(name.charAt(0)) + '</b>') + '</div><div class="lx-nt-tx"><div class="lx-nt-top"><b>' + esc(name) + '</b><span>' + (notifCount > 1 ? notifCount + ' new posts' : 'now') + '</span></div><div class="lx-nt-bd">' + esc(sn.b) + '</div></div>';
    if (!notifEl) { notifEl = el('div', 'lx-notif'); notifEl.setAttribute('role', 'status'); notifEl.setAttribute('aria-live', 'polite'); document.body.appendChild(notifEl); requestAnimationFrame(function () { requestAnimationFrame(function () { if (notifEl) notifEl.classList.add('on'); }); }); }
    notifEl.innerHTML = html; clearTimeout(notifT);
    var ms = Math.max(1000, Math.min(4000, 1100 + sn.b.length * 35));          // 1 to 4 seconds, longer for longer text
    notifT = setTimeout(hideNotif, ms);
  }
  document.addEventListener('click', function (e) { var n = e.target.closest && e.target.closest('.lx-notif'); if (!n) return; if (notifTarget && document.body.contains(notifTarget)) notifTarget.scrollIntoView({ behavior: 'smooth', block: 'center' }); hideNotif(); });
  (function () { var sy = null; document.addEventListener('pointerdown', function (e) { if (e.target.closest && e.target.closest('.lx-notif')) { sy = e.clientY; clearTimeout(notifT); } }); document.addEventListener('pointerup', function (e) { if (sy == null) return; var dy = e.clientY - sy; sy = null; if (dy < -18) hideNotif(); else if (notifEl) notifT = setTimeout(hideNotif, 1500); }); })();
  window.addEventListener('bm:newposts', function (e) { notifyNew((e.detail && e.detail.nodes) || []); });
  function appendFresh(htmls) {
    var th = document.getElementById('posts'); if (!th) return; var added = [], wasNear = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 260;
    (htmls || []).forEach(function (h) { var w = el('div'); w.innerHTML = h; var node = w.firstElementChild; if (node && !th.querySelector('[data-post-id="' + node.getAttribute('data-post-id') + '"]')) { node.removeAttribute('data-bm-anim-pending'); node.classList.add('lx-pop'); th.appendChild(node); added.push(node); } });
    if (added.length) { if (window.lucide && lucide.createIcons) { try { lucide.createIcons(); } catch (x) {} } if (window.LXAdmin) added.forEach(LXAdmin.decorate); if (window.LX3D) LX3D.swap(); if (!(window.LXAdmin && LXAdmin.busy())) { if (wasNear) added[added.length - 1].scrollIntoView({ behavior: 'smooth', block: 'end' }); else notifyNew(added); } }
  }
  function fetchNew() {
    if (typeof DRIP_ACTIVE !== 'undefined' && DRIP_ACTIVE) return fetch('/api/drip-feed.php?page_id=' + PAGE_ID, { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (d) { if (d && d.ok) appendFresh(d.html); });
    var have = $$('#posts .bm-post[data-post-id]').map(function (n) { return n.getAttribute('data-post-id'); }).join(',');
    return get('newposts', '&have=' + have).then(function (d) { if (d && d.ok) appendFresh(d.html); });
  }
  var xv = '', tgv = '';
  function buildBar(node, id, list) {
    var bar = node.querySelector('.bm-reactions-bar');
    if (!list.length) { if (bar) bar.remove(); return; }
    if (!bar) { bar = el('div', 'bm-reactions-bar'); bar.setAttribute('data-post-id', id); var anchor = node.querySelector('.bm-share-row') || node.querySelector('.bm-post-bubble'); if (!anchor) return; if (anchor.classList.contains('bm-share-row')) anchor.parentNode.insertBefore(bar, anchor); else anchor.parentNode.insertBefore(bar, anchor.nextSibling); }
    var have = {}; $$('.bm-reaction-btn', bar).forEach(function (b) { have[b.getAttribute('data-emoji')] = b; });
    bar.innerHTML = ''; list.forEach(function (e) { var b = have[e]; if (!b) { b = el('button', 'bm-reaction-btn', '<span>' + esc(e) + '</span> <span class="bm-reaction-count">0</span>'); b.type = 'button'; b.setAttribute('data-emoji', e); b.setAttribute('onclick', 'bmReact(' + id + ', this)'); } bar.appendChild(b); });
  }
  function syncBars(map) {
    $$('#posts .bm-post[data-post-id]').forEach(function (n) { var id = n.getAttribute('data-post-id'), list = map[id]; if (!Array.isArray(list)) return; var cur = $$('.bm-reaction-btn', n).map(function (b) { return b.getAttribute('data-emoji'); }); if (cur.join('|') !== list.join('|')) buildBar(n, id, list); });
  }
  function applyX(x) {
    if (!x) return; S.es = x.es || {}; S.amb = x.amb || { kind: 'off', vol: 30 };
    if (window.LXAmbient) LXAmbient.set(S.amb.kind, S.amb.vol);
    if (x.emoji) syncBars(x.emoji);
  }
  function tick() {
    if (document.hidden || ticking) return; ticking = true;
    get('tick', '&since=' + lastId + '&lv=' + lv + '&ets=' + ets + '&sv=' + sv + '&xv=' + xv + '&tgv=' + tgv).then(function (d) {
      ticking = false; if (!d.ok) return; lastId = d.last || lastId; ets = d.ts || ets;
      if (hearOn()) (d.events || []).forEach(function (ev, i) { setTimeout(function () { playSound(ev.emoji, ev.sound_ref); floatEmoji(ev.emoji, ev.name); }, i * 450); });
      if (d.css != null) { if (!(window.LXAdmin && LXAdmin.busy())) setLayoutCss(d.css); lv = d.lv; }
      if (d.x) { xv = d.xv; applyX(d.x); }
      if (d.tags) { tgv = d.tgv; if (tagStarted) applyTags(d.tags); else S.tags = d.tags; }
      if (d.social) { sv = d.sv; renderSocial(d.social); S.social = d.social; if (window.LXAdmin && LXAdmin.socialChanged) LXAdmin.socialChanged(); }
      if (d.ids) { var live = {}; d.ids.forEach(function (i) { live[i] = 1; }); $$('#posts .bm-post[data-post-id]').forEach(function (n) { if (!live[n.getAttribute('data-post-id')] && !(window.LXAdmin && LXAdmin.pendingDelete(n.getAttribute('data-post-id')))) { n.style.transition = 'opacity .25s,transform .25s'; n.style.opacity = '0'; n.style.transform = 'scale(.9)'; setTimeout(function () { n.remove(); }, 260); } });
        if (knownN >= 0 && d.n > knownN) fetchNew(); knownN = d.n; S.totalPosts = d.n; }
      if (d.pinned != null) { var cur = document.getElementById('bmPinnedBar'), curId = cur ? +cur.getAttribute('data-pinned-post-id') : 0; if (+d.pinned !== curId) { var pn = d.pinned ? document.querySelector('.bm-post[data-post-id="' + d.pinned + '"]') : null; setPinned(+d.pinned, pn ? (($('h2', pn) || {}).textContent || ($('p', pn) || {}).textContent || 'Pinned post').trim().slice(0, 70) : 'Pinned post'); } }
      (d.edited || []).forEach(function (e) { var n = document.querySelector('.bm-post[data-post-id="' + e.id + '"]'); if (n && !(window.LXAdmin && LXAdmin.justEdited(e.id))) renderBody(n, e.title, e.body); });
    }).catch(function () { ticking = false; });
  }
  // every 1.2 s while you are active, every 4 s once you have been idle for a minute, paused when the tab is hidden
  function tickLoop() { tick(); tickTimer = setTimeout(tickLoop, Date.now() - lastActive > 60000 ? 4000 : 1200); }
  function startTick() { if (tickTimer) return; tickTimer = setTimeout(tickLoop, 1200); document.addEventListener('visibilitychange', function () { if (!document.hidden) { clearTimeout(tickTimer); tickLoop(); } }); }

  /* ---------- visitor pace ---------- */
  function initPace() {
    if (!S.pace || !S.pace.on || !S.pace.options.length) return;
    var b = dockBtn('clock', 'Speed');
    function setPace(m, prevMin) {
      var tk = task('Changing speed…', { est: 1600, delay: 150 });
      post('pace', { minutes: m }).then(function (d) { if (d.ok) { tk.done('Speed set'); try { sessionStorage.setItem('lxPaceUndo', String(prevMin)); sessionStorage.setItem('lxToast', m ? 'Presentation set to ' + m + ' minutes.' : 'Back to the author\'s pace.'); } catch (e) {} setTimeout(function () { location.reload(); }, 500); } else { tk.fail(d.error); toast(d.error || 'Could not change the speed.'); } });
    }
    b.onclick = function (e) { e.stopPropagation(); togglePanel('pace', function (p) {
      var nat = Math.round(S.pace.native / 60), cur = S.pace.current || 0;
      var h = '<b class="lx-ph">' + icon3('clock', 26) + ' How fast?</b><p>Pick how long the whole presentation should take. Posts you already have stay.</p>' +
        '<label class="lx-row"><input type="radio" name="lxPace" value="0"' + (!cur ? ' checked' : '') + '> <span>Author\'s pace <small>(about ' + nat + ' min)</small>' + DEF + '</span></label>';
      S.pace.options.forEach(function (m) { h += '<label class="lx-row"><input type="radio" name="lxPace" value="' + m + '"' + (cur === m ? ' checked' : '') + '> <span>' + m + ' minutes <small>' + (nat && m < nat ? '(faster)' : nat && m > nat ? '(slower)' : '') + '</small></span></label>'; });
      h += '<button type="button" class="lx-reset" id="lxPaceDef"' + (cur ? '' : ' disabled') + '>Back to default</button>';
      p.innerHTML = h;
      $$('input[name=lxPace]', p).forEach(function (r) { r.onchange = function () { setPace(+r.value, cur); }; });
      $('#lxPaceDef', p).onclick = function () { setPace(0, cur); };
    }); };
  }

  /* ---------- dark / light mode (just for this visitor) ---------- */
  var KEY_THEME = 'lxTheme_' + PAGE_ID;
  function applyTheme(t) { if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-lx-theme', t); else document.documentElement.removeAttribute('data-lx-theme'); }
  applyTheme(LS.get(KEY_THEME));
  function initTheme() {
    var cur = function () { return LS.get(KEY_THEME) || 'auto'; };
    var b = dockBtn(cur() === 'dark' ? 'moon' : 'sun', 'Theme');
    var paint = function () { b.innerHTML = icon3(cur() === 'dark' ? 'moon' : 'sun', 34) + '<em>Theme</em>'; };
    b.onclick = function (e) { e.stopPropagation(); togglePanel('theme', function render(p) {
      var amb = S.amb && S.amb.kind && S.amb.kind !== 'off' && window.LXAmbient, away = S.away && S.away.length && window.LXAway;
      p.innerHTML = '<b class="lx-ph">' + icon3('moon', 26) + ' Appearance &amp; sound</b><p>These only change how this blog looks and sounds for you.</p>' +
        [['auto', 'Blog default'], ['dark', 'Dark mode'], ['light', 'Light mode']].map(function (o) { return '<label class="lx-row"><input type="radio" name="lxTheme" value="' + o[0] + '"' + (cur() === o[0] ? ' checked' : '') + '> <span>' + o[1] + (o[0] === 'auto' ? DEF : '') + '</span></label>'; }).join('') +
        (away || amb ? '<hr style="border:0;border-top:1px solid #2a3942;margin:8px 0">' : '') +
        (away ? '<label class="lx-row"><input type="checkbox" id="lxAwayOn"' + (LXAway.enabled() ? ' checked' : '') + '> <span>Play the blog\'s come-back audio when I leave' + DEF + ' <small>(stops when I return)</small></span></label>' : '') +
        (amb ? '<label class="lx-row"><input type="checkbox" id="lxAmbOn"' + (LXAmbient.enabled() ? ' checked' : '') + '> <span>Background sound' + DEF + ' <small>(' + ({ waves: 'sea waves', bubbles: 'water bubbles', drops: 'water drops', rain: 'soft rain' }[S.amb.kind] || S.amb.kind) + ')</small></span></label>' : '') +
        '<div class="lx-resets"><button type="button" class="lx-reset" id="lxApprDef">Back to default</button><button type="button" class="lx-reset lx-reset-all" id="lxAllDef">Reset all my settings</button></div>';
      var am = $('#lxAmbOn', p), aw = $('#lxAwayOn', p);
      if (am) am.onchange = function () { var was = !am.checked; LXAmbient.setEnabled(am.checked); changed(am.checked ? 'Background sound is on.' : 'Background sound is off.', function () { LXAmbient.setEnabled(was); render(p); }); };
      if (aw) aw.onchange = function () { var was = !aw.checked; LXAway.setEnabled(aw.checked); changed(aw.checked ? 'Come-back audio is on.' : 'Come-back audio is off.', function () { LXAway.setEnabled(was); render(p); }); };
      $$('input[name=lxTheme]', p).forEach(function (r) { r.onchange = function () { var prev = cur(); LS.set(KEY_THEME, r.value); applyTheme(r.value); paint(); changed({ dark: 'Dark mode on.', light: 'Light mode on.', auto: 'Back to the blog\'s own look.' }[r.value], function () { if (prev === 'auto') LS.del(KEY_THEME); else LS.set(KEY_THEME, prev); applyTheme(prev === 'auto' ? null : prev); paint(); render(p); }); }; });
      $('#lxApprDef', p).onclick = function () { var snap = [LS.get(KEY_THEME), LS.get(KEY_AWAY), LS.get(KEY_AMB)]; LS.del(KEY_THEME); LS.del(KEY_AWAY); LS.del(KEY_AMB); applyTheme(null); paint(); if (window.LXAmbient) LXAmbient.setEnabled(true); render(p);
        changed('Appearance and sound are back to default.', function () { [KEY_THEME, KEY_AWAY, KEY_AMB].forEach(function (k, i) { if (snap[i] == null) LS.del(k); else LS.set(k, snap[i]); }); applyTheme(snap[0]); paint(); if (window.LXAmbient) LXAmbient.setEnabled(snap[2] !== '1'); render(p); }); };
      $('#lxAllDef', p).onclick = resetAll;
    }); };
  }

/* ---------- auto read ---------- */
  var AR = { on: false, paused: false, token: 0, rate: 1, ctl: null, done: [], total: 0, bar: null, media: null };
  var synth = window.speechSynthesis;
  function pickVoice() { if (!synth) return null; var v = synth.getVoices() || []; var en = v.filter(function (x) { return /^en/i.test(x.lang); }); return en.filter(function (x) { return /natural|google|aria|samantha|jenny|neural/i.test(x.name); })[0] || en[0] || null; }
  function chunks(text) {
    text = String(text || '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{20E3}]/gu, ' ').replace(/\s+/g, ' ').trim(); if (!text || !/[A-Za-z0-9]/.test(text)) return [];
    var parts = text.match(/[^.!?\n]+[.!?]*\s*/g) || [text], out = [], cur = '';
    parts.forEach(function (p) { if ((cur + p).length > 170 && cur) { out.push(cur); cur = p; } else cur += p; }); if (cur) out.push(cur); return out;
  }
  function speakChunk(txt, token, ctl) {
    return new Promise(function (resolve) {
      if (!synth) return resolve('done');
      var u = new SpeechSynthesisUtterance(txt); var v = pickVoice(); if (v) { u.voice = v; u.lang = v.lang; } u.rate = AR.rate; u.pitch = 1;
      var finished = false; function fin(r) { if (!finished) { finished = true; clearInterval(w); resolve(r); } }
      u.onend = function () { fin('done'); }; u.onerror = function () { fin(AR.paused ? 'paused' : 'done'); };
      var w = setInterval(function () { if (token !== AR.token || ctl.skip) { try { synth.cancel(); } catch (e) {} fin('cancel'); } }, 150);
      try { synth.speak(u); } catch (e) { fin('done'); }
    });
  }
  async function say(text, token, ctl) {
    var cs = chunks(text);
    for (var i = 0; i < cs.length; i++) {
      while (AR.paused && token === AR.token && !ctl.skip) await sleep(200);
      if (token !== AR.token || ctl.skip) return;
      var r = await speakChunk(cs[i], token, ctl);
      if (r === 'paused') { i--; continue; }
      if (r === 'cancel') return;
    }
  }
  function status(t) { if (AR.bar) { var s = $('.lx-st', AR.bar); if (s) s.textContent = t; } }
  function postsNow() { return $$('.bm-post[data-post-id]').filter(function (p) { return $('.bm-post-bubble', p); }); }
  function highlight(p, on) { $$('.lx-reading').forEach(function (x) { x.classList.remove('lx-reading'); }); if (on && p) p.classList.add('lx-reading'); }
  function playMedia(m, token, ctl) {
    return new Promise(function (resolve) {
      AR.media = m; var fin = false; function end() { if (fin) return; fin = true; clearInterval(w); m.removeEventListener('ended', end); m.removeEventListener('error', end); AR.media = null; resolve(); }
      m.addEventListener('ended', end); m.addEventListener('error', end);
      try { m.currentTime = 0; var pr = m.play(); if (pr && pr.catch) pr.catch(function () { end(); }); } catch (e) { return end(); }
      var w = setInterval(function () {
        if (token !== AR.token || ctl.skip) { try { m.pause(); } catch (e) {} end(); return; }
        if (AR.paused && !m.paused) m.pause(); else if (!AR.paused && m.paused && !m.ended && !m.__userPaused) { try { m.play(); } catch (e) {} }
      }, 200);
    });
  }
  function pollWait(poll, token, ctl) {
    return new Promise(function (resolve) {
      poll.classList.add('lx-await'); var t0 = Date.now();
      var w = setInterval(function () {
        if (token !== AR.token || ctl.skip || !$('.bm-poll-option', poll)) { clearInterval(w); poll.classList.remove('lx-await'); resolve(); }
        else if (Date.now() - t0 > 600000) { clearInterval(w); poll.classList.remove('lx-await'); resolve(); }
      }, 300);
    });
  }
  async function readPost(p, token, ctl) {
    var id = p.getAttribute('data-post-id'); highlight(p, true);
    try { p.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { p.scrollIntoView(); }
    var tot = AR.total || postsNow().length; status('Reading post ' + AR.done.length + ' of ' + tot + ' (' + Math.round((AR.done.length - 1) / tot * 100) + '%)'); var bar2 = AR.bar && $('.lx-pb i', AR.bar); if (bar2) bar2.style.width = Math.round((AR.done.length - 1) / tot * 100) + '%'; await sleep(900);
    if (token !== AR.token || ctl.skip) return;
    var bub = $('.bm-post-bubble', p);
    if (bub.classList.contains('bm-locked')) { await say('This is a premium post. It is locked. Use the unlock button to read it.', token, ctl); return; }
    var h2 = $(':scope > h2', bub); if (h2) await say(h2.innerText, token, ctl);
    var medias = $$('video,audio', bub);
    for (var i = 0; i < medias.length; i++) { if (token !== AR.token || ctl.skip) return; status(medias[i].tagName === 'VIDEO' ? 'Playing the video…' : 'Playing the audio…'); await playMedia(medias[i], token, ctl); await sleep(300); }
    if (token !== AR.token || ctl.skip) return;
    var cap = $('figcaption', bub);
    if (cap) await say(cap.innerText, token, ctl);
    else { var ps = $$(':scope > p', bub); for (var j = 0; j < ps.length; j++) { if (token !== AR.token || ctl.skip) return; await say(ps[j].innerText, token, ctl); } }
    var poll = $('.bm-poll', bub);
    if (poll) {
      var opts = $$('.bm-poll-option', poll);
      if (opts.length) {
        await say('This is a poll. Your options are: ' + opts.map(function (o, k) { return 'Option ' + (k + 1) + ', ' + o.innerText; }).join('. ') + '. Tap your answer to continue.', token, ctl);
        status('Waiting for your vote…'); await pollWait(poll, token, ctl);
        if (token === AR.token && !ctl.skip) { await say('Thanks for voting.', token, ctl); }
      }
    }
    var btns = $$('[class*="bm-post-btn-zone"] a, [class*="bm-post-btn-zone"] button', bub).map(function (b) { return b.innerText.trim(); }).filter(Boolean);
    if (btns.length && token === AR.token && !ctl.skip) await say('Buttons on this post: ' + btns.join(', ') + '.', token, ctl);
  }
  async function arLoop(token) {
    while (AR.on && token === AR.token) {
      var next = postsNow().filter(function (p) { return AR.done.indexOf(p.getAttribute('data-post-id')) < 0; })[0];
      if (!next) {
        var have = postsNow().length;
        if (AR.total && have < AR.total) { status('Waiting for the next post to arrive…'); highlight(null); await sleep(1000); continue; }
        break;
      }
      AR.done.push(next.getAttribute('data-post-id')); AR.ctl = { skip: false };
      await readPost(next, token, AR.ctl);
      await sleep(350);
    }
    if (AR.on && token === AR.token) { await say('That is everything on this blog. Thank you for listening.', token, { skip: false }); arStop(true); }
  }
  function arBar() {
    if (AR.bar) return AR.bar;
    var b = el('div', 'lx-reader', '<div class="lx-st">Starting…</div><div class="lx-pb"><i></i></div><div class="lx-ctl"><button data-a="prev" title="Previous">' + icon3('left', 26) + '</button><button data-a="pp" title="Pause / play">' + icon3('pause', 26) + '</button><button data-a="next" title="Next">' + icon3('right', 26) + '</button><select data-a="rate" title="Speed"><option value="0.85">0.85×</option><option value="1" selected>1×</option><option value="1.2">1.2×</option><option value="1.5">1.5×</option></select><button data-a="stop" class="tx" title="Stop reading">Cancel</button><button data-a="finish" class="tx ok" title="Close">Done</button></div>');
    b.addEventListener('click', function (e) {
      var a = e.target.getAttribute && e.target.getAttribute('data-a'); if (!a) return;
      if (a === 'stop' || a === 'finish') arStop();
      else if (a === 'pp') { AR.paused = !AR.paused; var pb = e.target.closest('button'); pb.innerHTML = icon3(AR.paused ? 'play' : 'pause', 26); if (synth) { try { AR.paused ? synth.cancel() : 0; } catch (x) {} } }
      else if (a === 'next') { if (AR.ctl) AR.ctl.skip = true; try { synth && synth.cancel(); } catch (x) {} }
      else if (a === 'prev') { AR.done.pop(); AR.done.pop(); if (AR.ctl) AR.ctl.skip = true; try { synth && synth.cancel(); } catch (x) {} }
    });
    b.addEventListener('change', function (e) { if (e.target.getAttribute('data-a') === 'rate') AR.rate = parseFloat(e.target.value) || 1; });
    document.body.appendChild(b); AR.bar = b; return b;
  }
  function arStop(finished) {
    AR.on = false; AR.token++; AR.paused = false; try { synth && synth.cancel(); } catch (e) {} if (AR.media) { try { AR.media.pause(); } catch (e) {} AR.media = null; }
    highlight(null); $$('.lx-await').forEach(function (x) { x.classList.remove('lx-await'); });
    if (AR.bar) { AR.bar.remove(); AR.bar = null; } document.body.classList.remove('lx-reading-on');
    var rb = $('.lx-readbtn'); if (rb) rb.classList.remove('on'); if (finished) toast('Auto-read finished 🎧');
  }
  function arStart() {
    if (!synth) { toast('Your browser cannot read aloud. Try Chrome, Edge or Safari.'); return; }
    if (AR.on) { arStop(); return; }
    refreshMe().then(function () {
      if (!S.me) { toast('Join this blog to earn points, then you can use Auto-read.', { href: S.pointsUrl, text: 'Join & earn' }); return; }
      if (S.me.points < S.read.min) { toast('Auto-read needs ' + S.read.min + ' points. You have ' + S.me.points + '.', { href: S.pointsUrl, text: 'Get points' }); return; }
      try { synth.cancel(); var warm = new SpeechSynthesisUtterance(' '); warm.volume = 0; synth.speak(warm); } catch (e) {}
      AR.on = true; AR.paused = false; AR.done = []; AR.token++; AR.rate = 1;
      var rem = typeof POSTS_REMAINING !== 'undefined' ? POSTS_REMAINING : 0; AR.total = rem > 0 ? postsNow().length + rem : 0;
      document.body.classList.add('lx-reading-on'); arBar(); var rb = $('.lx-readbtn'); if (rb) rb.classList.add('on');
      window.scrollTo({ top: 0 }); arLoop(AR.token);
    });
  }
  // while auto-read is on, a poll vote must not reload the page (that would stop the reading)
  function wrapVote() {
    var orig = window.bmVote; if (!orig || orig.__lx) return;
    var w = function (postId, optionId, btn) {
      if (!AR.on) return orig(postId, optionId, btn);
      btn.disabled = true;
      fetch('/api/vote.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'post_id=' + postId + '&option_id=' + optionId, credentials: 'same-origin' })
        .then(function (r) { return r.json(); }).then(function (d) {
          if (!d.ok) { btn.disabled = false; toast(d.error || 'Could not record vote.'); return; }
          var poll = btn.closest('.bm-poll');
          fetch('/api/poll-results.php?post_id=' + postId + '&_=' + Date.now()).then(function (r) { return r.json(); }).then(function (res) {
            var m = {}; (res.options || []).forEach(function (o) { m[o.id] = o; });
            $$('.bm-poll-option', poll).forEach(function (b) {
              var row = b.nextElementSibling, oid = row && row.getAttribute('data-option-id'), o = m[oid] || { pct: 0, votes: 0 };
              var nr = el('div', 'bm-poll-row', '<div class="bm-poll-fill" style="width:' + o.pct + '%"></div><div class="bm-poll-row-inner"><span>' + esc(b.innerText) + '</span><span>' + o.pct + '% (' + o.votes + ')</span></div>');
              if (row && row.classList.contains('bm-poll-row')) row.remove(); b.replaceWith(nr);
            });
          }).catch(function () { location.reload(); });
        }).catch(function () { btn.disabled = false; });
    };
    w.__lx = 1; window.bmVote = w;
  }
  function initRead() {
    if (!S.read.on) return;
    var b = dockBtn('headphones', 'Auto-read', 'lx-readbtn');
    b.onclick = function (e) { e.stopPropagation(); arStart(); };
    wrapVote(); if (synth && synth.getVoices) synth.getVoices();
  }

  /* ---------- quick-post bar (blog owner) ---------- */
  var replyTo = null;
  function setReply(id, text) { replyTo = id ? { id: id, text: text } : null; var rb = $('#lxReply'); if (!rb) return; rb.hidden = !replyTo; if (replyTo) { $('.lx-rt', rb).textContent = text; var t = $('#lxText'); if (t) t.focus(); } }
  function initComposer() {
    if (!S.admin || !S.admin.canPost) return;
    var thread = document.getElementById('posts'); if (!thread) return;
    document.body.classList.add('lx-has-composer');
    var bar = el('form', 'lx-comp', '<input type="file" id="lxFile" accept="image/*,audio/*,video/*" hidden>' +
      '<div class="lx-replybar" id="lxReply" hidden><div class="lx-rq"><b>Replying</b><span class="lx-rt"></span></div><button type="button" id="lxReplyX" aria-label="Cancel reply">' + icon3('close', 22) + '</button></div>' +
      '<div class="lx-chip" id="lxChip" hidden></div>' +
      '<div class="lx-crow"><button type="button" class="lx-ci" id="lxAttach" title="Attach photo, audio or video">' + icon3('clip', 34) + '</button>' +
      '<textarea id="lxText" rows="1" placeholder="Type an update to your visitors…" maxlength="5000"></textarea>' +
      '<button type="button" class="lx-ci" id="lxMic" title="Record a voice note">' + icon3('mic', 34) + '</button>' +
      '<button type="submit" class="lx-send" id="lxSend" title="Post">' + icon3('send', 38) + '</button></div>');
    document.body.appendChild(bar); if (window.ResizeObserver) new ResizeObserver(measure).observe(bar); measure();
    var file = $('#lxFile', bar), chip = $('#lxChip', bar), text = $('#lxText', bar), mic = $('#lxMic', bar), picked = null, rec = null, recT = null;
    $('#lxReplyX', bar).onclick = function () { setReply(null); };
    function setFile(f) { picked = f; chip.hidden = !f; chip.innerHTML = f ? '<span>' + (f.type.indexOf('image') === 0 ? 'Photo' : f.type.indexOf('video') === 0 ? 'Video' : 'Audio') + ': ' + esc(f.name) + '</span><button type="button" id="lxRm">' + icon3('close', 20) + '</button>' : ''; if (f) $('#lxRm', chip).onclick = function () { setFile(null); }; }
    $('#lxAttach', bar).onclick = function () { file.click(); }; file.onchange = function () { setFile(file.files[0] || null); file.value = ''; };
    text.addEventListener('input', function () { text.style.height = 'auto'; text.style.height = Math.min(120, text.scrollHeight) + 'px'; });
    var micHtml = mic.innerHTML;
    mic.onclick = function () {
      if (rec) { rec.stop(); return; }
      if (!navigator.mediaDevices || !window.MediaRecorder) { toast('Voice notes are not supported in this browser.'); return; }
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        var chunksA = [], r = new MediaRecorder(stream), t0 = Date.now(); rec = r; mic.classList.add('rec');
        recT = setInterval(function () { var sec = Math.floor((Date.now() - t0) / 1000); mic.textContent = 'REC ' + Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2); }, 500);
        r.ondataavailable = function (e) { if (e.data.size) chunksA.push(e.data); };
        r.onstop = function () { clearInterval(recT); mic.classList.remove('rec'); mic.innerHTML = micHtml; stream.getTracks().forEach(function (tr) { tr.stop(); }); rec = null;
          var blob = new Blob(chunksA, { type: r.mimeType || 'audio/webm' }), ext = /mp4|aac/.test(blob.type) ? 'm4a' : /ogg/.test(blob.type) ? 'ogg' : 'webm';
          setFile(new File([blob], 'voice-note.' + ext, { type: blob.type })); };
        r.start();
      }).catch(function () { toast('Allow the microphone to record a voice note.'); });
    };
    bar.addEventListener('submit', function (e) {
      e.preventDefault(); var body = text.value.trim(); if (!body && !picked) { text.focus(); return; }
      var fd = new FormData(); fd.append('page_id', PAGE_ID); fd.append('csrf', S.admin.csrf); fd.append('body', body); if (replyTo) fd.append('reply_to', replyTo.id); if (picked) fd.append('media', picked, picked.name);
      var send = $('#lxSend', bar); send.disabled = true;
      var xhr = new XMLHttpRequest(), tk = task(picked ? 'Uploading ' + (picked.name || 'file') : 'Posting…', { est: picked ? 0 : 1800, delay: 250, onCancel: function () { xhr.abort(); send.disabled = false; } });
      xhr.open('POST', '/api/quick-post.php'); xhr.withCredentials = true;
      xhr.upload.onprogress = function (ev) { if (ev.lengthComputable) tk.set(ev.loaded / ev.total * 96); };
      xhr.onerror = function () { send.disabled = false; tk.fail('Network problem. Try again.'); };
      xhr.onload = function () {
        send.disabled = false; var d; try { d = JSON.parse(xhr.responseText); } catch (x) { d = { ok: false, error: 'Bad reply from the server.' }; }
        if (!d.ok) { tk.fail(d.error || 'Could not post.'); toast(d.error || 'Could not post.'); return; }
        tk.done('Posted'); var wrap = el('div'); wrap.innerHTML = d.html; var node = wrap.firstElementChild;
        if (node) { node.removeAttribute('data-bm-anim-pending'); thread.appendChild(node); node.classList.add('lx-pop'); if (window.lucide && lucide.createIcons) { try { lucide.createIcons(); } catch (x) {} } node.scrollIntoView({ behavior: 'smooth', block: 'center' }); if (window.LXAdmin) LXAdmin.decorate(node); }
        text.value = ''; text.style.height = 'auto'; setFile(null); setReply(null); measure();
      };
      xhr.send(fd);
    });
  }

/* ---------- in-page buttons: #community  #ask-ai  #auto-read  #sounds ---------- */
  function initAnchors() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a) return;
      var h = a.getAttribute('href'), t = null;
      if (h === '#community') t = $('.vx-fab'); else if (h === '#ask-ai') t = $('#bmAskAiToggle'); else if (h === '#auto-read') t = $('.lx-readbtn'); else if (h === '#sounds') t = $('.lx-dbtn:not(.lx-readbtn)');
      if (!t && (h === '#community' || h === '#ask-ai' || h === '#auto-read' || h === '#sounds')) { e.preventDefault(); toast('That feature is not switched on for this blog yet.'); return; }
      if (t) { e.preventDefault(); t.click(); }
    }, true);
  }

  document.addEventListener('click', function (e) { var q = e.target.closest && e.target.closest('.lx-quote'); if (!q) return; e.preventDefault(); var t = document.querySelector('.bm-post[data-post-id="' + q.getAttribute('data-reply-id') + '"]'); if (t) { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); t.classList.add('lx-flash'); setTimeout(function () { t.classList.remove('lx-flash'); }, 1400); } });
  /* ---------- feature name tags, bigger icons, "new feature" pop-ups and the step-by-step guide (set by the platform owner) ---------- */
  var TG = {}, tagQ = [], tagBusy = false, tagStarted = false;
  var FT_ICON = { earn: 'gift', ask: 'bot', community: 'users', bmp: 'bolt', sounds: 'speaker', autoread: 'headphones', speed: 'clock', theme: 'moon', admin: 'tools' };
  var FT_NAME = { earn: 'Earn points', ask: 'Ask AI', community: 'Community', bmp: 'Boost points', sounds: 'Sounds', autoread: 'Auto-read', speed: 'Speed', theme: 'Theme', admin: 'Admin' };
  function tagFor(k) { return TG[k] || null; }
  function applyTags(list) {
    if (list) { TG = {}; (list || []).forEach(function (t) { TG[t.k] = t; }); S.tags = list; }
    $$('.lx-ti.lx-tagged, .lx-ti.lx-big').forEach(function (n) { var id = n.getAttribute('data-lx-id'); if (TG[id] && (TG[id].tag || TG[id].sc > 100)) return; n.classList.remove('lx-tagged', 'lx-big'); n.style.removeProperty('--lx-sc'); var lb = n.querySelector('.lx-lbl'); if (lb && lb.hasAttribute('data-orig')) { lb.textContent = lb.getAttribute('data-orig'); lb.removeAttribute('data-orig'); n.removeAttribute('data-tag'); } });
    Object.keys(TG).forEach(function (k) {
      var n = document.querySelector('.lx-ti[data-lx-id="' + k + '"]'); if (!n) return; var t = TG[k], lb = n.querySelector('.lx-lbl');
      if (lb && t.tag) { if (!lb.hasAttribute('data-orig')) lb.setAttribute('data-orig', lb.textContent); lb.textContent = t.tag; n.setAttribute('data-tag', t.tag); }
      else if (lb && lb.hasAttribute('data-orig')) { lb.textContent = lb.getAttribute('data-orig'); lb.removeAttribute('data-orig'); n.removeAttribute('data-tag'); }
      n.classList.toggle('lx-tagged', !!t.tag); n.classList.toggle('lx-big', t.sc > 100); n.style.setProperty('--lx-sc', t.sc / 100);
    });
    measure && measure();
    queuePops();
  }
  function featureExists(k) {
    if (k.slice(0, 5) === 'tool_') return !!(window.LXAdmin && LXAdmin.tools && LXAdmin.tools().filter(function (t) { return 'tool_' + t.id === k; })[0]);
    return !!document.querySelector('.lx-ti[data-lx-id="' + k + '"]');
  }
  function featureLabel(k) { var t = TG[k]; return t && t.tag ? t.tag : FT_NAME[k] || (k.slice(0, 5) === 'tool_' && window.LXAdmin ? (LXAdmin.tools().filter(function (x) { return 'tool_' + x.id === k; })[0] || {}).label : '') || k; }
  function featureIcon(k) { if (FT_ICON[k]) return FT_ICON[k]; var t = window.LXAdmin && LXAdmin.tools ? LXAdmin.tools().filter(function (x) { return 'tool_' + x.id === k; })[0] : null; return t ? t.icon : 'bolt'; }
  function seenKey(k) { return 'lxTagSeen_' + k; }
  function queuePops() {
    Object.keys(TG).forEach(function (k) { var t = TG[k]; if (!t.on || !t.tag || tagQ.indexOf(k) >= 0 || LS.get(seenKey(k)) === String(t.v) || !featureExists(k)) return; tagQ.push(k); });
    if (tagStarted) nextPop();
  }
  function nextPop() {
    if (tagBusy || !tagQ.length || tourOn) return; if (document.hidden) { document.addEventListener('visibilitychange', function f() { if (!document.hidden) { document.removeEventListener('visibilitychange', f); nextPop(); } }); return; }
    var k = tagQ.shift(), t = TG[k]; if (!t || !t.on) { return nextPop(); } tagBusy = true; LS.set(seenKey(k), String(t.v));
    var secs = Math.max(3, Math.min(120, t.secs || 10));
    var pop = el('div', 'lx-tagpop', '<div class="lx-tp-i">' + icon3(featureIcon(k), 38) + '</div><div class="lx-tp-t"><b>' + esc(t.tag) + '</b><span>' + esc(t.txt || 'New feature. Tap to see where to find it.') + '</span></div><button type="button" class="lx-tp-x" aria-label="Close">&times;</button><i class="lx-tp-bar" style="animation-duration:' + secs + 's"></i>');
    document.body.appendChild(pop); requestAnimationFrame(function () { pop.classList.add('on'); });
    var done = function () { clearTimeout(tm); pop.classList.remove('on'); setTimeout(function () { pop.remove(); tagBusy = false; setTimeout(nextPop, 500); }, 260); };
    var tm = setTimeout(done, secs * 1000);
    pop.querySelector('.lx-tp-x').onclick = function (e) { e.stopPropagation(); done(); };
    pop.onclick = function () { done(); setTimeout(function () { startTour(k); }, 320); };
  }
  /* the guide: dims the page, rings the thing to tap, and walks through it one step at a time */
  var tourOn = false;
  var TOOL_HELP = {
    layout: 'Tap any part of the blog, then drag its corner or use the % buttons to change its size and shape. Posts, buttons, the sub-blog box and the comments box all work. Visitors see it at once.',
    social: 'Pick a platform, paste your link and add it. Visitors see the icon on your blog.',
    away: 'Record or upload a voice message that plays when a visitor comes back after being away.',
    seo: 'Fills in the SEO of your posts for you, so Google can find them. Run it again after you add posts.',
    timing: 'Choose when posts appear to visitors: all at once, or one after another with a delay.',
    esound: 'Give any emoji its own sound. Visitors hear it when they react. You can record, upload or pick a sound.',
    ambient: 'Play a soft background sound while people read your blog.',
    online: 'Shows how many people are reading right now, who downloaded the app and who filled your form. You can drag it around, shrink it, and choose whether visitors see it.'
  };
  function stepsFor(k) {
    if (k === 'msg_post') {
      var firstPost = function () { return document.querySelector('#posts .bm-post .lx-chev') || document.querySelector('#posts .bm-post .bm-post-bubble'); };
      return [
        { el: firstPost, text: 'Every post has a small <b>arrow</b>. On a phone you can also press and hold the post, and on a computer right-click it.' },
        { el: firstPost, text: 'The menu lets you <b>Reply</b>, <b>Pin</b>, <b>Edit</b> the words, change the <b>Photos &amp; video</b> (up to 5 per post: add, replace, remove or reorder), choose the <b>Reaction emojis</b>, set the <b>Timing</b>, <b>Copy</b> the text or <b>Delete</b> it.', last: true, open: function () { var c = firstPost(); if (c) c.click(); } }
      ];
    }
    var st = [], tool = k.slice(0, 5) === 'tool_', id = tool ? k.slice(5) : k, tg = TG[k], name = featureLabel(k);
    if (trayw && trayw.classList.contains('lx-collapsed')) st.push({ el: function () { return tab; }, text: 'The icon bar is tucked away. Tap <b>Show icons</b> to bring it back.', next: function () { setTrayHidden(false); } });
    st.push({ el: function () { return trayw; }, text: 'Your features live in this <b>icon bar</b> at the bottom of the blog.' });
    if (!tool) st.push({ el: function () { return document.querySelector('.lx-ti[data-lx-id="' + k + '"]'); }, text: 'Here it is: <b>' + esc(name) + '</b>. Tap it any time to open.', last: true, open: function () { var n = document.querySelector('.lx-ti[data-lx-id="' + k + '"]'); if (n) n.click(); } });
    else {
      st.push({ el: function () { return document.querySelector('.lx-ti[data-lx-id="admin"]'); }, text: 'Tap <b>Admin</b> to open all your tools.', next: function () { var n = document.querySelector('.lx-ti[data-lx-id="admin"]'); if (n && !document.querySelector('.lx-panel.on .lx-tg')) n.click(); } });
      st.push({ el: function () { return document.querySelector('.lx-panel.on .lx-tg button[data-t="' + id + '"]'); }, text: 'Then tap <b>' + esc(name) + '</b>.' + (TOOL_HELP[id] ? '<br><small>' + esc(TOOL_HELP[id]) + '</small>' : ''), last: true, open: function () { var b = document.querySelector('.lx-panel.on .lx-tg button[data-t="' + id + '"]'); if (b) b.click(); } });
    }
    return st;
  }
  function startTour(k) {
    if (tourOn) return; var steps = stepsFor(k), i = 0; tourOn = true;
    var root = el('div', 'lx-tour', '<div class="lx-tr-ring"></div><div class="lx-tr-card"><small></small><p></p><div class="lx-tr-b"><button type="button" data-a="skip">Skip</button><button type="button" data-a="back">Back</button><button type="button" data-a="open" class="alt">Open it now</button><button type="button" data-a="next" class="go">Next</button></div></div>');
    document.body.appendChild(root); var ring = $('.lx-tr-ring', root), card = $('.lx-tr-card', root), raf = 0, target = null;
    function place() {
      if (!document.body.contains(root)) return; var t = steps[i] && steps[i].el(); target = t;
      if (t) { var r = t.getBoundingClientRect(), pad = 6; ring.style.display = 'block'; ring.style.left = (r.left - pad) + 'px'; ring.style.top = (r.top - pad) + 'px'; ring.style.width = (r.width + pad * 2) + 'px'; ring.style.height = (r.height + pad * 2) + 'px';
        var ch = card.offsetHeight || 130, y = r.top > innerHeight / 2 ? r.top - ch - 16 : r.bottom + 16; card.style.top = Math.max(8, Math.min(innerHeight - ch - 8, y)) + 'px'; }
      else { ring.style.display = 'none'; card.style.top = Math.max(8, innerHeight / 2 - 60) + 'px'; }
      raf = requestAnimationFrame(place);
    }
    function show() {
      var s = steps[i]; $('small', card).textContent = 'Step ' + (i + 1) + ' of ' + steps.length; $('p', card).innerHTML = s.text;
      $('[data-a=back]', card).style.display = i ? '' : 'none'; $('[data-a=open]', card).style.display = s.last ? '' : 'none'; var nx = $('[data-a=next]', card); nx.textContent = s.last ? 'Got it' : 'Next';
    }
    function end() { cancelAnimationFrame(raf); root.remove(); tourOn = false; setTimeout(nextPop, 400); }
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-a]'); if (!b) return; var a = b.getAttribute('data-a'); e.stopPropagation();
      if (a === 'skip') return end(); if (a === 'back') { i = Math.max(0, i - 1); return show(); }
      if (a === 'open') { var o = steps[i].open; end(); if (o) setTimeout(o, 120); return; }
      if (steps[i].last) return end(); var nx = steps[i].next; if (nx) nx(); i++; show(); setTimeout(show, 350);
    });
    show(); place();
  }
  /* Director sends the blog owner here with ?lxguide=tool_layout (or msg_post): show that tool's guide once, then tidy the address */
  function guideFromUrl() {
    var m = /[?&]lxguide=([a-z_]+)/.exec(location.search); if (!m || !S.admin || !/^(tool_[a-z]+|msg_post)$/.test(m[1])) return;
    try { history.replaceState(null, '', location.pathname + location.search.replace(/([?&])lxguide=[a-z_]+&?/, '$1').replace(/[?&]$/, '') + location.hash); } catch (e) {}
    setTimeout(function () { startTour(m[1]); }, 900);
  }
  function startTags() { guideFromUrl(); tagStarted = true; applyTags(S.tags || []); [600, 1800, 3500].forEach(function (ms) { setTimeout(function () { applyTags(); }, ms); }); }
  /* ---------- how many people are on the blog right now (the owner always sees it; visitors only when the owner allows it) ---------- */
  var onlineEl = null, KEY_ONP = 'lxOnPos_' + PAGE_ID, KEY_ONM = 'lxOnMin_' + PAGE_ID;
  function agoTxt(sec) { return sec < 90 ? 'just now' : sec < 3600 ? Math.round(sec / 60) + ' min ago' : sec < 172800 ? Math.round(sec / 3600) + ' h ago' : Math.round(sec / 86400) + ' d ago'; }
  function buildOnline() {
    onlineEl = el('div', 'lx-online', '<div class="lx-on-h"><i></i><b></b><span class="lx-on-note"></span><button type="button" class="lx-on-min" aria-label="Minimise">&minus;</button></div><div class="lx-on-b"></div>');
    document.body.appendChild(onlineEl);
    var pos = null; try { pos = JSON.parse(LS.get(KEY_ONP) || 'null'); } catch (e) {}
    var place = function () { if (!pos) return; var w = onlineEl.offsetWidth, h = onlineEl.offsetHeight; onlineEl.style.left = Math.max(4, Math.min(innerWidth - w - 4, pos[0] * innerWidth)) + 'px'; onlineEl.style.top = Math.max(4, Math.min(innerHeight - h - 4, pos[1] * innerHeight)) + 'px'; onlineEl.style.bottom = 'auto'; };
    var mini = function (v) { onlineEl.classList.toggle('min', v); LS.set(KEY_ONM, v ? '1' : '0'); onlineEl.querySelector('.lx-on-min').innerHTML = v ? '+' : '&minus;'; onlineEl.querySelector('.lx-on-min').setAttribute('aria-label', v ? 'Expand' : 'Minimise'); place(); };
    onlineEl.querySelector('.lx-on-min').onclick = function (e) { e.stopPropagation(); mini(!onlineEl.classList.contains('min')); };
    mini(LS.get(KEY_ONM) === '1'); place(); addEventListener('resize', place);
    var h = onlineEl.querySelector('.lx-on-h'), st = null;
    h.addEventListener('pointerdown', function (e) { if (e.target.closest('.lx-on-min')) return; var r = onlineEl.getBoundingClientRect(); st = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top, mv: false }; try { h.setPointerCapture(e.pointerId); } catch (x) {} });
    h.addEventListener('pointermove', function (e) { if (!st || e.pointerId !== st.id) return; st.mv = true; var w = onlineEl.offsetWidth, hh = onlineEl.offsetHeight; var x = Math.max(4, Math.min(innerWidth - w - 4, e.clientX - st.dx)), y = Math.max(4, Math.min(innerHeight - hh - 4, e.clientY - st.dy)); onlineEl.style.left = x + 'px'; onlineEl.style.top = y + 'px'; onlineEl.style.bottom = 'auto'; pos = [x / innerWidth, y / innerHeight]; });
    var end = function (e) { if (!st || e.pointerId !== st.id) return; var m = st.mv; st = null; if (m) LS.set(KEY_ONP, JSON.stringify(pos)); else mini(!onlineEl.classList.contains('min')); };
    h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end);
  }
  function showOnline(d) {
    if (d.n == null) { if (onlineEl) { onlineEl.remove(); onlineEl = null; } return; }
    if (!onlineEl) buildOnline(); S.online = d;
    onlineEl.querySelector('b').textContent = d.n + ' online';
    onlineEl.querySelector('.lx-on-note').textContent = d.owner && !d.show ? 'only you see this' : '';
    onlineEl.classList.toggle('mine', !!(d.owner && !d.show));
    var body = onlineEl.querySelector('.lx-on-b'), w = d.who;
    if (!w) { body.innerHTML = ''; return; }
    var online = {}; w.online.forEach(function (x) { online[x.id] = 1; });
    var row = function (ic, txt, x) { return '<div class="lx-on-r"><span class="lx-on-ic">' + ic + '</span><span>' + txt + '</span><code>ID ' + esc(x.id) + (online[x.id] ? ' <u>online</u>' : '') + '</code><em>' + agoTxt(x.ago) + '</em></div>'; };
    body.innerHTML = '<div class="lx-on-s">Online now' + (w.online.length ? '' : ' <em>nobody yet</em>') + '</div>' + (w.online.length ? '<div class="lx-on-ids">' + w.online.map(function (x) { return '<code>' + esc(x.id) + '</code>'; }).join('') + '</div>' : '') +
      '<div class="lx-on-s">Downloaded the app (' + w.appN + ')</div>' + (w.apps.length ? w.apps.map(function (x) { return row('📲', 'Downloaded app', x); }).join('') : '<div class="lx-on-e">No one yet</div>') +
      '<div class="lx-on-s">Submitted the intake form (' + w.formN + ')</div>' + (w.forms.length ? w.forms.map(function (x) { return row('📝', 'Intake form', x); }).join('') : '<div class="lx-on-e">No one yet</div>');
  }
  function ping() { if (document.hidden) return; get('ping').then(function (d) { if (d && d.ok) showOnline(d); }).catch(function () {}); }
  function startPing() { ping(); setInterval(ping, 15000); document.addEventListener('visibilitychange', function () { if (!document.hidden) ping(); }); }
  window.addEventListener('lx:online', function () { ping(); });
  function boot() {
    initAnchors(); ensureDock(); adopt(); new MutationObserver(adoptLater).observe(document.body, { childList: true });
    get('boot').then(function (d) {
      if (!d || !d.ok) return; S.me = d.me; S.sound = d.sound; S.read = d.read; S.admin = d.admin; S.asVisitor = !!d.asVisitor; if (S.asVisitor) asVisitorPill(); S.pointsUrl = d.pointsUrl; S.pace = d.pace; MINE = d.mine || {}; S.layout = d.layout; S.pinned = d.pinned;
      lastId = d.sound.last || 0; lv = d.lv; ets = d.ts || 0; S.social = d.social || []; S.away = d.away || []; sv = ''; S.autoSeo = !!d.autoSeo; xv = d.xv || ''; applyX(d.x); if (window.LXAmbient) LXAmbient.refresh = function (cb) { get('tick', '&since=0&lv=-1&ets=0&sv=&xv=&tgv=').then(function (r) { if (r && r.x) { xv = r.xv; applyX(r.x); } cb(); }).catch(function () { cb(); }); };
      window.LX = { tagFor: tagFor, changed: changed, ping: ping, applyEmojis: function (id, list) { var n = document.querySelector('.bm-post[data-post-id="' + id + '"]'); if (n) buildBar(n, id, list); }, syncBars: syncBars, playSound: playSound, notifyNew: notifyNew, togglePanel: togglePanel, task: task, renderSocial: renderSocial, S: S, $: $, $$: $$, el: el, esc: esc, sleep: sleep, toast: toast, post: post, icon3: icon3, dockBtn: dockBtn, setReply: setReply, setLayoutCss: setLayoutCss, setPinned: setPinned, renderBody: renderBody };
      S.tags = d.tags || []; initSound(); initRead(); initPace(); initTheme(); initComposer(); startPing(); setTimeout(startTags, 400);
      try { var tmsg = sessionStorage.getItem('lxToast'), pu = sessionStorage.getItem('lxPaceUndo'), ua = sessionStorage.getItem('lxUndoAll'); sessionStorage.removeItem('lxToast'); sessionStorage.removeItem('lxPaceUndo'); sessionStorage.removeItem('lxUndoAll');
        if (tmsg) setTimeout(function () { if (ua) changed(tmsg, function () { try { restoreSnap(JSON.parse(ua)); } catch (e) {} var prevMin = pu ? +pu : 0; var go = function () { location.reload(); }; if (prevMin) post('pace', { minutes: prevMin }).then(go); else go(); }); else if (pu != null) changed(tmsg, function () { post('pace', { minutes: +pu }).then(function () { location.reload(); }); }); else toast(tmsg); }, 900); } catch (e) {} adopt(); new MutationObserver(adoptLater).observe(document.body, { childList: true }); var ac2 = 0, adi = setInterval(function () { adopt(); measure(); if (++ac2 > 25) clearInterval(adi); }, 600); startTick();
      if (window.LXAway) LXAway.init(S);
      if (window.LXAdmin && S.admin) LXAdmin.init();
    }).catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
