// Sends contact messages, newsletter sign-ups and orders.
// If a form service is set in src/data/settings.json (Web3Forms key or Formspree endpoint) data is posted there;
// otherwise the visitor's email app opens with everything pre-filled, addressed to the shop email.
import config from './config.js';

export const hasService = () => Boolean(config.forms.web3formsKey || config.forms.endpoint);

export function mailtoUrl(subject, text) {
  return `mailto:${config.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
}

/** @returns {Promise<{ok: boolean, method: 'service'|'mailto', error?: string}>} */
export async function send(subject, fields, text) {
  if (!hasService()) {
    window.location.href = mailtoUrl(subject, text);
    return { ok: true, method: 'mailto' };
  }
  const usingWeb3 = Boolean(config.forms.web3formsKey);
  const url = usingWeb3 ? 'https://api.web3forms.com/submit' : config.forms.endpoint;
  const payload = usingWeb3
    ? { access_key: config.forms.web3formsKey, subject, from_name: config.siteName, ...fields, message: text }
    : { _subject: subject, ...fields, message: text };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    return { ok: true, method: 'service' };
  } catch (e) {
    return { ok: false, method: 'service', error: e.message };
  }
}

export const formData = (form) => Object.fromEntries(new FormData(form).entries());

/** Built-in validation with friendly focus on the first invalid field. */
export function validate(form) {
  if (form.checkValidity()) return true;
  form.reportValidity();
  return false;
}
