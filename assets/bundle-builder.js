if (!customElements.get('bundle-builder')) {
  customElements.define(
    'bundle-builder',
    class BundleBuilder extends BaseComponent {
      init() {
        this.tierItems = this.dataset.tierItems.split(',').map(Number);
        this.tierPercents = this.dataset.tierPercents.split(',').map(Number);
        this.capacity = this.tierItems[this.tierItems.length - 1];
        this.tiles = [...this.$$('[data-bundle-tile]')];
        this.slots = [...this.$$('[data-bundle-slot]')];
        this.segments = [...this.$$('[data-bundle-segment]')];
        this.submit = this.$('[data-bundle-submit]');
        this.progress = this.$('[data-bundle-progress]');

        this.listen(this, 'change', this.onChange.bind(this));
        this.listen(this, 'click', this.onClick.bind(this));
        this.update();
      }

      qty(tile) {
        return Number(tile.querySelector('[data-bundle-qty]').value) || 0;
      }

      setQty(tile, value) {
        tile.querySelector('[data-bundle-qty]').value = Math.max(0, value);
      }

      get total() {
        return this.tiles.reduce((sum, tile) => sum + this.qty(tile), 0);
      }

      onChange(evt) {
        const input = evt.target.closest('[data-bundle-qty]');
        if (!input) return;
        // A typed quantity cannot go past the free slots.
        const tile = input.closest('[data-bundle-tile]');
        const others = this.total - this.qty(tile);
        this.setQty(tile, Math.min(this.qty(tile), this.capacity - others));
        this.update();
      }

      onClick(evt) {
        const add = evt.target.closest('[data-bundle-add]');
        if (add) {
          this.setQty(add.closest('[data-bundle-tile]'), 1);
          this.update();
          add.closest('[data-bundle-tile]').querySelector('[name=plus]')?.focus();
          return;
        }
        const remove = evt.target.closest('[data-bundle-slot-remove]');
        if (remove) {
          const tile = this.tiles.find((item) => item.dataset.variantId === remove.dataset.variantId);
          if (tile) this.setQty(tile, this.qty(tile) - 1);
          this.update();
          return;
        }
        if (evt.target.closest('[data-bundle-submit]')) this.addToCart();
      }

      /** Highest tier percent reached by this many items, 0 below the first tier. */
      percentFor(count) {
        let percent = 0;
        this.tierItems.forEach((items, index) => {
          if (count >= items) percent = this.tierPercents[index];
        });
        return percent;
      }

      format(cents) {
        return Shopify.formatMoney(cents);
      }

      fill(template, values) {
        return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`[${key}]`, value), template);
      }

      update() {
        const total = this.total;
        const full = total >= this.capacity;
        const units = [];
        let subtotal = 0;

        this.tiles.forEach((tile) => {
          const qty = this.qty(tile);
          subtotal += qty * Number(tile.dataset.price);
          for (let i = 0; i < qty; i++) units.push(tile);
          const state = qty > 0 ? 'added' : full ? 'full' : 'default';
          tile.dataset.state = state;
          const add = tile.querySelector('[data-bundle-add]');
          if (!tile.hasAttribute('data-unavailable')) {
            add.disabled = state === 'full';
            add.querySelector('[data-button-label]').textContent = state === 'full' ? this.fullLabel(tile) : this.addLabel(tile);
          }
          const plus = tile.querySelector('[name=plus]');
          if (plus) plus.disabled = full;
        });

        this.slots.forEach((slot, index) => {
          const tile = units[index];
          slot.dataset.state = tile ? 'filled' : 'empty';
          if (!tile) return;
          const image = slot.querySelector('[data-bundle-slot-image]');
          if (tile.dataset.image) image.src = tile.dataset.image;
          else image.removeAttribute('src');
          const remove = slot.querySelector('[data-bundle-slot-remove]');
          remove.dataset.variantId = tile.dataset.variantId;
          remove.setAttribute('aria-label', this.removeLabel(tile));
        });

        const percent = this.percentFor(total);
        const discount = Math.round((subtotal * percent) / 100);
        const count = this.$('[data-bundle-count]');
        count.textContent = this.fill(count.dataset.template, { selected: total, total: this.capacity });
        this.$('[data-bundle-subtotal]').textContent = this.format(subtotal);
        this.$('[data-bundle-discount]').textContent = `-${this.format(discount)}`;
        this.$('[data-bundle-discount-row]').hidden = discount === 0;
        this.$('[data-bundle-total]').textContent = this.format(subtotal - discount);
        this.$('[data-bundle-total-mobile]').textContent = this.format(subtotal - discount);
        const compare = this.$('[data-bundle-compare]');
        compare.textContent = this.format(subtotal);
        compare.hidden = discount === 0;

        this.updateProgress(total, full);
        this.submit.disabled = total < this.tierItems[0];
      }

      updateProgress(total, full) {
        this.segments.forEach((segment, index) => {
          segment.dataset.filled = String(total >= this.tierItems[index]);
        });
        this.progress.dataset.complete = String(full);
        const next = this.tierItems.findIndex((items) => total < items);
        const data = this.progress.dataset;
        let message;
        if (full) message = this.fill(data.messageDone, { percent: this.tierPercents[this.tierPercents.length - 1] });
        else if (total === 0) message = this.fill(data.messageStart, { number: this.tierItems[0], percent: this.tierPercents[0] });
        else message = this.fill(data.messageNext, { number: this.tierItems[next] - total, percent: this.tierPercents[next] });
        this.$('[data-bundle-message]').textContent = message;
      }

      addLabel() {
        return this.dataset.labelAdd;
      }

      fullLabel() {
        return this.dataset.labelFull;
      }

      removeLabel(tile) {
        return this.dataset.labelRemove.replace('[title]', tile.dataset.title);
      }

      setLoading(isLoading) {
        this.submit.toggleAttribute('disabled', isLoading);
        if (isLoading) this.submit.setAttribute('aria-busy', 'true');
        else this.submit.removeAttribute('aria-busy');
        document.dispatchEvent(new Event(isLoading ? 'loading:start' : 'loading:end'));
      }

      showError(message) {
        const error = this.$('[data-bundle-error]');
        error.textContent = message || '';
        error.hidden = !message;
      }

      addToCart() {
        const items = this.tiles
          .filter((tile) => this.qty(tile) > 0)
          .map((tile) => ({ id: Number(tile.dataset.variantId), quantity: this.qty(tile) }));
        if (!items.length) return;

        this.setLoading(true);
        this.showError();

        const config = fetchConfig('javascript');
        config.headers['X-Requested-With'] = 'XMLHttpRequest';
        config.body = JSON.stringify({
          items,
          sections: ['cart-drawer', 'cart-icon-bubble', 'main-cart'],
          sections_url: window.location.pathname,
        });

        fetch(routes.cart_add_url, config)
          .then((res) => res.json())
          .then((data) => {
            if (data.status) {
              this.showError(data.description);
              return;
            }
            CartItems.renderSections(data.sections);
            this.tiles.forEach((tile) => this.setQty(tile, 0));
            this.emit('bundle-builder:added');
            document.querySelector('side-drawer[data-modal="cart-drawer"]')?.open(this.submit);
          })
          .catch((err) => {
            console.error(err);
            this.showError(window.cartStrings?.error || 'Something went wrong. Please try again.');
          })
          .finally(() => {
            this.setLoading(false);
            this.update();
          });
      }
    }
  );
}
