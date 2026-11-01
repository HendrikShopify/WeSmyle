# Starting a client project

Duplicate the Blanc Figma file, copy this repo, then work through this list with the AI. Design leads: change Figma first, then mirror it in code. The Figma file has the same walkthrough on its "Getting started" page.

## 1. Point the repo at the new file

- Duplicate the Figma file in the Slashcheckout team and give the AI the new link.
- Replace the file key in `tokens/figma-tokens.json` (`source`). It is the only place the key lives.
- Node ids in `docs/COMPONENTS.md` (for example `612:9047`) belong to the original file and change on duplication. Find components by name and page instead: the Figma name in the table is the source of truth.

## 2. Brand tokens

Starting from a client's existing site? Read its colours and fonts first (`docs/BRAND-EXTRACT.md`), then adjust by hand.

1. In Figma, change the variables: colours (semantic `color/*`), `font/heading` and `font/body`, radius, layout. Brand colours outside the Tailwind palette are fine.
2. Export to `tokens/figma-tokens.json` (see `docs/TOKENS.md`). Colours are `palette/<name>/<step>` or a hex value like `#1f4d3a`. Fonts are family names.
3. `npm run tokens`. This rewrites `tailwind/tokens.css` and `snippets/fonts.liquid` (Google Fonts link for both families and the weights the text styles use). For self-hosted or Adobe fonts, replace the body of `snippets/fonts.liquid` and keep the family names.
4. `npm run dev`. Look at the homepage atom showcase to see the new brand on every component.

## 3. Replace placeholders

- `assets/logo.svg` and `assets/logo-symbol.svg` are the Blanc placeholder (outlined "Blanc"). Replace both, and in Figma the Logo component.
- `templates/index.json` renders `main-index`, a temporary atom showcase. Swap it for real sections once the homepage is designed.
- `sections/comparison-table.liquid` holds placeholder strings (Blanc, Others, Shop now). Edit the strings or feed the snippet real data.
- Locale strings in `locales/en.default.json` carry the copy. Product, collection and page content comes from the store.

## 4. Build the client's pages

- New section: design it in Figma (Sections page, Desktop and Mobile), then add `sections/<name>.liquid` rendering existing snippets. Rules are in `CLAUDE.md` and `docs/FIGMA-TO-CODE.md`.
- No new component CSS. Tokens and utilities live in the markup.
- Add each new snippet or section to `docs/COMPONENTS.md` and log decisions in `docs/DECISIONS.md`.

## 5. Before launch

- `shopify theme check`
- Mobile overflow on every template, keyboard and focus pass on the header, drawers and popups.
- Fresh theme preview (`shopify theme push --unpublished`), not just the dev server.
- Store-side setup the theme only assumes: bundle discount and `custom.bundle_collection` metafield if the bundle builder ships, the review app account.
