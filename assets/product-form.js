if (!customElements.get('product-form')) {
  customElements.define(
    'product-form',
    class ProductForm extends BaseComponent {
      constructor() {
        super();
        this.form = this.querySelector('form');
        this.submitButton = this.querySelector('[type="submit"]');
      }

      init() {
        this.listen(this.form, 'submit', this.onSubmit.bind(this));
        // Remember which submit button was clicked (quick add pills carry name="id" value="<variant>").
        this.listen(this.form, 'click', (evt) => {
          const button = evt.target.closest('[type="submit"]');
          if (button) this.lastSubmitter = button;
        });
        if (this.variantIdInput) this.variantIdInput.disabled = false;

        // Add-ons and quantity change the total shown in the Add to cart button.
        this.listen(this.form, 'change', this.updateTotal.bind(this));
        this.listen(this.form, 'input', this.updateTotal.bind(this));
        this.listen(this.closest('product-info') || this, 'change', (evt) => {
          if (evt.target.matches?.('[data-add-on]')) this.updateTotal();
        });
      }

      get addOnInputs() {
        const scope = this.closest('product-info') || this;
        return [...scope.querySelectorAll('[data-add-on]')];
      }

      get checkedAddOns() {
        return this.addOnInputs.filter((input) => input.checked && !input.disabled);
      }

      get priceElement() {
        return this.querySelector('[data-button-price]');
      }

      /** Variant price in cents, kept in data-amount on the price (replaced after a variant change). */
      setUnitPrice(cents) {
        const price = this.priceElement;
        if (price && Number.isFinite(cents)) price.dataset.amount = String(cents);
        this.updateTotal();
      }

      updateTotal() {
        const price = this.priceElement;
        if (!price || !window.Shopify?.formatMoney) return;
        const unit = Number(price.dataset.amount);
        if (!Number.isFinite(unit)) return;
        const quantity = Number(this.form.querySelector('[name=quantity]')?.value) || 1;
        const addOns = this.checkedAddOns.reduce((sum, input) => sum + Number(input.dataset.price || 0), 0);
        price.textContent = Shopify.formatMoney(unit * quantity + addOns);
      }

      get variantIdInput() {
        return this.form.querySelector('[name=id]');
      }

      get submitButtonText() {
        return this.querySelector('[name=add] [data-button-label]') || this.submitButton?.querySelector('[data-button-label]');
      }

      get submitButtons() {
        return this.form.querySelectorAll('[type="submit"]');
      }

      onSubmit(evt) {
        // The clicked submit button (quick add pills carry name="id") drives the request.
        const submitter = evt.submitter || this.lastSubmitter;
        evt.preventDefault();
        this.submitButton = submitter || this.querySelector('[type="submit"]');
        if (this.submitButton?.hasAttribute('disabled')) return;

        this.setLoading(true);
        this.clearError();

        const config = fetchConfig('javascript');
        config.headers['X-Requested-With'] = 'XMLHttpRequest';
        delete config.headers['Content-Type'];

        const formData = new FormData(this.form);
        if (submitter?.name && !formData.has(submitter.name)) formData.append(submitter.name, submitter.value);
        const sections = ['cart-drawer', 'cart-icon-bubble', 'main-cart'];
        const addOns = this.checkedAddOns;

        if (addOns.length) {
          // One request with the page product and every checked add-on.
          config.headers['Content-Type'] = 'application/json';
          config.body = JSON.stringify({
            items: [this.mainItem(formData), ...addOns.map((input) => ({ id: Number(input.dataset.variantId), quantity: 1 }))],
            sections,
            sections_url: window.location.pathname,
          });
        } else {
          formData.append('sections', sections);
          formData.append('sections_url', window.location.pathname);
          config.body = formData;
        }

        fetch(routes.cart_add_url, config)
          .then(res => res.json())
          .then(data => {
            if (data.status) {
              this.showError(data.description);
              return;
            }
            CartItems.renderSections(data.sections);
            this.emit('product-form:added');
            document.querySelector('side-drawer[data-modal="cart-drawer"]')?.open(this.submitButton);
          })
          .catch(err => {
            console.error(err);
            this.showError(window.cartStrings?.error || 'Something went wrong. Please try again.');
          })
          .finally(() => this.setLoading(false));
      }

      /** The page product as a cart item, read from the form fields. */
      mainItem(formData) {
        const item = { id: Number(formData.get('id')), quantity: Number(formData.get('quantity')) || 1 };
        const plan = formData.get('selling_plan');
        if (plan) item.selling_plan = plan;
        const properties = {};
        for (const [key, value] of formData.entries()) {
          const match = key.match(/^properties\[(.+)\]$/);
          if (match) properties[match[1]] = value;
        }
        if (Object.keys(properties).length) item.properties = properties;
        return item;
      }

      setLoading(isLoading) {
        if (!this.submitButton) return;
        this.submitButton.toggleAttribute('disabled', isLoading);
        if (isLoading) this.submitButton.setAttribute('aria-busy', 'true');
        else this.submitButton.removeAttribute('aria-busy');
        document.dispatchEvent(new Event(isLoading ? 'loading:start' : 'loading:end'));
      }

      get errorElement() {
        return this.querySelector('[data-product-form-error]');
      }

      showError(message) {
        const error = this.errorElement;
        if (!error) return;
        error.querySelector('[data-helper-text]').textContent = message;
        error.hidden = false;
      }

      clearError() {
        const error = this.errorElement;
        if (!error) return;
        error.querySelector('[data-helper-text]').textContent = '';
        error.hidden = true;
      }

      toggleSubmitButton(disable = true, text) {
        this.submitButtons.forEach((button) => button.toggleAttribute('disabled', disable));
        const label = this.submitButtonText;
        if (!label) return;
        if (text) label.textContent = text;
        else if (!disable && window.variantStrings?.addToCart) label.textContent = window.variantStrings.addToCart;
      }

      handleErrorMessage() {
        this.clearError();
      }
    }
  );
}