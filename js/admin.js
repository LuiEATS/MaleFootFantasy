
var SUBS = [], ORDERS = [], POSTS = [];
var activeOrderId = null;
var activeEditId  = null;
var subFilter = {q:'',status:'all'};
var ordFilter = {q:'',status:'all'};
var pubFilter = {q:'',tag:'all'};
var PAL = ['#1e1a16,#2a2016','#16191e,#0f1a22','#1a1620,#22162a','#1e1916,#281e10'];

function showToast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function(){ t.classList.remove('show'); }, 3000);
}

function showAdmin(page) {
  document.querySelectorAll('.page-admin').forEach(function(p){ p.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(function(n){ n.classList.remove('active'); });
  document.getElementById('admin-' + page).classList.add('active');
  document.querySelector('[data-page="' + page + '"]').classList.add('active');
  closeAdminSidebar();
}

function toggleAdminSidebar() {
  var open = document.getElementById('adminSidebar').classList.toggle('open');
  document.getElementById('adminHamburgerBtn').classList.toggle('active', open);
  document.getElementById('adminHamburgerBtn').setAttribute('aria-expanded', open ? 'true' : 'false');
  document.getElementById('sidebarBackdrop').classList.toggle('show', open);
}

function closeAdminSidebar() {
  document.getElementById('adminSidebar').classList.remove('open');
  document.getElementById('adminHamburgerBtn').classList.remove('active');
  document.getElementById('adminHamburgerBtn').setAttribute('aria-expanded', 'false');
  document.getElementById('sidebarBackdrop').classList.remove('show');
}

async function doLogin() {
  var u = document.getElementById('loginUser').value.trim();
  var p = document.getElementById('loginPass').value;
  var result = await sb.auth.signInWithPassword({email: u, password: p});
  if (result.error) {
    document.getElementById('loginErr').style.display = 'block';
  } else {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('adminUser').textContent = u;
    await loadAll();
  }
}

function showForgotForm() {
  document.getElementById('loginFormFields').style.display = 'none';
  document.getElementById('forgotFormFields').style.display = 'block';
  document.getElementById('resetPasswordFields').style.display = 'none';
}

function showLoginForm() {
  document.getElementById('loginFormFields').style.display = 'block';
  document.getElementById('forgotFormFields').style.display = 'none';
  document.getElementById('resetPasswordFields').style.display = 'none';
}

async function sendPasswordReset() {
  var email = document.getElementById('forgotEmail').value.trim();
  var msg = document.getElementById('forgotMsg');
  if (!email) { msg.textContent = 'Enter your email first.'; return; }
  msg.textContent = 'Sending…';
  var result = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
  msg.textContent = result.error ? ('Error: ' + result.error.message) : 'Check your email for a reset link.';
}

async function submitNewPassword() {
  var p1 = document.getElementById('newPass1').value;
  var p2 = document.getElementById('newPass2').value;
  var msg = document.getElementById('resetMsg');
  if (!p1 || p1.length < 6) { msg.textContent = 'Password must be at least 6 characters.'; return; }
  if (p1 !== p2) { msg.textContent = 'Passwords do not match.'; return; }
  var result = await sb.auth.updateUser({ password: p1 });
  if (result.error) {
    msg.textContent = 'Error: ' + result.error.message;
  } else {
    msg.textContent = 'Password updated. Redirecting…';
    setTimeout(function(){ window.location.href = window.location.origin + window.location.pathname; }, 1200);
  }
}

sb.auth.onAuthStateChange(function(event) {
  if (event === 'PASSWORD_RECOVERY') {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('loginFormFields').style.display = 'none';
    document.getElementById('forgotFormFields').style.display = 'none';
    document.getElementById('resetPasswordFields').style.display = 'block';
  }
});

async function doLogout() {
  await sb.auth.signOut();
  location.reload();
}

async function loadAll() {
  var subsRes   = await sb.from('submissions').select('*').order('created_at', {ascending: false});
  var ordersRes = await sb.from('orders').select('*').order('created_at', {ascending: false});
  var postsRes  = await sb.from('posts').select('*').order('created_at', {ascending: false});
  SUBS   = (subsRes.data   || []).map(function(s){ return Object.assign({}, s, {date: (s.created_at||'').slice(0,10)}); });
  ORDERS = (ordersRes.data || []).map(function(o){ return Object.assign({}, o, {date: (o.created_at||'').slice(0,10), pkg: o.package}); });
  POSTS  = postsRes.data || [];
  renderDashboard();
  renderSubs();
  renderOrders();
  renderPublished();
  renderTags();
}

function getStorageUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return 'https://vgmpkiyxblstqeyucfoq.supabase.co/storage/v1/object/public/media/' + path;
}

async function postToX(title, tags, storagePath) {
  try {
    var res = await fetch('/api/post-to-x', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title, tags: tags || [], imageUrl: getStorageUrl(storagePath) })
    });
    var data = await res.json();
    if (!data.ok) { console.warn('X post failed:', data.error); showToast('Published (X post failed — see console)'); }
  } catch (e) {
    console.warn('X post error:', e);
  }
}

