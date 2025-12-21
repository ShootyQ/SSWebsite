// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAcUO8vzIyYVxrTpOcgEDpNAvO9aiLgRHw",
  authDomain: "socialstudiesclass-160bd.firebaseapp.com",
  projectId: "socialstudiesclass-160bd",
  storageBucket: "socialstudiesclass-160bd.firebasestorage.app",
  messagingSenderId: "64887627542",
  appId: "1:64887627542:web:cad41c5f53f4889e217a37",
  measurementId: "G-8Y8LM0VPC8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export { app, analytics, auth, db, provider };
