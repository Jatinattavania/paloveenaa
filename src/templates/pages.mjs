// One function per page type. Each returns { meta, body } which build.mjs wraps in the layout.
import { esc, icon, money, productImg, bannerImg, IMG, formatDate, anyImg, strip, imgUrl, honeypot } from './helpers.mjs';
import { productCard, pageTitle, breadcrumbs, price, productUrl, blogCard, priceOf, sizePicker } from './components.mjs';

const HOME = { label: 'Home', href: '/' };

/* ------------------------------------------------------------------ HOME */
export function home(ctx) {
  const { pages, catalog, blog } = ctx;
  const h = pages.home;
  const latest = catalog.products.slice(0, 8);

  const hero = `<section class="px-3 sm:px-[25px]" aria-label="Featured collections" data-carousel data-autoplay="5000">
  <div class="snap-row rounded-lg" data-track>
    ${h.slides
      .map(
        (s, i) => `<a href="${s.link}" class="block w-full shrink-0 snap-start" data-slide aria-label="Slide ${i + 1} of ${h.slides.length}: ${esc(s.alt)}">
      ${bannerImg(s.image, { alt: s.alt, eager: i === 0, cls: 'aspect-[16/9] w-full rounded-lg object-cover' })}
    </a>`
      )
      .join('')}
  </div>
  <div class="mt-3 flex justify-center gap-2.5" data-dots>
    ${h.slides.map((_, i) => `<button type="button" class="h-2.5 w-2.5 rounded-full bg-line transition aria-[current=true]:bg-brand" data-dot="${i}" aria-label="Go to slide ${i + 1}"${i === 0 ? ' aria-current="true"' : ''}></button>`).join('')}
  </div>
</section>`;

  const latestProducts = `<section class="container-site pt-16 md:pt-24" data-carousel>
  <div class="mb-10 flex items-center justify-between gap-4">
    <h2 class="section-title">${esc(h.latestProducts.title)}</h2>
    <div class="flex gap-2"><button type="button" class="arrow-btn" data-prev aria-label="Previous products">${icon('arrowLeft', 'h-4 w-4')}</button><button type="button" class="arrow-btn !bg-brand !text-white hover:!bg-ink" data-next aria-label="Next products">${icon('arrowRight', 'h-4 w-4')}</button></div>
  </div>
  <div class="snap-row -mx-4 gap-[30px] px-4 sm:mx-0 sm:px-0" data-track>
    ${latest.map((p) => productCard(p, { cls: 'w-[70%] shrink-0 snap-start sm:w-[calc(50%-15px)] lg:w-[calc(25%-22.5px)]' })).join('')}
  </div>
</section>`;

  const bs = h.brandStory;
  const brandStory = `<section class="mt-16 bg-soft md:mt-24">
  <div class="grid lg:grid-cols-2">
    <div class="relative min-h-[360px] lg:min-h-[500px]">${productImg(bs.image, { alt: 'Paloveenaa outfit', sizes: '(min-width: 1024px) 50vw, 100vw', cls: 'absolute inset-0 h-full w-full object-cover object-[50%_25%]' })}</div>
    <div class="relative px-6 py-14 sm:px-12 md:py-20 lg:max-w-[600px] lg:pl-14 lg:pr-20">
      <h2 class="section-title mb-6">${esc(bs.title)}</h2>
      <p class="text-[17px] leading-[1.75]">${esc(bs.text)}</p>
      <a href="${bs.button.link}" class="btn-brand mt-12">${esc(bs.button.text)}</a>
    </div>
  </div>
</section>`;

  const cats = `<section class="container-site pt-16 md:pt-28">
  <div class="grid items-end gap-8 lg:grid-cols-[260px_1fr] lg:gap-10">
    <div class="lg:pb-24">
      <h2 class="section-title mb-8 max-w-[200px]">${esc(h.categories.title)}</h2>
      <a href="${h.categories.button.link}" class="btn-brand">${esc(h.categories.button.text)}</a>
    </div>
    <div class="relative" data-carousel>
      <div class="snap-row gap-[30px]" data-track>
        ${catalog.categories
          .map(
            (c) => `<a href="/product-category/${c.slug}/" class="group relative block w-[70%] shrink-0 snap-start overflow-hidden rounded-lg sm:w-[calc(50%-15px)] lg:w-[calc(33.333%-20px)]">
          ${productImg(c.image, { alt: c.name, sizes: '(min-width: 1024px) 262px, 70vw', cls: 'aspect-[3/4] w-full object-cover transition duration-700 group-hover:scale-105' })}
          <span class="absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-t-md bg-white px-4 py-2.5 text-[15px] font-medium uppercase tracking-[0.18em] text-brand">${esc(c.shortName)}</span>
        </a>`
          )
          .join('')}
      </div>
      <button type="button" class="arrow-btn absolute -left-4 top-1/2 -translate-y-1/2" data-prev aria-label="Previous categories">${icon('arrowLeft', 'h-4 w-4')}</button>
      <button type="button" class="arrow-btn absolute -right-4 top-1/2 -translate-y-1/2" data-next aria-label="Next categories">${icon('arrowRight', 'h-4 w-4')}</button>
    </div>
  </div>
</section>`;

  const lb = h.lookbook;
  const lookbook = `<section class="mt-16 bg-soft md:mt-24" data-lookbook aria-roledescription="carousel" aria-label="Lookbook">
  <div class="mx-auto grid max-w-[1290px] lg:grid-cols-[1fr_555px]">
    <div class="flex flex-col justify-between gap-12 px-4 py-14 sm:px-6 md:py-24 xl:pl-[150px] xl:pr-16">
      <div class="relative min-h-[260px]">
        ${lb
          .map(
            (s, i) => `<div class="transition-opacity duration-500 ${i ? 'pointer-events-none absolute inset-0 opacity-0' : ''}" data-lb-slide="${i}" ${i ? 'aria-hidden="true"' : ''}>
          <h2 class="section-title mb-3">${esc(s.title)}</h2>
          <p class="max-w-[520px]">${esc(s.text)}</p>
          <a href="${s.link}" class="btn-brand mt-14" ${i ? 'tabindex="-1"' : ''}>${esc(s.button)}</a>
        </div>`
          )
          .join('')}
      </div>
      <div>
        <div class="flex gap-5">
          ${lb.map((s, i) => `<button type="button" class="w-[22%] max-w-[113px] overflow-hidden rounded-md ring-brand ring-offset-2 ring-offset-soft transition aria-[current=true]:ring-2" data-lb-thumb="${i}" aria-label="Show ${esc(s.title)}"${i ? '' : ' aria-current="true"'}>${productImg(s.image, { alt: '', sizes: '113px', cls: 'aspect-[3/4] w-full object-cover' })}</button>`).join('')}
        </div>
        <div class="mt-9 flex justify-center gap-6 lg:max-w-[512px]"><button type="button" class="arrow-btn" data-lb-prev aria-label="Previous look">${icon('arrowLeft', 'h-4 w-4')}</button><button type="button" class="arrow-btn" data-lb-next aria-label="Next look">${icon('arrowRight', 'h-4 w-4')}</button></div>
      </div>
    </div>
    <div class="relative aspect-[3/4] lg:aspect-auto">
      ${lb.map((s, i) => `<div class="absolute inset-0 transition-opacity duration-500 ${i ? 'opacity-0' : ''}" data-lb-image="${i}">${productImg(s.image, { alt: s.title, sizes: '(min-width: 1024px) 555px, 100vw', cls: 'h-full w-full object-cover' })}</div>`).join('')}
    </div>
  </div>
</section>`;

  const blogs = `<section class="container-site pt-16 md:pt-24">
  <h2 class="section-title mb-12 text-center">${esc(h.blogTitle)}</h2>
  <div class="grid gap-[30px] md:grid-cols-3">${blog.posts.slice(0, 3).map((p) => blogCard(p)).join('')}</div>
</section>`;

  return {
    meta: { jsonLd: { '@context': 'https://schema.org', '@type': 'Organization', name: ctx.settings.siteName, url: ctx.settings.siteUrl, logo: ctx.settings.siteUrl + `${IMG}/brand/logo-480.webp`, email: ctx.settings.email } },
    body: hero + latestProducts + brandStory + cats + lookbook + blogs,
  };
}

