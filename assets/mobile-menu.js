function inertOutside(el) {
    const changed = [];
    let node = el;

    while (node && node.parentElement && node !== document.body) {
        const parent = node.parentElement;

        for (const sibling of parent.children) {
            if (sibling === node) continue;
            if (sibling.hasAttribute('data-inert-ignore')) continue;
            if (sibling.inert) continue;
            sibling.inert = true;
            changed.push(sibling);
        }

        node = parent;
    }

    return function release() {
        changed.forEach((sibling) => {
            sibling.inert = false;
        });
    };
}

function trapTab(event, container) {
    if (event.key !== 'Tab' || typeof getFocusableElements !== 'function') return;

    const items = getFocusableElements(container).filter((el) => el.checkVisibility());
    if (!items.length) {
        event.preventDefault();
        return;
    }

    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
    }
}

class MobileMenu extends BaseComponent {
    constructor() {
        super();
        this.isOpen = false;
        this.returnFocusTo = null;
        this.releaseInert = null;
        this.openController = null;
        this.removeOpenAbort = null;
        this.timeline = null;

        this.onClick = this.onClick.bind(this);
        this.onPanelKeydown = this.onPanelKeydown.bind(this);
        this.onBreakpoint = this.onBreakpoint.bind(this);
        this.onPageShow = this.onPageShow.bind(this);
    }

    init() {
        this.opener = this.$('[data-mobile-menu-open]');
        this.panel = this.$('[data-mobile-menu-panel]');
        this.drawer = this.$('[data-mobile-menu-drawer]');
        this.backdrop = this.$('[data-mobile-menu-backdrop]');
        this.desktopMedia = window.matchMedia(this.dataset.desktopQuery || '(min-width: 1024px)');
        this.createTimeline();

        this.listen(this, 'click', this.onClick);
        if (this.opener) this.listen(this.opener, 'click', this.onClick);
        if (this.panel) this.listen(this.panel, 'click', this.onClick);
        this.listen(this.desktopMedia, 'change', this.onBreakpoint);
        this.listen(window, 'pageshow', this.onPageShow);
    }

    disconnectedCallback() {
        this.timeline?.kill();
        this.timeline = null;
        if (this.isOpen) this.close({ restoreFocus: false, immediate: true });
        super.disconnectedCallback();
    }

    get prefersReducedMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    createTimeline() {
        if (typeof gsap === 'undefined' || !this.drawer || !this.backdrop) return;
        this.timeline?.kill();
        this.timeline = gsap.timeline({
            paused: true,
            defaults: { duration: 0.6, ease: 'smooth' },
            onReverseComplete: () => {
                if (this.isOpen || !this.panel) return;
                this.panel.setAttribute('data-state', 'closed');
                this.panel.style.pointerEvents = '';
            },
        });
        this.timeline
            .fromTo(this.drawer, { xPercent: -100 }, { xPercent: 0 }, 0)
            .fromTo(this.backdrop, { autoAlpha: 0 }, { autoAlpha: 1 }, 0);
    }

    onClick(event) {
        const opener = event.target.closest('[data-mobile-menu-open]');
        if (opener && this.contains(opener)) {
            this.open(opener);
            return;
        }

        const drillOpen = event.target.closest('[data-drill-open]');
        if (drillOpen && this.contains(drillOpen)) {
            this.drillTo(drillOpen.dataset.drillOpen, drillOpen);
            return;
        }

        if (event.target.closest('[data-drill-back]')) {
            this.drillBack();
            return;
        }

        if (event.target.closest('[data-mobile-menu-close]')) {
            this.close();
            return;
        }

        if (event.target.closest('[data-mobile-menu-backdrop]')) {
            this.close();
            return;
        }

        const hashLink = event.target.closest('a[href^="#"]');
        if (hashLink && this.contains(hashLink)) this.close();
    }

    /* Drill-down style: each top-level category is its own panel inside the same scroll area. */
    drillTo(id, opener) {
        const target = document.getElementById(id);
        const root = this.$('[data-drill-root]');
        if (!target || !root) return;
        this.drillOpener = opener;
        root.hidden = true;
        this.$$('[data-drill-panel]').forEach((panel) => (panel.hidden = panel !== target));
        target.closest('nav')?.scrollTo({ top: 0 });
        target.querySelector('[data-drill-back]')?.focus({ preventScroll: true });
    }

