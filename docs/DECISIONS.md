# Decisions

Settled choices. Check here before reopening one. Dated, newest first.

- 2026-10-28 · Utilities live in snippets, not BEM files with `@apply`. Reason: Tailwind v4 direction, the Figma MCP outputs utilities, one file per component.
- 2026-10-28 · Max content width 1440 (Figma `layout/max-width`). The old `.container` at 1600 goes.
- 2026-10-28 · The three line-item snippet sets (`cart-line-item__*`, `drawer-line-item__*`, `cart-drawer-item`) merge into one `line-item` snippet with a `layout` parameter.
- 2026-10-28 · Breakpoints: base under 768, `md:` from 768, `lg:` from 1024. No tablet designs; tablet uses mobile layout with tablet token values.
- 2026-10-28 · Token export runs through the Figma MCP, not the REST API (variables endpoint is Enterprise-only).
- 2026-10-28 · Code Connect through the MCP mapping, not the CLI (no Liquid target).
- 2026-10-28 · Padding top and bottom are per-section selects (None, Small, Medium, Large), mirrored by Figma variable modes.
- 2026-10-28 · Grid gaps are their own tokens (`layout/grid-gap-x`, `layout/grid-gap-y`), separate from the page gutter.
- 2026-10-28 · Carousel cards keep a fixed width (3 columns). Everything else on a grid fills its cell.
- 2026-10-27 · No colour scheme modes on the Color collection. Brand changes are token edits on a per-project copy of the Figma file.
- 2026-10-27 · Design leads; code follows. Figma components are designed first, then mirrored here.

## 2026-10-28: Search opens in the side drawer, not a details modal

The details-modal pattern is retired. Search lives in `search-drawer`, a `side-drawer` instance: the real GET search form with the underline search-field in the header, predictive results in the body (`sections/predictive-search.liquid`, built from search-result-group, search-suggestion and search-product-result). `header__search` is the icon-button trigger. `DetailsModal`, `search-modal.css` and the four `predictive-search__*` partials are deleted. Done 2026-10-29.

## 2026-10-28: Focus state is a 1px text-colour border

`color/focus` aliases `color/text` (was blue 600) and all Focus variants use a 1px stroke, same weight as hover. In code: `focus-visible:border-focus` without `border-2`, outlines at 1px. The focus token stays so it can be changed in one place later.

## 2026-10-29: Cart built ahead of milestone 6

Cart drawer and cart page are built from the Figma Main cart and Cart drawer specs using the atoms (line-item, cart-summary, free-shipping-bar, discount-code). Discount codes apply through `cart/update.js` with `discount`, not a `/discount/CODE` redirect. Free shipping threshold is a snippet parameter (cents, default 5000); no theme settings in the boilerplate, those come later. Cross-sell block is not built yet; it needs the product recommendations API and comes with the section grid work.

## 2026-10-29: One drawer shell

`side-drawer` is the only slide-in panel. The cart drawer, the coming search drawer, filters, the mobile menu and the review form are instances of it (`content` or `body`/`footer`). The old `CartDrawer` class, `cart-icon` element and `cart-drawer.js` are gone; the cart icon is a plain trigger. Overlay opacity is 0.3 on the `overlay` token (as in Figma), panel widths 600 (cart) / 700 (default) / 800px, motion is GSAP `smooth` 0.6s with a reduced-motion fallback. Scroll lock stays the `data-scroll-lock` attribute read by `has-[[data-scroll-lock=true]]` on body.

## 2026-10-29: No settings in the boilerplate

No theme settings and no section settings are added while building the boilerplate. Everything renders on by default (quick add, vendor, rating in search results; free shipping bar). Settings are a later milestone. Pre-existing schemas (header, cookie consent, reviews) stay until their sections are rebuilt.

## 2026-10-29: Localization switch is language only, in the header

The switcher stays a small dropdown (Figma: Localization selector, menu, item) and only switches language. Country/region and currency are not built; they come with markets. It sits first in the header icons (`header__localization`, ghost style) and is hidden when the store has one language. No new interaction code: it reuses `custom-select` for open/close/keyboard, and `localization-form.js` is 10 lines that submit Shopify's localization form (`locale_code`). The old `language-localization` snippet and its 120-line script are gone. Flags (Figma Type=Flag) wait for flag assets in the theme; a language is not a country, so the mapping needs a decision first.

