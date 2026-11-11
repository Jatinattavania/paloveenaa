// Customer side of orders:
//   • Checkout   – sign-in required; details pre-filled from the profile; order saved to the database.
//   • Confirmation (/order-received/?id=…) – reads the saved order.
//   • My orders  – on the account page: status, tracking, cancel before packing.
// The database security rules decide what is allowed (see src/firestore.rules); this file is just the UI.
import { configured, link, currentUser } from './fb.js';
import { db, doc, getDoc, getDocs, setDoc, updateDoc, collection, query, where, serverTimestamp, Timestamp, loadProfile } from './db.js';
import { cart, cartSummary, money } from './store.js';
import { esc } from './ui.js';
import { send, hasService, validate } from './forms.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const STATUS = {
  new: { label: 'Order placed', cls: 'bg-sky-100 text-sky-800' },
  confirmed: { label: 'Confirmed', cls: 'bg-indigo-100 text-indigo-800' },
  packed: { label: 'Packed', cls: 'bg-amber-100 text-amber-800' },
  shipped: { label: 'Shipped', cls: 'bg-violet-100 text-violet-800' },
  delivered: { label: 'Delivered', cls: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-800' },
};
const badge = (s) => `<span class="inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS[s]?.cls || 'bg-soft text-ink'}">${esc(STATUS[s]?.label || s)}</span>`;
const when = (ts) => (ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null);
const fmtDate = (ts) => when(ts)?.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) || '—';
const clip = (v, max) => String(v ?? '').trim().slice(0, max);
const CANCEL_REASONS = ['Ordered by mistake', 'Want a different size', 'Want a different product', 'Delivery is taking too long', 'Other'];

function orderText(o, id) {
  const c = o.customer;
  return `New order ${o.number}  (id ${id})

ITEMS
${o.items.map((l) => `• ${l.name}${l.size ? ` – SIZE ${l.size}` : ''} (product #${l.id}) — ${l.qty} × ${money(l.price)} = ${money(l.lineTotal)}`).join('\n')}

Subtotal: ${money(o.subtotal)}${o.coupon ? `\nCoupon ${o.coupon.code} (${o.coupon.pct}% off): −${money(o.discount)}` : ''}
Shipping: ${o.shipping ? money(o.shipping) : 'Free'}
TOTAL: ${money(o.total)} – Cash on delivery

CUSTOMER
${c.firstName} ${c.lastName} · ${c.phone} · ${c.email}
${c.address}, ${c.city}, ${c.state} ${c.pincode}, ${c.country}
${c.notes ? `\nNOTES: ${c.notes}` : ''}

Open the admin panel to confirm it.`;
}

/* ------------------------------------------------------------------ checkout */
async function initCheckout(root) {
  const form = $('[data-checkout-form]', root);
  const gate = $('[data-checkout-signin]', root);
  const status = $('[data-form-status]', root);
  const user = configured ? await currentUser() : null;
  if (!user) {
    // Sign-in needed: show the sign-in box (form stays hidden – see renderCheckoutSummary in ui.js).
    gate.hidden = false;
    return;
  }
  delete root.dataset.needsSignin;
  gate.hidden = true;
  form.hidden = !(await cartSummary()).lines.length;

  // Pre-fill from the saved profile.
  const profile = await loadProfile(user.uid);
  const set = (name, v) => { if (v && form[name] && !form[name].value) form[name].value = v; };
  set('firstName', profile?.firstName);
  set('lastName', profile?.lastName);
  set('phone', (profile?.phone || user.phoneNumber || '').replace(/^\+91/, ''));
  set('email', user.email);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.botcheck?.checked) return; // spam bot
    if (!validate(form)) return;
    const s = await cartSummary();
    if (!s.lines.length) return;
    const btn = $('[type=submit]', form);
    btn.disabled = true;
    btn.textContent = 'Placing order…';
    const f = Object.fromEntries(new FormData(form).entries());
    const now = new Date();
    const order = {
      number: `PV-${now.toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
      uid: user.uid,
      customer: {
        firstName: clip(f.firstName, 50), lastName: clip(f.lastName, 50), phone: clip(f.phone, 20), email: clip(f.email, 254),
        address: clip(f.address, 300), city: clip(f.city, 80), state: clip(f.state, 80), pincode: clip(f.pincode, 10),
        country: 'India', notes: clip(f.notes, 500),
      },
      items: s.lines.map((l) => ({ id: l.id, name: l.name, size: l.size || '', qty: l.qty, price: l.price, lineTotal: l.lineTotal, image: l.image })),
      subtotal: s.subtotal,
      discount: s.discount,
      coupon: s.coupon ? { code: s.coupon.code, pct: s.coupon.pct } : null,
      shipping: s.shipping,
      total: s.total,
      paymentMethod: 'cod',
      status: 'new',
      history: [{ status: 'new', at: Timestamp.now(), by: 'customer' }],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    try {
      const ref = doc(collection(db, 'orders'));
      await setDoc(ref, order);
      cart.clear();
      // Optional email to the shop (only if a form service is set up in settings.json).
      if (hasService()) send(`New order ${order.number} – ${money(order.total)}`, { name: `${order.customer.firstName} ${order.customer.lastName}`, email: order.customer.email, replyto: order.customer.email }, orderText(order, ref.id)).catch(() => {});
      location.href = link(`/order-received/?id=${encodeURIComponent(ref.id)}`);
    } catch {
      btn.disabled = false;
      btn.textContent = 'Place order';
      status.textContent = 'Sorry, we couldn’t place your order. Please check your connection and try again.';
      status.className = 'mt-3 text-sm text-red-700';
    }
  });
}

