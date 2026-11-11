// Login, registration and account pages. Behaviour lives in src/js/auth.js.
import { icon } from './helpers.mjs';
import { pageTitle } from './components.mjs';

const HOME = { label: 'Home', href: '/' };

const unconfigured = `<div data-auth-unconfigured hidden class="mt-6 rounded-md border-l-4 border-brand bg-white p-4 text-sm text-ink">Login is being set up and will be available soon.</div>`;

const legal = `<p class="mt-6 text-xs leading-relaxed">By continuing you agree to our <a href="/privacy-policy/" class="text-brand underline">privacy policy</a>. This site is protected by reCAPTCHA and the Google <a href="https://policies.google.com/privacy" target="_blank" rel="noopener" class="underline">Privacy Policy</a> and <a href="https://policies.google.com/terms" target="_blank" rel="noopener" class="underline">Terms of Service</a> apply.</p>`;

const status = (attr) => `<p class="mt-4 min-h-[1.5rem] text-sm" ${attr} role="status" aria-live="polite"></p>`;

// Indian mobile input with a fixed +91 prefix.
const phoneInput = (id, { required = true } = {}) => `<div class="flex overflow-hidden rounded-md bg-white focus-within:ring-1 focus-within:ring-brand">
  <span class="flex items-center border-r border-line px-4 text-ink" aria-hidden="true">+91</span>
  <input id="${id}" name="phone" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="17" ${required ? 'required' : ''} placeholder="98765 43210" class="min-w-0 flex-1 px-4 py-3.5 text-ink placeholder:text-muted/70 focus:outline-none">
</div>`;

// Password input with a show/hide toggle.
const passwordInput = (id, name, autocomplete, placeholder = '') => `<div class="relative">
  <input id="${id}" name="${name}" type="password" autocomplete="${autocomplete}" required minlength="8" maxlength="128" placeholder="${placeholder}" class="field !bg-white pr-14">
  <button type="button" class="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted hover:text-brand" data-toggle-password="${id}" aria-label="Show password" aria-pressed="false">${icon('eye', 'h-5 w-5')}</button>
</div>`;

/**
 * Reusable "phone → SMS code" block (used for OTP login, sign-up verification and account verification).
 * JS hooks: [data-otp-block] [data-phone-form] [data-otp-form] [data-resend] [data-change-number] [data-otp-status] [data-recaptcha]
 */
export function otpBlock(prefix, { sendLabel = 'Send code', verifyLabel = 'Verify & sign in' } = {}) {
  return `<div data-otp-block>
  <form data-phone-form novalidate>
    <label for="${prefix}-phone" class="field-label">Mobile number</label>
    ${phoneInput(`${prefix}-phone`)}
    <button type="submit" class="btn-brand mt-5 w-full py-4">${sendLabel}</button>
  </form>
  <form data-otp-form hidden novalidate>
    <p class="text-sm">Code sent to <span class="font-medium text-ink" data-phone-display></span> · <button type="button" class="text-brand underline underline-offset-2" data-change-number>Change</button></p>
    <label for="${prefix}-code" class="field-label mt-5">6-digit code</label>
    <input id="${prefix}-code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required placeholder="••••••" class="field !bg-white text-center text-2xl tracking-[0.6em]">
    <button type="submit" class="btn-brand mt-5 w-full py-4">${verifyLabel}</button>
    <button type="button" class="mt-4 w-full text-sm text-ink underline-offset-2 hover:underline disabled:text-muted disabled:no-underline" data-resend disabled>Resend code</button>
  </form>
  ${status('data-otp-status')}
  <div data-recaptcha></div>
</div>`;
}

