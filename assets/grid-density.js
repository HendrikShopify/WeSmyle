/* <grid-density>: switches the product grid between Large and Small cards.
   The grid container (#ProductGridContainer) holds data-density (desktop) and data-density-mobile; the CSS in
   tailwind.input.css turns those into columns. The choice is stored per breakpoint, so a phone and a desktop can differ.
   Filtering swaps the grid's innerHTML only, so the container (and the choice) survives. */
class GridDensity extends BaseComponent {
  init() {
    this.target = (this.closest('collection-filters') || document).querySelector('#ProductGridContainer');
    if (!this.target) return;
    this.mq = window.matchMedia('(min-width: 1024px)');
    this.buttons = [...this.querySelectorAll('[data-density]')];
    this.target.dataset.density = this.stored('desktop') || this.dataset.current || 'large';
    this.target.dataset.densityMobile = this.stored('mobile') || this.dataset.currentMobile || 'small';

    this.buttons.forEach((button) => this.listen(button, 'click', () => this.choose(button.dataset.density)));
    this.listen(this.mq, 'change', () => this.sync());
    this.sync();
  }

  get breakpoint() {
    return this.mq.matches ? 'desktop' : 'mobile';
  }

  get attribute() {
    return this.breakpoint === 'desktop' ? 'density' : 'densityMobile';
  }

  stored(breakpoint) {
    try {
      const value = localStorage.getItem(`density:${breakpoint}`);
      return value === 'large' || value === 'small' ? value : null;
    } catch (error) {
      return null;
    }
  }

  choose(value) {
    this.target.dataset[this.attribute] = value;
    try {
      localStorage.setItem(`density:${this.breakpoint}`, value);
    } catch (error) {
      /* storage can be blocked: the choice then lasts for this page only */
    }
    this.sync();
  }

  sync() {
    const current = this.target.dataset[this.attribute];
    this.buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.density === current)));
  }
}

customElements.define('grid-density', GridDensity);