function openPreview(source, id) {
  var list = source === 'sub' ? SUBS : POSTS;
  var item = list.find(function(x){ return x.id === id; });
  if (!item) return;

  var imgUrl = getStorageUrl(item.storage_path);
  var imgWrap = document.getElementById('reviewImgWrap');
  var isVideo = item.storage_path && (item.storage_path.toLowerCase().endsWith('.mp4') || item.storage_path.toLowerCase().endsWith('.mov') || item.storage_path.toLowerCase().endsWith('.webm') || (item.type && item.type.toLowerCase().includes('video')));
  if (imgUrl && isVideo) {
    imgWrap.innerHTML = '<video controls style="width:100%;max-height:420px;background:#0a0a0a;border-radius:5px 5px 0 0;display:block"><source src="' + imgUrl + '">Your browser does not support video.</video>';
  } else if (imgUrl) {
    imgWrap.innerHTML = '<img class="review-img" src="' + imgUrl + '" alt="' + item.title + '">';
  } else {
    imgWrap.innerHTML = '<div class="review-img-placeholder">' + item.title.charAt(0) + '</div>';
  }
  document.getElementById('reviewTitle').textContent = item.title;

  if (source === 'sub') {
    document.getElementById('reviewMeta').innerHTML =
      '<div><span>Type</span><br>' + (item.type || '—') + '</div>' +
      '<div><span>Submitted</span><br>' + item.date + '</div>' +
      '<div><span>Status</span><br>' + item.status + '</div>' +
      '<div><span>Email</span><br>' + (item.email || 'anonymous') + '</div>';
  } else {
    document.getElementById('reviewMeta').innerHTML =
      '<div><span>Type</span><br>' + (item.type || '—') + '</div>' +
      '<div><span>Published</span><br>' + (item.created_at || '').slice(0, 10) + '</div>' +
      '<div><span>Status</span><br>' + (item.archived ? 'Archived' : 'Live') + '</div>' +
      '<div><span>Likes</span><br>' + item.likes + '</div>';
  }

  document.getElementById('reviewTags').innerHTML = (item.tags||[]).map(function(t){
    return '<span class="tag-chip">' + t + '</span>';
  }).join('');
  var notesEl = document.getElementById('reviewNotes');
  if (item.notes) { notesEl.textContent = '"' + item.notes + '"'; notesEl.style.display = 'block'; }
  else { notesEl.style.display = 'none'; }

  var approveBtn = document.getElementById('reviewApproveBtn');
  var rejectBtn  = document.getElementById('reviewRejectBtn');
  var archiveBtn = document.getElementById('reviewArchiveBtn');
  var editBtn    = document.getElementById('reviewEditBtn');
  var deleteBtn  = document.getElementById('reviewDeleteBtn');

  editBtn.onclick = function() {
    document.getElementById('reviewModal').classList.remove('open');
    openEdit(source, id);
  };

  if (source === 'sub') {
    approveBtn.style.display = '';
    rejectBtn.style.display = '';
    archiveBtn.textContent = 'Archive';
    approveBtn.onclick = function() { document.getElementById('reviewModal').classList.remove('open'); setSubStatus(id, 'approved'); };
    rejectBtn.onclick  = function() { document.getElementById('reviewModal').classList.remove('open'); setSubStatus(id, 'rejected'); };
    archiveBtn.onclick = function() { document.getElementById('reviewModal').classList.remove('open'); toggleArchiveSub(id); };
    deleteBtn.onclick  = function() { document.getElementById('reviewModal').classList.remove('open'); deleteSub(id); };
  } else {
    approveBtn.style.display = 'none';
    rejectBtn.style.display = 'none';
    archiveBtn.textContent = item.archived ? 'Unarchive' : 'Archive';
    archiveBtn.onclick = function() { document.getElementById('reviewModal').classList.remove('open'); toggleArchivePub(id); };
    deleteBtn.onclick  = function() { document.getElementById('reviewModal').classList.remove('open'); deletePub(id); };
  }

  document.getElementById('reviewModal').classList.add('open');
}

