class ArticleShare extends BaseComponent {
  init() {
    this.status = this.$('[data-share-status]');
    const share = this.$('[data-share]');
    const copy = this.$('[data-copy-link]');
    const data = { title: this.dataset.title, url: this.dataset.url };

    if (share && navigator.share && (!navigator.canShare || navigator.canShare(data))) {
      share.hidden = false;
      this.listen(share, 'click', () => navigator.share(data).catch(() => {}));
    }

    if (copy) {
      this.listen(copy, 'click', async () => {
        try {
          await navigator.clipboard.writeText(data.url);
          this.announce(this.dataset.copiedLabel);
        } catch (e) {
          window.prompt(this.dataset.copiedLabel, data.url);
        }
      });
    }
  }

  announce(text) {
    if (!this.status) return;
    this.status.textContent = '';
    requestAnimationFrame(() => {
      this.status.textContent = text;
    });
  }
}

customElements.define('article-share', ArticleShare);
