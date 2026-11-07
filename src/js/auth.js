// Mobile-number (OTP) login using Firebase Authentication.
// Security model:
//  - The OTP is generated, sent and checked by Firebase's servers – never in this code.
//  - Invisible reCAPTCHA must pass before an SMS is sent (stops bots / SMS-pumping).
//  - Firebase rate-limits attempts per number and per device; we add a resend cooldown and attempt cap.
//  - Sessions are short-lived ID tokens (1 hour) auto-refreshed by Firebase; nothing sensitive is stored by us.
//  - No passwords exist, and the config below contains only public identifiers.
import config from './config.js';
import { initializeApp } from '../vendor/firebase-10.14.1/firebase-app.js';
import {
  getAuth, connectAuthEmulator, RecaptchaVerifier, signInWithPhoneNumber, onAuthStateChanged, signOut,
} from '../vendor/firebase-10.14.1/firebase-auth.js';

const $ = (s, r = document) => r.querySelector(s);
const link = (p) => (config.base || '') + p; // adds the sub-folder on GitHub Pages
const fb = config.firebase || {};
const configured = Boolean(fb.apiKey && fb.authDomain && fb.projectId && fb.appId);

const RESEND_SECONDS = 30;
const MAX_CODE_ATTEMPTS = 5;

/** Only allow redirects to paths on this site (prevents open-redirect attacks via ?next=). */
function safeNext() {
  const next = new URLSearchParams(location.search).get('next') || '';
  return link(/^\/(?!\/)[A-Za-z0-9\-_/]*$/.test(next) ? next : '/account/');
}

/** Accepts "98765 43210", "+91 9876543210", "09876543210" → "+919876543210", or null if not a valid Indian mobile. */
export function normalizeIndianMobile(input) {
  let d = String(input).replace(/[\s\-()]/g, '');
  if (d.startsWith('+91')) d = d.slice(3);
  else if (d.startsWith('0091')) d = d.slice(4);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  else if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  return /^[6-9]\d{9}$/.test(d) ? `+91${d}` : null;
}

const pretty = (e164) => e164.replace(/^\+91(\d{5})(\d{5})$/, '+91 $1 $2');

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
  'auth/operation-not-allowed': 'Mobile login is not enabled yet. Please contact us.',
  'auth/billing-not-enabled': 'Mobile login is temporarily unavailable. Please try again later.',
  'auth/unauthorized-domain': 'Login is not enabled for this website address yet.',
};
const message = (err) => MESSAGES[err?.code] || 'Something went wrong. Please try again.';

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

/* ------------------------------------------------------------------ login page */
function initLogin(root) {
  const phoneForm = $('[data-phone-form]', root);
  const otpForm = $('[data-otp-form]', root);
  const status = $('[data-auth-status]', root);
  const sendBtn = $('[type=submit]', phoneForm);
  const verifyBtn = $('[type=submit]', otpForm);
  const resendBtn = $('[data-resend]', root);
  const setStatus = (text, ok = false) => {
    status.textContent = text;
    status.className = `mt-4 min-h-[1.5rem] text-sm ${ok ? 'text-green-700' : 'text-red-700'}`;
  };

  if (!configured) {
    $('[data-auth-unconfigured]', root).hidden = false;
    [...root.querySelectorAll('input, button')].forEach((el) => (el.disabled = true));
    return;
  }

  // Already signed in? Go straight on.
  const stop = onAuthStateChanged(auth, (user) => {
    if (user) location.replace(safeNext());
  });

  let verifier = null;
  let confirmation = null;
  let phone = null;
  let attempts = 0;
  let timer = null;

  const freshVerifier = () => {
    // A brand-new container each time avoids "reCAPTCHA already rendered" errors after a failure.
    verifier?.clear();
    const old = $('[data-recaptcha]', root);
    const box = document.createElement('div');
    box.dataset.recaptcha = '';
    old.replaceWith(box);
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

  async function sendCode() {
    sendBtn.disabled = true;
    resendBtn.disabled = true;
    setStatus('');
    try {
      confirmation = await signInWithPhoneNumber(auth, phone, freshVerifier());
      attempts = 0;
      phoneForm.hidden = true;
      otpForm.hidden = false;
      $('[data-phone-display]', root).textContent = pretty(phone);
      otpForm.code.value = '';
      otpForm.code.focus();
      setStatus(`We sent a 6-digit code to ${pretty(phone)}.`, true);
      startCooldown();
    } catch (err) {
      setStatus(message(err));
      resendBtn.disabled = false;
    } finally {
      sendBtn.disabled = false;
    }
  }

  phoneForm.addEventListener('submit', (e) => {
    e.preventDefault();
    phone = normalizeIndianMobile(phoneForm.phone.value);
    if (!phone) {
      setStatus(MESSAGES['auth/invalid-phone-number']);
      phoneForm.phone.focus();
      return;
    }
    sendCode();
  });

  // Digits only, max 6, auto-submit when complete.
  otpForm.code.addEventListener('input', () => {
    otpForm.code.value = otpForm.code.value.replace(/\D/g, '').slice(0, 6);
    if (otpForm.code.value.length === 6) otpForm.requestSubmit();
  });

  otpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = otpForm.code.value.trim();
    if (!/^\d{6}$/.test(code)) return setStatus(MESSAGES['auth/missing-verification-code']);
    if (!confirmation) return setStatus(MESSAGES['auth/code-expired']);
    if (attempts >= MAX_CODE_ATTEMPTS) return setStatus('Too many incorrect codes. Please request a new code.');
    verifyBtn.disabled = true;
    try {
      await confirmation.confirm(code);
      stop();
      setStatus('Signed in. Redirecting…', true);
      location.replace(safeNext());
    } catch (err) {
      attempts++;
      setStatus(message(err));
      if (['auth/code-expired', 'auth/session-expired'].includes(err?.code) || attempts >= MAX_CODE_ATTEMPTS) confirmation = null;
      otpForm.code.select();
    } finally {
      verifyBtn.disabled = false;
    }
  });

  resendBtn.addEventListener('click', () => phone && sendCode());

  $('[data-change-number]', root).addEventListener('click', () => {
    confirmation = null;
    clearInterval(timer);
    otpForm.hidden = true;
    phoneForm.hidden = false;
    setStatus('');
    phoneForm.phone.focus();
  });
}

/* ------------------------------------------------------------------ account page */
function initAccount(root) {
  if (!configured) {
    location.replace(link('/login/'));
    return;
  }
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      location.replace(link('/login/?next=/account/'));
      return;
    }
    const fmt = (s) => (s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');
    // textContent (never innerHTML) for anything that comes from the account.
    $('[data-account-phone]', root).textContent = pretty(user.phoneNumber || '');
    $('[data-account-since]', root).textContent = fmt(user.metadata.creationTime);
    $('[data-account-last]', root).textContent = fmt(user.metadata.lastSignInTime);
    $('[data-account-loading]', root).hidden = true;
    $('[data-account-body]', root).hidden = false;
  });
  $('[data-sign-out]', root).addEventListener('click', async (e) => {
    e.target.disabled = true;
    await signOut(auth);
    location.replace(link('/'));
  });
}

const login = $('[data-login-page]');
if (login) initLogin(login);
const account = $('[data-account-page]');
if (account) initAccount(account);