function renderDashboard() {
  var pending   = SUBS.filter(function(s){ return s.status==='pending' && !s.archived; }).length;
  var newOrders = ORDERS.filter(function(o){ return o.status==='new' && !o.archived; }).length;
  document.getElementById('statPending').textContent   = pending;
  document.getElementById('statOrders').textContent    = newOrders;
  document.getElementById('statPublished').textContent = POSTS.filter(function(p){ return !p.archived; }).length;
  document.getElementById('pendingBadge').textContent  = pending;
  document.getElementById('orderBadge').textContent    = newOrders;
  var feed = SUBS.slice(0,3).map(function(s){
    return '<div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.78rem"><span>Submission — <strong>' + s.title + '</strong></span><span style="font-size:0.65rem;color:var(--text-dim)">' + s.date + '</span></div>';
  });
  document.getElementById('activityFeed').innerHTML = feed.join('');
}

function renderSubs() {
  var data = SUBS.filter(function(s){
    var q = subFilter.q.toLowerCase();
    var matchQ = !q || s.title.toLowerCase().indexOf(q) > -1;
    var matchS = subFilter.status === 'all' ? true :
      subFilter.status === 'archived' ? s.archived :
      !s.archived && s.status === subFilter.status;
    return matchQ && matchS;
  });
  document.getElementById('subCount').textContent = data.length + ' result' + (data.length !== 1 ? 's' : '');
  var html = data.map(function(s){
    var pal = PAL[s.id % PAL.length].split(',');
    var tags = (s.tags || []).map(function(t){ return '<span class="tag-chip">' + t + '</span>'; }).join('');
    var statusPill = s.archived ? '<span class="status-pill archived">Archived</span>' : '<span class="status-pill ' + s.status + '">' + s.status + '</span>';
    var actions = '';
    if (!s.archived) {
      if (s.status === 'pending') {
        actions += '<button class="act-btn act-approve" onclick="event.stopPropagation();setSubStatus(' + s.id + ',\'approved\')">Approve</button>';
        actions += '<button class="act-btn act-reject" onclick="event.stopPropagation();setSubStatus(' + s.id + ',\'rejected\')">Reject</button>';
      } else {
        actions += '<button class="act-btn act-view" onclick="event.stopPropagation();setSubStatus(' + s.id + ',\'pending\')">Reset</button>';
      }
      actions += '<button class="act-btn act-edit" onclick="event.stopPropagation();openEdit(\'sub\',' + s.id + ')">Edit</button>';
      actions += '<button class="act-btn act-archive" onclick="event.stopPropagation();toggleArchiveSub(' + s.id + ')">Archive</button>';
    } else {
      actions += '<button class="act-btn act-unarchive" onclick="event.stopPropagation();toggleArchiveSub(' + s.id + ')">Unarchive</button>';
    }
    actions += '<button class="act-btn act-delete" onclick="event.stopPropagation();deleteSub(' + s.id + ')">Delete</button>';
    return '<tr class="' + (s.archived ? 'is-archived' : '') + '" onclick="openPreview(\'sub\',' + s.id + ')" style="cursor:pointer">'
      + '<td><div class="thumb" style="background:linear-gradient(135deg,' + pal[0] + ',' + pal[1] + ')">' + s.title.charAt(0) + '</div></td>'
      + '<td><div class="sub-title">' + s.title + '</div><div class="sub-meta">' + (s.email || '') + '</div></td>'
      + '<td>' + tags + '</td>'
      + '<td style="font-size:0.75rem;color:var(--ash)">' + s.type + '</td>'
      + '<td style="font-size:0.72rem;color:var(--text-dim)">' + s.date + '</td>'
      + '<td>' + statusPill + '</td>'
      + '<td><div class="action-btns">' + actions + '</div></td>'
      + '</tr>';
  }).join('');
  document.getElementById('subTableBody').innerHTML = html;
}

