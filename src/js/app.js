// Main script: loaded on every page (as an ES module, so it never blocks rendering).
import config from './config.js';
import { cart, wishlist, onChange, cartSummary, findProduct, getCatalog, money, link } from './store.js';
import { renderMiniCart, renderCartPage, renderCheckoutSummary, renderWishlistPage, renderQuickView, updateBadges, esc } from './ui.js';
import { send, formData, validate } from './forms.js';

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
  if ($('dialog[open]')) return; // the size chart (native dialog) handles its own Esc / focus
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
/** Adds to cart. Products with sizes need one: without it (e.g. from a product card) the quick view opens to pick. */
async function addToCart(id, qty = 1, { size = '', openCart = true } = {}) {
  const p = await findProduct(id);
  if (!p || !p.inStock) { toast('Sorry, this product is not available.'); return false; }
  if (p.sizes?.length && !size) {
    open('quick-view');
    await renderQuickView(id);
    toast('Please choose your size');
    return false;
  }
  if (size && (!p.sizes.includes(size) || p.soldOutSizes.includes(size))) { toast('Sorry, that size is not available.'); return false; }
  cart.add(id, qty, size);
  toast(`“${p.name}”${size ? ` (size ${size})` : ''} added to your cart`);
  if (openCart) open('mini-cart');
  return true;
}

/** The size chosen in a product form, or null (and a visible prompt) if one is needed but missing. */
function chosenSize(form) {
  const picker = form && $('[data-size-picker]', form);
  if (!picker) return '';
  const checked = $('input[name=size]:checked', picker);
  if (checked) return checked.value;
  $('[data-size-error]', picker).hidden = false;
  $('input[name=size]:not(:disabled)', picker)?.focus();
  return null;
}

/* ------------------------------------------------------------------ size chart (native <dialog>) */
const UNIT_KEY = 'pv-size-unit';
function setUnit(dlg, unit) {
  $$('[data-unit]', dlg).forEach((b) => b.setAttribute('aria-pressed', b.dataset.unit === unit));
  $$('td[data-in]', dlg).forEach((td) => (td.textContent = unit === 'cm' ? td.dataset.cm : td.dataset.in));
  try { localStorage.setItem(UNIT_KEY, unit); } catch { /* ignore */ }
}
function showChartTab(dlg, tab) {
  $$('[data-chart-tab]', dlg).forEach((b) => b.setAttribute('aria-selected', b.dataset.chartTab === tab));
  $$('[data-chart-panel]', dlg).forEach((p) => (p.hidden = p.dataset.chartPanel !== tab));
}
function openSizeChart(from) {
  const dlg = $('#size-chart');
  if (!dlg) return;
  const size = from?.closest('form')?.querySelector('input[name=size]:checked')?.value;
  $$('[data-chart-row]', dlg).forEach((r) => r.toggleAttribute('data-selected', r.dataset.chartRow === size));
  let unit = 'in';
  try { unit = localStorage.getItem(UNIT_KEY) || 'in'; } catch { /* ignore */ }
  setUnit(dlg, unit);
  showChartTab(dlg, 'chart');
  dlg.showModal();
}
// Click on the dark backdrop closes the chart.
$('#size-chart')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });

/* ------------------------------------------------------------------ global click handling */
document.addEventListener('click', async (e) => {
  if (e.target.matches('[data-modal]')) { close(); return; } // click on the dark area around the quick view
  const t = e.target.closest('button, a, [data-overlay]');
  if (!t) return;
  const d = t.dataset;

  if (d.open) { e.preventDefault(); open(d.open); return; }
  if ('close' in d || 'overlay' in d) { close(); return; }

  if ('openSizeChart' in d) { openSizeChart(t); return; }
  if ('dialogClose' in d) { t.closest('dialog')?.close(); return; }
  if (d.chartTab) { showChartTab(t.closest('dialog'), d.chartTab); return; }
  if (d.unit) { setUnit(t.closest('dialog'), d.unit); return; }

  if (d.addToCart) { addToCart(d.addToCart); return; }
  if (d.buyNow) {
    const form = $(`[data-product-form="${d.buyNow}"]`);
    const size = chosenSize(form);
    if (size === null) return;
    const qty = Number(form?.qty?.value) || 1;
    if (await addToCart(d.buyNow, qty, { size, openCart: false })) window.location.href = link('/checkout/');
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
    const key = d.cartInc || d.cartDec; // "id:size"
    const line = cart.items().find((i) => i.key === key);
    if (!line) return;
    if (d.cartDec && line.qty <= 1) cart.remove(key);
    else cart.setQty(key, line.qty + (d.cartInc ? 1 : -1));
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
  // Size picked → show it next to "Size:" and clear any "please select" prompt.
  if (e.target.matches('[data-size-picker] input[name=size]')) {
    const picker = e.target.closest('[data-size-picker]');
    const label = $('[data-size-label]', picker);
    label.textContent = e.target.value;
    label.className = 'font-medium text-ink';
    $('[data-size-error]', picker).hidden = true;
  }
});

document.addEventListener('submit', async (e) => {
  const form = e.target;

  if (form.matches('[data-product-form]')) {
    e.preventDefault();
    const size = chosenSize(form);
    if (size === null) return; // "Please select a size." is now showing
    const qty = Number(form.qty.value) || 1;
    if (form.closest('#quick-view')) close();
    addToCart(form.dataset.productForm, qty, { size });
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

/* Checkout, order confirmation and 'My orders' live in orders.js (loaded only on those pages). */

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
// Prefetch product data shortly after load so quick view / cart feel instant.
(window.requestIdleCallback || setTimeout)(() => getCatalog().catch(() => {}));
