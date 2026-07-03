/* ===== Fire Database - App Logic ===== */
'use strict';

// ─── Configuration ──────────────────────────────────────────
const ADMIN_EMAIL = 'sadithas59@gmail.com';

// ─── State ──────────────────────────────────────────────────
let currentUser   = null;
let allPosts      = [];
let allUsers      = [];
let homeFiltVal   = 'all';
let browseFiltVal = 'all';
let editingId     = null;
let uploadType    = 'post';
let linkRowCount  = 0;

// ─── Firebase Wait ──────────────────────────────────────────
function waitFB(cb, n = 0) {
  if (window._fb) return cb();
  if (n > 80) {
    hideFBLoad();
    showNotif('⚠️ Firebase not connected! Please refresh.', 6000);
    return;
  }
  setTimeout(() => waitFB(cb, n + 1), 150);
}

// ─── Init ───────────────────────────────────────────────────
function initApp() {
  const { db, collection, query, orderBy, onSnapshot } = window._fb;

  // Listen to posts collection (real-time)
  onSnapshot(
    query(collection(db, 'posts'), orderBy('createdTs', 'desc')),
    (snap) => {
      allPosts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderHome();
      renderBrowse();
      renderPanel();
      renderAContent();
      updateStats();
    },
    (err) => {
      console.error('Firestore error:', err);
      hideFBLoad();
      showNotif('⚠️ Firestore error: ' + err.message, 6000);
    }
  );

  // Listen to users collection (real-time)
  onSnapshot(collection(db, 'users'), (snap) => {
    allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAUsers();
    updateStats();
  });

  hideFBLoad();
}

function hideFBLoad() {
  const el = document.getElementById('fbLoad');
  if (!el) return;
  el.style.opacity = '0';
  setTimeout(() => { if (el.parentNode) el.remove(); }, 520);
}

// ─── Auth Change Handler ────────────────────────────────────
window.onFBAuthChange = async function (user) {
  if (user) {
    const { db, doc, getDoc } = window._fb;
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      const p = snap.exists() ? snap.data() : {};
      currentUser = {
        uid: user.uid,
        email: user.email,
        ...p,
        isAdmin: user.email === ADMIN_EMAIL
      };
    } catch (e) {
      currentUser = {
        uid: user.uid,
        email: user.email,
        name: user.email.split('@')[0],
        isAdmin: user.email === ADMIN_EMAIL
      };
    }

    document.getElementById('authBtn').textContent = 'Logout';
    document.getElementById('nb-panel').classList.remove('hidden');
    if (currentUser.isAdmin) {
      document.getElementById('nb-admin').classList.remove('hidden');
    }
    renderPanel();
  } else {
    currentUser = null;
    document.getElementById('authBtn').textContent = 'Login';
    document.getElementById('nb-panel').classList.add('hidden');
    document.getElementById('nb-admin').classList.add('hidden');
  }
};

// ─── Notification ───────────────────────────────────────────
function showNotif(msg, ms = 3200) {
  const el = document.getElementById('notif');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), ms);
}

// ─── Modal Helpers ──────────────────────────────────────────
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}
function swapModal(a, b) {
  closeModal(a);
  openModal(b);
}

// Close modal on backdrop click
document.addEventListener('click', function (e) {
  if (e.target.classList.contains('modal-bg')) {
    e.target.classList.add('hidden');
  }
});

// Close modal on Escape key
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-bg:not(.hidden)').forEach(el => {
      el.classList.add('hidden');
    });
  }
});

// ─── Page Navigation ────────────────────────────────────────
const PAGES = ['pg-home', 'pg-browse', 'pg-panel', 'pg-admin'];
const NAV_MAP = { home: 'nb-home', browse: 'nb-browse', panel: 'nb-panel', admin: 'nb-admin' };

function goPage(name) {
  PAGES.forEach(p => {
    const el = document.getElementById(p);
    if (el) el.classList.add('hidden');
  });
  const target = document.getElementById('pg-' + name);
  if (target) target.classList.remove('hidden');

  Object.values(NAV_MAP).forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.classList.remove('active');
  });
  const activeBtn = document.getElementById(NAV_MAP[name]);
  if (activeBtn) activeBtn.classList.add('active');

  // Render page content
  switch (name) {
    case 'home':   renderHome(); break;
    case 'browse': renderBrowse(); break;
    case 'panel':  renderPanel(); break;
    case 'admin':  renderAContent(); break;
  }
}

