

window.addEventListener('unhandledrejection', function(event) {
  
  if (event.reason === undefined || event.reason === null) {
    event.preventDefault();
    return;
  }
  
  if (event.reason && typeof event.reason.message === 'string') {
    const msg = event.reason.message.toLowerCase();
    if (msg.includes('google-analytics') || 
        msg.includes('google.com/g/collect') || 
        msg.includes('googletagmanager') ||
        msg.includes('googleads') ||
        msg.includes('analytics')) {
      event.preventDefault();
      return;
    }
  }
  
  if (event.req && event.req.url && (
      event.req.url.includes('google-analytics') || 
      event.req.url.includes('google.com/g/collect'))) {
    event.preventDefault();
  }
});

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
    getFirestore, 
    collection, 
    doc, 
    getDocs, 
    getDoc, 
    setDoc, 
    updateDoc, 
    deleteDoc,
    query,
    where,
    addDoc,
    Timestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyAxMuHOdj8a8c3lDpZG_k8fFUV6tCVkH8w",
  authDomain: "hethongquanlyadichthuatvien.firebaseapp.com",
  projectId: "hethongquanlyadichthuatvien",
  storageBucket: "hethongquanlyadichthuatvien.firebasestorage.app",
  messagingSenderId: "78223981328",
  appId: "1:78223981328:web:8667950575d90be2420395",
  measurementId: "G-X6CQJ1PTY9"
};

const app = initializeApp(firebaseConfig);

let analytics;
try {
  analytics = getAnalytics(app);
} catch (e) {
  console.warn("Analytics initialization failed (likely blocked):", e);
}
const auth = getAuth(app);
const db = getFirestore(app);

export { 
    auth, 
    db, 
    analytics,
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    collection, 
    doc, 
    getDocs, 
    getDoc, 
    setDoc, 
    updateDoc, 
    deleteDoc,
    query,
    where,
    addDoc,
    Timestamp
};
