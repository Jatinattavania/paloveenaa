// Admin panel (/admin/) for the owner and staff.
// Access: the database decides. We ask Firestore for two "probe" documents (_access/owner, _access/staff);
// the security rules only let owner/staff accounts with a verified email read them. Every order change is
// re-checked by the rules too, so hiding buttons here is for convenience, not security.
import config from './config.js';
import { app, auth, configured, link, emulators, currentUser } from './fb.js';
import { signOut, reload } from '../vendor/firebase-13.1.0/firebase-auth.js';
import {
  getFirestore, connectFirestoreEmulator, collection, query, orderBy, limit, onSnapshot, doc, getDoc, getDocs, updateDoc, serverTimestamp, Timestamp,
} from '../vendor/firebase-13.1.0/firebase-firestore.js';

if (window.top !== window.self) {
  document.documentElement.style.display = 'none';
  throw new Error('Refusing to run inside a frame');
}

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const when = (ts) => (ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null);
const fmt = (ts, withTime = true) =>
  when(ts)?.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) }) || '—';
const imageUrl = (name) => link(`/assets/images/products/${name}-400.webp`);
const prettyPhone = (p) => String(p || '').replace(/^\+91(\d{5})(\d{5})$/, '+91 $1 $2');

const STATUS = {
  new: { label: 'New', cls: 'bg-sky-100 text-sky-800' },
  confirmed: { label: 'Confirmed', cls: 'bg-indigo-100 text-indigo-800' },
  packed: { label: 'Packed', cls: 'bg-amber-100 text-amber-800' },
  shipped: { label: 'Shipped', cls: 'bg-violet-100 text-violet-800' },
  delivered: { label: 'Delivered', cls: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-800' },
};
const ORDER_TABS = ['all', 'new', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];
const badge = (s) => `<span class="inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${STATUS[s]?.cls || 'bg-soft'}">${esc(STATUS[s]?.label || s)}</span>`;
const CANCEL_REASONS = ['Customer asked to cancel', 'Out of stock', 'Could not reach customer', 'Delivery address not serviceable', 'Suspected fake order', 'Other'];

let db;
let me = { email: '', role: '' };
let orders = [];
let customers = null;
let catalog = [];
let view = 'dashboard';
let orderTab = 'all';
let search = '';
let openOrderId = null;
let openCustomerId = null;
let customerSearch = '';
let knownIds = null;

/* ------------------------------------------------------------------ small UI helpers */
function toast(text) {
  const el = $('[data-toast]');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('opacity-0', 'translate-y-4');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.add('opacity-0', 'translate-y-4'), 3000);
}
function gate(html) {
  const g = $('[data-admin-gate]');
  g.hidden = false;
  g.innerHTML = html;
  $$('[data-view]').forEach((v) => (v.hidden = true));
}
const card = (label, value, sub = '') =>
  `<div class="rounded-lg bg-white p-5 shadow-sm"><p class="text-sm">${label}</p><p class="mt-1 text-3xl font-medium text-ink">${value}</p>${sub ? `<p class="mt-1 text-xs">${sub}</p>` : ''}</div>`;

/* ------------------------------------------------------------------ price check (free plan safeguard) */
// Orders are written by the customer's browser, so compare each line with the current price list.
function priceIssues(o) {
  const issues = [];
  for (const l of o.items || []) {
    const p = catalog.find((x) => x.id === l.id);
    if (!p) issues.push(`${l.name}: product not found in the current catalogue`);
    else if (Math.abs(p.price - l.price) > 0.009) issues.push(`${l.name}${l.size ? ` (${l.size})` : ''}: ordered at ${money(l.price)}, list price ${money(p.price)}`);
    if (Math.abs(l.price * l.qty - l.lineTotal) > 0.009) issues.push(`${l.name}: line total doesn't add up`);
  }
  const sub = (o.items || []).reduce((s, l) => s + l.price * l.qty, 0);
  if (Math.abs(sub - o.subtotal) > 0.009) issues.push('Subtotal doesn’t add up');
  const pct = o.coupon ? config.shop?.coupons?.[o.coupon.code] : 0;
  if (o.coupon && !pct) issues.push(`Coupon ${o.coupon.code} is not an active coupon`);
  const expectedTotal = o.subtotal - (o.discount || 0) + (o.shipping || 0);
  if (Math.abs(expectedTotal - o.total) > 0.009) issues.push('Total doesn’t add up');
  if (o.coupon && pct && Math.abs(Math.round(o.subtotal * pct) / 100 - o.discount) > 0.009) issues.push('Coupon discount amount is wrong');
  return issues;
}

