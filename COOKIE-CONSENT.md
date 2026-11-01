# Cookie consent

Custom banner on top of Shopify's Customer Privacy API. It replaces Shopify's built-in cookie banner. All storefront copy is in `locales/en.default.json` under `cookie_consent`, so Translate & Adapt can translate it. The only section setting is an optional policy URL, which falls back to the store privacy policy.

The banner is a static section in `layout/theme.liquid`, rendered just before `</body>`. There is no overlay section group, and a merchant can remove sections from the footer group, so the layout include is what keeps the banner on every storefront page. It is not on the password page.

Preferences and the US opt-out open overlay panels. They are not `<dialog>` elements. The panel still uses `role="dialog"` so a screen reader announces it as a modal. Focus is trapped, Escape closes it, and focus returns to the control that opened it.

## Admin setup

1. In **Settings > Customer privacy**, set the regions where a banner is required, and the regions that need a data sale/sharing opt-out.
2. Turn off Shopify's own cookie banner so two banners do not show.
3. Prefer **Settings > Customer events** (app pixels and custom pixels) for tracking. Shopify gates those automatically.
4. For each enabled app embed (**Theme editor > App embeds**), check whether the app respects Shopify consent, and whether its own settings have a consent option. Theme and app-embed scripts are not gated by Shopify.

## Gate a theme script

`type="text/plain"` stops the browser from running the script. After consent, `cookie-consent.js` replaces each matching tag with a real script, once.

```liquid
{% render 'consent-script', category: 'analytics', src: 'https://example.com/tracker.js' %}
```

```liquid
{% capture pixel %}
  // inline pixel
{% endcapture %}
{% render 'consent-script', category: 'marketing', code: pixel %}
```

`category` is `analytics`, `marketing`, `preferences`, or `sale_of_data`.

The same pattern without the snippet:

```html
<script type="text/plain" data-consent="analytics" data-src="https://example.com/tracker.js"></script>

<script type="text/plain" data-consent="marketing">
  // inline pixel
</script>
```

From theme JavaScript:

```js
CookieConsent.onAllowed('analytics', function () {
  // runs now if already allowed, otherwise once consent is granted
});
```

`CookieConsent.ready` resolves when the Customer Privacy API has loaded. `CookieConsent.isAllowed('analytics')` reads the API's final decision (merchant settings, region, and the visitor's choice). `CookieConsent.openPreferences()` opens the preferences panel.

A script that already ran cannot be unloaded. If the visitor turns off a category that was allowed, the page reloads after the choice is saved.

## Reopen and opt-out links

Any of these open preferences, including after the visitor has already chosen:

```html
<a href="#cookie-preferences">Cookie preferences</a>
<button type="button" data-cookie-preferences>Cookie preferences</button>
```

A Navigation menu item whose URL is `#cookie-preferences` works with no theme edit. Clicks are handled on `document`, so links added later work too.

The opt-out is never a popup on load. The visitor starts it:

```html
<a href="#do-not-sell">Do not sell or share my personal information</a>
<a href="#do-not-sell" data-cookie-do-not-sell>Do not sell or share my personal information</a>
```

`[data-cookie-do-not-sell]` and `a[href$="#do-not-sell"]` are hidden until `saleOfDataRegion()` is true. In the theme editor they are shown so the link can be found. Confirming calls `setTrackingConsent({ sale_of_data: false })`.

Footer example, if you would rather hard-code the links than use a menu:

```liquid
<li>
  <a href="#cookie-preferences">Cookie preferences</a>
</li>
<li>
  <a href="#do-not-sell" data-cookie-do-not-sell>Do not sell or share my personal information</a>
</li>
```

## Layout notes

- The banner is `position: fixed` (`z-index: 40`), so it does not push the page. Drawers and quick view sit at 500, the search modal at 50, and the loading bar at 1000. The preferences panel is `z-index: 600` so it can sit above an open drawer.
- Accept and Reject use the same button styles. Nothing is pre-checked for a visitor who has not chosen. `currentVisitorConsent()` value `'yes'` checks a toggle; `'no'` and `''` leave it off. Strictly necessary stays on and disabled.

## Testing checklist

- [ ] EU visitor (VPN), incognito: banner shows. Network tab shows no analytics or marketing requests before clicking.
- [ ] Accept all: banner closes, gated scripts load without a reload, `currentVisitorConsent()` shows `'yes'` for all.
- [ ] Reject all: banner closes, no gated scripts load, stays closed after reload.
- [ ] Save preferences with only analytics on: only analytics scripts load.
- [ ] Reopen link works after a choice, toggles show the saved state.
- [ ] Withdrawing consent reloads the page and gated scripts no longer run.
- [ ] UK visitor: banner shows.
- [ ] California visitor: no opt-in banner, "Do not sell" link visible and working.
- [ ] Visitor in a region without a banner (e.g. Thailand): no banner, gated scripts load.
- [ ] Global Privacy Control enabled in the browser: respected in configured regions.
- [ ] Keyboard only: all controls reachable, Escape closes the modal, focus returns.
- [ ] Screen reader announces the banner and modal properly.
- [ ] Mobile: no overlap with sticky add-to-cart, no layout shift.
- [ ] Theme editor: banner previews when the section is selected, no consent saved.
- [ ] Checkout: consent carries over.
