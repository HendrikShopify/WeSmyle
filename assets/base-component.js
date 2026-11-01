class BaseComponent extends HTMLElement {
    constructor() {
        super();
        this.abortController = new AbortController();
    }

    connectedCallback() {
        this.init();
    }

    disconnectedCallback() {
        this.abortController.abort();
        this.abortController = new AbortController();
    }

    init() {}

    listen(target, event, callback, options = {}) {
        target.addEventListener(event, callback, {
            ...options,
            signal: this.abortController.signal,
        });
    }

    emit(name, detail = {}, options = {}) {
        this.dispatchEvent(
            new CustomEvent(name, {
                bubbles: true,
                ...options,
                detail,
            })
        );
    }

    $(selector) {
        return this.querySelector(selector);
    }

    $$(selector) {
        return this.querySelectorAll(selector);
    }
}
