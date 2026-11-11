# Paloveenaa website

The Paloveenaa store, rebuilt from WordPress as a fast static site using **HTML + Tailwind CSS + JavaScript**.
All content came from the WordPress database: pages, products, prices, categories, images, blog posts and policies.

## Folders

| Folder / file | What it is |
|---|---|
| `website/` | **The finished website.** Upload the *contents* of this folder to your hosting (e.g. Hostinger `public_html`). |
| `src/` | The source the website is built from. Edit things here, then rebuild. |
| `src/data/` | All content: `products.json`, `blog.json`, `pages.json` (page text), `policies.json`, `settings.json` (email, banner text, coupons, forms). |
| `src/templates/` | The HTML layout and page designs (header, footer, product card, every page). |
| `src/js/` | Browser JavaScript: cart, wishlist, quick view, sliders, checkout, forms, `auth.js` (mobile login). |
| `src/styles/input.css` | Tailwind CSS source (brand colours are in `tailwind.config.js`). |
| `src/images/` | Original photos. `npm run images` turns them into small WebP files. |
| `wordpress/` | **Everything from the old WordPress site**: files (`backup/`), database dump (`.sql`), original zips, and the local PHP/MariaDB used to preview it. |
| `coming-soon/` | The old "Coming Soon" holding page. |

## Preview locally

- New site: double-click **`start-website.cmd`**, then open http://localhost:8080
- Old WordPress site: double-click **`wordpress/start-wordpress.cmd`**, then open http://localhost:8000

Use the local server rather than opening the HTML files directly, because the links are site-relative (`/shop/`).

## Making changes

The easiest way is **`npm run dev`**. It serves the site at http://localhost:8080 and rebuilds automatically whenever you save a file in `src/`. Just refresh the browser.

Without dev mode:
1. Edit a file in `src/data/` (text, prices, products) or `src/templates/` (design).
2. Run `npm run build` in this folder. This regenerates every page in `website/` and the CSS.
3. If you added or replaced photos in `src/images/`, run `npm run images` first.

**Sizes and size chart:** in `src/data/products.json`:
- Each product has `"sizes"` (e.g. `["XS","S","M","L","XL","XXL"]`) and `"soldOutSizes"` (e.g. `["XXL"]`, which shows that size greyed out).
- The `"sizeChart"` section at the top holds the measurements in inches (cm is calculated automatically) and the "How to measure" tips. It's a standard Indian women's ethnic-wear chart, so adjust it to your garments.

**To add a product:** put its photos in `src/images/products/` (e.g. `IMG_3001.jpg`), run `npm run images`, then add an entry to `src/data/products.json` (copy an existing one and change `id`, `slug`, `name`, prices, `categories`, `image`, `gallery`). Run `npm run build`.

## Orders, contact form and newsletter

Static hosting has no server to receive orders, so these are sent in one of two ways (set in `src/data/settings.json` → `forms`):

