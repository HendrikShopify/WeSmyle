/* <purchase-options>: one-time purchase or subscription in the buy box (selling plans).
   The radios / checkbox and the frequency control are not part of the product form. This element writes the chosen
   selling plan id into the hidden input name="selling_plan" (form attribute points at the product form), empty for
   a one-time purchase. It also swaps the subscription price when the frequency changes, and re-syncs when the
   variant changes (product-info.js replaces the [data-purchase-prices] block with the new variant's prices). */
class PurchaseOptions extends BaseComponent {
  init() {
    this.plan = this.querySelector('[data-purchase-plan]');
    if (!this.plan) return;

    this.listen(this, 'change', () => this.sync());
    this.listen(this, 'select:change', () => this.sync());

    const host = this.closest('product-info');
    if (host) {
      this.observer?.disconnect();
      this.observer = new MutationObserver((mutations) => {
        const replaced = mutations.some((m) =>
          [...m.addedNodes].some((n) => n.nodeType === 1 && (n.matches?.('[data-purchase-prices]') || n.querySelector?.('[data-purchase-prices]')))
        );
        if (replaced) this.sync();
      });
      this.observer.observe(host, { childList: true, subtree: true });
    }
    this.sync();
  }

  disconnectedCallback() {
    this.observer?.disconnect();
    super.disconnectedCallback();
  }

  get subscribed() {
    const checkbox = this.querySelector('[data-purchase-checkbox]');
    if (checkbox) return checkbox.checked;
    return this.querySelector('[data-purchase-type]:checked')?.value === 'subscription';
  }

  get frequency() {
    const pill = this.querySelector('[data-frequency-pill]:checked');
    if (pill) return pill.value;
    return this.querySelector('[data-frequency] input[type="hidden"]')?.value || '';
  }

  sync() {
    const subscribed = this.subscribed;
    const planId = subscribed ? this.frequency : '';
    this.plan.value = planId;

    const details = this.querySelector('[data-purchase-details]');
    if (details) details.hidden = !subscribed;

    // keep every price in step with the selected variant and frequency
    this.querySelectorAll('[data-purchase-price]').forEach((slot) => {
      const key = slot.dataset.purchasePrice === 'one-time' ? 'one-time' : this.frequency || slot.dataset.purchasePrice;
      const template = this.querySelector(`template[data-plan="${CSS.escape(key)}"]`);
      if (template) slot.innerHTML = template.innerHTML;
    });
  }
}

if (!customElements.get('purchase-options')) customElements.define('purchase-options', PurchaseOptions);
