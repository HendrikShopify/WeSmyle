// Snippet harness: renders a snippet's Figma variant matrix to tests/gallery/<name>.html with LiquidJS.
// Usage: node tests/render.js button [more snippets]   (run `npm run gallery` to also build CSS)
// State variants map to pseudo-classes: hover/focus are forced with a class hook (see gallery CSS), disabled/loading set the params.
const fs = require('fs');
const path = require('path');
const { Liquid } = require('liquidjs');

const root = path.join(__dirname, '..');
const engine = new Liquid({ root: [path.join(root, 'snippets')], extname: '.liquid', partials: path.join(root, 'snippets'), cache: false });

// Shopify filter stubs. Keep these honest: they produce plausible output, not real Shopify behaviour.
engine.registerFilter('money', (v) => '€' + (Number(v) / 100).toFixed(2).replace('.', ','));
engine.registerFilter('money_without_currency', (v) => (Number(v) / 100).toFixed(2).replace('.', ','));
engine.registerFilter('money_with_currency', (v) => '€' + (Number(v) / 100).toFixed(2).replace('.', ',') + ' EUR');
const T = { 'products.product.media.gallery_label': 'Product media', 'products.product.media.show_media': 'Show media {{ index }}', 'products.product.media.zoom': 'Zoom image', 'products.product.media.close': 'Close', 'products.product.media.previous': 'Previous image', 'products.product.media.next': 'Next image', 'general.slider.go_to': 'Go to slide', 'products.product.price.from': 'From', 'products.product.price.save_percent': 'Save {{ percent }}%', 'products.product.on_sale': 'Sale', 'products.product.sold_out': 'Sold out', 'products.product.rating_stars': '{{ value }} out of 5 stars', 'general.forms.optional': '(optional)', 'products.product.variant_sold_out_or_unavailable': 'Sold out', 'products.product.quantity.label': 'Quantity', 'products.product.quantity.decrease': 'Decrease', 'products.product.quantity.increase': 'Increase', 'products.product.size_guide': 'Size guide', 'products.facets.reset': 'Reset', 'products.facets.from': 'From', 'products.facets.to': 'To', 'products.facets.max_price': 'The highest price is {{ price }}', 'products.facets.show_more': 'Show more', 'products.facets.sort_by_label': 'Sort by:', 'products.facets.clear_all': 'Clear all', 'products.facets.clear_filter': 'Remove filter', 'products.facets.filter_button': 'Filter', 'products.facets.filters_selected': '{{ count }} selected', 'products.facets.product_count': 'Showing {{ product_count }} of {{ count }} products', 'products.facets.product_count_simple': '{{ count }} products', 'products.facets.product_count_filtered': '{{ count }} of {{ total }} products', 'products.product.purchase_options.legend': 'Purchase options', 'products.product.purchase_options.one_time': 'One-time purchase', 'products.product.purchase_options.subscribe': 'Subscribe & save', 'products.product.purchase_options.subscribe_save': 'Subscribe & save {{ percent }}%', 'products.product.purchase_options.description': 'Delivered on your schedule. Skip, pause or cancel anytime.', 'products.product.purchase_options.deliver_every': 'Deliver every', 'products.product.purchase_options.free_shipping': 'Free shipping on every delivery', 'products.product.purchase_options.cancel_anytime': 'Cancel anytime', 'products.product.purchase_options.note': 'Skip, pause or cancel anytime.', 'localization.language_label': 'Language', 'localization.country_label': 'Country/region', 'templates.404.subtext': '404', 'templates.404.title': 'Page not found', 'general.continue_shopping': 'Continue shopping', 'general.empty_state.not_found_body': 'The page you are looking for has moved or no longer exists.', 'general.empty_state.empty_collection_title': 'No products here yet', 'general.empty_state.empty_collection_body': 'This collection is empty for now. Have a look at our other products.', 'general.empty_state.shop_all': 'Shop all products', 'general.empty_state.no_results_title': 'No products match your filters', 'general.empty_state.no_results_body': 'Try removing a filter or two, or clear them all to see everything.', 'general.empty_state.clear_filters': 'Clear all filters', 'general.empty_state.generic_title': 'Nothing to show', 'general.empty_state.generic_body': 'There is nothing here at the moment. Check back later.', 'general.empty_state.back_home': 'Back to home', 'general.pagination.range': 'Showing {{ from }}–{{ to }} of {{ total }}', 'mobile_menu.title': 'Menu', 'mobile_menu.close': 'Close menu', 'mobile_menu.back': 'Back', 'mobile_menu.all_of': 'All {{ title }}', 'mobile_menu.account': 'Account', 'products.facets.grid_density_label': 'View by', 'products.facets.grid_density_large': 'Larger products', 'products.facets.grid_density_small': 'Smaller products', 'newsletter.title': 'Join our newsletter', 'newsletter.description': 'Get 10% off your first order and be the first to hear about new products.', 'newsletter.label': 'Email', 'newsletter.placeholder': 'Enter your email', 'newsletter.button_label': 'Subscribe', 'newsletter.success': 'Thanks for subscribing', 'newsletter.fine_print_html': 'By subscribing, you agree to our <a href="#">Privacy Policy</a> and to receive marketing emails.' };
engine.registerFilter('t', (k, ...args) => {
  let s = T[k] || k.split('.').pop().replace(/_/g, ' ');
  for (const a of args) if (Array.isArray(a)) s = s.replace(new RegExp('{{\\s*' + a[0] + '\\s*}}', 'g'), a[1]);
  return s;
});
engine.registerFilter('asset_url', (v) => `../../assets/${v}`);
let lastImage = null;
engine.registerFilter('image_url', (v, ...args) => { lastImage = v; return (v && v.src) || 'https://placehold.co/800x1000/f5f5f5/f5f5f5'; });
engine.registerFilter('image_tag', (url, ...args) => {
  const o = {}; for (const a of args) if (Array.isArray(a)) o[a[0]] = a[1];
  const img = lastImage || {}; const widths = (o.widths || '').split(',').map(s => s.trim()).filter(Boolean);
  const srcset = widths.map(w => `${url}?width=${w} ${w}w`).join(', ');
  return `<img src="${url}" srcset="${srcset}" sizes="${o.sizes || ''}" alt="${o.alt || ''}" width="${img.width || ''}" height="${img.height || ''}" ${o.attributes || ''}>`;
});
engine.registerFilter('video_tag', (v) => '<video></video>');
engine.registerFilter('external_video_url', (v) => 'about:blank');
engine.registerFilter('external_video_tag', (v) => '<iframe></iframe>');
engine.registerFilter('model_viewer_tag', (v) => '<model-viewer></model-viewer>');
engine.registerFilter('inline_asset_content', (v) => {
  const p = path.join(root, 'assets', String(v));
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : `<!-- missing ${v} -->`;
});
engine.registerFilter('escape', (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));
engine.registerFilter('strip_html', (v) => String(v ?? '').replace(/<[^>]*>/g, ''));
engine.registerFilter('truncatewords', (v, n) => String(v ?? '').split(' ').slice(0, n).join(' '));
engine.registerFilter('handleize', (v) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-'));
// Shopify `form` tag stub: renders a plain <form> around its body.
engine.registerTag('form', {
  parse(tagToken, remainTokens) {
    this.templates = [];
    const stream = this.liquid.parser.parseStream(remainTokens);
    stream.on('tag:endform', () => stream.stop()).on('template', (tpl) => this.templates.push(tpl)).on('end', () => { throw new Error('tag endform not closed'); });
    stream.start();
  },
  * render(ctx, emitter) {
    emitter.write('<form method="post" action="#">');
    yield this.liquid.renderer.renderTemplates(this.templates, ctx, emitter);
    emitter.write('</form>');
  },
});
// `render` in Shopify is isolated; LiquidJS `render` is too. Good.

const state = (s) => ({ default: {}, hover: { _hook: 'hover' }, focus: { _hook: 'focus' }, disabled: { disabled: true }, loading: { loading: true } }[s] || {});

async function renderSnippet(name) {
  const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', `${name}.json`), 'utf8'));
  const data = fs.existsSync(path.join(__dirname, 'fixtures', 'data.json')) ? JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'data.json'), 'utf8')) : {};
  const dims = Object.keys(fx.matrix);
  const combos = dims.reduce((acc, d) => acc.flatMap((c) => fx.matrix[d].map((v) => ({ ...c, [d]: v }))), [{}]);
  const cells = [];
  for (const combo of combos) {
    const { state: st, ...params } = combo;
    const extra = state(st);
    const hook = extra._hook; delete extra._hook;
    const html = await engine.renderFile(fx.snippet, { ...data, ...fx.params, ...params, ...extra });
    cells.push({ title: Object.entries(combo).map(([k, v]) => `${k}=${v}`).join(' · '), html, hook, height: fx.height });
  }
  for (const e of fx.extras || []) cells.push({ title: 'extra: ' + JSON.stringify(e), html: await engine.renderFile(fx.snippet, { ...data, ...fx.params, ...e }), height: e.height || fx.height });
  // group rows by every dim except the last (state), so rows read like the Figma set
  const page = `<!doctype html><html><head><meta charset="utf-8"><title>${name}</title>
<link rel="stylesheet" href="gallery.css">
<style>
  body{margin:0;padding:40px;background:#fff;font-family:Inter,sans-serif}
  .row{display:flex;gap:24px;align-items:flex-start;margin-bottom:24px;flex-wrap:wrap}
  .cell{display:flex;flex-direction:column;gap:8px;min-width:120px}
  .cell small{font:11px/1 Inter,sans-serif;color:#737373}
  h1{font:600 20px Inter,sans-serif;margin:0 0 4px} p.meta{font:12px Inter,sans-serif;color:#737373;margin:0 0 32px}
</style></head><body>
<h1>${fx.snippet}</h1><p class="meta">${fx.figma}</p>
${chunk(cells, fx.matrix.state ? fx.matrix.state.length : cells.length).map((row) => `<div class="row">${row.map((c) => `<div class="cell"><small>${c.title}</small><div class="${c.hook ? 'force-' + c.hook : ''}"style="${fx.width ? `width:${fx.width}px;` : ''}${c.height ? `min-height:${c.height}px;position:relative;transform:translateZ(0)` : ''}">${c.html}</div></div>`).join('')}</div>`).join('\n')}
</body></html>`;
  fs.mkdirSync(path.join(__dirname, 'gallery'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'gallery', `${name}.html`), page);
  console.log(`gallery/${name}.html: ${cells.length} cells`);
}
function chunk(a, n) { const r = []; for (let i = 0; i < a.length; i += n) r.push(a.slice(i, i + n)); return r; }

(async () => { for (const n of process.argv.slice(2)) await renderSnippet(n); })();
