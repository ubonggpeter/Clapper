(function () {
    if (window.lucide) { window.lucide.createIcons(); }

    // Graceful degradation for a broken media URL (deleted file, failed
    // upload, etc.) -- swaps the element for a small notice instead of
    // leaving a bare broken-image icon or a dead player control.
    window.bmMediaError = function (el) {
        if (!el || el.dataset.bmErrored) return;
        el.dataset.bmErrored = '1';
        var notice = document.createElement('div');
        notice.className = 'bm-media-error';
        notice.textContent = 'Media unavailable';
        el.replaceWith(notice);
    };

    // Scroll-triggered card entrance animation: each post plays its own
    // configured animation (Customise Hub's Intro/Scroll-reveal dropdowns)
    // the instant it actually scrolls into the visitor's viewport, not all
    // at once on page load/arrival regardless of whether it's visible yet.
    // A post with a specific animation configured is server-rendered with
    // data-bm-anim="<name>" + data-bm-anim-pending (see inc/post_render.php)
    // -- CSS keeps it invisible (opacity:0) until that attribute is removed
    // below, so there's nothing to see before the animation actually plays.
    // A post with no specific animation configured (data-bm-anim absent)
    // instead gets the generic Motion-based fade+slide-up fallback, also
    // fired on the same scroll-into-view trigger for consistent behavior
    // either way.
    var bmAnimObserver = null;
    if ('IntersectionObserver' in window) {
        bmAnimObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                var el = entry.target;
                bmAnimObserver.unobserve(el);
                var animName = el.dataset.bmAnim;
                if (animName) {
                    el.classList.add('bm-anim-' + animName);
                    delete el.dataset.bmAnimPending;
                } else if (window.Motion) {
                    window.Motion.animate(el, { opacity: [0, 1], transform: ['translateY(16px)', 'translateY(0px)'] }, { duration: 0.4 });
                }
            });
        }, { threshold: 0.15 });
    }
    function bmObserveForAnim(el) {
        if (bmAnimObserver) {
            bmAnimObserver.observe(el);
        } else if (el.dataset.bmAnim) {
            // No IntersectionObserver support (very old browser) -- reveal
            // immediately rather than leaving the post permanently invisible.
            el.classList.add('bm-anim-' + el.dataset.bmAnim);
            delete el.dataset.bmAnimPending;
        }
    }

    // Per-post honest unique view: fires once per post per visitor, only
    // once it's actually scrolled into view (matches the "genuine view" the
    // rest of this codebase already tracks for page-level counters). Defined
    // up here (not just wired up for the posts present at initial render) so
    // bmObserveForView can also be called on posts added later by Live Post
    // Automation's drip-feed polling below -- those used to never get
    // observed at all, silently undercounting views on any page with Live
    // Post Automation turned on.
    var bmViewObserver = null;
    var bmViewsSeen = {};
    if ('IntersectionObserver' in window) {
        bmViewObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                var postId = entry.target.dataset.postId;
                if (!postId || bmViewsSeen[postId]) return;
                bmViewsSeen[postId] = true;
                fetch('/api/post-view.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: 'post_id=' + postId
                }).then(function (r) { return r.json(); }).then(function (d) {
                    if (!d.ok || !SHOW_VIEWS) return;
                    var counter = document.querySelector('.bm-post-footer[data-view-count-for="' + postId + '"] span');
                    if (counter) counter.textContent = d.view_count;
                });
                bmViewObserver.unobserve(entry.target);
            });
        }, { threshold: 0.5 });
    }
    function bmObserveForView(el) {
        if (bmViewObserver) bmViewObserver.observe(el);
    }

    document.querySelectorAll('.bm-post[data-post-id]').forEach(function (el) {
        bmObserveForAnim(el);
        bmObserveForView(el);
    });

    // Newest post is now at the bottom (chat order) -- land there, same as
    // opening a real chat app scrolls to the latest message.
    function scrollToLatestPost() {
        var thread = document.getElementById('posts');
        if (thread && thread.lastElementChild) {
            thread.lastElementChild.scrollIntoView({ block: 'end', behavior: 'smooth' });
        }
    }
    // true when the visitor is already looking at the newest part of the chat; only then may the page follow new posts
    function nearBottom() { return window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 260; }
    scrollToLatestPost();

    // Live countdown embedded in the admin's announcement banner (the
    // literal [countdown] token was already swapped server-side for this
    // span, with a server-computed initial value for the no-JS instant).
    var countdownEl = document.getElementById('bm-countdown');
    if (countdownEl && countdownEl.dataset.target) {
        var targetMs = new Date(countdownEl.dataset.target).getTime();
        var tick = function () {
            var diff = Math.max(0, targetMs - Date.now());
            if (diff <= 0) { countdownEl.textContent = 'started!'; return; }
            var s = Math.floor(diff / 1000);
            var d = Math.floor(s / 86400); s -= d * 86400;
            var h = Math.floor(s / 3600); s -= h * 3600;
            var m = Math.floor(s / 60); s -= m * 60;
            var parts = [];
            if (d > 0) parts.push(d + 'd');
            parts.push(h + 'h', m + 'm', s + 's');
            countdownEl.textContent = parts.join(' ');
        };
        tick();
        setInterval(tick, 1000);
    }

    // Live Post Automation: replays the page's existing posts sequentially
    // for a new visitor, showing a "typing..." indicator between reveals so
    // it reads as a live author sending updates rather than a static page.
    if (typeof DRIP_ACTIVE !== 'undefined' && DRIP_ACTIVE) {
        var thread = document.getElementById('posts');
        var typingEl = null;
        var remaining = typeof POSTS_REMAINING !== 'undefined' ? POSTS_REMAINING : 0;
        var pollTimeout = null;
        // Fallback cadence only -- used if the server ever omits
        // next_due_in_seconds (shouldn't normally happen). The real timing
        // comes from the server's own cumulative drip_delay_seconds math
        // below, not a fixed interval, so a post configured to drop at
        // (say) exactly 3 seconds actually drops at 3 seconds, not
        // whenever the next flat tick happens to land.
        var FALLBACK_POLL_DELAY_MS = 3000;

        function showTyping() {
            if (typingEl || !thread) return;
            var followTyping = nearBottom();
            typingEl = document.createElement('div');
            typingEl.className = 'bm-post';
            typingEl.innerHTML = '<div class="bm-typing"><span></span><span></span><span></span></div>';
            thread.appendChild(typingEl);
            if (followTyping) typingEl.scrollIntoView({ block: 'end', behavior: 'smooth' });
        }
        var outroConfigured = typeof ANIM_OUTRO !== 'undefined' && ANIM_OUTRO !== 'none';

        function hideTyping() {
            if (!typingEl) return;
            var el = typingEl;
            typingEl = null;
            if (outroConfigured) {
                var indicator = el.querySelector('.bm-typing');
                var outroMs = typeof ANIM_OUTRO_DURATION_MS !== 'undefined' ? ANIM_OUTRO_DURATION_MS : 300;
                if (indicator) {
                    indicator.style.setProperty('--bm-anim-duration', outroMs + 'ms');
                    indicator.classList.add('bm-anim-' + ANIM_OUTRO, 'bm-anim-outro');
                }
                setTimeout(function () { el.remove(); }, outroMs);
            } else {
                el.remove();
            }
        }
        function schedulePoll(delayMs) {
            clearTimeout(pollTimeout);
            // Clamped to a small minimum, never to the whole fallback delay --
            // a 0 or negative wait (clock-rounding right at the due instant)
            // should still check almost immediately, not stall a full cycle.
            pollTimeout = setTimeout(poll, Math.max(200, delayMs));
        }
        // Admin Preview/Test Console identifies itself via ?preview_visitor=
        // on THIS page's own URL (see inc/helpers.php's visitor_hash()) --
        // every poll to drip-feed.php must forward the exact same token, or
        // the poll silently becomes a brand-new anonymous visitor with no
        // page_visits history at all, and the server has nothing to compute
        // elapsed time from (drip-feed.php just gives up: done=true, empty
        // html) -- which is exactly what made the preview look like it
        // wasn't dripping post-by-post at all.
        var previewVisitorToken = new URLSearchParams(location.search).get('preview_visitor');
        var previewQueryParam = previewVisitorToken ? '&preview_visitor=' + encodeURIComponent(previewVisitorToken) : '';
        function poll() {
            fetch('/api/drip-feed.php?page_id=' + PAGE_ID + previewQueryParam)
                .then(function (r) { return r.json(); })
                .then(function (d) {
                    if (!d.ok) { hideTyping(); return; }
                    var added = [], wasNear = nearBottom();
                    (d.html || []).forEach(function (fragmentHtml) {
                        var wrapper = document.createElement('div');
                        wrapper.innerHTML = fragmentHtml;
                        var node = wrapper.firstElementChild;
                        if (node && !thread.querySelector('[data-post-id="' + node.dataset.postId + '"]')) {
                            hideTyping();
                            thread.appendChild(node);
                            added.push(node);
                        }
                    });
                    if (added.length) {
                        if (window.lucide) window.lucide.createIcons();
                        // Same scroll-into-view trigger as the initial render --
                        // a drip-fed post plays its animation only once the
                        // visitor actually sees it, not the instant it's appended.
                        added.forEach(bmObserveForAnim);
                        added.forEach(bmObserveForView);
                        // follow the new post only if the visitor was already at the bottom; otherwise leave the page where it is
                        // and tell them with a small pop-up at the top (see assets/js/live-extras.js)
                        if (wasNear) scrollToLatestPost();
                        else { try { window.dispatchEvent(new CustomEvent('bm:newposts', { detail: { nodes: added } })); } catch (e) {} }
                        remaining = Math.max(0, remaining - added.length);
                    }
                    if (d.done) {
                        hideTyping();
                        return;
                    }
                    showTyping();
                    // Strictly honor each post's own configured delay instead
                    // of a fixed poll interval -- the server already knows
                    // exactly how many seconds until the next post is due.
                    var waitMs = typeof d.next_due_in_seconds === 'number' ? d.next_due_in_seconds * 1000 : FALLBACK_POLL_DELAY_MS;
                    schedulePoll(waitMs);
                }).catch(function () {
                    // Network hiccup -- retry at the fallback cadence rather
                    // than silently giving up the rest of the drip sequence.
                    schedulePoll(FALLBACK_POLL_DELAY_MS);
                });
        }
        if (remaining > 0) { showTyping(); }
        // Check right away instead of blind-waiting a flat interval first --
        // the very first post is just as subject to its own configured
        // delay as every post after it.
        poll();
    }

    if (typeof HAS_AI !== 'undefined' && HAS_AI) {
        var aiToggle = document.getElementById('bmAskAiToggle');
        var aiPanel = document.getElementById('bmAskAiPanel');
        var aiClose = document.getElementById('bmAskAiClose');
        var aiThread = document.getElementById('bmAskAiThread');
        var aiForm = document.getElementById('bmAskAiForm');
        var aiInput = document.getElementById('bmAskAiInput');

        var aiHistory = [];
        var aiLastMe = null;
        (function () {
            var st = document.createElement('style');
            st.textContent = '.bm-ask-ai-msg.me{position:relative}.bm-ai-react{position:absolute;right:-6px;bottom:-12px;background:#fff;border-radius:999px;padding:1px 6px;font-size:15px;box-shadow:0 2px 6px rgba(0,0,0,.35);animation:bmAiPop .35s ease}'
                + '@keyframes bmAiPop{0%{transform:scale(0)}70%{transform:scale(1.3)}100%{transform:scale(1)}}'
                + '.bm-ai-sponsor{align-self:flex-start;max-width:85%;margin-top:-4px;padding:10px 12px;border-radius:12px;background:rgba(251,191,36,.12);border:1px solid rgba(251,191,36,.45);font-size:.85rem}'
                + '.bm-ai-sponsor a{display:inline-block;margin-top:8px;padding:8px 18px;border-radius:999px;background:linear-gradient(90deg,#f59e0b,#ec4899);color:#fff;font-weight:700;text-decoration:none;animation:bmAiPulse 2s infinite}'
                + '@keyframes bmAiPulse{0%,100%{box-shadow:0 0 0 0 rgba(236,72,153,.5)}50%{box-shadow:0 0 0 8px rgba(236,72,153,0)}}'
                + '.bm-ai-typing{opacity:.7}';
            document.head.appendChild(st);
        })();

        function aiAppend(text, who) {
            var msg = document.createElement('div');
            msg.className = 'bm-ask-ai-msg ' + who;
            msg.textContent = text;
            aiThread.appendChild(msg);
            aiThread.scrollTop = aiThread.scrollHeight;
            if (who === 'me') aiLastMe = msg;
            return msg;
        }

        function aiReact(emoji) {
            if (!emoji || !aiLastMe) return;
            var b = document.createElement('span');
            b.className = 'bm-ai-react';
            b.textContent = emoji;
            aiLastMe.appendChild(b);
        }

        function aiSponsor(sp) {
            if (!sp || !sp.url) return;
            var box = document.createElement('div');
            box.className = 'bm-ai-sponsor';
            var p = document.createElement('div');
            p.textContent = sp.plea || '';
            var a = document.createElement('a');
            a.href = sp.url;
            a.target = '_blank';
            a.rel = 'noopener';
            a.textContent = sp.label || 'Sponsor';
            box.appendChild(p);
            box.appendChild(a);
            aiThread.appendChild(box);
            aiThread.scrollTop = aiThread.scrollHeight;
        }

        if (aiToggle && aiPanel) {
            aiToggle.addEventListener('click', function () {
                aiPanel.style.display = aiPanel.style.display === 'none' ? 'flex' : 'none';
            });
        }
        if (aiClose && aiPanel) {
            aiClose.addEventListener('click', function () { aiPanel.style.display = 'none'; });
        }
        if (aiForm) {
            aiForm.addEventListener('submit', function (e) {
                e.preventDefault();
                var question = aiInput.value.trim();
                if (!question) return;
                var hist = JSON.stringify(aiHistory.slice(-8));
                aiAppend(question, 'me');
                aiInput.value = '';
                var typing = aiAppend('...', 'ai');
                typing.classList.add('bm-ai-typing');
                fetch('/api/ask-ai.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: 'page_id=' + PAGE_ID + '&question=' + encodeURIComponent(question) + '&history=' + encodeURIComponent(hist)
                }).then(function (r) { return r.json(); }).then(function (d) {
                    typing.remove();
                    var ans = d.ok ? d.answer : 'Something went wrong -- please try again.';
                    aiHistory.push({ r: 'me', t: question });
                    if (d.ok) {
                        aiReact(d.reaction);
                        aiAppend(ans, 'ai');
                        aiHistory.push({ r: 'ai', t: ans });
                        aiSponsor(d.sponsor);
                    } else {
                        aiAppend(ans, 'ai');
                    }
                }).catch(function () {
                    typing.remove();
                    aiAppend('Something went wrong -- please try again.', 'ai');
                });
            });
        }
    }

    function bmReact(postId, btn) {
        btn.disabled = true;
        fetch('/api/react.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'post_id=' + postId + '&emoji=' + encodeURIComponent(btn.dataset.emoji)
        }).then(function (r) { return r.json(); }).then(function (d) {
            btn.disabled = false;
            if (!d.ok) return;
            btn.classList.toggle('active', d.active);
            var countEl = btn.querySelector('.bm-reaction-count');
            if (countEl) countEl.textContent = d.count;
        }).catch(function () { btn.disabled = false; });
    }
    window.bmReact = bmReact;

    function bmVote(postId, optionId, btn) {
        btn.disabled = true;
        fetch('/api/vote.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'post_id=' + postId + '&option_id=' + optionId
        }).then(function (r) { return r.json(); }).then(function (d) {
            if (d.ok) location.reload();
            else alert(d.error || 'Could not record vote.');
        });
    }
    window.bmVote = bmVote;

    var commentForm = document.getElementById('commentForm');
    if (commentForm) {
        commentForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var form = e.target;
            var msg = document.getElementById('commentMsg');
            fetch('/api/comment.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'page_id=' + PAGE_ID + '&author_name=' + encodeURIComponent(form.author_name.value) + '&body=' + encodeURIComponent(form.body.value)
            }).then(function (r) { return r.json(); }).then(function (d) {
                if (d.ok) {
                    msg.textContent = 'Thanks! Your comment is awaiting approval.';
                    form.reset();
                } else {
                    msg.textContent = d.error || 'Something went wrong.';
                }
            });
        });
    }

    // Real-time reflection of newly approved comments -- polls the server for
    // genuinely approved rows, does not fabricate any activity.
    var lastCommentCount = document.querySelectorAll('#commentList .bm-comment').length;
    // Polling is gentle on purpose (this is what keeps the server fast with huge crowds): nothing is asked while the tab is
    // in the background, and a quiet blog is asked less and less often.
    function bmAdaptive(fn, baseMs, maxMs) {
        var delay = baseMs, timer = null;
        function run() {
            if (document.hidden) { timer = setTimeout(run, 30000); return; }
            Promise.resolve(fn()).then(function (changed) { delay = changed ? baseMs : Math.min(maxMs, Math.round(delay * 1.5)); }, function () { delay = Math.min(maxMs, delay * 2); })
                .then(function () { timer = setTimeout(run, delay); });
        }
        document.addEventListener('visibilitychange', function () { if (!document.hidden) { clearTimeout(timer); timer = setTimeout(run, 1500); } });
        timer = setTimeout(run, baseMs);
    }
    bmAdaptive(function () {
        return fetch('/api/comments-feed.php?page_id=' + PAGE_ID)
            .then(function (r) { return r.json(); })
            .then(function (d) {
                if (d.comments && d.comments.length !== lastCommentCount) {
                    lastCommentCount = d.comments.length;
                    var list = document.getElementById('commentList');
                    list.innerHTML = d.comments.map(function () {
                        return '<div class="bm-comment"><div class="author"></div><div class="body"></div></div>';
                    }).join('');
                    var nodes = list.querySelectorAll('.bm-comment');
                    d.comments.forEach(function (c, i) {
                        nodes[i].querySelector('.author').textContent = c.author_name;
                        nodes[i].querySelector('.body').textContent = c.body;
                    });
                    return true;
                }
                return false;
            });
    }, 20000, 90000);

    // Live poll % refresh (only when the blog actually has a poll).
    if (document.querySelector('.bm-poll')) bmAdaptive(function () {
        var jobs = [];
        document.querySelectorAll('.bm-poll').forEach(function (pollEl) {
            var postId = pollEl.dataset.postId;
            jobs.push(fetch('/api/poll-results.php?post_id=' + postId)
                .then(function (r) { return r.json(); })
                .then(function (d) {
                    if (!d.ok) return false;
                    var moved = false;
                    d.options.forEach(function (opt) {
                        var fill = pollEl.querySelector('.bm-poll-row[data-option-id="' + opt.id + '"] .bm-poll-fill');
                        if (fill) { var w = opt.pct + '%'; if (fill.style.width !== w) { moved = true; fill.style.width = w; } }
                    });
                    return moved;
                }).catch(function () { return false; }));
        });
        return Promise.all(jobs).then(function (r) { return r.indexOf(true) !== -1; });
    }, 30000, 120000);

    var reportToggle = document.getElementById('reportToggle');
    var reportForm = document.getElementById('reportForm');
    if (reportToggle && reportForm) {
        reportToggle.addEventListener('click', function () {
            reportForm.style.display = reportForm.style.display === 'none' ? 'block' : 'none';
        });
        reportForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var msg = document.getElementById('reportMsg');
            var reason = document.getElementById('reportReason').value.trim();
            if (!reason) { msg.textContent = 'Please describe the issue.'; return; }
            fetch('/api/report.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'page_id=' + PAGE_ID + '&reason=' + encodeURIComponent(reason)
            }).then(function (r) { return r.json(); }).then(function (d) {
                msg.textContent = d.ok ? 'Thanks, we\'ll review this.' : (d.error || 'Could not submit report.');
                if (d.ok) document.getElementById('reportReason').value = '';
            });
        });
    }

    // ---- WhatsApp-mode three-dot menu (admin/_nav.php-style dropdown, but
    // this is the visitor-facing one in the blog header) and its panels.
    // Only present at all when chat_style === 'whatsapp' (see blog.php),
    // so every selector here is guarded with a null check instead of
    // assuming these elements exist. ----
    var groupMenuToggle = document.getElementById('bmGroupMenuToggle');
    var groupMenu = document.getElementById('bmGroupMenu');
    if (groupMenuToggle && groupMenu) {
        groupMenuToggle.addEventListener('click', function (e) {
            e.stopPropagation();
            groupMenu.style.display = groupMenu.style.display === 'none' ? 'flex' : 'none';
        });
        document.addEventListener('click', function (e) {
            if (groupMenu.style.display !== 'none' && !groupMenu.contains(e.target) && e.target !== groupMenuToggle) {
                groupMenu.style.display = 'none';
            }
        });
    }

    function bmShowToast(text) {
        var toast = document.getElementById('bmGroupToast');
        if (!toast) return;
        toast.textContent = text;
        toast.style.display = 'block';
        clearTimeout(toast._bmHideTimer);
        toast._bmHideTimer = setTimeout(function () { toast.style.display = 'none'; }, 2200);
    }

    function bmOpenModal(id) {
        var modal = document.getElementById(id);
        if (modal) modal.style.display = 'flex';
    }
    document.querySelectorAll('.bm-group-modal-close').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var modal = btn.closest('.bm-group-modal');
            if (modal) modal.style.display = 'none';
        });
    });
    document.querySelectorAll('.bm-group-modal').forEach(function (modal) {
        modal.addEventListener('click', function (e) {
            if (e.target === modal) modal.style.display = 'none'; // click on the backdrop itself
        });
    });

    var pinnedBar = document.getElementById('bmPinnedBar');
    if (pinnedBar) {
        pinnedBar.addEventListener('click', function () {
            var target = document.querySelector('[data-post-id="' + pinnedBar.dataset.pinnedPostId + '"]');
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    }

    var groupInfoLoaded = false;
    var searchModalInitialized = false;

    function bmHandleMenuAction(action) {
        groupMenu.style.display = 'none';
        if (action === 'add-to-list') {
            var key = 'bm_saved_pages';
            var saved = JSON.parse(localStorage.getItem(key) || '[]');
            var idx = saved.indexOf(PAGE_SLUG);
            if (idx === -1) {
                saved.push(PAGE_SLUG);
                bmShowToast('Added to your list');
            } else {
                saved.splice(idx, 1);
                bmShowToast('Removed from your list');
            }
            localStorage.setItem(key, JSON.stringify(saved));
        } else if (action === 'group-info') {
            bmOpenModal('bmGroupInfoModal');
            if (!groupInfoLoaded) {
                groupInfoLoaded = true;
                fetch('/api/group-info.php?slug=' + encodeURIComponent(PAGE_SLUG))
                    .then(function (r) { return r.json(); })
                    .then(function (d) {
                        var body = document.getElementById('bmGroupInfoBody');
                        if (!body) return;
                        if (!d.ok) {
                            body.innerHTML = '<p style="color:var(--bm-muted,#9aa1bd);">Could not load group info.</p>';
                            return;
                        }
                        var esc = function (s) {
                            return String(s).replace(/[&<>"']/g, function (c) {
                                return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
                            });
                        };
                        var html = '<p style="font-weight:600;margin-bottom:10px;">' + d.total + ' unique visitor' + (d.total === 1 ? '' : 's') + '</p>';
                        if (!d.visitors.length) {
                            html += '<p style="color:var(--bm-muted,#9aa1bd);">No visits recorded yet.</p>';
                        } else {
                            html += '<div class="bm-group-info-list">';
                            d.visitors.forEach(function (v) {
                                html += '<div class="bm-group-info-row"><span>' + esc(v.label) + '</span><span class="bm-group-info-badges">'
                                    + (v.submitted_intake ? '<span class="bm-group-info-badge">Submitted intake form</span>' : '')
                                    + (v.installed_app ? '<span class="bm-group-info-badge">Installed app</span>' : '')
                                    + '</span></div>';
                            });
                            html += '</div>';
                        }
                        body.innerHTML = html;
                    }).catch(function () {
                        var body = document.getElementById('bmGroupInfoBody');
                        if (body) body.innerHTML = '<p style="color:var(--bm-muted,#9aa1bd);">Could not load group info.</p>';
                    });
            }
        } else if (action === 'group-media') {
            bmOpenModal('bmGroupMediaModal');
        } else if (action === 'search') {
            bmOpenModal('bmSearchModal');
            if (!searchModalInitialized) {
                searchModalInitialized = true;
                var input = document.getElementById('bmSearchInput');
                var countEl = document.getElementById('bmSearchResultCount');
                input.addEventListener('input', function () {
                    var q = input.value.trim().toLowerCase();
                    var posts = document.querySelectorAll('#posts .bm-post');
                    var matches = 0;
                    posts.forEach(function (post) {
                        var matched = q === '' || post.textContent.toLowerCase().indexOf(q) !== -1;
                        post.style.display = matched ? '' : 'none';
                        if (matched && q !== '') matches++;
                    });
                    countEl.textContent = q === '' ? '' : (matches + ' match' + (matches === 1 ? '' : 'es'));
                });
            }
            setTimeout(function () {
                var input = document.getElementById('bmSearchInput');
                if (input) input.focus();
            }, 50);
        } else if (action === 'mute') {
            fetch('/api/mute-toggle.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slug: PAGE_SLUG })
            }).then(function (r) { return r.json(); }).then(function (d) {
                if (!d.ok) return;
                IS_MUTED = d.muted;
                var icon = document.getElementById('bmMuteMenuItemIcon');
                var label = document.getElementById('bmMuteMenuItemLabel');
                if (icon) icon.setAttribute('data-lucide', d.muted ? 'bell' : 'bell-off');
                if (label) label.textContent = d.muted ? 'Unmute notifications' : 'Mute notifications';
                if (window.lucide) window.lucide.createIcons();
                bmShowToast(d.muted ? 'Notifications muted' : 'Notifications unmuted');
            });
        } else if (action === 'chat-theme') {
            bmOpenModal('bmChatThemeModal');
        } else if (action === 'more') {
            var reportToggleBtn = document.getElementById('reportToggle');
            if (reportToggleBtn) {
                reportToggleBtn.click();
                reportToggleBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }

    if (groupMenu) {
        groupMenu.querySelectorAll('.bm-group-menu-item').forEach(function (item) {
            item.addEventListener('click', function () { bmHandleMenuAction(item.dataset.action); });
        });
    }

    // Chat theme: purely cosmetic, visitor-local only (localStorage keyed
    // per-page since the same browser might follow several different
    // blogs) -- sets a CSS custom property the thread's background reads,
    // never touches the admin's own theme_color or anything server-side.
    var THEME_SWATCHES = {
        default: '#0B0F1A', warm: '#2b1a12', cool: '#0d1b2b', forest: '#10201a', plum: '#1f1230',
    };
    function bmApplyChatTheme(themeId) {
        var color = THEME_SWATCHES[themeId] || THEME_SWATCHES.default;
        document.documentElement.style.setProperty('--bm-chat-theme-bg', color);
    }
    var savedTheme = localStorage.getItem('bm_chat_theme_' + PAGE_SLUG);
    if (savedTheme) bmApplyChatTheme(savedTheme);
    document.querySelectorAll('.bm-chat-theme-swatch').forEach(function (swatch) {
        swatch.addEventListener('click', function () {
            var themeId = swatch.dataset.theme;
            bmApplyChatTheme(themeId);
            localStorage.setItem('bm_chat_theme_' + PAGE_SLUG, themeId);
            document.getElementById('bmChatThemeModal').style.display = 'none';
            bmShowToast('Chat theme updated');
        });
    });
})();
