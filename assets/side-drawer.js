/*
  <side-drawer data-modal="id" data-position="right|left" hidden>
    [data-modal="bg"]       overlay
    [data-modal="content"]  panel (role=dialog)
    [data-drawer-close]     any close control inside (delegated, survives section rendering)
  Opens from [data-drawer-trigger="id"] anywhere in the document. open(trigger) / close() for scripts.
  Events (bubble): drawer:opening (panel starts sliding in), drawer:open (animation done, focus trapped), drawer:close.
*/
class SideDrawer extends BaseComponent {
  constructor() {
    super();
    this.isOpen = false;
    this.modalId = this.dataset.modal;
    this.backdrop = this.querySelector('[data-modal="bg"]');
    this.content = this.querySelector('[data-modal="content"]');
    this.triggerElement = null;
    this.timeline = null;
    this.inertedElements = [];
    this.onDocumentClick = this.onDocumentClick.bind(this);
  }

  get prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  get offscreen() {
    return this.dataset.position === 'left' ? '-100%' : '100%';
  }

  connectedCallback() {
    this.setAttribute('aria-hidden', 'true');
    this.hidden = true;
    this.createTimeline();
    this.init();
  }

  init() {
    this.listen(this, 'click', (evt) => {
      if (evt.target.closest('[data-drawer-close]') || evt.target === this.backdrop) this.close();
    });
    this.listen(this, 'keyup', (evt) => {
      if (evt.code === 'Escape' && this.isOpen) this.close();
    });
    this.listen(document, 'click', this.onDocumentClick);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.clearInert();
    this.setAttribute('data-scroll-lock', 'false');
  }

  onDocumentClick(evt) {
    const trigger = evt.target.closest(`[data-drawer-trigger="${this.modalId}"]`);
    if (!trigger) return;
    evt.preventDefault();
    this.isOpen ? this.close() : this.open(trigger);
  }

  createTimeline() {
    if (typeof gsap === 'undefined') return;
    if (this.timeline) this.timeline.kill();
    gsap.set(this.content, { clearProps: 'transform' });

    this.timeline = gsap.timeline({
      paused: true,
      defaults: { duration: 0.6, ease: 'smooth' },
      onStart: () => this.show(),
      onComplete: () => this.afterOpen(),
      onReverseComplete: () => this.hide(),
    });

    this.timeline
      .from(this.content, { x: this.offscreen })
      .fromTo(this.backdrop, { opacity: 0 }, { opacity: 0.3 }, 0);

    if (this.isOpen) this.timeline.progress(1);
  }

  show() {
    this.hidden = false;
    this.setAttribute('aria-hidden', 'false');
    this.dispatchEvent(new CustomEvent('drawer:opening', { bubbles: true }));
  }

  hide() {
    this.hidden = true;
    this.setAttribute('aria-hidden', 'true');
  }

  afterOpen() {
    this.isOpen = true;
    // Keep focus if something inside (the search field) already took it on drawer:opening.
    const inside = this.contains(document.activeElement) ? document.activeElement : this.content;
    trapFocus(this, inside);
    this.dispatchEvent(new CustomEvent('drawer:open', { bubbles: true }));
  }

  open(trigger) {
    if (this.isOpen || this.timeline?.isActive()) return;
    this.triggerElement = trigger || null;
    this.setTriggersExpanded(true);
    this.applyInert();
    this.setAttribute('data-scroll-lock', 'true');

    if (this.prefersReducedMotion || !this.timeline) {
      this.show();
      this.afterOpen();
      return;
    }
    this.timeline.play();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.setTriggersExpanded(false);
    this.clearInert();
    this.setAttribute('data-scroll-lock', 'false');
    removeTrapFocus(this.triggerElement);
    this.dispatchEvent(new CustomEvent('drawer:close', { bubbles: true }));

    if (this.prefersReducedMotion || !this.timeline) {
      this.hide();
      return;
    }
    this.timeline.reverse();
  }

  setTriggersExpanded(expanded) {
    document.querySelectorAll(`[data-drawer-trigger="${this.modalId}"]`).forEach((trigger) => {
      trigger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    });
  }

  applyInert() {
    this.clearInert();
    this.inertedElements = Array.from(document.body.children).filter(
      (el) => el !== this && el.nodeName !== 'SCRIPT' && !el.contains(this)
    );
    this.inertedElements.forEach((el) => { el.inert = true; });
  }

  clearInert() {
    this.inertedElements.forEach((el) => { el.inert = false; });
    this.inertedElements = [];
  }
}

customElements.define('side-drawer', SideDrawer);
