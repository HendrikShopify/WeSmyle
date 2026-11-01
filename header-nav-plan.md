# Shopify Header Navigation: Technical Plan

## 1. Recommended architecture

Two Web Components, native `<details>` for mobile nesting, and a small set of shared modal utilities.

| Piece | Type | Reason |
|---|---|---|
| `<header-nav>` | Web Component | Desktop nav. One controller owns all dropdowns, so "only one open" is a single property instead of sibling coordination. |
| `<mobile-menu>` | Web Component | Owns opener, drawer, focus trap, inert, scroll lock, Escape. |
| Mobile nested items | `<details>` / `<summary>` | Native disclosure. No JS, no state, survives re-renders, exposes expanded state for free. |
| `modal-utils.js` | Plain module | `inertOutside()`, `scrollLock`, `getFocusable()`, `trapTab()`. Reusable by cart drawer, search, filters. |

Rejected:

- **`HeaderDropdown` per item.** Would need a registry or events to enforce one-open. Delegation inside `HeaderNav` is simpler.
- **`MenuDisclosure`.** `<details>` already is that.
- **One combined `HeaderMenu`.** Hover logic and modal logic have different lifecycles and failure modes. Keep them apart.

Communication: `HeaderNav` and `MobileMenu` never talk to each other. `MobileMenu` emits bubbling events so other overlays (cart drawer) and analytics can react. `HeaderNav` emits nothing.

## 2. Semantic HTML structure

### 2.1 + 2.2 Desktop nav with one dropdown item

```html
<header-nav data-desktop-query="(min-width: 1024px)">
  <nav aria-label="Main">
    <ul>
      <li><a href="/collections/new" aria-current="page">New</a></li>

      <!-- Parent WITH a URL: link + separate toggle -->
      <li data-nav-item>
        <a href="/collections/women">Women</a>
        <button type="button" data-nav-toggle
                aria-expanded="false" aria-controls="NavPanel-{{ section.id }}-2">
          <span class="sr-only">Women submenu</span>
          <svg aria-hidden="true" focusable="false">…</svg>
        </button>
        <div id="NavPanel-{{ section.id }}-2" data-nav-panel>
          <ul><li><a href="/collections/dresses">Dresses</a></li></ul>
        </div>
      </li>

      <!-- Parent WITHOUT a URL: the button is the whole trigger -->
      <li data-nav-item>
        <button type="button" data-nav-toggle
                aria-expanded="false" aria-controls="NavPanel-{{ section.id }}-3">Collections</button>
        <div id="NavPanel-{{ section.id }}-3" data-nav-panel>…</div>
      </li>
    </ul>
  </nav>
</header-nav>
```

- Panel is a plain `<div>`. No nested `<nav>` (landmark noise).
- Mega-menu columns: heading or plain text plus a `<ul>` each.
- Toggle hit area at least 24×24px.

### 2.3 + 2.4 Mobile trigger and drawer (no `<dialog>`)

```html
<mobile-menu data-desktop-query="(min-width: 1024px)">
  <button type="button" data-mobile-menu-open
          aria-expanded="false" aria-controls="MobileMenu-{{ section.id }}">
    <svg aria-hidden="true" focusable="false">…</svg>
    <span class="sr-only">Menu</span>
  </button>

  <div id="MobileMenu-{{ section.id }}" data-mobile-menu-panel data-state="closed"
       role="dialog" aria-modal="true" aria-labelledby="MobileMenuTitle-{{ section.id }}">
    <div data-mobile-menu-backdrop></div>
    <div data-mobile-menu-drawer>
      <h2 id="MobileMenuTitle-{{ section.id }}" class="sr-only">Menu</h2>
      <button type="button" data-mobile-menu-close>
        <span class="sr-only">Close menu</span><svg aria-hidden="true">…</svg>
      </button>
      <nav aria-label="Main"><ul>…</ul></nav>
    </div>
  </div>
</mobile-menu>
```

- `<div role="dialog">` rather than `<aside>`: the role overrides `aside` anyway and `complementary` is the wrong landmark.
- Backdrop is not a button. Keyboard users have Escape and the close button; a focusable backdrop is a redundant stop.

### 2.5 Nested mobile navigation

```html
<li>
  <details name="mobile-nav-{{ section.id }}" {% if link.child_active %}open{% endif %}>
    <summary>Women <svg aria-hidden="true">…</svg></summary>
    <ul>
      <li><a href="/collections/women">All Women</a></li>
      <li><a href="/collections/dresses">Dresses</a></li>
      <li><details><summary>Shoes</summary><ul>…</ul></details></li>
    </ul>
  </details>
</li>
```