/* ------------------------------------------------------------------ LOGIN */
export function login() {
  const tab = (id, label, active) =>
    `<button type="button" role="tab" id="tab-${id}" aria-controls="panel-${id}" aria-selected="${active}" tabindex="${active ? 0 : -1}" class="flex-1 rounded-md py-2.5 text-sm font-medium transition aria-selected:bg-white aria-selected:text-ink aria-selected:shadow-sm text-muted hover:text-ink" data-tab="${id}">${label}</button>`;
  const body = `${pageTitle('Login', [HOME, { label: 'Login' }], { banner: false })}
<section class="mx-auto max-w-md px-4 pb-8 sm:px-6" data-login-page>
  <div class="rounded-lg bg-soft p-6 sm:p-10">
    <h2 class="text-2xl font-medium">Sign in</h2>
    <p class="mt-2 text-sm">Welcome back! Choose how you’d like to sign in.</p>
    ${unconfigured}

    <div class="mt-6 flex gap-1 rounded-lg bg-line/70 p-1" role="tablist" aria-label="Sign-in method">
      ${tab('email', 'Email &amp; password', true)}
      ${tab('phone', 'Mobile OTP', false)}
    </div>

    <div id="panel-email" role="tabpanel" aria-labelledby="tab-email" class="mt-6" data-panel="email">
      <form class="space-y-4" data-email-login novalidate>
        <div><label for="login-email" class="field-label">Email</label><input id="login-email" name="email" type="email" autocomplete="username email" required maxlength="254" placeholder="you@example.com" class="field !bg-white"></div>
        <div>
          <div class="flex items-baseline justify-between"><label for="login-password" class="field-label">Password</label><button type="button" class="text-sm text-brand underline-offset-2 hover:underline" data-forgot>Forgot password?</button></div>
          ${passwordInput('login-password', 'password', 'current-password')}
        </div>
        <button type="submit" class="btn-brand w-full py-4">Sign in</button>
      </form>
      ${status('data-email-status')}
    </div>

    <div id="panel-phone" role="tabpanel" aria-labelledby="tab-phone" class="mt-6" data-panel="phone" hidden>
      <p class="mb-4 text-sm">We’ll send a one-time code by SMS. No password needed.</p>
      ${otpBlock('login')}
    </div>

    <p class="mt-2 border-t border-line pt-5 text-center text-sm">New to Paloveenaa? <a href="/register/" class="font-medium text-brand underline underline-offset-2" data-keep-next>Create an account</a></p>
    ${legal}
  </div>
</section>`;
  return { meta: { title: 'Login', noindex: true, scripts: ['auth.js'] }, body };
}

/* ------------------------------------------------------------------ REGISTER */
export function register() {
  const text = (id, label, attrs) => `<div><label for="reg-${id}" class="field-label">${label}</label><input id="reg-${id}" name="${id}" class="field !bg-white" ${attrs}></div>`;
  const body = `${pageTitle('Create account', [HOME, { label: 'Create account' }], { banner: false })}
<section class="mx-auto max-w-lg px-4 pb-8 sm:px-6" data-register-page>
  <div class="rounded-lg bg-soft p-6 sm:p-10">
    <div data-register-step="details">
      <h2 class="text-2xl font-medium">Create your account</h2>
      <p class="mt-2 text-sm">Sign in later with your email &amp; password or with your mobile number.</p>
      ${unconfigured}
      <form class="mt-8 space-y-4" data-register-form novalidate>
        <div class="grid gap-4 sm:grid-cols-2">
          ${text('firstName', 'First name *', 'required autocomplete="given-name" maxlength="50"')}
          ${text('lastName', 'Last name *', 'required autocomplete="family-name" maxlength="50"')}
        </div>
        ${text('email', 'Email *', 'type="email" required autocomplete="email" maxlength="254" placeholder="you@example.com"')}
        <div><label for="reg-phone" class="field-label">Mobile number *</label>${phoneInput('reg-phone')}</div>
        <div>
          <label for="reg-password" class="field-label">Password *</label>
          ${passwordInput('reg-password', 'password', 'new-password')}
          <ul class="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs" data-password-rules aria-live="polite">
            <li data-rule="length">8+ characters</li>
            <li data-rule="upper">An uppercase letter</li>
            <li data-rule="lower">A lowercase letter</li>
            <li data-rule="number">A number</li>
          </ul>
        </div>
        <div><label for="reg-confirm" class="field-label">Re-enter password *</label>${passwordInput('reg-confirm', 'confirm', 'new-password')}</div>
        <label class="flex items-start gap-3 text-sm"><input type="checkbox" name="terms" required class="mt-1 h-4 w-4 accent-brand"> <span>I agree to the <a href="/privacy-policy/" class="text-brand underline">privacy policy</a> and <a href="/refund-returns/" class="text-brand underline">refund &amp; returns policy</a>.</span></label>
        <button type="submit" class="btn-brand w-full py-4" disabled aria-describedby="register-hint">Create account</button>
        <p id="register-hint" class="text-sm text-muted" data-register-hint aria-live="polite">Fill in all fields and accept the policies to continue.</p>
      </form>
      ${status('data-register-status')}
      <p class="mt-2 border-t border-line pt-5 text-center text-sm">Already have an account? <a href="/login/" class="font-medium text-brand underline underline-offset-2" data-keep-next>Sign in</a></p>
    </div>

    <div data-register-step="verify" hidden>
      <h2 class="text-2xl font-medium">Verify your mobile number</h2>
      <p class="mt-2 text-sm">One last step: confirm your mobile number with the code we send by SMS. Your account is created as soon as it’s verified.</p>
      <div class="mt-6">${otpBlock('reg-verify', { sendLabel: 'Send code', verifyLabel: 'Verify & create account' })}</div>
      <button type="button" class="mt-2 w-full text-sm text-ink underline underline-offset-2 hover:text-brand" data-register-back>← Back to edit details</button>
    </div>
    ${legal}
  </div>
</section>`;
  return { meta: { title: 'Create account', noindex: true, scripts: ['auth.js'] }, body };
}