// ─── Auth ───────────────────────────────────────────────────
function handleAuth() {
  if (currentUser) {
    window._fb.signOut(window._fb.auth);
    showNotif('✅ Logged out!');
    goPage('home');
  } else {
    openModal('m-login');
  }
}

async function doLogin() {
  const email = document.getElementById('l-email').value.trim();
  const pass = document.getElementById('l-pass').value;

  if (!email || !pass) {
    showNotif('⚠️ Enter email & password!');
    return;
  }

  // Admin auto-create if first time
  if (email === ADMIN_EMAIL) {
    try {
      await window._fb.signInWithEmailAndPassword(window._fb.auth, email, pass);
    } catch (loginErr) {
      // Admin account doesn't exist yet — create it
      try {
        const cred = await window._fb.createUserWithEmailAndPassword(window._fb.auth, email, pass);
        const { db, doc, setDoc, serverTimestamp } = window._fb;
        await setDoc(doc(db, 'users', cred.user.uid), {
          name: 'Super Admin',
          email: email,
          createdAt: new Date().toLocaleString(),
          createdTs: serverTimestamp(),
          downloads: 0
        });
      } catch (createErr) {
        showNotif('❌ Admin login failed: ' + createErr.message);
        return;
      }
    }
    closeModal('m-login');
    showNotif('🔥 Logged in as Admin!');
    setTimeout(() => goPage('admin'), 200);
    return;
  }

  // Regular user login
  try {
    await window._fb.signInWithEmailAndPassword(window._fb.auth, email, pass);
    closeModal('m-login');
    showNotif('🔥 Logged in!');
    setTimeout(() => goPage('panel'), 200);
  } catch (e) {
    const msg = e.code === 'auth/invalid-credential'
      ? 'Wrong email or password!'
      : e.code === 'auth/user-not-found'
        ? 'No account found with this email!'
        : e.message;
    showNotif('❌ ' + msg);
  }
}

async function doRegister() {
  const name = document.getElementById('r-name').value.trim();
  const email = document.getElementById('r-email').value.trim();
  const pass = document.getElementById('r-pass').value;
  const pass2 = document.getElementById('r-pass2').value;

  if (!name) { showNotif('⚠️ Enter your name!'); return; }
  if (!email) { showNotif('⚠️ Enter your email!'); return; }
  if (pass.length < 6) { showNotif('⚠️ Password must be at least 6 characters!'); return; }
  if (pass !== pass2) { showNotif('⚠️ Passwords do not match!'); return; }
  if (email === ADMIN_EMAIL) { showNotif('⚠️ This email is reserved!'); return; }

  try {
    const cred = await window._fb.createUserWithEmailAndPassword(window._fb.auth, email, pass);
    const { db, doc, setDoc, serverTimestamp } = window._fb;
    await setDoc(doc(db, 'users', cred.user.uid), {
      name: name,
      email: email,
      createdAt: new Date().toLocaleString(),
      createdTs: serverTimestamp(),
      downloads: 0
    });
    closeModal('m-reg');
    showNotif('🔥 Welcome, ' + name + '!');
    setTimeout(() => goPage('panel'), 200);
  } catch (e) {
    const msg = e.code === 'auth/email-already-in-use'
      ? 'Email already registered!'
      : e.message;
    showNotif('❌ ' + msg);
  }
}

// ─── Password Strength Check ────────────────────────────────
function checkStr(v) {
  const bar = document.getElementById('strBar');
  const txt = document.getElementById('strTxt');
  if (!bar || !txt) return;

  if (!v) {
    bar.style.width = '0';
    txt.textContent = '';
    return;
  }

  let s = 0;
  if (v.length >= 6) s++;
  if (v.length >= 10) s++;
  if (/[A-Z]/.test(v)) s++;
  if (/[0-9]/.test(v)) s++;
  if (/[^A-Za-z0-9]/.test(v)) s++;

  if (s <= 2) {
    bar.style.cssText = 'width:33%;background:#ef4444;height:4px;border-radius:999px;margin-top:6px;';
    txt.style.color = '#ef4444';
    txt.textContent = 'Weak';
  } else if (s <= 3) {
    bar.style.cssText = 'width:66%;background:#f97316;height:4px;border-radius:999px;margin-top:6px;';
    txt.style.color = '#f97316';
    txt.textContent = 'Medium';
  } else {
    bar.style.cssText = 'width:100%;background:#22c55e;height:4px;border-radius:999px;margin-top:6px;';
    txt.style.color = '#22c55e';
    txt.textContent = 'Strong!';
  }
}