/* ------------------------------------------------------------------ views */
function renderDashboard() {
  const el = $('[data-view="dashboard"]');
  const today = new Date().toDateString();
  const month = new Date().getMonth();
  const year = new Date().getFullYear();
  const live = orders.filter((o) => o.status !== 'cancelled');
  const count = (s) => orders.filter((o) => o.status === s).length;
  const todays = orders.filter((o) => when(o.createdAt)?.toDateString() === today);
  const monthly = live.filter((o) => when(o.createdAt)?.getMonth() === month && when(o.createdAt)?.getFullYear() === year);
  const flagged = orders.filter((o) => !['cancelled', 'delivered'].includes(o.status) && priceIssues(o).length);
  const isOwner = me.role === 'owner';
  el.innerHTML = `
  <h1 class="mb-5 text-2xl font-medium">Dashboard</h1>
  ${flagged.length ? `<div class="mb-5 rounded-lg border-l-4 border-red-600 bg-red-50 p-4 text-sm text-red-800">⚠ ${flagged.length} open order${flagged.length > 1 ? 's have' : ' has'} prices that don’t match your price list. <button type="button" class="font-medium underline" data-goto-orders="all">Review</button></div>` : ''}
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    ${card('New orders (to confirm)', count('new'))}
    ${card('To pack', count('confirmed'))}
    ${card('To ship', count('packed'))}
    ${card('Orders today', todays.length)}
    ${isOwner ? card('Sales this month', money(monthly.reduce((s, o) => s + o.total, 0)), `${monthly.length} order${monthly.length === 1 ? '' : 's'}, excluding cancelled`) : ''}
    ${isOwner ? card('Sales today', money(todays.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0))) : ''}
    ${card('Shipped (on the way)', count('shipped'))}
    ${card('Cancelled', count('cancelled'))}
  </div>
  <div class="mt-8 rounded-lg bg-white p-5 shadow-sm">
    <div class="mb-3 flex items-center justify-between"><h2 class="text-lg font-medium">Latest orders</h2><button type="button" class="text-sm text-brand underline" data-goto-orders="all">All orders</button></div>
    ${ordersTable(orders.slice(0, 8))}
  </div>`;
}

function ordersTable(list) {
  if (!list.length) return '<p class="py-8 text-center text-sm">No orders here yet.</p>';
  return `<div class="overflow-x-auto"><table class="w-full text-left text-sm">
    <thead class="border-b border-line text-xs uppercase tracking-[0.1em] text-ink"><tr>
      <th class="py-3 pr-3 font-medium">Order</th><th class="py-3 pr-3 font-medium">Date</th><th class="py-3 pr-3 font-medium">Customer</th>
      <th class="hidden py-3 pr-3 font-medium lg:table-cell">Deliver to</th>
      <th class="hidden py-3 pr-3 font-medium md:table-cell">Items</th><th class="py-3 pr-3 text-right font-medium">Total</th><th class="py-3 font-medium">Status</th>
    </tr></thead>
    <tbody class="divide-y divide-line">${list
      .map((o) => {
        const flag = !['cancelled', 'delivered'].includes(o.status) && priceIssues(o).length;
        return `<tr class="cursor-pointer hover:bg-soft" data-open-order="${esc(o.id)}" tabindex="0">
        <td class="py-3 pr-3 font-medium text-ink">${esc(o.number)}${flag ? ' <span title="Price check failed" class="text-red-600">⚠</span>' : ''}</td>
        <td class="whitespace-nowrap py-3 pr-3">${esc(fmt(o.createdAt))}</td>
        <td class="py-3 pr-3"><span class="text-ink">${esc(`${o.customer?.firstName || ''} ${o.customer?.lastName || ''}`)}</span><span class="block text-xs">${esc(o.customer?.phone || '')}</span><span class="block text-xs lg:hidden">${esc(o.customer?.city || '')} ${esc(o.customer?.pincode || '')}</span></td>
        <td class="hidden max-w-[240px] py-3 pr-3 lg:table-cell"><span class="block truncate text-ink" title="${esc(o.customer?.address || '')}">${esc(o.customer?.address || '—')}</span><span class="block text-xs">${esc([o.customer?.city, o.customer?.state].filter(Boolean).join(', '))} ${esc(o.customer?.pincode || '')}</span></td>
        <td class="hidden py-3 pr-3 md:table-cell">${o.items.map((l) => `${esc(l.name)}${l.size ? ` (${esc(l.size)})` : ''} ×${Number(l.qty) || 0}`).join(', ')}</td>
        <td class="whitespace-nowrap py-3 pr-3 text-right font-medium text-ink">${money(o.total)}</td>
        <td class="py-3">${badge(o.status)}</td>
      </tr>`;
      })
      .join('')}</tbody></table></div>`;
}

