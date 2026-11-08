(function () {
    if (!('serviceWorker' in navigator)) return;

    var scope = './';
    var swUrl = scope + 'sw.js';

    navigator.serviceWorker.register(swUrl, { scope: scope }).catch(function (err) {
        // Visible during dev instead of a silent no-op -- a failed SW
        // registration is exactly why the install prompt would never fire.
        console.warn('bizmeet: service worker registration failed', err);
    });

    function urlBase64ToUint8Array(base64String) {
        var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        var rawData = atob(base64);
        var outputArray = new Uint8Array(rawData.length);
        for (var i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
        return outputArray;
    }

    // Records a real install, independent of whether this device ever also
    // opts into push notifications -- see api/pwa-install.php for why this
    // had to be split out from push_subscriptions (that table only ever
    // counted visitors who ALSO granted notification permission in the same
    // flow, undercounting every iOS "Add to Home Screen" install and every
    // visitor who installed but denied/dismissed the notification prompt).
    // Safe to call more than once per device -- deduped server-side.
    function recordInstall() {
        fetch('/api/pwa-install.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug: PAGE_SLUG })
        }).catch(function () {});
    }

    function subscribeToPush(registration) {
        if (!('PushManager' in window)) return;
        fetch('/api/vapid-public-key.php').then(function (r) { return r.text(); }).then(function (publicKey) {
            return registration.pushManager.getSubscription().then(function (existing) {
                if (existing) return existing;
                return registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(publicKey)
                });
            });
        }).then(function (subscription) {
            if (!subscription) return;
            var json = subscription.toJSON();
            json.slug = PAGE_SLUG;
            return fetch('/api/push-subscribe.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(json)
            });
        }).catch(function (err) {
            console.warn('bizmeet: push subscribe failed', err);
        });
    }

    // Real spec-compliant install flow: the native prompt can only be shown
    // from a user gesture, so `beforeinstallprompt` is captured whenever the
    // browser decides to fire it, but the modal itself always appears on a
    // fixed 3s timer (per-blog, once per browser session) regardless of
    // whether that event has arrived yet -- Chrome's engagement heuristics
    // mean it can arrive late or not at all, and the user asked for a
    // predictable "3 seconds after landing" popup, not one gated on an
    // unpredictable browser event.
    var deferredPrompt = null;
    var modal = document.getElementById('pwaInstallModal');
    var installBtn = document.getElementById('pwaInstallBtn');
    var toast = document.getElementById('pwaAlreadyInstalledToast');
    var shownKey = 'bm_pwa_shown_' + PAGE_SLUG;

    // Standard way to detect an already-installed/running-standalone PWA:
    // display-mode:standalone covers Chrome/Edge/most browsers;
    // navigator.standalone is the older iOS-Safari-specific equivalent.
    var isInstalled = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;

    if (isInstalled) {
        // Backstop for every install path that never fires appinstalled at
        // all -- iOS Safari's "Add to Home Screen" has no such event, so
        // this standalone-mode check on a later visit is the only reliable
        // way that install ever gets counted. Idempotent (deduped
        // server-side), so firing on every single standalone visit is fine.
        recordInstall();
        // Self-healing re-subscribe: a visitor who already granted
        // notification permission (in this or an earlier session) gets
        // re-subscribed on every visit instead of relying solely on the
        // one-time moment right after install -- covers a subscription that
        // silently expired, got cleared, or was never actually created
        // despite permission already being granted.
        if ('Notification' in window && Notification.permission === 'granted') {
            navigator.serviceWorker.ready.then(subscribeToPush);
        }
    }

    // Fires right after a successful native-prompt install (Chrome/Edge/
    // Android), regardless of whether notification permission is later
    // granted, denied, or dismissed -- the one reliable "they really
    // installed it" signal for that flow, independent of the push opt-in
    // outcome handled separately in doInstall() below.
    window.addEventListener('appinstalled', recordInstall);

    window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault();
        deferredPrompt = e;
        if (installBtn) {
            installBtn.textContent = 'Add as an App';
            installBtn.disabled = false;
        }
    });

    function openModal() {
        if (sessionStorage.getItem(shownKey)) return;
        sessionStorage.setItem(shownKey, '1');
        if (isInstalled) {
            if (toast) toast.style.display = 'flex';
        } else if (modal) {
            modal.classList.add('modal-open');
        }
    }

    // Admin-configurable (pages.pwa_auto_prompt_enabled, see admin/page-edit.php):
    // off means this auto popup never fires, and the only way to install is
    // a post's own "Download as App" button (bmTriggerPwaInstall below).
    // Undefined (pages/templates that don't set the var at all) defaults to
    // the original always-on behavior.
    var autoPromptEnabled = (typeof PWA_AUTO_PROMPT === 'undefined') || PWA_AUTO_PROMPT;
    if ((modal || toast) && autoPromptEnabled) {
        setTimeout(openModal, 3000);
    }

    var dismissBtn = document.getElementById('pwaDismiss');
    if (dismissBtn) dismissBtn.addEventListener('click', function () {
        if (modal) modal.classList.remove('modal-open');
    });

    var toastDismissBtn = document.getElementById('pwaToastDismiss');
    if (toastDismissBtn) toastDismissBtn.addEventListener('click', function () {
        if (toast) toast.style.display = 'none';
    });

    function doInstall() {
        if (modal) modal.classList.remove('modal-open');
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function (choice) {
            deferredPrompt = null;
            if (choice.outcome === 'accepted' && 'Notification' in window) {
                Notification.requestPermission().then(function (perm) {
                    if (perm === 'granted') {
                        navigator.serviceWorker.ready.then(subscribeToPush);
                    }
                });
            }
        });
    }

    // Shared by the automatic modal's own button AND any per-post "Download
    // as App" button an admin added (inc/post_render.php, action=pwa_install,
    // calling window.bmTriggerPwaInstall()) -- btnEl is optional so a post
    // button (which has no "Waiting for browser..." text slot of its own)
    // can still call this and just fall back to the alert() below.
    function triggerInstall(btnEl) {
        if (deferredPrompt) {
            doInstall();
            return;
        }
        // The browser hasn't handed us the native event yet (or this
        // browser/OS doesn't support it, e.g. iOS Safari) -- rather than
        // silently doing nothing, give the visitor real next steps and
        // still fire the native prompt the instant it does arrive.
        if (btnEl) {
            btnEl.disabled = true;
            btnEl.textContent = 'Waiting for browser...';
        }
        var waited = false;
        window.addEventListener('beforeinstallprompt', function onReady() {
            window.removeEventListener('beforeinstallprompt', onReady);
            waited = true;
            doInstall();
        });
        setTimeout(function () {
            if (waited) return;
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.textContent = 'Add as an App';
            }
            alert('Your browser hasn\'t offered an install option for this page yet. On iOS Safari, use Share → Add to Home Screen. On desktop Chrome, look for the install icon in the address bar.');
        }, 4000);
    }

    if (installBtn) installBtn.addEventListener('click', function () { triggerInstall(installBtn); });
    window.bmTriggerPwaInstall = function () { triggerInstall(null); };

    // Used by the "Turn on call alerts" button (assets/js/pwa-call.js). iOS only
    // allows the permission prompt from a tap inside the installed app.
    window.bmEnableNotifications = function () {
        if (!('Notification' in window) || !('serviceWorker' in navigator)) return Promise.resolve('unsupported');
        return Notification.requestPermission().then(function (perm) {
            if (perm !== 'granted') return perm;
            return navigator.serviceWorker.ready.then(subscribeToPush).then(function () { return perm; });
        });
    };
})();