async function setSubStatus(id, status) {
  if (status === 'approved') {
    var subRes = await sb.from('submissions').select('*').eq('id', id).single();
    if (subRes.error) { showToast('Error: ' + subRes.error.message); return; }
    var sub = subRes.data;
    if (sub.status === 'approved') { showToast('Already approved'); return; }
    var insertRes = await sb.from('posts').insert({
      title: sub.title,
      type: sub.type || 'AI-Gen',
      tags: sub.tags || [],
      likes: 0,
      archived: false,
      storage_path: sub.storage_path
    });
    if (insertRes.error) { showToast('Insert error: ' + insertRes.error.message); return; }
    var updateRes = await sb.from('submissions').update({status: 'approved'}).eq('id', id);
    if (updateRes.error) { showToast('Update error: ' + updateRes.error.message); return; }
    postToX(sub.title, sub.tags, sub.storage_path);
    showToast('Approved and published!');
  } else {
    var res = await sb.from('submissions').update({status: status}).eq('id', id);
    if (res.error) { showToast('Error: ' + res.error.message); return; }
    showToast('Marked as ' + status);
  }
  await loadAll();
}

async function toggleArchiveSub(id) {
  var s = SUBS.find(function(x){ return x.id === id; });
  if (!s) return;
  s.archived = !s.archived;
  await sb.from('submissions').update({archived: s.archived}).eq('id', id);
  await loadAll();
  showToast(s.archived ? 'Archived' : 'Unarchived');
}

async function deleteSub(id) {
  if (!confirm('Delete this submission permanently?')) return;
  await sb.from('submissions').delete().eq('id', id);
  await loadAll();
  showToast('Deleted');
}

function filterSubs(q)      { subFilter.q = q; renderSubs(); }
function filterSubStatus(v) { subFilter.status = v; renderSubs(); }

function renderOrders() {
  var data = ORDERS.filter(function(o){
    var q = ordFilter.q.toLowerCase();
    var matchQ = !q || o.email.indexOf(q) > -1 || o.request.toLowerCase().indexOf(q) > -1;
    var matchS = ordFilter.status === 'all' ? true :
      ordFilter.status === 'archived' ? o.archived :
      !o.archived && o.status === ordFilter.status;
    return matchQ && matchS;
  });
  document.getElementById('orderCount').textContent = data.length + ' order' + (data.length !== 1 ? 's' : '');
  var html = data.map(function(o){
    var statusPill = o.archived ? '<span class="order-status-pill archived">Archived</span>' : '<span class="order-status-pill ' + o.status + '">' + o.status + '</span>';
    var archBtn = o.archived
      ? '<button class="act-btn act-unarchive" onclick="toggleArchiveOrder(\'' + o.id + '\')">Unarchive</button>'
      : '<button class="act-btn act-archive" onclick="toggleArchiveOrder(\'' + o.id + '\')">Archive</button>';
    return '<tr class="' + (o.archived ? 'is-archived' : '') + '">'
      + '<td style="font-size:0.72rem;color:var(--ash)">' + o.id + '</td>'
      + '<td style="font-size:0.78rem">' + o.email + '</td>'
      + '<td style="font-size:0.75rem">' + (o.pkg || o.package || '') + ' <span class="price-tag">$' + o.price + '</span></td>'
      + '<td style="font-size:0.75rem;color:var(--ash);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + o.request + '</td>'
      + '<td style="font-size:0.72rem;color:var(--text-dim)">' + o.date + '</td>'
      + '<td>' + statusPill + '</td>'
      + '<td><div class="action-btns"><button class="act-btn act-view" onclick="openOrderDetail(\'' + o.id + '\')">View</button>' + archBtn + '<button class="act-btn act-delete" onclick="deleteOrder(\'' + o.id + '\')">Delete</button></div></td>'
      + '</tr>';
  }).join('');
  document.getElementById('orderTableBody').innerHTML = html;
}

function openOrderDetail(id) {
  var o = ORDERS.find(function(x){ return x.id === id; });
  if (!o) return;
  activeOrderId = id;
  document.getElementById('orderDetail').innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem 2rem;margin-bottom:1rem">'
    + '<div><span style="color:var(--text-dim)">ID:</span> ' + o.id + '</div>'
    + '<div><span style="color:var(--text-dim)">Date:</span> ' + o.date + '</div>'
    + '<div><span style="color:var(--text-dim)">Email:</span> ' + o.email + '</div>'
    + '<div><span style="color:var(--text-dim)">Amount:</span> <span style="color:var(--gold)">$' + o.price + '</span></div>'
    + '</div><div style="margin-bottom:0.6rem;color:var(--text-dim)">Request:</div>'
    + '<div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:3px;padding:0.8rem;font-size:0.8rem;line-height:1.6">' + o.request + '</div>';
  document.getElementById('orderModal').classList.add('open');
}