    drillBack() {
        const root = this.$('[data-drill-root]');
        if (!root) return;
        this.$$('[data-drill-panel]').forEach((panel) => (panel.hidden = true));
        root.hidden = false;
        this.drillOpener?.focus({ preventScroll: true });
        this.drillOpener = null;
    }

    resetDrill() {
        const root = this.$('[data-drill-root]');
        if (!root || root.hidden === false) return;
        this.$$('[data-drill-panel]').forEach((panel) => (panel.hidden = true));
        root.hidden = false;
        this.drillOpener = null;
    }

    onPanelKeydown(event) {
        if (event.key === 'Escape') {
            this.close();
            return;
        }

        trapTab(event, this.panel);
    }

    onBreakpoint() {
        if (this.desktopMedia.matches) this.close();
    }

    onPageShow(event) {
        if (event.persisted) this.close({ silent: true, immediate: true });
    }

    open(opener) {
        if (this.isOpen || !this.panel) return;

        this.returnFocusTo = opener || this.opener;
        this.isOpen = true;
        this.panel.setAttribute('data-state', 'open');
        if (this.opener) this.opener.setAttribute('aria-expanded', 'true');
        this.setAttribute('data-scroll-lock', 'true');
        this.releaseInert = inertOutside(this.panel);
        if (this.panel) this.panel.style.pointerEvents = '';
        this.$('[data-mobile-menu-close]')?.focus({ preventScroll: true });
        this.playIn();
        this.bindWhileOpen();
        this.emit('mobile-menu:open', { source: this });
    }

    close({ restoreFocus = true, silent = false, immediate = false } = {}) {
        if (!this.isOpen) return;

        this.isOpen = false;
        this.unbindWhileOpen();
        this.releaseInert?.();
        this.releaseInert = null;
        this.setAttribute('data-scroll-lock', 'false');
        if (this.opener) this.opener.setAttribute('aria-expanded', 'false');
        this.playOut(immediate || silent);
        this.resetDrill();

        if (!silent && restoreFocus) this.restoreFocus();
        if (!silent) this.emit('mobile-menu:close', { source: this });
    }

    playIn() {
        if (!this.timeline || this.prefersReducedMotion) {
            this.timeline?.progress(1);
            return;
        }
        if (this.timeline.progress() === 0) this.timeline.restart();
        else this.timeline.play();
    }

    playOut(immediate) {
        if (!this.panel) return;
        if (immediate || this.prefersReducedMotion || !this.timeline) {
            this.timeline?.pause(0);
            if (typeof gsap !== 'undefined') {
                if (this.drawer) gsap.set(this.drawer, { clearProps: 'transform' });
                if (this.backdrop) gsap.set(this.backdrop, { clearProps: 'opacity,visibility' });
            }
            this.panel.setAttribute('data-state', 'closed');
            this.panel.style.pointerEvents = '';
            return;
        }

        this.panel.style.pointerEvents = 'none';
        if (this.timeline.progress() === 0) {
            this.panel.setAttribute('data-state', 'closed');
            this.panel.style.pointerEvents = '';
            return;
        }
        this.timeline.reverse();
    }

    restoreFocus() {
        const opener = this.returnFocusTo;
        const openerVisible = opener && opener.isConnected && opener.checkVisibility();
        const target = openerVisible ? opener : document.querySelector('[data-focus-fallback]');
        if (target && target.isConnected) target.focus();
    }

    bindWhileOpen() {
        if (this.openController || !this.panel) return;

        const controller = new AbortController();
        const parent = this.abortController.signal;
        const abortChild = () => controller.abort();

        this.openController = controller;

        if (parent.aborted) {
            controller.abort();
            return;
        }

        parent.addEventListener('abort', abortChild, { once: true });
        this.removeOpenAbort = () => parent.removeEventListener('abort', abortChild);
        this.panel.addEventListener('keydown', this.onPanelKeydown, { signal: controller.signal });
    }

    unbindWhileOpen() {
        this.removeOpenAbort?.();
        this.removeOpenAbort = null;
        this.openController?.abort();
        this.openController = null;
    }
}

function define() {
    if (!customElements.get('mobile-menu')) {
        customElements.define('mobile-menu', MobileMenu);
    }
}

define();
