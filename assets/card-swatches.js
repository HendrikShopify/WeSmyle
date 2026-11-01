/*
  Product card swatches (delegated, works on cards added later).
  [data-swatch-preview]  swatch link on a product card (href = product?variant=id), carries data-image-src and
                         data-image-srcset of its variant. Hover or focus shows that image in the card, leaving restores
                         the original. Clicking follows the link to the product with that variant.
  [data-swatch-more]     the "+N" button: reveals the swatches past the fourth ([data-swatch-extra]) and removes itself.
*/
(() => {
  const target = (evt) => evt.target.closest?.('[data-swatch-preview]');
  const cardImage = (swatch) => swatch.closest('product-card')?.querySelector('.media img');

  function set(swatch, src, srcset) {
    const img = cardImage(swatch);
    if (!img || !src) return;
    if (!img.dataset.originalSrc) {
      img.dataset.originalSrc = img.getAttribute('src') || '';
      img.dataset.originalSrcset = img.getAttribute('srcset') || '';
    }
    img.setAttribute('src', src);
    if (srcset) img.setAttribute('srcset', srcset);
    else img.removeAttribute('srcset');
  }

  function restore(swatch) {
    const img = cardImage(swatch);
    if (!img?.dataset.originalSrc) return;
    img.setAttribute('src', img.dataset.originalSrc);
    if (img.dataset.originalSrcset) img.setAttribute('srcset', img.dataset.originalSrcset);
    else img.removeAttribute('srcset');
  }

  const enter = (evt) => {
    const swatch = target(evt);
    if (swatch) set(swatch, swatch.dataset.imageSrc, swatch.dataset.imageSrcset);
  };
  const leave = (evt) => {
    const swatch = target(evt);
    if (swatch && !swatch.contains(evt.relatedTarget)) restore(swatch);
  };

  document.addEventListener('mouseover', enter);
  document.addEventListener('mouseout', leave);
  document.addEventListener('focusin', enter);
  document.addEventListener('focusout', leave);

  document.addEventListener('click', (evt) => {
    const more = evt.target.closest('[data-swatch-more]');
    if (!more) return;
    const row = more.closest('.card-swatches');
    const extras = row ? [...row.querySelectorAll('[data-swatch-extra]')] : [];
    extras.forEach((el) => {
      el.hidden = false;
    });
    more.remove();
    extras[0]?.querySelector('a')?.focus();
  });
})();
