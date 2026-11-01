class CartItems extends BaseComponent {
  constructor() {
    super();
    this.debouncedUpdate = debounce((index, value) => {
      this.updateQuantity(index, value);
    }, 300);
  }

  init() {
    this.listen(this, 'change', (event) => {
      this.debouncedUpdate(event.target.dataset.index, event.target.value);
    });
  }

  updateQuantity(line, quantity) {
    this.setAttribute('loading', '');
    document.dispatchEvent(new Event('loading:start'));
    this.clearError();

    fetch(routes.cart_change_url, {
      ...fetchConfig(),
      body: JSON.stringify({
        line: parseInt(line),
        quantity: parseInt(quantity),
        sections: ['cart-drawer', 'cart-icon-bubble', 'main-cart'],
        sections_url: window.location.pathname
      })
    })
      .then(res => res.json())
      .then(state => {
        if (state.errors) {
          this.showError(state.errors);
          this.resetQuantity(line);
          return;
        }
        CartItems.renderSections(state.sections);
      })
      .catch((err) => {
        console.error(err);
        this.showError('Something went wrong. Please try again.');
      })
      .finally(() => {
        this.removeAttribute('loading');
        document.dispatchEvent(new Event('loading:end'));
      });
  }

  // After a rejected change the input keeps the rejected value; put the server-rendered one back.
  resetQuantity(line) {
    const input = this.querySelector(`quantity-input input[data-index="${line}"]`);
    if (input) input.value = input.getAttribute('value');
  }

  get errorElement() {
    const inDrawer = this.closest('side-drawer');
    return document.getElementById(inDrawer ? 'cart-drawer-error' : 'cart-page-error');
  }

  showError(message) {
    const error = this.errorElement;
    if (!error) return;
    (error.querySelector('[data-helper-text]') || error).textContent = message;
    error.hidden = false;
  }

  clearError() {
    const error = this.errorElement;
    if (!error) return;
    (error.querySelector('[data-helper-text]') || error).textContent = '';
    error.hidden = true;
  }

  static renderSections(sections) {
    document.getElementById('cart-icon-bubble').innerHTML =
      CartItems.getSectionHTML(sections['cart-icon-bubble'], 'cart-icon-bubble');

    document.getElementById('cart-drawer-inner').innerHTML =
      CartItems.getSectionHTML(sections['cart-drawer'], 'cart-drawer-inner');

    const cartPage = document.getElementById('main-cart');
    if (cartPage) {
      cartPage.innerHTML = CartItems.getSectionHTML(sections['main-cart'], 'main-cart');
    }

  }

  static getSectionHTML(html, sectionId) {
    return new DOMParser()
      .parseFromString(html, 'text/html')
      .getElementById(sectionId).innerHTML;
  }
}

customElements.define('cart-items', CartItems);


class CartRemoveButton extends BaseComponent {
  init() {
    this.listen(this, 'click', () => {
      this.closest('cart-items').updateQuantity(this.dataset.index, 0);
    });
  }
}

customElements.define('cart-remove-button', CartRemoveButton);




class DiscountCode extends BaseComponent {
  init() {
    this.form = this.querySelector('[data-discount-form]');
    this.input = this.querySelector('input[name="discount"]');
    this.error = this.querySelector('[data-discount-error]');
    this.listen(this.form, 'submit', (evt) => { evt.preventDefault(); this.apply(); });
  }

  showError(message) {
    if (!this.error) return;
    this.error.querySelector('[data-helper-text]').textContent = message;
    this.error.hidden = !message;
  }

  apply() {
    const code = this.input.value.trim();
    if (!code) return;
    this.showError('');
    const button = this.form.querySelector('[type="submit"]');
    button?.setAttribute('aria-busy', 'true');
    const existing = Array.from(document.querySelectorAll('[data-discount-code]')).map((el) => el.dataset.discountCode);
    const codes = [...new Set([...existing, code])].join(',');

    fetch(routes.cart_update_url, {
      ...fetchConfig(),
      body: JSON.stringify({ discount: codes, sections: ['cart-drawer', 'cart-icon-bubble', 'main-cart'], sections_url: window.location.pathname }),
    })
      .then((res) => res.json())
      .then((state) => {
        const applied = (state.discount_codes || []).find((d) => d.code.toLowerCase() === code.toLowerCase());
        if (!applied || !applied.applicable) {
          this.showError(window.cartStrings?.discountError || 'This discount code is not valid');
          return;
        }
        CartItems.renderSections(state.sections);
      })
      .catch(() => this.showError(window.cartStrings?.error || 'An error occurred'))
      .finally(() => button?.removeAttribute('aria-busy'));
  }
}

customElements.define('discount-code', DiscountCode);
