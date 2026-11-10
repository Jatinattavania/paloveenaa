// Builds the static website into /website from the data in src/data and the templates in src/templates.
// Run with: npm run build   (this also rebuilds the Tailwind CSS)
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { layout } from './templates/layout.mjs';
import * as P from './templates/pages.mjs';
import { productUrl, priceOf } from './templates/components.mjs';
import { imgUrl } from './templates/helpers.mjs';

const SRC = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(SRC, '..', 'website');
const read = (f) => JSON.parse(readFileSync(path.join(SRC, 'data', f), 'utf8'));

const settings = read('settings.json');
const catalog = read('products.json');
const blog = read('blog.json');
const pages = read('pages.json');
const policies = read('policies.json');
const v = Date.now().toString(36); // cache-busting version for CSS/JS

// When the site is served from a sub-folder (GitHub Pages: /paloveenaa) set BASE_PATH=/paloveenaa.
// All site-relative links/images are then prefixed, and pages are marked noindex (it's a preview copy).
const BASE = (process.env.BASE_PATH || '').replace(/\/+$/, '');
const withBase = (html) =>
  !BASE
    ? html
    : html
        .replace(/(\s(?:href|src|action)=")\/(?!\/)/g, `$1${BASE}/`)
        .replace(/(\ssrcset=")([^"]+)"/g, (_, attr, list) => attr + list.replace(/(^|,\s*)\/(?!\/)/g, `$1${BASE}/`) + '"');

// Content-Security-Policy: only this site plus the exact Google/Firebase services the login needs may run code
// or be contacted. This is the main defence against injected scripts (XSS) stealing a login session.
const FIREBASE_VERSION = '13.1.0'; // keep in sync with package.json and the imports in src/js/auth.js
const fb = settings.firebase || {};
const originOf = (u) => { try { return new URL(u).origin; } catch { return ''; } };
const cspDirectives = {
  'default-src': ["'self'"],
  'script-src': ["'self'", 'https://www.google.com/recaptcha/', 'https://www.gstatic.com/recaptcha/'],
  'style-src': ["'self'", "'unsafe-inline'"], // reCAPTCHA injects inline styles
  'img-src': ["'self'", 'data:', 'https://www.gstatic.com/recaptcha/'],
  'font-src': ["'self'"],
  'connect-src': ["'self'", 'https://identitytoolkit.googleapis.com', 'https://securetoken.googleapis.com', 'https://www.google.com/recaptcha/',
    'https://api.web3forms.com', originOf(settings.forms.endpoint), fb.emulator ? `http://${fb.emulator.replace(/^https?:\/\//, '')}` : ''].filter(Boolean),
  'frame-src': ['https://www.google.com/recaptcha/', 'https://recaptcha.google.com/recaptcha/', fb.authDomain ? `https://${fb.authDomain}` : ''].filter(Boolean),
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
};
const csp = Object.entries(cspDirectives).map(([k, list]) => `${k} ${list.join(' ')}`).join('; ');

// Remove previously generated HTML (keeps /assets).
const clean = (dir) => {
  for (const f of readdirSync(dir)) {
    const full = path.join(dir, f);
    if (f === 'assets') continue;
    if (statSync(full).isDirectory()) { clean(full); if (!readdirSync(full).length) rmSync(full, { recursive: true }); }
    else if (f.endsWith('.html')) rmSync(full);
  }
};
mkdirSync(OUT, { recursive: true });
clean(OUT);

const written = [];
function page(urlPath, render, { sitemap = true } = {}) {
  const ctx = { settings, catalog, blog, pages, policies, v, csp, path: urlPath };
  const { meta, body } = render(ctx);
  if (BASE) meta.noindex = true;
  const file = urlPath === '/404' ? path.join(OUT, '404.html') : path.join(OUT, urlPath, 'index.html');
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, withBase(layout(ctx, meta, body)));
  if (sitemap && !meta.noindex) written.push(urlPath);
}

page('/', P.home);
page('/shop/', (c) => P.shop(c));
for (const cat of catalog.categories) page(`/product-category/${cat.slug}/`, (c) => P.shop(c, cat));
for (const p of catalog.products) page(productUrl(p), (c) => P.product(c, p));
page('/about/', P.about);
page('/faq/', P.faq);
page('/contact/', P.contact);
page('/blog/', P.blogIndex);
for (const post of blog.posts) page(`/blog/${post.slug}/`, (c) => P.blogPost(c, post));
page('/cart/', P.cart);
page('/checkout/', P.checkout);
page('/order-received/', P.orderReceived);
page('/wishlist/', P.wishlist);
page('/login/', P.login);
page('/register/', P.register);
page('/account/', P.account);
page('/privacy-policy/', (c) => P.policy(c, 'privacy-policy'));
page('/refund-returns/', (c) => P.policy(c, 'refund-returns'));
page('/404', P.notFound, { sitemap: false });

// Static assets: hand-written JS + font.
cpSync(path.join(SRC, 'js'), path.join(OUT, 'assets', 'js'), { recursive: true });
cpSync(path.join(SRC, 'fonts'), path.join(OUT, 'assets', 'fonts'), { recursive: true });
// Version the module imports too, so browsers never mix old and new cached JS files.
for (const f of readdirSync(path.join(OUT, 'assets', 'js'))) {
  const file = path.join(OUT, 'assets', 'js', f);
  writeFileSync(file, readFileSync(file, 'utf8').replace(/from '(\.\/[\w-]+\.js)'/g, `from '$1?v=${v}'`));
}

// Firebase SDK, self-hosted (no third-party script CDN). The auth module normally imports the app module
// from gstatic.com – point it at our local copy instead.
const vendorDir = path.join(OUT, 'assets', 'vendor', `firebase-${FIREBASE_VERSION}`);
mkdirSync(vendorDir, { recursive: true });
const fbPkg = path.join(SRC, '..', 'node_modules', 'firebase');
for (const f of ['firebase-app.js', 'firebase-auth.js']) {
  const code = readFileSync(path.join(fbPkg, f), 'utf8').replaceAll(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`, './firebase-app.js');
  if (/from\s*["']https?:/.test(code)) throw new Error(`${f} still imports remote code`);
  writeFileSync(path.join(vendorDir, f), code);
}

// Settings the browser needs (cart, coupons, forms).
const clientConfig = {
  base: BASE,
  siteName: settings.siteName,
  email: settings.email,
  whatsapp: settings.whatsapp,
  currency: catalog.currency,
  shop: settings.shop,
  forms: { endpoint: settings.forms.endpoint, web3formsKey: settings.forms.web3formsKey },
  firebase: { apiKey: fb.apiKey, authDomain: fb.authDomain, projectId: fb.projectId, appId: fb.appId, ...(fb.emulator ? { emulator: fb.emulator } : {}) },
};
writeFileSync(path.join(OUT, 'assets', 'js', 'config.js'), `// Generated by src/build.mjs from src/data/settings.json – edit that file instead.\nexport default ${JSON.stringify(clientConfig, null, 2)};\n`);

// Product data for quick view / wishlist / cart price checks.
mkdirSync(path.join(OUT, 'assets', 'data'), { recursive: true });
writeFileSync(
  path.join(OUT, 'assets', 'data', 'products.json'),
  JSON.stringify(catalog.products.map((p) => ({
    id: p.id, slug: p.slug, name: p.name, url: BASE + productUrl(p), price: priceOf(p), regularPrice: p.regularPrice, inStock: p.inStock,
    image: p.image, gallery: p.gallery, categories: p.categories.map((s) => catalog.categories.find((c) => c.slug === s)?.name).filter(Boolean),
    images: [p.image, ...p.gallery].map((i) => BASE + imgUrl(i, 800)),
  })))
);

// SEO files.
const today = new Date().toISOString().slice(0, 10);
writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${written.map((u) => `  <url><loc>${settings.siteUrl}${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nDisallow: /cart/\nDisallow: /checkout/\nDisallow: /order-received/\nDisallow: /wishlist/\nDisallow: /login/\nDisallow: /register/\nDisallow: /account/\n\nSitemap: ${settings.siteUrl}/sitemap.xml\n`);

// Apache/LiteSpeed (Hostinger) config: old WordPress URLs -> new URLs, caching, compression.
const redirects = [
  ['^my-shop/?$', '/shop/'],
  ['^privacy-policy-2/?$', '/privacy-policy/'],
  ['^refund_returns-2/?$', '/refund-returns/'],
  ['^term-and-condition/?$', '/refund-returns/'],
  ['^home-4/?$', '/'],
  ['^my-account/?$', '/account/'],
  ['^yith-compare/?$', '/shop/'],
  ...blog.posts.map((p) => [`^archives/${p.id}/?$`, `/blog/${p.slug}/`]),
  ...blog.posts.map((p) => [`^${p.slug}/?$`, `/blog/${p.slug}/`]),
  ['^wp-(admin|login\\.php).*$', '/'],
];
writeFileSync(path.join(OUT, '.htaccess'), `# Generated by src/build.mjs
Options -Indexes
DirectoryIndex index.html
ErrorDocument 404 /404.html

<IfModule mod_rewrite.c>
RewriteEngine On
# Force HTTPS
RewriteCond %{HTTPS} off
RewriteCond %{HTTP:X-Forwarded-Proto} !https
RewriteRule ^(.*)$ https://%{HTTP_HOST}/$1 [R=301,L]
# Old WordPress addresses -> new pages
${redirects.map(([from, to]) => `RewriteRule ${from} ${to} [R=301,L]`).join('\n')}
</IfModule>

<IfModule mod_deflate.c>
AddOutputFilterByType DEFLATE text/html text/css application/javascript application/json image/svg+xml text/xml text/plain
</IfModule>

<IfModule mod_expires.c>
ExpiresActive On
ExpiresByType text/html "access plus 0 seconds"
ExpiresByType text/css "access plus 1 year"
ExpiresByType application/javascript "access plus 1 year"
ExpiresByType application/json "access plus 1 hour"
ExpiresByType image/webp "access plus 1 year"
ExpiresByType image/png "access plus 1 year"
ExpiresByType image/svg+xml "access plus 1 year"
ExpiresByType font/woff2 "access plus 1 year"
</IfModule>

<IfModule mod_headers.c>
<FilesMatch "\\.(webp|png|svg|woff2)$">
Header set Cache-Control "public, max-age=31536000, immutable"
</FilesMatch>
Header always set X-Content-Type-Options "nosniff"
Header always set Referrer-Policy "strict-origin-when-cross-origin"
# Security: CSP (+ block other sites from framing ours = clickjacking), force HTTPS for a year, limit browser features
Header always set Content-Security-Policy "${csp}; frame-ancestors 'none'; upgrade-insecure-requests"
Header always set X-Frame-Options "DENY"
Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
Header always set Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
Header always set Cross-Origin-Opener-Policy "same-origin-allow-popups"
</IfModule>

# Block access to hidden files (e.g. .git, .env) if any are ever uploaded
<FilesMatch "^\\.(?!htaccess$)">
Require all denied
</FilesMatch>
`);

console.log(`Built ${written.length + 1} pages into website/ (version ${v})${BASE ? ` for sub-folder ${BASE}` : ''}`);
