class MarqueeSlider extends BaseComponent {
    constructor() {
        super();

        this.build = this.build.bind(this);
        this.onMouseEnter = this.onMouseEnter.bind(this);
        this.onMouseLeave = this.onMouseLeave.bind(this);
    }

    get prefersReducedMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    get pixelsPerSecond() {
        return parseFloat(this.dataset.pixelsPerSecond || '50') || 50;
    }

    init() {
        if (this.prefersReducedMotion) return;

        this.wrappers = [...this.querySelectorAll('[data-marquee-wrapper]')];

        if (!this.wrappers.length) return;

        if (this.hasAttribute('data-pause-on-hover')) {
            this.listen(this, 'mouseenter', this.onMouseEnter);
            this.listen(this, 'mouseleave', this.onMouseLeave);
        }

        this.resizeObserver = new ResizeObserver(() => {
            this.build();
        });

        this.resizeObserver.observe(this);

        this.wrappers.forEach((wrapper) => {
            this.resizeObserver.observe(wrapper);
        });


        requestAnimationFrame(() => {
            this.build();
        });
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.destroy();
        this.resizeObserver?.disconnect();
    }

    onMouseEnter() {
        this.timeline?.pause();
    }

    onMouseLeave() {
        this.timeline?.resume();
    }

    destroy() {
        this.timeline?.kill();
        this.timeline = null;
    }

    build() {
        const width = this.wrappers[0]?.offsetWidth;

        if (!width) return;

        this.destroy();

        this.timeline = gsap.timeline({
            repeat: -1,
        });

        this.timeline.to(this.wrappers, {
            xPercent: -100,
            duration: width / this.pixelsPerSecond,
            ease: 'none',
        });
    }
}

customElements.define('marquee-slider', MarqueeSlider);