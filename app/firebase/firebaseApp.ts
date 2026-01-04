import { getApps, initializeApp, type FirebaseApp } from "firebase/app";

/**
 * NOTE:
 * Firebase "apiKey" etc. are not secrets, but you may still prefer moving these
 * into environment variables later (VITE_FIREBASE_*).
 */
const firebaseConfig = {
  apiKey: "AIzaSyBItcMtHTX5DjJIBTOTXCsOyGkEw0invds",
  authDomain: "jkfc-tournment.firebaseapp.com",
  projectId: "jkfc-tournment",
  storageBucket: "jkfc-tournment.firebasestorage.app",
  messagingSenderId: "698633110896",
  appId: "1:698633110896:web:4d33f551f8debaeeb3bbb5",
  measurementId: "G-DHHC7DFZGL",
} as const;

export function getFirebaseApp(): FirebaseApp {
  if (getApps().length) return getApps()[0]!;
  return initializeApp(firebaseConfig);
}

export const firebaseApp = getFirebaseApp();