async function updateOrderStatus(status) {
  await sb.from('orders').update({status: status}).eq('id', activeOrderId);
  document.getElementById('orderModal').classList.remove('open');
  await loadAll();
  showToast('Order ' + activeOrderId + ' marked ' + status);
}

async function toggleArchiveOrder(id) {
  var o = ORDERS.find(function(x){ return x.id === id; });
  if (!o) return;
  o.archived = !o.archived;
  await sb.from('orders').update({archived: o.archived}).eq('id', id);
  await loadAll();
  showToast(o.archived ? 'Archived' : 'Unarchived');
}

async function deleteOrder(id) {
  if (!confirm('Delete this order?')) return;
  await sb.from('orders').delete().eq('id', id);
  await loadAll();
  showToast('Deleted');
}

function filterOrders(q)      { ordFilter.q = q; renderOrders(); }
function filterOrderStatus(v) { ordFilter.status = v; renderOrders(); }

function renderPublished() {
  var allTags = [];
  POSTS.forEach(function(p){ (p.tags||[]).forEach(function(t){ if (allTags.indexOf(t) < 0) allTags.push(t); }); });
  allTags.sort();
  var sel = document.getElementById('pubTagFilter');
  sel.innerHTML = '<option value="all">All (active)</option>'
    + allTags.map(function(t){ return '<option value="' + t + '">' + t + '</option>'; }).join('')
    + '<option value="__archived__">Archived</option>';

  var showArchived = pubFilter.tag === '__archived__';
  var data = POSTS.filter(function(p){
    var q = pubFilter.q.toLowerCase();
    var matchQ = !q || p.title.toLowerCase().indexOf(q) > -1;
    var matchT = showArchived ? p.archived :
      pubFilter.tag === 'all' ? !p.archived :
      !p.archived && (p.tags||[]).indexOf(pubFilter.tag) > -1;
    return matchQ && matchT;
  });
  document.getElementById('pubCount').textContent = data.length + ' post' + (data.length !== 1 ? 's' : '');
  var html = data.map(function(p){
    var pal = PAL[p.id % PAL.length].split(',');
    var tags = (p.tags||[]).map(function(t){ return '<span class="tag-chip">' + t + '</span>'; }).join('');
    var archBtn = p.archived
      ? '<button class="act-btn act-unarchive" onclick="event.stopPropagation();toggleArchivePub(' + p.id + ')">Unarchive</button>'
      : '<button class="act-btn act-archive" onclick="event.stopPropagation();toggleArchivePub(' + p.id + ')">Archive</button>';
    var editBtn = !p.archived ? '<button class="act-btn act-edit" onclick="event.stopPropagation();openEdit(\'pub\',' + p.id + ')">Edit</button>' : '';
    var imgUrl = getStorageUrl(p.storage_path);
    var isVideo = p.storage_path && (p.storage_path.toLowerCase().endsWith('.mp4') || p.storage_path.toLowerCase().endsWith('.mov') || p.storage_path.toLowerCase().endsWith('.webm') || (p.type && p.type.toLowerCase().includes('video')));
    var thumbHtml;
    if (imgUrl && isVideo) {
      thumbHtml = '<video class="pub-thumb" src="' + imgUrl + '" muted playsinline></video>';
    } else if (imgUrl) {
      thumbHtml = '<img class="pub-thumb" src="' + imgUrl + '" alt="' + p.title + '">';
    } else {
      thumbHtml = '<div class="pub-thumb" style="background:linear-gradient(135deg,' + pal[0] + ',' + pal[1] + ')">' + p.title.charAt(0) + '</div>';
    }
    return '<div class="pub-card' + (p.archived ? ' is-archived' : '') + '" onclick="openPreview(\'pub\',' + p.id + ')" style="cursor:pointer">'
      + thumbHtml
      + '<div class="pub-info"><div class="pub-title">' + p.title + '</div>'
      + '<div class="pub-tags">' + tags + '</div>'
      + '<div style="font-size:0.65rem;color:var(--text-dim);margin-bottom:0.5rem">' + (p.archived ? 'Archived' : p.likes + ' likes') + '</div>'
      + '<div class="pub-actions">' + editBtn + archBtn + '<button class="act-btn act-delete" onclick="event.stopPropagation();deletePub(' + p.id + ')">Delete</button></div>'
      + '</div></div>';
  }).join('') || '<div style="color:var(--text-dim);font-size:0.85rem;padding:2rem 0">No posts found.</div>';
  document.getElementById('pubGrid').innerHTML = html;
}

