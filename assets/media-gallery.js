/*
  Swiper (swiper-bundle.min.js, loaded in theme.liquid) drives both tracks.
  <media-gallery data-layout data-count data-selected>
    [data-gallery-track]   Swiper container (.swiper > .swiper-wrapper > [data-gallery-slide].swiper-slide), one slide per media
    [data-g-thumb]         thumbnails (desktop), [data-carousel-to] dots, [data-carousel-current] counter
    [data-lightbox-open]   zoom button, opens <media-lightbox> at the current slide
    [data-variant-media]   JSON { variantId: 1-based media position }, slides to it on variant change
    Grid layout: Swiper only runs below lg; from lg the slides are a plain 2-column grid.
  <media-lightbox>
    <dialog> with [data-lightbox-track] (Swiper, created on first open), [data-lightbox-prev|next|close], [data-lightbox-current]
    open(index) / close() / setItems([{ type: 'photo'|'video', src, poster }]) for dynamic lightboxes (reviews; template[data-lightbox-photo|video]). Video slides use native controls and do not zoom. Click the image to zoom (2.5x at the click point), drag to pan while zoomed, click again to zoom out; swiping is off while zoomed.
  Events (bubble): gallery:change { index }, lightbox:open, lightbox:close
*/
(() => {
  const mediaReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ZOOM = 2.5;
  const speed = (instant) => (instant || mediaReducedMotion() ? 0 : 300);

  function syncIndicators(root, index, exclude) {
    const keep = (el) => !exclude || !el.closest(exclude);
    root.querySelectorAll('[data-carousel-to]').forEach((el) => {
      if (keep(el)) el.setAttribute('aria-selected', String(Number(el.dataset.carouselTo) === index));
    });
    root.querySelectorAll('[data-carousel-current]').forEach((el) => {
      if (keep(el)) el.textContent = index;
    });
  }

  if (!customElements.get('media-gallery')) {
    customElements.define(
      'media-gallery',
      class MediaGallery extends BaseComponent {
        init() {
          this.track = this.$('[data-gallery-track]');
          this.thumbs = [...this.$$('[data-g-thumb]')];
          this.count = Number(this.dataset.count) || 0;
          this.index = Number(this.dataset.selected) || 1;
          this.variantMedia = this.readVariantMedia();
          if (!this.track) return;

          this.setupSwiper();

          this.listen(this, 'click', (evt) => {
            const thumb = evt.target.closest('[data-g-thumb]');
            if (thumb && !thumb.closest('media-lightbox')) return this.select(Number(thumb.dataset.thumbIndex));
            const dot = evt.target.closest('[data-carousel-to]');
            if (dot && !dot.closest('media-lightbox')) return this.select(Number(dot.dataset.carouselTo));
            const open = evt.target.closest('[data-lightbox-open]');
            if (open) {
              const slide = open.closest('[data-gallery-slide]');
              const slides = [...this.$$('[data-gallery-slide]')];
              this.lightbox?.open(slide ? slides.indexOf(slide) + 1 : this.index);
            }
          });
          this.listen(this.track, 'keydown', (evt) => {
            if (evt.key === 'ArrowRight') this.select(this.index + 1);
            if (evt.key === 'ArrowLeft') this.select(this.index - 1);
          });
          this.listen(this, 'lightbox:close', (evt) => this.select(evt.detail.index));

          const info = this.closest('product-info');
          if (info) this.listen(info, 'change', (evt) => this.onVariantChange(evt));

          this.sync();
        }

        disconnectedCallback() {
          super.disconnectedCallback();
          this.destroySwiper();
        }

        setupSwiper() {
          if (!window.Swiper) return;
          const gridFromLg = this.dataset.layout === 'grid';
          const desktop = window.matchMedia('(min-width: 1024px)');
          const apply = () => {
            if (gridFromLg && desktop.matches) this.destroySwiper();
            else if (!this.swiper) this.createSwiper();
          };
          apply();
          this.listen(desktop, 'change', apply);
        }

        createSwiper() {
          this.swiper = new Swiper(this.track, {
            slidesPerView: 1,
            speed: 1000,
            initialSlide: this.index - 1,
            watchOverflow: true,
          });
          this.swiper.on('slideChange', () => this.select(this.swiper.activeIndex + 1, { scroll: false }));
        }

        destroySwiper() {
          this.swiper?.destroy(true, true);
          this.swiper = null;
        }

        get lightbox() {
          return this.$('media-lightbox');
        }

        readVariantMedia() {
          try {
            return JSON.parse(this.$('[data-variant-media]')?.textContent || '{}');
          } catch (e) {
            return {};
          }
        }

        onVariantChange(evt) {
          const input = evt.target;
          if (!input.matches?.('input[name="id"]')) return;
          const position = this.variantMedia[input.value];
          if (position) this.select(position);
        }

        select(index, { scroll = true } = {}) {
          if (!this.count) return;
          index = Math.min(Math.max(index, 1), this.count);
          if (scroll) {
            if (this.swiper) this.swiper.slideTo(index - 1, speed());
            else this.$$('[data-gallery-slide]')[index - 1]?.scrollIntoView({ behavior: mediaReducedMotion() ? 'auto' : 'smooth', block: 'nearest', inline: 'nearest' });
          }
          if (index === this.index && !scroll) return;
          this.index = index;
          this.sync();
          this.emit('gallery:change', { index });
        }

        sync() {
          this.thumbs.forEach((thumb) => thumb.setAttribute('aria-current', String(Number(thumb.dataset.thumbIndex) === this.index)));
          syncIndicators(this, this.index, 'media-lightbox');
        }
      }
    );
  }

  if (!customElements.get('media-lightbox')) {
    customElements.define(
      'media-lightbox',
      class MediaLightbox extends BaseComponent {
        init() {
          this.dialog = this.$('dialog');
          this.track = this.$('[data-lightbox-track]');
          this.count = Number(this.dataset.count) || 0;
          this.index = 1;
          this.pan = { x: 0, y: 0 };
          this.drag = null;
          if (!this.dialog || !this.track) return;

          this.listen(this.dialog, 'click', (evt) => {
            if (evt.target === this.dialog || evt.target.closest('[data-lightbox-close]')) return this.close();
            if (evt.target.closest('[data-lightbox-prev]')) return this.go(this.index - 1);
            if (evt.target.closest('[data-lightbox-next]')) return this.go(this.index + 1);
          });
          this.listen(this.dialog, 'dragstart', (evt) => evt.preventDefault());
          this.listen(this.dialog, 'pointerdown', (evt) => this.dragStart(evt));
          this.listen(this.dialog, 'pointermove', (evt) => this.dragMove(evt));
          this.listen(this.dialog, 'pointerup', (evt) => this.dragEnd(evt));
          this.listen(this.dialog, 'pointercancel', (evt) => this.dragEnd(evt, true));
          this.listen(this.dialog, 'keydown', (evt) => {
            if (evt.key === 'ArrowRight') this.go(this.index + 1);
            if (evt.key === 'ArrowLeft') this.go(this.index - 1);
          });
          this.listen(this.dialog, 'close', () => this.onClose());
        }

        disconnectedCallback() {
          super.disconnectedCallback();
          this.swiper?.destroy(true, true);
          this.swiper = null;
        }

        ensureSwiper() {
          if (!window.Swiper) return;
          if (this.swiper) return this.swiper.update();
          this.swiper = new Swiper(this.track, { slidesPerView: 1, speed: 300, watchOverflow: true });
          this.swiper.on('slideChange', () => this.update(this.swiper.activeIndex + 1));
        }

        setItems(items) {
          const wrapper = this.$('.swiper-wrapper');
          const photoTemplate = this.$('template[data-lightbox-photo]');
          const videoTemplate = this.$('template[data-lightbox-video]');
          if (!wrapper || !photoTemplate || !videoTemplate) return;
          this.resetZoom();
          this.swiper?.destroy(true, true);
          this.swiper = null;
          wrapper.replaceChildren();
          items.forEach((item) => {
            const isVideo = item.type === 'video';
            const slide = (isVideo ? videoTemplate : photoTemplate).content.cloneNode(true);
            if (isVideo) {
              const video = slide.querySelector('[data-lightbox-video]');
              video.src = item.src;
              if (item.poster) video.poster = item.poster;
            } else {
              slide.querySelector('[data-lightbox-photo-img]').src = item.src;
            }
            wrapper.appendChild(slide);
          });
          this.count = items.length;
          const total = this.$('[data-lightbox-total]');
          if (total) total.textContent = this.count;
          this.index = 1;
        }

        pauseVideos(except) {
          this.$$('video').forEach((video) => {
            if (video !== except) video.pause();
          });
        }

        open(index = 1) {
          if (!this.dialog || this.dialog.open) return;
          this.closed = false;
          this.dialog.setAttribute('data-scroll-lock', 'true');
          this.dialog.showModal();
          this.ensureSwiper();
          this.go(index, true);
          this.$$('[data-lightbox-slide]')[this.index - 1]?.querySelector('video')?.play()?.catch(() => {});
          this.emit('lightbox:open', { index: this.index });
        }

        close() {
          if (!this.dialog?.open) return;
          this.dialog.close();
          this.onClose();
        }

        onClose() {
          if (this.closed) return;
          this.closed = true;
          this.pauseVideos();
          this.dialog.setAttribute('data-scroll-lock', 'false');
          this.resetZoom();
          this.emit('lightbox:close', { index: this.index });
        }

        go(index, instant = false) {
          index = Math.min(Math.max(index, 1), this.count);
          this.resetZoom();
          this.swiper?.slideTo(index - 1, speed(instant));
          this.update(index);
        }

        update(index) {
          if (index !== this.index) this.resetZoom();
          this.index = index;
          this.pauseVideos(this.$$('[data-lightbox-slide]')[index - 1]?.querySelector('video'));
          const current = this.$('[data-lightbox-current]');
          if (current) current.textContent = index;
          const prev = this.$('[data-lightbox-prev]');
          const next = this.$('[data-lightbox-next]');
          if (prev) {
            prev.hidden = this.count < 2;
            prev.disabled = index <= 1;
          }
          if (next) {
            next.hidden = this.count < 2;
            next.disabled = index >= this.count;
          }
        }

        dragStart(evt) {
          const el = evt.target.closest?.('[data-zoom-target]');
          if (!el || evt.button > 0) return;
          this.drag = { el, id: evt.pointerId, x: evt.clientX, y: evt.clientY, moved: false, wasZoomed: el.dataset.zoomed === 'true', px: this.pan.x, py: this.pan.y };
          el.setPointerCapture?.(evt.pointerId);
        }

        dragMove(evt) {
          const d = this.drag;
          if (!d || d.id !== evt.pointerId || !d.wasZoomed) return;
          const dx = evt.clientX - d.x;
          const dy = evt.clientY - d.y;
          if (!d.moved && Math.hypot(dx, dy) < 5) return;
          d.moved = true;
          d.el.setAttribute('data-dragging', 'true');
          this.setPan(d.el, d.px + dx, d.py + dy);
        }

        dragEnd(evt, cancelled = false) {
          const d = this.drag;
          if (!d || d.id !== evt.pointerId) return;
          this.drag = null;
          d.el.releasePointerCapture?.(evt.pointerId);
          d.el.removeAttribute('data-dragging');
          if (cancelled || d.moved) return;
          if (d.wasZoomed) return this.resetZoom();
          this.zoomIn(d.el, evt);
        }

        zoomIn(el, evt) {
          const rect = el.getBoundingClientRect();
          this.setPan(el, -(evt.clientX - (rect.left + rect.width / 2)) * (ZOOM - 1), -(evt.clientY - (rect.top + rect.height / 2)) * (ZOOM - 1));
          el.setAttribute('data-zoomed', 'true');
          this.dialog.setAttribute('data-zoomed', 'true');
          if (this.swiper) this.swiper.allowTouchMove = false;
        }

        setPan(el, x, y) {
          const rect = el.getBoundingClientRect();
          const maxX = Math.max(0, (rect.width * ZOOM - window.innerWidth) / 2);
          const maxY = Math.max(0, (rect.height * ZOOM - window.innerHeight) / 2);
          this.pan = { x: Math.min(Math.max(x, -maxX), maxX), y: Math.min(Math.max(y, -maxY), maxY) };
          el.style.setProperty('--tx', `${this.pan.x}px`);
          el.style.setProperty('--ty', `${this.pan.y}px`);
        }

        resetZoom() {
          this.pan = { x: 0, y: 0 };
          this.$$('[data-zoom-target][data-zoomed]').forEach((el) => {
            el.setAttribute('data-zoomed', 'false');
            el.style.removeProperty('--tx');
            el.style.removeProperty('--ty');
          });
          this.dialog?.setAttribute('data-zoomed', 'false');
          if (this.swiper) this.swiper.allowTouchMove = true;
        }
      }
    );
  }
})();
