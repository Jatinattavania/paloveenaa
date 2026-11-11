// Reusable page pieces.
import { esc, money, icon, productImg, IMG, formatDate, anyImg } from './helpers.mjs';

export const productUrl = (p) => `/product/${p.slug}/`;
export const priceOf = (p) => (p.salePrice != null ? p.salePrice : p.regularPrice);

export function price(p, size = 'base') {
  const big = size === 'lg';
  if (p.salePrice != null && p.salePrice < p.regularPrice) {
    return `<p class="flex items-baseline gap-2.5 ${big ? 'text-[30px]' : 'text-[15px]'}">
      <del class="${big ? 'text-base' : 'text-sm'} text-muted"><span class="sr-only">Original price: </span>${money(p.regularPrice)}</del>
      <ins class="font-medium text-ink no-underline"><span class="sr-only">Sale price: </span>${money(p.salePrice)}</ins>
    </p>`;
  }
  return `<p class="${big ? 'text-[30px]' : 'text-[15px]'} font-medium text-ink">${money(p.regularPrice)}</p>`;
}

// Product card used on home, shop, category and related products.
export function productCard(p, { sizes = '(min-width: 1024px) 270px, 50vw', cls = '' } = {}) {
  const hover = p.gallery[0];
  const onSale = p.salePrice != null && p.salePrice < p.regularPrice;
  return `<article class="group relative ${cls}" data-product-id="${p.id}">
  <div class="relative overflow-hidden rounded-lg bg-soft">
    <a href="${productUrl(p)}" class="block" tabindex="-1" aria-hidden="true">
      ${productImg(p.image, { alt: p.name, sizes, cls: 'aspect-[3/4] w-full object-cover transition duration-700 group-hover:scale-[1.03]' })}
      ${hover ? productImg(hover, { alt: '', sizes, cls: 'absolute inset-0 aspect-[3/4] w-full object-cover opacity-0 transition duration-700 group-hover:opacity-100' }) : ''}
    </a>
    ${onSale ? '<span class="absolute left-5 top-5 rounded bg-brand px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-white">Sale</span>' : ''}
    ${!p.inStock ? '<span class="absolute left-5 top-12 rounded bg-ink px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-white">Sold out</span>' : ''}
    <button type="button" class="group/wl absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink shadow transition hover:text-brand aria-pressed:text-brand lg:translate-x-2 lg:opacity-0 lg:group-hover:translate-x-0 lg:group-hover:opacity-100 lg:focus:translate-x-0 lg:focus:opacity-100 aria-pressed:lg:opacity-100 aria-pressed:lg:translate-x-0" data-wishlist="${p.id}" aria-pressed="false" aria-label="Add ${esc(p.name)} to wishlist">${icon('heart', 'h-[18px] w-[18px] group-aria-pressed/wl:fill-current')}</button>
    <div class="absolute inset-x-4 bottom-4 flex gap-2 transition duration-300 lg:translate-y-3 lg:opacity-0 lg:group-hover:translate-y-0 lg:group-hover:opacity-100 lg:focus-within:translate-y-0 lg:focus-within:opacity-100">
      <button type="button" class="flex flex-1 items-center justify-center gap-2 rounded-md bg-white py-2.5 text-xs font-medium uppercase tracking-[0.12em] text-ink shadow transition hover:bg-brand hover:text-white disabled:opacity-60" data-add-to-cart="${p.id}" ${p.inStock ? '' : 'disabled'}>${icon('bag', 'h-4 w-4')}<span>${p.inStock ? 'Add to cart' : 'Sold out'}</span></button>
      <button type="button" class="inline-flex w-10 shrink-0 items-center justify-center rounded-md bg-white text-ink shadow transition hover:bg-brand hover:text-white" data-quick-view="${p.id}" aria-label="Quick view ${esc(p.name)}">${icon('eye', 'h-[18px] w-[18px]')}</button>
    </div>
  </div>
  <h3 class="mt-5 text-xl font-normal"><a href="${productUrl(p)}" class="transition hover:text-brand">${esc(p.name)}</a></h3>
  <div class="mt-1">${price(p)}</div>
</article>`;
}

