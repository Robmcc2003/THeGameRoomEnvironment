// initialise Firebase: auth, Firestore, analytics, storage, functions
// ref: https://youtu.be/a0KJ7l5sNGw?si=caznuBD8jCD2er9v
// ref: Analytics - https://firebase.google.com/docs/analytics/get-started
import { Analytics, isSupported as analyticsIsSupported, getAnalytics } from "firebase/analytics";
import { initializeApp } from "firebase/app";
import { inMemoryPersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCqHyPGP6-udX8Ge3gGNDTN2ClwEZO3vW0",
  authDomain: "thegameroomenvironment.firebaseapp.com",
  projectId: "thegameroomenvironment",
  storageBucket: "thegameroomenvironment.firebasestorage.app",
  messagingSenderId: "225637568895",
  appId: "1:225637568895:web:b3d7392906a03ba2f70a4a",
  measurementId: "G-7RXLHGRVK0"
};

export const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
    persistence: inMemoryPersistence
});

export let analytics: Analytics | null = null;
// analytics only if supported (skip on some native)
(async () => {
  try {
    const ok = await analyticsIsSupported();
    analytics = ok ? getAnalytics(app) : null;
  } catch {
    analytics = null;
  }
})();

export const db = getFirestore(app);
export const functions = getFunctions(app, "europe-west1");
export const storage = getStorage(app);