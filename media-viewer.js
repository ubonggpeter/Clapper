/* WhatsApp-style full-screen media viewer for blog posts.
   - Tap a picture / video (single or in an album) to open it full-screen.
   - Albums: swipe, arrow buttons or arrow keys move between items.
   - Images: pinch / wheel / double-tap to zoom, drag to pan when zoomed.
   - Close: X, Esc, tap the dark area, swipe down, or the phone's Back button. */
(function () {
  'use strict';
  if (window.__bmViewer) return;
  window.__bmViewer = true;

  var css = [
    '.bmv{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.95);opacity:0;transition:opacity .18s ease;font-family:inherit}',
    '.bmv.on{opacity:1}',
    '.bmv-stage{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;overflow:hidden;touch-action:none}',
    '.bmv-stage img,.bmv-stage video{max-width:100%;max-height:100%;object-fit:contain;user-select:none;-webkit-user-select:none;-webkit-user-drag:none;transform-origin:center center;will-change:transform;background:#000}',
    '.bmv-stage img{cursor:zoom-in}',
    '.bmv-stage img.zoomed{cursor:grab}',
    '.bmv-top{position:absolute;top:0;left:0;right:0;z-index:3;display:flex;align-items:center;gap:12px;padding:calc(10px + env(safe-area-inset-top)) 14px 22px;background:linear-gradient(rgba(0,0,0,.65),transparent);color:#fff;font-weight:700;pointer-events:none}',
    '.bmv-top>*{pointer-events:auto}',
    '.bmv-btn{width:44px;height:44px;border-radius:50%;border:0;background:rgba(255,255,255,.16);color:#fff;font-size:26px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}',
    '.bmv-btn:hover,.bmv-btn:focus-visible{background:rgba(255,255,255,.3);outline:2px solid #fff}',
    '.bmv-nav{position:absolute;top:50%;margin-top:-22px;z-index:3}',
    '.bmv-prev{left:12px}.bmv-next{right:12px}',
    '.bmv-hide{display:none!important}',
    '.bmv-count{color:#fff;font-size:.95rem}',
    '.bmv-vwrap{display:block;position:relative;width:100%;height:100%;min-height:0;cursor:pointer}',
    '.bmv-vwrap>video{display:block}',
    '.bmv-play{position:absolute;left:50%;top:50%;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;background:rgba(0,0,0,.55);border:2px solid rgba(255,255,255,.9);color:#fff;font-size:22px;display:flex;align-items:center;justify-content:center;padding-left:4px;pointer-events:none}',
    '.bmv-vwrap:focus-visible{outline:3px solid #fff;outline-offset:-3px}',
    '@media (max-width:640px){.bmv-nav{display:none}}'
  ].join('\n');
  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  var root = null, stage, countEl, prevBtn, nextBtn, closeBtn;
  var items = [], idx = 0, isOpen = false, lastFocus = null, prevOverflow = '';
  var st = { s: 1, x: 0, y: 0 };
  var media = null;                       // current <img>/<video> in the stage
  var pointers = {}, g = null, lastTap = 0;

  function clean(src) { return String(src || '').split('#')[0]; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function collect(el) {
    var scope = el.closest ? el.closest('.bm-album') : null;
    var nodes = scope ? scope.querySelectorAll('.bm-album-item') : [el];
    items = [];
    var found = -1;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n === el) found = i;
      items.push({ type: n.tagName === 'VIDEO' ? 'video' : 'image', src: clean(n.getAttribute('src') || n.currentSrc), alt: n.getAttribute('alt') || '' });
    }
    idx = found < 0 ? 0 : found;
  }

  function build() {
    root = document.createElement('div');
    root.className = 'bmv';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Media viewer');
    root.innerHTML = '<div class="bmv-stage"></div>' +
      '<div class="bmv-top"><button type="button" class="bmv-btn bmv-close" aria-label="Close">×</button><span class="bmv-count"></span></div>' +
      '<button type="button" class="bmv-btn bmv-nav bmv-prev" aria-label="Previous">‹</button>' +
      '<button type="button" class="bmv-btn bmv-nav bmv-next" aria-label="Next">›</button>';
    stage = root.querySelector('.bmv-stage');
    countEl = root.querySelector('.bmv-count');
    prevBtn = root.querySelector('.bmv-prev');
    nextBtn = root.querySelector('.bmv-next');
    closeBtn = root.querySelector('.bmv-close');
    closeBtn.addEventListener('click', close);
    prevBtn.addEventListener('click', function () { go(-1); });
    nextBtn.addEventListener('click', function () { go(1); });
    // tap on the dark area (not on the picture/video itself) closes
    stage.addEventListener('click', function (e) {
      if (media) {   // a tap that lands on the picture/video itself never closes
        var r = media.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) return;
      }
      close();
    });
    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerup', onUp);
    stage.addEventListener('pointercancel', onUp);
    stage.addEventListener('wheel', onWheel, { passive: false });
    document.body.appendChild(root);
  }

  function apply(animate) {
    if (!media) return;
    media.style.transition = animate ? 'transform .18s ease' : 'none';
    media.style.transform = 'translate(' + st.x + 'px,' + st.y + 'px) scale(' + st.s + ')';
    if (media.tagName === 'IMG') media.classList.toggle('zoomed', st.s > 1.01);
  }
  function resetZoom() { st.s = 1; st.x = 0; st.y = 0; }

  function show(i) {
    idx = (i + items.length) % items.length;
    var it = items[idx];
    stage.innerHTML = '';
    resetZoom();
    var el;
    if (it.type === 'video') {
      el = document.createElement('video');
      el.src = it.src;
      el.controls = true;
      el.autoplay = true;
      el.playsInline = true;
      el.setAttribute('playsinline', '');
    } else {
      el = document.createElement('img');
      el.src = it.src;
      el.alt = it.alt;
      el.draggable = false;
    }
    stage.appendChild(el);
    media = el;
    apply(false);
    var multi = items.length > 1;
    countEl.textContent = multi ? (idx + 1) + ' / ' + items.length : '';
    prevBtn.classList.toggle('bmv-hide', !multi);
    nextBtn.classList.toggle('bmv-hide', !multi);
    if (multi) {   // preload neighbours
      [idx - 1, idx + 1].forEach(function (j) {
        var n = items[(j + items.length) % items.length];
        if (n && n.type === 'image') { var p = new Image(); p.src = n.src; }
      });
    }
  }

  function go(d) {
    if (items.length < 2) return;
    show(idx + d);
  }

  function open(el) {
    if (isOpen || !el) return;
    collect(el);
    if (!items.length || !items[idx].src) return;
    if (!root) build();
    isOpen = true;
    lastFocus = document.activeElement;
    prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    root.style.display = 'block';
    show(idx);
    requestAnimationFrame(function () { root.classList.add('on'); });
    closeBtn.focus();
    try { history.pushState({ bmv: 1 }, ''); } catch (e) {}
    document.addEventListener('keydown', onKey, true);
  }

  function teardown() {
    if (!isOpen) return;
    isOpen = false;
    document.removeEventListener('keydown', onKey, true);
    if (media && media.tagName === 'VIDEO') { try { media.pause(); } catch (e) {} }
    stage.innerHTML = '';
    media = null;
    pointers = {}; g = null;
    root.classList.remove('on');
    root.style.display = 'none';
    document.documentElement.style.overflow = prevOverflow;
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  }
  function close() {
    if (!isOpen) return;
    var hadState = history.state && history.state.bmv;
    teardown();
    if (hadState) { try { history.back(); } catch (e) {} }
  }
  window.addEventListener('popstate', function () { if (isOpen) teardown(); });

  function onKey(e) {
    if (!isOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    else if ((e.key === '+' || e.key === '=') && media && media.tagName === 'IMG') { st.s = clamp(st.s * 1.3, 1, 6); apply(true); }
    else if (e.key === '-' && media && media.tagName === 'IMG') { st.s = clamp(st.s / 1.3, 1, 6); if (st.s === 1) { st.x = 0; st.y = 0; } apply(true); }
    else if (e.key === 'Tab') {
      var f = root.querySelectorAll('button:not(.bmv-hide), video');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  // ---- gestures (images only; videos use their own controls) ----
  function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
  function onDown(e) {
    if (!media || media.tagName !== 'IMG' || e.target !== media) return;
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    var ids = Object.keys(pointers);
    if (ids.length === 1) {
      g = { sx: e.clientX, sy: e.clientY, t: Date.now(), px: st.x, py: st.y, moved: false, pinch: false };
    } else if (ids.length === 2) {
      g = g || {};
      g.pinch = true;
      g.d0 = dist(pointers[ids[0]], pointers[ids[1]]) || 1;
      g.s0 = st.s;
    }
  }
  function onMove(e) {
    if (!g || !pointers[e.pointerId]) return;
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(pointers);
    if (ids.length === 2 && g.pinch) {
      st.s = clamp(g.s0 * dist(pointers[ids[0]], pointers[ids[1]]) / g.d0, 1, 6);
      g.moved = true;
      apply(false);
    } else if (ids.length === 1 && !g.pinch) {
      var dx = e.clientX - g.sx, dy = e.clientY - g.sy;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) g.moved = true;
      if (st.s > 1) { st.x = g.px + dx; st.y = g.py + dy; apply(false); }
    }
  }
  function onUp(e) {
    if (!pointers[e.pointerId]) return;
    var wasPinch = g && g.pinch;
    var start = g;
    delete pointers[e.pointerId];
    if (Object.keys(pointers).length > 0) return;   // still a finger down
    g = null;
    if (st.s <= 1.02) { resetZoom(); apply(true); }
    if (wasPinch || !start) return;
    var dx = e.clientX - start.sx, dy = e.clientY - start.sy;
    if (st.s <= 1.02) {
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { go(dx < 0 ? 1 : -1); return; }
      if (dy > 90 && dy > Math.abs(dx) * 1.5) { close(); return; }
    }
    if (!start.moved && Date.now() - start.t < 400) {       // a tap
      var now = Date.now();
      if (now - lastTap < 320) {                            // double tap / double click
        lastTap = 0;
        if (st.s > 1.02) { resetZoom(); }
        else {
          var r = media.getBoundingClientRect();
          var cx = e.clientX - (r.left + r.width / 2), cy = e.clientY - (r.top + r.height / 2);
          st.s = 2.5; st.x = -cx * 1.5; st.y = -cy * 1.5;
        }
        apply(true);
      } else { lastTap = now; }
    }
  }
  function onWheel(e) {
    if (!media || media.tagName !== 'IMG') return;
    e.preventDefault();
    st.s = clamp(st.s * (e.deltaY < 0 ? 1.15 : 0.87), 1, 6);
    if (st.s <= 1.02) { resetZoom(); }
    apply(false);
  }

  // ---- feed integration ----
  window.bmOpenLightbox = function (el) { open(el); };   // used by onclick="bmOpenLightbox(this)"

  function enhance(scope) {
    if (!scope || scope.nodeType !== 1) return;
    var vids = scope.matches && scope.matches('video.bm-post-media-video, video.bm-album-video') ? [scope] : scope.querySelectorAll('video.bm-post-media-video, video.bm-album-video');
    Array.prototype.forEach.call(vids, function (v) {
      if (v.getAttribute('data-bmv')) return;
      v.setAttribute('data-bmv', '1');
      v.removeAttribute('controls');
      v.controls = false;
      v.preload = 'metadata';
      var src = v.getAttribute('src');
      if (src && src.indexOf('#') < 0) v.setAttribute('src', src + '#t=0.1');   // show a first frame
      var w = document.createElement('span');
      w.className = 'bmv-vwrap';
      w.setAttribute('role', 'button');
      w.setAttribute('tabindex', '0');
      w.setAttribute('aria-label', 'Play video full screen');
      v.parentNode.insertBefore(w, v);
      w.appendChild(v);
      var b = document.createElement('span');
      b.className = 'bmv-play';
      b.setAttribute('aria-hidden', 'true');
      b.textContent = '▶';
      w.appendChild(b);
    });
  }
  document.addEventListener('click', function (e) {
    var w = e.target.closest ? e.target.closest('.bmv-vwrap') : null;
    if (w) { var v = w.querySelector('video'); if (v) { e.preventDefault(); open(v); } return; }
    // album pictures also work without the inline onclick (e.g. live-appended posts)
    var t = e.target;
    if (t && t.tagName === 'IMG' && t.classList && t.classList.contains('bm-album-img') && !t.getAttribute('onclick')) open(t);
  });
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.classList && e.target.classList.contains('bmv-vwrap')) {
      e.preventDefault();
      var v = e.target.querySelector('video');
      if (v) open(v);
    }
  });

  function init() {
    enhance(document.body);
    if (window.MutationObserver) {
      new MutationObserver(function (muts) {
        muts.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, enhance); });
      }).observe(document.body, { childList: true, subtree: true });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
