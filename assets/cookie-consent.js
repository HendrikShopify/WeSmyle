(() => {
    const METHODS = {
        analytics: 'analyticsProcessingAllowed',
        marketing: 'marketingAllowed',
        preferences: 'preferencesProcessingAllowed',
        sale_of_data: 'saleOfDataAllowed',
    };
    const KEYS = Object.keys(METHODS);
    const subscribers = [];
    let apiReady = false;
    let resolveReady;
    let rejectReady;

    const ready = new Promise((resolve, reject) => {
        resolveReady = resolve;
        rejectReady = reject;
    });

    ready.catch(() => { });

    const rootEl = () => document.querySelector('cookie-consent');

    const privacy = () => {
        const api = window.Shopify && window.Shopify.customerPrivacy;
        return api && typeof api.setTrackingConsent === 'function' ? api : null;
    };

    const warn = (error) => console.warn('[cookie-consent]', error);
    const inEditor = () => Boolean(window.Shopify && window.Shopify.designMode);

    function isAllowed(category) {
        const method = METHODS[category];
        const api = privacy();
        return Boolean(method && api && typeof api[method] === 'function' && api[method]());
    }

    function activateScripts(category) {
        document
            .querySelectorAll('script[type="text/plain"][data-consent="' + category + '"]')
            .forEach((node) => {
                if (node.dataset.consentActivated) return;

                const script = document.createElement('script');
                Array.from(node.attributes).forEach((attr) => {
                    if (attr.name === 'type' || attr.name === 'data-consent' || attr.name === 'data-src') return;
                    script.setAttribute(attr.name, attr.value);
                });

                if (node.dataset.src) script.src = node.dataset.src;
                else script.text = node.textContent;

                node.dataset.consentActivated = 'true';
                node.replaceWith(script);
            });
    }

    function notify() {
        // The theme editor is the merchant, not a shopper.
        if (inEditor()) return;

        subscribers.forEach((entry) => {
            if (entry.done || !isAllowed(entry.category)) return;
            entry.done = true;
            try {
                entry.callback();
            } catch (error) {
                warn(error);
            }
        });

        KEYS.forEach((category) => {
            if (isAllowed(category)) activateScripts(category);
        });
    }

    function onAllowed(category, callback) {
        if (!METHODS[category] || typeof callback !== 'function') return;

        const entry = { category: category, callback: callback, done: false };
        subscribers.push(entry);

        if (apiReady && isAllowed(category)) {
            entry.done = true;
            try {
                callback();
            } catch (error) {
                warn(error);
            }
        }
    }

    function boot() {
        const el = rootEl();

        if (boot.done) {
            if (apiReady && el) onReady(el);
            return;
        }

        boot.done = true;

        const finish = () => {
            if (!privacy()) throw new Error('customerPrivacy missing');
            apiReady = true;
            resolveReady(privacy());
            document.addEventListener('visitorConsentCollected', notify);
            const current = rootEl();
            if (current) onReady(current);
        };

        const fail = (error) => {
            // Banner stays hidden. Gated scripts stay inert.
            warn(error);
            rejectReady(error);
        };

        if (privacy()) {
            try {
                finish();
            } catch (error) {
                fail(error);
            }
            return;
        }

        const started = Date.now();
        const wait = () => {
            if (window.Shopify && typeof window.Shopify.loadFeatures === 'function') {
                window.Shopify.loadFeatures(
                    [{ name: 'consent-tracking-api', version: '0.1' }],
                    (error) => {
                        if (error) fail(error);
                        else {
                            try {
                                finish();
                            } catch (loadError) {
                                fail(loadError);
                            }
                        }
                    }
                );
                return;
            }

            if (Date.now() - started > 4000) {
                fail(new Error('loadFeatures missing'));
                return;
            }

            window.setTimeout(wait, 50);
        };

        wait();
    }

    function hashIs(node, hash) {
        if (!node || node.tagName !== 'A') return false;
        const href = node.getAttribute('href') || '';
        return href === hash || href.endsWith(hash);
    }

    function banner(el) {
        return el.querySelector('[data-banner]');
    }

    function bannerOpen(el) {
        const node = banner(el);
        return Boolean(node && !node.hidden);
    }

    function lockScroll(el) {
        el.setAttribute('data-scroll-lock', 'true');
    }

    function unlockScroll(el, force) {
        if (!force && (bannerOpen(el) || el._overlay)) return;
        el.setAttribute('data-scroll-lock', 'false');
    }

    function showBanner(el) {
        const node = banner(el);
        if (!node) return;
        node.hidden = false;
        lockScroll(el);
        if (el._overlay) return;
        inertPage(el);
        trapIn(node);
    }

    function hideBanner(el) {
        const node = banner(el);
        if (!node) return;
        node.hidden = true;
        if (!el._overlay) {
            clearInert(el);
            removeTrapFocus();
        }
        unlockScroll(el);
    }

    function trapIn(node, opener) {
        if (!node || typeof trapFocus !== 'function') return;
        const inside = opener && node.contains(opener);
        const target = inside ? opener : node.querySelector('[data-focus]') || node;
        trapFocus(node, target);
    }

    function clearInert(el) {
        (el._inerted || []).forEach((node) => node.removeAttribute('inert'));
        el._inerted = [];
    }

    function inertPage(el) {
        clearInert(el);
        el._inerted = [];

        Array.from(document.body.children).forEach((node) => {
            if (node === el || node.contains(el) || node.hasAttribute('inert')) return;
            node.setAttribute('inert', '');
            el._inerted.push(node);
        });
    }

    function release(el) {
        clearInert(el);
        if (bannerOpen(el) && !el._overlay) inertPage(el);
        unlockScroll(el);
    }

    function hold(el) {
        inertPage(el);

        const bar = banner(el);
        if (bar && !bar.hasAttribute('inert')) {
            bar.setAttribute('inert', '');
            el._inerted.push(bar);
        }

        lockScroll(el);
    }

    function closeOverlay(el) {
        if (!el._overlay) return;
        el._overlay.hidden = true;
        el._overlay = null;
        release(el);
        const opener = el._opener;
        if (bannerOpen(el)) {
            trapIn(banner(el), opener);
            return;
        }
        const back = opener && opener.isConnected && !opener.closest('[hidden]') ? opener : null;
        if (typeof removeTrapFocus === 'function') removeTrapFocus(back);
    }

    function openOverlay(el, name, opener) {
        const overlay = el.querySelector('[data-overlay="' + name + '"]');
        if (!overlay) return;

        if (el._overlay && el._overlay !== overlay) el._overlay.hidden = true;

        el._opener = opener || document.activeElement;
        overlay.hidden = false;
        el._overlay = overlay;
        hold(el);
        trapIn(overlay);
    }

    // 'yes' is opted in. 'no' and '' (no choice yet) stay unchecked.
    function syncToggles(el) {
        const api = el._api;
        const consent =
            api && typeof api.currentVisitorConsent === 'function' ? api.currentVisitorConsent() || {} : {};

        el.querySelectorAll('[data-consent-toggle]').forEach((input) => {
            input.checked = consent[input.name] === 'yes';
        });
    }

    function openPreferences(el, opener) {
        syncToggles(el);
        openOverlay(el, 'preferences', opener);
    }

    function checked(el, name) {
        const input = el.querySelector('[data-consent-toggle][name="' + name + '"]');
        return Boolean(input && input.checked);
    }

    function setBusy(el, on) {
        el._busy = on;
        el.querySelectorAll('button').forEach((button) => {
            button.disabled = on;
        });
    }

    function hasAnswer(api) {
        if (!api || typeof api.currentVisitorConsent !== 'function') return false;
        let consent = {};
        try {
            consent = api.currentVisitorConsent() || {};
        } catch (error) {
            return false;
        }
        return ['analytics', 'marketing', 'preferences'].some((key) => {
            return consent[key] === 'yes' || consent[key] === 'no';
        });
    }

    function storefrontToken() {
        try {
            const node = document.getElementById('shopify-features');
            if (!node || !node.textContent) return '';
            return JSON.parse(node.textContent).accessToken || '';
        } catch (error) {
            return '';
        }
    }

    function trackingPayload(consent) {
        const payload = Object.assign({}, consent);
        const shop = window.Shopify && window.Shopify.shop;
        const token = storefrontToken();
        if (shop) {
            payload.checkoutRootDomain = shop;
            payload.storefrontRootDomain = shop;
        }
        if (token) {
            payload.storefrontAccessToken = token;
            payload.headlessStorefront = true;
        }
        return payload;
    }

    function storeConsentCookie(result) {
        const cookies = result && result.data && result.data.consentManagement && result.data.consentManagement.cookies;
        const value = cookies && cookies.trackingConsentCookie;
        if (!value) return;
        document.cookie = '_tracking_consent=' + value + '; path=/; max-age=31536000; SameSite=Lax';
    }

    function losesAccess(before, consent) {
        return KEYS.some((key) => {
            if (!Object.prototype.hasOwnProperty.call(consent, key)) return false;
            return before[key] === true && consent[key] === false;
        });
    }

    function save(el, consent) {
        if (el._busy) return;

        // Preview clicks must never write a consent record.
        if (el._editor) {
            hideBanner(el);
            closeOverlay(el);
            return;
        }

        setBusy(el, true);
        let timer;

        ready
            .then(() => {
                el._api = privacy();
                if (!el._api) throw new Error('customerPrivacy missing');

                const before = {};
                KEYS.forEach((key) => {
                    before[key] = isAllowed(key);
                });

                timer = window.setTimeout(() => {
                    setBusy(el, false);
                    warn('save timeout');
                }, 8000);

                el._api.setTrackingConsent(trackingPayload(consent), (error, result) => {
                    window.clearTimeout(timer);
                    setBusy(el, false);

                    if (error) {
                        warn(error.error || error);
                        return;
                    }

                    storeConsentCookie(result);

                    // A script that already ran cannot be unloaded.
                    if (losesAccess(before, consent)) {
                        window.location.reload();
                        return;
                    }

                    hideBanner(el);
                    closeOverlay(el);
                    notify();
                });
            })
            .catch((error) => {
                window.clearTimeout(timer);
                setBusy(el, false);
                warn(error);
            });
    }

    function onAction(el, event) {
        const button = event.target.closest && event.target.closest('[data-action]');
        if (!button || !el.contains(button)) return;

        const action = button.dataset.action;
        const all = (value) => ({ analytics: value, marketing: value, preferences: value });

        if (action === 'preferences') openPreferences(el, button);
        else if (action === 'accept') save(el, all(true));
        else if (action === 'reject') save(el, all(false));
        else if (action === 'save') {
            save(el, {
                analytics: checked(el, 'analytics'),
                marketing: checked(el, 'marketing'),
                preferences: checked(el, 'preferences'),
            });
        } else if (action === 'opt-out-confirm') save(el, { sale_of_data: false });
        else if (action === 'close' || action === 'opt-out-cancel') closeOverlay(el);
    }

    function onKeyDown(el, event) {
        if (!el._overlay || event.code.toUpperCase() !== 'ESCAPE') return;
        event.preventDefault();
        closeOverlay(el);
    }

    function onDocumentClick(event) {
        const el = rootEl();
        if (!el) return;

        const target = event.target instanceof Element ? event.target : event.target.parentElement;
        if (!target || target.closest('cookie-consent [data-action]')) return;

        const preferences = target.closest('[data-cookie-preferences]');
        const optOut = target.closest('[data-cookie-do-not-sell]');
        const link = target.closest('a[href]');
        const openPrefs = preferences || (link && hashIs(link, '#cookie-preferences'));
        const openOptOut = optOut || (link && hashIs(link, '#do-not-sell'));

        if (!openPrefs && !openOptOut) return;

        event.preventDefault();
        if (openOptOut) openOverlay(el, 'opt-out', openOptOut);
        else openPreferences(el, openPrefs);
    }

    function updateOptOutLinks(el) {
        let show = el._editor;

        if (!show && el._api && typeof el._api.saleOfDataRegion === 'function') {
            try {
                show = el._api.saleOfDataRegion() === true;
            } catch (error) {
                show = false;
            }
        }

        document.querySelectorAll('[data-cookie-do-not-sell], a[href$="#do-not-sell"]').forEach((node) => {
            node.toggleAttribute('data-cc-hidden', !show);
        });
    }

    function onReady(el) {
        el._api = privacy();
        updateOptOutLinks(el);

        if (!el._editor && el._api && !hasAnswer(el._api)) {
            try {
                if (el._api.shouldShowBanner() === true) showBanner(el);
            } catch (error) {
                warn(error);
            }
        }

        if (el._overlay && el._overlay.dataset.overlay === 'preferences') syncToggles(el);
        notify();
    }

    function preview(el) {
        showBanner(el);
        if (el.dataset.previewPreferences === 'true') openPreferences(el);
        else closeOverlay(el);
    }

    function onEditor(el, event, selected) {
        if (!event.detail || event.detail.sectionId !== el.dataset.sectionId) return;

        if (selected) {
            document.documentElement.setAttribute('data-cc-editor-selected', '');
            preview(el);
            return;
        }

        document.documentElement.removeAttribute('data-cc-editor-selected');
        hideBanner(el);
        closeOverlay(el);
    }

    function mount(el) {
        if (el.dataset.bound === 'true') return;
        el.dataset.bound = 'true';
        el._editor = inEditor();
        el._busy = false;
        el._overlay = null;
        el._inerted = [];

        el._onAction = (event) => onAction(el, event);
        el._onKeyDown = (event) => onKeyDown(el, event);
        el._onSelect = (event) => onEditor(el, event, true);
        el._onDeselect = (event) => onEditor(el, event, false);

        el.listen(el, 'click', el._onAction);
        el.listen(el, 'keydown', el._onKeyDown);

        if (el._editor) {
            el.listen(document, 'shopify:section:select', el._onSelect);
            el.listen(document, 'shopify:section:deselect', el._onDeselect);
            if (document.documentElement.hasAttribute('data-cc-editor-selected')) preview(el);
        }

        boot();
    }

    function unmount(el) {
        el.removeEventListener('click', el._onAction);
        el.removeEventListener('keydown', el._onKeyDown);
        document.removeEventListener('shopify:section:select', el._onSelect);
        document.removeEventListener('shopify:section:deselect', el._onDeselect);
        delete el.dataset.bound;

        const replacement = rootEl();
        clearInert(el);
        unlockScroll(el, true);
        if (typeof removeTrapFocus === 'function') removeTrapFocus();

        if (
            replacement &&
            replacement !== el &&
            document.documentElement.hasAttribute('data-cc-editor-selected')
        ) {
            preview(replacement);
        }
    }

    document.querySelectorAll('[data-cookie-do-not-sell], a[href$="#do-not-sell"]').forEach((node) => {
        node.setAttribute('data-cc-hidden', '');
    });

    if (!window.__cookieConsentClicks) {
        window.__cookieConsentClicks = true;
        document.addEventListener('click', onDocumentClick, true);
    }

    window.CookieConsent = {
        ready: ready,
        isAllowed: isAllowed,
        onAllowed: onAllowed,
        openPreferences(opener) {
            const el = rootEl();
            if (el) openPreferences(el, opener);
        },
    };

    if (!customElements.get('cookie-consent')) {
        customElements.define(
            'cookie-consent',
            class extends BaseComponent {
                init() {
                    mount(this);
                }

                disconnectedCallback() {
                    unmount(this);
                    super.disconnectedCallback();
                }
            }
        );
    }
})();