- **Default (nothing configured):** the customer's email app opens with the order or message pre-filled to `info@paloveenaa.com`, and the customer presses Send.
- **Recommended:** create a free form at [web3forms.com](https://web3forms.com) and paste the access key into `web3formsKey`, or a [Formspree](https://formspree.io) URL into `endpoint`. Orders and messages then arrive in your inbox automatically. Rebuild afterwards.

No payment is taken on the website. Checkout tells the customer you will contact them to confirm the order and arrange payment. (The WordPress shop had no payment method enabled either.) To take online payments later, Razorpay Payment Links or Shopify Buy Buttons can be added.

## Customer accounts (email & password + mobile OTP)

Pages: `/register/` (create account), `/login/` and `/account/` (the person icon in the header).

- **Create account:** first name, last name, email, mobile, password and re-entered password. The password needs 8+ characters with upper- and lower-case letters and a number. The button stays disabled until everything is valid and the policies are accepted.
  - The customer must then verify their mobile with an SMS code. The account is only created after that.
  - **The same mobile or email can't be registered twice.** A mobile that already has an account is refused, and so is an email that's already used; no half-made account is left behind.
  - A verification email is sent.
  - Mobile OTP login only works for registered numbers; unknown numbers are asked to create an account.
- **Sign in:** two tabs, **Email & password** (with "Forgot password?") or **Mobile OTP**. Both open the same account once the mobile is verified.

This uses **Firebase Authentication** (Google). Passwords are hashed and checked only on Firebase's servers. SMS codes are generated and verified there too, and Firebase manages the sessions. Until it's configured, the pages show "Login is being set up".

### One-time setup (about 15 minutes)

1. Go to https://console.firebase.google.com, create a project (e.g. "paloveenaa"), and switch it to the **Blaze (pay-as-you-go)** plan. Phone sign-in needs billing, and each SMS is charged (check current India pricing in the console).
2. **Authentication → Sign-in method:** enable **Email/Password** (leave "Email link" off) and **Phone**.
   - Under **Authentication → Settings → User actions**, keep **Email enumeration protection** ON.
   - Under **Password policy**, require upper case, lower case, a number and a minimum length of 8, to match the site.
3. **Authentication → Settings → SMS region policy → Allow** only **India**. This blocks "SMS pumping" fraud, where bots trigger expensive international SMS.
4. **Authentication → Settings → Authorized domains:** add `paloveenaa.com` and `www.paloveenaa.com`. `localhost` is there for testing.
5. **Project settings → Your apps → Add app → Web.** Copy `apiKey`, `authDomain`, `projectId` and `appId` into `src/data/settings.json` → `firebase`, then run `npm run build`. These are public identifiers, not passwords.
6. **Lock the API key:** Google Cloud Console → APIs & Services → Credentials → the "Browser key".
   - *Application restrictions → Websites:* `https://paloveenaa.com/*`, `https://www.paloveenaa.com/*`, `http://localhost:8080/*`.
   - *API restrictions:* Identity Toolkit API and Token Service API.
7. **Billing → Budgets & alerts:** set a monthly budget with email alerts, so unusual SMS usage is noticed immediately.
8. *(Optional)* **Authentication → Sign-in method → Phone → Phone numbers for testing:** add a fake number and code for testing without sending real SMS.

### Professional-looking account emails

By default Firebase sends from `noreply@<project>.firebaseapp.com`, signs off as the project ID, and often lands in spam. To brand the emails:

1. **Project settings → General → Public-facing name:** `Paloveenaa`.
2. **Authentication → Templates → Email address verification → ✏️ edit.** Repeat for **Password reset**.
   - **Sender name** `Paloveenaa`, **Reply-to** `info@paloveenaa.com`, **Subject** e.g. `Confirm your email for Paloveenaa`.
   - **From → Customize domain → `paloveenaa.com`:** add the DNS records Firebase shows in Hostinger hPanel → Domains → DNS. Emails then come from `noreply@paloveenaa.com` with SPF/DKIM, which is the main fix for spam.
   - **Customize action URL → `https://paloveenaa.com/auth/action/`**, only once the new site is live on paloveenaa.com. Links then open the site's own branded page for "Email verified" and "Set a new password".
3. A fully designed email with your logo and a big button, like Amazon's, needs the site to send its own emails. That means a Firebase Cloud Function (Blaze plan) plus an email service such as Resend, Brevo or Zoho ZeptoMail.

### How it is secured

| Risk | Protection |
|---|---|
| Guessing or forging codes | Codes are created and checked only on Firebase's servers. The website never sees the correct code. |
| Password theft / guessing | Passwords are hashed by Firebase and never stored by the site. Strong-password rules apply. Firebase blocks repeated failed attempts. The password field is cleared after a failure. |
| Discovering who has an account | Wrong email and wrong password give the same message, and "Forgot password?" always gives the same reply. |
| One mobile on two accounts | A mobile already verified on another account is refused when linking. |
| Bots / SMS spam | Invisible reCAPTCHA must pass before any SMS is sent. Firebase rate-limits each number and device. The site adds a 30-second resend cooldown and a cap of 5 code attempts. SMS is limited to India (step 3). |
| Stolen sessions via injected scripts (XSS) | A strict Content-Security-Policy only allows scripts from this site and Google's reCAPTCHA. Account data is shown with `textContent`, never as HTML. The Firebase SDK is self-hosted, not loaded from a third-party CDN. |
| Open redirects / phishing links | `?next=` after login only accepts paths on this site. |
| Clickjacking, downgrade attacks | `X-Frame-Options: DENY`, `frame-ancestors 'none'`, HTTPS forced, HSTS (in `.htaccess`). |
| Leaked secrets | There are none in the code. Passwords don't exist, and the Firebase config is public by design (restricted in step 6). |
| Session lifetime | 1-hour tokens, refreshed automatically by Firebase. "Sign out" ends the session on that device. |

Note: login currently identifies the customer. It doesn't unlock any private data, because orders still go by email. If you later store orders or addresses in a database, that server **must verify the Firebase ID token** on every request. Never trust the browser alone.

## Orders & admin panel (Phase 1, free Firebase plan)

- **Customers:** must sign in to check out. Orders are saved in the Firestore database (cash on delivery for now). *My account → My orders* shows each order's status and tracking, and lets the customer cancel before it's packed.
- **Owner and staff:** open **`/admin/`** (also linked from *My account*). It has:
  - **Dashboard:** new / to pack / to ship counts, today's orders and, for the owner only, sales.
  - **Orders:** live list with status tabs and search. The order panel has the customer, address, items with sizes, a price check, the next step (Confirm → Packed → Shipped with courier and tracking → Delivered), cancel with a reason, an internal note, the timeline and a printable slip.
  - **Customers** and **Team & access**.
- **Who has access:** set in `src/data/admins.json`. This file is private and not uploaded to GitHub. After editing it, run `npm run deploy:rules`. People sign in with those emails, and the email must be verified.
- **Security:** `src/firestore.rules` decides what each person can read or change:
  - customers only see their own orders;
  - nobody can fake a status, payment or history;
  - one mobile number per account;
  - only the listed owner and staff can see all orders.
- **Free-plan limitation:** orders are written by the customer's browser, so the admin panel compares every order with the current price list and shows a red ⚠ if it doesn't match. On the Blaze plan this moves to server code.
- **SMS verification at sign-up:** turn it on with `"requirePhoneVerification": true` in `settings.json`, once on Blaze.

## Things to update (carried over from WordPress)

- Products are still named **"Product 1" … "Product 9"** and have no descriptions.
- Much of the page text is the theme's **placeholder "lorem ipsum"** (brand story, about, FAQ answers, contact intro).
- The privacy and refund policies are the **default WordPress sample text**, and still mention `{email address}` placeholders.
- Social media links are empty (`settings.json` → `social`).
- The banner advertises code **DISB** (25% off). That coupon didn't exist in WordPress, so it was added in `settings.json` → `shop.coupons`. Remove it there if it shouldn't apply.

## Going live on Hostinger

1. Run `npm run build`.
2. Upload everything **inside** `website/` (including the hidden `.htaccess`) to `public_html`.

`.htaccess` redirects the old WordPress addresses to the new pages (e.g. `/my-shop` → `/shop/`, `/archives/1975` → the blog post). It also enables HTTPS, compression and browser caching.
