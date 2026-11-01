/* <range-slider>: orders the two handles, paints the fill and syncs with number inputs in the same [data-range-group].
   Emits range:change { min, max } when a value is committed (release or keyboard step). */
class RangeSlider extends BaseComponent {
  init() {
    this.handles = {
      min: this.querySelector('[data-range-handle="min"]'),
      max: this.querySelector('[data-range-handle="max"]'),
    };
    const group = this.closest('[data-range-group]') || this.parentElement;
    this.fields = {
      min: group?.querySelector('[data-range-input="min"]'),
      max: group?.querySelector('[data-range-input="max"]'),
    };
    this.step = Number(this.dataset.step) || 1;
    this.bound = { min: Number(this.dataset.min), max: Number(this.dataset.max) };
    // a range input snaps to its step, so a max like 34.68 with step 1 tops out at 34; that top value still means "no limit"
    this.top = this.bound.min + Math.floor((this.bound.max - this.bound.min) / this.step + 1e-9) * this.step;

    for (const side of ['min', 'max']) {
      this.listen(this.handles[side], 'input', () => this.fromHandle(side));
      this.listen(this.handles[side], 'change', () => this.commit());
      this.listen(this.fields[side], 'change', () => this.fromField(side));
    }
    this.paint();
  }

  get values() {
    return { min: Number(this.handles.min.value), max: Number(this.handles.max.value) };
  }

  fromHandle(side) {
    const { min, max } = this.values;
    if (side === 'min' && min > max) this.handles.min.value = max;
    if (side === 'max' && max < min) this.handles.max.value = min;
    this.paint();
    this.writeFields();
  }

  fromField(side) {
    const field = this.fields[side];
    const raw = parseFloat(String(field.value).replace(',', '.'));
    if (Number.isNaN(raw)) {
      // an empty field falls back to the bound, which means "no limit"
      this.handles[side].value = this.bound[side];
    } else {
      this.handles[side].value = Math.min(Math.max(raw, this.bound.min), this.bound.max);
    }
    this.fromHandle(side);
    this.commit();
  }

  writeFields() {
    const { min, max } = this.values;
    if (this.fields.min) this.fields.min.value = min <= this.bound.min ? '' : min;
    if (this.fields.max) this.fields.max.value = max >= this.top ? '' : max;
  }

  paint() {
    const span = this.bound.max - this.bound.min || 1;
    const { min, max } = this.values;
    this.style.setProperty('--lo', ((min - this.bound.min) * 100) / span);
    this.style.setProperty('--hi', ((max - this.bound.min) * 100) / span);
    // when both handles sit at the top, lift the low one so it can still be dragged down
    this.handles.min.style.zIndex = min >= this.top - this.step ? 1 : '';
  }

  /* Back to the full range and empty fields; the caller decides when to submit. */
  reset() {
    this.handles.min.value = this.bound.min;
    this.handles.max.value = this.bound.max;
    this.paint();
    this.writeFields();
  }

  commit() {
    this.emit('range:change', this.values);
  }
}

customElements.define('range-slider', RangeSlider);
