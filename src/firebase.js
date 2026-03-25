// src/firebase.js
// Firebase v10 modular SDK
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// These values come from your Firebase project settings
// Add them as GitHub Secrets and they get injected at build time
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

// Only initialise if config is present
const isConfigured = Object.values(firebaseConfig).every(v => v && v !== 'undefined');

let app, db, auth;
if (isConfigured) {
  app  = initializeApp(firebaseConfig);
  db   = getFirestore(app);
  auth = getAuth(app);
} else {
  console.warn('[Firebase] Not configured — using localStorage fallback. Add VITE_FIREBASE_* secrets to GitHub.');
}

export { db, auth, isConfigured };
