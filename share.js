/* Share sheet under each post. Only the single post is shared: its own link
   (/page/<slug>/post/<id>), its title and a short excerpt, never the whole blog. */
(function () {
  'use strict';
  var cfg = window.BM_RW || {};
  var sheet, current = null;
  var ICON = {
    share: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>',
    chat: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.7-5.4A8.4 8.4 0 1 1 21 11.5z"/></svg>',
    status: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9" stroke-dasharray="3 3"/><circle cx="12" cy="12" r="4.5" fill="#fff" stroke="none"/></svg>',
    cam: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="#fff"/></svg>',
    note: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/></svg>',
    ghost: '<svg viewBox="0 0 24 24" width="24" height="24" fill="#fff"><path d="M12 3c-3.3 0-5.5 2.4-5.5 5.6v2.2c-.8.3-1.5.4-2 .6-.5.3-.3.9.2 1.1.8.3 1.6.5 1.9.8.4.5-.7 2.5-2.2 3.3-.4.2-.2.7.2.8 1.2.3 2.5.3 3.2.8.4.3.5 1.2 1 1.4 1 .3 1.8-.5 3.2-.5s2.2.8 3.2.5c.5-.2.6-1.1 1-1.4.7-.5 2-.5 3.2-.8.4-.1.6-.6.2-.8-1.5-.8-2.6-2.8-2.2-3.3.3-.3 1.1-.5 1.9-.8.5-.2.7-.8.2-1.1-.5-.2-1.2-.3-2-.6V8.6C17.5 5.400 15.300 3 12 3z"/></svg>',
    fb: '<svg viewBox="0 0 24 24" width="24" height="24" fill="#fff"><path d="M14 8.5V7c0-.8.2-1.200 1.300-1.200H17V3h-2.600C11.700 3 10.500 4.500 10.500 6.800V8.500H8V11.500h2.500V21H14v-9.500h2.600L17 8.500z"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="22" height="22" fill="#fff"><path d="M17.800 3h2.900l-6.400 7.300L21.800 21h-5.900l-4.600-6-5.300 6H3.100l6.800-7.800L2.700 3h6l4.200 5.500L17.800 3zm-1 16.200h1.600L7.700 4.700H6z"/></svg>',
    tg: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.500 3L2.500 10.500l6 2.200L18 6.500l-7.500 7.800v5.200l3-3.500 4.500 3.300z"/></svg>',
    in: '<svg viewBox="0 0 24 24" width="22" height="22" fill="#fff"><path d="M4.500 8.500h3.400V20H4.500zM6.200 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM10 8.500h3.200v1.600c.5-.9 1.700-1.900 3.500-1.900 3.600 0 4.300 2.400 4.300 5.400V20h-3.400v-5.600c0-1.400 0-3-1.800-3s-2.100 1.400-2.100 2.900V20H10z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
    sms: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    link: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>',
    more: '<svg viewBox="0 0 24 24" width="24" height="24" fill="#fff"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>'
  };
  // kind: 'story' = needs the phone's own share sheet (these apps have no web link for posting a story);
  //       'url'   = opens the app/site with the link filled in; 'copy' / 'native' = special.
  var TARGETS = [
    { id: 'whatsapp', name: 'WhatsApp', bg: '#25D366', icon: 'chat', kind: 'url', url: function (u, t) { return 'https://wa.me/?text=' + encodeURIComponent(t + '\n' + u); } },
    { id: 'whatsapp_status', name: 'WhatsApp Status', bg: '#128C7E', icon: 'status', kind: 'story', app: 'WhatsApp', where: 'Status' },
    { id: 'instagram_story', name: 'Instagram Story', bg: 'linear-gradient(45deg,#F9CE34,#EE2A7B,#6228D7)', icon: 'cam', kind: 'story', app: 'Instagram', where: 'Story', home: 'https://www.instagram.com/' },
    { id: 'tiktok', name: 'TikTok', bg: '#111', icon: 'note', kind: 'story', app: 'TikTok', where: 'post', home: 'https://www.tiktok.com/' },
    { id: 'snapchat', name: 'Snapchat', bg: '#FFFC00', fg: '#000', icon: 'ghost', kind: 'story', app: 'Snapchat', where: 'Story', home: 'https://www.snapchat.com/' },
    { id: 'facebook', name: 'Facebook', bg: '#1877F2', icon: 'fb', kind: 'url', url: function (u) { return 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(u); } },
    { id: 'x', name: 'X', bg: '#000', icon: 'x', kind: 'url', url: function (u, t) { return 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(t) + '&url=' + encodeURIComponent(u); } },
    { id: 'telegram', name: 'Telegram', bg: '#26A5E4', icon: 'tg', kind: 'url', url: function (u, t) { return 'https://t.me/share/url?url=' + encodeURIComponent(u) + '&text=' + encodeURIComponent(t); } },
    { id: 'linkedin', name: 'LinkedIn', bg: '#0A66C2', icon: 'in', kind: 'url', url: function (u) { return 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(u); } },
    { id: 'sms', name: 'Message', bg: '#34C759', icon: 'sms', kind: 'url', same: true, url: function (u, t) { return 'sms:?&body=' + encodeURIComponent(t + ' ' + u); } },
    { id: 'email', name: 'Email', bg: '#6B7280', icon: 'mail', kind: 'url', same: true, url: function (u, t, ti) { return 'mailto:?subject=' + encodeURIComponent(ti) + '&body=' + encodeURIComponent(t + '\n\n' + u); } },
    { id: 'copy', name: 'Copy link', bg: '#334155', icon: 'link', kind: 'copy' },
    { id: 'more', name: 'More', bg: '#475569', icon: 'more', kind: 'native' }
  ];

  function css() {
    var s = document.createElement('style');
    s.textContent =
      '.bm-share-row{display:flex;justify-content:flex-end;padding:2px 6px 4px}' +
      '.bm-share-btn{display:inline-flex;align-items:center;gap:6px;background:transparent;border:0;color:inherit;opacity:.7;cursor:pointer;padding:6px 10px;border-radius:99px;font:600 .82rem system-ui,sans-serif}' +
      '.bm-share-btn:hover,.bm-share-btn:focus-visible{opacity:1;background:rgba(127,127,127,.18)}' +
      '.bm-sh-back{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:10000;display:none;align-items:flex-end;justify-content:center}' +
      '.bm-sh-back.on{display:flex}' +
      '.bm-sh{background:#131a30;color:#fff;width:100%;max-width:520px;border-radius:22px 22px 0 0;padding:14px 14px calc(18px + env(safe-area-inset-bottom));max-height:88vh;overflow:auto;animation:bmShUp .25s ease-out;font-family:system-ui,sans-serif}' +
      '@keyframes bmShUp{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}' +
      '.bm-sh-grip{width:42px;height:4px;border-radius:9px;background:#3a4570;margin:0 auto 10px}' +
      '.bm-sh h3{margin:0 0 2px;font-size:1.02rem}.bm-sh-sub{color:#9aa4c4;font-size:.82rem;margin:0 0 12px;word-break:break-word}' +
      '.bm-sh-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px 6px}' +
      '.bm-sh-it{background:none;border:0;color:#fff;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;font:500 .72rem system-ui,sans-serif;padding:2px;text-align:center}' +
      '.bm-sh-ic{width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center}' +
      '.bm-sh-note{margin:14px 2px 0;color:#9aa4c4;font-size:.78rem;line-height:1.4}' +
      '.bm-sh-x{position:absolute;opacity:0;pointer-events:none}' +
      '@media(min-width:560px){.bm-sh-back{align-items:center}.bm-sh{border-radius:22px}}';
    document.head.appendChild(s);
  }

  function build() {
    css();
    sheet = document.createElement('div'); sheet.className = 'bm-sh-back';
    var html = '<div class="bm-sh" role="dialog" aria-modal="true" aria-label="Share this post"><div class="bm-sh-grip"></div><h3>Share this post</h3><p class="bm-sh-sub" id="bmShTitle"></p><div class="bm-sh-grid">';
    TARGETS.forEach(function (t) {
      html += '<button type="button" class="bm-sh-it" data-t="' + t.id + '"><span class="bm-sh-ic" style="background:' + t.bg + (t.fg ? ';color:' + t.fg : '') + '">' + ICON[t.icon].replace(/#fff/g, t.fg || '#fff') + '</span>' + t.name + '</button>';
    });
    html += '</div><p class="bm-sh-note" id="bmShNote">Only this post is shared, not the whole blog.</p></div>';
    sheet.innerHTML = html;
    document.body.appendChild(sheet);
    sheet.addEventListener('click', function (e) {
      if (e.target === sheet) close();
      var b = e.target.closest('.bm-sh-it'); if (b) act(b.getAttribute('data-t'));
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    if (!navigator.share) sheet.querySelector('[data-t="more"]').style.display = 'none';
  }

  // A blog shown from a GitHub project page (yourname.github.io/yourrepo) lives in a folder: every link made here must keep it, or GitHub answers 404.
  function siteFolder() { return (window.TF && window.TF.p) || ''; }
  function siteBase() { return location.origin + siteFolder(); }
  function open(btn) {
    if (!sheet) build();
    var id = btn.getAttribute('data-share-post');
    current = {
      id: id,
      title: btn.getAttribute('data-title') || cfg.title || document.title,
      text: btn.getAttribute('data-text') || '',
      image: btn.getAttribute('data-image') || '',
      // a signed-in member's link carries their code, so they earn when new visitors open it
      url: siteBase() + '/page/' + encodeURIComponent(cfg.slug) + '/post/' + id + (cfg.member && cfg.member.key ? '?ref=' + encodeURIComponent(cfg.member.key) : '')
    };
    document.getElementById('bmShTitle').textContent = current.title;
    setNote(baseNote());
    sheet.classList.add('on');
    document.documentElement.style.overflow = 'hidden';
  }
  function close() { if (sheet) sheet.classList.remove('on'); document.documentElement.style.overflow = ''; }
  function baseNote() {
    var r = cfg.referral, n = 'Only this post is shared, not the whole blog.';
    if (r && cfg.rewards) n += cfg.member ? ' You earn ' + r.points + ' points each time ' + r.target + ' new visitors open your link.' : ' Join to earn points when new visitors open your link.';
    return n;
  }
  function setNote(t) { var n = document.getElementById('bmShNote'); if (n) n.textContent = t; }

  function record(platform) {
    if (!cfg.pageId) return;
    var b = new URLSearchParams(); b.set('action', 'share'); b.set('page_id', cfg.pageId); b.set('post_id', current.id); b.set('platform', platform);
    fetch('/api/earn.php', { method: 'POST', body: b, keepalive: true, credentials: 'same-origin' }).catch(function () {});
  }

  function shareText() { return current.title + (current.text ? ' - ' + current.text : ''); }

  function wrap(ctx, text, maxW) {
    var words = String(text).split(/\s+/), lines = [], line = '';
    words.forEach(function (w) { var t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; });
    if (line) lines.push(line);
    return lines;
  }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  // A 1080x1920 picture of this post (title, excerpt, its photo, and the link) for story-style apps.
  function makeCard(withImage) {
    return new Promise(function (resolve, reject) {
      var W = 1080, H = 1920, c = document.createElement('canvas'); c.width = W; c.height = H;
      var ctx = c.getContext('2d'), color = cfg.color || '#10b981';
      var g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0b1020'); g.addColorStop(1, '#1b2550'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = color; ctx.globalAlpha = .18; ctx.beginPath(); ctx.arc(W, 0, 520, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      function finish(img) {
        var y = 150;
        ctx.fillStyle = '#fff'; ctx.font = '700 46px system-ui,sans-serif'; ctx.textBaseline = 'top';
        ctx.fillText(cfg.title || '', 90, y); y += 120;
        if (img) {
          var maxW = W - 180, maxH = 760, r = Math.min(maxW / img.width, maxH / img.height), w = img.width * r, h = img.height * r, x = (W - w) / 2;
          ctx.save(); rr(ctx, x, y, w, h, 36); ctx.clip(); ctx.drawImage(img, x, y, w, h); ctx.restore(); y += h + 60;
        } else { y += 40; }
        ctx.fillStyle = '#fff'; ctx.font = '800 68px system-ui,sans-serif';
        wrap(ctx, current.title, W - 180).slice(0, 4).forEach(function (l) { ctx.fillText(l, 90, y); y += 84; });
        if (current.text) { y += 14; ctx.fillStyle = '#c3cbe6'; ctx.font = '400 44px system-ui,sans-serif'; wrap(ctx, current.text, W - 180).slice(0, 5).forEach(function (l) { ctx.fillText(l, 90, y); y += 60; }); }
        rr(ctx, 90, H - 330, W - 180, 150, 40); ctx.fillStyle = color; ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '700 46px system-ui,sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('Read the full post', W / 2, H - 305);
        ctx.font = '400 34px system-ui,sans-serif'; ctx.fillText(location.host + siteFolder() + '/page/' + cfg.slug + '/post/' + current.id, W / 2, H - 240);
        ctx.textAlign = 'left';
        try { c.toBlob(function (b) { b ? resolve(b) : reject(new Error('blob')); }, 'image/png'); } catch (e) { reject(e); }
      }
      if (withImage && current.image) {
        var im = new Image(); im.crossOrigin = 'anonymous';
        im.onload = function () { finish(im); }; im.onerror = function () { finish(null); };
        im.src = current.image;
      } else finish(null);
    });
  }
  function card() { return makeCard(true).catch(function () { return makeCard(false); }); }

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (res, rej) {
      var t = document.createElement('textarea'); t.value = text; t.className = 'bm-sh-x'; document.body.appendChild(t); t.select();
      try { document.execCommand('copy') ? res() : rej(); } catch (e) { rej(e); } t.remove();
    });
  }
  function download(blob, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }

  function act(id) {
    var t = TARGETS.filter(function (x) { return x.id === id; })[0]; if (!t || !current) return;
    var u = current.url, text = shareText();
    if (t.kind === 'url') {
      record(t.id);
      var link = t.url(u, text, current.title);
      if (t.same) location.href = link; else window.open(link, '_blank', 'noopener');
      close();
    } else if (t.kind === 'copy') {
      copy(u).then(function () { record('copy'); setNote('Link copied. It opens just this post.'); }, function () { setNote('Could not copy. Long-press the link in the address bar instead.'); });
    } else if (t.kind === 'native') {
      navigator.share({ title: current.title, text: text, url: u }).then(function () { record('native'); close(); }, function () {});
    } else if (t.kind === 'story') {
      setNote('Preparing your picture…');
      card().then(function (blob) {
        var file = new File([blob], 'post-' + current.id + '.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          // The phone's own share sheet opens. Choose "Status" / "Story" / TikTok there.
          return navigator.share({ files: [file], title: current.title, text: text + '\n' + u }).then(function () { record(t.id); close(); }, function (e) { if (e && e.name !== 'AbortError') throw e; setNote(baseNote()); });
        }
        // No file sharing here (most computers): save the picture, copy the link, open the app.
        download(blob, 'post-' + current.id + '.png');
        copy(u).catch(function () {});
        record(t.id);
        setNote('Picture saved and link copied. Open ' + t.app + ' and add the picture to your ' + t.where + (t.where === 'post' ? '' : '') + '.');
        if (t.home) setTimeout(function () { window.open(t.home, '_blank', 'noopener'); }, 900);
      }).catch(function () { setNote('Could not prepare the picture. Use Copy link instead.'); });
    }
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.bm-share-btn');
    if (b) { e.preventDefault(); open(b); }
  });
  window.bmShareIcon = ICON.share;
})();
