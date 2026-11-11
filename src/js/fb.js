// Shared Firebase setup (one app for login, orders and the admin panel).
import config from './config.js';
import { initializeApp } from '../vendor/firebase-13.1.0/firebase-app.js';
import { getAuth, connectAuthEmulator } from '../vendor/firebase-13.1.0/firebase-auth.js';

export const fbConfig = config.firebase || {};
export const configured = Boolean(fbConfig.apiKey && fbConfig.authDomain && fbConfig.projectId && fbConfig.appId);
export const link = (p) => (config.base || '') + p; // adds the sub-folder on GitHub Pages
const local = ['localhost', '127.0.0.1'].includes(location.hostname);
export const emulators = local && fbConfig.emulator ? fbConfig.emulator : null; // { auth, firestore } – local testing only

export const app = configured
  ? initializeApp({ apiKey: fbConfig.apiKey, authDomain: fbConfig.authDomain, projectId: fbConfig.projectId, appId: fbConfig.appId })
  : null;
export const auth = app ? getAuth(app) : null;
if (auth) {
  auth.useDeviceLanguage();
  if (emulators?.auth) connectAuthEmulator(auth, `http://${emulators.auth}`, { disableWarnings: true });
}

/** Resolves with the signed-in user (or null) once Firebase has restored the session. */
export const currentUser = () =>
  auth ? auth.authStateReady().then(() => auth.currentUser) : Promise.resolve(null);
