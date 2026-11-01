# Tokens

Design tokens flow one way: Figma variables and text styles → `tokens/figma-tokens.json` → `tailwind/tokens.css`. Nobody edits `tokens.css` by hand.

## Pipeline

1. **Export from Figma.** A session with the Figma MCP reads all variable collections and text styles from the Blanc file and writes `tokens/figma-tokens.json`. Primitives are not exported: the Figma palette, spacing, radius and type scales equal Tailwind v4 defaults, so semantic tokens alias Tailwind's own variables (`color/text` → `var(--color-neutral-900)`).
2. **Generate.** `node scripts/build-tokens.js` writes `tailwind/tokens.css`.
3. **Build.** `npm run dev` compiles `assets/tailwind.input.css`, which imports `tokens.css` first.

Rerun steps 1 and 2 after any token change in Figma.

## What tokens.css contains

| Block | Source in Figma | Use in code |
|---|---|---|
| `@theme static` colours | Color collection | `bg-surface`, `text-text-muted`, `border-border`, `var(--color-accent)` |
| `@theme static` radii | Radius semantic tokens | `rounded-button`, `rounded-media` |
| `@theme static` fonts | Typography `font/heading`, `font/body` | `font-heading`, `font-body` |
| `--container-page` | `layout/max-width` | `max-w-page` |
| `:root` layout variables per breakpoint | Layout collection modes | `var(--gutter)`, `var(--page-margin)`, `var(--section-md)`, `var(--grid-gap-x)`, `var(--prose-width)`, `var(--logo-height)` |
| `@theme inline` spacing aliases | same | `px-page-margin`, `gap-x-gutter`, `gap-x-grid-gap-x`, `py-section-md`, `h-logo-height`, `max-w-prose-width` (Tailwind reserves `max-w-prose` for a fixed 65ch) |
| `.section-shell[data-padding-*]` | Padding top / Padding bottom modes | `data-padding-top="md"` on the section shell |
| `.section-grid` | Section grid | the grid with `--span`, `--start`, `--span-mobile`, `--row` on cells |
| `@utility text-*` | Text styles | `text-heading-2`, `text-body-sm`, `text-label-caps` |
| `@source inline` | | safelist so `text-{style}` and `lg:text-{style}` exist even when assembled in Liquid |

`@theme static` keeps every token in the output even when unused, so Liquid-assembled classes and inline `var()` references always resolve.

## Breakpoints

| Width | Tailwind prefix | Figma source |
|---|---|---|
| under 768 | none | Mobile frame, Mobile mode |
| 768 to 1023 | `md:` | Mobile layout, Tablet mode values |
| 1024 and up | `lg:` | Desktop frame, Desktop mode |

Layout variables switch at these widths on `:root`, so a utility like `px-page-margin` is responsive by itself.

## Type

Text utilities are fixed-size. Responsiveness is `text-heading-3 lg:text-heading-2`. Default pairings are in `docs/FIGMA-TO-CODE.md`. Sizes are in rem (16px base); tracking is in em so it scales with size.

## Legacy

`assets/tailwind.input.css` keeps `--font-primary` and `--font-secondary` as aliases, and the old component CSS files still reference Tailwind's default `gray-*` and `red-*` (their values differ slightly from the previous custom palette). Both go away in milestone 4 when the component CSS is replaced by utilities in snippets.