// ─── Upload Type ────────────────────────────────────────────
function setType(t) {
  uploadType = t;
  const postEl = document.getElementById('tp-post');
  const fileEl = document.getElementById('tp-file');
  const linksSection = document.getElementById('fileLinksSection');
  if (postEl) postEl.className = 'ftag' + (t === 'post' ? ' on' : '');
  if (fileEl) fileEl.className = 'ftag' + (t === 'file' ? ' on' : '');
  if (linksSection) linksSection.classList.toggle('hidden', t !== 'file');

  // Auto-add first link row for file type
  if (t === 'file' && document.getElementById('linksList')?.children.length === 0) {
    addLinkRow();
  }
}

// ─── Link Rows ──────────────────────────────────────────────
function addLinkRow(name, url) {
  name = name || '';
  url = url || '';
  linkRowCount++;
  const id = 'lr-' + linkRowCount;
  const div = document.createElement('div');
  div.className = 'link-row';
  div.id = id;
  div.innerHTML =
    '<div class="link-row-num">' + linkRowCount + '</div>' +
    '<div class="link-row-body">' +
      '<input class="inp" placeholder="File name (e.g. Part 1, Chapter 1…)" value="' + esc(name) + '" data-role="lname">' +
      '<input class="inp" placeholder="Download URL (Google Drive / Mega / MediaFire…)" value="' + esc(url) + '" data-role="lurl">' +
    '</div>' +
    '<button class="btn btn-danger btn-sm" style="margin-top:2px;align-self:flex-start;" onclick="removeLinkRow(\'' + id + '\')">✕</button>';
  document.getElementById('linksList').appendChild(div);
}

