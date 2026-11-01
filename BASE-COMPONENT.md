# BaseComponent

Shared superclass for theme Web Components. It lives in `assets/base-component.js` and is loaded in `layout/theme.liquid` before `global.js`. Scripts are classic globals, so the class is available to every later file. It is not registered as a custom element.

Extend it when a new component needs connect/disconnect, listener cleanup, or a custom event. `loading-bar` in `assets/global.js` is the first example.

## What belongs here

Only behavior that almost every component needs:

- `connectedCallback()`, `disconnectedCallback()`, and an overridable `init()`
- One `AbortController` per instance, and `listen()` so those listeners are removed on disconnect
- `emit()` for `CustomEvent`
- `$()` and `$$()` as thin wrappers around `querySelector` and `querySelectorAll` inside the element

## What should not go here

Feature behavior stays in the subclass. That includes cart, product, variant, API, fetch, modal, drawer, slider, and accordion logic. Do not register child components from the base. Do not listen for `shopify:section:*` here. The native connect and disconnect callbacks are enough when Shopify replaces a section.

`ResizeObserver`, `MutationObserver`, and fetch cancellation stay in the component that uses them. A component that already has its own `AbortController` for requests should keep that separate from `this.abortController`.

## How to extend it

```js
class ExampleWidget extends BaseComponent {
    init() {
        this.button = this.$('button');
        this.listen(this.button, 'click', () => {
            this.emit('example:change', { open: true });
        });
    }
}

customElements.define('example-widget', ExampleWidget);
```

Override `init()`, not `connectedCallback()`. `init()` runs each time the element is connected. Put DOM queries and `listen()` calls there, not in the constructor. The constructor runs before children exist when the element is created in script.

If you override `connectedCallback()` or `disconnectedCallback()`, call `super` so `init()` still runs and the controller is replaced. One-time side effects inside `init()`, such as appending nodes or starting an observer, need their own cleanup in `disconnectedCallback()` after `super.disconnectedCallback()`.

Keep the public tag name, data attributes, and events of an existing component the same when moving it onto the base.

## listen()

```js
this.listen(target, event, callback, options);
```

`target` is the element, `document`, or `window`. `options` accepts `capture`, `once`, and `passive`. `listen()` always attaches this instance's `AbortController` signal after `options`, so those flags still work and a passed `signal` cannot skip cleanup.

Each instance has its own controller, created in the constructor. Two components of the same type on one page do not share listeners.

## emit()

```js
this.emit(name, detail, options);
```

Dispatches a `CustomEvent` on the component. `bubbles` defaults to `true`. `options` can override `bubbles`, `cancelable`, or `composed`. The `detail` argument is always the event detail.

```js
this.emit('tabs:change', { index: 0 });
this.emit('tabs:change', { index: 0 }, { bubbles: false });
```

## Lifecycle

1. The constructor creates `this.abortController`.
2. `connectedCallback()` calls `init()`.
3. `listen()` registers listeners with that controller's signal.
4. `disconnectedCallback()` aborts the controller, which removes every listener registered through `listen()`.
5. It then creates a new `AbortController`, so the same node can connect again and `init()` can register listeners once more.

There is no Shadow DOM. Accessibility and progressive enhancement stay in the subclass: keep real buttons, links, and form controls in the markup, and use ARIA only where the HTML element does not already provide it.

## Shopify section re-renders

The Theme Editor replaces a section's DOM. The old custom element disconnects, and a new one connects. Document and window listeners on the old instance are aborted with it, so they do not stack.

Query the DOM inside `init()` so a reconnected element reads the markup it has now. `listen()` calls in `init()` are safe across that cycle because the previous signal was aborted first.

Do not cache child nodes in the constructor. Do not guard `init()` with a one-time flag unless the subclass also keeps its own cleanup in sync. A flag that skips `init()` after the first connect will leave the component without listeners after the base aborts them.

## Selecting elements

Use `$()` and `$$()` with data attributes only (`this.$('[data-carousel-track]')`). Never select by class. Classes are for styling and get renamed or removed; a data attribute is the contract between markup and script.
