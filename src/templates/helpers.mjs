// Small helpers shared by all templates.

export const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const money = (n) => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatDate = (iso) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

export const strip = (html = '') => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

export const IMG = '/assets/images';

// Hidden spam trap: people never see or tick it, bots usually do. (Also understood by Web3Forms.)
export const honeypot = '<input type="checkbox" name="botcheck" tabindex="-1" autocomplete="off" aria-hidden="true" class="hidden">';

// Responsive <img> for product photos (3:4 portrait, generated at 400/800/1200px).
export function productImg(name, { alt = '', sizes = '(min-width: 1024px) 25vw, 50vw', eager = false, cls = '' } = {}) {
  const b = `${IMG}/products/${name}`;
  return `<img src="${b}-800.webp" srcset="${b}-400.webp 400w, ${b}-800.webp 800w, ${b}-1200.webp 1200w" sizes="${sizes}" width="1200" height="1600" alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" class="${cls}">`;
}

// Responsive <img> for 16:9 banners (generated at 768/1280/1920px).
export function bannerImg(name, { alt = '', sizes = '100vw', eager = false, cls = '' } = {}) {
  const b = `${IMG}/banners/${name}`;
  return `<img src="${b}-1280.webp" srcset="${b}-768.webp 768w, ${b}-1280.webp 1280w, ${b}-1920.webp 1920w" sizes="${sizes}" width="1920" height="1080" alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" class="${cls}">`;
}

// Picks the right helper from an image key ("IMG_xxxx" or "banner-x").
export const anyImg = (name, opts) => (name.startsWith('banner-') ? bannerImg(name, opts) : productImg(name, opts));
export const imgUrl = (name, w = 800) =>
  name.startsWith('banner-') ? `${IMG}/banners/${name}-${w === 800 ? 1280 : w}.webp` : `${IMG}/products/${name}-${w}.webp`;

// Inline SVG icons (stroke icons, 24px grid) – no icon font needed.
const P = {
  bag: '<path d="M6 7h12l1 13H5L6 7Z"/><path d="M9 7V6a3 3 0 0 1 6 0v1"/>',
  heart: '<path d="M19.5 12.57 12 20l-7.5-7.43A5 5 0 1 1 12 6.01a5 5 0 1 1 7.5 6.56Z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronRight: '<path d="m9 6 6 6-6 6"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
  pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  ruler: '<path d="M3 15.5 15.5 3 21 8.5 8.5 21 3 15.5Z"/><path d="m7 12 2 2M10 9l2 2M13 6l2 2"/>',
  user: '<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="10" r="3.2"/><path d="M6.2 18.6c1.3-2.2 3.4-3.4 5.8-3.4s4.5 1.2 5.8 3.4"/>',
};
// Filled brand icons
const F = {
  facebook: '<path d="M12 2a10 10 0 0 0-1.56 19.88v-7H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v7A10 10 0 0 0 12 2Z"/>',
  linkedin: '<path d="M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm3.3 15V10H4.8v8h2.5ZM6 8.9a1.45 1.45 0 1 0 0-2.9 1.45 1.45 0 0 0 0 2.9ZM19.2 18v-4.4c0-2.36-.5-4.17-3.26-4.17-1.32 0-2.2.72-2.57 1.41h-.04V10h-2.4v8h2.5v-3.96c0-1.04.2-2.05 1.49-2.05 1.27 0 1.29 1.19 1.29 2.12V18h2.99Z"/>',
  x: '<path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.77L17.75 3Zm-1.08 16.17h1.7L7.4 4.73H5.58l11.09 14.44Z"/>',
  whatsapp: '<path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.9s.7-2.1 1-2.4c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.5-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.2Z"/>',
};

export function icon(name, cls = 'h-5 w-5') {
  if (F[name]) return `<svg class="${cls}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${F[name]}</svg>`;
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name]}</svg>`;
}