/* ------------------------------------------------------------- SHOP / CATEGORY */
export function shop(ctx, category = null) {
  const { catalog } = ctx;
  const items = category ? catalog.products.filter((p) => p.categories.includes(category.slug)) : catalog.products;
  const title = category ? category.name : 'Shop';
  const crumbs = category ? [HOME, { label: 'Shop', href: '/shop/' }, { label: category.name }] : [HOME, { label: 'Shop' }];
  const chip = (href, label, active) =>
    `<li><a href="${href}" class="inline-block whitespace-nowrap rounded-full border px-4 py-1.5 text-sm transition ${active ? 'border-brand bg-brand text-white' : 'border-line text-ink hover:border-brand hover:text-brand'}"${active ? ' aria-current="page"' : ''}>${esc(label)}</a></li>`;
  const body = `${pageTitle(title, crumbs)}
<section class="container-site py-14 md:py-20">
  <div class="mb-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
    <ul class="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0" aria-label="Categories">
      ${chip('/shop/', 'All', !category)}
      ${catalog.categories.map((c) => chip(`/product-category/${c.slug}/`, c.name, category && c.slug === category.slug)).join('')}
    </ul>
    <div class="flex items-center justify-between gap-4 md:justify-end">
      <p class="text-sm">${items.length} product${items.length === 1 ? '' : 's'}</p>
      <label class="flex items-center gap-2 text-sm"><span class="sr-only">Sort by</span>
        <select class="rounded-md border border-line bg-white px-3 py-2 text-ink focus:border-brand focus:outline-none" data-sort>
          <option value="latest">Sort by latest</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          <option value="name">Name</option>
        </select>
      </label>
    </div>
  </div>
  <div class="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-[30px] lg:grid-cols-3" data-grid>
    ${items
      .map((p, i) => `<div data-sort-price="${priceOf(p)}" data-sort-name="${esc(p.name)}" data-sort-index="${i}">${productCard(p, { sizes: '(min-width: 1024px) 354px, 50vw' })}</div>`)
      .join('')}
  </div>
  ${items.length ? '' : '<p class="py-10 text-center">No products found in this category yet.</p>'}
</section>`;
  return {
    meta: { title, description: category ? `Shop ${category.name} at Paloveenaa – ${ctx.settings.description}` : undefined },
    body,
  };
}

