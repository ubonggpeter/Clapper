/* Rotatable product viewer. Drag (or swipe) sideways to turn the product, up and down to look from a higher or lower
   ring (when the product was filmed in more than one circle). Buttons zoom in and out; arrow keys work too.
   <div class="bm-spin" data-base="uploads/spins/<token>/" data-rings data-per data-w data-h data-reverse data-title></div>
   BmSpin.mount(el, { urls: [[ring0 urls...], [ring1 urls...]], reverse: false, title: '' }) is used for the preview in the admin. */
(function () {
  'use strict';
  var CSS = '.bm-spin{position:relative;width:100%;max-width:560px;margin:8px auto;background:radial-gradient(ellipse at 50% 40%,rgba(255,255,255,.07),rgba(0,0,0,.25));border-radius:18px;overflow:hidden;user-select:none;-webkit-user-select:none;outline:none;touch-action:pan-y;cursor:grab;box-shadow:0 8px 24px rgba(0,0,0,.3)}' +
    '.bm-spin.multi{touch-action:none}.bm-spin.drag{cursor:grabbing}.bm-spin>img{width:100%;height:100%;object-fit:contain;display:block}' +
    '.bm-spin canvas{position:absolute;inset:0;width:100%;height:100%;display:block;transform-origin:50% 50%}' +
    '.bm-spin-bar{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(255,255,255,.12)}.bm-spin-bar i{display:block;height:100%;width:0;background:var(--bm-primary,#10b981);transition:width .2s}' +
    '.bm-spin-hint{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);background:rgba(0,0,0,.6);color:#fff;font:700 .8rem system-ui,sans-serif;padding:7px 14px;border-radius:999px;pointer-events:none;display:flex;gap:8px;align-items:center;transition:opacity .4s;white-space:nowrap}' +
    '.bm-spin-hint b{display:inline-block;animation:bmSpinHand 1.6s ease-in-out infinite}@keyframes bmSpinHand{0%,100%{transform:translateX(-6px)}50%{transform:translateX(6px)}}' +
    '.bm-spin-btns{position:absolute;top:8px;right:8px;display:flex;gap:6px}.bm-spin-btns button{width:34px;height:34px;min-width:0;min-height:0;padding:0;margin:0;line-height:1;box-shadow:none;border-radius:50%;border:0;background:rgba(0,0,0,.55);color:#fff;font:700 1.1rem system-ui,sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center}.bm-spin-btns button:hover{background:rgba(0,0,0,.8)}' +
    '.bm-spin-badge{position:absolute;left:10px;top:10px;background:rgba(0,0,0,.55);color:#fff;font:800 .72rem system-ui,sans-serif;padding:4px 10px;border-radius:999px;pointer-events:none;letter-spacing:.04em}' +
    '.bm-spin:fullscreen{max-width:none;border-radius:0;aspect-ratio:auto!important;background:#000}.bm-spin:-webkit-full-screen{max-width:none;border-radius:0;background:#000}' +
    '@media (prefers-reduced-motion:reduce){.bm-spin-hint b{animation:none}}';
  var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function Spin(el, cfg) {
    var self = this; this.el = el; this.cfg = cfg; this.urls = cfg.urls; this.rings = this.urls.length; this.per = this.urls[0].length;
    this.imgs = []; this.ok = []; this.loaded = 0; this.total = this.rings * this.per;
    this.pos = 0; this.ring = Math.floor((this.rings - 1) / 2); this.vel = 0; this.zoom = 1; this.panX = 0; this.panY = 0; this.interacted = false; this.started = false; this.dir = cfg.reverse ? -1 : 1;
    el.classList.add('bm-spin'); if (this.rings > 1) el.classList.add('multi');
    el.setAttribute('tabindex', '0'); el.setAttribute('role', 'img'); el.setAttribute('aria-label', (cfg.title || 'Product') + '. Drag to rotate. Use the arrow keys to turn it.');
    var first = el.querySelector('img'); this.firstImg = first;
    this.canvas = document.createElement('canvas'); this.ctx = this.canvas.getContext('2d'); el.appendChild(this.canvas);
    this.bar = document.createElement('div'); this.bar.className = 'bm-spin-bar'; this.bar.innerHTML = '<i></i>'; el.appendChild(this.bar);
    this.hint = document.createElement('div'); this.hint.className = 'bm-spin-hint'; this.hint.innerHTML = '<b>👆</b><span>' + (this.rings > 1 ? 'Drag to rotate · up/down to tilt' : 'Drag to rotate') + '</span>'; el.appendChild(this.hint);
    var badge = document.createElement('div'); badge.className = 'bm-spin-badge'; badge.textContent = '360°'; el.appendChild(badge);
    var btns = document.createElement('div'); btns.className = 'bm-spin-btns';
    [['+', 'Zoom in', function () { self.setZoom(self.zoom * 1.4); }], ['−', 'Zoom out', function () { self.setZoom(self.zoom / 1.4); }], ['⛶', 'Full screen', function () { self.full(); }]].forEach(function (b) { var x = document.createElement('button'); x.type = 'button'; x.textContent = b[0]; x.setAttribute('aria-label', b[1]); x.addEventListener('click', function (e) { e.stopPropagation(); b[2](); }); x.addEventListener('pointerdown', function (e) { e.stopPropagation(); }); btns.appendChild(x); }); el.appendChild(btns);
    this.bind(); this.size();
    if ('ResizeObserver' in window) new ResizeObserver(function () { self.size(); self.draw(); }).observe(el);
    if ('IntersectionObserver' in window) { var io = new IntersectionObserver(function (en) { en.forEach(function (x) { if (x.isIntersecting) { self.start(); self.visible = true; } else self.visible = false; }); }, { rootMargin: '300px' }); io.observe(el); } else this.start();
    this.tick = this.tick.bind(this); requestAnimationFrame(this.tick);
  }
  Spin.prototype.start = function () {
    if (this.started) return; this.started = true; var self = this;
    // the picture in front first, then the others in the order they are needed
    var order = []; for (var r = 0; r < this.rings; r++) for (var i = 0; i < this.per; i++) order.push([r, i]);
    var c = Math.round(this.pos), cr = this.ring; order.sort(function (a, b) { return (Math.abs(a[0] - cr) * 1000 + Math.min(Math.abs(a[1] - c), self.per - Math.abs(a[1] - c))) - (Math.abs(b[0] - cr) * 1000 + Math.min(Math.abs(b[1] - c), self.per - Math.abs(b[1] - c))); });
    var q = order.slice(), active = 0, MAX = 4;
    function next() {
      while (active < MAX && q.length) { (function (rc) { var r = rc[0], i = rc[1]; var im = new Image(); active++; im.onload = im.onerror = function () { active--; if (im.naturalWidth) { (self.imgs[r] = self.imgs[r] || [])[i] = im; self.loaded++; self.bar.firstChild.style.width = Math.round(100 * self.loaded / self.total) + '%'; if (self.loaded === 1 && self.firstImg) self.firstImg.style.visibility = 'hidden'; self.draw(); if (self.loaded >= self.total) setTimeout(function () { self.bar.style.opacity = 0; }, 400); } next(); }; im.decoding = 'async'; im.src = self.urls[r][i]; })(q.shift()); }
    }
    next();
  };
  Spin.prototype.size = function () { var d = window.devicePixelRatio || 1, w = this.el.clientWidth, h = this.el.clientHeight; if (!w || !h) return; this.canvas.width = Math.round(w * d); this.canvas.height = Math.round(h * d); };
  Spin.prototype.nearest = function () {
    var i = ((Math.round(this.pos) % this.per) + this.per) % this.per, r = Math.max(0, Math.min(this.rings - 1, Math.round(this.ring)));
    var im = this.imgs[r] && this.imgs[r][i]; if (im) return im;
    for (var k = 1; k < this.per; k++) { var a = this.imgs[r] && this.imgs[r][(i + k) % this.per], b = this.imgs[r] && this.imgs[r][(i - k + this.per) % this.per]; if (a) return a; if (b) return b; }
    for (var rr = 0; rr < this.rings; rr++) for (var j = 0; j < this.per; j++) if (this.imgs[rr] && this.imgs[rr][j]) return this.imgs[rr][j];
    return null;
  };
  Spin.prototype.draw = function () {
    var im = this.nearest(); if (!im) return; var c = this.ctx, W = this.canvas.width, H = this.canvas.height; c.clearRect(0, 0, W, H);
    var s = Math.min(W / im.naturalWidth, H / im.naturalHeight), w = im.naturalWidth * s, h = im.naturalHeight * s;
    c.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
    this.canvas.style.transform = 'translate(' + this.panX + 'px,' + this.panY + 'px) scale(' + this.zoom + ')';
  };
  Spin.prototype.setZoom = function (z) { this.zoom = Math.max(1, Math.min(4, z)); if (this.zoom === 1) { this.panX = 0; this.panY = 0; } this.touch(); this.draw(); };
  Spin.prototype.touch = function () { this.interacted = true; this.hint.style.opacity = 0; };
  Spin.prototype.full = function () { var e = this.el; if (document.fullscreenElement) document.exitFullscreen(); else (e.requestFullscreen || e.webkitRequestFullscreen || function () {}).call(e); };
  Spin.prototype.bind = function () {
    var self = this, el = this.el, down = null, pts = {}, pinch = 0;
    el.addEventListener('pointerdown', function (e) { if (e.target.closest('.bm-spin-btns')) return; el.setPointerCapture(e.pointerId); pts[e.pointerId] = [e.clientX, e.clientY]; var n = Object.keys(pts).length; if (n === 2) { var k = Object.keys(pts); pinch = Math.hypot(pts[k[0]][0] - pts[k[1]][0], pts[k[0]][1] - pts[k[1]][1]); } down = { x: e.clientX, y: e.clientY }; self.vel = 0; el.classList.add('drag'); self.touch(); self.start(); });
    el.addEventListener('pointermove', function (e) {
      if (!pts[e.pointerId]) return; var px = pts[e.pointerId][0], py = pts[e.pointerId][1]; pts[e.pointerId] = [e.clientX, e.clientY]; var keys = Object.keys(pts);
      if (keys.length === 2) { var d = Math.hypot(pts[keys[0]][0] - pts[keys[1]][0], pts[keys[0]][1] - pts[keys[1]][1]); if (pinch) self.setZoom(self.zoom * d / pinch); pinch = d; return; }
      var dx = e.clientX - px, dy = e.clientY - py;
      if (self.zoom > 1) { self.panX += dx; self.panY += dy; self.draw(); return; }
      var perPx = self.per / (el.clientWidth * 0.95); var dp = -dx * perPx * self.dir; self.pos += dp; self.vel = dp;
      if (self.rings > 1) { self.ring = Math.max(0, Math.min(self.rings - 1, self.ring + dy / (el.clientHeight * 0.45) * (self.rings - 1) * -1)); }
      self.draw();
    });
    function up(e) { delete pts[e.pointerId]; pinch = 0; if (!Object.keys(pts).length) { el.classList.remove('drag'); down = null; } }
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', function (e) { if (!e.ctrlKey) return; e.preventDefault(); self.setZoom(self.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)); }, { passive: false });
    el.addEventListener('dblclick', function () { self.setZoom(self.zoom > 1 ? 1 : 2.2); });
    el.addEventListener('keydown', function (e) {
      var k = e.key, h = false; if (k === 'ArrowLeft') { self.pos -= 1 * self.dir; h = true; } else if (k === 'ArrowRight') { self.pos += 1 * self.dir; h = true; } else if (k === 'ArrowUp') { self.ring = Math.min(self.rings - 1, self.ring + 1); h = true; } else if (k === 'ArrowDown') { self.ring = Math.max(0, self.ring - 1); h = true; } else if (k === '+' || k === '=') { self.setZoom(self.zoom * 1.3); h = true; } else if (k === '-') { self.setZoom(self.zoom / 1.3); h = true; }
      if (h) { e.preventDefault(); self.touch(); self.start(); self.draw(); }
    });
  };
  Spin.prototype.tick = function () {
    if (this.visible || !this.started) {
      if (!this.interacted && !reduce && this.loaded > 1) { this.pos += 0.12 * this.dir; this.draw(); }            // gentle turn until the visitor takes over
      else if (Math.abs(this.vel) > 0.01 && !this.el.classList.contains('drag')) { this.pos += this.vel; this.vel *= 0.94; this.draw(); }
    }
    requestAnimationFrame(this.tick);
  };

  function fromEl(el) {
    if (el.__bmspin || !el.dataset.base) return;
    var rings = Math.max(1, parseInt(el.dataset.rings, 10) || 1), per = Math.max(2, parseInt(el.dataset.per, 10) || 2), urls = [];
    for (var r = 0; r < rings; r++) { var row = []; for (var i = 0; i < per; i++) row.push(el.dataset.base + 'r' + r + '_' + (i < 10 ? '0' + i : i) + '.jpg'); urls.push(row); }
    el.__bmspin = new Spin(el, { urls: urls, reverse: el.dataset.reverse === '1', title: el.dataset.title });
  }
  function scan(root) { (root || document).querySelectorAll('.bm-spin[data-base]').forEach(fromEl); }
  window.BmSpin = { mount: function (el, cfg) { if (el.__bmspin) return el.__bmspin; el.__bmspin = new Spin(el, cfg); return el.__bmspin; }, scan: scan };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { scan(); }); else scan();
  if ('MutationObserver' in window) new MutationObserver(function (m) { for (var i = 0; i < m.length; i++) if (m[i].addedNodes.length) { scan(); break; } }).observe(document.documentElement, { childList: true, subtree: true });
})();
