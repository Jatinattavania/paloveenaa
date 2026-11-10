// Main script: loaded on every page (as an ES module, so it never blocks rendering).
import config from './config.js';
import { cart, wishlist, onChange, cartSummary, findProduct, getCatalog, money, link } from './store.js';
import { renderMiniCart, renderCartPage, renderCheckoutSummary, renderWishlistPage, renderQuickView, updateBadges, esc } from './ui.js';
import { send, formData, validate, hasService, mailtoUrl } from './forms.js';

// Clickjacking guard: refuse to be shown inside another site's frame. (On Hostinger the .htaccess headers
// already block this; GitHub Pages can't send those headers, so this covers it.)
if (window.top !== window.self) {
  document.documentElement.style.display = 'none';
  try { window.top.location.replace(window.self.location.href); } catch { /* browser blocked it – page stays hidden */ }
}

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ------------------------------------------------------------------ toast */
let toastTimer;
function toast(message) {
  const el = $('[data-toast]');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('opacity-0', 'translate-y-4');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('opacity-0', 'translate-y-4'), 2600);
}

/* ------------------------------------------------------------------ drawers & modal */
const HIDDEN = ['invisible', '-translate-x-full', 'translate-x-full', 'opacity-0', 'scale-95'];
let openDrawer = null;
let lastFocus = null;

function open(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (openDrawer && openDrawer !== el) close();
  const panel = $('[data-panel]', el) || el;
  panel.dataset.hiddenClasses ??= HIDDEN.filter((c) => panel.classList.contains(c)).join(' ');
  el.classList.remove('invisible');
  panel.classList.remove(...HIDDEN);
  $('[data-overlay]').classList.remove('invisible', 'opacity-0');
  document.documentElement.style.overflow = 'hidden';
  lastFocus = document.activeElement;
  openDrawer = el;
  setTimeout(() => (el.querySelector('[data-close]') || el).focus(), 50);
  if (id === 'mini-cart') renderMiniCart();
}

function close() {
  if (!openDrawer) return;
  const el = openDrawer;
  const panel = $('[data-panel]', el) || el;
  panel.classList.add(...panel.dataset.hiddenClasses.split(' ').filter(Boolean));
  // Hide the wrapper once the slide-out transition has finished.
  setTimeout(() => openDrawer !== el && el.classList.add('invisible'), 300);
  $('[data-overlay]').classList.add('invisible', 'opacity-0');
  document.documentElement.style.overflow = '';
  openDrawer = null;
  lastFocus?.focus?.();
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') close();
  // Keep keyboard focus inside an open drawer/modal.
  if (e.key === 'Tab' && openDrawer) {
    const f = $$('a[href], button:not([disabled]), input:not([type=hidden]), select, textarea', openDrawer).filter((x) => x.offsetParent);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
    else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
  }
});

/* ------------------------------------------------------------------ cart actions */
async function addToCart(id, qty = 1, { openCart = true } = {}) {
  const p = await findProduct(id);
  if (!p || !p.inStock) return toast('Sorry, this product is not available.');
  cart.add(id, qty);
  toast(`“${p.name}” added to your cart`);
  if (openCart) open('mini-cart');
}

/* ------------------------------------------------------------------ global click handling */
document.addEventListener('click', async (e) => {
  if (e.target.matches('[data-modal]')) { close(); return; } // click on the dark area around the quick view
  const t = e.target.closest('button, a, [data-overlay]');
  if (!t) return;
  const d = t.dataset;

  if (d.open) { e.preventDefault(); open(d.open); return; }
  if ('close' in d || 'overlay' in d) { close(); return; }

  if (d.addToCart) { addToCart(d.addToCart); return; }
  if (d.buyNow) {
    const qty = $(`[data-product-form="${d.buyNow}"] input[name=qty]`)?.value || 1;
    cart.add(d.buyNow, qty);
    window.location.href = link('/checkout/');
    return;
  }
  if (d.wishlist) {
    const on = wishlist.toggle(d.wishlist);
    const p = await findProduct(d.wishlist);
    toast(on ? `“${p?.name}” added to your wishlist` : `Removed from your wishlist`);
    return;
  }
  if (d.wishlistRemove) { wishlist.remove(d.wishlistRemove); return; }
  if (d.quickView) { open('quick-view'); renderQuickView(d.quickView); return; }

  if (d.cartRemove) { cart.remove(d.cartRemove); return; }
  if (d.cartInc || d.cartDec) {
    const id = Number(d.cartInc || d.cartDec);
    const line = cart.items().find((i) => i.id === id);
    if (!line) return;
    if (d.cartDec && line.qty <= 1) cart.remove(id);
    else cart.setQty(id, line.qty + (d.cartInc ? 1 : -1));
    return;
  }
  if ('couponRemove' in d) { cart.removeCoupon(); return; }

  // Quantity steppers on product forms
  if ('qtyInc' in d || 'qtyDec' in d) {
    const input = t.closest('[data-qty]').querySelector('input');
    input.value = Math.max(1, Math.min(99, (Number(input.value) || 1) + ('qtyInc' in d ? 1 : -1)));
    return;
  }

  // Image galleries (product page + quick view)
  if (d.thumb) {
    const g = t.closest('[data-gallery]');
    $$('[data-thumb]', g).forEach((b) => b.setAttribute('aria-current', b === t));
    $$('[data-main]', g).forEach((m) => m.classList.toggle('opacity-0', m.dataset.main !== d.thumb));
  }
});

