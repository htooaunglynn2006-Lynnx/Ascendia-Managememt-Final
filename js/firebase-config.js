// js/firebase-config.js
// Database only configuration (NO AUTHENTICATION)

// Firebase configuration from your project
const firebaseConfig = {
    apiKey: "AIzaSyC53tnpw-3Uupzc1Me8ZGEDzy903yG-S0Y",
    authDomain: "ascedia-60dd4.firebaseapp.com",
    projectId: "ascedia-60dd4",
    storageBucket: "ascedia-60dd4.firebasestorage.app",
    messagingSenderId: "77398379374",
    appId: "1:77398379374:web:5f1c72cd77f950a24dcf7f",
    measurementId: "G-EZYNMLWF4W"
};

// Initialize Firebase (compat version for simplicity)
if (typeof firebase === 'undefined') {
    console.error('Firebase SDK not loaded');
} else {
    // Check if Firebase is already initialized
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    
    // Initialize Firestore
    const db = firebase.firestore();
    const analytics = firebase.analytics();
    
    // For debugging
    console.log('Firebase initialized successfully');
    console.log('Project ID:', firebaseConfig.projectId);
    
    // Export for use in other files
    window.firebaseDb = db;
    window.firebaseAnalytics = analytics;
}