function renderOrders() {
  const el = $('[data-view="orders"]');
  const q = search.trim().toLowerCase();
  const list = orders.filter((o) => (orderTab === 'all' || o.status === orderTab)
    && (!q || [o.number, o.customer?.firstName, o.customer?.lastName, o.customer?.phone, o.customer?.email, o.customer?.pincode].join(' ').toLowerCase().includes(q)));
  el.innerHTML = `
  <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
    <h1 class="text-2xl font-medium">Orders</h1>
    <label class="w-full sm:w-80"><span class="sr-only">Search orders</span>
      <input type="search" value="${esc(search)}" placeholder="Search order no., name, phone, email, PIN" class="w-full rounded-md border border-line bg-white px-4 py-2.5 text-sm text-ink focus:border-brand focus:outline-none" data-order-search></label>
  </div>
  <div class="no-scrollbar mb-4 flex gap-2 overflow-x-auto">${ORDER_TABS.map((t) => {
    const n = t === 'all' ? orders.length : orders.filter((o) => o.status === t).length;
    return `<button type="button" data-order-tab="${t}" class="whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm ${orderTab === t ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink hover:border-brand'}">${t === 'all' ? 'All' : STATUS[t].label} <span class="opacity-75">(${n})</span></button>`;
  }).join('')}</div>
  <div class="rounded-lg bg-white p-5 shadow-sm">${ordersTable(list)}</div>`;
  const input = $('[data-order-search]', el);
  input.addEventListener('input', () => {
    search = input.value;
    const pos = input.selectionStart;
    renderOrders();
    const again = $('[data-order-search]');
    again.focus();
    again.setSelectionRange(pos, pos);
  });
}

async function renderCustomers() {
  const el = $('[data-view="customers"]');
  if (!customers) {
    el.innerHTML = '<p class="py-8 text-center">Loading customers…</p>';
    try {
      const snap = await getDocs(collection(db, 'users'));
      customers = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (when(b.createdAt) || 0) - (when(a.createdAt) || 0));
    } catch {
      el.innerHTML = '<p class="py-8 text-center text-red-700">Couldn’t load customers.</p>';
      return;
    }
  }
  const q = customerSearch.trim().toLowerCase();
  const list = customers.filter((c) => {
    const a = latestAddress(c.id);
    return !q || [c.firstName, c.lastName, c.email, c.phone, a?.city, a?.pincode].join(' ').toLowerCase().includes(q);
  });
  el.innerHTML = `<div class="mb-5 flex flex-wrap items-center justify-between gap-3">
    <h1 class="text-2xl font-medium">Customers <span class="text-base font-normal">(${customers.length})</span></h1>
    <label class="w-full sm:w-80"><span class="sr-only">Search customers</span>
      <input type="search" value="${esc(customerSearch)}" placeholder="Search name, email, phone, city, PIN" class="w-full rounded-md border border-line bg-white px-4 py-2.5 text-sm text-ink focus:border-brand focus:outline-none" data-customer-search></label>
  </div>
  <div class="overflow-x-auto rounded-lg bg-white p-5 shadow-sm">${list.length ? `<table class="w-full text-left text-sm">
    <thead class="border-b border-line text-xs uppercase tracking-[0.1em] text-ink"><tr><th class="py-3 pr-3 font-medium">Customer</th><th class="py-3 pr-3 font-medium">Contact</th><th class="py-3 pr-3 font-medium">Delivery address <span class="normal-case tracking-normal">(latest order)</span></th><th class="hidden py-3 pr-3 font-medium md:table-cell">Joined</th><th class="py-3 pr-3 text-right font-medium">Orders</th>${me.role === 'owner' ? '<th class="py-3 text-right font-medium">Spent</th>' : ''}</tr></thead>
    <tbody class="divide-y divide-line">${list.map((c) => {
      const s = customerStats(c.id);
      const a = latestAddress(c.id);
      return `<tr class="cursor-pointer align-top hover:bg-soft" data-open-customer="${esc(c.id)}" tabindex="0">
        <td class="py-3 pr-3 font-medium text-ink">${esc(`${c.firstName} ${c.lastName}`)}</td>
        <td class="py-3 pr-3"><span class="block">${esc(c.email)}</span><span class="block whitespace-nowrap text-xs">${esc(prettyPhone(c.phone))} ${c.phoneVerified ? '<span class="text-green-700">✓ verified</span>' : ''}</span></td>
        <td class="min-w-[200px] py-3 pr-3">${a ? `<span class="block text-ink">${esc(a.address)}</span><span class="block text-xs">${esc(`${a.city}, ${a.state} ${a.pincode}`)}</span>` : '<span class="text-xs">No orders yet</span>'}</td>
        <td class="hidden whitespace-nowrap py-3 pr-3 md:table-cell">${esc(fmt(c.createdAt, false))}</td>
        <td class="py-3 pr-3 text-right">${s.n}</td>${me.role === 'owner' ? `<td class="py-3 text-right text-ink">${money(s.spent)}</td>` : ''}</tr>`;
    }).join('')}</tbody></table>` : `<p class="py-8 text-center text-sm">${customers.length ? 'No customers match your search.' : 'No customers yet.'}</p>`}</div>`;
  const input = $('[data-customer-search]', el);
  input.addEventListener('input', () => {
    customerSearch = input.value;
    const pos = input.selectionStart;
    renderCustomers();
    const again = $('[data-customer-search]');
    again.focus();
    again.setSelectionRange(pos, pos);
  });
}

