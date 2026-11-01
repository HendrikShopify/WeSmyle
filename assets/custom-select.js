/**
 * custom-select: accessible select-only combobox (button trigger + listbox + hidden input).
 * Markup comes from snippets/select.liquid. Keyboard: Arrows, Home, End, Enter, Space, Escape, type-ahead.
 * Emits 'select:change' on the element and a native 'change' on the hidden input.
 */
class CustomSelect extends BaseComponent {
  init() {
    this.trigger = this.querySelector('button[aria-haspopup="listbox"]');
    this.listbox = this.querySelector('[role="listbox"]');
    this.options = [...this.querySelectorAll('[role="option"]')];
    this.hiddenInput = this.querySelector('input[type="hidden"]');
    this.selectedLabel = this.querySelector('[data-selected-label]');
    this.chevron = this.querySelector('.select__chevron');
    this.typeahead = '';
    this.typeaheadTimer = null;

    if (!this.trigger || !this.listbox) return;

    this.isOpen = this.trigger.getAttribute('aria-expanded') === 'true';
    const selected = this.options.findIndex((o) => o.getAttribute('aria-selected') === 'true');
    this.activeIndex = selected > -1 ? selected : 0;

    this.listen(this.trigger, 'click', () => this.toggle());
    this.options.forEach((option, index) => {
      this.listen(option, 'click', () => {
        if (option.getAttribute('aria-disabled') === 'true') return;
        this.select(index);
        this.close();
        this.trigger.focus();
      });
    });
    this.listen(this, 'keydown', (e) => this.onKeydown(e));
    this.listen(this, 'focusout', (e) => { if (!this.contains(e.relatedTarget)) this.close(); });
    this.listen(document, 'click', (e) => { if (!this.contains(e.target)) this.close(); });
  }

  toggle() { this.isOpen ? this.close() : this.open(); }

  open() {
    if (this.isOpen || this.trigger.disabled) return;
    this.isOpen = true;
    this.listbox.hidden = false;
    this.trigger.setAttribute('aria-expanded', 'true');
    this.chevron?.classList.add('rotate-180');
    this.focusOption(this.activeIndex);
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.listbox.hidden = true;
    this.trigger.setAttribute('aria-expanded', 'false');
    this.chevron?.classList.remove('rotate-180');
  }

  select(index) {
    const option = this.options[index];
    if (!option || option.getAttribute('aria-disabled') === 'true') return;
    this.options.forEach((o) => {
      o.setAttribute('aria-selected', 'false');
      o.querySelector('.menu-item__check')?.classList.add('invisible');
    });
    option.setAttribute('aria-selected', 'true');
    option.querySelector('.menu-item__check')?.classList.remove('invisible');
    this.activeIndex = index;

    const value = option.dataset.value ?? '';
    const label = (option.dataset.label ?? option.textContent).trim();
    if (this.selectedLabel) {
      this.selectedLabel.textContent = label;
      this.selectedLabel.classList.remove('text-text-muted');
    }
    if (this.hiddenInput) {
      Object.entries(option.dataset).forEach(([k, v]) => { if (k !== 'value' && k !== 'label') this.hiddenInput.dataset[k] = v; });
      if (this.hiddenInput.value !== value) {
        this.hiddenInput.value = value;
        this.hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    this.emit('select:change', { value, label, option, select: this });
  }

  focusOption(index) {
    if (!this.options.length) return;
    if (index < 0) index = this.options.length - 1;
    if (index >= this.options.length) index = 0;
    this.activeIndex = index;
    const option = this.options[index];
    option.focus({ preventScroll: true });
    option.scrollIntoView({ block: 'nearest' });
  }

  onKeydown(event) {
    const { key } = event;
    if (key === 'Tab') { this.close(); return; }
    if (key === 'Escape') { event.preventDefault(); this.close(); this.trigger.focus(); return; }
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault();
      if (!this.isOpen) { this.open(); return; }
      this.focusOption(this.activeIndex + (key === 'ArrowDown' ? 1 : -1));
      return;
    }
    if (key === 'Home' || key === 'End') {
      if (!this.isOpen) return;
      event.preventDefault();
      this.focusOption(key === 'Home' ? 0 : this.options.length - 1);
      return;
    }
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      if (!this.isOpen) { this.open(); return; }
      this.select(this.activeIndex);
      this.close();
      this.trigger.focus();
      return;
    }
    if (key.length === 1 && /\S/.test(key)) {
      clearTimeout(this.typeaheadTimer);
      this.typeahead += key.toLowerCase();
      this.typeaheadTimer = setTimeout(() => { this.typeahead = ''; }, 500);
      const start = this.isOpen ? this.activeIndex + 1 : 0;
      const order = [...this.options.keys()].map((i) => (i + start) % this.options.length);
      const hit = order.find((i) => this.options[i].textContent.trim().toLowerCase().startsWith(this.typeahead));
      if (hit === undefined) return;
      if (this.isOpen) this.focusOption(hit); else this.select(hit);
    }
  }
}

customElements.define('custom-select', CustomSelect);