async function toggleArchivePub(id) {
  var p = POSTS.find(function(x){ return x.id === id; });
  if (!p) return;
  p.archived = !p.archived;
  await sb.from('posts').update({archived: p.archived}).eq('id', id);
  await loadAll();
  showToast(p.archived ? 'Archived' : 'Unarchived');
}

async function deletePub(id) {
  if (!confirm('Remove this post from the gallery?')) return;
  await sb.from('posts').delete().eq('id', id);
  await loadAll();
  showToast('Deleted');
}

function filterPub(q)    { pubFilter.q = q; renderPublished(); }
function filterPubTag(v) { pubFilter.tag = v; renderPublished(); }

function renderTags() {
  var counts = {};
  POSTS.forEach(function(p){
    if (p.archived) return;
    (p.tags || []).forEach(function(t){ counts[t] = (counts[t] || 0) + 1; });
  });
  var tags = Object.keys(counts).sort();
  document.getElementById('tagsList').innerHTML = tags.length ? tags.map(function(t){
    return '<div style="display:flex;align-items:center;gap:0.5rem;background:var(--card);border:1px solid var(--border);border-radius:3px;padding:0.4rem 0.8rem">'
      + '<span class="tag-chip" style="margin:0">' + t + '</span>'
      + '<span style="font-size:0.65rem;color:var(--text-dim)">' + counts[t] + '</span>'
      + '<button onclick="deleteTag(\'' + t + '\')" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:0.75rem">✕</button>'
      + '</div>';
  }).join('') : '<div style="color:var(--text-dim);font-size:0.85rem">No tags in use yet.</div>';
}

async function deleteTag(t) {
  var affected = POSTS.filter(function(p){ return !p.archived && (p.tags || []).indexOf(t) > -1; });
  if (!affected.length) return;
  if (!confirm('Remove tag "' + t + '" from ' + affected.length + ' post' + (affected.length !== 1 ? 's' : '') + '?')) return;
  for (var i = 0; i < affected.length; i++) {
    var newTags = affected[i].tags.filter(function(x){ return x !== t; });
    await sb.from('posts').update({tags: newTags}).eq('id', affected[i].id);
  }
  await loadAll();
  showToast('Tag removed from ' + affected.length + ' post' + (affected.length !== 1 ? 's' : ''));
}

document.addEventListener('change', function(e) {
  if (e.target && e.target.id === 'npFile') {
    var f = e.target.files[0];
    document.getElementById('npFileName').textContent = f ? f.name : '';
  }
});

async function createPost() {
  var title = document.getElementById('npTitle').value.trim();
  var tags  = document.getElementById('npTags').value.split(',').map(function(t){ return t.trim(); }).filter(Boolean);
  var type  = document.getElementById('npType').value;
  var file  = document.getElementById('npFile').files[0];
  var statusEl = document.getElementById('npStatus');

  if (!title) { statusEl.textContent = 'Please add a title.'; return; }

  statusEl.textContent = 'Publishing...';

  var storage_path = null;
  if (file) {
    var path = 'posts/' + Date.now() + '_' + file.name;
    var upRes = await sb.storage.from('media').upload(path, file);
    if (upRes.error) { statusEl.textContent = 'Upload error: ' + upRes.error.message; return; }
    storage_path = path;
  }

  var insertRes = await sb.from('posts').insert({
    title: title,
    type: type,
    tags: tags,
    likes: 0,
    archived: false,
    storage_path: storage_path
  });
  if (insertRes.error) { statusEl.textContent = 'Error: ' + insertRes.error.message; return; }
  postToX(title, tags, storage_path);

  statusEl.textContent = 'Published!';
  document.getElementById('npTitle').value = '';
  document.getElementById('npTags').value = '';
  document.getElementById('npFile').value = '';
  document.getElementById('npFileName').textContent = '';
  await loadAll();
  showToast('Post published');
  setTimeout(function(){ statusEl.textContent = ''; }, 3000);
}

