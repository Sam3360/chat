import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { addDoc, collection, deleteField, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { auth, db } from './firebase-config.js';

const ADMIN_EMAILS = new Set(['samarth.chugh@avmschools.ac.in', 'iforgot3360@gmail.com', 'tavish.shukla@avmschools.ac.in']);
const $ = selector => document.querySelector(selector);
const messages = $('#messages');
const input = $('#message-text');
const sendButton = $('#send');
const toast = $('#toast');
let currentUser, profile, usernames = [], activeUsers = [], mode = 'global', lastReadAt = null, initialMessages = true;

const escapeHtml = value => String(value || '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
const avatar = data => data.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.username || '?')}&background=2563eb&color=fff`;
const isAdmin = () => ADMIN_EMAILS.has((currentUser?.email || '').toLowerCase());
const stamp = timestamp => timestamp?.toDate ? timestamp.toDate().toLocaleTimeString([], { hour:'numeric', minute:'2-digit' }) : 'sending…';
const tagText = text => escapeHtml(text).replace(/(^|\s)@([a-zA-Z0-9_]{3,24})/g, '$1<span class="mention">@$2</span>');
function showToast(text) { toast.textContent = text; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2600); }
function isRecent(timestamp) { return timestamp?.toMillis && Date.now() - timestamp.toMillis() < 125000; }

onAuthStateChanged(auth, async user => {
  if (!user) return location.replace('index.html');
  currentUser = user;
  const snapshot = await getDoc(doc(db, 'users', user.uid));
  if (!snapshot.exists()) return location.replace('signup.html');
  profile = snapshot.data();
  lastReadAt = profile.globalReadAt || null;
  $('#my-username').textContent = profile.username;
  $('#my-avatar').src = avatar(profile);
  await Promise.all([loadUsernames(), updatePresence()]);
  watchUsers();
  openGlobal();
  setInterval(updatePresence, 40000);
});

async function updatePresence() { if (currentUser) await updateDoc(doc(db, 'users', currentUser.uid), { lastActive: serverTimestamp() }).catch(console.warn); }
async function loadUsernames() { const snapshot = await getDocs(query(collection(db, 'users'), limit(250))); usernames = snapshot.docs.map(item => item.data().username).filter(Boolean); }
function watchUsers() {
  onSnapshot(query(collection(db, 'users'), orderBy('lastActive', 'desc'), limit(100)), snapshot => {
    activeUsers = snapshot.docs.map(item => ({ uid:item.id, ...item.data() })).filter(user => isRecent(user.lastActive));
    const list = $('#active-users');
    $('#active-count').textContent = activeUsers.length;
    list.innerHTML = activeUsers.length ? activeUsers.map(user => `<div class="active-user"><img src="${escapeHtml(avatar(user))}" alt=""><span>${escapeHtml(user.username)}${isAdminEmail(user.email) ? '<i title="Admin">◆</i>' : ''}</span><b></b></div>`).join('') : '<p class="empty-list">No one active right now.</p>';
  });
}
function isAdminEmail(email) { return ADMIN_EMAILS.has((email || '').toLowerCase()); }

function setMode(nextMode) {
  mode = nextMode;
  $('#global-link').classList.toggle('active', mode === 'global');
  $('#support-link').classList.toggle('active', mode === 'support');
  $('#chat-title').textContent = mode === 'global' ? 'All people' : 'Message Samarth';
  $('#chat-subtitle').textContent = mode === 'global' ? 'The global chat' : isAdmin() ? 'Private complaints inbox' : 'Private complaints and concerns';
  input.placeholder = mode === 'global' ? 'Message everyone — type @ to tag someone' : 'Write a private message to Samarth';
  $('#tag-suggestions').hidden = mode !== 'global';
}
function openGlobal() { setMode('global'); initialMessages = true; subscribeGlobal(); }
function openSupport() { setMode('support'); subscribeSupport(); }
$('#global-link').addEventListener('click', openGlobal);
$('#support-link').addEventListener('click', openSupport);

function subscribeGlobal() {
  const globalQuery = query(collection(db, 'messages'), orderBy('createdAt', 'asc'), limit(250));
  onSnapshot(globalQuery, snapshot => {
    if (mode !== 'global') return;
    const nearBottom = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 120;
    const unread = snapshot.docs.filter(item => item.data().uid !== currentUser.uid && item.data().createdAt?.toMillis && (!lastReadAt || item.data().createdAt.toMillis() > lastReadAt.toMillis())).length;
    $('#unread-badge').hidden = unread === 0;
    $('#unread-badge').textContent = unread > 99 ? '99+' : unread;
    messages.innerHTML = '';
    let markerShown = false;
    snapshot.forEach(item => {
      const data = item.data();
      if (!markerShown && unread && data.uid !== currentUser.uid && data.createdAt?.toMillis && (!lastReadAt || data.createdAt.toMillis() > lastReadAt.toMillis())) { messages.insertAdjacentHTML('beforeend', '<p class="new-marker">New messages</p>'); markerShown = true; }
      messages.append(renderGlobalMessage(item.id, data));
    });
    if (!initialMessages && !nearBottom) notifyNewMessages(snapshot);
    initialMessages = false;
    if (nearBottom) { messages.scrollTop = messages.scrollHeight; markGlobalRead(); }
  }, error => showToast(`Could not load messages: ${error.message}`));
}
function renderGlobalMessage(id, message) {
  const item = document.createElement('article'); item.className = 'message';
  const deleted = message.adminDeleted === true;
  const reactions = Object.entries(message.reactions || {}).map(([emoji, users]) => `<button class="reaction ${users?.[currentUser.uid] ? 'mine' : ''}" data-emoji="${escapeHtml(emoji)}">${escapeHtml(emoji)} ${Object.keys(users || {}).length}</button>`).join('');
  const adminMark = isAdminEmail(message.email) ? '<i class="admin-mark" title="Admin">◆</i>' : '';
  item.innerHTML = `<img class="message-avatar" src="${escapeHtml(avatar(message))}" alt=""><div class="message-content"><div class="message-meta"><b>${escapeHtml(message.username)}${adminMark}</b><span>${stamp(message.createdAt)}</span></div>${deleted ? '<p class="deleted-message">[ADMIN DELETED MESSAGE]</p>' : `<div class="message-text">${tagText(message.text)}</div>`}<div class="message-actions">${deleted ? '' : `${reactions}<button class="reaction" data-add>☺ React</button>`}${isAdmin() && !deleted ? '<button class="admin-delete" data-delete>Delete</button>' : ''}</div></div>`;
  item.querySelectorAll('[data-emoji]').forEach(button => button.addEventListener('click', () => toggleReaction(id, button.dataset.emoji, message.reactions || {})));
  item.querySelector('[data-add]')?.addEventListener('click', () => { const emoji = prompt('Choose one emoji:', '👍'); if (emoji) toggleReaction(id, [...emoji][0], message.reactions || {}); });
  item.querySelector('[data-delete]')?.addEventListener('click', async () => { if (confirm('Delete this message for everyone?')) await updateDoc(doc(db, 'messages', id), { adminDeleted:true, deletedBy:currentUser.uid, deletedAt:serverTimestamp(), text:deleteField(), reactions:deleteField() }); });
  return item;
}
async function toggleReaction(id, emoji, reactions) { const mine = Boolean(reactions?.[emoji]?.[currentUser.uid]); await updateDoc(doc(db, 'messages', id), { [`reactions.${emoji}.${currentUser.uid}`]: mine ? deleteField() : true }).catch(() => showToast('Could not update reaction.')); }
async function markGlobalRead() { if (!currentUser || mode !== 'global') return; lastReadAt = { toMillis:() => Date.now() }; $('#unread-badge').hidden = true; await updateDoc(doc(db, 'users', currentUser.uid), { globalReadAt:serverTimestamp() }).catch(console.warn); }
messages.addEventListener('scroll', () => { if (mode === 'global' && messages.scrollHeight - messages.scrollTop - messages.clientHeight < 120) markGlobalRead(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && mode === 'global') markGlobalRead(); });

function subscribeSupport() {
  const supportQuery = isAdmin() ? query(collection(db, 'supportMessages'), orderBy('createdAt', 'asc'), limit(300)) : query(collection(db, 'supportMessages'), where('participantUids', 'array-contains', currentUser.uid), orderBy('createdAt', 'asc'), limit(100));
  onSnapshot(supportQuery, snapshot => {
    if (mode !== 'support') return;
    messages.innerHTML = '<p class="welcome-message">This conversation is private. Use it for complaints or concerns.</p>';
    snapshot.forEach(item => messages.append(renderSupportMessage(item.data())));
    messages.scrollTop = messages.scrollHeight;
  }, error => showToast(`Could not load private messages: ${error.message}`));
}
function renderSupportMessage(message) {
  const item = document.createElement('article'); item.className = 'message';
  const mine = message.fromUid === currentUser.uid;
  item.innerHTML = `<img class="message-avatar" src="${escapeHtml(avatar(message))}" alt=""><div class="message-content"><div class="message-meta"><b>${escapeHtml(message.fromUsername)}${isAdminEmail(message.fromEmail) ? '<i class="admin-mark">◆</i>' : ''}</b><span>${stamp(message.createdAt)}</span></div><div class="message-text">${tagText(message.text)}</div>${isAdmin() && !mine ? '<div class="message-actions"><button class="reaction" data-reply>Reply privately</button></div>' : ''}</div>`;
  item.querySelector('[data-reply]')?.addEventListener('click', () => { input.value = `@${message.fromUsername} `; input.focus(); input.dataset.replyTo = message.fromUid; });
  return item;
}

function notifyNewMessages(snapshot) {
  if (Notification.permission !== 'granted' || !document.hidden) return;
  snapshot.docChanges().filter(change => change.type === 'added' && change.doc.data().uid !== currentUser.uid).forEach(change => {
    const data = change.doc.data(); new Notification(`Chat — ${data.username}`, { body:data.text || 'New message', icon:'favicon.png', silent:false });
  });
}
$('#enable-pings').addEventListener('click', async () => {
  if (!('Notification' in window)) return showToast('Your browser does not support notifications.');
  const permission = await Notification.requestPermission();
  $('#enable-pings').textContent = permission === 'granted' ? 'Pings on' : 'Enable pings';
  if (permission === 'granted') showToast('Browser pings enabled.');
});

async function sendMessage() {
  const text = input.value.trim(); if (!text) return;
  sendButton.disabled = true;
  try {
    if (mode === 'global') await addDoc(collection(db, 'messages'), { uid:currentUser.uid, username:profile.username, email:currentUser.email || '', photoURL:profile.photoURL || '', text, createdAt:serverTimestamp() });
    else {
      const replyTo = input.dataset.replyTo || null;
      const toUid = isAdmin() && replyTo ? replyTo : 'samarth.chugh@avmschools.ac.in';
      await addDoc(collection(db, 'supportMessages'), { fromUid:currentUser.uid, toUid, participantUids:[currentUser.uid, toUid], fromUsername:profile.username, fromEmail:currentUser.email || '', photoURL:profile.photoURL || '', text, createdAt:serverTimestamp() });
      delete input.dataset.replyTo;
    }
    input.value = '';
  } catch (error) { console.error(error); showToast('Could not send. Check the Firebase rules were published.'); }
  finally { sendButton.disabled = false; input.focus(); }
}
sendButton.addEventListener('click', sendMessage);
input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } });
input.addEventListener('input', () => {
  if (mode !== 'global') return;
  const match = input.value.match(/(?:^|\s)@([a-zA-Z0-9_]*)$/); const box = $('#tag-suggestions');
  if (!match) return box.hidden = true;
  const found = usernames.filter(name => name.toLowerCase().startsWith(match[1].toLowerCase()) && name !== profile.username).slice(0,5);
  if (!found.length) return box.hidden = true;
  box.innerHTML = found.map(name => `<button data-name="${escapeHtml(name)}">@${escapeHtml(name)}</button>`).join(''); box.hidden = false;
  box.querySelectorAll('button').forEach(button => button.addEventListener('click', () => { input.value = input.value.replace(/@([a-zA-Z0-9_]*)$/, `@${button.dataset.name} `); box.hidden = true; input.focus(); }));
});
$('#logout').addEventListener('click', async () => { await signOut(auth); location.replace('index.html'); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(console.warn);