document.addEventListener('change', (e) => {
  const qty = e.target.closest('[data-cart-qty]');
  if (qty) cart.setQty(qty.dataset.cartQty, qty.value);
});

document.addEventListener('submit', async (e) => {
  const form = e.target;

  if (form.matches('[data-product-form]')) {
    e.preventDefault();
    const qty = Number(form.qty.value) || 1;
    const inModal = form.closest('#quick-view');
    if (inModal) close();
    addToCart(form.dataset.productForm, qty);
    return;
  }

  if (form.matches('[data-coupon-form]')) {
    e.preventDefault();
    const ok = cart.applyCoupon(form.code.value);
    if (ok) await renderCartPage(); // wait for the re-render so the message isn't wiped
    const el = $('[data-coupon-status]');
    if (el) {
      el.textContent = ok ? 'Coupon applied.' : 'Sorry, that coupon code is not valid.';
      el.className = `mt-2 text-sm ${ok ? 'text-green-700' : 'text-red-700'}`;
    }
    return;
  }

  if (form.matches('[data-form="contact"]')) return submitContact(e, form);
  if (form.matches('[data-form="newsletter"]')) return submitNewsletter(e, form);
  if (form.matches('[data-checkout-form]')) return submitOrder(e, form);
});

/* ------------------------------------------------------------------ carousels */
function initCarousel(root) {
  const track = $('[data-track]', root);
  if (!track) return;
  const step = () => {
    const first = track.children[0];
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    return first ? first.getBoundingClientRect().width + gap : track.clientWidth;
  };
  const atEnd = () => track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
  const go = (dir) => {
    if (dir > 0 && atEnd()) track.scrollTo({ left: 0 });
    else if (dir < 0 && track.scrollLeft <= 4) track.scrollTo({ left: track.scrollWidth });
    else track.scrollBy({ left: dir * step() });
  };
  $('[data-next]', root)?.addEventListener('click', () => go(1));
  $('[data-prev]', root)?.addEventListener('click', () => go(-1));

  const dots = $$('[data-dot]', root);
  if (dots.length) {
    const sync = () => {
      const i = Math.round(track.scrollLeft / track.clientWidth);
      dots.forEach((d, n) => d.setAttribute('aria-current', n === i));
    };
    track.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
    dots.forEach((d) => d.addEventListener('click', () => track.scrollTo({ left: Number(d.dataset.dot) * track.clientWidth })));
  }

  const delay = Number(root.dataset.autoplay);
  if (delay && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let paused = false;
    root.addEventListener('pointerenter', () => (paused = true));
    root.addEventListener('pointerleave', () => (paused = false));
    root.addEventListener('focusin', () => (paused = true));
    root.addEventListener('focusout', () => (paused = false));
    setInterval(() => !paused && !document.hidden && go(1), delay);
  }
}

function initLookbook(root) {
  const slides = $$('[data-lb-slide]', root);
  const images = $$('[data-lb-image]', root);
  const thumbs = $$('[data-lb-thumb]', root);
  let current = 0;
  const show = (i) => {
    current = (i + slides.length) % slides.length;
    slides.forEach((s, n) => {
      const on = n === current;
      s.classList.toggle('opacity-0', !on);
      s.classList.toggle('pointer-events-none', !on);
      s.classList.toggle('absolute', !on);
      s.classList.toggle('inset-0', !on);
      s.setAttribute('aria-hidden', !on);
      $$('a', s).forEach((a) => (on ? a.removeAttribute('tabindex') : a.setAttribute('tabindex', '-1')));
    });
    images.forEach((im, n) => im.classList.toggle('opacity-0', n !== current));
    thumbs.forEach((t, n) => t.setAttribute('aria-current', n === current));
  };
  thumbs.forEach((t) => t.addEventListener('click', () => show(Number(t.dataset.lbThumb))));
  $('[data-lb-next]', root)?.addEventListener('click', () => show(current + 1));
  $('[data-lb-prev]', root)?.addEventListener('click', () => show(current - 1));
}

