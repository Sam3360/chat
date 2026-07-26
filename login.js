import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { auth, db } from './firebase-config.js';

const button = document.querySelector('#google-login');
const status = document.querySelector('#status');

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  const profile = await getDoc(doc(db, 'users', user.uid));
  location.replace(profile.exists() ? 'dashboard.html' : 'signup.html');
});

button.addEventListener('click', async () => {
  button.disabled = true;
  status.textContent = 'Opening Google sign-in…';
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error(error);
    status.textContent = error.code === 'auth/popup-closed-by-user' ? 'Sign-in cancelled.' : 'Could not sign in. Please try again.';
    button.disabled = false;
  }
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(console.warn);
