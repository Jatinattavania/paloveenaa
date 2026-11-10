// Customer accounts with Firebase Authentication:
//   • Email + password (create account, sign in, forgot password, email verification)
//   • Mobile number + SMS one-time code (sign in, or verify/link a mobile to an email account)
//
// Security model:
//   - Passwords and SMS codes are checked only by Firebase's servers. Passwords are hashed there;
//     this site never stores or sees them after submission.
//   - Firebase rate-limits sign-in attempts and SMS sends; invisible reCAPTCHA must pass before any SMS.
//   - Failed email sign-ins and password resets give the same message whether or not the email exists,
//     so attackers can't use the site to discover customers' emails.
//   - Sessions are short-lived tokens (1 hour) refreshed by Firebase. Nothing sensitive is stored by us.
//   - Everything from the account is shown with textContent (never as HTML).
import config from './config.js';
import { initializeApp } from '../vendor/firebase-13.1.0/firebase-app.js';
import {
  getAuth, connectAuthEmulator, RecaptchaVerifier, signInWithPhoneNumber, linkWithPhoneNumber, onAuthStateChanged, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendEmailVerification, sendPasswordResetEmail, reload,
} from '../vendor/firebase-13.1.0/firebase-auth.js';

// Never run the sign-in UI inside someone else's frame (clickjacking). app.js also hides the page.
if (window.top !== window.self) throw new Error('Refusing to run inside a frame');

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const link = (p) => (config.base || '') + p; // adds the sub-folder on GitHub Pages
const fb = config.firebase || {};
const configured = Boolean(fb.apiKey && fb.authDomain && fb.projectId && fb.appId);

const RESEND_SECONDS = 30;
const MAX_CODE_ATTEMPTS = 5;

/* ------------------------------------------------------------------ helpers */

/** Only allow redirects to paths on this site (prevents open-redirect attacks via ?next=). */
const nextParam = () => {
  const next = new URLSearchParams(location.search).get('next') || '';
  return /^\/(?!\/)[A-Za-z0-9\-_/]*$/.test(next) ? next : '';
};
const safeNext = () => link(nextParam() || '/account/');