// Customer helpers: their orders (newest first), totals, and the delivery addresses they've used.
const ordersOf = (uid) => orders.filter((o) => o.uid === uid);
const customerStats = (uid) => {
  const mine = ordersOf(uid);
  return { n: mine.length, spent: mine.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0) };
};
const latestAddress = (uid) => ordersOf(uid).find((o) => o.customer?.address)?.customer || null;
function addressesOf(uid) {
  const seen = new Map();
  for (const o of ordersOf(uid)) {
    const c = o.customer || {};
    if (!c.address) continue;
    const key = [c.address, c.city, c.state, c.pincode].join('|').toLowerCase();
    if (!seen.has(key)) seen.set(key, { ...c, used: 0, last: o.createdAt });
    seen.get(key).used++;
  }
  return [...seen.values()];
}

function renderCustomerPanel() {
  const c = (customers || []).find((x) => x.id === openCustomerId);
  const panel = $('[data-order-panel]');
  if (!c) return closePanel();
  const s = customerStats(c.id);
  const addrs = addressesOf(c.id);
  const mine = ordersOf(c.id);
  const phoneDigits = String(c.phone || '').replace(/\D/g, '').slice(-10);
  panel.innerHTML = `
  <div class="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white px-6 py-4">
    <div><p class="text-lg font-medium text-ink">${esc(`${c.firstName} ${c.lastName}`)}</p><p class="text-xs">Customer since ${esc(fmt(c.createdAt, false))}</p></div>
    <button type="button" class="rounded-md px-3 py-2 text-2xl leading-none hover:bg-soft" data-close-panel aria-label="Close">×</button>
  </div>
  <div class="space-y-6 px-6 py-5">
    <section>
      <h3 class="mb-2 font-medium text-ink">Contact</h3>
      <p class="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <a class="text-brand underline" href="tel:${esc(c.phone)}">📞 ${esc(prettyPhone(c.phone))}</a>${c.phoneVerified ? '<span class="text-xs text-green-700">✓ verified</span>' : '<span class="text-xs">not verified</span>'}
        ${phoneDigits.length === 10 ? `<a class="text-brand underline" href="https://wa.me/91${esc(phoneDigits)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
        <a class="text-brand underline" href="mailto:${esc(c.email)}">${esc(c.email)}</a>
      </p>
      <p class="mt-2 text-sm">${s.n} order${s.n === 1 ? '' : 's'}${me.role === 'owner' ? ` · spent ${money(s.spent)}` : ''}</p>
    </section>
    <section>
      <h3 class="mb-2 font-medium text-ink">Delivery addresses</h3>
      ${addrs.length ? `<ul class="space-y-2">${addrs.map((a, i) => `<li class="rounded-md border border-line p-3 text-sm">
        ${i === 0 ? '<span class="mb-1 inline-block rounded bg-brand-light px-1.5 py-0.5 text-[11px] font-medium text-brand">Latest</span>' : ''}
        <p class="text-ink">${esc(`${a.firstName} ${a.lastName}`)}</p>
        <p>${esc(a.address)}<br>${esc(`${a.city}, ${a.state} ${a.pincode}`)}<br>${esc(a.country || 'India')}</p>
        <p class="mt-1 text-xs">Used in ${a.used} order${a.used === 1 ? '' : 's'} · last ${esc(fmt(a.last, false))}</p>
      </li>`).join('')}</ul>` : '<p class="text-sm">No address yet – addresses are saved with each order.</p>'}
    </section>
    <section>
      <h3 class="mb-2 font-medium text-ink">Orders</h3>
      ${mine.length ? `<ul class="divide-y divide-line rounded-md border border-line">${mine.map((o) => `<li><button type="button" class="flex w-full items-center justify-between gap-3 p-3 text-left text-sm hover:bg-soft" data-open-order="${esc(o.id)}">
        <span><span class="font-medium text-ink">${esc(o.number)}</span><span class="block text-xs">${esc(fmt(o.createdAt))}</span></span>
        <span class="flex items-center gap-3"><span class="font-medium text-ink">${money(o.total)}</span>${badge(o.status)}</span></button></li>`).join('')}</ul>` : '<p class="text-sm">No orders yet.</p>'}
    </section>
  </div>`;
}

function renderTeam() {
  const el = $('[data-view="team"]');
  const row = (what, staff, owner) => `<tr><td class="py-2.5 pr-3">${what}</td><td class="py-2.5 pr-3 text-center">${staff ? '✅' : '—'}</td><td class="py-2.5 text-center">${owner ? '✅' : '—'}</td></tr>`;
  el.innerHTML = `<h1 class="mb-5 text-2xl font-medium">Team &amp; access</h1>
  <div class="grid gap-6 lg:grid-cols-2">
    <div class="rounded-lg bg-white p-6 shadow-sm">
      <h2 class="text-lg font-medium">You</h2>
      <p class="mt-2 text-sm">Signed in as <span class="font-medium text-ink">${esc(me.email)}</span> · <span class="font-medium text-brand">${me.role === 'owner' ? 'Owner' : 'Staff'}</span></p>
      <h2 class="mt-6 text-lg font-medium">Adding or removing people</h2>
      <p class="mt-2 text-sm">For security, access isn’t changed from this screen. The owner and staff emails are kept in a private file (<code>src/data/admins.json</code>) and applied to the database’s security rules with <code>npm run deploy:rules</code>. Each person signs in with that email and must have verified it.</p>
    </div>
    <div class="rounded-lg bg-white p-6 shadow-sm">
      <h2 class="mb-3 text-lg font-medium">What each role can do</h2>
      <table class="w-full text-left text-sm"><thead class="border-b border-line text-xs uppercase tracking-[0.1em] text-ink"><tr><th class="py-2 pr-3 font-medium"></th><th class="py-2 pr-3 text-center font-medium">Staff</th><th class="py-2 text-center font-medium">Owner</th></tr></thead>
      <tbody class="divide-y divide-line">
        ${row('See all orders and customer details', 1, 1)}
        ${row('Confirm, pack, ship, deliver orders; add tracking', 1, 1)}
        ${row('Cancel orders (before shipping)', 1, 1)}
        ${row('Internal notes, packing slips', 1, 1)}
        ${row('Sales figures and customer spend', 0, 1)}
        ${row('Payments, refunds, prices, staff (coming next)', 0, 1)}
      </tbody></table>
    </div>
  </div>`;
}

function render() {
  $$('[data-admin-tab]').forEach((b) => b.setAttribute('aria-selected', b.dataset.adminTab === view));
  $$('[data-view]').forEach((v) => (v.hidden = v.dataset.view !== view));
  const newCount = orders.filter((o) => o.status === 'new').length;
  const ordersTabCount = $('[data-admin-tab="orders"] [data-tab-count]');
  ordersTabCount.textContent = newCount;
  ordersTabCount.classList.toggle('hidden', !newCount);
  document.title = `${newCount ? `(${newCount}) ` : ''}Admin – Paloveenaa`;
  if (view === 'dashboard') renderDashboard();
  if (view === 'orders') renderOrders();
  if (view === 'customers') renderCustomers();
  if (view === 'team') renderTeam();
  if (openOrderId) renderPanel();
  else if (openCustomerId) renderCustomerPanel();
}

/* ------------------------------------------------------------------ order panel */
const NEXT = {
  new: { to: 'confirmed', label: 'Confirm order' },
  confirmed: { to: 'packed', label: 'Mark as packed' },
  packed: { to: 'shipped', label: 'Mark as shipped' },
  shipped: { to: 'delivered', label: 'Mark as delivered' },
};

function showPanel(render) {
  $('[data-order-panel]').hidden = false;
  $('[data-panel-overlay]').hidden = false;
  document.documentElement.style.overflow = 'hidden';
  render();
  $('[data-order-panel]').scrollTop = 0;
  $('[data-order-panel] [data-close-panel]')?.focus();
}
function openPanel(id) {
  openOrderId = id;
  openCustomerId = null;
  showPanel(renderPanel);
}
function openCustomerPanel(id) {
  openCustomerId = id;
  openOrderId = null;
  showPanel(renderCustomerPanel);
}
function closePanel() {
  openOrderId = null;
  openCustomerId = null;
  $('[data-order-panel]').hidden = true;
  $('[data-panel-overlay]').hidden = true;
  document.documentElement.style.overflow = '';
}

function renderPanel() {
  const o = orders.find((x) => x.id === openOrderId);
  const panel = $('[data-order-panel]');
  if (!o) return closePanel();
  const c = o.customer || {};
  const issues = priceIssues(o);
  const next = NEXT[o.status];
  const canCancel = ['new', 'confirmed', 'packed'].includes(o.status);
  const phoneDigits = String(c.phone || '').replace(/\D/g, '').slice(-10);
  panel.innerHTML = `
  <div class="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white px-6 py-4 print:static">
    <div><p class="text-lg font-medium text-ink">${esc(o.number)} ${badge(o.status)}</p><p class="text-xs">Placed ${esc(fmt(o.createdAt))} · Cash on delivery</p></div>
    <div class="flex items-center gap-1 print:hidden">
      <button type="button" class="rounded-md px-3 py-2 text-sm hover:bg-soft" data-print>Print slip</button>
      <button type="button" class="rounded-md px-3 py-2 text-2xl leading-none hover:bg-soft" data-close-panel aria-label="Close">×</button>
    </div>
  </div>
  <div class="space-y-6 px-6 py-5">
    ${issues.length ? `<div class="rounded-md border-l-4 border-red-600 bg-red-50 p-4 text-sm text-red-800"><p class="font-medium">⚠ Price check: this order doesn’t match your current prices</p><ul class="mt-1 list-disc pl-5">${issues.map((i) => `<li>${esc(i)}</li>`).join('')}</ul><p class="mt-1">Check with the customer before confirming.</p></div>` : '<p class="text-sm text-green-700 print:hidden">✓ Prices match your current price list.</p>'}

    <section>
      <h3 class="mb-2 font-medium text-ink">Items</h3>
      <ul class="divide-y divide-line rounded-md border border-line">${o.items.map((l) => `<li class="flex items-center gap-3 p-3">
        ${l.image ? `<img src="${esc(imageUrl(l.image))}" alt="" width="48" height="64" class="h-16 w-12 rounded object-cover print:hidden">` : ''}
        <div class="flex-1"><p class="text-ink">${esc(l.name)} <span class="text-xs">#${Number(l.id)}</span></p><p class="text-sm">Size: <span class="font-semibold text-ink">${esc(l.size || '—')}</span> · Qty: <span class="font-semibold text-ink">${Number(l.qty)}</span> · ${money(l.price)}</p></div>
        <p class="font-medium text-ink">${money(l.lineTotal)}</p></li>`).join('')}</ul>
      <dl class="mt-3 space-y-1 text-sm">
        <div class="flex justify-between"><dt>Subtotal</dt><dd class="text-ink">${money(o.subtotal)}</dd></div>
        ${o.coupon ? `<div class="flex justify-between"><dt>Coupon ${esc(o.coupon.code)} (${Number(o.coupon.pct)}%)</dt><dd class="text-ink">−${money(o.discount)}</dd></div>` : ''}
        <div class="flex justify-between"><dt>Shipping</dt><dd class="text-ink">${o.shipping ? money(o.shipping) : 'Free'}</dd></div>
        <div class="flex justify-between border-t border-line pt-1 text-base font-semibold text-ink"><dt>Total (to collect)</dt><dd>${money(o.total)}</dd></div>
      </dl>
    </section>

    <section>
      <div class="mb-2 flex items-center justify-between gap-3">
        <h3 class="font-medium text-ink">Customer &amp; delivery address</h3>
        <button type="button" class="rounded-md border border-line px-3 py-1 text-xs hover:border-brand print:hidden" data-copy-address>Copy address</button>
      </div>
      <div class="rounded-md bg-soft p-3">
        <p class="font-medium text-ink">${esc(`${c.firstName} ${c.lastName}`)}</p>
        <p class="text-sm text-ink">${esc(c.address)}<br>${esc(`${c.city}, ${c.state} – ${c.pincode}`)}<br>${esc(c.country)}</p>
      </div>
      <p class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <a class="text-brand underline" href="tel:${esc(c.phone)}">📞 ${esc(c.phone)}</a>
        ${phoneDigits.length === 10 ? `<a class="text-brand underline print:hidden" href="https://wa.me/91${esc(phoneDigits)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
        <a class="text-brand underline" href="mailto:${esc(c.email)}">${esc(c.email)}</a>
      </p>
      ${c.notes ? `<p class="mt-2 rounded-md bg-soft p-3 text-sm"><span class="font-medium text-ink">Customer note:</span> ${esc(c.notes)}</p>` : ''}
      ${o.cancelReason ? `<p class="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-800"><span class="font-medium">Cancellation reason:</span> ${esc(o.cancelReason)}</p>` : ''}
    </section>

    ${o.courier || o.trackingNumber ? `<section><h3 class="mb-1 font-medium text-ink">Shipping</h3><p class="text-sm">${esc(o.courier || '')} ${o.trackingNumber ? `· Tracking no. <span class="font-medium text-ink">${esc(o.trackingNumber)}</span>` : ''}</p></section>` : ''}

    ${next || canCancel ? `<section class="rounded-md bg-soft p-4 print:hidden">
      <h3 class="mb-3 font-medium text-ink">Next step</h3>
      ${o.status === 'packed' ? `<div class="mb-3 grid gap-3 sm:grid-cols-2">
        <label class="text-sm">Courier<input class="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-ink" name="courier" maxlength="60" value="${esc(o.courier || '')}" data-courier placeholder="e.g. Delhivery"></label>
        <label class="text-sm">Tracking number<input class="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-ink" name="tracking" maxlength="60" value="${esc(o.trackingNumber || '')}" data-tracking></label>
      </div>` : ''}
      <div class="flex flex-wrap gap-2">
        ${next ? `<button type="button" class="rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-ink disabled:opacity-60" data-advance="${next.to}">${next.label}</button>` : ''}
        ${canCancel ? `<button type="button" class="rounded-md border border-red-700 px-5 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50" data-cancel-start>Cancel order</button>` : ''}
      </div>
      ${canCancel ? `<div class="mt-3 hidden flex-wrap items-center gap-2" data-cancel-box>
        <select class="rounded-md border border-line bg-white px-3 py-2 text-sm text-ink" data-cancel-reason><option value="">Reason…</option>${CANCEL_REASONS.map((r) => `<option>${esc(r)}</option>`).join('')}</select>
        <button type="button" class="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800" data-cancel-confirm>Confirm cancellation</button>
      </div>` : ''}
    </section>` : ''}

    <section class="print:hidden">
      <h3 class="mb-2 font-medium text-ink">Internal note <span class="text-xs font-normal">(only owner &amp; staff see this)</span></h3>
      <textarea class="w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none" rows="3" maxlength="1000" data-note>${esc(o.adminNote || '')}</textarea>
      <button type="button" class="mt-2 rounded-md bg-ink px-4 py-2 text-sm text-white hover:bg-brand" data-save-note>Save note</button>
    </section>

    <section class="print:hidden">
      <h3 class="mb-2 font-medium text-ink">Timeline</h3>
      <ol class="space-y-2 border-l-2 border-line pl-4 text-sm">${[...(o.history || [])].reverse().map((h) => `<li><span class="font-medium text-ink">${esc(STATUS[h.status]?.label || h.status)}</span> · ${esc(fmt(h.at))} · <span class="text-xs">${h.by === 'customer' ? 'by customer' : `by ${esc(h.by)}`}</span></li>`).join('')}</ol>
    </section>
  </div>`;
}

async function changeStatus(o, to, extra = {}) {
  await updateDoc(doc(db, 'orders', o.id), {
    status: to,
    history: [...(o.history || []), { status: to, at: Timestamp.now(), by: me.email }],
    updatedAt: serverTimestamp(),
    ...extra,
  });
}

/* ------------------------------------------------------------------ events */
document.addEventListener('click', async (e) => {
  const t = e.target.closest('button, a, tr, [data-panel-overlay]');
  if (!t) return;
  const d = t.dataset;
  if (d.adminTab) { view = d.adminTab; render(); return; }
  if (d.gotoOrders) { view = 'orders'; orderTab = d.gotoOrders; render(); return; }
  if (d.orderTab) { orderTab = d.orderTab; renderOrders(); return; }
  if (d.openOrder) { openPanel(d.openOrder); return; }
  if (d.openCustomer) { openCustomerPanel(d.openCustomer); return; }
  if ('closePanel' in d || 'panelOverlay' in d) { closePanel(); return; }
  if ('print' in d) { window.print(); return; }
  if ('adminSignout' in d) { await signOut(auth); location.replace(link('/login/?next=/admin/')); return; }

  const o = orders.find((x) => x.id === openOrderId);
  if (!o) return;
  if ('copyAddress' in d) {
    const c = o.customer || {};
    const text = `${c.firstName} ${c.lastName}\n${c.address}\n${c.city}, ${c.state} - ${c.pincode}\n${c.country}\nPhone: ${c.phone}`;
    navigator.clipboard?.writeText(text).then(() => toast('Address copied'), () => toast('Couldn’t copy – please select the text instead'));
    return;
  }
  if (d.advance) {
    const extra = {};
    if (d.advance === 'shipped') {
      const courier = $('[data-courier]')?.value.trim() || '';
      const tracking = $('[data-tracking]')?.value.trim() || '';
      if (!courier) { toast('Please enter the courier name'); $('[data-courier]')?.focus(); return; }
      Object.assign(extra, { courier: courier.slice(0, 60), trackingNumber: tracking.slice(0, 60) });
    }
    t.disabled = true;
    try {
      await changeStatus(o, d.advance, extra);
      toast(`${o.number}: ${STATUS[d.advance].label}`);
    } catch {
      t.disabled = false;
      toast('Couldn’t update this order. It may have changed – please try again.');
    }
    return;
  }
  if ('cancelStart' in d) { $('[data-cancel-box]').classList.replace('hidden', 'flex'); return; }
  if ('cancelConfirm' in d) {
    const reason = $('[data-cancel-reason]').value;
    if (!reason) { toast('Please choose a reason'); return; }
    t.disabled = true;
    try {
      await changeStatus(o, 'cancelled', { cancelReason: reason });
      toast(`${o.number} cancelled`);
    } catch {
      t.disabled = false;
      toast('Couldn’t cancel this order.');
    }
    return;
  }
  if ('saveNote' in d) {
    try {
      await updateDoc(doc(db, 'orders', o.id), { adminNote: $('[data-note]').value.slice(0, 1000), updatedAt: serverTimestamp() });
      toast('Note saved');
    } catch {
      toast('Couldn’t save the note.');
    }
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && (openOrderId || openCustomerId)) closePanel();
  if (e.key === 'Enter' && e.target.matches('tr[data-open-order]')) openPanel(e.target.dataset.openOrder);
  if (e.key === 'Enter' && e.target.matches('tr[data-open-customer]')) openCustomerPanel(e.target.dataset.openCustomer);
});

/* ------------------------------------------------------------------ start */
async function canRead(path) {
  try {
    await getDoc(doc(db, ...path));
    return true;
  } catch {
    return false;
  }
}

async function start() {
  if (!configured) return gate('<p>The admin panel isn’t set up yet (Firebase is not configured).</p>');
  db = getFirestore(app);
  if (emulators?.firestore) {
    const [host, port] = emulators.firestore.split(':');
    connectFirestoreEmulator(db, host, Number(port));
  }
  const user = await currentUser();
  if (!user) {
    return gate(`<h1 class="text-2xl font-medium">Admin sign in</h1><p class="mt-2 text-sm">Sign in with your owner or staff account.</p><a href="${link('/login/?next=/admin/')}" class="btn-brand mt-6 w-full">Sign in</a>`);
  }
  await reload(user).catch(() => {});
  await user.getIdToken(true).catch(() => {}); // fresh token so a just-verified email counts
  if (!user.emailVerified) {
    return gate(`<h1 class="text-2xl font-medium">Verify your email first</h1><p class="mt-2 text-sm">For security, the admin panel only opens for verified emails. Open the link we emailed to <b>${esc(user.email || '')}</b> (check spam), then reload this page.</p><a href="${link('/account/')}" class="btn-outline mt-6 w-full">Go to my account to resend it</a>`);
  }
  me = { email: (user.email || '').toLowerCase(), role: (await canRead(['_access', 'owner'])) ? 'owner' : (await canRead(['_access', 'staff'])) ? 'staff' : '' };
  if (!me.role) {
    return gate(`<h1 class="text-2xl font-medium">No access</h1><p class="mt-2 text-sm">The account <b>${esc(user.email || '')}</b> doesn’t have access to the admin panel.</p><div class="mt-6 grid gap-3"><a href="${link('/')}" class="btn-brand">Go to the store</a><button type="button" class="btn-outline" data-admin-signout>Sign out</button></div>`);
  }

  $('[data-admin-gate]').hidden = true;
  $('[data-admin-user]').hidden = false;
  $('[data-admin-nav]').hidden = false;
  $('[data-admin-who]').textContent = user.email;
  $('[data-admin-role]').textContent = me.role === 'owner' ? 'Owner' : 'Staff';

  catalog = await fetch(link('/assets/data/products.json')).then((r) => r.json()).catch(() => []);
  render();
  // Live orders: new ones appear by themselves.
  onSnapshot(
    query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(1000)),
    (snap) => {
      orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const ids = new Set(orders.map((o) => o.id));
      if (knownIds) {
        const fresh = orders.filter((o) => !knownIds.has(o.id));
        if (fresh.length) toast(`🛍 New order ${fresh[0].number} – ${money(fresh[0].total)}`);
      }
      knownIds = ids;
      render();
    },
    () => gate('<p class="text-red-700">Lost connection to the orders database. Please reload the page.</p>')
  );
}

start().catch(() => gate('<p class="text-red-700">Something went wrong loading the admin panel. Please reload.</p>'));
