// HTML renderers for the parts of the site that depend on the visitor's cart / wishlist.
import { cart, wishlist, cartSummary, getCatalog, findProduct, money, imageUrl, link } from './store.js';

export const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const svg = (d, cls = 'h-4 w-4') =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  minus: svg('<path d="M5 12h14"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  bag: svg('<path d="M6 7h12l1 13H5L6 7Z"/><path d="M9 7V6a3 3 0 0 1 6 0v1"/>', 'h-12 w-12'),
  heart: svg('<path d="M19.5 12.57 12 20l-7.5-7.43A5 5 0 1 1 12 6.01a5 5 0 1 1 7.5 6.56Z"/>', 'h-12 w-12'),
};

const img = (name, w, cls, alt = '') =>
  `<img src="${imageUrl(name, w)}" alt="${esc(alt)}" width="300" height="400" loading="lazy" decoding="async" class="${cls}">`;

// "Product 1 (size M)" for screen-reader labels; a small "Size: M" line for display.
const lineName = (l) => esc(l.name) + (l.size ? ` (size ${esc(l.size)})` : '');
const sizeTag = (l) => (l.size ? `<p class="text-sm">Size: <span class="font-medium text-ink">${esc(l.size)}</span></p>` : '');

const qtyControl = (l, size = 'sm') => `<div class="inline-flex items-center rounded-md border border-line ${size === 'sm' ? 'h-8' : 'h-10'}">
  <button type="button" class="flex h-full w-8 items-center justify-center text-muted hover:text-brand" data-cart-dec="${esc(l.key)}" aria-label="Decrease quantity of ${lineName(l)}">${I.minus}</button>
  <input type="number" min="1" max="99" value="${l.qty}" class="h-full w-9 bg-transparent text-center text-sm text-ink [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none" data-cart-qty="${esc(l.key)}" aria-label="Quantity of ${lineName(l)}">
  <button type="button" class="flex h-full w-8 items-center justify-center text-muted hover:text-brand" data-cart-inc="${esc(l.key)}" aria-label="Increase quantity of ${lineName(l)}">${I.plus}</button>
</div>`;

// Size buttons – same markup as sizePicker() in src/templates/components.mjs (keep in sync).
const SIZE_BTN =
  'flex h-11 min-w-[3.25rem] cursor-pointer items-center justify-center rounded-md border border-line bg-white px-3 text-sm font-medium text-ink transition hover:border-brand peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:bg-soft peer-disabled:text-muted/60 peer-disabled:line-through peer-disabled:hover:border-line';
const RULER = svg('<path d="M3 15.5 15.5 3 21 8.5 8.5 21 3 15.5Z"/><path d="m7 12 2 2M10 9l2 2M13 6l2 2"/>');
function sizePicker(p) {
  if (!p.sizes?.length) return '';
  const soldOut = new Set(p.soldOutSizes || []);
  return `<fieldset data-size-picker>
    <legend class="sr-only">Size</legend>
    <div class="flex items-center justify-between gap-4">
      <p class="text-sm font-medium text-ink">Size: <span class="font-normal text-muted" data-size-label>Select a size</span></p>
      <button type="button" class="inline-flex items-center gap-1.5 text-sm text-brand underline-offset-2 hover:underline" data-open-size-chart>${RULER}Size chart</button>
    </div>
    <div class="mt-3 flex flex-wrap gap-2">${p.sizes
      .map((s) => `<label title="${esc(s)}${soldOut.has(s) ? ' – sold out' : ''}"><input type="radio" name="size" value="${esc(s)}" class="peer sr-only"${soldOut.has(s) ? ' disabled' : ''}><span class="${SIZE_BTN}">${esc(s)}</span></label>`)
      .join('')}</div>
    <p class="mt-2 text-sm text-red-700" data-size-error hidden role="alert">Please select a size.</p>
  </fieldset>`;
}

const emptyState = (icon, text, cta = true) => `<div class="flex flex-col items-center py-12 text-center">
  <span class="text-line">${icon}</span>
  <p class="mt-4 text-ink">${text}</p>
  ${cta ? `<a href="${link('/shop/')}" class="btn-brand mt-6">Return to shop</a>` : ''}
</div>`;

