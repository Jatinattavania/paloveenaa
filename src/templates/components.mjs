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
