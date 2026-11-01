# Reading a site's brand

Reads the colours and fonts a website really uses, and proposes Blanc tokens from them.

## Steps

1. Open the site in a browser the AI can drive (the built-in browser pane). The AI asks for access to the site first.
2. Run `scripts/brand/extract-in-page.js` on the page. It walks the rendered page, so computed styles are used, not the stylesheet text. It returns JSON: colours weighted by visible area or text amount, fonts per role (headings are 20px and up), the type sizes in use, button fill, text, radius and casing, border colours, CSS colour variables, the font files the page loaded and the font services it links to.
3. Save the result as `brand/<site>.json`.
4. `npm run brand -- brand/<site>.json` prints a report and the proposed tokens. Add `--apply` to merge colours, fonts and radius into `tokens/figma-tokens.json` (the file is rewritten in expanded JSON), then `npm run tokens`.
5. Mirror the same values in the Figma variables.

## What the report decides

| Token | From |
|---|---|
| `background`, `text`, `text-muted`, `surface`, `border` | the most used colours by role, merged when within a few shades |
| `accent`, `accent-contrast` | the primary button fill and its text, else the most used saturated colour |
| `accent-hover`, `accent-subtle`, `surface-alt`, `border-strong` | derived from the above (mixes), listed as such in the report |
| `sale`, `error` | only when the site uses a red, otherwise left alone |
| `font/heading`, `font/body` | the family used for large text and for body text |
| `radius/*` | the most common button, input and media radius, snapped to the Tailwind scale (`full` for pills) |

## Check before applying

- Fonts: the report says where each font comes from. Google Fonts load through `snippets/fonts.liquid`. Adobe, Typekit and self-hosted fonts are licensed to the site owner: ask the client for the files or pick a substitute, and replace the body of `snippets/fonts.liquid`.
- A site that serves different styles by viewport or consent state can read differently on a second pass. Run it on the home page and on a product page and compare.
- Photos, gradients and brand colours that only appear in images or SVG logos are not read. Check the logo by eye.