/** Accepts "98765 43210", "+91 9876543210", "09876543210" → "+919876543210", or null if not a valid Indian mobile. */
export function normalizeIndianMobile(input) {
  let d = String(input).replace(/[\s\-()]/g, '');
  if (d.startsWith('+91')) d = d.slice(3);
  else if (d.startsWith('0091')) d = d.slice(4);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  else if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  return /^[6-9]\d{9}$/.test(d) ? `+91${d}` : null;
}
const pretty = (e164) => (e164 || '').replace(/^\+91(\d{5})(\d{5})$/, '+91 $1 $2');
const validEmail = (e) => e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const cleanName = (s) => String(s).replace(/[<>"]/g, '').replace(/\s+/g, ' ').trim().slice(0, 50);

export const PASSWORD_RULES = {
  length: (p) => p.length >= 8,
  upper: (p) => /[A-Z]/.test(p),
  lower: (p) => /[a-z]/.test(p),
  number: (p) => /\d/.test(p),
};
const passwordOk = (p) => Object.values(PASSWORD_RULES).every((rule) => rule(p));

// Friendly messages; raw error details are never shown to visitors.
const MESSAGES = {
  'auth/invalid-phone-number': 'Please enter a valid 10-digit mobile number.',
  'auth/missing-phone-number': 'Please enter your mobile number.',
  'auth/too-many-requests': 'Too many attempts. For your security, please wait a while before trying again.',
  'auth/quota-exceeded': 'We can’t send codes right now. Please try again later.',
  'auth/captcha-check-failed': 'Security check failed. Please refresh the page and try again.',
  'auth/invalid-app-credential': 'Security check failed. Please refresh the page and try again.',
  'auth/invalid-verification-code': 'That code is incorrect. Please check the SMS and try again.',
  'auth/code-expired': 'This code has expired. Please request a new one.',
  'auth/session-expired': 'This code has expired. Please request a new one.',
  'auth/missing-verification-code': 'Please enter the 6-digit code.',
  'auth/network-request-failed': 'Network problem. Please check your connection and try again.',
  'auth/user-disabled': 'This account has been disabled. Please contact us.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled yet. Please contact us.',
  'auth/unauthorized-domain': 'Login is not enabled for this website address yet.',
  'auth/billing-not-enabled': 'SMS codes are temporarily unavailable. Please try again later.',
  // Email / password
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/missing-password': 'Please enter your password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/user-not-found': 'Incorrect email or password.',
  'auth/invalid-login-credentials': 'Incorrect email or password.',
  'auth/email-already-in-use': 'An account with this email already exists. Please sign in instead.',
  'auth/weak-password': 'Please choose a stronger password.',
  'auth/password-does-not-meet-requirements': 'Please choose a stronger password (8+ characters with upper- and lower-case letters and a number).',
  // Linking a mobile to an account
  'auth/credential-already-in-use': 'This mobile number is already used by another account. Sign in with “Mobile OTP” instead.',
  'auth/account-exists-with-different-credential': 'This mobile number is already used by another account. Sign in with “Mobile OTP” instead.',
  'auth/provider-already-linked': 'A mobile number is already verified on this account.',
  'auth/requires-recent-login': 'For your security, please sign out and sign in again, then try once more.',
};
const message = (err) => MESSAGES[err?.code] || 'Something went wrong. Please try again.';

function setStatus(el, text, ok = false) {
  if (!el) return;
  el.textContent = text;
  el.className = `mt-4 min-h-[1.5rem] text-sm ${ok ? 'text-green-700' : 'text-red-700'}`;
}

function busy(button, on, label) {
  if (on) {
    button.dataset.label ??= button.textContent;
    button.textContent = label;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.label ?? button.textContent;
    button.disabled = false;
  }
}

function disableAll(root) {
  const notice = $('[data-auth-unconfigured]', root);
  if (notice) notice.hidden = false;
  $$('input, button', root).forEach((el) => (el.disabled = true));
}

/* ------------------------------------------------------------------ Firebase */
let auth = null;
if (configured) {
  const app = initializeApp({ apiKey: fb.apiKey, authDomain: fb.authDomain, projectId: fb.projectId, appId: fb.appId });
  auth = getAuth(app);
  auth.useDeviceLanguage();
  // Local testing only: talks to the Firebase Auth emulator instead of real Firebase.
  if (fb.emulator && ['localhost', '127.0.0.1'].includes(location.hostname)) {
    connectAuthEmulator(auth, /^https?:\/\//.test(fb.emulator) ? fb.emulator : `http://${fb.emulator}`, { disableWarnings: true });
  }
  // Session persistence: Firebase's default (IndexedDB) – kept signed in on this device until "Sign out".
}

/* ------------------------------------------------------------------ shared UI */

// Show / hide password buttons.
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-toggle-password]');
  if (!btn) return;
  const input = document.getElementById(btn.dataset.togglePassword);
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.setAttribute('aria-pressed', show);
  btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
});

// Carry ?next= across the login ⇄ register links.
$$('[data-keep-next]').forEach((a) => {
  const next = nextParam();
  if (next) a.href = `${a.getAttribute('href')}?next=${encodeURIComponent(next)}`;
});

/**
 * Phone → SMS code flow inside a [data-otp-block].
 * @param start  (e164Phone, recaptchaVerifier) => Promise<ConfirmationResult>
 * @param done   async (userCredential) => void   – called after the code is confirmed
 */