/* ------------------------------------------------------------------ PRODUCT */
export function product(ctx, p) {
  const { catalog, settings } = ctx;
  const cat = catalog.categories.find((c) => c.slug === p.categories[0]);
  const images = [p.image, ...p.gallery];
  const related = catalog.products.filter((x) => x.id !== p.id && x.categories.some((c) => p.categories.includes(c)));
  const more = [...related, ...catalog.products.filter((x) => x.id !== p.id && !related.includes(x))].slice(0, 4);
  const cats = p.categories.map((s) => catalog.categories.find((c) => c.slug === s)).filter(Boolean);

  // Thumbnails: a row under the photo on mobile; a column beside it (same height as the photo) from md up.
  const gallery = `<div class="relative flex min-w-0 flex-col-reverse gap-4 ${images.length > 1 ? 'md:block md:pl-[106px]' : ''}" data-gallery>
    ${images.length > 1 ? `<div class="no-scrollbar flex gap-3 overflow-x-auto md:absolute md:inset-y-0 md:left-0 md:w-[90px] md:flex-col md:overflow-y-auto">
      ${images.map((img, i) => `<button type="button" class="w-[72px] shrink-0 overflow-hidden rounded-md ring-brand transition aria-[current=true]:ring-2 md:w-full" data-thumb="${i}" aria-label="Show image ${i + 1}"${i ? '' : ' aria-current="true"'}>${productImg(img, { alt: '', sizes: '90px', cls: 'aspect-[3/4] w-full object-cover' })}</button>`).join('')}
    </div>` : ''}
    <div class="relative flex-1 overflow-hidden rounded-lg bg-soft">
      ${images.map((img, i) => `<div class="${i ? 'absolute inset-0 opacity-0' : ''} transition-opacity duration-300" data-main="${i}">${productImg(img, { alt: i ? `${p.name} – image ${i + 1}` : p.name, eager: i === 0, sizes: '(min-width: 1024px) 520px, 100vw', cls: 'aspect-[3/4] w-full object-cover' })}</div>`).join('')}
      ${p.salePrice != null && p.salePrice < p.regularPrice ? '<span class="absolute left-5 top-5 rounded bg-brand px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-white">Sale</span>' : ''}
    </div>
  </div>`;

  const info = `<div class="lg:pt-4">
    <h1 class="text-4xl font-medium md:text-[40px]">${esc(p.name)}</h1>
    <div class="mt-5">${price(p, 'lg')}</div>
    ${p.shortDescription ? `<div class="prose-content mt-6">${p.shortDescription}</div>` : ''}
    <p class="mt-4 flex items-center gap-2 text-sm ${p.inStock ? 'text-green-700' : 'text-red-700'}">${icon(p.inStock ? 'check' : 'close', 'h-4 w-4')}${p.inStock ? 'In stock' : 'Out of stock'}</p>
    <form class="mt-8 space-y-4" data-product-form="${p.id}" novalidate>
      ${sizePicker(p, `p${p.id}`)}
      <p class="pt-2 text-sm font-medium text-ink">Quantity</p>
      <div class="inline-flex items-center rounded-md border-2 border-brand" data-qty>
        <button type="button" class="flex h-11 w-11 items-center justify-center text-muted hover:text-brand" data-qty-dec aria-label="Decrease quantity">${icon('minus', 'h-4 w-4')}</button>
        <label class="sr-only" for="qty-${p.id}">Quantity</label>
        <input id="qty-${p.id}" name="qty" type="number" min="1" max="99" value="1" inputmode="numeric" class="h-11 w-12 bg-transparent text-center text-ink [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none">
        <button type="button" class="flex h-11 w-11 items-center justify-center text-muted hover:text-brand" data-qty-inc aria-label="Increase quantity">${icon('plus', 'h-4 w-4')}</button>
      </div>
      <div class="flex gap-3">
        <button type="submit" class="btn-outline flex-1 py-4" ${p.inStock ? '' : 'disabled'}>${p.inStock ? 'Add to cart' : 'Sold out'}</button>
        <button type="button" class="group/wl inline-flex w-14 shrink-0 items-center justify-center rounded-md border-2 border-line text-ink transition hover:border-brand hover:text-brand aria-pressed:border-brand aria-pressed:text-brand" data-wishlist="${p.id}" aria-pressed="false" aria-label="Add to wishlist">${icon('heart', 'h-5 w-5 group-aria-pressed/wl:fill-current')}</button>
      </div>
      <button type="button" class="btn-brand w-full py-4" data-buy-now="${p.id}" ${p.inStock ? '' : 'disabled'}>Buy now</button>
    </form>
    <dl class="mt-10 space-y-2 border-t border-line pt-6 text-[15px]">
      ${p.sku ? `<div class="flex gap-2"><dt class="font-semibold text-ink">SKU:</dt><dd>${esc(p.sku)}</dd></div>` : ''}
      <div class="flex gap-2"><dt class="font-semibold text-ink">Categor${cats.length > 1 ? 'ies' : 'y'}:</dt><dd>${cats.map((c) => `<a href="/product-category/${c.slug}/" class="text-ink hover:text-brand">${esc(c.name)}</a>`).join(', ')}</dd></div>
    </dl>
    <ul class="mt-6 grid gap-3 rounded-lg bg-soft p-5 text-sm sm:grid-cols-2">
      <li class="flex items-center gap-2">${icon('check', 'h-4 w-4 text-brand')}Free shipping in India</li>
      <li class="flex items-center gap-2">${icon('check', 'h-4 w-4 text-brand')}One day delivery available</li>
    </ul>
  </div>`;

  const desc = p.description ? `<section class="container-site pt-16"><h2 class="mb-6 text-2xl font-medium">Description</h2><div class="prose-content">${p.description}</div></section>` : '';

  const body = `<div class="container-site pb-2 pt-14 text-center md:pt-24">
  <p class="mb-3 text-4xl font-medium text-ink md:text-[45px]" aria-hidden="true">Shop</p>
  ${breadcrumbs([HOME, cat ? { label: cat.name, href: `/product-category/${cat.slug}/` } : { label: 'Shop', href: '/shop/' }, { label: p.name }])}
</div>
<section class="container-site grid grid-cols-1 gap-10 pt-8 lg:grid-cols-[minmax(0,620px)_minmax(0,1fr)] lg:gap-12 lg:px-[50px]">
  ${gallery}
  ${info}
</section>
${desc}
<section class="container-site pt-16 md:pt-24">
  <h2 class="section-title mb-10">You may also like</h2>
  <div class="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-[30px] lg:grid-cols-4">${more.map((x) => productCard(x)).join('')}</div>
</section>`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    image: images.map((i) => settings.siteUrl + imgUrl(i, 1200)),
    description: strip(p.shortDescription || p.description) || `${p.name} – ${cat ? cat.name : 'ethnic wear'} by ${settings.siteName}`,
    sku: p.sku || String(p.id),
    brand: { '@type': 'Brand', name: settings.siteName },
    offers: {
      '@type': 'Offer',
      url: settings.siteUrl + productUrl(p),
      priceCurrency: 'INR',
      price: priceOf(p).toFixed(2),
      availability: p.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  };
  return { meta: { title: p.name, description: `${p.name} – ${cat ? cat.name : ''} at ${settings.siteName}. Now ${money(priceOf(p))}. Free shipping in India.`, image: imgUrl(p.image, 1200), jsonLd }, body };
}

