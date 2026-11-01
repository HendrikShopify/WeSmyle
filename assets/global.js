class HTMLUpdateUtility {
  /**
   * Used to swap an HTML node with a new node.
   * The new node is inserted as a previous sibling to the old node, the old node is hidden, and then the old node is removed.
   *
   * The function currently uses a double buffer approach, but this should be replaced by a view transition once it is more widely supported https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API
   */
  static viewTransition(oldNode, newContent, preProcessCallbacks = [], postProcessCallbacks = []) {
    preProcessCallbacks?.forEach((callback) => callback(newContent));

    const newNodeWrapper = document.createElement('div');
    HTMLUpdateUtility.setInnerHTML(newNodeWrapper, newContent.outerHTML);
    const newNode = newNodeWrapper.firstChild;

    // dedupe IDs
    const uniqueKey = Date.now();
    oldNode.querySelectorAll('[id], [form]').forEach((element) => {
      element.id && (element.id = `${element.id}-${uniqueKey}`);
      element.form && element.setAttribute('form', `${element.form.getAttribute('id')}-${uniqueKey}`);
    });

    oldNode.parentNode.insertBefore(newNode, oldNode);
    oldNode.style.display = 'none';

    postProcessCallbacks?.forEach((callback) => callback(newNode));

    setTimeout(() => oldNode.remove(), 500);
  }

  // Sets inner HTML and reinjects the script tags to allow execution. By default, scripts are disabled when using element.innerHTML.
  static setInnerHTML(element, html) {
    element.innerHTML = html;
    element.querySelectorAll('script').forEach((oldScriptTag) => {
      const newScriptTag = document.createElement('script');
      Array.from(oldScriptTag.attributes).forEach((attribute) => {
        newScriptTag.setAttribute(attribute.name, attribute.value);
      });
      newScriptTag.appendChild(document.createTextNode(oldScriptTag.innerHTML));
      oldScriptTag.parentNode.replaceChild(newScriptTag, oldScriptTag);
    });
  }
}

function getFocusableElements(container) {
  return Array.from(
    container.querySelectorAll(
      "summary, a[href], button:enabled, [tabindex]:not([tabindex^='-']), [draggable], area, input:not([type=hidden]):enabled, select:enabled, textarea:enabled, object, iframe"
    )
  );
}

const trapFocusHandlers = {};

function trapFocus(container, elementToFocus = container) {
  var elements = getFocusableElements(container);
  var first = elements[0];
  var last = elements[elements.length - 1];

  removeTrapFocus();

  trapFocusHandlers.focusin = (event) => {
    if (event.target !== container && event.target !== last && event.target !== first) return;

    document.addEventListener('keydown', trapFocusHandlers.keydown);
  };

  trapFocusHandlers.focusout = function () {
    document.removeEventListener('keydown', trapFocusHandlers.keydown);
  };

  trapFocusHandlers.keydown = function (event) {
    if (event.code.toUpperCase() !== 'TAB') return; // If not TAB key
    // On the last focusable element and tab forward, focus the first element.
    if (event.target === last && !event.shiftKey) {
      event.preventDefault();
      first.focus();
    }

    //  On the first focusable element and tab backward, focus the last element.
    if ((event.target === container || event.target === first) && event.shiftKey) {
      event.preventDefault();
      last.focus();
    }
  };

  document.addEventListener('focusout', trapFocusHandlers.focusout);
  document.addEventListener('focusin', trapFocusHandlers.focusin);

  elementToFocus.focus();

  if (
    elementToFocus.tagName === 'INPUT' &&
    ['search', 'text', 'email', 'url'].includes(elementToFocus.type) &&
    elementToFocus.value
  ) {
    elementToFocus.setSelectionRange(0, elementToFocus.value.length);
  }
}

// Here run the querySelector to figure out if the browser supports :focus-visible or not and run code based on it.
try {
  document.querySelector(':focus-visible');
} catch (e) {
  focusVisiblePolyfill();
}

function focusVisiblePolyfill() {
  const navKeys = [
    'ARROWUP',
    'ARROWDOWN',
    'ARROWLEFT',
    'ARROWRIGHT',
    'TAB',
    'ENTER',
    'SPACE',
    'ESCAPE',
    'HOME',
    'END',
    'PAGEUP',
    'PAGEDOWN',
  ];
  let currentFocusedElement = null;
  let mouseClick = null;

  window.addEventListener('keydown', (event) => {
    if (navKeys.includes(event.code.toUpperCase())) {
      mouseClick = false;
    }
  });

  window.addEventListener('mousedown', (event) => {
    mouseClick = true;
  });

  window.addEventListener(
    'focus',
    () => {
      if (currentFocusedElement) currentFocusedElement.classList.remove('focused');

      if (mouseClick) return;

      currentFocusedElement = document.activeElement;
      currentFocusedElement.classList.add('focused');
    },
    true
  );
}

function removeTrapFocus(elementToFocus = null) {
  document.removeEventListener('focusin', trapFocusHandlers.focusin);
  document.removeEventListener('focusout', trapFocusHandlers.focusout);
  document.removeEventListener('keydown', trapFocusHandlers.keydown);

  if (elementToFocus) elementToFocus.focus({ preventScroll: true });
}

function onKeyUpEscape(event) {
  if (event.code.toUpperCase() !== 'ESCAPE') return;

  const openDetailsElement = event.target.closest('details[open]');
  if (!openDetailsElement) return;

  const summaryElement = openDetailsElement.querySelector('summary');
  openDetailsElement.removeAttribute('open');
  summaryElement.setAttribute('aria-expanded', false);
  summaryElement.focus();
}