function otpFlow(block, { start, done, phone: initialPhone = '' }) {
  const phoneForm = $('[data-phone-form]', block);
  const otpForm = $('[data-otp-form]', block);
  const status = $('[data-otp-status]', block);
  const sendBtn = $('[type=submit]', phoneForm);
  const verifyBtn = $('[type=submit]', otpForm);
  const resendBtn = $('[data-resend]', block);
  let verifier = null;
  let confirmation = null;
  let phone = null;
  let attempts = 0;
  let timer = null;

  if (initialPhone) phoneForm.phone.value = initialPhone.replace(/^\+91/, '');

  const freshVerifier = () => {
    // A brand-new container each time avoids "reCAPTCHA already rendered" errors after a failure.
    verifier?.clear();
    const box = document.createElement('div');
    box.dataset.recaptcha = '';
    $('[data-recaptcha]', block).replaceWith(box);
    verifier = new RecaptchaVerifier(auth, box, { size: 'invisible' });
    return verifier;
  };

  const startCooldown = () => {
    let left = RESEND_SECONDS;
    resendBtn.disabled = true;
    clearInterval(timer);
    const tick = () => {
      resendBtn.textContent = left > 0 ? `Resend code in ${left}s` : 'Resend code';
      if (left-- <= 0) { clearInterval(timer); resendBtn.disabled = false; }
    };
    tick();
    timer = setInterval(tick, 1000);
  };

  async function send() {
    sendBtn.disabled = true;
    resendBtn.disabled = true;
    setStatus(status, '');
    try {
      confirmation = await start(phone, freshVerifier());
      attempts = 0;
      phoneForm.hidden = true;
      otpForm.hidden = false;
      $('[data-phone-display]', block).textContent = pretty(phone);
      otpForm.code.value = '';
      otpForm.code.focus();
      setStatus(status, `We sent a 6-digit code to ${pretty(phone)}.`, true);
      startCooldown();
    } catch (err) {
      setStatus(status, message(err));
      resendBtn.disabled = false;
    } finally {
      sendBtn.disabled = false;
    }
  }

  phoneForm.addEventListener('submit', (e) => {
    e.preventDefault();
    phone = normalizeIndianMobile(phoneForm.phone.value);
    if (!phone) {
      setStatus(status, MESSAGES['auth/invalid-phone-number']);
      phoneForm.phone.focus();
      return;
    }
    send();
  });

  // Digits only, max 6, auto-submit when complete.
  otpForm.code.addEventListener('input', () => {
    otpForm.code.value = otpForm.code.value.replace(/\D/g, '').slice(0, 6);
    if (otpForm.code.value.length === 6) otpForm.requestSubmit();
  });

  otpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = otpForm.code.value.trim();
    if (!/^\d{6}$/.test(code)) return setStatus(status, MESSAGES['auth/missing-verification-code']);
    if (!confirmation) return setStatus(status, MESSAGES['auth/code-expired']);
    if (attempts >= MAX_CODE_ATTEMPTS) return setStatus(status, 'Too many incorrect codes. Please request a new code.');
    verifyBtn.disabled = true;
    try {
      const cred = await confirmation.confirm(code);
      clearInterval(timer);
      await done(cred);
    } catch (err) {
      attempts++;
      setStatus(status, message(err));
      if (['auth/code-expired', 'auth/session-expired'].includes(err?.code) || attempts >= MAX_CODE_ATTEMPTS) confirmation = null;
      otpForm.code.select();
    } finally {
      verifyBtn.disabled = false;
    }
  });

  resendBtn.addEventListener('click', () => phone && send());

  $('[data-change-number]', block).addEventListener('click', () => {
    confirmation = null;
    clearInterval(timer);
    otpForm.hidden = true;
    phoneForm.hidden = false;
    setStatus(status, '');
    phoneForm.phone.focus();
  });

  return { status };
}

