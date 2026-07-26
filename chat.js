import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { addDoc, collection, deleteField, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getDownloadURL, ref, uploadBytes } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';
import { auth, db, storage } from './firebase-config.js';

const ADMIN_EMAILS = new Set(['samarth.chugh@avmschools.ac.in', 'iforgot3360@gmail.com']);
const $ = selector => document.querySelector(selector);
const messages = $('#messages');
const input = $('#message-text');
const sendButton = $('#send');
const toast = $('#toast');
let currentUser;
let profile;
let selectedImage;
let usernames = [];

function escapeHtml(value) { return String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
function avatar(data) { return data.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.username || '?')}&background=2563eb&color=fff`; }
function isAdmin() { return ADMIN_EMAILS.has((currentUser?.email || '').toLowerCase()); }
function showToast(text) { toast.textContent = text; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2500); }
function formatTime(timestamp) { return timestamp?.toDate ? timestamp.toDate().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'sending…'; }
function formatText(text) { return escapeHtml(text).replace(/(^|\s)@([a-zA-Z0-9_]{3,24})/g, '$1<span class="mention">@$2</span>'); }

onAuthStateChanged(auth, async user => {
  if (!user) return location.replace('index.html');
  currentUser = user;
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  if (!userDoc.exists()) return location.replace('signup.html');
  profile = userDoc.data();
  $('#my-username').textContent = profile.username;
  $('#my-avatar').src = avatar(profile);
  await loadUsernames();
  subscribeToMessages();
});

async function loadUsernames() {
  const snapshot = await getDocs(query(collection(db, 'users'), limit(250)));
  usernames = snapshot.docs.map(item => item.data().username).filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function subscribeToMessages() {
  const messageQuery = query(collection(db, 'messages'), orderBy('createdAt', 'asc'), limit(250));
  onSnapshot(messageQuery, snapshot => {
    const nearBottom = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 120;
    messages.querySelectorAll('.message').forEach(item => item.remove());
    snapshot.forEach(item => messages.append(renderMessage(item.id, item.data())));
    if (nearBottom) messages.scrollTop = messages.scrollHeight;
  }, error => showToast(`Could not load messages: ${error.message}`));
}

function renderMessage(id, message) {
  const item = document.createElement('article');
  item.className = 'message';
  const removed = message.adminDeleted === true;
  const reactionData = message.reactions || {};
  const reactions = Object.entries(reactionData).map(([emoji, users]) => `<button class="reaction ${users?.[currentUser.uid] ? 'mine' : ''}" data-emoji="${escapeHtml(emoji)}">${escapeHtml(emoji)} ${Object.keys(users || {}).length}</button>`).join('');
  item.innerHTML = `<img class="message-avatar" src="${escapeHtml(avatar(message))}" alt=""><div class="message-content"><div class="message-meta"><b>${escapeHtml(message.username)}</b><span>${formatTime(message.createdAt)}</span></div>${removed ? '<p class="deleted-message">[ADMIN DELETED MESSAGE]</p>' : `${message.text ? `<div class="message-text">${formatText(message.text)}</div>` : ''}${message.imageUrl ? `<img class="message-image" src="${escapeHtml(message.imageUrl)}" alt="Shared image">` : ''}`}<div class="message-actions">${removed ? '' : `${reactions}<button class="reaction add-reaction" data-add-reaction>☺ React</button>`}${isAdmin() && !removed ? '<button class="admin-delete" data-delete>Delete</button>' : ''}</div></div>`;
  item.querySelectorAll('[data-emoji]').forEach(button => button.addEventListener('click', () => toggleReaction(id, button.dataset.emoji, reactionData)));
  item.querySelector('[data-add-reaction]')?.addEventListener('click', () => {
    const emoji = prompt('Choose one emoji reaction:', '👍');
    if (emoji) toggleReaction(id, [...emoji][0], reactionData);
  });
  item.querySelector('[data-delete]')?.addEventListener('click', async () => {
    if (!confirm('Delete this message for everyone?')) return;
    await updateDoc(doc(db, 'messages', id), { adminDeleted: true, deletedBy: currentUser.uid, deletedAt: serverTimestamp(), text: deleteField(), imageUrl: deleteField(), reactions: deleteField() });
  });
  return item;
}

async function toggleReaction(messageId, emoji, allReactions) {
  const reacted = Boolean(allReactions?.[emoji]?.[currentUser.uid]);
  try { await updateDoc(doc(db, 'messages', messageId), { [`reactions.${emoji}.${currentUser.uid}`]: reacted ? deleteField() : true }); }
  catch (error) { showToast('Could not update reaction.'); console.error(error); }
}

function clearImage() { selectedImage = undefined; $('#image-file').value = ''; $('#image-preview').hidden = true; }
$('#image-file').addEventListener('change', event => {
  const image = event.target.files[0];
  if (!image) return;
  if (image.size > 5 * 1024 * 1024) { showToast('Images must be 5 MB or smaller.'); event.target.value = ''; return; }
  selectedImage = image;
  $('#preview-image').src = URL.createObjectURL(image);
  $('#preview-name').textContent = image.name;
  $('#image-preview').hidden = false;
});
$('#clear-image').addEventListener('click', clearImage);

async function sendMessage() {
  const text = input.value.trim();
  if (!text && !selectedImage) return;
  sendButton.disabled = true;
  try {
    let imageUrl = '';
    if (selectedImage) {
      const safeName = selectedImage.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const imageRef = ref(storage, `chat-images/${currentUser.uid}/${Date.now()}-${safeName}`);
      await uploadBytes(imageRef, selectedImage, { contentType: selectedImage.type });
      imageUrl = await getDownloadURL(imageRef);
    }
    await addDoc(collection(db, 'messages'), { uid: currentUser.uid, username: profile.username, photoURL: profile.photoURL || '', text, imageUrl, createdAt: serverTimestamp() });
    input.value = '';
    clearImage();
  } catch (error) { console.error(error); showToast('Could not send message. Check Firebase rules.'); }
  finally { sendButton.disabled = false; input.focus(); }
}
sendButton.addEventListener('click', sendMessage);
input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } });

input.addEventListener('input', () => {
  const match = input.value.match(/(?:^|\s)@([a-zA-Z0-9_]*)$/);
  const box = $('#tag-suggestions');
  if (!match) { box.hidden = true; return; }
  const matches = usernames.filter(name => name.toLowerCase().startsWith(match[1].toLowerCase()) && name !== profile.username).slice(0, 5);
  if (!matches.length) { box.hidden = true; return; }
  box.innerHTML = matches.map(name => `<button data-name="${escapeHtml(name)}">@${escapeHtml(name)}</button>`).join('');
  box.hidden = false;
  box.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
    input.value = input.value.replace(/@([a-zA-Z0-9_]*)$/, `@${button.dataset.name} `);
    box.hidden = true;
    input.focus();
  }));
});

$('#logout').addEventListener('click', async () => { await signOut(auth); location.replace('index.html'); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(console.warn);