/* ------------------------------------------------------------------ ABOUT */
export function about(ctx) {
  const a = ctx.pages.about;
  const row = (r, i) => {
    const imageLeft = i % 2 === 0;
    const img = `<div class="${imageLeft ? 'lg:pr-0' : 'lg:order-2'}">${productImg(r.image, { alt: '', sizes: '(min-width: 1024px) 50vw, 100vw', cls: `aspect-[3/4] w-full object-cover lg:aspect-[662/882] ${imageLeft ? 'lg:rounded-r-lg' : 'lg:rounded-l-lg'}` })}</div>`;
    const text = `<div class="flex items-center px-4 sm:px-6 ${imageLeft ? 'lg:pl-0 lg:pr-20' : 'lg:order-1 lg:justify-end lg:pl-[70px]'}">
      <div class="${imageLeft ? 'flex w-full items-start' : 'flex w-full flex-row-reverse items-start'}">
        <span class="mt-4 hidden h-px flex-1 bg-line lg:block lg:max-w-[200px]" aria-hidden="true"></span>
        <div class="max-w-[500px]">
          <h2 class="mb-6 text-2xl font-medium leading-snug text-brand md:text-[26px]">${esc(r.title)}</h2>
          <p>${esc(r.text)}</p>
          <img src="${IMG}/misc/${r.signature}" alt="Signature of ${esc(r.name)}" width="194" height="70" loading="lazy" class="mt-10 h-[70px] w-auto">
        </div>
      </div>
    </div>`;
    return `<div class="grid items-center gap-10 lg:grid-cols-2 lg:gap-0 ${i ? 'mt-16 lg:-mt-[170px]' : ''}">${img}${text}</div>`;
  };
  const body = `${pageTitle('About', [HOME, { label: 'About' }])}
<section class="mx-auto max-w-[1300px] px-4 py-14 text-center sm:px-6 md:py-20">
  <h2 class="section-title mb-4">${esc(a.intro.title)}</h2>
  <p class="text-base leading-[1.7]">${esc(a.intro.text)}</p>
  <p class="mt-8 text-sm uppercase tracking-[0.3em]">${esc(a.intro.author)}</p>
</section>
<section class="pb-16 md:pb-20">${a.rows.map(row).join('')}</section>
<section class="bg-[#F8F8F8]">
  <div class="container-site grid items-center gap-10 py-16 md:py-24 lg:grid-cols-[400px_1fr] lg:gap-[90px]">
    <div><h2 class="section-title mb-5">${esc(a.affiliates.title)}</h2><p>${esc(a.affiliates.text)}</p></div>
    <ul class="grid grid-cols-3 items-center gap-x-6 gap-y-8 sm:grid-cols-4">${a.affiliates.logos.map((l) => `<li><img src="${IMG}/affiliates/${l}" alt="" width="150" height="50" loading="lazy" class="h-[50px] w-auto opacity-60 grayscale transition hover:opacity-100"></li>`).join('')}</ul>
  </div>
</section>`;
  return { meta: { title: 'About', description: a.intro.title + ' – ' + ctx.settings.siteName }, body };
}