/* ---------------------------------------------------------------- mini cart */
export async function renderMiniCart() {
  const box = document.querySelector('[data-mini-cart-items]');
  if (!box) return;
  const foot = document.querySelector('[data-mini-cart-footer]');
  const s = await cartSummary();
  if (!s.lines.length) {
    box.innerHTML = emptyState(I.bag, 'No products in the cart.');
    foot.hidden = true;
    return;
  }
  box.innerHTML = `<ul class="divide-y divide-line">${s.lines
    .map(
      (l) => `<li class="flex gap-4 py-5">
    <a href="${l.url}" class="w-20 shrink-0">${img(l.image, 400, 'aspect-[3/4] w-full rounded-md object-cover', l.name)}</a>
    <div class="flex min-w-0 flex-1 flex-col">
      <div class="flex items-start justify-between gap-2">
        <a href="${l.url}" class="font-medium text-ink hover:text-brand">${esc(l.name)}</a>
        <button type="button" class="-mr-1 p-1 text-muted hover:text-brand" data-cart-remove="${esc(l.key)}" aria-label="Remove ${lineName(l)}">${I.close}</button>
      </div>
      ${sizeTag(l)}
      <p class="text-sm">${money(l.price)}</p>
      <div class="mt-auto flex items-center justify-between pt-2">${qtyControl(l)}<span class="font-medium text-ink">${money(l.lineTotal)}</span></div>
    </div>
  </li>`
    )
    .join('')}</ul>`;
  foot.hidden = false;
  foot.querySelector('[data-mini-cart-subtotal]').textContent = money(s.subtotal);
}

/* ---------------------------------------------------------------- totals block */
function totalsHtml(s, { withCoupon = false } = {}) {
  const row = (label, value, strong = false) =>
    `<div class="flex items-center justify-between py-3 ${strong ? 'text-lg font-semibold text-ink' : ''}"><dt>${label}</dt><dd class="${strong ? '' : 'text-ink'}">${value}</dd></div>`;
  return `<dl class="divide-y divide-line">
    ${row('Subtotal', money(s.subtotal))}
    ${s.coupon ? row(`Coupon <span class="rounded bg-brand-light px-1.5 py-0.5 text-xs font-medium text-brand">${esc(s.coupon.code)}</span> (${s.coupon.pct}% off)${withCoupon ? ' <button type="button" class="ml-1 text-xs text-brand underline" data-coupon-remove>Remove</button>' : ''}`, '−' + money(s.discount)) : ''}
    ${row('Shipping', s.shipping ? money(s.shipping) : 'Free shipping')}
    ${row('Total', money(s.total), true)}
  </dl>`;
}

