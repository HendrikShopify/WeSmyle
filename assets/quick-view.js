/*
  <quick-view>
    <side-drawer data-modal="quick-view"> ... [data-quick-view-body] ... </side-drawer>
  </quick-view>
  Opens from any [data-quick-view-trigger] with data-product-url: fetches the quick-view-product section,
  puts it in [data-quick-view-body] and opens the side drawer. Closes when the product form adds to the cart.
*/
class QuickView extends BaseComponent {
  init() {
    this.drawer = this.$('side-drawer');
    this.body = this.$('[data-quick-view-body]');
    this.controller = null;

    this.listen(document, 'click', (evt) => {
      const trigger = evt.target.closest('[data-quick-view-trigger]');
      if (!trigger) return;
      evt.preventDefault();
      this.load(trigger);
    });
    this.listen(this, 'product-form:added', () => this.drawer?.close());
  }

  load(trigger) {
    const productUrl = trigger.dataset.productUrl;
    if (!productUrl || !this.drawer || !this.body) return;

    this.controller?.abort();
    this.controller = new AbortController();
    this.emit('loading:start');

    fetch(`${productUrl}?section_id=quick-view-product`, { signal: this.controller.signal })
      .then((response) => response.text())
      .then((html) => {
        const product = new DOMParser().parseFromString(html, 'text/html').querySelector('product-info');
        if (!product) return;
        HTMLUpdateUtility.setInnerHTML(this.body, product.outerHTML);
        this.drawer.open(trigger);
      })
      .catch((error) => {
        if (error.name !== 'AbortError') console.error(error);
      })
      .finally(() => this.emit('loading:end'));
  }
}

customElements.define('quick-view', QuickView);
