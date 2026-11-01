// Generates tailwind/tokens.css from tokens/figma-tokens.json.
// Run: node scripts/build-tokens.js
// The JSON is written by the Figma export (see docs/TOKENS.md). Do not edit tokens.css by hand.
const fs = require('fs');
const path = require('path');
const t = JSON.parse(fs.readFileSync(path.join(__dirname, '../tokens/figma-tokens.json'), 'utf8'));

const palette = (ref) => {
  // palette/neutral/900 -> var(--color-neutral-900); palette/white -> #fff; #1f4d3a stays a hex (brand colours outside the palette)
  if (/^#[0-9a-fA-F]{3,8}$/.test(ref)) return ref;
  const p = ref.replace('palette/', '');
  if (p === 'white') return '#ffffff';
  if (p === 'black') return '#000000';
  return `var(--color-${p.replace('/', '-')})`;
};
const px = (n) => `${n}px`;
const rem = (n) => `${n / 16}rem`;
const out = [];

out.push(`/* Generated from tokens/figma-tokens.json by scripts/build-tokens.js. Do not edit. */\n`);

// --- @theme: semantic colours, radii, fonts, containers
out.push('@theme static {');
out.push('  --font-heading: "' + t.font.heading + '", sans-serif;');
out.push('  --font-body: "' + t.font.body + '", sans-serif;');
for (const [k, v] of Object.entries(t.color)) out.push(`  --color-${k}: ${palette(v)};`);
for (const [k, v] of Object.entries(t.radius)) out.push(`  --radius-${k}: ${v === 'none' ? '0px' : v === 'full' ? '9999px' : `var(--radius-${v})`};`);
out.push(`  --container-page: ${px(t.layout['max-width'][0])};`);
out.push('}\n');

// Icon stroke width (Figma: icon/stroke). Applied to every stroke icon so assets stay at the default and follow the token.
out.push(`:root { --icon-stroke: ${t.icon.stroke}; }`);
out.push('@layer base {\n  svg[stroke="currentColor"], svg[stroke="currentColor"] *, svg [stroke="currentColor"] { stroke-width: var(--icon-stroke); }\n}\n');

// --- layout tokens per breakpoint (Figma Layout modes)
const L = t.layout; const modes = L.modes; // Desktop, Tablet, Mobile
const keys = Object.keys(L).filter((k) => Array.isArray(L[k]) && !['max-width', 'columns', 'modes'].includes(k));
const block = (mode) => keys.map((k) => `  --${k}: ${px(L[k][modes.indexOf(mode)])};`).join('\n');
out.push(`:root {\n  --columns: ${L.columns[2]};\n${block('Mobile')}\n}`);
out.push(`@media (min-width: ${px(L.breakpoints.Tablet)}) {\n  :root {\n  --columns: ${L.columns[1]};\n${block('Tablet').replace(/^/gm, '  ')}\n  }\n}`);
out.push(`@media (min-width: ${px(L.breakpoints.Desktop)}) {\n  :root {\n  --columns: ${L.columns[0]};\n${block('Desktop').replace(/^/gm, '  ')}\n  }\n}\n`);

// expose layout tokens as Tailwind utilities: px-page-margin, gap-x-gutter, gap-grid-x, py-section-md, max-w-prose-width, h-logo
out.push('@theme inline {');
for (const k of ['gutter', 'page-margin', 'section-sm', 'section-md', 'section-lg', 'grid-gap-x', 'grid-gap-y', 'logo-height']) out.push(`  --spacing-${k}: var(--${k});`);
out.push('  --container-prose-width: var(--prose-width);');
out.push('}\n');

// --- section shell: padding modes (Figma Padding top / Padding bottom)
out.push('/* Section padding modes. Set data-padding-top / data-padding-bottom on the section shell. */');
for (const side of ['top', 'bottom']) {
  for (const [mode, ref] of Object.entries(t.sectionPadding)) {
    const val = ref === 0 ? '0' : `var(--${ref})`;
    out.push(`.section-shell[data-padding-${side}="${mode}"] { padding-${side}: ${val}; }`);
  }
}
out.push('');

// --- grid
out.push(`/* 12-column grid (4 on mobile). Cells set --span, --start, --span-mobile, --row. */
.section-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); column-gap: var(--gutter); row-gap: var(--grid-gap-y); }
.section-grid > * { grid-column: span var(--span-mobile, 4); min-width: 0; }
@media (min-width: ${px(L.breakpoints.Desktop)}) {
  .section-grid { grid-template-columns: repeat(12, minmax(0, 1fr)); }
  .section-grid > * { grid-column: var(--start, auto) / span var(--span, 12); grid-row: var(--row, auto); }
}
`);

// --- breakout grid (Figma: Section breakout)
// 12 content columns (4 on mobile) flanked by two outer tracks that hold the page margin (margin minus gutter, never below 0) and
// grow on windows wider than layout/max-width. Content cells set --start and --span (content column numbers, --start-mobile and
// --span-mobile on mobile). data-bleed="full" runs the cell from edge to edge, "right" from its start to the right edge, "left" from the
// left edge to its end. Figma holds the mobile outer track at 0.01 because a grid track cannot be 0.
out.push(`/* Breakout grid. Cells: --start, --span, --start-mobile, --span-mobile; data-bleed="full | right | left". */
.section-breakout {
  --outer-track: minmax(max(calc(var(--page-margin) - var(--gutter)), 0px), 1fr);
  --cols: ${L.columns[2]};
  --column-width: calc((var(--container-page) - var(--page-margin) * 2 - var(--gutter) * (var(--cols) - 1)) / var(--cols));
  --grid-breakout: [full-start] var(--outer-track) [content-start] repeat(var(--cols), minmax(0, var(--column-width))) [content-end] var(--outer-track) [full-end];
  display: grid;
  grid-template-columns: var(--grid-breakout);
  column-gap: var(--gutter);
  row-gap: var(--grid-gap-y);
}
.section-breakout > * { grid-column: calc(var(--start-mobile, 1) + 1) / span var(--span-mobile, 4); min-width: 0; }
.section-breakout > [data-bleed="full"] { grid-column: full-start / full-end; }
.section-breakout > [data-bleed="right"] { grid-column: calc(var(--start-mobile, 1) + 1) / full-end; }
.section-breakout > [data-bleed="left"] { grid-column: full-start / calc(var(--start-mobile, 1) + var(--span-mobile, 4) + 1); }
@media (min-width: ${px(L.breakpoints.Desktop)}) {
  .section-breakout { --cols: ${L.columns[0]}; }
  .section-breakout > * { grid-column: calc(var(--start, 1) + 1) / span var(--span, 12); }
  .section-breakout > [data-bleed="full"] { grid-column: full-start / full-end; }
  .section-breakout > [data-bleed="right"] { grid-column: calc(var(--start, 1) + 1) / full-end; }
  .section-breakout > [data-bleed="left"] { grid-column: full-start / calc(var(--start, 1) + var(--span, 12) + 1); }
}
`);

// --- text styles -> utilities
const names = [];
for (const [name, s] of Object.entries(t.textStyles)) {
  names.push(`text-${name}`);
  const fam = s.family === 'body' ? 'var(--font-body)' : 'var(--font-heading)';
  const lines = [
    `font-family: ${fam};`,
    `font-size: ${rem(s.size)};`,
    `line-height: ${s.leading / 100};`,
    `letter-spacing: ${s.tracking / 100}em;`,
    `font-weight: ${s.weight};`,
  ];
  if (s.uppercase) lines.push('text-transform: uppercase;');
  if (s.underline) lines.push('text-decoration-line: underline; text-underline-offset: 0.15em;');
  out.push(`@utility text-${name} {\n  ${lines.join('\n  ')}\n}`);
}
out.push('');
// safelist: classes assembled in Liquid are invisible to the scanner
out.push(`/* Safelist for classes assembled in Liquid (text block styles per breakpoint). */`);
out.push(`@source inline("{,md:,lg:}{${names.join(',')}}");`);

fs.writeFileSync(path.join(__dirname, '../tailwind/tokens.css'), out.join('\n') + '\n');
console.log(`tokens.css written: ${Object.keys(t.color).length} colours, ${Object.keys(t.radius).length} radii, ${keys.length} layout tokens x 3 modes, ${names.length} text utilities`);

// Fonts: snippets/fonts.liquid loads the two families from Google Fonts. Self-hosted or Adobe fonts: replace the snippet body, keep the family names in the token file.
const weights = new Set();
(function walk(o) { if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (k === 'weight' && typeof v === 'number') weights.add(v); else walk(v); } })(t);
const wlist = [...(weights.size ? weights : [400, 500, 600])].sort((a, b) => a - b).join(';');
const families = [...new Set([t.font.heading, t.font.body])];
const query = families.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@${wlist}`).join('&');
fs.writeFileSync(path.join(__dirname, '../snippets/fonts.liquid'), `{%- comment -%}Generated by scripts/build-tokens.js from tokens/figma-tokens.json (font). Do not edit.{%- endcomment -%}\n<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${query}&display=swap">\n`);
