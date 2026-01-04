import type { Auth, User } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import type { FirebaseStorage } from "firebase/storage";

import { firebaseApp } from "./firebaseApp";

let authInstance: Auth | null = null;
export async function getAuthClient(): Promise<Auth> {
  if (authInstance) return authInstance;
  const { getAuth } = await import("firebase/auth");
  authInstance = getAuth(firebaseApp);
  return authInstance;
}

export async function onAuthStateChangedClient(
  callback: (user: User | null) => void,
) {
  const [{ onAuthStateChanged }, auth] = await Promise.all([
    import("firebase/auth"),
    getAuthClient(),
  ]);
  return onAuthStateChanged(auth, callback);
}

export async function signInWithEmailPassword(email: string, password: string) {
  const [{ signInWithEmailAndPassword }, auth] = await Promise.all([
    import("firebase/auth"),
    getAuthClient(),
  ]);
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signOutClient() {
  const [{ signOut }, auth] = await Promise.all([
    import("firebase/auth"),
    getAuthClient(),
  ]);
  return signOut(auth);
}

let firestoreInstance: Firestore | null = null;
export async function getFirestoreClient(): Promise<Firestore> {
  if (firestoreInstance) return firestoreInstance;
  const { getFirestore } = await import("firebase/firestore");
  firestoreInstance = getFirestore(firebaseApp);
  return firestoreInstance;
}

let storageInstance: FirebaseStorage | null = null;
export async function getStorageClient(): Promise<FirebaseStorage> {
  if (storageInstance) return storageInstance;
  const { getStorage } = await import("firebase/storage");
  storageInstance = getStorage(firebaseApp);
  return storageInstance;
}

/**
 * Optional: call this on the client if you want Google Analytics.
 * Safe-guarded to only run in supported browser environments.
 */
export async function initFirebaseAnalytics() {
  if (typeof window === "undefined") return null;
  const { getAnalytics, isSupported } = await import("firebase/analytics");
  if (!(await isSupported())) return null;
  return getAnalytics(firebaseApp);
}


