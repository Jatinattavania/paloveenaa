// Page shell: <head>, announcement bar, header, drawers, footer.
import { esc, icon, IMG, productImg } from './helpers.mjs';

const NAV = [
  { label: 'Home', href: '/' },
  { label: 'Shop', href: '/shop/', mega: true },
  { label: 'About', href: '/about/' },
  { label: 'Faq’s', href: '/faq/' },
  { label: 'Blog', href: '/blog/' },
  { label: 'Contact', href: '/contact/' },
];

const isActive = (href, path) => (href === '/' ? path === '/' : path.startsWith(href) || (href === '/shop/' && /^\/(product|product-category)\//.test(path)));

function head(ctx, { title, description, image, canonical, jsonLd, noindex, scripts = [] }) {
  const { settings, v } = ctx;
  const fullTitle = title ? `${title} – ${settings.siteName}` : `${settings.siteName} – Elegant Ethnic Wear for Women`;
  const desc = description || settings.description;
  const url = settings.siteUrl + canonical;
  const ogImage = settings.siteUrl + (image || `${IMG}/banners/banner-1-1280.webp`);
  return `<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${esc(ctx.csp)}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
<meta name="theme-color" content="#89683A">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(settings.siteName)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${ogImage}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" href="${IMG}/brand/favicon.png">
<link rel="apple-touch-icon" href="${IMG}/brand/favicon.png">
<link rel="preload" href="/assets/fonts/jost.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/css/styles.css?v=${v}">
<script type="module" src="/assets/js/app.js?v=${v}"></script>
${scripts.map((s) => `<script type="module" src="/assets/js/${s}?v=${v}"></script>`).join('\n')}
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
</head>`;
}

function announcementBar(ctx) {
  const items = ctx.settings.announcements;
  // Rendered twice so the CSS marquee can loop seamlessly.
  const row = (hidden) =>
    `<ul class="flex shrink-0 items-center"${hidden ? ' aria-hidden="true"' : ''}>${[...items, ...items]
      .map((t) => `<li class="whitespace-nowrap px-10 md:px-[115px]">${esc(t)}</li>`)
      .join('')}</ul>`;
  return `<div class="overflow-hidden bg-brand text-[15px] text-white md:text-base">
  <div class="flex w-max animate-marquee-slow py-2.5 hover:[animation-play-state:paused]">${row(false)}${row(true)}</div>
</div>`;
}

function megaMenu(ctx) {
  return `<div class="mega invisible absolute left-1/2 top-full z-40 w-screen max-w-[1180px] -translate-x-1/2 translate-y-2 pt-3 opacity-0 transition duration-200">
  <div class="rounded-lg bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.12)]">
    <div class="grid grid-cols-5 gap-5">
      ${ctx.catalog.categories
        .map(
          (c) => `<a href="/product-category/${c.slug}/" class="group/cat relative block overflow-hidden rounded-lg">
        ${productImg(c.image, { alt: c.name, sizes: '220px', cls: 'aspect-[3/4] w-full object-cover transition duration-500 group-hover/cat:scale-105' })}
        <span class="absolute inset-x-3 bottom-3 rounded bg-white/95 py-2 text-center text-xs font-medium uppercase tracking-[0.18em] text-brand">${esc(c.shortName)}</span>
      </a>`
        )
        .join('')}
    </div>
  </div>
</div>`;
}

function header(ctx) {
  const path = ctx.path;
  const link = (n) =>
    `<a href="${n.href}" class="inline-flex items-center gap-1 py-2 text-[17px] transition hover:text-brand ${isActive(n.href, path) ? 'text-muted' : 'text-ink'}"${isActive(n.href, path) ? ' aria-current="page"' : ''}>${esc(n.label)}${n.mega ? icon('chevronDown', 'h-3.5 w-3.5 mt-0.5') : ''}</a>`;
  return `<header class="relative z-30 bg-white">
  <div class="mx-auto flex h-[78px] max-w-[1140px] items-center justify-between gap-4 px-4 sm:px-6 lg:h-[105px] xl:px-0">
    <button type="button" class="icon-btn -ml-2 lg:hidden" data-open="mobile-menu" aria-label="Open menu" aria-controls="mobile-menu">${icon('menu', 'h-6 w-6')}</button>
    <a href="/" class="shrink-0" aria-label="${esc(ctx.settings.siteName)} home">
      <img src="${IMG}/brand/logo-240.webp" srcset="${IMG}/brand/logo-240.webp 1x, ${IMG}/brand/logo-480.webp 2x" width="110" height="61" alt="${esc(ctx.settings.siteName)}" class="h-[50px] w-auto lg:h-[61px]">
    </a>
    <nav class="hidden lg:block" aria-label="Main">
      <ul class="flex items-center gap-8">
        ${NAV.map((n) => (n.mega ? `<li class="has-mega">${link(n)}${megaMenu(ctx)}</li>` : `<li>${link(n)}</li>`)).join('')}
      </ul>
    </nav>
    <div class="-mr-2 flex items-center gap-1">
      <button type="button" class="icon-btn" data-open="mini-cart" aria-label="Open cart" aria-controls="mini-cart">${icon('bag', 'h-[22px] w-[22px]')}<span class="badge-count" data-cart-count hidden>0</span></button>
      <a href="/account/" class="icon-btn" aria-label="My account">${icon('user', 'h-[22px] w-[22px]')}</a>
      <a href="/wishlist/" class="icon-btn" aria-label="Wishlist">${icon('heart', 'h-[22px] w-[22px]')}<span class="badge-count" data-wishlist-count hidden>0</span></a>
    </div>
  </div>
</header>`;
}

function mobileMenu(ctx) {
  return `<div id="mobile-menu" class="invisible pointer-events-none fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-label="Menu" data-drawer>
<div class="drawer pointer-events-auto absolute inset-y-0 left-0 flex w-[86%] max-w-sm -translate-x-full flex-col bg-white shadow-2xl" data-panel>
  <div class="flex items-center justify-between border-b border-line px-5 py-4">
    <img src="${IMG}/brand/logo-240.webp" width="90" height="50" alt="${esc(ctx.settings.siteName)}" class="h-[44px] w-auto">
    <button type="button" class="icon-btn" data-close aria-label="Close menu">${icon('close', 'h-6 w-6')}</button>
  </div>
  <nav class="flex-1 overflow-y-auto px-5 py-4" aria-label="Mobile">
    <ul class="divide-y divide-line">
      ${NAV.map((n) => `<li><a href="${n.href}" class="block py-3.5 text-lg ${isActive(n.href, ctx.path) ? 'text-brand' : 'text-ink'}">${esc(n.label)}</a>${
        n.mega
          ? `<ul class="mb-3 grid grid-cols-2 gap-2">${ctx.catalog.categories.map((c) => `<li><a href="/product-category/${c.slug}/" class="block rounded bg-soft px-3 py-2 text-sm text-ink">${esc(c.name)}</a></li>`).join('')}</ul>`
          : ''
      }</li>`).join('')}
      <li><a href="/account/" class="block py-3.5 text-lg text-ink">My account / Login</a></li>
      <li><a href="/wishlist/" class="block py-3.5 text-lg text-ink">Wishlist</a></li>
      <li><a href="/cart/" class="block py-3.5 text-lg text-ink">Cart</a></li>
    </ul>
  </nav>
</div>
</div>`;
}

function miniCart() {
  return `<div id="mini-cart" class="invisible pointer-events-none fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-label="Shopping cart" data-drawer>
<aside class="drawer pointer-events-auto absolute inset-y-0 right-0 flex w-full max-w-[400px] translate-x-full flex-col bg-white shadow-2xl" data-panel>
  <div class="flex items-center justify-between border-b border-line px-6 py-5">
    <h3 class="text-lg font-medium uppercase tracking-[0.12em]">Shopping Cart</h3>
    <button type="button" class="icon-btn -mr-2" data-close aria-label="Close cart">${icon('close', 'h-6 w-6')}</button>
  </div>
  <div class="flex-1 overflow-y-auto px-6" data-mini-cart-items></div>
  <div class="border-t border-line px-6 py-5" data-mini-cart-footer hidden>
    <div class="mb-4 flex items-center justify-between text-ink"><span class="font-medium">Subtotal</span><span class="text-lg font-semibold" data-mini-cart-subtotal></span></div>
    <div class="grid grid-cols-2 gap-3">
      <a href="/cart/" class="btn-outline px-4">View cart</a>
      <a href="/checkout/" class="btn-brand px-4">Checkout</a>
    </div>
  </div>
</aside>
</div>`;
}

function quickView() {
  return `<div id="quick-view" class="invisible fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Quick view" data-drawer data-modal>
  <div class="drawer relative max-h-[90vh] w-full max-w-4xl scale-95 overflow-y-auto rounded-lg bg-white opacity-0 shadow-2xl" data-panel>
    <button type="button" class="icon-btn absolute right-3 top-3 z-10 bg-white/90" data-close aria-label="Close quick view">${icon('close', 'h-6 w-6')}</button>
    <div data-quick-view-body class="min-h-[300px]"></div>
  </div>
</div>`;
}

function instagram(ctx) {
  const ig = ctx.pages.instagram;
  const href = ctx.settings.social.instagram || null;
  const tile = (img, hidden) =>
    `<li class="w-[42vw] shrink-0 sm:w-[228px]"${hidden ? ' aria-hidden="true"' : ''}>${productImg(img, { alt: hidden ? '' : 'Paloveenaa on Instagram', sizes: '228px', cls: 'aspect-[3/4] w-full rounded-lg object-cover' })}</li>`;
  const list = (hidden) => `<ul class="flex shrink-0 gap-2.5 pr-2.5">${ig.images.map((i) => tile(i, hidden)).join('')}</ul>`;
  return `<section class="pt-16 md:pt-24" aria-label="Instagram">
  <h2 class="mb-10 flex items-center justify-center gap-2 text-3xl font-semibold md:text-[35px]">
    <span class="text-brand">${icon('instagram', 'h-7 w-7')}</span>${href ? `<a href="${esc(href)}" target="_blank" rel="noopener" class="hover:text-brand">${esc(ig.title)}</a>` : esc(ig.title)}<span class="text-brand">${icon('instagram', 'h-7 w-7')}</span>
  </h2>
  <div class="overflow-hidden px-2.5">
    <div class="flex w-max animate-marquee hover:[animation-play-state:paused]">${list(false)}${list(true)}</div>
  </div>
</section>`;
}

function footer(ctx) {
  const s = ctx.settings;
  const socials = [
    ['facebook', s.social.facebook, 'Facebook'],
    ['linkedin', s.social.linkedin, 'LinkedIn'],
    ['x', s.social.x, 'X (Twitter)'],
    ['instagram', s.social.instagram, 'Instagram'],
  ].filter(([k, url]) => url || k !== 'instagram');
  const year = new Date().getFullYear();
  return `${instagram(ctx)}
<section class="mt-2.5 bg-brand text-white" aria-label="Why shop with us">
  <div class="container-site grid gap-8 py-8 sm:grid-cols-3 md:py-9">
    ${ctx.pages.features
      .map(
        (f) => `<div class="flex items-center gap-5 sm:justify-center">
      <span class="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full bg-white"><img src="${IMG}/icons/${f.icon}" alt="" width="34" height="34" loading="lazy" class="h-[30px] w-auto"></span>
      <div><h3 class="text-xl font-medium text-white">${esc(f.title)}</h3><p class="text-white/90">${esc(f.text)}</p></div>
    </div>`
      )
      .join('')}
  </div>
</section>
<footer class="bg-soft">
  <div class="container-site grid gap-10 pb-12 pt-14 sm:grid-cols-2 lg:grid-cols-4">
    <div>
      <a href="/" aria-label="${esc(s.siteName)} home"><img src="${IMG}/brand/logo-240.webp" width="135" height="75" alt="${esc(s.siteName)}" loading="lazy" class="h-[75px] w-auto"></a>
      <ul class="mt-6 flex items-center gap-3 text-brand">
        ${socials.map(([k, url, label]) => `<li><a href="${esc(url || '#')}" ${url ? 'target="_blank" rel="noopener"' : ''} aria-label="${label}" class="inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-brand hover:text-white">${icon(k, 'h-5 w-5')}</a></li>`).join('')}
      </ul>
    </div>
    <div>
      <h2 class="mb-5 text-xl font-medium text-brand">Know Us</h2>
      <ul class="space-y-3">
        <li><a class="hover:text-brand" href="/about/">About Us</a></li>
        <li><a class="hover:text-brand" href="/faq/">FAQ</a></li>
        <li><a class="hover:text-brand" href="/contact/">Contact Us</a></li>
        <li><a class="hover:text-brand" href="/blog/">Blog</a></li>
      </ul>
    </div>
    <div>
      <h2 class="mb-5 text-xl font-medium text-brand">Information</h2>
      <ul class="space-y-3">
        <li><a class="hover:text-brand" href="/privacy-policy/">Privacy Policy</a></li>
        <li><a class="hover:text-brand" href="/refund-returns/">Refund &amp; Returns Policy</a></li>
        <li><a class="hover:text-brand" href="/shop/">Shop</a></li>
        <li><a class="hover:text-brand" href="mailto:${esc(s.email)}">${esc(s.email)}</a></li>
      </ul>
    </div>
    <div>
      <h2 class="mb-5 text-xl font-medium text-brand">Sign up for Newsletter</h2>
      <form class="flex" data-form="newsletter" novalidate>
        <label for="newsletter-email" class="sr-only">Your email address</label>
        <input id="newsletter-email" name="email" type="email" required autocomplete="email" placeholder="Your email address" class="min-w-0 flex-1 bg-white px-6 py-3.5 text-ink placeholder:text-muted/80 focus:outline-none focus:ring-1 focus:ring-brand">
        <button type="submit" class="flex w-20 shrink-0 items-center justify-center bg-ink text-white transition hover:bg-brand" aria-label="Subscribe">${icon('arrowRight', 'h-5 w-5')}</button>
      </form>
      <p class="mt-2 text-sm" data-form-status role="status"></p>
    </div>
  </div>
  <div class="container-site">
    <div class="flex flex-col items-center justify-between gap-4 border-t border-[#c9c9c9] py-6 sm:flex-row">
      <p>© ${year} <a href="/" class="text-ink">${esc(s.siteName)}.</a> All Rights Reserved</p>
      <ul class="flex items-center gap-6" aria-label="Accepted payments">
        ${[5, 4, 3, 2, 1].map((n) => `<li><img src="${IMG}/payments/payment-${n}.png" alt="" width="36" height="12" loading="lazy" class="h-[18px] w-auto"></li>`).join('')}
      </ul>
    </div>
  </div>
</footer>`;
}

/**
 * Wraps page content in the full document.
 * @param ctx  build context ({ settings, catalog, pages, v, path })
 * @param meta { title, description, image, jsonLd, noindex }
 * @param body main content HTML
 */
export function layout(ctx, meta, body) {
  return `<!doctype html>
<html lang="en">
${head(ctx, { ...meta, canonical: ctx.path })}
<body>
<a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded focus:bg-white focus:px-4 focus:py-2">Skip to content</a>
${announcementBar(ctx)}
${header(ctx)}
<main id="main">
${body}
</main>
${footer(ctx)}
<div class="overlay invisible fixed inset-0 z-40 bg-black/50 opacity-0" data-overlay></div>
${mobileMenu(ctx)}
${miniCart()}
${quickView()}
<div class="toast pointer-events-none fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 translate-y-4 rounded-md bg-ink px-5 py-3 text-sm text-white opacity-0 shadow-lg" role="status" aria-live="polite" data-toast></div>
</body>
</html>`;
}