/* ------------------------------------------------------------------ FAQ */
export function faq(ctx) {
  const body = `${pageTitle('Faq', [HOME, { label: 'Faq' }])}
<section class="mx-auto max-w-[700px] px-4 py-14 sm:px-6 md:py-20">
  ${ctx.pages.faq
    .map(
      (f, i) => `<details class="group border-b border-[#cfcfcf]" name="faq"${i === 0 ? ' open' : ''}>
    <summary class="flex cursor-pointer items-center justify-between gap-4 px-6 py-7 text-xl font-medium text-ink transition hover:text-brand md:text-2xl"><span>${esc(f.q)}</span><span class="faq-arrow shrink-0 text-brand transition-transform">${icon('arrowDown', 'h-5 w-5')}</span></summary>
    <p class="px-6 pb-8">${esc(f.a)}</p>
  </details>`
    )
    .join('')}
</section>`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: ctx.pages.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
  return { meta: { title: 'FAQ', jsonLd }, body };
}

/* ------------------------------------------------------------------ CONTACT */
export function contact(ctx) {
  const c = ctx.pages.contact;
  const s = ctx.settings;
  const body = `${pageTitle('Contact', [HOME, { label: 'Contact' }])}
<section class="container-site grid gap-12 py-14 md:py-20 lg:grid-cols-[504px_1fr] lg:gap-[50px]">
  <div>${productImg(c.image, { alt: 'Paloveenaa outfit', sizes: '(min-width: 1024px) 504px, 100vw', eager: true, cls: 'aspect-[3/4] w-full rounded-lg object-cover' })}</div>
  <div class="lg:pt-10">
    <h2 class="section-title mb-4">${esc(c.title)}</h2>
    <p>${esc(c.text)}</p>
    <ul class="mt-6 space-y-2 text-ink">
      <li><a href="mailto:${esc(s.email)}" class="inline-flex items-center gap-2 hover:text-brand">${icon('mail', 'h-5 w-5 text-brand')}${esc(s.email)}</a></li>
      ${s.phone ? `<li><a href="tel:${esc(s.phone.replace(/\s/g, ''))}" class="inline-flex items-center gap-2 hover:text-brand">${icon('phone', 'h-5 w-5 text-brand')}${esc(s.phone)}</a></li>` : ''}
      ${s.address ? `<li class="inline-flex items-center gap-2">${icon('pin', 'h-5 w-5 text-brand')}${esc(s.address)}</li>` : ''}
    </ul>
    <form class="mt-8 space-y-5" data-form="contact" novalidate>
      ${honeypot}
      <div><label for="c-name" class="sr-only">Name</label><input id="c-name" name="name" required autocomplete="name" placeholder="Name*" class="field"></div>
      <div><label for="c-email" class="sr-only">Email</label><input id="c-email" name="email" type="email" required autocomplete="email" placeholder="Email*" class="field"></div>
      <div><label for="c-msg" class="sr-only">Your message</label><textarea id="c-msg" name="message" rows="6" required placeholder="Your Message" class="field resize-y"></textarea></div>
      <label class="flex items-center gap-3 text-[15px]"><input type="checkbox" name="remember" class="h-4 w-4 accent-brand" data-remember> Save my name and email in this browser.</label>
      <button type="submit" class="btn-brand px-[88px] py-[18px]">Submit Now</button>
      <p class="text-sm" data-form-status role="status"></p>
    </form>
  </div>
</section>`;
  return { meta: { title: 'Contact', description: `Contact ${s.siteName} – ${s.email}` }, body };
}