/* ------------------------------------------------------------------ EMAIL LINKS (verify email / reset password) */
// Firebase's email links point here once "Action URL" is set in the Firebase console (see README).
export function authAction() {
  const body = `<section class="mx-auto max-w-md px-4 pb-8 pt-14 sm:px-6 md:pt-24" data-action-page>
  <div class="rounded-lg bg-soft p-6 text-center sm:p-10">
    <div data-action-loading><p class="py-8">One moment…</p></div>

    <div data-action-result hidden>
      <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full" data-action-icon></div>
      <h1 class="mt-5 text-3xl font-medium" data-action-title></h1>
      <p class="mt-3" data-action-text></p>
      <a href="/account/" class="btn-brand mt-8 w-full py-4" data-action-button></a>
    </div>

    <div data-reset-form-wrap hidden class="text-left">
      <h1 class="text-center text-3xl font-medium">Set a new password</h1>
      <p class="mt-3 text-center text-sm">For <span class="font-medium text-ink" data-reset-email></span></p>
      <form class="mt-8 space-y-4" data-reset-form novalidate>
        <div>
          <label for="reset-password" class="field-label">New password</label>
          ${passwordInput('reset-password', 'password', 'new-password')}
          <ul class="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs" aria-live="polite">
            <li data-rule="length">8+ characters</li>
            <li data-rule="upper">An uppercase letter</li>
            <li data-rule="lower">A lowercase letter</li>
            <li data-rule="number">A number</li>
          </ul>
        </div>
        <div><label for="reset-confirm" class="field-label">Re-enter new password</label>${passwordInput('reset-confirm', 'confirm', 'new-password')}</div>
        <button type="submit" class="btn-brand w-full py-4" disabled>Save new password</button>
      </form>
      ${status('data-reset-status')}
    </div>
  </div>
</section>`;
  // no-referrer: the one-time code in this page's address is never sent to any other site.
  return { meta: { title: 'Account', noindex: true, referrer: 'no-referrer', scripts: ['auth.js'] }, body };
}

/* ------------------------------------------------------------------ ACCOUNT */
export function account() {
  const row = (label, attr, extra = '') =>
    `<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-4"><dt>${label}</dt><dd class="text-right font-medium text-ink"><span ${attr}></span>${extra}</dd></div>`;
  const body = `${pageTitle('My account', [HOME, { label: 'My account' }], { banner: false })}
<section class="mx-auto max-w-xl px-4 pb-8 sm:px-6" data-account-page>
  <p class="py-10 text-center" data-account-loading>Loading your account…</p>
  <div hidden data-account-body>
    <div class="rounded-lg bg-soft p-6 sm:p-10">
      <h2 class="text-2xl font-medium">Hello<span data-account-greeting></span></h2>
      <dl class="mt-4 divide-y divide-line">
        ${row('Name', 'data-account-name')}
        ${row('Email', 'data-account-email', ' <span class="ml-2 rounded px-1.5 py-0.5 text-xs font-medium" data-email-badge hidden></span>')}
        ${row('Mobile number', 'data-account-phone', ' <span class="ml-2 rounded px-1.5 py-0.5 text-xs font-medium" data-phone-badge hidden></span>')}
        ${row('Member since', 'data-account-since')}
        ${row('Last sign-in', 'data-account-last')}
      </dl>
      <div class="mt-2 rounded-md bg-white p-4 text-sm" data-email-unverified hidden>
        Please confirm your email address using the link we sent you. <button type="button" class="font-medium text-brand underline underline-offset-2" data-resend-verification>Resend email</button>
      </div>
      ${status('data-account-status')}
    </div>

    <div class="mt-6 rounded-lg bg-soft p-6 sm:p-10" data-verify-phone-card hidden>
      <h2 class="text-xl font-medium">Add &amp; verify your mobile</h2>
      <p class="mt-2 text-sm">Then you can also sign in with an SMS code.</p>
      <div class="mt-6">${otpBlock('acc-verify', { verifyLabel: 'Verify mobile' })}</div>
    </div>

    <a href="/admin/" class="btn-brand mt-6 w-full" data-admin-link hidden>Open admin panel</a>

    <div class="mt-6 rounded-lg bg-soft p-6 sm:p-10">
      <h2 class="text-2xl font-medium">My orders</h2>
      <div class="mt-4" data-my-orders><p class="py-4 text-sm">Loading your orders…</p></div>
    </div>

    <div class="mt-6 grid gap-3 sm:grid-cols-3">
      <a href="/wishlist/" class="btn-outline px-4">Wishlist</a>
      <a href="/cart/" class="btn-outline px-4">Cart</a>
      <button type="button" class="btn-dark px-4" data-sign-out>Sign out</button>
    </div>
  </div>
</section>`;
  return { meta: { title: 'My account', noindex: true, scripts: ['auth.js', 'orders.js'] }, body };
}
