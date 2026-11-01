#!/usr/bin/env node
/*
  Turns a brand extract (scripts/brand/extract-in-page.js output) into Blanc tokens.
    node scripts/brand-tokens.js brand/<site>.json            report and proposed tokens
    node scripts/brand-tokens.js brand/<site>.json --apply    merge into tokens/figma-tokens.json (colours, fonts, radius), then run `npm run tokens`
  Only the roles it can read from the site are proposed; everything else keeps the current value. Check the proposal against the site before applying.
*/
const fs = require('fs');
const path = require('path');

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/brand-tokens.js brand/<site>.json [--apply]');
  process.exit(1);
}
const apply = process.argv.includes('--apply');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c) => '#' + c.map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('');
const lum = (h) => {
  const [r, g, b] = rgb(h).map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const chroma = (h) => {
  const [r, g, b] = rgb(h);
  return Math.max(r, g, b) - Math.min(r, g, b);
};
const dist = (a, b) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));
const hue = (h) => {
  const [r, g, b] = rgb(h).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return 0;
  const x = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (x * 60 + 360) % 360;
};
const mix = (a, b, t) => hex(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * t));

// merge near-identical colours so anti-aliased variants count together
const cluster = (list) => {
  const out = [];
  for (const { value, weight } of list) {
    const hit = out.find((o) => dist(o.value, value) < 10);
    if (hit) hit.weight += weight;
    else out.push({ value, weight });
  }
  return out.sort((a, b) => b.weight - a.weight);
};

const background = data.background;
const bgs = cluster(data.backgrounds);
const texts = cluster(data.text);
const borders = cluster(data.borders);

const proposal = { color: {}, font: {}, radius: {} };
const notes = [];
const set = (role, value, why) => {
  if (!value) return;
  proposal.color[role] = value;
  notes.push(`${role.padEnd(16)} ${value}  ${why}`);
};

set('background', background, 'page background');
const text = texts.find((t) => contrast(t.value, background) >= 4.5) || texts[0];
set('text', text && text.value, 'most used text colour');
const muted = texts.find((t) => t !== text && contrast(t.value, background) >= 3 && contrast(t.value, background) < contrast(text.value, background) - 0.8 && chroma(t.value) < 60);
set('text-muted', muted ? muted.value : text && mix(text.value, background, 0.4), muted ? 'second text colour' : 'text mixed 40% toward the background');
set('text-inverse', lum(background) > 0.5 ? '#ffffff' : '#000000', 'opposite of the background');
const surfaceCandidate = bgs.find((b) => dist(b.value, background) > 6 && dist(b.value, background) < 90 && chroma(b.value) < 50 && b.weight > 2000);
set('surface', surfaceCandidate ? surfaceCandidate.value : mix(background, text.value, 0.04), surfaceCandidate ? 'most used neighbouring background' : 'background mixed 4% toward the text colour');
set('surface-alt', mix(proposal.color.surface, text.value, 0.04), 'surface mixed 4% toward the text colour');
const bd = borders.find((b) => dist(b.value, background) > 6 && chroma(b.value) < 60);
set('border', bd ? bd.value : mix(background, text.value, 0.12), bd ? 'most used border colour' : 'background mixed 12% toward the text colour');
set('border-strong', mix(proposal.color.border, text.value, 0.4), 'border mixed 40% toward the text colour');