/* ------------------------------------------------------------------ order confirmation */
async function initOrderReceived(root) {
  const id = new URLSearchParams(location.search).get('id') || '';
  const user = configured ? await currentUser() : null;
  const msg = (html) => (root.innerHTML = `<p class="py-10 text-center">${html}</p>`);
  if (!/^[A-Za-z0-9]{10,40}$/.test(id)) return msg(`There is no order to show. <a href="${link('/shop/')}" class="text-brand underline">Continue shopping</a>`);
  if (!user) return msg(`Please <a href="${link(`/login/?next=/account/`)}" class="text-brand underline">sign in</a> to see your order.`);
  let o;
  try {
    const snap = await getDoc(doc(db, 'orders', id));
    if (!snap.exists()) throw new Error('missing');
    o = snap.data();
  } catch {
    return msg(`We couldn’t find this order. You can see all your orders in <a href="${link('/account/')}" class="text-brand underline">My account</a>.`);
  }
  root.innerHTML = `<div class="rounded-lg border-t-[3px] border-brand bg-[#F8F8F8] p-6 text-ink md:p-8">
    <p class="text-xl font-medium">Thank you! Your order has been placed.</p>
    <p class="mt-2 text-muted">We’ll confirm it shortly. You can follow its progress any time in <a href="${link('/account/')}" class="text-brand underline">My account → My orders</a>.</p>
  </div>
  <dl class="mt-8 grid gap-4 text-sm sm:grid-cols-4">
    <div><dt class="uppercase tracking-[0.12em]">Order number</dt><dd class="mt-1 text-lg font-medium text-ink">${esc(o.number)}</dd></div>
    <div><dt class="uppercase tracking-[0.12em]">Date</dt><dd class="mt-1 font-medium text-ink">${esc(fmtDate(o.createdAt))}</dd></div>
    <div><dt class="uppercase tracking-[0.12em]">Total</dt><dd class="mt-1 text-lg font-medium text-ink">${money(o.total)}</dd></div>
    <div><dt class="uppercase tracking-[0.12em]">Payment</dt><dd class="mt-1 font-medium text-ink">Cash on delivery</dd></div>
  </dl>
  <h2 class="mb-4 mt-10 text-2xl font-medium">Order details</h2>
  <ul class="divide-y divide-line border-y border-line">${o.items.map((l) => `<li class="flex justify-between gap-4 py-3"><span class="text-ink">${esc(l.name)}${l.size ? ` – Size ${esc(l.size)}` : ''} × ${Number(l.qty) || 0}</span><span class="text-ink">${money(l.lineTotal)}</span></li>`).join('')}</ul>
  <p class="mt-6 text-sm"><span class="font-medium text-ink">Delivering to:</span> ${esc(`${o.customer.firstName} ${o.customer.lastName}, ${o.customer.address}, ${o.customer.city}, ${o.customer.state} ${o.customer.pincode}`)}</p>
  <div class="mt-10 flex flex-wrap gap-3"><a href="${link('/account/')}" class="btn-brand">View my orders</a><a href="${link('/shop/')}" class="btn-outline">Continue shopping</a></div>`;
}