## 2026-10-29: Newsletter signup is two atoms on Shopify's customer form

`newsletter-input` (3 styles) and `newsletter-signup` (3 layouts) replace the old `newsletter` snippet and its four footer CSS classes. No Klaviyo or app code: the form posts to `/contact` with `contact[tags]=newsletter`, the success and error text is the form result. The footer uses `stacked-left` with the `inline` field. Copy defaults come from locale keys (`newsletter.title`, `description`, `fine_print_html`). `icon-button` got a `submit` flag for the underline arrow.

## 2026-10-29: Filters live in one drawer, applied live

The collection and search toolbar is Filter button + count + Sort dropdown; every filter and the sort live in one left drawer (440px, `side-drawer` size `xs`). Active filter chips only exist above the product grid, on desktop and mobile, never inside the drawer or a sidebar. The sidebar layout comes later and reuses the same `filter-group` snippets. Changes apply live: `filters.js` (`<collection-filters>`) fetches the section with `?section_id=` and swaps the grid, counts, chips and groups, so Show N products only closes the drawer. The group being edited keeps its DOM (only badge and summary refresh), the rest re-render with new counts. Sort exists twice (toolbar dropdown and drawer radios) and `filters.js` keeps them in step. The old `facets*` snippets, `facets.js`, `show-more.js` and their CSS are gone. The collection paginate size went from 1 to 24 so filtering is testable.

## 2026-10-29: One accordion for filters too

Filter group no longer has its own header. Figma: the Accordion header gained a `Show selected count` boolean (title row with a Count badge) and replaced Filter group header, which is deleted; Filter group keeps its Divider and inline content, so Show selection summary still works on the instance. Code: `filter-group` renders `accordion-item` (new `count` and `attributes` params) with the value stack as its content, and `filter-group-header` is gone. The header is now 60px (20px padding) instead of 56px.

## Grid density is two sizes, remembered per breakpoint
Large (4 columns, 1 on mobile) and Small (6, 2 on mobile) as in Figma. The switch only flips data attributes on the grid container, so live filtering keeps the choice. Defaults are Large on desktop and Small on mobile, no theme setting. The choice is stored in localStorage per breakpoint (try/catch, works without it).

## Mobile menu follows Figma: two styles, no setting
The menu is a full-screen panel from the left with the Accordion or Drill-down style as a snippet parameter (default accordion). Items, back header and extras are snippets of their own. The header still renders accordion until a style is chosen in the section. Feature card tiles wait for a rule on where their images come from (Shopify menus carry none).

## 2026-10-30: Swiper for sliders

Media gallery, media lightbox and Featured collection carousel run on Swiper (swiper-bundle.min.js, loaded in theme.liquid), not native scroll-snap. Swiper has no CSS file here: the container is `.swiper overflow-hidden`, the wrapper `.swiper-wrapper flex`, slides `.swiper-slide`, all styled with Tailwind. Our own arrows, thumbnails and progress segments are wired to the Swiper API.
- 2026-10-30 · No layout CSS file. Page wrapper is `mx-auto w-full max-w-page px-page-margin`, 12-col grid is `lg:grid lg:grid-cols-12 lg:gap-x-gutter`, written as token utilities in markup.
- 2026-10-30 · JS hooks are data attributes, never classes (CLAUDE.md rule 8). Legacy scripts still select by class and move over as their components are rebuilt.
- 2026-10-30 · Quick view is a side-drawer (size lg) filled from the quick-view-product section, not its own modal. Triggers are [data-quick-view-trigger]. The old quick-view modal, modal-opener, media-slider.js and product__form / product__media-slider are removed.

## 2026-10-30: Search page

`main-search` follows Figma Main search (Results and No results, desktop centered header, mobile left). Search is products only: no article or page results and no type tabs (removed from Figma and code). Every search form (drawer, page, filter drawer) sends `type=product`. Popular search chips come from the `templates.search.popular_terms` locale string (comma separated). Page size is 24.

## 2026-10-30: Blog and article