// accent: the primary button fill, else the most used saturated colour
const buttons = data.buttons || [];
const filled = buttons.filter((b) => b.background && dist(b.background, background) > 30);
const primary = filled.find((b) => chroma(b.background) > 40) || filled[0];
let accent = primary && primary.background;
let accentWhy = 'primary button fill';
if (!accent) {
  const pick = cluster([...data.backgrounds, ...data.text, ...Object.values(data.cssVariables || {}).filter((v) => /^#/.test(v)).map((value) => ({ value, weight: 1 }))]).find((c) => chroma(c.value) > 60);
  accent = pick && pick.value;
  accentWhy = 'most used saturated colour';
}
accent = accent || text.value;
set('accent', accent, accentWhy);
set('accent-hover', lum(accent) > 0.4 ? mix(accent, '#000000', 0.12) : mix(accent, '#ffffff', 0.15), 'accent shifted 12 to 15%');
set('accent-subtle', mix(background, accent, 0.1), 'accent at 10% over the background');
set('accent-contrast', primary && primary.color && contrast(primary.color, accent) >= 4.5 ? primary.color : contrast('#ffffff', accent) >= contrast('#000000', accent) ? '#ffffff' : '#000000', 'readable text on the accent');
set('focus', accent, 'same as accent');

// sale / error: only when the site actually uses a red
const reds = cluster([...data.backgrounds, ...data.text]).filter((c) => chroma(c.value) > 80 && (hue(c.value) < 15 || hue(c.value) > 345));
if (reds[0]) {
  set('sale', reds[0].value, 'the red this site uses');
  set('error', reds[0].value, 'the red this site uses');
}

// fonts
const top = (list) => (list && list[0] ? list[0].value.split('|') : null);
const heading = top(data.fontsHeading), bodyFont = top(data.fontsBody);
const generic = /^(-apple-system|system-ui|sans-serif|serif|monospace|blinkmacsystemfont|segoe ui|arial|helvetica|times new roman)$/i;
const body = (bodyFont && bodyFont[0]) || data.bodyFont.family;
const head = (heading && heading[0]) || body;
proposal.font = { heading: head, body };
const fontSource = (name) => {
  const loaded = (data.loadedFaces || []).some((f) => f.split('|')[0].toLowerCase() === name.toLowerCase());
  const google = (data.fontSources || []).some((s) => /googleapis/.test(s) && s.toLowerCase().includes(name.toLowerCase().replace(/ /g, '+')));
  const kit = (data.fontSources || []).some((s) => /typekit|adobe/.test(s));
  return generic.test(name) ? 'system font, no file to load' : google ? 'Google Fonts' : kit ? 'Adobe Fonts, check the licence' : loaded ? 'self-hosted or custom, check the licence' : 'not seen loading';
};

// radius, mapped to the nearest Tailwind v4 step
const steps = { none: 0, xs: 2, sm: 4, md: 6, lg: 8, xl: 12, '2xl': 16, '3xl': 24 };
const step = (px) => (px >= 100 ? 'full' : Object.entries(steps).sort((a, b) => Math.abs(a[1] - px) - Math.abs(b[1] - px))[0][0]);
const common = (list) => (list && list[0] ? list[0].value : null);
const buttonRadius = buttons.length ? buttons.map((b) => b.radius).sort((a, b) => buttons.filter((x) => x.radius === b).length - buttons.filter((x) => x.radius === a).length)[0] : common(data.radii.button);
const radiusRole = { button: buttonRadius, input: common(data.radii.input) ?? buttonRadius, chip: buttonRadius, badge: buttonRadius, swatch: buttonRadius, media: common(data.radii.media) ?? 0 };
for (const [role, px] of Object.entries(radiusRole)) if (px != null) proposal.radius[role] = step(Number(px));

// report
const lines = [];
lines.push(`# Brand read of ${data.url}`, '', `Title: ${data.title}`, '');
lines.push('## Colours', '', '```', ...notes, '```', '');
lines.push('Raw, by visible use', '', '```');
lines.push('text         ' + texts.slice(0, 5).map((t) => t.value).join('  '));
lines.push('backgrounds  ' + bgs.slice(0, 6).map((t) => t.value).join('  '));
lines.push('borders      ' + borders.slice(0, 4).map((t) => t.value).join('  '));
if (data.themeColor) lines.push('theme-color  ' + data.themeColor);
lines.push('```', '');
const vars = Object.entries(data.cssVariables || {}).slice(0, 14);
if (vars.length) lines.push('CSS colour variables', '', '```', ...vars.map(([k, v]) => `${k}: ${v}`), '```', '');
lines.push('## Fonts', '');
lines.push(`Heading: ${head} (${heading ? heading[1] : data.bodyFont.weight}), ${fontSource(head)}`);
lines.push(`Body: ${body} (${bodyFont ? bodyFont[1] : data.bodyFont.weight}), ${fontSource(body)}`, '');
lines.push('Type in use (tag, size, weight, family, transform, letter spacing)', '', '```', ...(data.typeScale || []).slice(0, 10).map((t) => t.value.replace(/\|/g, '  ')), '```', '');
lines.push('## Buttons and shape', '');
if (primary) lines.push(`Primary button: fill ${primary.background}, text ${primary.color}, radius ${primary.radius}px, ${primary.size}px ${primary.weight}${primary.transform !== 'none' ? ' ' + primary.transform : ''}`);
lines.push(`Radius: ${Object.entries(proposal.radius).map(([k, v]) => `${k} ${v}`).join(', ')}`, '');
lines.push('## Proposed tokens (tokens/figma-tokens.json)', '', '```json', JSON.stringify(proposal, null, 2), '```', '');
if (data.logo) lines.push(`Logo: ${data.logo}`, '');
console.log(lines.join('\n'));

if (apply) {
  const target = path.join(__dirname, '..', 'tokens', 'figma-tokens.json');
  const tokens = JSON.parse(fs.readFileSync(target, 'utf8'));
  Object.assign(tokens.color, proposal.color);
  Object.assign(tokens.font, proposal.font);
  Object.assign(tokens.radius, proposal.radius);
  fs.writeFileSync(target, JSON.stringify(tokens, null, 2) + '\n');
  console.log(`Merged into ${path.relative(process.cwd(), target)}. Run npm run tokens next.`);
}
