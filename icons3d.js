/* 3D icons for the visitor interface. Each icon is a glossy extruded tile (stacked depth layers in real CSS 3D space) with a
   vector glyph on the front face. They are pure SVG, so they stay razor sharp at any resolution (4K included), and they rotate
   on their own. Use LX3D.html('speaker', 34) or just let LX3D.swap() replace emoji in buttons. */
(function () {
  if (window.LX3D) return;
  // [tile colour top, tile colour bottom, glyph markup (24x24 grid, drawn white)]
  var G = {
    speaker: ['#38bdf8', '#0369a1', '<path d="M11 5 6 9H2v6h4l5 4V5z" fill="#fff"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" fill="none"/>'],
    photo: ['#f472b6', '#9d174d', '<rect x="3" y="3" width="18" height="18" rx="3" fill="none"/><circle cx="8.5" cy="8.5" r="1.8" fill="#fff"/><path d="m21 15-5-5L5 21" fill="none"/>'],
    headphones: ['#a78bfa', '#5b21b6', '<path d="M3 18v-6a9 9 0 0 1 18 0v6" fill="none"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" fill="#fff"/>'],
    bot: ['#c084fc', '#6b21a8', '<rect x="4" y="8" width="16" height="12" rx="3.5" fill="none"/><path d="M12 8V4.5" fill="none"/><circle cx="12" cy="3.5" r="1.4" fill="#fff"/><circle cx="9" cy="13.5" r="1.5" fill="#fff"/><circle cx="15" cy="13.5" r="1.5" fill="#fff"/><path d="M9.5 17h5" fill="none"/>'],
    users: ['#38bdf8', '#0c4a6e', '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" fill="none"/><circle cx="9" cy="7" r="4" fill="#fff"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" fill="none"/>'],
    star: ['#fbbf24', '#b45309', '<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3-6.2 3.3L7 14.2 2 9.3l6.9-1z" fill="#fff"/>'],
    gift: ['#4ade80', '#15803d', '<path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7" fill="none"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" fill="none"/>'],
    bolt: ['#4ade80', '#166534', '<path d="M13 2 3 14h9l-1 8 10-12h-9z" fill="#fff"/>'],
    download: ['#2dd4bf', '#0f766e', '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" fill="none"/>'],
    form: ['#fbbf24', '#b45309', '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="none"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" fill="none"/>'],
    clock: ['#fb923c', '#9a3412', '<circle cx="12" cy="12" r="10" fill="none"/><path d="M12 6v6l4 2" fill="none"/>'],
    moon: ['#818cf8', '#312e81', '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" fill="#fff"/>'],
    sun: ['#fbbf24', '#c2410c', '<circle cx="12" cy="12" r="5" fill="#fff"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" fill="none"/>'],
    pin: ['#f87171', '#991b1b', '<path d="M12 17v5M9 3h6l-1 7 3 3v2H7v-2l3-3z" fill="#fff"/>'],
    reply: ['#38bdf8', '#075985', '<path d="M9 14 4 9l5-5" fill="none"/><path d="M20 20v-7a4 4 0 0 0-4-4H4" fill="none"/>'],
    edit: ['#fbbf24', '#92400e', '<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" fill="none"/>'],
    trash: ['#f87171', '#7f1d1d', '<path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" fill="none"/>'],
    copy: ['#94a3b8', '#334155', '<rect x="9" y="9" width="13" height="13" rx="2" fill="none"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" fill="none"/>'],
    send: ['#22c55e', '#166534', '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" fill="none"/>'],
    mic: ['#fb7185', '#9f1239', '<rect x="9" y="1" width="6" height="12" rx="3" fill="#fff"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4" fill="none"/>'],
    clip: ['#94a3b8', '#334155', '<path d="M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" fill="none"/>'],
    layout: ['#2dd4bf', '#115e59', '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" fill="none"/><rect x="8" y="8" width="8" height="8" rx="1.5" fill="#fff"/>'],
    userplus: ['#38bdf8', '#075985', '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" fill="none"/><circle cx="8.5" cy="7" r="4" fill="#fff"/><path d="M20 8v6M23 11h-6" fill="none"/>'],
    key: ['#94a3b8', '#1e293b', '<circle cx="7.5" cy="15.5" r="4.5" fill="none"/><path d="M10.7 12.3 21 2M16 7l3 3M18 5l2 2" fill="none"/>'],
    check: ['#22c55e', '#166534', '<path d="M20 6 9 17l-5-5" fill="none"/>'],
    close: ['#94a3b8', '#334155', '<path d="M18 6 6 18M6 6l12 12" fill="none"/>'],
    plus: ['#22c55e', '#166534', '<path d="M12 5v14M5 12h14" fill="none"/>'],
    minus: ['#f87171', '#991b1b', '<path d="M5 12h14" fill="none"/>'],
    reset: ['#94a3b8', '#334155', '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" fill="none"/>'],
    up: ['#60a5fa', '#1e40af', '<path d="M12 19V5M5 12l7-7 7 7" fill="none"/>'],
    down: ['#60a5fa', '#1e40af', '<path d="M12 5v14M5 12l7 7 7-7" fill="none"/>'],
    left: ['#60a5fa', '#1e40af', '<path d="M19 12H5M12 5l-7 7 7 7" fill="none"/>'],
    right: ['#60a5fa', '#1e40af', '<path d="M5 12h14M12 5l7 7-7 7" fill="none"/>'],
    width: ['#a78bfa', '#4c1d95', '<path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4" fill="none"/>'],
    height: ['#a78bfa', '#4c1d95', '<path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4" fill="none"/>'],
    size: ['#fbbf24', '#92400e', '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" fill="none"/>'],
    pause: ['#60a5fa', '#1e40af', '<rect x="6" y="4" width="4" height="16" rx="1" fill="#fff"/><rect x="14" y="4" width="4" height="16" rx="1" fill="#fff"/>'],
    play: ['#22c55e', '#166534', '<path d="M7 4l13 8-13 8z" fill="#fff"/>'],
    share: ['#2dd4bf', '#115e59', '<circle cx="18" cy="5" r="3" fill="none"/><circle cx="6" cy="12" r="3" fill="none"/><circle cx="18" cy="19" r="3" fill="none"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" fill="none"/>'],
    wa: ['#25d366', '#0b6b34', '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z" fill="none"/><path d="M9 9.5c.5 2.5 2.5 4.5 5 5l1.2-1.3-2-1-.8.7a3 3 0 0 1-1.6-1.6l.7-.8-1-2z" fill="#fff"/>'],
    tg: ['#2aabee', '#0b5f8c', '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" fill="none"/>'],
    ig: ['#e1306c', '#7a1a8c', '<rect x="2" y="2" width="20" height="20" rx="5" fill="none"/><path d="M16 11.4A4 4 0 1 1 12.6 8 4 4 0 0 1 16 11.4z" fill="none"/><path d="M17.5 6.5h.01" fill="none"/>'],
    tt: ['#25f4ee', '#0f172a', '<path d="M9 18V5l12-2v13" fill="none"/><circle cx="6" cy="18" r="3" fill="#fff"/><circle cx="18" cy="16" r="3" fill="#fff"/>'],
    yt: ['#ff3b30', '#8a0f0f', '<path d="M22.5 6.4a2.8 2.8 0 0 0-1.9-2C18.9 4 12 4 12 4s-6.9 0-8.6.5a2.8 2.8 0 0 0-1.9 2A29 29 0 0 0 1 11.8a29 29 0 0 0 .5 5.3 2.8 2.8 0 0 0 1.9 2c1.7.5 8.6.5 8.6.5s6.9 0 8.6-.5a2.8 2.8 0 0 0 1.9-2 29 29 0 0 0 .5-5.3 29 29 0 0 0-.5-5.4z" fill="none"/><path d="M9.8 15l5.7-3.3L9.8 8.5z" fill="#fff"/>'],
    fb: ['#1877f2', '#0c3a8a', '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" fill="#fff"/>'],
    x: ['#475569', '#0f172a', '<path d="M4 4l16 16M20 4L4 20" fill="none"/>'],
    in: ['#0a66c2', '#073b73', '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" fill="#fff"/><rect x="2" y="9" width="4" height="12" fill="#fff"/><circle cx="4" cy="4" r="2" fill="#fff"/>'],
    web: ['#38bdf8', '#075985', '<circle cx="12" cy="12" r="10" fill="none"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" fill="none"/>'],
    bell: ['#fb923c', '#9a3412', '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9zM13.7 21a2 2 0 0 1-3.4 0" fill="none"/>'],
    eye: ['#a78bfa', '#6d28d9', '<path d="M1.5 12s4-7 10.5-7 10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z" fill="none"/><circle cx="12" cy="12" r="3" fill="none"/>'],
    wave: ['#22d3ee', '#0e7490', '<path d="M2 12c2.2-4 4.4-4 6.6 0s4.4 4 6.6 0 4.4-4 6.6 0" fill="none"/><path d="M2 17c2.2-3 4.4-3 6.6 0s4.4 3 6.6 0 4.4-3 6.6 0" fill="none" opacity=".7"/>'],
    tools: ['#f59e0b', '#92400e', '<path d="M14.7 6.3a4 4 0 0 0 5 5L9 22l-3-3 10.7-10.7z" fill="none"/><path d="M14.7 6.3 18 3l3 3-3.3 3.3" fill="none"/>'],
    search: ['#34d399', '#065f46', '<circle cx="11" cy="11" r="7" fill="none"/><path d="M21 21l-4.3-4.3" fill="none"/>'],
    smile: ['#fbbf24', '#b45309', '<circle cx="12" cy="12" r="10" fill="none"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" fill="none"/>'],
    parent: ['#60a5fa', '#1e40af', '<path d="M12 19V9M6 14l6-6 6 6M5 4h14" fill="none"/>']
  };
  var EMOJI = { '📲': 'download', '📝': 'form', '⚡': 'bolt', '🤖': 'bot', '💬': 'users', '🚀': 'userplus', '🔑': 'key', '🔊': 'speaker', '🎧': 'headphones', '🎁': 'gift', '⭐': 'star', '📌': 'pin', '🌙': 'moon', '☀️': 'sun', '⏱️': 'clock', '🔒': 'check' };
  var defsDone = false, uid = 0;
  function defs() {
    if (defsDone) return; defsDone = true;
    var s = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><clipPath id="lx3-clip"><rect x="2" y="2" width="44" height="44" rx="12"/></clipPath>';
    Object.keys(G).forEach(function (k) { s += '<linearGradient id="lx3-g-' + k + '" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="' + G[k][0] + '"/><stop offset="1" stop-color="' + G[k][1] + '"/></linearGradient>'; });
    s += '</defs></svg>'; var d = document.createElement('div'); d.innerHTML = s; document.body.appendChild(d.firstChild);
  }
  function html(name, size, opt) {
    var g = G[name] || G.star; defs(); size = size || 32; opt = opt || {};
    var delay = -((uid++ * 1.7) % 9).toFixed(1);
    var layers = '';
    var glyph = '<g transform="translate(12 12)" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1">' +
      '<g transform="translate(0 1.4)" stroke="#000" fill-opacity="0" opacity=".28" style="filter:blur(.4px)">' + g[2].replace(/fill="#fff"/g, 'fill="#000"') + '</g><g stroke="#fff">' + g[2] + '</g></g>';
    for (var i = 5; i >= 1; i--) layers += '<svg class="i3d-l" viewBox="0 0 48 48" style="--k:-' + (i * 2.4) + '"><rect x="2" y="2" width="44" height="44" rx="12" fill="' + (i === 5 ? 'url(#lx3-g-' + name + ')' : g[1]) + '"/>' + (i === 5 ? glyph : '') + '</svg>';
    var front = '<svg class="i3d-l i3d-f" viewBox="0 0 48 48" style="--k:0"><rect x="2" y="2" width="44" height="44" rx="12" fill="url(#lx3-g-' + name + ')"/>' +
      '<g clip-path="url(#lx3-clip)"><path d="M0 0H48V19C36 12 12 12 0 19Z" fill="#fff" opacity=".24"/><rect x="2" y="2" width="44" height="44" rx="12" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.4"/><path d="M0 48V40C14 44 34 44 48 40V48Z" fill="#000" opacity=".16"/></g>' + glyph + '</svg>';
    return '<span class="i3d' + (opt.still ? ' still' : '') + '" style="--sz:' + size + 'px;--d:' + delay + 's" aria-hidden="true"><span class="i3d-in">' + layers + front + '</span></span>';
  }
  function swap(root) {
    root = root || document;
    var re = /^\s*(📲|📝|⚡|🤖|💬|🚀|🔑|🔊|🎧|🎁|⭐|📌)️?\s*/;
    root.querySelectorAll('.bm-post-btn, .vx-fab, .bm-pinned-bar-text, .lx-menu button').forEach(function (b) {
      if (b.__lx3 || b.querySelector('.i3d')) return;
      var w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT, null), n, hit = null; while ((n = w.nextNode())) { if (re.test(n.nodeValue)) { hit = n; break; } }
      if (!hit) return; var m = hit.nodeValue.match(re); hit.nodeValue = hit.nodeValue.replace(re, ''); var sp = document.createElement('span'); sp.innerHTML = html(EMOJI[m[1]], b.classList.contains('vx-fab') ? 22 : 26); sp.style.cssText = 'display:inline-flex;margin-right:8px;vertical-align:middle'; b.insertBefore(sp, hit); b.__lx3 = 1;
    });
    // the Ask AI floating button uses a flat line icon; give it the 3D bot
    var ai = root.querySelector('.bm-ask-ai-fab'); if (ai && !ai.__lx3) { var ic = ai.querySelector('i,svg'); if (ic) { var sp2 = document.createElement('span'); sp2.innerHTML = html('bot', 30); sp2.style.display = 'inline-flex'; ic.replaceWith(sp2); } ai.__lx3 = 1; }
  }
  window.LX3D = { html: html, swap: swap, names: Object.keys(G) };
  var t = null; function later() { clearTimeout(t); t = setTimeout(function () { swap(); }, 120); }
  function start() { swap(); new MutationObserver(later).observe(document.body, { childList: true, subtree: true }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
