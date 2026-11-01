/*
  <newsletter-popup hidden data-delay="8" data-snooze="7" data-form-id="popup-newsletter">
    [data-popup-bg]       overlay
    [data-popup-content]  panel (role=dialog)
    [data-popup-close]    close control
  Opens once after data-delay seconds. A close is remembered in localStorage for data-snooze days.
  Waits for the cookie banner and for open drawers. A submitted popup form (success or error) reopens it straight away.
  Events (bubble): newsletter-popup:open, newsletter-popup:close.
*/
if (!customElements.get('newsletter-popup')) {
  customElements.define(
    'newsletter-popup',
    class NewsletterPopup extends BaseComponent {
      static storageKey = 'blanc:newsletter-popup';

      constructor() {
        super();
        this.isOpen = false;
        this.timer = null;
        this.inertedElements = [];
      }

      init() {
        this.backdrop = this.querySelector('[data-popup-bg]');
        this.content = this.querySelector('[data-popup-content]');
        this.setAttribute('aria-hidden', 'true');

        this.listen(this, 'click', (evt) => {
          if (evt.target.closest('[data-popup-close]') || evt.target === this.backdrop) this.close();
        });
        this.listen(this, 'keyup', (evt) => {
          if (evt.code === 'Escape' && this.isOpen) this.close();
        });

        if (this.hasFormResult) {
          this.open();
          return;
        }
        if (this.isSnoozed || this.isExcludedPage) return;
        this.schedule(Number(this.dataset.delay) * 1000);
      }

      disconnectedCallback() {
        clearTimeout(this.timer);
        this.clearInert();
        super.disconnectedCallback();
      }

      /** The popup form came back from a submit: it carries a success or an error message. */
      get hasFormResult() {
        return Boolean(this.querySelector('.helper-text'));
      }

      get isExcludedPage() {
        return /^\/(cart|checkouts|password)/.test(window.location.pathname);
      }

      get isSnoozed() {
        try {
          const closedAt = Number(localStorage.getItem(NewsletterPopup.storageKey));
          return closedAt && Date.now() - closedAt < Number(this.dataset.snooze) * 86400000;
        } catch (e) {
          return false;
        }
      }

      remember() {
        try {
          localStorage.setItem(NewsletterPopup.storageKey, String(Date.now()));
        } catch (e) {
          /* private mode: the popup may show again on the next page */
        }
      }

      /** Something else owns the screen: the cookie banner or an open drawer. */
      get isBusy() {
        const banner = document.querySelector('cookie-consent [data-banner]');
        const bannerVisible = banner && !banner.hidden;
        const drawerOpen = document.querySelector('side-drawer[data-scroll-lock="true"]');
        return Boolean(bannerVisible || drawerOpen);
      }

      schedule(wait) {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => {
          if (this.isBusy) this.schedule(4000);
          else this.open();
        }, wait);
      }

      open() {
        if (this.isOpen) return;
        this.isOpen = true;
        this.previousFocus = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
        this.hidden = false;
        this.setAttribute('aria-hidden', 'false');
        this.dataset.scrollLock = 'true';
        this.applyInert();
        // A short timeout instead of requestAnimationFrame so the fade also runs in a background tab.
        setTimeout(() => {
          this.dataset.open = 'true';
          trapFocus(this, this.content);
        }, 20);
        this.emit('newsletter-popup:open');
      }

      close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.remember();
        this.dataset.open = 'false';
        this.dataset.scrollLock = 'false';
        this.clearInert();
        removeTrapFocus(this.previousFocus);
        this.previousFocus = null;
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        setTimeout(
          () => {
            this.hidden = true;
            this.setAttribute('aria-hidden', 'true');
          },
          reduced ? 0 : 300
        );
        this.emit('newsletter-popup:close');
      }

      applyInert() {
        this.clearInert();
        this.inertedElements = Array.from(document.body.children).filter(
          (el) => el !== this && el.nodeName !== 'SCRIPT' && !el.contains(this)
        );
        this.inertedElements.forEach((el) => {
          el.inert = true;
        });
      }

      clearInert() {
        this.inertedElements.forEach((el) => {
          el.inert = false;
        });
        this.inertedElements = [];
      }
    }
  );
}