/* ------------------------------------------------------------------ BLOG */
export function blogIndex(ctx) {
  const body = `${pageTitle('Blog', [HOME, { label: 'Blog' }])}
<section class="mx-auto max-w-[1060px] px-4 py-14 sm:px-6 md:py-20">
  <div class="grid gap-[30px] md:grid-cols-2">${ctx.blog.posts.map((p, i) => blogCard(p, { eager: i < 2 })).join('')}</div>
</section>`;
  return { meta: { title: 'Blog' }, body };
}

export function blogPost(ctx, post) {
  const others = ctx.blog.posts.filter((p) => p.id !== post.id).slice(0, 2);
  const body = `${pageTitle(post.title, [HOME, { label: 'Blog', href: '/blog/' }, { label: post.title }], { banner: false })}
<article class="mx-auto max-w-[1120px] px-4 sm:px-6">
  <div class="relative overflow-hidden rounded-lg">
    ${anyImg(post.image, { alt: post.title, eager: true, sizes: '(min-width: 1120px) 1080px, 100vw', cls: 'aspect-[16/9] w-full object-cover' })}
    <time datetime="${post.date}" class="absolute left-7 top-7 rounded bg-brand px-2.5 py-1 text-lg text-white">${formatDate(post.date)}</time>
  </div>
  <div class="prose-content mx-auto max-w-[1000px] pt-10">${post.content}</div>
</article>
${others.length ? `<section class="mx-auto max-w-[1060px] px-4 pt-16 sm:px-6 md:pt-24"><h2 class="section-title mb-10 text-center">More from the blog</h2><div class="grid gap-[30px] md:grid-cols-2">${others.map((p) => blogCard(p)).join('')}</div></section>` : ''}`;
  const jsonLd = { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.title, datePublished: post.date, image: ctx.settings.siteUrl + imgUrl(post.image, 1280), author: { '@type': 'Organization', name: ctx.settings.siteName } };
  return { meta: { title: post.title, description: post.excerpt.slice(0, 160), image: imgUrl(post.image, 1280), jsonLd }, body };
}

