let productSwiper = document.querySelector("[swiper='product-slider']");

if (productSwiper) {
  const swiperElement = productSwiper.querySelector('.swiper');

  const prevButton = productSwiper.querySelector("[swiper='prev']");
  const nextButton = productSwiper.querySelector("[swiper='next']");

  var swiper = new Swiper(swiperElement, {
    speed: 300,
    slidesPerView: 'auto',
    spaceBetween: 12,
    loop: false,
    centeredSlides: false,
    mousewheel: { forceToAxis: true },
    pagination: {
      el: '.swiper-pagination',
      clickable: true,
    },
    navigation: {
      nextEl: nextButton,
      prevEl: prevButton,
      disabledClass: 'hide',
    },
    breakpoints: {
      480: { slidesPerView: 'auto', spaceBetween: 12, slidesPerGroup: 1 },
      768: { slidesPerView: 'auto', spaceBetween: 12, slidesPerGroup: 1 },
      992: {
        slidesPerView: 'auto',
        spaceBetween: 12,
        slidesPerGroup: 1,
      },
    },
  });
}