// Size buttons (radio group). Same markup is built in src/js/ui.js for the quick view – keep them in sync.
export const SIZE_BTN =
  'flex h-11 min-w-[3.25rem] cursor-pointer items-center justify-center rounded-md border border-line bg-white px-3 text-sm font-medium text-ink transition hover:border-brand peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:bg-soft peer-disabled:text-muted/60 peer-disabled:line-through peer-disabled:hover:border-line';

export function sizePicker(p, prefix) {
  if (!p.sizes?.length) return '';
  const soldOut = new Set(p.soldOutSizes || []);
  return `<fieldset data-size-picker>
    <legend class="sr-only">Size</legend>
    <div class="flex items-center justify-between gap-4">
      <p class="text-sm font-medium text-ink">Size: <span class="font-normal text-muted" data-size-label>Select a size</span></p>
      <button type="button" class="inline-flex items-center gap-1.5 text-sm text-brand underline-offset-2 hover:underline" data-open-size-chart>${icon('ruler', 'h-4 w-4')}Size chart</button>
    </div>
    <div class="mt-3 flex flex-wrap gap-2">
      ${p.sizes
        .map((s) => {
          const out = soldOut.has(s);
          return `<label title="${out ? `${esc(s)} – sold out` : esc(s)}"><input type="radio" name="size" value="${esc(s)}" class="peer sr-only" id="${prefix}-size-${esc(s)}"${out ? ' disabled' : ''}><span class="${SIZE_BTN}">${esc(s)}</span></label>`;
        })
        .join('')}
    </div>
    <p class="mt-2 text-sm text-red-700" data-size-error hidden role="alert">Please select a size.</p>
  </fieldset>`;
}

