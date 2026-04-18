import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDvj80sbftsOX_Abc7SAAm7FPrM8lsm9Bk",
  authDomain: "adv-luandryapp.firebaseapp.com",
  projectId: "adv-luandryapp",
  storageBucket: "adv-luandryapp.firebasestorage.app",
  messagingSenderId: "366438215247",
  appId: "1:366438215247:web:9724e37d3294cd6551843a",
  measurementId: "G-36TBNE8WFW",
};

// Initialize Firebase only once
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Simple auth - works with Expo Go
const auth = getAuth(app);

// Firestore
const db = getFirestore(app);

export { app, auth, db };
export default { app, auth, db };