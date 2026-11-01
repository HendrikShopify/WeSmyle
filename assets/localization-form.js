/**
 * localization-form: submits Shopify's localization form when a language is picked.
 * Markup comes from snippets/localization-selector.liquid; open/close and keyboard come from custom-select.js.
 */
class LocalizationForm extends BaseComponent {
  init() {
    this.form = this.querySelector('form');
    this.listen(this, 'select:change', () => this.form?.submit());
  }
}

customElements.define('localization-form', LocalizationForm);
