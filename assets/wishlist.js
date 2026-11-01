class ShopifyWishlist extends BaseComponent {
  constructor() {
    super();
    this.LOCAL_STORAGE_WISHLIST_KEY = 'shopify-wishlist';
    this.GRID_LOADED_CLASS = 'loaded';
    this.selectors = {
      grid: '[grid-wishlist]',
      productCard: 'product-card',
      emptyState: '[data-wishlist-empty]',
      addToCartButton: '[data-add-to-cart]',
      removeFromWishlistButton: '[data-remove-from-wishlist]',
      checkbox: '[data-wishlist-checkbox]',
    };

    this.cart = document.querySelector('side-drawer[data-modal="cart-drawer"]');
    this.addToCartButton = document.querySelector(this.selectors.addToCartButton);
  }

  init() {
    this.listen(document, 'DOMContentLoaded', () => this.initGrid());
    this.listen(document, 'shopify-wishlist:updated', () => this.initGrid());

    this.listen(this.addToCartButton, 'click', () => this.onAddToCartClick());
  }

  onAddToCartClick() {
    this.addCheckedToCart();
  }

  async addCheckedToCart() {
    const checkedItems = document.querySelectorAll(`${this.selectors.checkbox}:checked`);

    if (checkedItems.length === 0) {
      return;
    }

    document.dispatchEvent(new Event('loading:start'));

    const formData = new FormData();
    checkedItems.forEach((item) => {
      formData.append('items[][id]', item.value);
      formData.append('items[][quantity]', 1);
    });

    const config = fetchConfig('javascript');
    config.headers['X-Requested-With'] = 'XMLHttpRequest';
    delete config.headers['Content-Type'];

    config.body = formData;

    try {
      const response = await fetch(`${routes.cart_add_url}`, config);
      const data = await response.json();

      if (data.status) {
        this.handleErrorMessage(data.description);
        return;
      }

      const cartUpdateEvent = new CustomEvent('cart:update', {
        detail: {
          source: 'wishlist',
          productVariantId: formData.getAll('items[][id]'),
          cartData: data,
        },
      });
      window.dispatchEvent(cartUpdateEvent);
    } catch (e) {
      console.error('[Shopify Wishlist] Failed to add items to cart', e);
    }

    document.dispatchEvent(new Event('loading:end'));
  }

  async fetchProductCardHTML(handle, variantId) {
    const productTileTemplateUrl = `/products/${handle}?view=card`;

    try {
      const res = await fetch(productTileTemplateUrl);
      const text = await res.text();
      const parser = new DOMParser();
      const htmlDocument = parser.parseFromString(text, 'text/html');

      const productCard = htmlDocument.documentElement.querySelector(this.selectors.productCard);
      if (!productCard) {
        console.error(`[Shopify Wishlist] No product card found for handle: ${handle}`);
        return '';
      }

      await this.insertVariantData(productCard, handle, variantId);

      return productCard.outerHTML;
    } catch (err) {
      console.error(`[Shopify Wishlist] Failed to load product: ${handle}`, err);
      return '';
    }
  }

  async insertVariantData(productCard, handle, variantId) {
    const wishlistButton = productCard.querySelector('wishlist-button');
    const productJson = JSON.parse(productCard.querySelector('[data-product-json]').innerHTML);
    const variant = productJson.variants.find((variant) => variant.id == variantId);

    if (!variant) {
      console.error(`[Shopify Wishlist] Variant ${variantId} not found in product JSON`);
      return;
    }

    // UPDATE VARIANT OPTIONS
    const options = {
      1: variant.option1,
      2: variant.option2,
      3: variant.option3,
    };

    for (let index = 1; index <= 3; index++) {
      const optionElement = productCard.querySelector(`[data-option-value${index}]`);
      if (optionElement && options[index]) {
        optionElement.textContent = options[index];
      }
    }

    // UPDATE PRICE ELEMENTS
    const priceElement = productCard.querySelector('[data-price]');
    const compareAtPriceElement = productCard.querySelector('[data-compare-at-price]');

    if (priceElement) {
      priceElement.textContent = Shopify.formatMoney(variant.price);
    }
    if (compareAtPriceElement) {
      compareAtPriceElement.textContent = Shopify.formatMoney(variant.compare_at_price);
    }

    // UPDATE WISHLIST BUTTON
    if (wishlistButton) {
      wishlistButton.setAttribute('data-product-handle', handle);
      wishlistButton.setAttribute('data-variant-id', variantId);
    }

    // UPDATE CHECKBOX
    const wishlistCheckbox = productCard.querySelector('[data-wishlist-checkbox]');
    if (wishlistCheckbox) {
      wishlistCheckbox.value = variantId;
      wishlistCheckbox.disabled = !variant.available;
    }
  }

  async setupGrid(grid) {
    const wishlist = this.getWishlist();

    const emptyState = document.querySelector(this.selectors.emptyState);
    const addToCartButton = document.querySelector(this.selectors.addToCartButton);

    if (wishlist.length === 0) {
      grid.innerHTML = '';
      grid.classList.remove(this.GRID_LOADED_CLASS);
      if (emptyState) emptyState.classList.remove('hidden');
      if (addToCartButton) addToCartButton.classList.add('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (addToCartButton) addToCartButton.classList.remove('hidden');

    const requests = wishlist.map(({ handle, variantId }) => this.fetchProductCardHTML(handle, variantId));
    const responses = await Promise.all(requests);

    grid.innerHTML = responses.filter(Boolean).join('');
    grid.classList.add(this.GRID_LOADED_CLASS);

    document.dispatchEvent(
      new CustomEvent('shopify-wishlist:init-product-grid', {
        detail: { wishlist: wishlist },
      })
    );
  }

  initGrid() {
    const grid = document.querySelector(this.selectors.grid);
    if (!grid) {
      console.error('Wishlist grid not found!');
      return;
    }
    this.setupGrid(grid);
  }

  getWishlist() {
    const wishlist = localStorage.getItem(this.LOCAL_STORAGE_WISHLIST_KEY);
    return wishlist ? JSON.parse(wishlist) : [];
  }

  handleErrorMessage(errorMessage = false) {
    if (this.hideErrors) return;

    this.errorMessageWrapper = this.errorMessageWrapper || this.querySelector('[data-wishlist-error-message-wrapper]');
    if (!this.errorMessageWrapper) return;
    this.errorMessage = this.errorMessage || this.errorMessageWrapper.querySelector('[data-wishlist-error-message]');

    this.errorMessageWrapper.toggleAttribute('hidden', !errorMessage);

    if (errorMessage) {
      this.errorMessage.textContent = errorMessage;
    }
  }
}

customElements.define('shopify-wishlist', ShopifyWishlist);

class WishlistButton extends BaseComponent {
  constructor() {
    super();
    this.LOCAL_STORAGE_WISHLIST_KEY = 'shopify-wishlist';
    this.BUTTON_ACTIVE_CLASS = 'wishlist__active';
  }

  init() {
    this.productHandle = this.dataset.productHandle;
    this.variantId = this.dataset.variantId;

    if (!this.productHandle || !this.variantId) {
      return;
    }

    this.button = this.querySelector('button');
    this.setPressed(this.wishlistContains(this.variantId));

    this.listen(this, 'click', () => this.toggleWishlist());
  }

  toggleWishlist() {
    let wishlist = this.getWishlist();
    const existingItemIndex = wishlist.findIndex((item) => item.variantId === this.variantId);

    if (existingItemIndex === -1) {
      wishlist.push({ handle: this.productHandle, variantId: this.variantId });
    } else {
      wishlist.splice(existingItemIndex, 1);
    }

    this.setWishlist(wishlist);
    this.setPressed(existingItemIndex === -1);
    document.dispatchEvent(new Event('shopify-wishlist:updated'));
  }

  setPressed(pressed) {
    this.classList.toggle(this.BUTTON_ACTIVE_CLASS, pressed);
    this.button?.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  }

  getWishlist() {
    const wishlist = localStorage.getItem(this.LOCAL_STORAGE_WISHLIST_KEY);
    return wishlist ? JSON.parse(wishlist) : [];
  }

  setWishlist(array) {
    localStorage.setItem(this.LOCAL_STORAGE_WISHLIST_KEY, JSON.stringify(array));
    document.dispatchEvent(new CustomEvent('shopify-wishlist:updated', { detail: { wishlist: array } }));
  }

  wishlistContains(variantId) {
    return this.getWishlist().some((item) => item.variantId === variantId);
  }
}

customElements.define('wishlist-button', WishlistButton);

class WishlistLink extends BaseComponent {
  constructor() {
    super();
    this.LOCAL_STORAGE_WISHLIST_KEY = 'shopify-wishlist';
  }

  init() {
    this.countElement = this.querySelector('.count-badge');

    if (!this.countElement) {
      return;
    }

    this.updateCount();
    this.listen(document, 'shopify-wishlist:updated', () => this.updateCount());
  }

  getWishlistCount() {
    const wishlist = localStorage.getItem(this.LOCAL_STORAGE_WISHLIST_KEY);
    return wishlist ? JSON.parse(wishlist).length : 0;
  }

  updateCount() {
    const count = this.getWishlistCount();
    this.countElement.textContent = count;
    this.countElement.hidden = count === 0;
  }
}

customElements.define('wishlist-link', WishlistLink);
