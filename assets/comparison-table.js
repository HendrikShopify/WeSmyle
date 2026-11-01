/*
  <comparison-table> wraps the Comparison table snippet.
  - Info buttons ([data-comparison-info]) pin their tooltip open on click and tap (hover and focus are CSS only);
    Escape, another tap or a tap outside closes it.
  - When the table scrolls sideways on mobile, [data-comparison-fade] hides at the end of the scroll.
*/
class ComparisonTable extends BaseComponent {
  init() {
    this.scroller = this.$('[data-comparison-scroll]');
    this.fade = this.$('[data-comparison-fade]');
    this.openButton = null;

    this.listen(this, 'click', this.onClick.bind(this));
    this.listen(document, 'click', this.onDocumentClick.bind(this));
    this.listen(document, 'keydown', this.onKeydown.bind(this));

    if (this.scroller && this.fade) {
      this.listen(this.scroller, 'scroll', this.updateFade.bind(this), { passive: true });
      this.listen(window, 'resize', this.updateFade.bind(this));
      this.updateFade();
    }
  }

  bubbleFor(button) {
    return button.parentElement ? button.parentElement.querySelector('[role="tooltip"]') : null;
  }

  setOpen(button, open) {
    const bubble = this.bubbleFor(button);
    if (!bubble) return;
    bubble.style.opacity = open ? '1' : '';
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
    this.openButton = open ? button : null;
  }

  onClick(evt) {
    const button = evt.target.closest('[data-comparison-info]');
    if (!button) return;
    const wasOpen = this.openButton === button;
    if (this.openButton) this.setOpen(this.openButton, false);
    if (!wasOpen) this.setOpen(button, true);
  }

  onDocumentClick(evt) {
    if (!this.openButton || this.contains(evt.target)) return;
    this.setOpen(this.openButton, false);
  }

  onKeydown(evt) {
    if (evt.key !== 'Escape' || !this.openButton) return;
    const button = this.openButton;
    this.setOpen(button, false);
    button.focus();
  }

  updateFade() {
    const { scrollLeft, clientWidth, scrollWidth } = this.scroller;
    const scrollable = scrollWidth > clientWidth + 1;
    const atEnd = !scrollable || scrollLeft + clientWidth >= scrollWidth - 1;
    this.fade.dataset.atEnd = atEnd ? 'true' : 'false';
  }
}

customElements.define('comparison-table', ComparisonTable);
