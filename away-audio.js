/* Away audio: plays a sound chosen by the blog owner ONLY while the visitor has left the page (switched app or tab),
   and stops the moment they are active on this page or on any other tipsfyp.site page. The owner picks the sound, and different
   sounds for different situations (which post they left on, time on page, first visit / returning, joined or not, time of day...). */
(function () {
  if (window.LXAway) return;
  var rules = [], playing = null, secs = 0, LSK = 'lxAwayOff', startT = null;
  var pid = typeof PAGE_ID !== 'undefined' ? PAGE_ID : 0, ch = null;
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }
  function enabled() { return ls(LSK) !== '1'; }

  /* ---- the sound engine: the SAME approach as the "How it works" page ----
     A Web Audio context is created and resumed on the visitor's first touch / click / key. From then on the browser treats the page as
     "allowed to make sound", and a running context keeps playing when the visitor switches to another app or tab. So the context is kept
     alive from the first tap (carrying an inaudible hum), and the come-back audio is simply scheduled on it the moment they leave. */
  var ctx = null, master = null, analyser = null, bufs = {}, cur = null;
  function ensureCtx() {
    if (ctx) return true; var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    // 'playback' = a larger audio buffer: the sound stays smooth (no crackle / shaky voice) even while the page is in the background or the phone is busy
    try { ctx = new AC({ latencyHint: 'playback' }); } catch (e) { try { ctx = new AC(); } catch (x) { return false; } }
    master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
    // inaudible keep-alive (about -68 dB, far below anything you can hear) so the browser keeps treating this page as an audio page while it is in the background
    var n = Math.floor(ctx.sampleRate * 2), kb = ctx.createBuffer(1, n, ctx.sampleRate), d = kb.getChannelData(0); for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * 0.0004;
    var ks = ctx.createBufferSource(); ks.buffer = kb; ks.loop = true; ks.connect(ctx.destination); ks.start();
    ctx.onstatechange = function () { if (document.hidden && ctx.state !== 'running') { try { ctx.resume(); } catch (e) {} } };
    return true;
  }
  function resume() { if (ensureCtx() && ctx.state !== 'running') { try { var p = ctx.resume(); if (p && p.catch) p.catch(function () {}); } catch (e) {} } }
  function load(url) {
    if (bufs[url]) return bufs[url]; if (!ensureCtx()) return Promise.reject();
    bufs[url] = fetch(url, { credentials: 'same-origin' }).then(function (r) { return r.arrayBuffer(); }).then(function (ab) { return new Promise(function (ok, no) { ctx.decodeAudioData(ab, ok, no); }); }).catch(function (e) { delete bufs[url]; throw e; });
    return bufs[url];
  }
  function preload() { if (!rules.length || !ensureCtx()) return; rules.forEach(function (r) { load(r.url).catch(function () {}); }); }
  // unlock on the first of these, exactly like the How it works page does (touchend added for iPhones)
  ['pointerdown', 'touchstart', 'touchend', 'mousedown', 'keydown', 'wheel', 'click'].forEach(function (ev) {
    window.addEventListener(ev, function unlock() { if (rules.length) { resume(); preload(); } if (ctx && ctx.state === 'running') window.removeEventListener(ev, unlock, true); }, { capture: true, passive: true });
  });

  var visits = 0; try { var k = 'lxVisits_' + pid; if (!sessionStorage.getItem(k)) { sessionStorage.setItem(k, '1'); ls(k, String((parseInt(ls(k) || '0', 10) || 0) + 1)); } visits = parseInt(ls('lxVisits_' + pid) || '1', 10) || 1; } catch (e) { visits = 1; }
  setInterval(function () { if (!document.hidden) secs += 1; }, 1000);

  function gather() {
    var posts = Array.prototype.slice.call(document.querySelectorAll('#posts .bm-post[data-post-id]')), mid = innerHeight / 2, best = null, bd = 1e9;
    posts.forEach(function (p) { var r = p.getBoundingClientRect(), d = Math.abs((r.top + r.bottom) / 2 - mid); if (d < bd) { bd = d; best = p; } });
    var S = (window.LX && LX.S) || {}, total = S.totalPosts;
    var finished = total != null ? posts.length >= total : (typeof POSTS_REMAINING === 'undefined' || POSTS_REMAINING === 0 || !(typeof DRIP_ACTIVE !== 'undefined' && DRIP_ACTIVE));
    return { latest: posts.length ? +posts[posts.length - 1].getAttribute('data-post-id') : 0, reading: best ? +best.getAttribute('data-post-id') : 0, secs: secs, joined: !!S.me, first: visits <= 1, hour: new Date().getHours(), finished: finished };
  }
  function match(r, c) {
    var q = r.cond || {};
    if (q.post_id && q.post_id !== c.latest && q.post_id !== c.reading) return false;
    if (q.visit === 'first' && !c.first) return false; if (q.visit === 'returning' && c.first) return false;
    if (q.joined === 'yes' && !c.joined) return false; if (q.joined === 'no' && c.joined) return false;
    if (q.progress === 'finished' && !c.finished) return false; if (q.progress === 'unfinished' && c.finished) return false;
    if (q.min_seconds != null && c.secs < q.min_seconds) return false; if (q.max_seconds != null && c.secs > q.max_seconds) return false;
    if (q.hour_from != null && q.hour_to != null) { var h = c.hour, f = q.hour_from, t = q.hour_to, inn = f <= t ? (h >= f && h <= t) : (h >= f || h <= t); if (!inn) return false; }
    return true;
  }
  function pick() { var c = gather(); for (var i = 0; i < rules.length; i++) if (rules[i].enabled !== false && match(rules[i], c)) return rules[i]; return null; }

  var token = 0, active = 0;
  function play(r) {
    if (!ensureCtx()) return; resume();
    if (playing || cur) return;                                       // already playing (or about to): never start a second copy
    var my = ++token;
    load(r.url).then(function (buf) {
      if (my !== token || !document.hidden || playing || cur) return; // the visitor came back, or another start won the race
      var t0 = ctx.currentTime + Math.max(0, r.delay || 0), vol = Math.max(0.05, Math.min(1, (r.volume || 100) / 100)), life = Math.max(1, r.max || 10) * 60, gap = Math.max(0, r.gap || 0);
      var g = ctx.createGain(), srcs = [], mk = function (at, loop) { var s = ctx.createBufferSource(); s.buffer = buf; s.loop = loop; s.connect(g); s.start(at); srcs.push(s); return s; };
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.3);          // short fade-in so no word is lost; scheduled on the audio clock (exact even in the background)
      g.connect(master); var last;
      if (r.loop && gap > 0) {                                        // play, wait `gap` seconds of silence, play again... (all scheduled on the audio clock)
        var span = buf.duration + gap, n = Math.min(300, Math.max(1, Math.ceil(life / span))); for (var k = 0; k < n; k++) last = mk(t0 + k * span, false);
      } else { last = mk(t0, !!r.loop); last.stop(t0 + life); }
      cur = { srcs: srcs, g: g }; playing = r; active++;
      last.onended = function () { active = Math.max(0, active - 1); if (cur && cur.srcs === srcs) { cur = null; playing = null; } };
      try { if ('mediaSession' in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: r.label || 'Come back!', artist: document.title.split(' - ')[0] || 'tipsfyp.site' }); } catch (e) {}
    }).catch(function () {});
  }
  function stop() {
    token++; clearTimeout(startT); if (!cur) { playing = null; return; }
    var c = cur, t = ctx.currentTime; cur = null; playing = null; active = Math.max(0, active - 1);
    try { c.g.gain.cancelScheduledValues(t); c.g.gain.setValueAtTime(Math.max(0.0001, c.g.gain.value), t); c.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); } catch (e) {}
    c.srcs.forEach(function (x) { try { x.stop(t + 0.4); } catch (e) { try { x.stop(); } catch (y) {} } });
  }
  function onHidden() {
    if (!enabled() || !rules.length) return; var r = pick(); if (!r) return; play(r);
  }
  function announceActive() { try { if (ch) ch.postMessage('active'); ls('lxAwayActive', String(Date.now())); } catch (e) {} }
  try { ch = new BroadcastChannel('tipsfyp-away'); ch.onmessage = function () { stop(); }; } catch (e) {}
  window.addEventListener('storage', function (e) { if (e.key === 'lxAwayActive') stop(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) onHidden(); else { stop(); announceActive(); } });
  window.addEventListener('focus', function () { if (!document.hidden) { stop(); announceActive(); } });
  window.addEventListener('pageshow', function () { if (!document.hidden) announceActive(); });
  if (!document.hidden) announceActive();

  window.LXAway = {
    init: function (S) { rules = (S.away || []).slice(); if (ctx && ctx.state === 'running') preload(); },
    setRules: function (list) { rules = (list || []).filter(function (r) { return r.enabled !== false; }); if (ctx && ctx.state === 'running') preload(); },
    enabled: enabled, setEnabled: function (on) { ls(LSK, on ? '0' : '1'); if (!on) stop(); },
    count: function () { return rules.length; }, _state: function () { return ctx ? ctx.state : 'none'; }, _active: function () { return active; }, _level: function () { if (!ctx) return 0; if (!analyser) { analyser = ctx.createAnalyser(); analyser.fftSize = 1024; master.connect(analyser); }  var d = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(d); var m = 0; for (var i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); return m; }, _record: function (ms) { return new Promise(function (res) { if (!ctx) return res(''); var d = ctx.createMediaStreamDestination(); master.connect(d); var rec = new MediaRecorder(d.stream), ch = []; rec.ondataavailable = function (e) { if (e.data.size) ch.push(e.data); }; rec.onstop = function () { var fr = new FileReader(); fr.onload = function () { res(String(fr.result).split(',')[1] || ''); }; fr.readAsDataURL(new Blob(ch, { type: rec.mimeType })); }; rec.start(); setTimeout(function () { rec.stop(); }, ms); }); },
    stop: stop, pick: pick, ctx: gather, _hidden: onHidden, _playing: function () { return playing; }
  };
})();
