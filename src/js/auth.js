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
import { auth, configured, link, fbConfig } from './fb.js';
import { db, doc, getDoc, writeBatch, setDoc, serverTimestamp, loadProfile } from './db.js';
import {
  RecaptchaVerifier, signInWithPhoneNumber, linkWithPhoneNumber, onAuthStateChanged, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendEmailVerification, sendPasswordResetEmail, reload,
  getAdditionalUserInfo, linkWithCredential, EmailAuthProvider,
  applyActionCode, checkActionCode, verifyPasswordResetCode, confirmPasswordReset,
} from '../vendor/firebase-13.1.0/firebase-auth.js';

// Never run the sign-in UI inside someone else's frame (clickjacking). app.js also hides the page.
if (window.top !== window.self) throw new Error('Refusing to run inside a frame');

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
// true (Blaze plan): new accounts verify their mobile by SMS. false (free plan): mobile saved without SMS.
const REQUIRE_SMS = fbConfig.requirePhoneVerification === true;

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
  // Our own checks
  'paloveena/phone-registered': 'This mobile number is already registered with an account. Please sign in instead.',
  'paloveena/no-account': 'No account is registered with this mobile number. Please create an account first.',
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

/* ------------------------------------------------------------------ customer profile (Firestore) */
/**
 * Saves the profile and claims the mobile number for this account. The database refuses a number that
 * another account already has (security rules), which is how "one account per mobile" works without SMS.
 * @returns {Promise<'ok'|'phone-taken'>}
 */
async function saveProfile(user, { firstName, lastName, phone }) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'phones', phone), { uid: user.uid, createdAt: serverTimestamp() });
  batch.set(doc(db, 'phoneOwners', user.uid), { phone });
  try {
    await batch.commit();
  } catch (err) {
    if (err?.code === 'permission-denied') return 'phone-taken';
    throw err;
  }
  await setDoc(doc(db, 'users', user.uid), {
    firstName, lastName, email: user.email, phone, phoneVerified: user.phoneNumber === phone, createdAt: serverTimestamp(),
  });
  return 'ok';
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
      if (err?.resetFlow) {
        // The code was right but the result isn't allowed (e.g. number already registered): start over.
        reset();
        setStatus(status, message(err));
        return;
      }
      attempts++;
      setStatus(status, message(err));
      if (['auth/code-expired', 'auth/session-expired'].includes(err?.code) || attempts >= MAX_CODE_ATTEMPTS) confirmation = null;
      otpForm.code.select();
    } finally {
      verifyBtn.disabled = false;
    }
  });

  resendBtn.addEventListener('click', () => phone && send());

  function reset(newPhone) {
    confirmation = null;
    clearInterval(timer);
    otpForm.hidden = true;
    phoneForm.hidden = false;
    setStatus(status, '');
    if (newPhone !== undefined) phoneForm.phone.value = newPhone.replace(/^\+91/, '');
  }

  $('[data-change-number]', block).addEventListener('click', () => {
    reset();
    phoneForm.phone.focus();
  });

  return { status, reset };
}

/**
 * Send verification / reset emails with a "Continue" link back to this site. If Firebase doesn't accept
 * this site's address as a continue link (domain not authorised yet), send the email without it.
 */
async function withContinueUrl(send, path) {
  try {
    await send({ url: location.origin + link(path) });
  } catch (err) {
    if (['auth/unauthorized-continue-uri', 'auth/invalid-continue-uri', 'auth/missing-continue-uri'].includes(err?.code)) await send(undefined);
    else throw err;
  }
}

/** Error that sends an OTP flow back to the phone step with a message. */
const restart = (code) => Object.assign(new Error(code), { code, resetFlow: true });

/* ------------------------------------------------------------------ login page */
function initLogin(root) {
  if (!configured) return disableAll(root);

  let leaving = false;
  const go = () => { if (!leaving) { leaving = true; location.replace(safeNext()); } };
  // Already signed in when the page opens → straight on. (Only the first check: later sign-ins are
  // handled below, after we've confirmed the account is allowed.)
  const stopWatching = onAuthStateChanged(auth, (user) => {
    stopWatching();
    if (user) go();
  });

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
      await withContinueUrl((s) => sendPasswordResetEmail(auth, email, s), '/login/');
      setStatus(status, 'If an account exists for this email, we’ve sent a link to reset your password.', true);
    } catch (err) {
      if (['auth/user-not-found', 'auth/invalid-credential'].includes(err?.code)) {
        setStatus(status, 'If an account exists for this email, we’ve sent a link to reset your password.', true);
      } else setStatus(status, message(err));
    } finally {
      setTimeout(() => (e.target.disabled = false), RESEND_SECONDS * 1000);
    }
  });

  // Mobile OTP – only for numbers that belong to a registered account. Firebase would otherwise quietly
  // create a new, empty account for an unknown number, so we remove it again and point to sign-up.
  otpFlow($('[data-panel="phone"] [data-otp-block]', root), {
    start: (phone, verifier) => signInWithPhoneNumber(auth, phone, verifier),
    done: async (cred) => {
      if (getAdditionalUserInfo(cred)?.isNewUser) {
        await cred.user.delete().catch(() => signOut(auth));
        throw restart('paloveena/no-account');
      }
      go();
    },
  });
}