// Amazon-style size chart popup (native <dialog>): "Size chart" + "How to measure" tabs, inches/cm switch.
export function sizeChartDialog(chart) {
  if (!chart) return '';
  const cm = (n) => (Math.round(n * 2.54 * 2) / 2).toString();
  const tab = (id, label, on) =>
    `<button type="button" role="tab" aria-selected="${on}" class="flex-1 border-b-2 py-3 text-sm font-medium transition aria-selected:border-brand aria-selected:text-ink border-transparent text-muted hover:text-ink" data-chart-tab="${id}">${label}</button>`;
  return `<dialog id="size-chart" class="m-auto max-h-[90vh] w-[min(680px,calc(100vw-2rem))] overflow-hidden rounded-lg p-0 text-muted shadow-2xl backdrop:bg-black/50" aria-labelledby="size-chart-title">
  <div class="flex max-h-[90vh] flex-col">
    <div class="flex items-center justify-between border-b border-line px-6 py-4">
      <h2 id="size-chart-title" class="text-xl font-medium">${esc(chart.title)}</h2>
      <button type="button" class="icon-btn -mr-2" data-dialog-close aria-label="Close size chart">${icon('close', 'h-6 w-6')}</button>
    </div>
    <div class="flex border-b border-line px-6" role="tablist">${tab('chart', 'Size chart', true)}${tab('measure', 'How to measure', false)}</div>
    <div class="overflow-y-auto px-6 py-5">
      <div data-chart-panel="chart">
        <div class="mb-4 flex items-center justify-between gap-4">
          <p class="text-sm">Body measurements</p>
          <div class="inline-flex rounded-md border border-line p-0.5 text-sm" role="group" aria-label="Units">
            <button type="button" class="rounded px-3 py-1 aria-pressed:bg-ink aria-pressed:text-white" aria-pressed="true" data-unit="in">Inches</button>
            <button type="button" class="rounded px-3 py-1 aria-pressed:bg-ink aria-pressed:text-white" aria-pressed="false" data-unit="cm">CM</button>
          </div>
        </div>
        <div class="overflow-x-auto rounded-md border border-line">
          <table class="w-full text-center text-sm">
            <thead class="bg-soft text-ink"><tr><th scope="col" class="px-2 py-3 text-left font-medium sm:px-3">Size</th>${chart.columns.map((c) => `<th scope="col" class="px-1.5 py-3 font-medium sm:px-3">${esc(c.label)}</th>`).join('')}</tr></thead>
            <tbody class="divide-y divide-line">
              ${chart.rows
                .map(
                  (r) => `<tr data-chart-row="${esc(r.size)}" class="transition data-[selected]:bg-brand-light data-[selected]:font-medium data-[selected]:text-ink"><th scope="row" class="px-2 py-3 text-left font-medium text-ink sm:px-3">${esc(r.size)}</th>${chart.columns
                    .map((c) => `<td class="px-1.5 py-3 sm:px-3" data-in="${r[c.key]}" data-cm="${cm(r[c.key])}">${r[c.key]}</td>`)
                    .join('')}</tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
        <p class="mt-4 rounded-md bg-soft p-3 text-sm">${icon('check', 'mr-1 inline h-4 w-4 text-brand')}${esc(chart.note)}</p>
      </div>
      <div data-chart-panel="measure" hidden>
        <p class="mb-4 text-sm">Use a soft measuring tape and keep it snug but not tight. Measure over light clothing.</p>
        <ol class="space-y-4">
          ${chart.howToMeasure
            .map(
              (m, i) => `<li class="flex gap-4"><span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-medium text-white">${i + 1}</span><div><p class="font-medium text-ink">${esc(m.label)}</p><p class="text-sm">${esc(m.text)}</p></div></li>`
            )
            .join('')}
        </ol>
      </div>
    </div>
  </div>
</dialog>`;
}

export function breadcrumbs(items, light = false) {
  return `<nav aria-label="Breadcrumb"><ol class="flex flex-wrap items-center justify-center gap-1.5 text-[15px] ${light ? 'text-white' : ''}">
    ${items
      .map((c, i) =>
        i < items.length - 1
          ? `<li class="flex items-center gap-1.5"><a href="${c.href}" class="font-medium ${light ? 'hover:text-white/80' : 'text-ink hover:text-brand'}">${esc(c.label)}</a>${icon('chevronRight', `h-3 w-3 ${light ? 'text-white/70' : 'text-muted'}`)}</li>`
          : `<li aria-current="page" class="${light ? 'font-medium' : 'text-muted'}">${esc(c.label)}</li>`
      )
      .join('')}
  </ol></nav>`;
}

// Title area. banner=true -> dark leaf-pattern banner (About, FAQ, Shop…); false -> plain white (product, cart…).
export function pageTitle(title, crumbs, { banner = true } = {}) {
  if (banner) {
    return `<section class="relative overflow-hidden bg-[#747576]">
  <img src="${IMG}/misc/page-title-bg-1920.webp" alt="" width="1920" height="600" class="absolute inset-0 h-full w-full object-cover opacity-50 mix-blend-multiply" fetchpriority="high">
  <div class="relative container-site py-16 text-center md:py-[88px]">
    <h1 class="mb-3 text-4xl font-medium text-white md:text-[45px]">${esc(title)}</h1>
    ${breadcrumbs(crumbs, true)}
  </div>
</section>`;
  }
  return `<section class="container-site pb-8 pt-14 text-center md:pt-24">
  <h1 class="mb-3 text-4xl font-medium md:text-[45px]">${esc(title)}</h1>
  ${breadcrumbs(crumbs)}
</section>`;
}

export function blogCard(post, { eager = false } = {}) {
  const url = `/blog/${post.slug}/`;
  return `<article class="group flex flex-col overflow-hidden rounded-lg bg-soft text-center">
  <a href="${url}" class="relative block overflow-hidden" tabindex="-1" aria-hidden="true">
    ${anyImg(post.image, { alt: '', sizes: '(min-width: 1024px) 500px, 100vw', eager, cls: 'aspect-[16/9] w-full object-cover transition duration-700 group-hover:scale-105' })}
    <time datetime="${post.date}" class="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-brand px-2.5 py-1 text-[15px] font-medium uppercase tracking-[0.12em] text-white">${formatDate(post.date)}</time>
  </a>
  <div class="flex flex-1 flex-col items-center px-6 pb-8 pt-10 md:px-10">
    <h3 class="text-2xl font-medium leading-snug md:text-[26px]"><a href="${url}" class="hover:text-brand">${esc(post.title)}</a></h3>
    <p class="mt-4 line-clamp-4">${esc(post.excerpt)}</p>
    <a href="${url}" class="mt-auto pt-5 font-medium text-ink underline decoration-1 underline-offset-[6px] hover:text-brand">Read More<span class="sr-only">: ${esc(post.title)}</span></a>
  </div>
</article>`;
}