/* ------------------------------------------------------------------ shop sorting */
function initSort() {
  const select = $('[data-sort]');
  const grid = $('[data-grid]');
  if (!select || !grid) return;
  select.addEventListener('change', () => {
    const items = [...grid.children];
    const by = {
      latest: (a, b) => a.dataset.sortIndex - b.dataset.sortIndex,
      'price-asc': (a, b) => a.dataset.sortPrice - b.dataset.sortPrice || a.dataset.sortIndex - b.dataset.sortIndex,
      'price-desc': (a, b) => b.dataset.sortPrice - a.dataset.sortPrice || a.dataset.sortIndex - b.dataset.sortIndex,
      name: (a, b) => a.dataset.sortName.localeCompare(b.dataset.sortName, undefined, { numeric: true }),
    }[select.value];
    items.sort(by).forEach((el) => grid.appendChild(el));
  });
}

/* ------------------------------------------------------------------ forms */
const status = (form, msg, ok = true) => {
  const el = form.querySelector('[data-form-status]') || form.parentElement.querySelector('[data-form-status]');
  if (el) {
    el.textContent = msg;
    el.className = `mt-2 text-sm ${ok ? 'text-green-700' : 'text-red-700'}`;
  }
};

// The hidden "botcheck" box is only ever ticked by spam bots: pretend it worked and send nothing.
const isBot = (form) => Boolean(form.botcheck?.checked);

const REMEMBER_KEY = 'pv-contact';
function initContactRemember() {
  const form = $('[data-form="contact"]');
  if (!form) return;
  try {
    const saved = JSON.parse(localStorage.getItem(REMEMBER_KEY));
    if (saved) {
      form.name.value = saved.name || '';
      form.email.value = saved.email || '';
      form.remember.checked = true;
    }
  } catch { /* ignore */ }
}

async function submitContact(e, form) {
  e.preventDefault();
  if (isBot(form)) return status(form, 'Thank you! Your message has been sent.');
  if (!validate(form)) return;
  const d = formData(form);
  try {
    if (form.remember.checked) localStorage.setItem(REMEMBER_KEY, JSON.stringify({ name: d.name, email: d.email }));
    else localStorage.removeItem(REMEMBER_KEY);
  } catch { /* ignore */ }
  const btn = form.querySelector('[type=submit]');
  btn.disabled = true;
  const res = await send(`New message from ${d.name} – ${config.siteName} website`, { name: d.name, email: d.email, replyto: d.email }, `Name: ${d.name}\nEmail: ${d.email}\n\n${d.message}`);
  btn.disabled = false;
  if (!res.ok) return status(form, `Sorry, your message could not be sent. Please email us at ${config.email}.`, false);
  if (res.method === 'mailto') return status(form, 'Your email app has opened with your message – press Send to deliver it.');
  form.reset();
  initContactRemember();
  status(form, 'Thank you! Your message has been sent. We will get back to you soon.');
}

async function submitNewsletter(e, form) {
  e.preventDefault();
  if (isBot(form)) return status(form, 'Thank you for subscribing!');
  if (!validate(form)) return;
  const email = form.email.value.trim();
  const res = await send(`Newsletter sign-up – ${config.siteName}`, { email }, `Please add ${email} to the ${config.siteName} newsletter.`);
  if (!res.ok) return status(form, 'Sorry, something went wrong. Please try again.', false);
  if (res.method === 'service') form.reset();
  status(form, res.method === 'mailto' ? 'Your email app has opened – press Send to subscribe.' : 'Thank you for subscribing!');
}

/* ------------------------------------------------------------------ checkout */
const ORDER_KEY = 'pv-last-order';

function orderText(o) {
  const lines = o.items.map((l) => `• ${l.name} (product #${l.id}) — ${l.qty} × ${money(l.price)} = ${money(l.lineTotal)}`).join('\n');
  const c = o.customer;
  return `New order ${o.number} (${o.date})

ITEMS
${lines}

Subtotal: ${money(o.subtotal)}${o.coupon ? `\nCoupon ${o.coupon.code} (${o.coupon.pct}% off): −${money(o.discount)}` : ''}
Shipping: ${o.shipping ? money(o.shipping) : 'Free'}
TOTAL: ${money(o.total)}

CUSTOMER
${c.firstName} ${c.lastName}
Phone: ${c.phone}
Email: ${c.email}

SHIPPING ADDRESS
${c.address}
${c.city}, ${c.state} ${c.pincode}
${c.country}
${c.notes ? `\nNOTES\n${c.notes}` : ''}

---
SHOP NOTE: totals are calculated in the customer's browser. Before confirming, check each product's
price against your current price list (product # = ID in src/data/products.json).`;
}

