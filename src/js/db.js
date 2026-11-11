// Firestore for customer pages (sign-up, checkout, my orders). "Lite" build: small and fast, no live updates.
// The admin panel uses the full build (admin.js) because it shows new orders live.
import { app, emulators } from './fb.js';
import {
  getFirestore, connectFirestoreEmulator, doc, getDoc, getDocs, setDoc, updateDoc, writeBatch, collection, query, where,
  serverTimestamp, Timestamp,
} from '../vendor/firebase-13.1.0/firebase-firestore-lite.js';

export const db = app ? getFirestore(app) : null;
if (db && emulators?.firestore) {
  const [host, port] = emulators.firestore.split(':');
  connectFirestoreEmulator(db, host, Number(port));
}

export { doc, getDoc, getDocs, setDoc, updateDoc, writeBatch, collection, query, where, serverTimestamp, Timestamp };

/** The signed-in customer's saved profile ({ firstName, lastName, email, phone, … }), or null. */
export async function loadProfile(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}