var bulkFileList = [];

function handleBulkFiles(input) {
  bulkFileList = Array.from(input.files);
  document.getElementById('bulkFileCount').textContent =
    bulkFileList.length + ' file' + (bulkFileList.length !== 1 ? 's' : '') + ' selected';
}

function titleFromFilename(name) {
  var base = name.replace(/\.[^/.]+$/, '');
  base = base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return base || 'Untitled';
}

async function uploadBulkFiles() {
  var statusEl = document.getElementById('bulkStatus');
  if (!bulkFileList.length) { statusEl.textContent = 'Choose files first.'; return; }
  var type = document.getElementById('bulkType').value;
  var okCount = 0, failCount = 0;

  for (var i = 0; i < bulkFileList.length; i++) {
    var file = bulkFileList[i];
    statusEl.textContent = 'Uploading ' + (i + 1) + ' of ' + bulkFileList.length + ': ' + file.name;
    var path = 'submissions/' + Date.now() + '_' + i + '_' + file.name;
    var upRes = await sb.storage.from('media').upload(path, file);
    if (upRes.error) { failCount++; continue; }
    var insertRes = await sb.from('submissions').insert({
      title: titleFromFilename(file.name),
      email: 'admin-bulk-upload',
      type: type,
      tags: [],
      notes: '',
      status: 'pending',
      archived: false,
      storage_path: path
    });
    if (insertRes.error) { failCount++; } else { okCount++; }
  }

  statusEl.textContent = 'Done: ' + okCount + ' uploaded' + (failCount ? ', ' + failCount + ' failed' : '') + '. Review them in Submissions.';
  document.getElementById('bulkFiles').value = '';
  bulkFileList = [];
  document.getElementById('bulkFileCount').textContent = '';
  await loadAll();
  showToast(okCount + ' photo' + (okCount !== 1 ? 's' : '') + ' uploaded for review');
}

function openEdit(source, id) {
  activeEditId = {source: source, id: id};
  var list = source === 'sub' ? SUBS : POSTS;
  var item = list.find(function(x){ return x.id === id; });
  if (!item) return;
  document.getElementById('editModalTitle').textContent = source === 'sub' ? 'Edit Submission' : 'Edit Post';
  document.getElementById('editTitle').value = item.title;
  document.getElementById('editTags').value  = (item.tags||[]).join(', ');
  document.getElementById('editType').value  = item.type;
  document.getElementById('editNotes').value = item.notes || '';

  var previewWrap = document.getElementById('editPreviewWrap');
  var previewImg  = document.getElementById('editPreviewImg');
  var imgUrl = getStorageUrl(item.storage_path);
  var isVideo = item.storage_path && (item.storage_path.toLowerCase().endsWith('.mp4') || item.storage_path.toLowerCase().endsWith('.mov') || item.storage_path.toLowerCase().endsWith('.webm') || (item.type && item.type.toLowerCase().includes('video')));
  if (imgUrl && !isVideo) {
    previewImg.src = imgUrl;
    previewWrap.style.display = 'block';
  } else {
    previewWrap.style.display = 'none';
    previewImg.src = '';
  }

  document.getElementById('editModal').classList.add('open');
}

async function saveEdit() {
  var source = activeEditId.source;
  var id     = activeEditId.id;
  var table  = source === 'sub' ? 'submissions' : 'posts';
  var list   = source === 'sub' ? SUBS : POSTS;
  var item   = list.find(function(x){ return x.id === id; });
  if (!item) return;
  item.title = document.getElementById('editTitle').value.trim();
  item.tags  = document.getElementById('editTags').value.split(',').map(function(t){ return t.trim(); }).filter(Boolean);
  item.type  = document.getElementById('editType').value;
  var payload = {title: item.title, tags: item.tags, type: item.type};
  if (source === 'sub') {
    item.notes = document.getElementById('editNotes').value.trim();
    payload.notes = item.notes;
  }
  var res = await sb.from(table).update(payload).eq('id', id);
  if (res.error) { showToast('Error: ' + res.error.message); return; }
  document.getElementById('editModal').classList.remove('open');
  if (source === 'sub') renderSubs(); else renderPublished();
  showToast('Saved');
}

// Init
(async function() {
  var sessionRes = await sb.auth.getSession();
  if (sessionRes.data && sessionRes.data.session) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('adminUser').textContent = sessionRes.data.session.user.email;
    await loadAll();
  }
})();