/* ------------------------------------------------------------------ my orders (account page) */
async function initMyOrders(box) {
  const user = configured ? await currentUser() : null;
  if (!user) return;
  let orders = [];
  const load = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'orders'), where('uid', '==', user.uid)));
      orders = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (when(b.createdAt) || 0) - (when(a.createdAt) || 0));
      render();
    } catch {
      box.innerHTML = '<p class="py-4 text-sm text-red-700">Couldn’t load your orders. Please refresh the page.</p>';
    }
  };
  const render = () => {
    if (!orders.length) {
      box.innerHTML = `<p class="py-4 text-sm">You haven’t placed any orders yet. <a href="${link('/shop/')}" class="text-brand underline">Start shopping</a></p>`;
      return;
    }
    box.innerHTML = `<ul class="space-y-4">${orders
      .map((o) => {
        const canCancel = ['new', 'confirmed'].includes(o.status);
        return `<li class="rounded-md bg-white p-4 sm:p-5" data-order="${esc(o.id)}">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="font-medium text-ink">${esc(o.number)} ${badge(o.status)}</p>
          <p class="text-sm">${esc(fmtDate(o.createdAt))}</p>
        </div>
        <p class="mt-2 text-sm">${o.items.map((l) => `${esc(l.name)}${l.size ? ` (${esc(l.size)})` : ''} × ${Number(l.qty) || 0}`).join(', ')}</p>
        <p class="mt-1 text-sm">Total <span class="font-medium text-ink">${money(o.total)}</span> · Cash on delivery</p>
        ${o.status === 'shipped' && (o.courier || o.trackingNumber) ? `<p class="mt-2 text-sm">Shipped with <span class="font-medium text-ink">${esc(o.courier || '—')}</span>${o.trackingNumber ? ` · Tracking no. <span class="font-medium text-ink">${esc(o.trackingNumber)}</span>` : ''}</p>` : ''}
        ${o.status === 'cancelled' && o.cancelReason ? `<p class="mt-2 text-sm">Reason: ${esc(o.cancelReason)}</p>` : ''}
        ${canCancel ? `<div class="mt-3" data-cancel-area>
          <button type="button" class="text-sm text-red-700 underline underline-offset-2" data-cancel-open>Cancel order</button>
          <form class="mt-3 hidden flex-wrap items-center gap-2" data-cancel-form>
            <label class="sr-only" for="reason-${esc(o.id)}">Reason</label>
            <select id="reason-${esc(o.id)}" name="reason" required class="rounded-md border border-line bg-white px-3 py-2 text-sm text-ink">
              <option value="">Why are you cancelling?</option>${CANCEL_REASONS.map((r) => `<option>${esc(r)}</option>`).join('')}
            </select>
            <button type="submit" class="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800">Confirm cancellation</button>
            <button type="button" class="text-sm underline" data-cancel-close>Keep order</button>
          </form>
        </div>` : ''}
      </li>`;
      })
      .join('')}</ul>`;
  };

  box.addEventListener('click', (e) => {
    const area = e.target.closest('[data-cancel-area]');
    if (!area) return;
    if (e.target.matches('[data-cancel-open]')) { $('[data-cancel-form]', area).classList.replace('hidden', 'flex'); e.target.hidden = true; }
    if (e.target.matches('[data-cancel-close]')) { $('[data-cancel-form]', area).classList.replace('flex', 'hidden'); $('[data-cancel-open]', area).hidden = false; }
  });
  box.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const id = form.closest('[data-order]').dataset.order;
    const o = orders.find((x) => x.id === id);
    if (!o || !form.reason.value) return form.reason.focus();
    $('[type=submit]', form).disabled = true;
    try {
      await updateDoc(doc(db, 'orders', id), {
        status: 'cancelled',
        cancelReason: clip(form.reason.value, 300),
        history: [...o.history, { status: 'cancelled', at: Timestamp.now(), by: 'customer' }],
        updatedAt: serverTimestamp(),
      });
      await load();
    } catch {
      $('[type=submit]', form).disabled = false;
      alert('Sorry, this order can no longer be cancelled online – it may already be packed. Please contact us.');
      await load();
    }
  });
  await load();
}

/* ------------------------------------------------------------------ boot */
const checkout = $('[data-checkout-page]');
if (checkout) initOrdersSafely(() => initCheckout(checkout));
const received = $('[data-order-received]');
if (received) initOrdersSafely(() => initOrderReceived(received));
const mine = $('[data-my-orders]');
if (mine) initOrdersSafely(() => initMyOrders(mine));

function initOrdersSafely(fn) {
  fn().catch((err) => console.error('Orders:', err?.code || err?.message || err));
}