class QuantityInput extends BaseComponent {
  constructor() {
    super();
    this.changeEvent = new Event('change', { bubbles: true });
  }

  quantityUpdateUnsubscriber = undefined;

  init() {
    this.input = this.querySelector('input');
    this.listen(this.input, 'change', this.onInputChange.bind(this));
    this.querySelectorAll('button').forEach((button) =>
      this.listen(button, 'click', this.onButtonClick.bind(this))
    );
    this.validateQtyRules();
  }

  disconnectedCallback() {
    if (this.quantityUpdateUnsubscriber) {
      this.quantityUpdateUnsubscriber();
    }
    super.disconnectedCallback();
  }

  onInputChange(event) {
    this.validateQtyRules();
  }

  onButtonClick(event) {
    event.preventDefault();
    const previousValue = this.input.value;
    const button = event.currentTarget;

    if (button.name === 'plus') {
      if (parseInt(this.input.dataset.min) > parseInt(this.input.step) && this.input.value == 0) {
        this.input.value = this.input.dataset.min;
      } else {
        this.input.stepUp();
      }
    } else {
      this.input.stepDown();
    }

    if (previousValue !== this.input.value) this.input.dispatchEvent(this.changeEvent);

    if (this.input.dataset.min === previousValue && button.name === 'minus') {
      this.input.value = parseInt(this.input.min);
    }
  }

  validateQtyRules() {
    const value = parseInt(this.input.value);

    if (this.input.min) {
      const buttonMinus = this.querySelector("[name='minus']");
      if (parseInt(value) <= parseInt(this.input.min)) {
        buttonMinus.setAttribute('disabled', 'true');
      } else {
        buttonMinus.removeAttribute('disabled');
      }
    }

    if (this.input.max) {
      const max = parseInt(this.input.max);
      const buttonPlus = this.querySelector("[name='plus']");
      if (value >= max) {
        buttonPlus.setAttribute('disabled', 'true');
      } else {
        buttonPlus.removeAttribute('disabled');
      }
    }
  }
}

customElements.define('quantity-input', QuantityInput);

function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

function throttle(fn, delay) {
  let lastCall = 0;
  return function (...args) {
    const now = new Date().getTime();
    if (now - lastCall < delay) {
      return;
    }
    lastCall = now;
    return fn(...args);
  };
}

function fetchConfig(type = 'json') {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: `application/${type}` },
  };
}

// /*
//  * Shopify Common JS
//  *
//  */
if (typeof window.Shopify == 'undefined') {
  window.Shopify = {};
}

Shopify.bind = function (fn, scope) {
  return function () {
    return fn.apply(scope, arguments);
  };
};

Shopify.setSelectorByValue = function (selector, value) {
  for (var i = 0, count = selector.options.length; i < count; i++) {
    var option = selector.options[i];
    if (value == option.value || value == option.innerHTML) {
      selector.selectedIndex = i;
      return i;
    }
  }
};

// class ProductRecommendations extends HTMLElement {
//   observer = undefined;

//   constructor() {
//     super();
//   }

//   connectedCallback() {
//     this.initializeRecommendations(this.dataset.productId);
//   }

//   initializeRecommendations(productId) {
//     this.observer?.unobserve(this);
//     this.observer = new IntersectionObserver(
//       (entries, observer) => {
//         if (!entries[0].isIntersecting) return;
//         observer.unobserve(this);
//         this.loadRecommendations(productId);
//       },
//       { rootMargin: '0px 0px 400px 0px' }
//     );
//     this.observer.observe(this);
//   }

//   loadRecommendations(productId) {
//     fetch(`${this.dataset.url}&product_id=${productId}&section_id=${this.dataset.sectionId}`)
//       .then((response) => response.text())
//       .then((text) => {
//         const html = document.createElement('div');
//         html.innerHTML = text;
//         const recommendations = html.querySelector('product-recommendations');

//         if (recommendations?.innerHTML.trim().length) {
//           this.innerHTML = recommendations.innerHTML;
//         }

//         if (!this.querySelector('slideshow-component') && this.classList.contains('complementary-products')) {
//           this.remove();
//         }

//         if (html.querySelector('.grid__item')) {
//           this.classList.add('product-recommendations--loaded');
//         }
//       })
//       .catch((e) => {
//         console.error(e);
//       });
//   }
// }

// customElements.define('product-recommendations', ProductRecommendations);


class LoadingBar extends BaseComponent {
  constructor() {
    super();
    this.startLoading = this.startLoading.bind(this);
    this.endLoading = this.endLoading.bind(this);
  }

  init() {
    this.listen(document, 'loading:start', this.startLoading);
    this.listen(document, 'loading:end', this.endLoading);
  }

  // start and end can arrive within milliseconds (a cached fetch). Each call kills the running tween first,
  // otherwise the 0.25s start tween outlives the 0.2s end tween and the bar settles at 80%.
  startLoading() {
    gsap.killTweensOf(this);
    gsap.to(this, { width: '80%', duration: 0.25, ease: 'power2.out' });
  }

  endLoading() {
    gsap.killTweensOf(this);
    gsap.to(this, {
      width: '100%',
      duration: 0.2,
      ease: 'power2.out',
      onComplete: () => {
        gsap.set(this, { width: '0%' });
      },
    });
  }
}

customElements.define('loading-bar', LoadingBar);


/* GSAP EASES */

gsap.registerPlugin(CustomEase);

CustomEase.create("smooth", "0.77,0,0.175,1");