- Never put a link inside `<summary>`. The parent URL becomes the first link inside the panel.
- `name` makes the accordion exclusive. Drop it if multiple open groups are the design.
- Server-render `open` on the branch containing the current page.

## 3. Desktop interaction model

### Opening

- **Hover** (`pointerenter`, only when `pointerType === 'mouse'`): opens immediately, closes any other open item.
- **Click on toggle**: toggles. Enter/Space come free from `<button>`.
- **Focus does not open.** Otherwise every Tab drops keyboard users into every submenu. The toggle button gives them the same content in one deliberate step.

### How it opened decides how it closes

| Opened by | Closes on pointer leave? |
|---|---|
| Hover | Yes, after ~200ms |
| Click / keyboard | No. Needs Escape, outside click, focus leaving, toggle again, or another item opening. |
| Hover, then focus enters panel | Pinned, behaves like click |

### The one timer: ~200ms hover-close delay

- Forgives diagonal movement into a wide panel and small slips across gaps.
- Satisfies WCAG 1.4.13 "hoverable".
- Cancelled if the pointer re-enters.
- Moving directly onto another dropdown item switches instantly, no delay.
- No open delay initially. Add ~80ms later only if sweeping the bar flickers.

### Pointer path

The panel is a descendant of the `<li>`, so `pointerleave` doesn't fire when entering it. Any visual gap must be bridged with transparent padding on the panel. The delay is a safety net, not the fix.

### Closes when

Hover-opened and pointer gone 200ms; Escape; `pointerdown` outside `<header-nav>`; focus leaves the `<li>`; toggle clicked while pinned; another item opens; viewport crosses to mobile; disconnect.

### Click on toggle right after hover-open

Pin it instead of closing it, otherwise the click undoes what the user just saw. Second click closes. Detect via `lastPointerType` from `pointerdown`.

### Tab order

Top link → toggle → (if open) panel links → next item. Closed panels are `display: none` so they are skipped. Shift+Tab from panel to toggle stays inside the `<li>`, stays open.

### Escape

Closes the open dropdown. If focus was in the panel or on the toggle, return focus to the toggle. If hover-opened with focus elsewhere, close without moving focus. Then suppress hover-reopen for that item until the pointer leaves it (WCAG 1.4.13 "dismissible").

### Touch and hybrid (iPad at desktop width)

Hover handlers ignore non-mouse pointers. Tapping the link navigates, tapping the chevron toggles. Nothing requires hover.

## 4. Mobile interaction model

### Open (click `[data-mobile-menu-open]`)

1. Store opener as `returnFocusTo`.
2. `data-state="open"`, opener `aria-expanded="true"`.
3. `scrollLock.acquire()`.
4. `inertOutside(panel)`.
5. Focus the close button.
6. Attach keydown listener to the panel.
7. Emit `mobile-menu:open`.

### Close (close button, backdrop click, Escape, breakpoint change, hash-link click, disconnect)

1. Remove keydown listener.
2. Release inert.
3. Release scroll lock.
4. `data-state="closed"`, opener `aria-expanded="false"`.
5. Restore focus to opener if connected and visible, else `[data-focus-fallback]`. Skip focus restore on disconnect.
6. Emit `mobile-menu:close`.

### Focus trapping

- Primary: `inert` on everything outside the drawer. Tab, VoiceOver swipe and the virtual cursor can't leave.
- Secondary: Tab keydown wraps last→first and first→last so focus doesn't jump to browser chrome.
- Focusable list is recomputed on each Tab (accordions change it). Use `checkVisibility()` to exclude links inside closed `<details>`.

### Background inert

Walk from the drawer up to `<body>`; at each level set `inert` on siblings that aren't ancestors. Skip already-inert elements and `[data-inert-ignore]`. Record only what was changed so restore is exact. Works despite `#shopify-section-…` wrappers; the opener and rest of the header go inert too, which is correct.

### Body scroll lock

Ref-counted, sets `data-scroll-locked` on `<html>` → `overflow: hidden`. `scrollbar-gutter: stable` prevents layout shift. Drawer gets `overflow-y: auto; overscroll-behavior: contain`. Avoid the `position: fixed` body hack unless iOS testing forces it.

### Nested items

Native `<details>`. Escape in the drawer closes the whole drawer, never just the innermost accordion.

### Mobile → desktop while open

Close drawer, release lock and inert. Opener is now hidden, so move focus to `[data-focus-fallback]` (logo link). Never leave focus on a hidden element or `<body>`.

## 5. Accessibility behavior

