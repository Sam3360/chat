import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCYQOzIfVcIW4AZoNyFbDAfA7BmWIHDZE8',
  authDomain: 'chatcs-e5c82.firebaseapp.com',
  projectId: 'chatcs-e5c82',
  storageBucket: 'chatcs-e5c82.firebasestorage.app',
  messagingSenderId: '675555373080',
  appId: '1:675555373080:web:3f9eafa70b439d8250536d'
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