function removeLinkRow(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function getLinks() {
  const rows = document.querySelectorAll('#linksList .link-row');
  const links = [];
  rows.forEach(row => {
    const nameEl = row.querySelector('[data-role="lname"]');
    const urlEl = row.querySelector('[data-role="lurl"]');
    const name = nameEl ? nameEl.value.trim() : '';
    const url = urlEl ? urlEl.value.trim() : '';
    if (url) links.push({ name: name || 'Download', url: url });
  });
  return links;
}

// ─── Open Add / Edit Modal ──────────────────────────────────
function openAddModal(postId) {
  if (!currentUser) {
    openModal('m-login');
    return;
  }

  editingId = postId || null;

  const titleEl = document.getElementById('addTitle');
  const submitBtn = document.getElementById('addSubmitBtn');

  if (postId) {
    const p = allPosts.find(x => x.id === postId);
    if (!p) return;
    titleEl.textContent = 'Edit Post';
    submitBtn.textContent = '💾 Update';
    document.getElementById('a-title').value = p.title || '';
    document.getElementById('a-desc').value = p.desc || '';
    document.getElementById('a-cat').value = p.cat || 'general';
    document.getElementById('a-cover').value = p.cover || '';

    // Restore links
    document.getElementById('linksList').innerHTML = '';
    linkRowCount = 0;
    if (p.type === 'file' && p.links && p.links.length) {
      p.links.forEach(l => addLinkRow(l.name, l.url));
    } else if (p.type === 'file') {
      addLinkRow();
    }
    setType(p.type || 'post');
  } else {
    titleEl.textContent = 'Add Post / File Links';
    submitBtn.textContent = '🔥 Publish';
    ['a-title', 'a-desc', 'a-cover'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('a-cat').value = 'general';
    document.getElementById('linksList').innerHTML = '';
    linkRowCount = 0;
    setType('post');
  }

  openModal('m-add');
}

// ─── Submit Post ────────────────────────────────────────────
async function submitPost() {
  const title = document.getElementById('a-title').value.trim();
  const desc = document.getElementById('a-desc').value.trim();
  const cat = document.getElementById('a-cat').value;
  const cover = document.getElementById('a-cover').value.trim();

  if (!title) {
    showNotif('⚠️ Title is required!');
    return;
  }

  let links = [];
  if (uploadType === 'file') {
    links = getLinks();
    if (links.length === 0) {
      showNotif('⚠️ Add at least one download link!');
      return;
    }
    const bad = links.find(l => !l.url.startsWith('http'));
    if (bad) {
      showNotif('⚠️ Links must start with http:// or https://');
      return;
    }
  }

  const btn = document.getElementById('addSubmitBtn');
  btn.textContent = '⏳ Saving…';
  btn.disabled = true;

  try {
    const { db, collection, doc, addDoc, updateDoc, serverTimestamp } = window._fb;

    if (editingId) {
      await updateDoc(doc(db, 'posts', editingId), {
        title: title,
        desc: desc,
        cat: cat,
        cover: cover,
        links: links,
        updatedAt: new Date().toLocaleString()
      });
      showNotif('✅ Updated!');
    } else {
      await addDoc(collection(db, 'posts'), {
        type: uploadType,
        title: title,
        desc: desc,
        cat: cat,
        cover: cover,
        links: links,
        authorId: currentUser.uid,
        authorName: currentUser.name || currentUser.email,
        createdAt: new Date().toLocaleString(),
        createdTs: serverTimestamp(),
        downloads: 0,
        views: 0
      });
      showNotif('🔥 Published!');
    }
    closeModal('m-add');
  } catch (e) {
    showNotif('❌ ' + e.message);
  } finally {
    btn.textContent = editingId ? '💾 Update' : '🔥 Publish';
    btn.disabled = false;
  }
}

// ─── View Post Detail ───────────────────────────────────────
async function viewPost(id) {
  const p = allPosts.find(x => x.id === id);
  if (!p) return;

  // Increment view count
  try {
    const { db, doc, updateDoc, increment } = window._fb;
    await updateDoc(doc(db, 'posts', id), { views: increment(1) });
  } catch (e) {
    // Silently handle view count errors
  }

  const canEdit = currentUser && (currentUser.isAdmin || currentUser.uid === p.authorId);

  const linksHtml = (p.links && p.links.length > 0)
    ? '<div class="dl-section">' +
        '<div style="font-weight:700;color:#fff;font-size:14px;margin-bottom:12px;">📁 Download Links (' + p.links.length + ')</div>' +
        p.links.map((l, i) =>
          '<div class="dl-item">' +
            '<div class="dl-icon">' + linkEmoji(l.url) + '</div>' +
            '<div class="dl-info">' +
              '<div class="dl-name">' + esc(l.name || 'Download ' + (i + 1)) + '</div>' +
              '<div class="dl-url">' + esc(l.url) + '</div>' +
            '</div>' +
            '<a href="' + l.url + '" target="_blank" rel="noopener" class="btn btn-fire btn-sm" onclick="trackDl(\'' + id + '\')">⬇ Download</a>' +
          '</div>'
        ).join('') +
      '</div>'
    : '';

  const contentHtml =
    (p.cover
      ? '<img src="' + p.cover + '" class="det-cover" onerror="this.style.display=\'none\'">'
      : '<div class="det-cover-ph">' + (p.type === 'file' ? '📁' : '📝') + '</div>') +
    '<div class="det-title">' + esc(p.title) + '</div>' +
    '<div class="det-meta">' +
      (p.type === 'file'
        ? '<span style="background:#4ade8018;border:1px solid #4ade8044;color:#4ade80;border-radius:6px;padding:3px 9px;font-size:11px;font-weight:700;">📁 FILE LINKS</span>'
        : '<span style="background:#60a5fa18;border:1px solid #60a5fa44;color:#60a5fa;border-radius:6px;padding:3px 9px;font-size:11px;font-weight:700;">📝 POST</span>') +
      '<span class="chip">' + catName(p.cat) + '</span>' +
      '<span class="chip">👁️ ' + ((p.views || 0) + 1) + ' views</span>' +
      (p.links && p.links.length ? '<span class="chip">📥 ' + p.links.length + ' link' + (p.links.length > 1 ? 's' : '') + '</span>' : '') +
      (p.downloads ? '<span class="chip">⬇ ' + p.downloads + ' downloads</span>' : '') +
    '</div>' +
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">' +
      '<div class="ava-sm">' + ((p.authorName || '?')[0] || '?').toUpperCase() + '</div>' +
      '<span style="font-size:12px;color:#334155;">' + esc(p.authorName || 'Unknown') + ' • ' + (p.createdAt || '') + '</span>' +
    '</div>' +
    (p.desc ? '<div class="det-body">' + esc(p.desc) + '</div>' : '') +
    linksHtml +
    (canEdit
      ? '<div style="display:flex;gap:9px;margin-top:10px;">' +
          '<button class="btn btn-blue btn-md" style="flex:1;" onclick="openEditModal(\'' + id + '\')">✏️ Edit</button>' +
          '<button class="btn btn-danger btn-md" style="flex:1;" onclick="deletePost(\'' + id + '\')">🗑️ Delete</button>' +
        '</div>'
      : '');

  document.getElementById('detailContent').innerHTML = contentHtml;
  openModal('m-detail');
}

async function trackDl(id) {
  try {
    const { db, doc, updateDoc, increment } = window._fb;
    await updateDoc(doc(db, 'posts', id), { downloads: increment(1) });
  } catch (e) {
    // Silently handle
  }
}

// ─── Edit Modal ─────────────────────────────────────────────
function openEditModal(id) {
  const p = allPosts.find(x => x.id === id);
  if (!p) return;
  editingId = id;
  document.getElementById('e-title').value = p.title || '';
  document.getElementById('e-desc').value = p.desc || '';
  document.getElementById('e-cat').value = p.cat || 'general';
  document.getElementById('e-cover').value = p.cover || '';
  closeModal('m-detail');
  openModal('m-edit');
}

async function submitEdit() {
  const title = document.getElementById('e-title').value.trim();
  if (!title) {
    showNotif('⚠️ Title required!');
    return;
  }
  try {
    const { db, doc, updateDoc } = window._fb;
    await updateDoc(doc(db, 'posts', editingId), {
      title: title,
      desc: document.getElementById('e-desc').value.trim(),
      cat: document.getElementById('e-cat').value,
      cover: document.getElementById('e-cover').value.trim(),
      updatedAt: new Date().toLocaleString()
    });
    closeModal('m-edit');
    showNotif('✅ Updated!');
  } catch (e) {
    showNotif('❌ ' + e.message);
  }
}

// ─── Delete Post ────────────────────────────────────────────
async function deletePost(id) {
  const p = allPosts.find(x => x.id === id);
  if (!p) return;
  if (!confirm('Delete "' + p.title + '"? This cannot be undone.')) return;
  try {
    const { db, doc, deleteDoc } = window._fb;
    await deleteDoc(doc(db, 'posts', id));
    closeModal('m-detail');
    showNotif('🗑️ Deleted!');
  } catch (e) {
    showNotif('❌ ' + e.message);
  }
}

// ─── Category Helpers ───────────────────────────────────────
function catName(c) {
  const map = {
    general: '📦 General',
    education: '📚 Education',
    tech: '💻 Tech',
    design: '🎨 Design',
    music: '🎵 Music',
    video: '🎬 Video',
    document: '📄 Documents',
    image: '🖼️ Images',
    software: '⚙️ Software',
    other: '🔥 Other'
  };
  return map[c] || '📦 General';
}

function linkEmoji(url) {
  if (!url) return '🔗';
  if (url.includes('drive.google')) return '📂';
  if (url.includes('mega.nz')) return '🟠';
  if (url.includes('mediafire')) return '🟦';
  if (url.includes('dropbox')) return '💧';
  if (url.includes('onedrive')) return '☁️';
  if (url.includes('youtube')) return '▶️';
  if (url.includes('github')) return '🐱';
  if (url.includes('telegram')) return '✈️';
  return '🔗';
}

// ─── Render Card ────────────────────────────────────────────
function renderCard(p) {
  const isFile = p.type === 'file';
  const snip = (p.desc || '').substring(0, 85);
  const initial = ((p.authorName || '?')[0] || '?').toUpperCase();

  return '<div class="card" onclick="viewPost(\'' + p.id + '\')">' +
    (p.cover
      ? '<div class="card-thumb" style="padding:0;"><img src="' + p.cover + '" onerror="this.parentElement.innerHTML=\'' + (isFile ? '📁' : '📝') + '\'" style="width:100%;height:180px;object-fit:cover;"></div>'
      : '<div class="card-thumb">' + (isFile ? '📁' : '📝') + '</div>') +
    '<div class="card-body">' +
      '<div class="card-type-badge ' + (isFile ? 'badge-file' : 'badge-post') + '">' + (isFile ? '📁 FILE LINKS' : '📝 POST') + '</div>' +
      '<div class="card-title">' + esc(p.title) + '</div>' +
      '<div class="card-snippet">' + esc(snip) + (snip.length === 85 ? '…' : '') + '</div>' +
      '<div class="card-meta">' +
        '<div class="card-author">' +
          '<div class="ava-sm">' + initial + '</div>' +
          '<span>' + esc(p.authorName || '') + '</span>' +
        '</div>' +
        '<div>' +
          (isFile
            ? '<span style="background:#4ade8015;border:1px solid #4ade8040;color:#4ade80;border-radius:6px;padding:2px 8px;font-size:10px;font-weight:700;">⬇ ' + (p.downloads || 0) + '</span>'
            : '<span style="background:#60a5fa15;border:1px solid #60a5fa40;color:#60a5fa;border-radius:6px;padding:2px 8px;font-size:10px;font-weight:700;">👁️ ' + (p.views || 0) + '</span>') +
        '</div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

// ─── Home Page ──────────────────────────────────────────────
function homeFilt(f, el) {
  homeFiltVal = f;
  document.querySelectorAll('#homeFilter .ftag').forEach(t => t.classList.remove('on'));
  if (el) el.classList.add('on');
  renderHome();
}

function renderHome() {
  const grid = document.getElementById('homeGrid');
  if (!grid) return;

  let items = allPosts;
  if (homeFiltVal !== 'all') {
    items = items.filter(p => p.type === homeFiltVal);
  }

  if (!items.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">📭</div><p>No content yet. Be the first to post!</p></div>';
    return;
  }

  grid.innerHTML = items.map(renderCard).join('');
  doReveal();
}

// ─── Browse Page ────────────────────────────────────────────
function browseFilt(f, el) {
  browseFiltVal = f;
  document.querySelectorAll('#browseFilter .ftag').forEach(t => t.classList.remove('on'));
  if (el) el.classList.add('on');
  renderBrowse();
}

function renderBrowse() {
  const grid = document.getElementById('browseGrid');
  const empty = document.getElementById('browseEmpty');
  if (!grid || !empty) return;

  const q = (document.getElementById('searchBox') ? document.getElementById('searchBox').value.toLowerCase() : '');
  let items = allPosts;

  if (browseFiltVal !== 'all') {
    items = items.filter(p => p.type === browseFiltVal);
  }
  if (q) {
    items = items.filter(p =>
      (p.title || '').toLowerCase().includes(q) ||
      (p.desc || '').toLowerCase().includes(q) ||
      (p.authorName || '').toLowerCase().includes(q)
    );
  }

  if (!items.length) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
  } else {
    empty.classList.add('hidden');
    grid.innerHTML = items.map(renderCard).join('');
  }
  doReveal();
}

// ─── User Panel ─────────────────────────────────────────────
function renderPanel() {
  if (!currentUser) return;

  const heroEl = document.getElementById('uHero');
  const listEl = document.getElementById('uPosts');
  if (!heroEl || !listEl) return;

  const initial = ((currentUser.name || currentUser.email || '?')[0] || '?').toUpperCase();
  const myPosts = currentUser.isAdmin
    ? allPosts
    : allPosts.filter(p => p.authorId === currentUser.uid);
  const totalDownloads = myPosts.reduce((s, p) => s + (p.downloads || 0), 0);

  heroEl.innerHTML =
    '<div class="u-ava">' + initial + '</div>' +
    '<div>' +
      '<div style="font-size:1.2rem;font-weight:800;color:#fff;">' + esc(currentUser.name || '—') + '</div>' +
      '<div style="color:#60a5fa;font-size:13px;margin-top:2px;">' + esc(currentUser.email) + '</div>' +
      '<div style="margin-top:8px;display:flex;gap:7px;flex-wrap:wrap;">' +
        '<span class="chip">📦 ' + myPosts.length + ' posts</span>' +
        '<span class="chip">⬇ ' + totalDownloads + ' total downloads</span>' +
        (currentUser.isAdmin ? '<span class="chip" style="background:#f9731622;border-color:#f97316;color:#f97316;">⚙️ Admin</span>' : '') +
      '</div>' +
    '</div>';

  if (!myPosts.length) {
    listEl.innerHTML = '<div class="empty-state"><div class="empty-icon">📦</div><p>No posts yet.<br><button class="btn btn-fire btn-md" style="margin-top:12px;" onclick="openAddModal()">+ Add your first post</button></p></div>';
    return;
  }

  listEl.innerHTML = myPosts.map(p =>
    '<div class="post-item">' +
      '<div class="post-item-icon">' + (p.type === 'file' ? '📁' : '📝') + '</div>' +
      '<div class="post-item-body">' +
        '<div class="post-item-title">' + esc(p.title) + '</div>' +
        '<div class="post-item-meta">' + catName(p.cat) + ' • ' + (p.type === 'file' ? (p.links ? p.links.length : 0) + ' link(s)' : 'Post') + ' • ' + (p.createdAt || '') + '</div>' +
        '<div class="post-item-meta" style="margin-top:2px;">👁️ ' + (p.views || 0) + ' views • ⬇ ' + (p.downloads || 0) + ' downloads</div>' +
        (currentUser.isAdmin && p.authorName ? '<div class="post-item-meta" style="color:#f97316;margin-top:2px;">🧑 ' + esc(p.authorName) + '</div>' : '') +
        '<div class="post-item-acts">' +
          '<button class="btn btn-blue btn-sm" onclick="viewPost(\'' + p.id + '\')">👁️ View</button>' +
          '<button class="btn btn-fire btn-sm" onclick="openAddModal(\'' + p.id + '\')">✏️ Edit</button>' +
          '<button class="btn btn-danger btn-sm" onclick="deletePost(\'' + p.id + '\')">🗑️ Delete</button>' +
        '</div>' +
      '</div>' +
    '</div>'
  ).join('');
}

// ─── Admin Panel ────────────────────────────────────────────
function adminTab(tab, btn) {
  ['content', 'users', 'stats'].forEach(t => {
    const el = document.getElementById('a-' + t);
    if (el) el.classList.add('hidden');
  });
  const target = document.getElementById('a-' + tab);
  if (target) target.classList.remove('hidden');

  document.querySelectorAll('.tab-pill').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  if (tab === 'stats') renderAStats();
}

function renderAContent() {
  const el = document.getElementById('aContentList');
  if (!el) return;

  if (!allPosts.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">📦</div><p>No content.</p></div>';
    return;
  }

  el.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">' +
      '<strong style="color:#fff;">All Content (' + allPosts.length + ')</strong>' +
      '<button class="btn btn-fire btn-sm" onclick="openAddModal()">+ Add</button>' +
    '</div>' +
    allPosts.map(p =>
      '<div class="a-card">' +
        '<div style="display:flex;align-items:flex-start;gap:12px;">' +
          '<div style="font-size:1.8rem;">' + (p.type === 'file' ? '📁' : '📝') + '</div>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(p.title) + '</div>' +
            '<div style="font-size:11px;color:#334155;">' + catName(p.cat) + ' • by ' + esc(p.authorName || 'Unknown') + ' • ' + (p.createdAt || '') + '</div>' +
            '<div style="font-size:11px;color:#334155;margin-top:2px;">👁️ ' + (p.views || 0) + ' • ⬇ ' + (p.downloads || 0) + (p.type === 'file' ? ' • ' + ((p.links && p.links.length) || 0) + ' links' : '') + '</div>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;gap:7px;margin-top:11px;flex-wrap:wrap;">' +
          '<button class="btn btn-blue btn-sm" onclick="viewPost(\'' + p.id + '\')">👁️ View</button>' +
          '<button class="btn btn-fire btn-sm" onclick="openAddModal(\'' + p.id + '\')">✏️ Edit</button>' +
          '<button class="btn btn-danger btn-sm" onclick="deletePost(\'' + p.id + '\')">🗑️ Delete</button>' +
        '</div>' +
      '</div>'
    ).join('');
}

function renderAUsers() {
  const el = document.getElementById('aUsersList');
  if (!el) return;

  if (!allUsers.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><p>No users yet.</p></div>';
    return;
  }

  el.innerHTML =
    '<strong style="color:#fff;display:block;margin-bottom:14px;">Members (' + allUsers.length + ')</strong>' +
    allUsers.map(u => {
      const userInitial = ((u.name || '?')[0] || '?').toUpperCase();
      return '<div class="a-card" style="display:flex;align-items:center;gap:13px;">' +
        '<div class="u-ava" style="width:46px;height:46px;font-size:1.1rem;">' + userInitial + '</div>' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-weight:700;color:#fff;">' + esc(u.name || '—') + '</div>' +
          '<div style="font-size:12px;color:#60a5fa;">' + esc(u.email) + '</div>' +
          '<div style="font-size:11px;color:#334155;margin-top:2px;">📦 ' + allPosts.filter(p => p.authorId === u.id).length + ' posts • Joined ' + (u.createdAt || '') + '</div>' +
        '</div>' +
        '<button class="btn btn-danger btn-sm" onclick="deleteUser(\'' + u.id + '\')">🗑️</button>' +
      '</div>';
    }).join('');
}

function renderAStats() {
  const el = document.getElementById('aStatsPanel');
  if (!el) return;

  const tdl = allPosts.reduce((s, p) => s + (p.downloads || 0), 0);
  const tv = allPosts.reduce((s, p) => s + (p.views || 0), 0);
  const filePosts = allPosts.filter(p => p.type === 'file').length;
  const textPosts = allPosts.filter(p => p.type === 'post').length;

  const statsData = [
    ['📦', 'Total Posts', allPosts.length],
    ['📁', 'File Posts', filePosts],
    ['📝', 'Text Posts', textPosts],
    ['👥', 'Members', allUsers.length],
    ['⬇', 'Downloads', tdl],
    ['👁️', 'Total Views', tv]
  ];

  el.innerHTML =
    '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px;">' +
    statsData.map(([ic, lb, vl]) =>
      '<div style="background:#0d1b4b;border:1px solid #2563eb28;border-radius:14px;padding:18px;text-align:center;">' +
        '<div style="font-size:1.8rem;margin-bottom:5px;">' + ic + '</div>' +
        '<div class="fire-text" style="font-size:1.7rem;font-weight:900;font-family:\'Poppins\',sans-serif;">' + vl + '</div>' +
        '<div style="color:#60a5fa;font-size:11px;margin-top:3px;">' + lb + '</div>' +
      '</div>'
    ).join('') +
    '</div>';
}

async function deleteUser(uid) {
  if (!confirm('Delete this user? Their posts will also be deleted.')) return;
  try {
    const { db, doc, deleteDoc } = window._fb;
    for (const p of allPosts.filter(x => x.authorId === uid)) {
      await deleteDoc(doc(db, 'posts', p.id));
    }
    await deleteDoc(doc(db, 'users', uid));
    showNotif('🗑️ User deleted!');
  } catch (e) {
    showNotif('❌ ' + e.message);
  }
}

// ─── Stats Animation ────────────────────────────────────────
function updateStats() {
  const dls = allPosts.reduce((s, p) => s + (p.downloads || 0), 0);
  animNum('s-posts', allPosts.length);
  animNum('s-files', allPosts.filter(p => p.type === 'file').length);
  animNum('s-users', allUsers.length);
  animNum('s-dls', dls);
}

function animNum(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  let cur = 0;
  const steps = 28;
  const inc = target / steps || 0;
  let step = 0;
  const t = setInterval(function () {
    step++;
    cur += inc;
    const display = Math.min(Math.round(cur), target);
    el.textContent = display;
    if (step >= steps) {
      el.textContent = target;
      clearInterval(t);
    }
  }, 30);
}

// ─── Utility ────────────────────────────────────────────────
function esc(s) {
  if (s === null || s === undefined) return '';
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

function doReveal() {
  // IntersectionObserver for reveal elements
  const obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.08 });

  document.querySelectorAll('.reveal:not(.visible)').forEach(function (el) {
    obs.observe(el);
  });

  // Stagger card animation
  document.querySelectorAll('.card:not(.reveal)').forEach(function (el, i) {
    el.classList.add('reveal');
    setTimeout(function () {
      el.classList.add('visible');
    }, i * 55);
  });
}

function spawnParticles() {
  const w = document.getElementById('heroParts');
  if (!w) return;
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const s = 4 + Math.random() * 8;
    p.style.cssText = 'width:' + s + 'px;height:' + s + 'px;left:' + Math.random() * 100 + '%;animation-duration:' + (8 + Math.random() * 10) + 's;animation-delay:' + Math.random() * 10 + 's;';
    w.appendChild(p);
  }
}

// ─── Scroll to Top ──────────────────────────────────────────
window.addEventListener('scroll', function () {
  const b = document.getElementById('backTop');
  if (b) {
    if (window.scrollY > 400) {
      b.classList.add('show');
    } else {
      b.classList.remove('show');
    }
  }
});

// ─── Bootstrap ──────────────────────────────────────────────
spawnParticles();
doReveal();
waitFB(initApp);