/* ---------------------------------------------------------------- cart page */
export async function renderCartPage() {
  const root = document.querySelector('[data-cart-page]');
  if (!root) return;
  const s = await cartSummary();
  if (!s.lines.length) {
    root.innerHTML = `<div class="rounded-md border-t-[3px] border-brand bg-[#F8F8F8] px-8 py-6 text-ink">Your cart is currently empty.</div>
    <a href="${link('/shop/')}" class="btn-brand mt-10">Return to shop</a>`;
    return;
  }
  root.innerHTML = `<div class="grid gap-10 lg:grid-cols-[1fr_380px]">
  <div>
    <table class="w-full text-left">
      <thead class="hidden border-b border-line text-sm uppercase tracking-[0.12em] text-ink md:table-header-group">
        <tr><th class="pb-4 font-medium" colspan="2">Product</th><th class="pb-4 font-medium">Price</th><th class="pb-4 font-medium">Quantity</th><th class="pb-4 text-right font-medium">Subtotal</th><th class="pb-4"><span class="sr-only">Remove</span></th></tr>
      </thead>
      <tbody class="divide-y divide-line">
        ${s.lines
          .map(
            (l) => `<tr class="grid grid-cols-[80px_1fr_auto] gap-x-4 gap-y-2 py-5 md:table-row">
          <td class="row-span-3 md:w-24 md:py-5 md:pr-5"><a href="${l.url}">${img(l.image, 400, 'aspect-[3/4] w-20 rounded-md object-cover', l.name)}</a></td>
          <td class="md:py-5"><a href="${l.url}" class="font-medium text-ink hover:text-brand">${esc(l.name)}</a>${sizeTag(l)}<p class="text-sm md:hidden">${money(l.price)}</p></td>
          <td class="hidden md:table-cell md:py-5">${money(l.price)}</td>
          <td class="col-start-2 md:py-5">${qtyControl(l, 'lg')}</td>
          <td class="col-start-2 font-medium text-ink md:py-5 md:text-right">${money(l.lineTotal)}</td>
          <td class="col-start-3 row-start-1 text-right md:py-5 md:pl-4"><button type="button" class="p-1 text-muted hover:text-brand" data-cart-remove="${esc(l.key)}" aria-label="Remove ${lineName(l)}">${I.trash}</button></td>
        </tr>`
          )
          .join('')}
      </tbody>
    </table>
    <form class="mt-8 flex max-w-md gap-3" data-coupon-form>
      <label for="coupon-code" class="sr-only">Coupon code</label>
      <input id="coupon-code" name="code" placeholder="Coupon code" class="field !py-3" autocomplete="off">
      <button type="submit" class="btn-dark shrink-0 px-6">Apply</button>
    </form>
    <p class="mt-2 text-sm" data-coupon-status role="status"></p>
  </div>
  <aside class="h-max rounded-lg bg-soft p-6 md:p-8">
    <h2 class="mb-4 text-2xl font-medium">Cart totals</h2>
    ${totalsHtml(s, { withCoupon: true })}
    <a href="${link('/checkout/')}" class="btn-brand mt-6 w-full py-4">Proceed to checkout</a>
    <a href="${link('/shop/')}" class="mt-4 block text-center text-sm text-ink underline underline-offset-4 hover:text-brand">Continue shopping</a>
  </aside>
</div>`;
}

/* ---------------------------------------------------------------- checkout */
export async function renderCheckoutSummary() {
  const root = document.querySelector('[data-checkout-page]');
  if (!root) return null;
  const s = await cartSummary();
  const empty = !s.lines.length;
  root.querySelector('[data-checkout-empty]').hidden = !empty;
  // The form only shows once orders.js has confirmed the customer is signed in.
  root.querySelector('[data-checkout-form]').hidden = empty || root.dataset.needsSignin === '1';
  root.querySelector('[data-checkout-summary]').innerHTML = `<ul class="divide-y divide-line border-b border-line">${s.lines
    .map(
      (l) => `<li class="flex items-center gap-4 py-3">
      <span class="relative w-14 shrink-0">${img(l.image, 400, 'aspect-[3/4] w-full rounded object-cover', l.name)}<span class="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] text-white">${l.qty}</span></span>
      <span class="flex-1 text-ink">${esc(l.name)}${l.size ? `<span class="block text-sm text-muted">Size: ${esc(l.size)}</span>` : ''}</span><span class="text-ink">${money(l.lineTotal)}</span>
    </li>`
    )
    .join('')}</ul>${totalsHtml(s)}`;
  return s;
}

/* ---------------------------------------------------------------- wishlist page */
const card = (p) => `<article class="group" data-product-id="${p.id}">
  <div class="relative overflow-hidden rounded-lg bg-soft">
    <a href="${p.url}" class="block">${img(p.image, 800, 'aspect-[3/4] w-full object-cover transition duration-700 group-hover:scale-[1.03]', p.name)}</a>
    <button type="button" class="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink shadow hover:text-brand" data-wishlist-remove="${p.id}" aria-label="Remove ${esc(p.name)} from wishlist">${I.close}</button>
  </div>
  <h3 class="mt-5 text-xl font-normal"><a href="${p.url}" class="hover:text-brand">${esc(p.name)}</a></h3>
  <p class="mt-1 flex items-baseline gap-2.5">${p.regularPrice > p.price ? `<del class="text-sm">${money(p.regularPrice)}</del>` : ''}<span class="font-medium text-ink">${money(p.price)}</span></p>
  <button type="button" class="btn-outline mt-4 w-full px-4 py-3" data-add-to-cart="${p.id}" ${p.inStock ? '' : 'disabled'}>${p.inStock ? 'Add to cart' : 'Sold out'}</button>
</article>`;

