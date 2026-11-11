// Admin panel shell (/admin/). Everything inside is filled in by src/js/admin.js after the role check.
// The page itself contains no data – orders/customers are only loaded for owner/staff accounts,
// and the database security rules enforce that again on every request.
import { IMG } from './helpers.mjs';

export function admin(ctx) {
  const tab = (id, label) =>
    `<button type="button" role="tab" data-admin-tab="${id}" aria-selected="false" class="relative whitespace-nowrap border-b-2 border-transparent py-3 text-sm font-medium text-muted transition hover:text-ink aria-selected:border-brand aria-selected:text-ink">${label}<span class="ml-1.5 hidden rounded-full bg-brand px-1.5 py-0.5 text-[10px] text-white" data-tab-count></span></button>`;
  const body = `<div class="min-h-screen" data-admin>
  <header class="sticky top-0 z-30 border-b border-line bg-white print:hidden">
    <div class="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-4">
      <a href="/" class="flex items-center gap-3" title="View store">
        <img src="${IMG}/brand/logo-240.webp" width="80" height="44" alt="Paloveenaa" class="h-10 w-auto">
        <span class="text-xs font-medium uppercase tracking-[0.25em] text-ink">Admin</span>
      </a>
      <div class="flex items-center gap-3 text-sm" data-admin-user hidden>
        <span class="hidden text-ink md:inline" data-admin-who></span>
        <span class="rounded bg-brand-light px-2 py-0.5 text-xs font-medium text-brand" data-admin-role></span>
        <a href="/" class="hidden underline underline-offset-2 sm:inline">View store</a>
        <button type="button" class="rounded-md bg-ink px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-white hover:bg-brand" data-admin-signout>Sign out</button>
      </div>
    </div>
    <nav class="mx-auto max-w-[1400px] px-4" data-admin-nav hidden>
      <div class="no-scrollbar flex gap-6 overflow-x-auto" role="tablist" aria-label="Admin sections">
        ${tab('dashboard', 'Dashboard')}${tab('orders', 'Orders')}${tab('customers', 'Customers')}${tab('team', 'Team &amp; access')}
      </div>
    </nav>
  </header>

  <main class="mx-auto max-w-[1400px] px-4 py-6 print:hidden" id="main">
    <div data-admin-gate class="mx-auto mt-16 max-w-md rounded-lg bg-white p-8 text-center shadow-sm"><p>Checking your access…</p></div>
    <section data-view="dashboard" hidden></section>
    <section data-view="orders" hidden></section>
    <section data-view="customers" hidden></section>
    <section data-view="team" hidden></section>
  </main>

  <div class="fixed inset-0 z-40 bg-black/40 print:hidden" data-panel-overlay hidden></div>
  <aside class="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto bg-white shadow-2xl print:static print:max-w-none print:shadow-none" data-order-panel hidden aria-label="Order details" role="dialog" aria-modal="true"></aside>
</div>`;
  return { meta: { title: 'Admin', noindex: true, bare: true, referrer: 'no-referrer', scripts: ['admin.js'] }, body };
}
