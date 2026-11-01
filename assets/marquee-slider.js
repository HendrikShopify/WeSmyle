class MarqueeSlider extends BaseComponent {
    constructor() {
        super();

        this.onMouseEnter = this.onMouseEnter.bind(this);
        this.onMouseLeave = this.onMouseLeave.bind(this);
    }

    init() {
        this.wrappers = [...this.querySelectorAll('[data-marquee-wrapper]')];

        if (!this.wrappers.length) return;

        this.pixelsPerSecond =
            parseFloat(this.dataset.pixelsPerSecond || '50') || 50;

        const build = () => {
            if (!this.isConnected || this.timeline) return true;

            const width = this.wrappers[0].offsetWidth;

            if (!width) return false;

            if (this.hasAttribute('data-pause-on-hover')) {
                this.listen(this, 'mouseenter', this.onMouseEnter);
                this.listen(this, 'mouseleave', this.onMouseLeave);
            }

            this.timeline = gsap.timeline({
                repeat: -1,
            });

            this.timeline.to(this.wrappers, {
                xPercent: -100,
                duration: width / this.pixelsPerSecond,
                ease: 'none',
            });

            return true;
        };

        if (!build()) {
            if (document.readyState === 'complete') {
                requestAnimationFrame(build);
            } else {
                this.listen(window, 'load', build, {
                    once: true,
                });
            }
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.timeline?.kill();
        this.timeline = null;
    }

    onMouseEnter() {
        this.timeline?.pause();
    }

    onMouseLeave() {
        this.timeline?.resume();
    }
}

customElements.define('marquee-slider', MarqueeSlider);