import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup,
  OAuthProvider,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  addDoc,
  query, 
  where, 
  orderBy,
  limit,
  Timestamp,
  deleteDoc,
  onSnapshot,
  setLogLevel
} from 'firebase/firestore';

// Configuration loaded from firebase-applet-config.json
const firebaseConfig = {
  apiKey: "AIzaSyDKcBbUdNWMDN8c25Du261sNMgZNnmxWZE",
  authDomain: "symmetric-silicon-r2t1j.firebaseapp.com",
  projectId: "symmetric-silicon-r2t1j",
  storageBucket: "symmetric-silicon-r2t1j.firebasestorage.app",
  messagingSenderId: "354839059532",
  appId: "1:354839059532:web:c6a5bccb491a2104aca8e9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const auth = getAuth(app);
// Use the specific firestore database ID provisioned if necessary
export const db = getFirestore(app, "ai-studio-rafikipredict-2c22d27a-9736-4b95-9d6f-62a766292c6f");
setLogLevel('error');

// Apple OAuth Provider
export const appleProvider = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');

// Microsoft OAuth Provider
export const microsoftProvider = new OAuthProvider('microsoft.com');
microsoftProvider.addScope('openid');
microsoftProvider.addScope('email');
microsoftProvider.addScope('profile');
microsoftProvider.setCustomParameters({
  prompt: 'select_account'
});

/**
 * Sign in with Apple OAuth
 */
export const signInWithApple = async () => {
  return await signInWithPopup(auth, appleProvider);
};

/**
 * Sign in with Microsoft OAuth
 */
export const signInWithMicrosoft = async () => {
  return await signInWithPopup(auth, microsoftProvider);
};

export {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  OAuthProvider,
  signOut,
  onAuthStateChanged,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  Timestamp
};
export type { FirebaseUser };
