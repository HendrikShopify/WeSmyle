class VariantSelects extends BaseComponent {
  init() {
    this.listen(this, 'change', (event) => {
      const target = this.getInputForEventTarget(event.target);

      this.emit(
        'optionValueSelectionChange',
        {
          event,
          target,
          selectedOptionValues: this.selectedOptionValues,
        },
        { composed: true }
      );
    });
  }

  getInputForEventTarget(target) {
    return target;
  }

  get selectedOptionValues() {
    return Array.from(this.querySelectorAll('fieldset input:checked, fieldset input[type="hidden"][data-option-value-id]')).map(({ dataset }) => dataset.optionValueId);
  }
}

customElements.define('variant-selects', VariantSelects);