/* ------------------------------------------------------------------ register page */
// Order of events (so duplicates are impossible and no half-made accounts are left behind):
//   1. Customer fills in details – "Create account" stays disabled until everything is valid.
//   2. Mobile verified by SMS code. If that number already belongs to an account → refused (sign in instead).
//   3. Email + password attached to the new account. If the email is already used → the new account is
//      deleted again and the customer is told. Then name saved and a verification email sent.
function initRegister(root) {
  if (!configured) return disableAll(root);

  let registering = false;
  const stopWatching = onAuthStateChanged(auth, (user) => {
    stopWatching();
    if (user && !registering) location.replace(safeNext()); // already signed in
  });

  const form = $('[data-register-form]', root);
  const status = $('[data-register-status]', root);
  const submit = $('[type=submit]', form);
  const hint = $('[data-register-hint]', root);
  const detailsStep = $('[data-register-step="details"]', root);
  const verifyStep = $('[data-register-step="verify"]', root);

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

  // What is still missing? The button is only enabled when this list is empty.
  const missing = () => {
    const m = [];
    if (!cleanName(form.firstName.value)) m.push('first name');
    if (!cleanName(form.lastName.value)) m.push('last name');
    if (!validEmail(form.email.value.trim())) m.push('a valid email');
    if (!normalizeIndianMobile(form.phone.value)) m.push('a valid 10-digit mobile number');
    if (!passwordOk(form.password.value)) m.push('a stronger password');
    else if (form.password.value !== form.confirm.value) m.push('matching passwords');
    if (!form.terms.checked) m.push('accepting the policies');
    return m;
  };
  const update = () => {
    paintRules();
    const m = missing();
    submit.disabled = m.length > 0;
    hint.hidden = m.length === 0;
    hint.textContent = m.length ? `Still needed: ${m.join(', ')}.` : '';
  };
  form.addEventListener('input', update);
  form.addEventListener('change', update);
  update();

  let pending = null; // details kept in memory between step 1 and step 2 only

  const showDetails = (msg) => {
    verifyStep.hidden = true;
    detailsStep.hidden = false;
    setStatus(status, msg || '');
    update();
  };

  const otp = otpFlow($('[data-otp-block]', verifyStep), {
    start: (phone, verifier) => signInWithPhoneNumber(auth, phone, verifier),
    done: async (cred) => {
      registering = true;
      // Number already belongs to an account → don't touch that account, just sign out again.
      if (!getAdditionalUserInfo(cred)?.isNewUser) {
        await signOut(auth);
        registering = false;
        throw restart('paloveena/phone-registered');
      }
      try {
        await linkWithCredential(cred.user, EmailAuthProvider.credential(pending.email, pending.password));
      } catch (err) {
        await cred.user.delete().catch(() => signOut(auth)); // remove the half-made account
        registering = false;
        if (['auth/email-already-in-use', 'auth/credential-already-in-use'].includes(err?.code)) {
          otp.reset();
          showDetails(MESSAGES['auth/email-already-in-use']);
          form.email.focus();
          return;
        }
        throw restart(err?.code);
      }
      await updateProfile(cred.user, { displayName: `${pending.firstName} ${pending.lastName}` });
      if ((await saveProfile(cred.user, { ...pending, phone: cred.user.phoneNumber })) === 'phone-taken') {
        await cred.user.delete().catch(() => signOut(auth));
        registering = false;
        throw restart('paloveena/phone-registered');
      }
      withContinueUrl((s) => sendEmailVerification(cred.user, s), '/account/').catch(() => {}); // best effort; can be resent from the account page
      pending = null;
      location.replace(safeNext());
    },
  });

  // Free plan (no SMS): create the account straight away; the database still refuses a mobile number
  // that another account already uses.
  async function createWithoutSms(phone) {
    registering = true;
    busy(submit, true, 'Creating account…');
    setStatus(status, '');
    const fail = (text, field) => {
      registering = false;
      busy(submit, false);
      update();
      setStatus(status, text);
      field?.focus();
    };
    let user;
    try {
      ({ user } = await createUserWithEmailAndPassword(auth, pending.email, pending.password));
    } catch (err) {
      return fail(message(err), err?.code === 'auth/email-already-in-use' ? form.email : null);
    }
    try {
      if ((await saveProfile(user, { ...pending, phone })) === 'phone-taken') {
        await user.delete().catch(() => signOut(auth)); // remove the half-made account
        return fail(MESSAGES['paloveena/phone-registered'], form.phone);
      }
      await updateProfile(user, { displayName: `${pending.firstName} ${pending.lastName}` });
      withContinueUrl((s) => sendEmailVerification(user, s), '/account/').catch(() => {});
      pending = null;
      location.replace(safeNext());
    } catch (err) {
      await user.delete().catch(() => signOut(auth));
      fail(message(err));
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (missing().length) return update();
    pending = {
      firstName: cleanName(form.firstName.value),
      lastName: cleanName(form.lastName.value),
      email: form.email.value.trim(),
      password: form.password.value,
    };
    const phone = normalizeIndianMobile(form.phone.value);
    if (!REQUIRE_SMS) return createWithoutSms(phone);
    setStatus(status, '');
    detailsStep.hidden = true;
    verifyStep.hidden = false;
    otp.reset(phone); // fresh step 2 with the number from the form
    $('[data-phone-form] [type=submit]', verifyStep).focus();
  });

  $('[data-register-back]', root).addEventListener('click', () => {
    otp.reset();
    showDetails();
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
  function render(user, profile) {
    const name = user.displayName || (profile ? `${profile.firstName} ${profile.lastName}` : '');
    $('[data-account-greeting]', root).textContent = name ? `, ${name.split(' ')[0]}` : '';
    $('[data-account-name]', root).textContent = name || '—';
    $('[data-account-email]', root).textContent = user.email || 'Not added';
    const badge = $('[data-email-badge]', root);
    badge.hidden = !user.email;
    badge.textContent = user.emailVerified ? 'Verified' : 'Not verified';
    badge.className = `ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${user.emailVerified ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`;
    $('[data-email-unverified]', root).hidden = !user.email || user.emailVerified;
    const phone = user.phoneNumber || profile?.phone || '';
    $('[data-account-phone]', root).textContent = phone ? pretty(phone) : 'Not added';
    const phoneBadge = $('[data-phone-badge]', root);
    phoneBadge.hidden = !phone;
    phoneBadge.textContent = user.phoneNumber ? 'Verified' : 'Not verified';
    phoneBadge.className = `ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${user.phoneNumber ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`;
    // SMS verification is only offered once SMS is switched on (Blaze plan).
    $('[data-verify-phone-card]', root).hidden = Boolean(user.phoneNumber) || !REQUIRE_SMS;
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
    const profile = await loadProfile(user.uid);
    render(auth.currentUser || user, profile);
    // Owner / staff get a button to the admin panel. (The panel and database check this again –
    // the button is only a shortcut.)
    getDoc(doc(db, '_access', 'staff')).then(() => ($('[data-admin-link]', root).hidden = false)).catch(() => {});
    if (ready) return;
    ready = true;
    otpFlow($('[data-verify-phone-card] [data-otp-block]', root), {
      start: (phone, verifier) => linkWithPhoneNumber(auth.currentUser, phone, verifier),
      done: async () => {
        await reload(auth.currentUser);
        render(auth.currentUser, await loadProfile(auth.currentUser.uid));
        setStatus(status, 'Your mobile number is verified. You can now also sign in with an SMS code.', true);
      },
    });
  });

  $('[data-resend-verification]', root).addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      await withContinueUrl((s) => sendEmailVerification(auth.currentUser, s), '/account/');
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

/* ------------------------------------------------------------------ email links page (/auth/action/) */
// Opened from Firebase's emails once the "Action URL" points here. Handles: verify email, reset password,
// undo an email change. The one-time code is checked by Firebase; we remove it from the address bar at once.
function initAction(root) {
  const params = new URLSearchParams(location.search);
  const mode = params.get('mode');
  const code = params.get('oobCode');
  const cont = params.get('continueUrl');
  history.replaceState(null, '', location.pathname); // keep the one-time code out of history/bookmarks

  // "Continue" only ever goes back to this site.
  const safeContinue = (fallback) => {
    try {
      const u = new URL(cont);
      if (u.origin === location.origin) return u.pathname + u.search;
    } catch { /* missing or invalid */ }
    return link(fallback);
  };

  const ICON_OK = '<svg class="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg>';
  const ICON_BAD = '<svg class="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 7v6M12 17h.01"/></svg>';
  const show = ({ ok, title, text, button, href }) => {
    $('[data-action-loading]', root).hidden = true;
    $('[data-reset-form-wrap]', root).hidden = true;
    $('[data-action-result]', root).hidden = false;
    const icon = $('[data-action-icon]', root);
    icon.innerHTML = ok ? ICON_OK : ICON_BAD; // fixed markup, no user data
    icon.className = `mx-auto flex h-16 w-16 items-center justify-center rounded-full ${ok ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`;
    $('[data-action-title]', root).textContent = title;
    $('[data-action-text]', root).textContent = text;
    const btn = $('[data-action-button]', root);
    btn.textContent = button;
    btn.href = href;
    document.title = `${title} – Paloveenaa`;
  };
  const expired = (what, button, href) =>
    show({ ok: false, title: 'This link has expired', text: `${what} links can only be used once and expire after a while.`, button, href });

  if (!configured || !code || !mode) {
    return show({ ok: false, title: 'Link not valid', text: 'This link is incomplete. Please open the most recent email we sent you.', button: 'Go to sign in', href: link('/login/') });
  }

  if (mode === 'verifyEmail') {
    applyActionCode(auth, code)
      .then(async () => {
        if (auth.currentUser) await reload(auth.currentUser).catch(() => {});
        show({ ok: true, title: 'Email verified', text: 'Thank you! Your email address is confirmed and your account is all set.', button: 'Continue', href: safeContinue('/account/') });
      })
      .catch((err) =>
        ['auth/invalid-action-code', 'auth/expired-action-code'].includes(err?.code)
          ? expired('Verification', 'Go to my account', link('/account/'))
          : show({ ok: false, title: 'Something went wrong', text: message(err), button: 'Go to my account', href: link('/account/') })
      );
    return;
  }

  if (mode === 'resetPassword') {
    verifyPasswordResetCode(auth, code)
      .then((email) => {
        $('[data-action-loading]', root).hidden = true;
        $('[data-reset-form-wrap]', root).hidden = false;
        $('[data-reset-email]', root).textContent = email;
        const form = $('[data-reset-form]', root);
        const submit = $('[type=submit]', form);
        const statusEl = $('[data-reset-status]', root);
        const update = () => {
          const p = form.password.value;
          $$('[data-rule]', root).forEach((li) => {
            const ok = PASSWORD_RULES[li.dataset.rule](p);
            li.classList.toggle('text-green-700', ok);
            li.textContent = `${ok ? '✓' : '•'} ${li.textContent.replace(/^[✓•]\s*/, '')}`;
          });
          submit.disabled = !passwordOk(p) || p !== form.confirm.value;
        };
        form.addEventListener('input', update);
        update();
        form.password.focus();
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          if (submit.disabled) return;
          busy(submit, true, 'Saving…');
          try {
            await confirmPasswordReset(auth, code, form.password.value);
            form.reset();
            show({ ok: true, title: 'Password changed', text: 'Your new password is saved. You can now sign in with it.', button: 'Sign in', href: safeContinue('/login/') });
          } catch (err) {
            busy(submit, false);
            if (['auth/invalid-action-code', 'auth/expired-action-code'].includes(err?.code)) expired('Password reset', 'Go to sign in', link('/login/'));
            else setStatus(statusEl, message(err));
          }
        });
      })
      .catch(() => expired('Password reset', 'Go to sign in', link('/login/')));
    return;
  }

  if (mode === 'recoverEmail') {
    checkActionCode(auth, code)
      .then((info) => applyActionCode(auth, code).then(() =>
        show({ ok: true, title: 'Email restored', text: `Your sign-in email is back to ${info.data.email}. If you didn’t ask for the change, reset your password now.`, button: 'Reset my password', href: link('/login/') })
      ))
      .catch(() => expired('Email change', 'Go to sign in', link('/login/')));
    return;
  }

  show({ ok: false, title: 'Link not valid', text: 'We couldn’t recognise this link. Please open the most recent email we sent you.', button: 'Go to sign in', href: link('/login/') });
}

const pages = { '[data-login-page]': initLogin, '[data-register-page]': initRegister, '[data-account-page]': initAccount, '[data-action-page]': initAction };
for (const [sel, init] of Object.entries(pages)) {
  const root = $(sel);
  if (root) init(root);
}
