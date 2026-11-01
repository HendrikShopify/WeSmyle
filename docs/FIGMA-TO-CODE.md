# Figma to code

The contract between the Blanc Figma file and this theme. Every rule here has a mirror on the Figma Read me page.

## Reading a Figma node

1. Identify the layer type: variable, text style, component, instance, section, cell, template frame.
2. Find its code counterpart by name (table below). If none exists, it is new: create it under the same name.
3. Translate properties with the mapping rules. Never redraw a component that has a snippet; render it.

| Figma | Code |
|---|---|
| Variable `color/text` | `--color-text` in `@theme`, class `text-text` |
| Variable `radius/button` | `--radius-button`, class `rounded-button` |
| Variable `layout/gutter` (per mode) | `--gutter` on `:root`, switched per breakpoint, class `gap-x-gutter` |
| Padding top / bottom mode | Section setting `padding_top`, `padding_bottom`: `none`, `sm`, `md`, `lg` |
| Text style `heading/2` | `@utility text-heading-2`, fixed size, no breakpoints inside |
| Component `Button` | `snippets/button.liquid` |
| Variant property `Style=Secondary` | Parameter `style: 'secondary'` |
| Boolean property `Show vendor` | Parameter `show_vendor: true`, or setting `show_vendor` on a section |
| Text property `Label` | Parameter `label` |
| Exposed instance (Price inside Product card) | The card renders `price.liquid` and passes its parameters through |
| Section `Featured collection` | `sections/featured-collection.liquid` |
| Section grid preset `Split` | A preset in `sections/section-grid.liquid` schema |
| Cell `Cell · span 6 · start 7 · align center` | Block `cell` with `span: 6, start: "7", align: "center"` |
| Block / Text `Type=Heading, Align=Center` | Block `text` with `style: heading, align: center` |
| Template frame `Product / Desktop` | `templates/product.json`, sections in frame order |
| Layer named `Media` with ratio `4:5` | `{% render 'media', ratio: '4:5' %}` |

## Breakpoints

Figma has Desktop (1440) and Mobile (390) frames, and a Tablet mode in the Layout variables with no frames.

| Width | Tailwind | Figma source |
|---|---|---|
| under 768 | base classes | Mobile frame, Mobile mode values |
| 768 to 1023 | `md:` | Mobile layout, Tablet mode values |
| 1024 and up | `lg:` | Desktop frame, Desktop mode values |

Rule: the Mobile frame gives the base classes, the Desktop frame gives the `lg:` classes. The `md:` step only changes token values, never layout, unless a Tablet frame exists.

## Type

Text styles are visual sizes, not elements. `heading/2` means 36px semibold tight; it says nothing about `<h2>`. The HTML tag is a separate choice made for document structure.

When Mobile and Desktop frames use different styles: `text-{mobile} lg:text-{desktop}`. When only a Desktop style is known, use the default pairing:

| Desktop | Mobile |
|---|---|
| display/1 | display/2 |
| heading/1 | heading/2 |
| heading/2 | heading/3 |
| heading/3 | heading/4 |
| heading/4 to 6, body, label, link | same |

Classes assembled from strings in Liquid are invisible to Tailwind's scanner. Every `text-*` utility is listed once in `tokens.css` under `@source inline()`.

## Snippet contract

```liquid
{% comment %}
  Figma: Components Atoms / Button
  style: primary | secondary      (Figma: Style)
  size:  sm | md | lg             (Figma: Size)
  States: :hover, :focus-visible, [disabled], [aria-busy]
{% endcomment %}
```

- Header comment names the Figma component and lists every parameter with its Figma property.
- Defaults match the Figma default variant.
- Variant values are lower-case versions of the Figma values: `Secondary` is `secondary`, `Thumbnails left` is `thumbnails-left`.
- `class` is accepted and appended, for placement only (width, margin), never for restyling.
- `data-*` attributes carry variant values for JS and CSS hooks: `data-style="secondary"`.

## Section contract

- The section file name is the Figma section name in kebab-case.
- Every Figma boolean property is a checkbox setting with the same id in snake_case.
- Every Figma variant property with layout meaning is a select setting.
- Padding top and bottom are selects handled by `section-shell`.
- Sections render snippets and blocks; they contain no component markup of their own.

## Section grid

One section, `section-grid`, with Cell blocks and content blocks. Figma presets are schema presets. A Figma cell's name is its settings. Figma cannot overlap cells, so "text over image" is a cell with background media, in Figma and in code.

## Code Connect

Every snippet is mapped to its Figma component through the Figma MCP (`add_code_connect_map`) once the snippet is done, with the render call as the snippet example. The mapping is the proof that design and code agree on parameters.

## When something changes in Figma

| Change | Do | Touch |
|---|---|---|
| Token value | Rerun the token export | `tokens.css` |
| Look of a component | Compare the Figma node with the snippet, update classes | one snippet |
| New property or variant | Add the parameter and the setting | snippet, section schema |
| New Section grid preset | Add the preset | `section-grid.liquid` schema |
| New section | Compose from snippets and blocks | one new section file |
| Template order | Regenerate the JSON | one template |

## What not to do

- Do not create a snippet, class or token that duplicates an existing one under another name.
- Do not put utilities in a section for something a snippet already styles.
- Do not add a parameter for a state.
- Do not hardcode copy; use locale strings.
- Do not generate markup for a component that has a snippet; render the snippet.
