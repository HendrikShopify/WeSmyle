/*
  <carousel-track> wraps a Swiper carousel (swiper-bundle.min.js, loaded in theme.liquid)
    [data-carousel-track]    Swiper container: .swiper > .swiper-wrapper > [data-carousel-slide].swiper-slide
    [data-carousel-prev|next] arrow buttons, disabled at the ends
    [data-carousel-to]       progress segments (carousel-indicators), rebuilt to one per stop; aria-selected marks the current stop
  The track is full width; slidesOffsetBefore/After keep the first and last card on the page margin (the [data-page-edge] content edge).
*/
if (!customElements.get('carousel-track')) {
  customElements.define(
    'carousel-track',
    class CarouselTrack extends BaseComponent {
      init() {
        this.track = this.$('[data-carousel-track]');
        if (!this.track || !window.Swiper) return;
        this.prev = this.$('[data-carousel-prev]');
        this.next = this.$('[data-carousel-next]');
        this.indicators = this.$('.carousel-indicators');

        const edge = this.edge();
        this.swiper = new Swiper(this.track, {
          slidesPerView: 'auto',
          spaceBetween: 8,
          speed: 300,
          slidesOffsetBefore: edge,
          slidesOffsetAfter: edge,
          watchOverflow: true,
          // Swiper's a11y slides to any focused card that is not tracked as visible. Without this, closing the quick view
          // (focus returns to the card's button) pulls that card to the first position.
          watchSlidesProgress: true,
          breakpoints: { 1024: { spaceBetween: 12 } },
        });
        this.swiper.on('slideChange', () => this.sync());
        this.swiper.on('reachBeginning', () => this.sync());
        this.swiper.on('reachEnd', () => this.sync());
        this.swiper.on('fromEdge', () => this.sync());
        this.swiper.on('setTranslate', () => this.sync());
        this.swiper.on('snapGridLengthChange', () => this.sync());

        this.listen(window, 'resize', () => {
          const next = this.edge();
          this.swiper.params.slidesOffsetBefore = next;
          this.swiper.params.slidesOffsetAfter = next;
          this.swiper.update();
          this.sync();
        });
        this.listen(this, 'click', (evt) => {
          if (evt.target.closest('[data-carousel-prev]')) return this.swiper.slidePrev();
          if (evt.target.closest('[data-carousel-next]')) return this.swiper.slideNext();
          const to = evt.target.closest('[data-carousel-to]');
          if (to) this.swiper.slideTo(Number(to.dataset.carouselTo) - 1);
        });
        this.sync();
      }

      disconnectedCallback() {
        super.disconnectedCallback();
        this.swiper?.destroy(true, true);
        this.swiper = null;
      }

      // Left edge of the page content (container padding included), so cards line up with the heading.
      edge() {
        const container = this.$('[data-page-edge]');
        if (!container) return 0;
        return container.getBoundingClientRect().left + (parseFloat(getComputedStyle(container).paddingLeft) || 0);
      }

      // One progress segment per stop the carousel can rest on (fewer than the cards, as several are visible at once).
      buildSegments() {
        const bar = this.indicators;
        if (!bar || !bar.children.length) return;
        const stops = Math.max(this.swiper.snapGrid.length, 1);
        if (bar.children.length !== stops) {
          const template = bar.children[0];
          const label = template.getAttribute('aria-label')?.replace(/\d+$/, '') ?? '';
          bar.replaceChildren(
            ...Array.from({ length: stops }, (_, i) => {
              const segment = template.cloneNode(false);
              segment.dataset.carouselTo = String(i + 1);
              segment.setAttribute('aria-label', `${label}${i + 1}`);
              return segment;
            })
          );
        }
        bar.hidden = stops <= 1;
      }

      sync() {
        const swiper = this.swiper;
        if (!swiper) return;
        this.buildSegments();
        const stops = Math.max(swiper.snapGrid.length, 1);
        let index = swiper.isEnd ? stops : swiper.snapIndex + 1;
        index = Math.min(Math.max(index, 1), stops);
        if (this.prev) this.prev.disabled = swiper.isBeginning;
        if (this.next) this.next.disabled = swiper.isEnd;
        this.$$('[data-carousel-to]').forEach((el) => {
          el.setAttribute('aria-selected', String(Number(el.dataset.carouselTo) === index));
        });
      }
    }
  );
}