`main-blog` and `main-article` follow Figma Main blog and Main article. `article-card`, `article-meta` and `rich-text` are new snippets; `card-article` is deleted. The blog paginates by 7: the first article on every page is the Featured card, the other six the 3-column grid, so no page ends with an orphan row. Tag chips are links to `blog.url/tagged/<tag>`. Shopify blogs have no description, so the Figma Description is not rendered. The article lead is `article.excerpt`. Share row: native share (only when `navigator.share` exists), copy link and mailto, in `article-share.js`. Keep reading shows up to 3 other articles of the same blog. Mobile uses numbered pagination for now, Figma shows Load more (open, same as collection and search). The Newsletter section under both templates does not exist yet. Reading time is words / 200, minimum 1. The legacy `.article-grid` rule in `tailwind.input.css` is now unused.

Blog posts (Figma Sections / Blog posts) is the `blog-posts` snippet plus a `blog-posts` section with a fixed blog handle, added to `templates/index.json` under the atom showcase as the homepage example, like product recommendations does for Featured collection. Figma has no mobile Featured layout; below lg the Overlay card stays 4:5 and the Horizontal cards render as Vertical cards. `sections/featured-collection.liquid` is an empty stray file.

## 2026-10-30: Meta tags

`meta-tags` (rendered in `<head>`) was an empty file. It now outputs Open Graph and Twitter card tags on every page with fallbacks (description to `shop.description`, image to `page_image`, then the latest article image on a blog, then `settings.share_image`), `og:type` article/product/website, article published time, author and tags, product price, and a BreadcrumbList JSON-LD that mirrors the breadcrumbs snippet. The description meta in `theme.liquid` falls back to `shop.description`. Home and blog descriptions read the shop name until the store has a description.

## 2026-10-30: Page

`main-page` follows Figma Main page: title (heading/1, heading/2 below lg) and optional subtitle in the prose column, body through `rich-text`. No breadcrumbs, as in the design. The subtitle reads `page.metafields.custom.subtitle` (Figma Show subtitle); Shopify pages have no last-updated date in Liquid, so nothing is invented when the metafield is empty.

## 2026-10-30: Policy pages

