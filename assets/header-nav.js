class HeaderNav extends BaseComponent {
    constructor() {
        super();
        this.openItem = null;
        this.openedBy = null;
        this.closeTimer = null;
        this.hoverSuppressed = null;
        this.lastPointerType = null;
        this.pointerGesture = false;
        this.openController = null;
        this.removeOpenAbort = null;
        this.timelines = new Map();
        this.closingItem = null;

        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerEnter = this.onPointerEnter.bind(this);
        this.onPointerLeave = this.onPointerLeave.bind(this);
        this.onClick = this.onClick.bind(this);
        this.onKeydown = this.onKeydown.bind(this);
        this.onFocusIn = this.onFocusIn.bind(this);
        this.onFocusOut = this.onFocusOut.bind(this);
        this.onBreakpoint = this.onBreakpoint.bind(this);
        this.onDocumentPointerDown = this.onDocumentPointerDown.bind(this);
    }

    init() {
        this.desktopMedia = window.matchMedia(this.dataset.desktopQuery || '(min-width: 1024px)');

        this.listen(this, 'pointerdown', this.onPointerDown);
        this.listen(this, 'click', this.onClick);
        this.listen(this, 'keydown', this.onKeydown);
        this.listen(this, 'focusin', this.onFocusIn);
        this.listen(this, 'focusout', this.onFocusOut);
        this.listen(this.desktopMedia, 'change', this.onBreakpoint);

        this.$$('[data-nav-item]').forEach((item) => {
            this.listen(item, 'pointerenter', this.onPointerEnter);
            this.listen(item, 'pointerleave', this.onPointerLeave);
        });
    }

    disconnectedCallback() {
        this.clearTimer();
        this.timelines.forEach((timeline) => timeline.kill());
        this.timelines.clear();
        this.unbindWhileOpen();
        super.disconnectedCallback();
    }

    get prefersReducedMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    onPointerDown(event) {
        this.lastPointerType = event.pointerType;
        const toggle = event.target.closest('[data-nav-toggle]');
        this.pointerGesture = Boolean(toggle && this.contains(toggle));
    }

    onPointerEnter(event) {
        if (event.pointerType !== 'mouse') return;

        const item = event.currentTarget;
        if (this.hoverSuppressed === item) return;

        this.clearTimer();
        if (this.openItem === item) return;
        this.open(item, 'hover');
    }

    onPointerLeave(event) {
        const item = event.currentTarget;
        if (this.hoverSuppressed === item) this.hoverSuppressed = null;
        if (this.openItem !== item || this.openedBy !== 'hover') return;

        if (item.contains(document.activeElement)) {
            this.openedBy = 'click';
            this.clearTimer();
            return;
        }

        this.scheduleClose();
    }

    onFocusIn(event) {
        if (this.openedBy !== 'hover' || !this.openItem?.contains(event.target)) return;
        this.openedBy = 'click';
        this.clearTimer();
    }

    onClick(event) {
        const toggle = event.target.closest('[data-nav-toggle]');
        if (!toggle || !this.contains(toggle)) return;

        const item = toggle.closest('[data-nav-item]');
        if (!item) return;

        const viaPointer = this.pointerGesture;
        this.pointerGesture = false;
        const how = viaPointer ? 'click' : 'keyboard';

        if (this.openItem === item && this.openedBy === 'hover') {
            this.openedBy = how;
            this.clearTimer();
            return;
        }

        if (this.openItem === item) {
            this.close();
            return;
        }

        this.open(item, how);
    }

    onKeydown(event) {
        if ((event.key === 'Enter' || event.key === ' ') && event.target.closest('[data-nav-toggle]')) {
            this.pointerGesture = false;
        }

        if (event.key !== 'Escape' || !this.openItem) return;

        const item = this.openItem;
        const toggle = item.querySelector('[data-nav-toggle]');
        const focusInside = item.contains(document.activeElement);

        this.hoverSuppressed = item;
        this.close();

        if (focusInside && toggle) toggle.focus();
    }

    onFocusOut(event) {
        if (!this.openItem) return;
        if (event.relatedTarget == null) return;
        if (!this.openItem.contains(event.relatedTarget)) this.close();
    }

    onBreakpoint() {
        if (!this.desktopMedia.matches) this.close();
    }

    onDocumentPointerDown(event) {
        if (this.contains(event.target)) return;
        this.pointerGesture = false;
        this.close();
    }

    open(item, openedBy) {
        if (this.closingItem && this.closingItem !== item) this.snapClosed(this.closingItem);
        if (this.openItem && this.openItem !== item) this.snapClosed(this.openItem);

        this.clearTimer();
        this.openItem = item;
        this.openedBy = openedBy;
        this.setExpanded(item, true);
        item.setAttribute('data-open', '');
        const panel = item.querySelector('[data-nav-panel]');
        if (panel) panel.inert = false;
        this.playIn(item);
        this.bindWhileOpen();
    }

    close() {
        this.clearTimer();
        const item = this.openItem;
        this.openItem = null;
        this.openedBy = null;
        this.unbindWhileOpen();
        if (!item) return;
        this.setExpanded(item, false);
        this.playOut(item);
    }

    setExpanded(item, isOpen) {
        const toggle = item.querySelector('[data-nav-toggle]');
        if (toggle) toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }

    panelInner(item) {
        return item.querySelector('[data-nav-panel-inner]');
    }

    timelineFor(item) {
        const existing = this.timelines.get(item);
        if (existing) return existing;
        const inner = this.panelInner(item);
        if (!inner || typeof gsap === 'undefined') return null;

        const timeline = gsap.timeline({
            paused: true,
            defaults: { duration: 0.2, ease: 'smooth' },
        });
        timeline.fromTo(inner, { autoAlpha: 0, y: 0 }, { autoAlpha: 1, y: 0 });
        this.timelines.set(item, timeline);
        return timeline;
    }

    playIn(item) {
        const timeline = this.timelineFor(item);
        if (!timeline || this.prefersReducedMotion) {
            timeline?.progress(1);
            return;
        }
        if (timeline.progress() === 0) timeline.restart();
        else timeline.play();
    }

    playOut(item) {
        const timeline = this.timelineFor(item);
        if (!timeline || this.prefersReducedMotion || timeline.progress() === 0) {
            this.finishClose(item);
            return;
        }

        this.closingItem = item;
        const panel = item.querySelector('[data-nav-panel]');
        if (panel) panel.inert = true;
        timeline.eventCallback('onReverseComplete', () => {
            if (this.closingItem === item) this.closingItem = null;
            if (this.openItem === item) return;
            this.finishClose(item);
        });
        timeline.reverse();
    }

    snapClosed(item) {
        if (this.closingItem === item) this.closingItem = null;
        this.timelines.get(item)?.eventCallback('onReverseComplete', null);
        this.setExpanded(item, false);
        this.finishClose(item);
    }

    finishClose(item) {
        item.removeAttribute('data-open');
        const panel = item.querySelector('[data-nav-panel]');
        if (panel) panel.inert = false;
        const timeline = this.timelines.get(item);
        timeline?.pause(0);
        const inner = this.panelInner(item);
        if (inner && typeof gsap !== 'undefined') gsap.set(inner, { clearProps: 'opacity,visibility,transform' });
    }

    clearTimer() {
        if (this.closeTimer == null) return;
        clearTimeout(this.closeTimer);
        this.closeTimer = null;
    }

    scheduleClose() {
        this.clearTimer();
        this.closeTimer = setTimeout(() => {
            this.closeTimer = null;
            if (this.openedBy === 'hover') this.close();
        }, 200);
    }

    bindWhileOpen() {
        if (this.openController) return;

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

        document.addEventListener('pointerdown', this.onDocumentPointerDown, {
            signal: controller.signal,
        });
    }

    unbindWhileOpen() {
        this.removeOpenAbort?.();
        this.removeOpenAbort = null;
        this.openController?.abort();
        this.openController = null;
    }
}

function define() {
    if (!customElements.get('header-nav')) {
        customElements.define('header-nav', HeaderNav);
    }
}

define();