| Attribute | Where | Reason |
|---|---|---|
| `aria-expanded` | Desktop toggles, mobile opener | Required state of a disclosure button. `<summary>` exposes it natively, add nothing. Not on the close button. |
| `aria-controls` | Desktop toggles, mobile opener | Optional, cheap. Weak SR support. JS must never depend on it. |
| `aria-haspopup` | Nowhere | Implies a `menu` popup; SRs announce "menu" and users expect arrow keys. Wrong for site nav. |
| `aria-hidden` | Decorative SVGs only | Never on background (use `inert`), never on closed drawer (use `visibility`), never on panels (use `display`). |
| `role="dialog"` + `aria-modal="true"` | Drawer container | Minimum ARIA to say "modal" without `<dialog>`. |
| `aria-current="page"` | Active link | From `link.current`. |
| `role="menu"` / `menuitem` | Never | Site navigation, not an application menu. |

**Buttons vs anchors**: has a URL → `<a href>`. Only toggles state → `<button type="button">` or `<summary>`. Never both.

**Hidden states**

- Desktop panels: `display: none` when closed, driven by `data-open` on the `<li>` via CSS (not `hidden`), so the no-JS fallback `header-nav:not(:defined) li:is(:hover, :focus-within) [data-nav-panel] { display: block }` works and animation can be added later.
- Drawer: `visibility: hidden` when closed. Out of a11y tree and tab order, blocks pointer events, transition-friendly.

**WCAG checkpoints**: 1.4.13 (dismissible, hoverable, persistent), 2.1.1, 2.1.2 (no trap: Escape and close always work), 2.4.3, 2.4.7, 2.4.11 (sticky header needs `scroll-padding-top` on `<html>`), 2.5.8, 4.1.2.

**Reduced motion (later)**: Tailwind `motion-reduce:` variants. JS never waits on `transitionend`. Animate `visibility` with `transition-behavior: allow-discrete` and `@starting-style`.

## 6. Component state

### HeaderNav

| State | Purpose |
|---|---|
| `openItem` | The single open `<li>` or null |
| `openedBy: 'hover' \| 'click' \| 'keyboard' \| null` | Decides whether pointer leave closes |
| `closeTimer` | The 200ms delay handle |
| `hoverSuppressed` | Item dismissed by Escape while hovered |
| `lastPointerType` | For pin-on-click after hover |

DOM mirror: `aria-expanded` on toggle, `data-open` on `<li>`.

### MobileMenu

| State | Purpose |
|---|---|
| `isOpen` | |
| `returnFocusTo` | Focus target on close |
| `releaseInert` | Undo function |
| `releaseScroll` | Undo function |

DOM mirror: `data-state` on panel, `aria-expanded` on opener.

### Accordions

No JS state. `<details open>` is the state.

## 7. Events and listeners

All listeners bound through the component's `AbortController` signal.

### HeaderNav

| Listener | Target | Lifetime |
|---|---|---|
| `pointerenter` / `pointerleave` | each `[data-nav-item]` | connected |
| `pointerdown` (record pointer type) | component | connected |
| `click` delegated to `[data-nav-toggle]` | component | connected |
| `keydown` Escape | component | connected |
| `focusout` (close if `relatedTarget` outside open `<li>`; null `relatedTarget` → do nothing, let outside-click handle it, avoids Safari button-focus quirk) | component | connected |
| `pointerdown` outside close | `document` | only while open |
| `change` | `matchMedia(desktopQuery)` | connected |

### MobileMenu

| Listener | Target | Lifetime |
|---|---|---|
| `click` (opener, close, backdrop, `a[href^="#"]`) | component | connected |
| `keydown` (Escape, Tab wrap) | panel | only while open |
| `change` | `matchMedia(desktopQuery)` | connected |
| `pageshow` (`persisted` → close silently, bfcache) | `window` | connected |

### Custom events

`mobile-menu:open`, `mobile-menu:close`, bubbling, `detail: { source: this }`.

## 8. Data attributes

| Attribute | Element | Kind |
|---|---|---|
| `data-desktop-query` | both components | config, matches Tailwind `lg` |
| `data-nav-item` / `data-nav-toggle` / `data-nav-panel` | desktop parts | hooks |
| `data-open` | dropdown `<li>` | state, styled via `group-data-[open]:` |
| `data-mobile-menu-open` / `-close` / `-panel` / `-drawer` / `-backdrop` | mobile parts | hooks |
| `data-state="open\|closed"` | mobile panel | state |
| `data-scroll-locked` | `<html>` | global state |
| `data-focus-fallback` | logo link | fallback focus target |
| `data-inert-ignore` | live regions etc. | excluded from inert walk |

If `BaseComponent` already has a `refs` / `data-ref` convention, map these onto it rather than adding a parallel scheme.

## 9. BaseComponent usage

### Belongs in BaseComponent (generic)