/* ------------------------------------------------------------------ login page */
function initLogin(root) {
  if (!configured) return disableAll(root);

  let leaving = false;
  const go = () => { if (!leaving) { leaving = true; location.replace(safeNext()); } };
  onAuthStateChanged(auth, (user) => user && go()); // already signed in → straight on

  // Tabs (arrow keys supported)
  const tabs = $$('[data-tab]', root);
  const select = (id) => {
    tabs.forEach((t) => {
      const on = t.dataset.tab === id;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      $(`[data-panel="${t.dataset.tab}"]`, root).hidden = !on;
    });
  };
  tabs.forEach((t) => {
    t.addEventListener('click', () => select(t.dataset.tab));
    t.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const i = (tabs.indexOf(t) + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      select(tabs[i].dataset.tab);
      tabs[i].focus();
    });
  });

  // Email + password
  const form = $('[data-email-login]', root);
  const status = $('[data-email-status]', root);
  const submit = $('[type=submit]', form);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const password = form.password.value;
    if (!validEmail(email)) { setStatus(status, MESSAGES['auth/invalid-email']); return form.email.focus(); }
    if (!password) { setStatus(status, MESSAGES['auth/missing-password']); return form.password.focus(); }
    busy(submit, true, 'Signing in…');
    setStatus(status, '');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setStatus(status, 'Signed in. Redirecting…', true);
      go();
    } catch (err) {
      form.password.value = '';
      setStatus(status, message(err));
      busy(submit, false);
    }
  });

  // Forgot password: same message whether or not the email has an account.
  $('[data-forgot]', root).addEventListener('click', async (e) => {
    const email = form.email.value.trim();
    if (!validEmail(email)) {
      setStatus(status, 'Enter your email address above, then tap “Forgot password?” again.');
      return form.email.focus();
    }
    e.target.disabled = true;
    try {
      await sendPasswordResetEmail(auth, email);
      setStatus(status, 'If an account exists for this email, we’ve sent a link to reset your password.', true);
    } catch (err) {
      if (['auth/user-not-found', 'auth/invalid-credential'].includes(err?.code)) {
        setStatus(status, 'If an account exists for this email, we’ve sent a link to reset your password.', true);
      } else setStatus(status, message(err));
    } finally {
      setTimeout(() => (e.target.disabled = false), RESEND_SECONDS * 1000);
    }
  });

  // Mobile OTP
  otpFlow($('[data-panel="phone"] [data-otp-block]', root), {
    start: (phone, verifier) => signInWithPhoneNumber(auth, phone, verifier),
    done: async () => go(),
  });
}

/* ------------------------------------------------------------------ register page */
function initRegister(root) {
  if (!configured) return disableAll(root);

  let registering = false;
  onAuthStateChanged(auth, (user) => {
    if (user && !registering) location.replace(safeNext()); // already signed in
  });

  const form = $('[data-register-form]', root);
  const status = $('[data-register-status]', root);
  const submit = $('[type=submit]', form);

  // Live password checklist
  const rules = $$('[data-rule]', root);
  const paintRules = () => {
    const p = form.password.value;
    rules.forEach((li) => {
      const ok = PASSWORD_RULES[li.dataset.rule](p);
      li.classList.toggle('text-green-700', ok);
      li.textContent = `${ok ? '✓' : '•'} ${li.textContent.replace(/^[✓•]\s*/, '')}`;
    });
  };
  paintRules();
  form.password.addEventListener('input', paintRules);

  const fail = (field, text) => {
    setStatus(status, text);
    field?.focus();
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const firstName = cleanName(form.firstName.value);
    const lastName = cleanName(form.lastName.value);
    const email = form.email.value.trim();
    const phone = normalizeIndianMobile(form.phone.value);
    const password = form.password.value;
    if (!firstName) return fail(form.firstName, 'Please enter your first name.');
    if (!lastName) return fail(form.lastName, 'Please enter your last name.');
    if (!validEmail(email)) return fail(form.email, MESSAGES['auth/invalid-email']);
    if (!phone) return fail(form.phone, MESSAGES['auth/invalid-phone-number']);
    if (!passwordOk(password)) return fail(form.password, 'Your password needs 8+ characters with an uppercase letter, a lowercase letter and a number.');
    if (password !== form.confirm.value) return fail(form.confirm, 'The two passwords don’t match.');
    if (!form.terms.checked) return fail(form.terms, 'Please accept the privacy and refund policies to continue.');

    registering = true;
    busy(submit, true, 'Creating account…');
    setStatus(status, '');
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(user, { displayName: `${firstName} ${lastName}` });
      sendEmailVerification(user).catch(() => {}); // best effort; can be resent from the account page
      // Step 2: verify the mobile so it's linked to this same account.
      $('[data-register-step="details"]', root).hidden = true;
      const step = $('[data-register-step="verify"]', root);
      step.hidden = false;
      otpFlow($('[data-otp-block]', step), {
        phone,
        start: (p, verifier) => linkWithPhoneNumber(auth.currentUser, p, verifier),
        done: async () => location.replace(safeNext()),
      });
      $('[data-skip-verify]', root).addEventListener('click', () => location.replace(safeNext()));
      $('[data-phone-form] [type=submit]', step).focus();
    } catch (err) {
      registering = false;
      setStatus(status, message(err));
      busy(submit, false);
    }
  });
}

