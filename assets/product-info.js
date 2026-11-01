if (!customElements.get('product-info')) {
  customElements.define(
    'product-info',
    class ProductInfo extends BaseComponent {
      fetchController = undefined;
      pendingRequestUrl = null;

      init() {
        this.listen(this, 'optionValueSelectionChange', this.handleOptionValueChange.bind(this));
        this.dispatchEvent(new CustomEvent('product-info:loaded', { bubbles: true }));
      }

      handleOptionValueChange(event) {
        const { target, selectedOptionValues } = event.detail;
        if (!this.contains(target)) return;

        this.resetProductFormState();

        const productUrl = target.dataset.productUrl || this.pendingRequestUrl || this.dataset.url;
        this.pendingRequestUrl = productUrl;

        const shouldSwapProduct = this.dataset.url !== productUrl;
        const shouldFetchFullPage = this.dataset.updateUrl === 'true' && shouldSwapProduct;

        this.renderProductInfo({
          requestUrl: this.buildRequestUrl(productUrl, selectedOptionValues, shouldFetchFullPage),
          targetId: target.id,
          callback: this.handleUpdateProductInfo(productUrl),
        });
      }

      resetProductFormState() {
        this.productForm?.toggleSubmitButton(false);
        this.productForm?.handleErrorMessage();
      }

      renderProductInfo({ requestUrl, targetId, callback }) {
        this.fetchController?.abort();
        this.fetchController = new AbortController();

        fetch(requestUrl, { signal: this.fetchController.signal })
          .then((response) => response.text())
          .then((htmlString) => {
            this.pendingRequestUrl = null;
            const html = new DOMParser().parseFromString(htmlString, 'text/html');
            callback(html);
          })
          .then(() => {
            document.querySelector(`#${targetId}`)?.focus();
          })
          .catch((error) => {
            if (error.name !== 'AbortError') console.error(error);
          });
      }

      buildRequestUrl(url, optionValues, fullPage = false) {
        const params = [];
        if (!fullPage) params.push(`section_id=${this.sectionId}`);
        if (optionValues.length) params.push(`option_values=${optionValues.join(',')}`);
        return `${url}?${params.join('&')}`;
      }

      handleUpdateProductInfo(productUrl) {
        return (html) => {
          const variant = this.getSelectedVariant(html);

          this.replaceVariantSelectors(html);
          this.replaceTargets(html);

          this.updateURL(productUrl, variant?.id);
          this.updateVariantInputs(variant?.id);

          if (!variant) {
            this.setUnavailable();
            return;
          }

          this.clearVariantStatus();

          const newButton = html.getElementById(`ProductSubmitButton-${this.sectionId}`);
          this.productForm?.toggleSubmitButton(
            newButton?.hasAttribute('disabled') ?? true,
            newButton?.querySelector('[data-button-label]')?.textContent.trim() || window.variantStrings?.soldOut
          );
          this.productForm?.setUnitPrice(Number(newButton?.querySelector('[data-button-price]')?.dataset.amount));
        };
      }

      replaceVariantSelectors(html) {
        const newSelectors = html.querySelector('variant-selects');
        if (newSelectors && this.variantSelectors) {
          this.variantSelectors.replaceWith(newSelectors);
        }
      }

      replaceTargets(html) {
        this.querySelectorAll('[data-replace]').forEach((target) => {
          const key = target.dataset.replace;
          const replacement = html.querySelector(`[data-replace="${key}"]`);
          if (replacement) target.replaceWith(replacement);
        });
      }

      getSelectedVariant(productInfoNode) {
        const variantJSON = productInfoNode.querySelector('variant-selects [data-selected-variant]')?.innerHTML;
        return variantJSON ? JSON.parse(variantJSON) : null;
      }

      updateVariantInputs(variantId) {
        this.querySelectorAll(`#product-form-${this.dataset.section}`).forEach((form) => {
          const input = form.querySelector('input[name="id"]');
          input.value = variantId ?? '';
          input.dispatchEvent(new Event('change', { bubbles: true }));
        });
      }

      updateURL(url, variantId) {
        if (this.dataset.updateUrl === 'false') return;
        window.history.replaceState({}, '', `${url}${variantId ? `?variant=${variantId}` : ''}`);
      }

      setUnavailable() {
        const status = this.variantSelectors?.querySelector('[data-variant-status]');
        if (status) status.textContent = window.variantStrings?.unavailable ?? 'Unavailable';
        this.productForm?.toggleSubmitButton(true, window.variantStrings?.soldOut);
      }

      clearVariantStatus() {
        const status = this.variantSelectors?.querySelector('[data-variant-status]');
        if (status) status.textContent = '';
      }

      get productForm() {
        return this.querySelector('product-form');
      }

      get variantSelectors() {
        return this.querySelector('variant-selects');
      }

      get sectionId() {
        return this.dataset.originalSection || this.dataset.section;
      }
    }
  );
}