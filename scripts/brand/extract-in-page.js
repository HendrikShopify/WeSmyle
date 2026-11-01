/*
  Runs inside a rendered web page (paste in the browser console, or run through the browser tool) and returns a JSON string
  with the visual brand of that page: colours weighted by visible use, fonts per role, button styling, radii, CSS colour variables.
  Save the result as brand/<site>.json and feed it to `node scripts/brand-tokens.js brand/<site>.json`.
  The last expression is the result, so it also works as a javascript_tool call.
*/
(() => {
  const ctx = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
  const toRgba = (value) => {
    if (!value) return null;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return { r, g, b, a: a / 255 };
  };
  const hex = ({ r, g, b }) => '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');
  const colour = (value) => {
    const c = toRgba(value);
    return c && c.a > 0.05 ? hex(c) : null;
  };
  const add = (map, key, weight) => {
    if (key) map[key] = (map[key] || 0) + weight;
  };
  const sorted = (map, n = 20) =>
    Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([value, weight]) => ({ value, weight: Math.round(weight) }));
  const family = (f) => (f || '').split(',')[0].replace(/["']/g, '').trim();

  const text = {}, bg = {}, border = {}, fontsBody = {}, fontsHeading = {}, sizes = {};
  const radii = { button: {}, input: {}, media: {}, card: {} };
  const buttons = [];
  const vw = innerWidth, vh = Math.max(innerHeight, 900);
  const els = [...document.body.querySelectorAll('*')].slice(0, 6000);

  for (const el of els) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2 || rect.bottom < 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
    const area = Math.min(rect.width, vw) * Math.min(rect.height, vh);
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ');
    const tag = el.tagName.toLowerCase();

    add(bg, colour(cs.backgroundColor), area);
    if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none') add(border, colour(cs.borderTopColor), rect.width + rect.height);
    if (parseFloat(cs.borderBottomWidth) > 0 && cs.borderBottomStyle !== 'none') add(border, colour(cs.borderBottomColor), rect.width);
    if (own.length) {
      const w = own.length * (parseFloat(cs.fontSize) || 16);
      add(text, colour(cs.color), w);
      const f = family(cs.fontFamily);
      const key = `${f}|${cs.fontWeight}`;
      if (parseFloat(cs.fontSize) >= 20 && (/^h[1-3]$/.test(tag) || parseFloat(cs.fontSize) >= 32)) add(fontsHeading, key, w);
      else add(fontsBody, key, w);
      add(sizes, `${tag}|${Math.round(parseFloat(cs.fontSize))}|${cs.fontWeight}|${family(cs.fontFamily)}|${cs.textTransform}|${cs.letterSpacing}`, own.length);
    }
    const r = parseFloat(cs.borderTopLeftRadius);
    if (!isNaN(r) && r > 0 && rect.width > 20) {
      if (tag === 'button' || el.matches('[type=submit],[role=button],a[class*=btn],a[class*=button],a[class*=Button]')) add(radii.button, Math.round(r), 1);
      else if (tag === 'input' || tag === 'select' || tag === 'textarea') add(radii.input, Math.round(r), 1);
      else if (tag === 'img' || tag === 'video' || tag === 'picture') add(radii.media, Math.round(r), 1);
      else if (rect.width > 160 && rect.height > 120 && colour(cs.backgroundColor)) add(radii.card, Math.round(r), 1);
    }
    if (tag === 'img' || tag === 'video') add(radii.media, parseFloat(cs.borderTopLeftRadius) > 0 ? Math.round(parseFloat(cs.borderTopLeftRadius)) : 0, 1);
    if (el.matches('button,[type=submit],[role=button],a[class*=btn],a[class*=button],a[class*=Button]') && own.length && rect.width > 60 && rect.top < 4000) {
      buttons.push({
        label: own.slice(0, 30),
        background: colour(cs.backgroundColor),
        color: colour(cs.color),
        border: parseFloat(cs.borderTopWidth) > 0 ? colour(cs.borderTopColor) : null,
        radius: Math.round(parseFloat(cs.borderTopLeftRadius)) || 0,
        font: family(cs.fontFamily),
        size: Math.round(parseFloat(cs.fontSize)),
        weight: cs.fontWeight,
        transform: cs.textTransform,
        area: Math.round(rect.width * rect.height),
      });
    }
  }

  const bodyBg = colour(getComputedStyle(document.body).backgroundColor) || colour(getComputedStyle(document.documentElement).backgroundColor) || '#ffffff';
  const body = getComputedStyle(document.body);

  // CSS custom properties that hold colours
  const vars = {};
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch (e) { continue; }
    for (const rule of rules || []) {
      if (!rule.style || !/(^|,)\s*(:root|html|body)\s*(,|$)/.test(rule.selectorText || '')) continue;
      for (const name of rule.style) {
        if (!name.startsWith('--')) continue;
        const value = rule.style.getPropertyValue(name).trim();
        if (/^(#|rgb|hsl|oklch|color\()/.test(value)) vars[name] = colour(value) || value;
      }
    }
  }

  // fonts: faces the page actually loaded plus the services it links to
  const faces = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family.replace(/["']/g, '')}|${f.weight}|${f.style}`);
  const sources = new Set();
  for (const l of document.querySelectorAll('link[href]')) if (/fonts\.googleapis|typekit|fonts\.adobe|fonts\.bunny|fontshare|use\.fontawesome/.test(l.href)) sources.add(l.href);
  const files = new Set();
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch (e) { continue; }
    for (const rule of rules || []) {
      if (rule.type === CSSRule.FONT_FACE_RULE) {
        const src = rule.style.getPropertyValue('src').match(/url\(["']?([^"')]+)/);
        files.add(`${rule.style.getPropertyValue('font-family').replace(/["']/g, '')}|${rule.style.getPropertyValue('font-weight')}|${src ? src[1].split('?')[0].split('/').pop() : ''}`);
      }
    }
  }

  const logo = document.querySelector('header img[src*=logo i], header svg, a[href="/"] img, [class*=logo i] img, [class*=logo i] svg');
  const meta = (n) => document.querySelector(`meta[name="${n}"]`)?.content || null;

  return JSON.stringify({
    url: location.href,
    title: document.title,
    themeColor: colour(meta('theme-color')),
    background: bodyBg,
    bodyFont: { family: family(body.fontFamily), size: Math.round(parseFloat(body.fontSize)), weight: body.fontWeight, color: colour(body.color) },
    text: sorted(text),
    backgrounds: sorted(bg),
    borders: sorted(border, 8),
    fontsHeading: sorted(fontsHeading, 6),
    fontsBody: sorted(fontsBody, 6),
    typeScale: sorted(sizes, 24),
    buttons: buttons.sort((a, b) => b.area - a.area).slice(0, 12),
    radii: Object.fromEntries(Object.entries(radii).map(([k, v]) => [k, sorted(v, 4)])),
    cssVariables: vars,
    loadedFaces: [...new Set(faces)],
    fontFaceRules: [...files].slice(0, 40),
    fontSources: [...sources],
    logo: logo ? (logo.tagName === 'IMG' ? logo.currentSrc || logo.src : 'inline svg') : null,
  });
})();
