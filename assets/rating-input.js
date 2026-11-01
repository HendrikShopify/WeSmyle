/**
 * rating-input: star picker over native radios (snippets/rating-input.liquid).
 * Hovering a star previews that value, leaving restores the selected one. Each star label gets [data-filled].
 */
class RatingInput extends BaseComponent {
  init() {
    this.stars = [...this.querySelectorAll('[data-rating-star]')];
    this.listen(this, 'change', () => this.render());
    this.stars.forEach((star, index) => {
      this.listen(star, 'pointerenter', (e) => { if (e.pointerType === 'mouse') this.render(index + 1); });
    });
    this.listen(this, 'pointerleave', () => this.render());
    this.render();
  }

  get value() {
    const checked = this.querySelector('input:checked');
    return checked ? Number(checked.value) : 0;
  }

  render(preview) {
    const level = preview || this.value;
    this.stars.forEach((star, index) => star.toggleAttribute('data-filled', index < level));
  }
}

customElements.define('rating-input', RatingInput);