async function submitOrder(e, form) {
  e.preventDefault();
  if (isBot(form)) return status(form, 'Thank you! Your order has been received.');
  if (!validate(form)) return;
  const s = await cartSummary();
  if (!s.lines.length) return status(form, 'Your cart is empty.', false);
  const btn = form.querySelector('[type=submit]');
  btn.disabled = true;
  btn.textContent = 'Placing order…';
  const now = new Date();
  const number = `PV-${now.toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
  const customer = formData(form);
  delete customer.terms;
  delete customer.botcheck;
  const order = {
    number,
    date: now.toLocaleString('en-IN'),
    items: s.lines.map((l) => ({ id: l.id, name: l.name, qty: l.qty, price: l.price, lineTotal: l.lineTotal })),
    subtotal: s.subtotal, coupon: s.coupon, discount: s.discount, shipping: s.shipping, total: s.total, customer,
  };
  const subject = `New order ${number} – ${money(order.total)} – ${config.siteName}`;
  const text = orderText(order);
  let method = 'mailto';
  if (hasService()) {
    const res = await send(subject, { name: `${customer.firstName} ${customer.lastName}`, email: customer.email, phone: customer.phone, replyto: customer.email, order_number: number, order_total: money(order.total) }, text);
    if (!res.ok) {
      btn.disabled = false;
      btn.textContent = 'Place order';
      return status(form, `Sorry, we couldn't place your order right now. Please try again, or email us at ${config.email}.`, false);
    }
    method = 'service';
  }
  try { sessionStorage.setItem(ORDER_KEY, JSON.stringify({ ...order, method, mailto: method === 'mailto' ? mailtoUrl(subject, text) : null })); } catch { /* ignore */ }
  cart.clear();
  window.location.href = link('/order-received/');
}

function renderOrderReceived() {
  const root = $('[data-order-received]');
  if (!root) return;
  let o = null;
  try { o = JSON.parse(sessionStorage.getItem(ORDER_KEY)); } catch { /* ignore */ }
  if (!o) {
    root.innerHTML = `<p class="py-10 text-center">There is no recent order to show. <a href="${link('/shop/')}" class="text-brand underline">Continue shopping</a></p>`;
    return;
  }
  const mail = o.method === 'mailto';
  root.innerHTML = `<div class="rounded-lg border-t-[3px] border-brand bg-[#F8F8F8] p-6 text-ink md:p-8">
    <p class="text-xl font-medium">${mail ? 'Almost done – please send your order email' : 'Thank you. Your order has been received.'}</p>
    <p class="mt-2 text-muted">${mail
      ? `Your email app should have opened with your order details addressed to ${esc(config.email)}. <strong class="text-ink">Please press Send</strong> so we receive your order. If it didn't open, use the button below.`
      : `We will contact you on ${esc(o.customer.phone)} / ${esc(o.customer.email)} to confirm your order and arrange payment.`}</p>
    ${mail ? `<a href="${esc(o.mailto)}" class="btn-brand mt-5">Send order email</a>` : ''}
  </div>
  <dl class="mt-8 grid gap-4 text-sm sm:grid-cols-3">
    <div><dt class="uppercase tracking-[0.12em]">Order number</dt><dd class="mt-1 text-lg font-medium text-ink">${esc(o.number)}</dd></div>
    <div><dt class="uppercase tracking-[0.12em]">Date</dt><dd class="mt-1 text-lg font-medium text-ink">${esc(o.date)}</dd></div>
    <div><dt class="uppercase tracking-[0.12em]">Total</dt><dd class="mt-1 text-lg font-medium text-ink">${money(o.total)}</dd></div>
  </dl>
  <h2 class="mb-4 mt-10 text-2xl font-medium">Order details</h2>
  <ul class="divide-y divide-line border-y border-line">${o.items.map((l) => `<li class="flex justify-between py-3"><span class="text-ink">${esc(l.name)} × ${Number(l.qty) || 0}</span><span class="text-ink">${money(l.lineTotal)}</span></li>`).join('')}</ul>
  <a href="${link('/shop/')}" class="btn-outline mt-10">Continue shopping</a>`;
  if (mail && !sessionStorage.getItem(ORDER_KEY + '-opened')) {
    sessionStorage.setItem(ORDER_KEY + '-opened', '1');
    window.location.href = o.mailto;
  }
}

/* ------------------------------------------------------------------ boot */
function refresh() {
  updateBadges();
  renderCartPage();
  renderCheckoutSummary();
  renderWishlistPage();
  if (openDrawer?.id === 'mini-cart') renderMiniCart();
}

onChange(refresh);
refresh();
$$('[data-carousel]').forEach(initCarousel);
$$('[data-lookbook]').forEach(initLookbook);
initSort();
initContactRemember();
renderOrderReceived();
// Prefetch product data shortly after load so quick view / cart feel instant.
(window.requestIdleCallback || setTimeout)(() => getCatalog().catch(() => {}));
