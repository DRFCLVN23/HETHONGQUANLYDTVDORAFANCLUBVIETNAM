// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged 
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
const analytics = getAnalytics(app);
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
