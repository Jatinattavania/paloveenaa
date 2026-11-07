// Cart + wishlist state, saved in the browser (localStorage). Prices always come from the live product data.
import config from './config.js';

const KEYS = { cart: 'pv-cart', wishlist: 'pv-wishlist', coupon: 'pv-coupon' };

const read = (key, fallback) => {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked (private mode) – state just won't persist */
  }
  emit();
};

const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);
const emit = () => listeners.forEach((fn) => fn());
// Keep several open tabs in sync.
window.addEventListener('storage', (e) => {
  if (Object.values(KEYS).includes(e.key)) emit();
});

/** Site path → URL. Adds the base path when the site lives in a sub-folder (e.g. GitHub Pages /paloveenaa/). */
export const link = (p) => (config.base || '') + p;

let catalogPromise;
export const getCatalog = () =>
  (catalogPromise ??= fetch(link('/assets/data/products.json')).then((r) => {
    if (!r.ok) throw new Error('Could not load products');
    return r.json();
  }));
export const findProduct = async (id) => (await getCatalog()).find((p) => p.id === Number(id));

export const money = (n) =>
  config.currency.symbol +
  Number(n).toLocaleString('en-IN', { minimumFractionDigits: config.currency.decimals, maximumFractionDigits: config.currency.decimals });

export const imageUrl = (name, w = 400) => link(`/assets/images/products/${name}-${w}.webp`);

const clampQty = (q) => Math.max(1, Math.min(99, Math.floor(Number(q)) || 1));

export const cart = {
  items: () => read(KEYS.cart, []).filter((i) => i && i.id && i.qty > 0),
  count() {
    return this.items().reduce((n, i) => n + i.qty, 0);
  },
  add(id, qty = 1) {
    const items = this.items();
    const line = items.find((i) => i.id === Number(id));
    if (line) line.qty = clampQty(line.qty + Number(qty));
    else items.push({ id: Number(id), qty: clampQty(qty) });
    write(KEYS.cart, items);
  },
  setQty(id, qty) {
    write(KEYS.cart, this.items().map((i) => (i.id === Number(id) ? { ...i, qty: clampQty(qty) } : i)));
  },
  remove(id) {
    write(KEYS.cart, this.items().filter((i) => i.id !== Number(id)));
  },
  clear() {
    write(KEYS.cart, []);
    write(KEYS.coupon, null);
  },
  coupon: () => read(KEYS.coupon, null),
  /** Returns true if the code is valid (and applies it). */
  applyCoupon(code) {
    const c = String(code || '').trim().toUpperCase();
    const pct = config.shop.coupons?.[c];
    if (!pct) return false;
    write(KEYS.coupon, c);
    return true;
  },
  removeCoupon() {
    write(KEYS.coupon, null);
  },
};

export const wishlist = {
  ids: () => read(KEYS.wishlist, []).map(Number),
  has(id) {
    return this.ids().includes(Number(id));
  },
  count() {
    return this.ids().length;
  },
  /** Toggles and returns the new state. */
  toggle(id) {
    const ids = this.ids();
    const on = !ids.includes(Number(id));
    write(KEYS.wishlist, on ? [...ids, Number(id)] : ids.filter((x) => x !== Number(id)));
    return on;
  },
  remove(id) {
    write(KEYS.wishlist, this.ids().filter((x) => x !== Number(id)));
  },
};

/** Cart lines joined with product data, plus totals. */
export async function cartSummary() {
  const catalog = await getCatalog();
  const lines = cart
    .items()
    .map((i) => {
      const p = catalog.find((x) => x.id === i.id);
      return p ? { ...p, qty: i.qty, lineTotal: p.price * i.qty } : null;
    })
    .filter(Boolean);
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const code = cart.coupon();
  const pct = code ? config.shop.coupons?.[code] || 0 : 0;
  const discount = Math.round(subtotal * pct) / 100;
  const shipping = !lines.length || subtotal >= (config.shop.freeShippingOver ?? 0) ? 0 : config.shop.shippingFee || 0;
  return { lines, subtotal, coupon: pct ? { code, pct } : null, discount, shipping, total: Math.max(0, subtotal - discount + shipping) };
}