/* ------------------------------------------------------------------ CART / CHECKOUT / WISHLIST */
export function cart() {
  const body = `${pageTitle('Cart', [HOME, { label: 'Cart' }], { banner: false })}
<section class="container-site pb-8 lg:px-10" data-cart-page>
  <p class="py-10 text-center">Loading your cart…</p>
  <noscript><p class="text-center">Please enable JavaScript to use the cart.</p></noscript>
</section>`;
  return { meta: { title: 'Cart', noindex: true }, body };
}

export function checkout(ctx) {
  const f = (id, label, attrs = '', full = false) =>
    `<div class="${full ? 'sm:col-span-2' : ''}"><label for="co-${id}" class="field-label">${label}</label><input id="co-${id}" name="${id}" class="field !py-3" ${attrs}></div>`;
  const body = `${pageTitle('Checkout', [HOME, { label: 'Cart', href: '/cart/' }, { label: 'Checkout' }], { banner: false })}
<section class="container-site pb-8 lg:px-10" data-checkout-page data-needs-signin="1">
  <div data-checkout-empty hidden class="rounded-md bg-[#F8F8F8] px-8 py-6">Your cart is currently empty. <a href="/shop/" class="font-medium text-brand underline">Return to shop</a></div>
  <div data-checkout-signin hidden class="mx-auto max-w-md rounded-lg bg-soft p-6 text-center sm:p-10">
    <h2 class="text-2xl font-medium">Sign in to place your order</h2>
    <p class="mt-2 text-sm">Your cart is saved. Sign in or create an account so you can track your order and see its status any time.</p>
    <div class="mt-6 grid gap-3"><a href="/login/?next=/checkout/" class="btn-brand">Sign in</a><a href="/register/?next=/checkout/" class="btn-outline">Create an account</a></div>
  </div>
  <form class="grid gap-10 lg:grid-cols-[1fr_420px]" data-checkout-form novalidate hidden>
    ${honeypot}
    <div>
      <h2 class="mb-6 text-2xl font-medium">Billing &amp; shipping details</h2>
      <div class="grid gap-5 sm:grid-cols-2">
        ${f('firstName', 'First name *', 'required autocomplete="given-name"')}
        ${f('lastName', 'Last name *', 'required autocomplete="family-name"')}
        ${f('phone', 'Phone *', 'type="tel" required autocomplete="tel" inputmode="tel" pattern="[\\d\\s\\+\\(\\)\\-]{10,}" title="Please enter a valid phone number (at least 10 digits)"')}
        ${f('email', 'Email *', 'type="email" required autocomplete="email"')}
        ${f('address', 'Street address *', 'required autocomplete="street-address" placeholder="House number and street name"', true)}
        ${f('city', 'Town / City *', 'required autocomplete="address-level2"')}
        ${f('state', 'State *', 'required autocomplete="address-level1"')}
        ${f('pincode', 'PIN code *', 'required autocomplete="postal-code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6"')}
        <div><label class="field-label" for="co-country">Country</label><input id="co-country" name="country" value="India" readonly class="field !py-3 text-muted"></div>
        <div class="sm:col-span-2"><label for="co-notes" class="field-label">Order notes (optional)</label><textarea id="co-notes" name="notes" rows="4" class="field !py-3" placeholder="Notes about your order, e.g. size or delivery instructions"></textarea></div>
      </div>
    </div>
    <aside class="h-max rounded-lg bg-soft p-6 md:p-8 lg:sticky lg:top-6">
      <h2 class="mb-6 text-2xl font-medium">Your order</h2>
      <div data-checkout-summary></div>
      <div class="mt-6 rounded-md bg-white p-4 text-sm leading-relaxed">
        <p class="font-medium text-ink">Payment: Cash on delivery</p>
        <p class="mt-1">Pay when your order arrives. We’ll confirm your order by phone or email before it ships. Online payment is coming soon.</p>
      </div>
      <label class="mt-5 flex items-start gap-3 text-sm"><input type="checkbox" required name="terms" class="mt-1 h-4 w-4 accent-brand"> <span>I have read and agree to the <a href="/privacy-policy/" class="text-brand underline">privacy policy</a> and <a href="/refund-returns/" class="text-brand underline">refund &amp; returns policy</a>.</span></label>
      <button type="submit" class="btn-brand mt-6 w-full py-4">Place order</button>
      <p class="mt-3 text-sm" data-form-status role="status"></p>
    </aside>
  </form>
</section>`;
  return { meta: { title: 'Checkout', noindex: true, scripts: ['orders.js'] }, body };
}

