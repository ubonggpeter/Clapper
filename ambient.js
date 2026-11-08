/* Background sound of a blog: waves, bubbles, water drops or rain, made live in the browser (no files). The blog owner picks it; a visitor can mute it.
   It plays only while the page is in front. The moment the visitor leaves, it stops and the away sound (a separate thing) can take over. */
(function () {
  if (window.LXAmbient) return;
  var cfg = { kind: 'off', vol: 30 }, ctx = null, master = null, live = [], timers = [], on = false, pid = typeof PAGE_ID !== 'undefined' ? PAGE_ID : 0, KEY = 'lxAmbOff_' + pid;
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }
  function mine() { return ls(KEY) !== '1'; }
  function ensure() {
    if (ctx) return true; var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    try { ctx = new AC({ latencyHint: 'playback' }); } catch (e) { try { ctx = new AC(); } catch (x) { return false; } }
    master = ctx.createGain(); master.gain.value = 0; var comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination); return true;
  }
  function resume() { if (ctx && ctx.state !== 'running') { try { var p = ctx.resume(); if (p && p.catch) p.catch(function () {}); } catch (e) {} } }
  function noise(sec, brown) { var n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0), last = 0; for (var i = 0; i < n; i++) { var w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; } else d[i] = w; } return b; }
  function loopSrc(buf) { var s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); live.push(s); return s; }
  function lfo(freq, depth, target) { var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = freq; g.gain.value = depth; o.connect(g); g.connect(target); o.start(); live.push(o); }
  function later(fn, ms) { var t = setTimeout(function () { timers = timers.filter(function (x) { return x !== t; }); if (on) fn(); }, ms); timers.push(t); }
  var KINDS = {
    waves: function () {                                                // two slow swells of filtered noise, like the sea breathing
      [[420, 0.085, 0.55], [1100, 0.13, 0.3]].forEach(function (L) { var s = loopSrc(noise(6, true)), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'lowpass'; f.frequency.value = L[0]; g.gain.value = L[2] * 0.6; s.connect(f); f.connect(g); g.connect(master); lfo(L[1], L[2] * 0.55, g.gain); });
      var h = loopSrc(noise(3, false)), hp = ctx.createBiquadFilter(), hg = ctx.createGain(); hp.type = 'highpass'; hp.frequency.value = 3500; hg.gain.value = 0.02; h.connect(hp); hp.connect(hg); hg.connect(master); lfo(0.1, 0.018, hg.gain);
    },
    rain: function () {
      var s = loopSrc(noise(4, false)), hp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), g = ctx.createGain(); hp.type = 'highpass'; hp.frequency.value = 1200; lp.type = 'lowpass'; lp.frequency.value = 7500; g.gain.value = 0.22; s.connect(hp); hp.connect(lp); lp.connect(g); g.connect(master);
      var s2 = loopSrc(noise(5, true)), l2 = ctx.createBiquadFilter(), g2 = ctx.createGain(); l2.type = 'lowpass'; l2.frequency.value = 600; g2.gain.value = 0.25; s2.connect(l2); l2.connect(g2); g2.connect(master);
    },
    bubbles: function () {                                              // soft water bubbles popping up now and then
      (function next() { var t = ctx.currentTime, f0 = 260 + Math.random() * 520, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * (1.6 + Math.random() * 0.8), t + 0.1);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.2);
        later(next, 180 + Math.random() * 1300); })();
    },
    drops: function () {                                                // single water drops falling into a pool, with a little echo
      var dl = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain(); dl.delayTime.value = 0.23; fb.gain.value = 0.32; wet.gain.value = 0.5; dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(master);
      (function next() { var t = ctx.currentTime, f = 650 + Math.random() * 900, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f * 1.5, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.connect(g); g.connect(master); g.connect(dl); o.start(t); o.stop(t + 0.35);
        later(next, 700 + Math.random() * 2300); })();
    }
  };
  function level() { return Math.max(0.02, (cfg.vol / 100) * 0.55); }
  function teardown() { timers.forEach(clearTimeout); timers = []; live.forEach(function (n) { try { n.stop(); } catch (e) {} try { n.disconnect(); } catch (e) {} }); live = []; }
  function stop() {
    on = false; if (!ctx || !master) { teardown(); return; } var t = ctx.currentTime; try { master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(0, t + 0.4); } catch (e) {}
    var live0 = live; live = []; timers.forEach(clearTimeout); timers = []; setTimeout(function () { live0.forEach(function (n) { try { n.stop(); } catch (e) {} try { n.disconnect(); } catch (e) {} }); if (!on && ctx && ctx.state === 'running' && !live.length) { try { var sp = ctx.suspend(); if (sp && sp.catch) sp.catch(function () {}); } catch (e) {} } }, 650);   // and the audio engine itself is paused, so nothing can be heard
  }
  function start(force) {
    if (!KINDS[cfg.kind] || (!force && (!mine() || document.hidden))) { stop(); return; }
    if (!ensure()) return; resume(); teardown(); on = true; try { KINDS[cfg.kind](); } catch (e) { teardown(); return; }
    var t = ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(level(), t + 1.2);
  }
  ['pointerdown', 'touchstart', 'touchend', 'keydown', 'click'].forEach(function (ev) { window.addEventListener(ev, function once() { if (cfg.kind === 'off') return; if (!ctx || ctx.state !== 'running') { ensure(); resume(); if (!on) start(); } }, { capture: true, passive: true }); });
  var back = 0;
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { back++; stop(); return; }
    if (cfg.kind === 'off' || !mine()) return;
    var mark = ++back, go = function () { if (mark === back && !document.hidden && cfg.kind !== 'off' && mine() && !on) start(); };
    if (window.LXAmbient && typeof LXAmbient.refresh === 'function') { var done = false, t = setTimeout(function () { if (!done) { done = true; go(); } }, 1500); try { LXAmbient.refresh(function () { if (!done) { done = true; clearTimeout(t); go(); } }); } catch (e) { clearTimeout(t); go(); } } else go();   // the blog owner may have switched it off while this page was in the background
  });
  /* safety net: if the sound is switched off (by the owner or by the visitor) nothing may keep playing */
  setInterval(function () { if ((cfg.kind === 'off' || !mine()) && (on || live.length)) stop(); }, 3000);
  window.LXAmbient = {
    set: function (kind, vol) { var same = cfg.kind === kind; cfg.kind = KINDS[kind] ? kind : 'off'; cfg.vol = Math.max(5, Math.min(100, +vol || 30)); if (cfg.kind === 'off') stop(); else if (same && on) { var t = ctx.currentTime; master.gain.linearRampToValueAtTime(level(), t + 0.3); } else if (ctx) start(); },
    preview: function (kind, vol) { cfg.kind = kind; cfg.vol = vol || cfg.vol; if (kind === 'off') stop(); else start(true); },
    enabled: mine, setEnabled: function (v) { ls(KEY, v ? '0' : '1'); if (!v) stop(); else if (cfg.kind !== 'off') start(); }, kind: function () { return cfg.kind; }, _level: function () { if (!ctx || !master) return 0; if (!ctx.__an) { ctx.__an = ctx.createAnalyser(); ctx.__an.fftSize = 1024; master.connect(ctx.__an); } var d = new Float32Array(1024); ctx.__an.getFloatTimeDomainData(d); var m = 0; for (var i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); return m; }, _on: function () { return on; }, _state: function () { return ctx ? ctx.state : 'none'; }
  };
})();