- `AbortController` created in `connectedCallback`, aborted in `disconnectedCallback`, exposed as `this.signal`.
- `this.on(target, type, handler, options)` that injects the signal.
- Scoped `refs` lookup.
- `emit(name, detail)` for bubbling CustomEvents.
- Idempotent connect (elements can be moved and reconnected).
- `define()` helper guarded by `customElements.get()` (theme editor may load the script twice).

### Belongs in `modal-utils.js`, not BaseComponent

`inertOutside`, `scrollLock`, `getFocusable`, `trapTab`. Only modal-like components need them.

### Local to HeaderNav

Hover intent, pinning, Escape suppression, one-open coordination.

### Local to MobileMenu

Open/close sequence, focus targets, fallback focus.

## 10. Shopify-specific considerations

- **Section re-render** (`shopify:section:load`, Section Rendering API): old elements disconnect. If the drawer was open, cleanup must release inert and scroll lock or the new page stays frozen. Don't restore focus during teardown. New markup arrives closed.
- **Unique IDs**: `{{ section.id }}` plus `forloop.index`, nested via `forloop.parentloop.index`. Supports multiple header instances and section groups.
- **No-URL parents**: treat `link.url == '#'` or blank as "no URL" and render the button-only trigger.
- **Active state**: `link.current` → `aria-current`; `link.child_active` → `<details open>`.
- **Theme editor**: optionally open the dropdown containing a selected mega-menu block on `shopify:block:select`, close on deselect. Gate with `Shopify.designMode`.
- **Script loading**: `type="module"` or `defer` so elements upgrade after children are parsed.
- **Fixed-position containment**: a sticky header using `transform`, `filter`, `backdrop-filter` or `contain` traps the "fixed" drawer. Keep those off the drawer's ancestors or render the panel outside them.
- **Duplicate linklist markup** for desktop and mobile is fine; the hidden one is `display: none`.

## 11. Edge cases

### Desktop

- Escape with pointer resting on the item: must not reopen until the pointer leaves.
- Focus inside a hover-opened panel when the mouse leaves: focus pins it, don't close.
- Wide mega menu at viewport edge: constrain with CSS, never JS positioning.

### Mobile

- Breakpoint crossing either way: mobile→desktop closes the drawer; desktop→mobile closes any dropdown.
- Hash or same-page link inside the drawer: close first, then scroll.
- bfcache back-navigation: `pageshow` closes it.
- Cart drawer opened from inside the menu: close the menu first. Ref-counted lock and exact inert records prevent restore-order bugs.
- Elements already `inert` before open stay inert after close.
- Widgets appended to `<body>` while open (chat bubbles) aren't inerted. Accept as a known limit; a MutationObserver isn't worth it.
- Opener removed or hidden on close: use the fallback.

### General

- 400% zoom → mobile model via media query, nothing extra.
- No JS: desktop dropdowns work via `:not(:defined)` fallback. Mobile opener can't; consider a server-rendered link to a collections page.
- RTL: logical CSS properties. Nothing in JS is direction-dependent.

## 12. Suggested implementation order

1. Liquid markup with IDs, `aria-current`, `<details>`, no-JS CSS fallback. Test with JS off.
2. `modal-utils.js`. Unit-test the inert walk and ref counting.
3. HeaderNav click and keyboard: toggle, `aria-expanded`, one-open, Escape, outside click, focus-out.
4. HeaderNav hover layer: mouse-only, close delay, padding bridge, pinning, Escape suppression.
5. MobileMenu: open/close sequence, focus in/out, inert, scroll lock, Escape, Tab wrap, backdrop.
6. Breakpoint handling, hash links, `pageshow`, focus fallback.
7. Shopify: disconnect-while-open cleanup, editor block select, multiple instances.
8. Test matrix: keyboard only; VoiceOver macOS and iOS; NVDA with Firefox and Chrome; TalkBack; iPad at desktop width; theme editor re-renders.
9. Motion, behind `motion-reduce`.

## 13. Things to avoid

- `<dialog>`, `role="menu"`, `aria-haspopup`, arrow-key roving tabindex.
- Turning links with URLs into buttons, or links inside `<summary>`.
- CSS `:hover` as the real open state. It can't sync `aria-expanded`, honor Escape, or enforce one-open. Fallback and visuals only.
- Opening on focus.
- `aria-hidden` on the background instead of `inert`.
- Portaling the drawer to `<body>`. Breaks section re-renders and cleanup.
- Global listeners outliving the open state or not bound to `this.signal`.
- Any timer beyond the single hover-close delay, including waiting on animations.
- JS depending on `aria-controls` or `transitionend`.
- `mouseenter`/`mouseover` (use pointer events with `pointerType` checks), and the `position: fixed` body hack unless testing proves it necessary.