Shopify renders /policies/* itself inside the theme layout; a theme cannot provide a policy template. `tailwind/components/shopify-policy.css` styles Shopify's markup (`.shopify-policy__container`, `__title`, `__body .rte`) with `@apply` of the same utilities as `main-page` and `rich-text`, so the policy pages look like the Page template. This is the one deliberate exception to the no-component-CSS rule, because the markup is not ours. Shopify's own policy stylesheet centers the title; `text-left` overrides it. Keep this file in step with `rich-text.liquid`.

## 2026-10-30: Contact

The Figma Contact template is a Section grid preset built from Block / Text, Block / Buttons, Field and Icon text. Section grid and blocks are milestone 5, so `main-contact` composes the same layout from the atoms: details cell (4 columns) and form cell (7 columns from column 6), form first on mobile. Contact details come from `shop.email`, `shop.phone` and `shop.address.summary`; opening hours, title, body and the subject list are locale strings. New `social-links` snippet and Lucide `phone`, `map-pin` and `clock` icons. The FAQ section under the form is not built yet (needs the accordion section and a content source).

Shopify injects a `div.h-captcha` (invisible hCaptcha) into contact and customer forms on first interaction. As a block-level flex child it takes a `gap` slot and pushes the content below the form down by one gap. Forms that use `gap` get `[&>.h-captcha]:absolute` (with `relative` on the form) so the widget stays in the DOM but out of the flow.

## 2026-10-31: 404

`main-404` follows Figma Main 404: Empty state type 404 (the search field and the Show search property were removed from the Figma component, no search on the 404), then Featured collection in grid layout with the title Popular right now and 4 products of a fixed collection set in the section. `empty-state` lost its own `py-16`: a `class` override could not beat it (same utility, later in the cascade), so the parent now owns the padding.

## 2026-10-31: Reviews rebuild

The reviews module keeps its three JS layers (`reviews__core.js` state and cache, `reviews__judgeme.js` adapter, `reviews__ui.js` DOM) and its `data-reviews-*` hooks; the snippets are rebuilt one by one on the atoms with utilities, and each legacy `reviews__*.css` file goes when its snippet is done. Review card first: `reviews__card`, the answer/photo/video templates and the list wrapper, `reviews__list.css` deleted. Dates render as "5 July 2026" (day, long month, year) in every locale, as in Figma. Tested on the Manjula Essentials store, which has live Judge.me reviews.

Rating summary and histogram rebuilt (summary markup in the section, `reviews__histogram` snippet); `reviews__histogram.css` and the summary rules in `reviews.css` deleted.

Reviews toolbar, chips, pagination and empty states rebuilt on `input`, `chip` (dropdown and active, new `label_attributes` for the JS label slot, `aria-selected` styles the selected dropdown chip at runtime), `dropdown-menu` + `menu-item` (the check now follows `aria-selected` through `group-aria-selected`, and the label span carries `data-menu-item-label`), `link` and the pagination-item classes. `reviews__ui.js`: `showEmpty(type, message)` drives the empty block and its three actions, every `[data-reviews-clear]` clears. Four more `reviews__*.css` files deleted.

## 2026-10-31: Reviews section in Figma

The review atoms existed in Figma but no composed section did. Added Sections / Reviews (Viewport Desktop and Mobile, Show pagination) built from Rating summary, Reviews toolbar, three Review cards (40px apart on desktop, 32px on mobile) and Pagination (Numbered on desktop, Load more on mobile), with the section padding (Medium) and page margin variables on the page background, and placed it in the Product template under Product main. Fixed the Rating summary Mobile atom on the way: its heading and histogram were fixed 400px and overflowed a 358px column, now they fill. Code follows: `sections/reviews.liquid` wrapper is `bg-background py-section-md`, the legacy beige `.reviews` rule is gone.

Rating summary moved to the 12-column grid (Figma atom and code): heading in columns 1 to 8, aside in columns 10 to 12, gutter from the layout variable; the 288px fixed aside is gone. Review filter and sort dropdowns render the `dropdown-menu` snippet (new `width` and `attributes` parameters, `w-60` under a chip as in the Figma Chip Open state) instead of a hand-written list; the chip chevron turns with `aria-expanded`.

Reviews toolbar filters and sort are the Select atom (sm), in Figma and in code, not dropdown chips: `reviews__ui.js` clones `select` from the template, fills the options before the element connects, and listens for `select:change`; its own open/close/keyboard code is gone. The Figma Reviews toolbar got Show search, Show filters, Show sort and Show write toggles; its Mobile variant is a vertical stack with the selects filling the width.

Select got a Width property (Fill, Hug) in Figma and a `width` parameter in code; Hug fits the value with a 240px menu and is what the reviews toolbar uses from md.

The review form (Figma Review form, 129:2665) is built from the atoms: `field` around `input`, `textarea`, `rating-input`, `file-upload` and `upload-preview`, name format and custom questions are radio `chip`s (`input_type: 'radio'`), submit and close are `button`. `reviews__form.css` is deleted. Errors and the status line are `helper-text`, so `reviews__ui.js` writes into `[data-helper-text]` and hides the email hint while its error shows. Rating hover preview is a tiny custom element (`rating-input.js`) instead of sibling selectors, so the fill logic stays readable.

Media lightbox follows a reference with no thumbnails or dots: the image fills the window height (4:5), one white pill holds previous, counter and next, close sits top right. Click zooms 2.5x at the click point and the zoomed image is dragged to pan (Figma State=Zoomed). The reviews photo dialog is gone: reviews render the same `media-lightbox` with `dynamic: true` and call `setItems`, so review videos play in the same viewer with native controls. `tailwind/components/reviews.css` is deleted, so no legacy `reviews__*.css` is left.

Footer rebuilt on atoms: `snippets/footer.liquid` (layout standard or minimal) with `menu-heading`, new `menu-links`, `accordion-item` (mobile), `social-links`, `newsletter-signup`, `divider`, `localization-selector` and new `payment-icons` (also used by the cart summary). No section settings: the columns come from the `footer` menu (top-level links = headings, children = links), the about text and copyright from `footer.*` locale keys, policies from `shop.policies`. `footer.css`, `footer__linklist` and `footer__socials` are deleted. Desktop and mobile use one DOM order with `order-*` utilities, except the menus, which render twice (columns, accordions) and swap with `lg:hidden`.

Placeholder logo: "Blanc" in Inter Semi Bold, outlined, `assets/logo.svg` (fill #171717, 106x32) and `assets/logo-symbol.svg` (the B). Figma Logo component (Wordmark, Symbol) holds the same vectors bound to `color/text`. `header__logo` is the one logo snippet (header, mobile menu, footer): `h-6` on mobile, `h-8` from lg, width follows the drawing, alt is the shop name. Swap the SVG per client. In Figma, scale a logo instance with Rescale, then set the height back (resizing the vector inside an instance does nothing).


## 2026-10-31: Header rebuilt on atoms

`snippets/header.liquid` (layout logo-left or logo-center) replaces `header__menu`, `header__account`, `header__cart`, `header__localization`, `header__search` and the legacy `header.css` / `header__menu.css`; only `header__logo` and `wishlist__link` stay as their own snippets. The section schema lost its `menu` setting (no settings in the boilerplate): the menu is `linklists['header-menu']` with `main-menu` as fallback. New atoms `nav-item` and `mega-menu` (Columns layout). The panel is positioned against the `<header>` (the list item is not `relative`), so it is full width and flush under the bar like Figma. The no-JS hover fallback for the panel is dropped with the CSS file. Header icon buttons are md (44px) as in Figma, the mobile menu button too. Announcement bar is not built because it needs merchant text; it comes with settings.

Mega menu backdrop: Figma Header State=Menu open gained a Backdrop (color/overlay at 30%, bottom of the panel to the bottom of a 900px window) and Templates / Home has a Menu open frame. Code: a fixed overlay inside `header` that fades in through `group-has-[[data-nav-item][data-open]]/header`, no JS. The bar (background and border) moved to an inner `relative z-10` wrapper so the overlay dims the page but not the bar.


## 2026-10-31: Buy box add-ons

Optional extra products in the buy box. Figma: Button got Show price + Price (shape dot, no text dot), new Add-on component (Molecules) and Product form Type=Add-ons. Code: `button` takes `price`/`price_amount`; `add-on` is the card (checkbox + label stretched over the card, so no nested labels); `add-ons` is the block. The products come from the product metafield `custom.add_ons` (list.product_reference, storefront PUBLIC_READ) instead of a section setting. `product-form` shows the total in the Add to cart button only when the product has add-ons. `product-form.js` recalculates the total on quantity, add-on and variant changes (the variant price rides on `data-amount` of the price in the refetched button) and, when add-ons are checked, posts one JSON request to cart/add with the page product (id, quantity, selling plan, properties) plus each add-on at quantity 1. Without add-ons the old FormData request is unchanged. Open: unchecking an add-on once it is in the cart is a cart drawer matter, not this card.


## 2026-10-31: Bundle builder

Figma: Templates / Bundle builder (Desktop, Mobile) on the existing Bundle builder Type=Box composition. Code: page template `page.bundle-builder.json` with section `main-bundle-builder`, snippets `bundle-tile`, `bundle-slot`, `bundle-tier-progress`, `bundle-tray`, and one custom element `bundle-builder` (`assets/bundle-builder.js`). Products come from the page metafield `custom.bundle_collection` (collection reference), falling back to all products, max 24. Tiers (2, 4, 6 items; 10, 15, 20%) are static in the section: the discount is only communicated here. The merchant makes it in the Shopify admin as an automatic discount on the same quantities, and the tray shows an estimate from the static tiers. One JSON request to cart/add with every selected variant, then the cart drawer opens and the selection resets. Placeholder strings in the locale use `[number]` style tokens because `{...}` breaks the Liquid tokenizer inside `t` args. Not built: the Multi-step type, multi-variant products, stock limits per variant (the cart reports them as an error under the button).


## 2026-10-31: Customer accounts removed from the theme

Shopify's new customer accounts are hosted by Shopify, so the legacy storefront account templates are gone: `main-account`, `main-reset-password`, the login snippets and `customer.js`. The header and mobile menu account icons keep linking to `routes.account_url`, which Shopify routes to the hosted accounts.

## 2026-10-31: Gift card template removed

The Dawn gift_card template had missing translation keys and a missing stylesheet. It is removed for v1 and comes back as a proper build with a Figma design.


## 2026-11-01: Newsletter section and popup

Figma: Sections / Newsletter existed (Centered, With image); added With image / Mobile. New Molecules / Newsletter popup (Desktop 800 with image, Mobile image on top) and a Templates / Newsletter popup section with Home Desktop and Mobile frames. Code: `snippets/newsletter.liquid` plus a thin `sections/newsletter.liquid` (centered, no settings, preset so it can be added in the editor; also added to `templates/index.json`), and `snippets/newsletter-popup.liquid` with `assets/newsletter-popup.js`, rendered once in `theme.liquid` above the cookie banner. The popup reuses the Newsletter signup atom with its own form id (`popup-newsletter`) so the form result (the page reloads after the post) lands in the popup, which then reopens by itself. Timing and snooze are parameters with defaults (8 seconds, 7 days), not settings. The image of the popup and of the with-image section waits for theme settings. Not testable on the dev store: the actual POST (Shopify answers automated requests with a bot check); the markup and logic are the unchanged signup atom plus the popup shell.

## 2026-11-01: Minimal footer removed

Figma Footer lost its Minimal layout (Desktop and Mobile); the footer snippet has no `layout` parameter any more and renders the standard footer only.

## 2026-11-01: Comparison table

Figma: Atoms / Comparison (cell set, column header set, row label), Sections / Comparison table (Highlight fill, card, tint, none x Dividers solid, dashed, dotted x Desktop, Mobile). Code: snippets `comparison-cell`, `comparison-column-header`, `comparison-row-label`, `comparison-table`, section `comparison-table` and `comparison-table.js` (tooltip pinning, scroll fade). Real `table` markup; the label column is two units wide next to one per column. No switcher: on mobile 2 to 3 columns fit as is, 4 or more scroll horizontally with native scroll, a sticky label column and a fade. Data is placeholder strings in the section (`name::type::highlighted::cta_label::cta_url::product::image` per column, `label::description::info::values` per row, values split by `;;`), because Liquid cannot build objects and `parse_json` does not exist in Shopify. No metafields or metaobjects yet: a later adapter only has to emit the same strings. No theme or section settings.

## 2026-11-01: Breakout grid and Section breakout

Figma: Sections / Section breakout (Preset Media band, Bleed right x Viewport) on a 14-track grid (6 on mobile): two outer tracks around 12 content columns. Outer track = page margin minus gutter (24 on desktop, 0 on mobile; Figma holds 0.01 because a grid track cannot be 0). Also a Blank breakout grid pair of frames. Code: `build-tokens.js` generates `.section-breakout` and `--grid-breakout` in `tailwind/tokens.css` (outer tracks are `minmax(max(margin - gutter, 0), 1fr)`, so they grow on windows wider than `layout/max-width` while content stays capped). Cells are placed by content column number (`--start`, `--span`; `--start-mobile`, `--span-mobile`) and `data-bleed` full, right or left. The column count switches at 1024 (lg), matching the other sections, not at the tablet layout mode. The existing 21 sections keep `max-w-page px-page-margin`; convert one only when a design needs a full-bleed cell. Two section files, one per preset, because there are no section settings to pick a preset; both pass placeholder copy to `snippets/section-breakout.liquid`. Verified with the real CSS at 1440, 1900 and 390 in a static render; the dev server was not reachable for a Liquid render.

## 2026-11-01: Video and UGC

Figma: Atoms / Media / Play button and Video (Ratio 4:5, 9:16 x State Paused, Playing x Sound Muted, Unmuted), Sections / UGC (Layout Grid, Carousel x Desktop, Mobile). There is no pause button: Paused shows only a play button; Playing hides it and shows the sound toggle and the progress bar, and tapping the video pauses. Code: snippets `play-button`, `video`, `ugc`, sections `ugc-grid` and `ugc-carousel`, `video-player.js`, icons `icon__volume-2` and `icon__volume-x`. Defaults: videos start muted, loop, `preload none`, only one plays at a time, and a video pauses when it leaves the viewport. Two section files because there are no section settings to pick the layout. Data is placeholder cards; the snippet takes a `videos` list of Shopify video media so a later source only has to supply that.
