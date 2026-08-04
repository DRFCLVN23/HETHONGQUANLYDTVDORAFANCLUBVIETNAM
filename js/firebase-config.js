// Global handler to suppress unhandled promise rejections from blocked analytics/tracking scripts
// (e.g., ad-blockers or browser policies blocking google-analytics.com / googletagmanager.com)
window.addEventListener('unhandledrejection', function(event) {
  // Suppress if rejection reason is undefined (common pattern when analytics fetch is blocked)
  if (event.reason === undefined || event.reason === null) {
    event.preventDefault();
    return;
  }
  // Suppress if rejection is related to analytics/GA network requests
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
  // Suppress fetch errors from analytics endpoints
  if (event.req && event.req.url && (
      event.req.url.includes('google-analytics') || 
      event.req.url.includes('google.com/g/collect'))) {
    event.preventDefault();
  }
});

// Import the functions you need from the SDKs you need
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

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAxMuHOdj8a8c3lDpZG_k8fFUV6tCVkH8w",
  authDomain: "hethongquanlyadichthuatvien.firebaseapp.com",
  projectId: "hethongquanlyadichthuatvien",
  storageBucket: "hethongquanlyadichthuatvien.firebasestorage.app",
  messagingSenderId: "78223981328",
  appId: "1:78223981328:web:8667950575d90be2420395",
  measurementId: "G-X6CQJ1PTY9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// Wrap analytics in try-catch to prevent unhandled promise rejection
// when GA requests are blocked by ad-blocker/browser extension
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