export function orderReceived() {
  const body = `${pageTitle('Order received', [HOME, { label: 'Order received' }], { banner: false })}
<section class="mx-auto max-w-3xl px-4 pb-8 sm:px-6" data-order-received>
  <p class="py-10 text-center">Loading…</p>
</section>`;
  return { meta: { title: 'Order received', noindex: true, scripts: ['orders.js'] }, body };
}

export function wishlist() {
  const body = `${pageTitle('Wishlist', [HOME, { label: 'Wishlist' }], { banner: false })}
<section class="container-site pb-8" data-wishlist-page>
  <p class="py-10 text-center">Loading your wishlist…</p>
</section>`;
  return { meta: { title: 'Wishlist', noindex: true }, body };
}

/* ------------------------------------------------------------------ LOGIN / REGISTER / ACCOUNT */
// Defined in auth-pages.mjs
export { login, register, account, authAction } from './auth-pages.mjs';
export { admin } from './admin-page.mjs';

/* ------------------------------------------------------------------ POLICY / 404 */
export function policy(ctx, key) {
  const pg = ctx.policies[key];
  const body = `${pageTitle(pg.title, [HOME, { label: pg.title }], { banner: false })}
<section class="mx-auto max-w-[1120px] px-4 pb-8 sm:px-6"><div class="prose-content">${pg.content}</div></section>`;
  return { meta: { title: pg.title }, body };
}

export function notFound() {
  const body = `<section class="container-site py-24 text-center md:py-32">
  <p class="text-[120px] font-medium leading-none text-brand/20">404</p>
  <h1 class="mt-4 text-4xl font-medium">Page not found</h1>
  <p class="mt-4">Sorry, the page you are looking for doesn't exist or has moved.</p>
  <div class="mt-10 flex flex-wrap justify-center gap-4"><a href="/" class="btn-brand">Back to home</a><a href="/shop/" class="btn-outline">Visit the shop</a></div>
</section>`;
  return { meta: { title: 'Page not found', noindex: true }, body };
}
