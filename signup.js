import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { doc, getDoc, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { auth, db } from './firebase-config.js';

const usernameInput = document.querySelector('#username');
const button = document.querySelector('#finish-signup');
const status = document.querySelector('#status');
let currentUser;

onAuthStateChanged(auth, async (user) => {
  if (!user) return location.replace('index.html');
  currentUser = user;
  const profile = await getDoc(doc(db, 'users', user.uid));
  if (profile.exists()) return location.replace('dashboard.html');
  document.querySelector('#account-email').textContent = user.email || 'Google';
  document.querySelector('#account-avatar').src = user.photoURL || 'favicon.png';
});

async function createProfile() {
  const username = usernameInput.value.trim();
  const usernameKey = username.toLowerCase();
  if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
    status.textContent = 'Use 3–24 letters, numbers, or underscores.';
    usernameInput.focus();
    return;
  }
  button.disabled = true;
  status.textContent = 'Saving your profile…';
  try {
    await runTransaction(db, async (transaction) => {
      const userRef = doc(db, 'users', currentUser.uid);
      const usernameRef = doc(db, 'usernames', usernameKey);
      const [userDoc, usernameDoc] = await Promise.all([transaction.get(userRef), transaction.get(usernameRef)]);
      if (userDoc.exists()) return;
      if (usernameDoc.exists()) throw new Error('That username is already taken.');
      transaction.set(usernameRef, { uid: currentUser.uid, username, createdAt: serverTimestamp() });
      transaction.set(userRef, { uid: currentUser.uid, username, usernameKey, displayName: currentUser.displayName || username, email: currentUser.email || '', photoURL: currentUser.photoURL || '', joinedAt: serverTimestamp() });
    });
    location.replace('dashboard.html');
  } catch (error) {
    console.error(error);
    status.textContent = error.message || 'Could not create your profile.';
    button.disabled = false;
  }
}

button.addEventListener('click', createProfile);
usernameInput.addEventListener('keydown', event => { if (event.key === 'Enter') createProfile(); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(console.warn);
