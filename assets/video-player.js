/*
  <video-player> wraps the Video snippet (snippets/video.liquid).
    [data-video-play]    start playing (Paused shows it in the centre)
    [data-video-pause]   full-size button over the video while playing: a tap pauses
    [data-video-sound]   toggles muted; data-muted on the element drives which icon shows
    [data-video-progress] .progress-bar inside follows currentTime
  data-state is paused or playing, data-muted is true or false. Only one player plays at a time, and a player pauses when it leaves the viewport.
  Without a <video> (the placeholder) the buttons still switch the states, so the design can be judged.
*/
if (!customElements.get('video-player')) {
  customElements.define(
    'video-player',
    class VideoPlayer extends BaseComponent {
      init() {
        this.video = this.$('video');
        this.bar = this.$('.progress-bar');
        this.fill = this.bar ? this.bar.firstElementChild : null;
        if (this.fill) this.fill.style.transition = 'none';

        this.listen(this, 'click', (evt) => {
          if (evt.target.closest('[data-video-play]')) return this.play();
          if (evt.target.closest('[data-video-pause]')) return this.pause();
          if (evt.target.closest('[data-video-sound]')) return this.toggleSound();
        });
        this.listen(document, 'video-player:play', (evt) => {
          if (evt.detail.player !== this) this.pause();
        });
        if (this.video) {
          this.listen(this.video, 'timeupdate', () => this.updateProgress());
          this.listen(this.video, 'playing', () => this.tick());
          this.listen(this.video, 'ended', () => this.pause());
        }
        if ('IntersectionObserver' in window) {
          this.observer = new IntersectionObserver(
            (entries) => {
              if (!entries[0].isIntersecting && this.dataset.state === 'playing') this.pause();
            },
            { threshold: 0.25 }
          );
          this.observer.observe(this);
        }
      }

      disconnectedCallback() {
        super.disconnectedCallback();
        this.observer?.disconnect();
        cancelAnimationFrame(this.frame);
      }

      play() {
        this.dataset.state = 'playing';
        this.emit('video-player:play', { player: this });
        if (this.video) {
          const started = this.video.play();
          if (started) started.catch(() => (this.dataset.state = 'paused'));
        }
      }

      pause() {
        this.dataset.state = 'paused';
        if (this.video) this.video.pause();
      }

      toggleSound() {
        const muted = this.dataset.muted !== 'true';
        this.dataset.muted = String(muted);
        if (this.video) this.video.muted = muted;
      }

      // timeupdate only fires about 4 times a second, which makes the bar jump; follow currentTime every frame while playing.
      tick() {
        cancelAnimationFrame(this.frame);
        this.updateProgress();
        if (this.dataset.state === 'playing' && !this.video.paused) this.frame = requestAnimationFrame(() => this.tick());
      }

      updateProgress() {
        if (!this.fill || !this.video.duration) return;
        const percent = Math.min(100, (this.video.currentTime / this.video.duration) * 100);
        this.fill.style.width = `${percent}%`;
        this.bar.setAttribute('aria-valuenow', String(Math.round(percent)));
      }
    }
  );
}