export async function renderWishlistPage() {
  const root = document.querySelector('[data-wishlist-page]');
  if (!root) return;
  const catalog = await getCatalog();
  const items = wishlist.ids().map((id) => catalog.find((p) => p.id === id)).filter(Boolean);
  root.innerHTML = items.length
    ? `<div class="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-[30px] lg:grid-cols-4">${items.map(card).join('')}</div>`
    : emptyState(I.heart, 'Your wishlist is empty. Tap the heart on any product to save it here.');
}

/* ---------------------------------------------------------------- quick view */
export async function renderQuickView(id) {
  const body = document.querySelector('[data-quick-view-body]');
  body.innerHTML = '<p class="p-16 text-center">Loading…</p>';
  const p = await findProduct(id);
  if (!p) {
    body.innerHTML = '<p class="p-16 text-center">Sorry, this product could not be found.</p>';
    return;
  }
  const imgs = [p.image, ...p.gallery];
  body.innerHTML = `<div class="grid md:grid-cols-2">
  <div class="bg-soft" data-gallery>
    <div class="relative">${imgs.map((n, i) => `<div class="${i ? 'absolute inset-0 opacity-0' : ''} transition-opacity duration-300" data-main="${i}">${img(n, 800, 'aspect-[3/4] w-full object-cover', i ? '' : p.name)}</div>`).join('')}</div>
    ${imgs.length > 1 ? `<div class="no-scrollbar flex gap-2 overflow-x-auto p-3">${imgs.map((n, i) => `<button type="button" class="w-14 shrink-0 overflow-hidden rounded ring-brand aria-[current=true]:ring-2" data-thumb="${i}" aria-label="Show image ${i + 1}"${i ? '' : ' aria-current="true"'}>${img(n, 400, 'aspect-[3/4] w-full object-cover')}</button>`).join('')}</div>` : ''}
  </div>
  <div class="flex flex-col p-6 md:p-10">
    <p class="text-sm uppercase tracking-[0.15em] text-brand">${esc(p.categories.join(', '))}</p>
    <h2 class="mt-2 text-3xl font-medium">${esc(p.name)}</h2>
    <p class="mt-4 flex items-baseline gap-3 text-2xl">${p.regularPrice > p.price ? `<del class="text-base text-muted">${money(p.regularPrice)}</del>` : ''}<span class="font-medium text-ink">${money(p.price)}</span></p>
    <form class="mt-8 space-y-4" data-product-form="${p.id}" novalidate>
      ${sizePicker(p)}
      <div class="inline-flex items-center rounded-md border-2 border-brand" data-qty>
        <button type="button" class="flex h-11 w-11 items-center justify-center text-muted hover:text-brand" data-qty-dec aria-label="Decrease quantity">${I.minus}</button>
        <input name="qty" type="number" min="1" max="99" value="1" aria-label="Quantity" class="h-11 w-12 bg-transparent text-center text-ink [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none">
        <button type="button" class="flex h-11 w-11 items-center justify-center text-muted hover:text-brand" data-qty-inc aria-label="Increase quantity">${I.plus}</button>
      </div>
      <button type="submit" class="btn-brand w-full py-4" ${p.inStock ? '' : 'disabled'}>${p.inStock ? 'Add to cart' : 'Sold out'}</button>
    </form>
    <a href="${p.url}" class="mt-6 text-ink underline underline-offset-4 hover:text-brand">View full details</a>
  </div>
</div>`;
}

/* ---------------------------------------------------------------- header badges + hearts */
export function updateBadges() {
  const set = (sel, n) =>
    document.querySelectorAll(sel).forEach((el) => {
      el.textContent = n > 99 ? '99+' : n;
      el.hidden = n === 0;
    });
  set('[data-cart-count]', cart.count());
  set('[data-wishlist-count]', wishlist.count());
  const ids = wishlist.ids();
  document.querySelectorAll('[data-wishlist]').forEach((b) => {
    const on = ids.includes(Number(b.dataset.wishlist));
    b.setAttribute('aria-pressed', on);
  });
}
