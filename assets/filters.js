/* <collection-filters data-section-id>: live filtering with Section Rendering.
   Wraps the toolbar, the filter drawer and the product grid. Any change in #filters-form (checkbox, radio, price field,
   range slider, sort) fetches the section with the new params and swaps the grid, counts, active filters and filter groups.
   Chips, Clear all, group Reset, pagination and the browser back button work too. Without JS every control is still a
   plain link or form field. */
class CollectionFilters extends BaseComponent {
  init() {
    this.sectionId = this.dataset.sectionId;
    this.form = this.querySelector('#filters-form');
    if (!this.form || !this.sectionId) return;
    this.cache = new Map();
    this.timer = null;
    this.total = Number(this.querySelector('[data-product-count]')?.dataset.total) || 0;

    this.listen(this, 'change', (e) => this.onChange(e));
    this.listen(this, 'range:change', () => this.queue());
    this.listen(this, 'click', (e) => this.onClick(e));
    this.listen(this.form, 'submit', (e) => { e.preventDefault(); this.apply(); });
    this.listen(window, 'popstate', () => this.render(window.location.search.slice(1), false));
  }

  onChange(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.dataset.rangeHandle !== undefined) return; // range-slider emits range:change on release
    if (input.name === 'sort_by') this.syncSort(input.value);
    if (input.form !== this.form && !this.form.contains(input)) return;
    this.queue();
  }

  /* The toolbar dropdown (hidden input) and the drawer radios both carry sort_by: keep them in step. */
  syncSort(value) {
    this.querySelectorAll('input[name="sort_by"]').forEach((el) => {
      if (el.type === 'radio') el.checked = el.value === value;
      else el.value = value;
    });
    this.querySelectorAll('.sort-dropdown').forEach((dropdown) => {
      dropdown.querySelectorAll('[role="option"]').forEach((option) => {
        const selected = option.dataset.value === value;
        option.setAttribute('aria-selected', selected);
        option.querySelector('.menu-item__check')?.classList.toggle('invisible', !selected);
        if (selected) dropdown.querySelector('[data-selected-label]').textContent = option.textContent.trim();
      });
    });
  }

  onClick(event) {
    const target = event.target;

    const clear = target.closest('[data-filter-clear]');
    if (clear) {
      event.preventDefault();
      this.clearAll();
      return;
    }

    const reset = target.closest('[data-filter-reset]');
    if (reset && reset.getAttribute('aria-disabled') !== 'true') {
      event.preventDefault();
      this.resetGroup(reset.closest('[data-filter-group]'));
      return;
    }

    const more = target.closest('[data-show-more]');
    if (more) {
      event.preventDefault();
      const list = more.closest('[data-show-more-list]');
      list.querySelectorAll('[data-show-more-extra]').forEach((item) => item.classList.remove('hidden'));
      more.remove();
      return;
    }

    const link = target.closest('[data-active-filters] a[href], [data-pagination] a[href]');
    if (link && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      const url = new URL(link.href);
      const paging = link.closest('[data-pagination]');
      this.render(url.search.slice(1), true).then(() => {
        if (paging) this.scrollToTop();
      });
    }
  }

  /* A new page starts at the top of the results, not where the pagination was. */
  scrollToTop() {
    const anchor = this.querySelector('[data-collection-toolbar]') || this.querySelector('#ProductGridContainer');
    if (!anchor) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    anchor.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }

  clearAll() {
    this.form.querySelectorAll('input[type="checkbox"]').forEach((c) => (c.checked = false));
    this.form.querySelectorAll('range-slider').forEach((slider) => slider.reset());
    this.queue(0);
  }

  resetGroup(group) {
    if (!group) return;
    group.querySelectorAll('input[type="checkbox"]').forEach((c) => (c.checked = false));
    group.querySelectorAll('range-slider').forEach((slider) => slider.reset());
    this.queue(0);
  }

  queue(delay = 300) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.apply(), delay);
  }

  get params() {
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(this.form)) {
      if (value === '') continue;
      if (key === 'sort_by' && params.has('sort_by')) continue;
      params.append(key, value);
    }
    return params.toString();
  }

  apply() {
    this.render(this.params, true);
  }

  async render(searchParams, push) {
    const url = `${window.location.pathname}?section_id=${this.sectionId}${searchParams ? '&' + searchParams : ''}`;
    this.abort?.abort();
    this.abort = new AbortController();
    const grid = this.querySelector('#ProductGridContainer');
    grid?.setAttribute('aria-busy', 'true');
    document.dispatchEvent(new Event('loading:start'));

    try {
      let html = this.cache.get(url);
      if (!html) {
        const response = await fetch(url, { signal: this.abort.signal });
        html = await response.text();
        this.cache.set(url, html);
      }
      this.swap(new DOMParser().parseFromString(html, 'text/html'));
      if (push) history.pushState({ searchParams }, '', `${window.location.pathname}${searchParams ? '?' + searchParams : ''}`);
    } catch (error) {
      if (error.name !== 'AbortError') console.error(error);
    } finally {
      grid?.removeAttribute('aria-busy');
      document.dispatchEvent(new Event('loading:end'));
    }
  }

  swap(doc) {
    const grid = doc.querySelector('#ProductGridContainer');
    if (grid) this.querySelector('#ProductGridContainer').innerHTML = grid.innerHTML;

    doc.querySelectorAll('[data-product-count]').forEach((next, i) => {
      const current = this.querySelectorAll('[data-product-count]')[i];
      if (!current) return;
      const count = Number(next.dataset.count);
      if (next.dataset.total) this.total = Number(next.dataset.total);
      let text = next.textContent;
      // search has no unfiltered total server side: build "13 of 64 products" from the one we saw before
      if (!next.dataset.total && this.total > count && next.dataset.labelFiltered) {
        text = next.dataset.labelFiltered.replace('__count__', count).replace('__total__', this.total);
      }
      current.textContent = text;
    });

    doc.querySelectorAll('[data-active-filters]').forEach((next, i) => {
      const current = this.querySelectorAll('[data-active-filters]')[i];
      if (current) current.outerHTML = next.outerHTML;
    });

    const badge = doc.querySelector('[data-filter-count]');
    const currentBadge = this.querySelector('[data-filter-count]');
    if (badge && currentBadge) {
      currentBadge.textContent = badge.textContent;
      currentBadge.hidden = badge.hidden || badge.textContent.trim() === '0';
    }

    const show = doc.querySelector('[data-filter-show-results]');
    const currentShow = this.querySelector('[data-filter-show-results]');
    if (show && currentShow) currentShow.textContent = show.textContent.trim();

    const focused = document.activeElement?.closest('[data-filter-group]');
    doc.querySelectorAll('[data-filter-group]').forEach((next) => {
      const current = this.querySelector(`[data-filter-group][data-filter-id="${CSS.escape(next.dataset.filterId)}"]`);
      if (!current) return;
      if (current === focused) {
        // keep the group the person is working in: only refresh the header badge and the summary
        current.querySelector('summary').outerHTML = next.querySelector('summary').outerHTML;
        const summary = current.querySelector('.filter-selection-summary');
        const nextSummary = next.querySelector('.filter-selection-summary');
        if (summary && nextSummary) summary.outerHTML = nextSummary.outerHTML;
      } else {
        const open = current.open;
        current.innerHTML = next.innerHTML;
        current.open = open;
      }
    });
  }
}

customElements.define('collection-filters', CollectionFilters);
