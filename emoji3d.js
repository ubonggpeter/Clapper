/* 3D emoji for the reaction buttons and the public views heart, with a springy click animation.
   Pictures come from /api/emoji.php (stored on this site). If one cannot load, the normal emoji stays. */
(function () {
  'use strict';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function code(e) { var o = []; for (var i = 0; i < e.length;) { var cp = e.codePointAt(i); o.push(cp.toString(16)); i += cp > 0xffff ? 2 : 1; } return o.join('-'); }
  // the stored file is served straight by the web server (fast, cached); the first time, /api/emoji.php fetches and stores it
  function src(e) { return 'uploads/emoji3d/' + code(e) + '.webp'; }
  function api(e) { return '/api/emoji.php?c=' + code(e); }

  var s = document.createElement('style');
  s.textContent =
    '.bm-emo3d{width:30px;height:30px;display:block;object-fit:contain;transform-origin:50% 75%;filter:drop-shadow(0 3px 3px rgba(0,0,0,.32));transition:transform .18s cubic-bezier(.3,1.6,.5,1);-webkit-user-drag:none;user-select:none;pointer-events:none}' +
    '.bm-reaction-btn{display:inline-flex;align-items:center;gap:6px}' +
    '.bm-reaction-btn:hover .bm-emo3d{transform:translateY(-3px) scale(1.22) rotate(-5deg)}' +
    '.bm-reaction-btn:active .bm-emo3d{transform:scale(.82)}' +
    '.bm-reaction-btn.active .bm-emo3d{filter:drop-shadow(0 0 7px var(--bm-primary,#10b981)) drop-shadow(0 3px 3px rgba(0,0,0,.3))}' +
    '.bm-reaction-count{display:inline-block;font-variant-numeric:tabular-nums}' +
    '.bm-post-footer.bm3d i,.bm-post-footer.bm3d svg{display:none!important}' +
    '.bm-post-footer.bm3d{cursor:pointer;-webkit-tap-highlight-color:transparent}' +
    '.bm-heart3d{width:26px;height:26px;display:block;object-fit:contain;filter:drop-shadow(0 3px 3px rgba(0,0,0,.35));animation:bmBeat 1.7s ease-in-out infinite;transform-origin:50% 60%;pointer-events:none}' +
    '@keyframes bmBeat{0%,60%,100%{transform:scale(1)}12%{transform:scale(1.2)}24%{transform:scale(1)}36%{transform:scale(1.13)}}' +
    '.bm-emo-fx{position:fixed;left:0;top:0;width:0;height:0;z-index:10050;pointer-events:none}' +
    '.bm-emo-fx img{position:absolute;width:22px;height:22px;margin:-11px 0 0 -11px;will-change:transform,opacity;filter:drop-shadow(0 2px 2px rgba(0,0,0,.3))}' +
    '.bm-emo-ring{position:absolute;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid var(--bm-primary,#10b981);will-change:transform,opacity}' +
    '@media (prefers-reduced-motion:reduce){.bm-heart3d{animation:none}}';
  document.head.appendChild(s);

  function mk(e, cls) {
    var im = new Image(); im.className = cls; im.alt = e; im.decoding = 'async'; im.draggable = false; im.src = src(e);
    var tried = false;
    im.onerror = function () { if (!tried) { tried = true; im.src = api(e); return; } var t = document.createElement('span'); t.textContent = e; t.className = 'bm-emo-fallback'; t.style.fontSize = '24px'; if (im.parentNode) im.parentNode.replaceChild(t, im); };
    return im;
  }

  function swapReactions(root) {
    (root || document).querySelectorAll('.bm-reaction-btn:not([data-e3d])').forEach(function (b) {
      var e = b.getAttribute('data-emoji'); var first = b.firstElementChild;
      if (!e || !first) return;
      b.setAttribute('data-e3d', '1'); b.setAttribute('aria-label', 'React ' + e);
      first.textContent = ''; first.appendChild(mk(e, 'bm-emo3d'));
    });
    (root || document).querySelectorAll('.bm-post-footer[data-view-count-for]:not(.bm3d)').forEach(function (f) {
      f.classList.add('bm3d'); f.setAttribute('role', 'img'); f.setAttribute('aria-label', 'Views');
      var im = mk('❤️', 'bm-heart3d'); f.insertBefore(im, f.firstChild);
    });
  }

  // ---- click animation ----
  function burst(btn, imgSrc, n, hearts) {
    var r = btn.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var fx = document.createElement('div'); fx.className = 'bm-emo-fx'; fx.style.left = cx + 'px'; fx.style.top = cy + 'px';
    var ring = document.createElement('div'); ring.className = 'bm-emo-ring'; fx.appendChild(ring);
    ring.animate([{ transform: 'scale(.4)', opacity: .9 }, { transform: 'scale(2.6)', opacity: 0 }], { duration: 650, easing: 'cubic-bezier(.2,.7,.3,1)' });
    var list = [];
    for (var i = 0; i < n; i++) {
      var p = new Image(); p.src = imgSrc; p.alt = ''; fx.appendChild(p);
      var ang = (-90 + (i - (n - 1) / 2) * (200 / n) + (Math.random() * 24 - 12)) * Math.PI / 180;
      var dist = 46 + Math.random() * 62, dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist - 10, rot = (Math.random() * 120 - 60);
      var sc = .7 + Math.random() * .8;
      p.animate([
        { transform: 'translate(0,0) scale(.2) rotate(0deg)', opacity: 0 },
        { transform: 'translate(' + dx * .55 + 'px,' + dy * .55 + 'px) scale(' + sc + ') rotate(' + rot * .5 + 'deg)', opacity: 1, offset: .35 },
        { transform: 'translate(' + dx + 'px,' + (dy - 26) + 'px) scale(' + sc * .7 + ') rotate(' + rot + 'deg)', opacity: 0 }
      ], { duration: 820 + Math.random() * 360, easing: 'cubic-bezier(.2,.8,.3,1)', delay: i * 18, fill: 'both' });
    }
    document.body.appendChild(fx);
    setTimeout(function () { fx.remove(); }, 1500);
  }
  function pop(imgEl) {
    imgEl.animate([
      { transform: 'scale(1) rotate(0deg)' },
      { transform: 'scale(.72) rotate(0deg)', offset: .14 },
      { transform: 'scale(1.6) rotate(-14deg) translateY(-8px)', offset: .42 },
      { transform: 'scale(.94) rotate(9deg)', offset: .62 },
      { transform: 'scale(1.18) rotate(-4deg)', offset: .8 },
      { transform: 'scale(1) rotate(0deg)' }
    ], { duration: 760, easing: 'cubic-bezier(.25,.9,.3,1)' });
  }
  function deflate(imgEl) {
    imgEl.animate([{ transform: 'scale(1)' }, { transform: 'scale(.6) rotate(8deg)', offset: .4 }, { transform: 'scale(1)' }], { duration: 380, easing: 'ease-out' });
  }
  function bump(el) { el.animate([{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-6px) scale(1.35)', offset: .4 }, { transform: 'translateY(0) scale(1)' }], { duration: 420, easing: 'cubic-bezier(.3,1.5,.5,1)' }); }

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.bm-reaction-btn');
    if (b) {
      var im = b.querySelector('.bm-emo3d'); if (!im) return;
      if (reduce) return;
      var was = b.classList.contains('active');     // state before this tap
      if (was) deflate(im); else { pop(im); burst(b, im.src, 8); }
      return;
    }
    var f = e.target.closest && e.target.closest('.bm-post-footer.bm3d');
    if (f && !reduce) { var h = f.querySelector('.bm-heart3d'); if (h) { pop(h); burst(h, h.src, 7); } }
  }, true);

  // the number rolls when it changes
  var mo2 = new MutationObserver(function (list) {
    list.forEach(function (m) { var t = m.target.nodeType === 3 ? m.target.parentNode : m.target; if (t && t.classList && t.classList.contains('bm-reaction-count') && !reduce) bump(t); });
  });
  mo2.observe(document.body, { characterData: true, childList: true, subtree: true });

  function run() { swapReactions(document); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
  var queued = false;
  new MutationObserver(function () { if (queued) return; queued = true; requestAnimationFrame(function () { queued = false; swapReactions(document); }); })
    .observe(document.body || document.documentElement, { childList: true, subtree: true });
  window.bmEmoji3d = { src: src, code: code };
})();