/* ------------------------------------------------------------------ account page */
function initAccount(root) {
  if (!configured) {
    location.replace(link('/login/'));
    return;
  }
  const status = $('[data-account-status]', root);
  const fmt = (s) => (s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');

  // textContent (never innerHTML) for anything that comes from the account.
  function render(user) {
    const name = user.displayName || '';
    $('[data-account-greeting]', root).textContent = name ? `, ${name.split(' ')[0]}` : '';
    $('[data-account-name]', root).textContent = name || '—';
    $('[data-account-email]', root).textContent = user.email || 'Not added';
    const badge = $('[data-email-badge]', root);
    badge.hidden = !user.email;
    badge.textContent = user.emailVerified ? 'Verified' : 'Not verified';
    badge.className = `ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${user.emailVerified ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`;
    $('[data-email-unverified]', root).hidden = !user.email || user.emailVerified;
    $('[data-account-phone]', root).textContent = user.phoneNumber ? pretty(user.phoneNumber) : 'Not verified yet';
    $('[data-phone-badge]', root).hidden = !user.phoneNumber;
    $('[data-verify-phone-card]', root).hidden = Boolean(user.phoneNumber);
    $('[data-account-since]', root).textContent = fmt(user.metadata.creationTime);
    $('[data-account-last]', root).textContent = fmt(user.metadata.lastSignInTime);
    $('[data-account-loading]', root).hidden = true;
    $('[data-account-body]', root).hidden = false;
  }

  let ready = false;
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      location.replace(link('/login/?next=/account/'));
      return;
    }
    await reload(user).catch(() => {}); // pick up "email verified" if they clicked the link elsewhere
    render(auth.currentUser || user);
    if (ready) return;
    ready = true;
    otpFlow($('[data-verify-phone-card] [data-otp-block]', root), {
      start: (phone, verifier) => linkWithPhoneNumber(auth.currentUser, phone, verifier),
      done: async () => {
        await reload(auth.currentUser);
        render(auth.currentUser);
        setStatus(status, 'Your mobile number is verified. You can now also sign in with an SMS code.', true);
      },
    });
  });

  $('[data-resend-verification]', root).addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      await sendEmailVerification(auth.currentUser);
      setStatus(status, 'Verification email sent. Please check your inbox (and spam folder).', true);
    } catch (err) {
      setStatus(status, message(err));
    } finally {
      setTimeout(() => (e.target.disabled = false), 60_000);
    }
  });

  $('[data-sign-out]', root).addEventListener('click', async (e) => {
    e.target.disabled = true;
    await signOut(auth);
    location.replace(link('/'));
  });
}

const pages = { '[data-login-page]': initLogin, '[data-register-page]': initRegister, '[data-account-page]': initAccount };
for (const [sel, init] of Object.entries(pages)) {
  const root = $(sel);
  if (root) init(root);
}
