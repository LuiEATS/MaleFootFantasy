// ================================================
// maleFOOTfantasy — Gallery Logic
// ================================================

const PALETTES = [
  ['#1e1a16','#2a2016'],['#16191e','#0f1a22'],['#1a1620','#22162a'],
  ['#1e1916','#281e10'],['#0f1e17','#162813'],['#1e1016','#220e1a'],
];

let POSTS      = [];
let activeTag  = 'all';
let activeSort = 'recent';
let currentModalId = null;
let likedPosts = new Set(JSON.parse(localStorage.getItem('mff_likes') || '[]'));

function getImageUrl(storage_path) {
  if (!storage_path) return null;
  if (storage_path.startsWith('http')) return storage_path;
  return 'https://vgmpkiyxblstqeyucfoq.supabase.co/storage/v1/object/public/media/' + storage_path;
}

function isVideoPath(storage_path, type) {
  if (!storage_path) return false;
  const ext = storage_path.toLowerCase();
  return ext.endsWith('.mp4') || ext.endsWith('.mov') || ext.endsWith('.webm') ||
    (type && type.toLowerCase().includes('video'));
}

async function loadPosts() {
  document.getElementById('galleryGrid').innerHTML =
    '<div class="no-results" style="font-size:1rem;opacity:0.5">Loading...</div>';
  let query = sb.from('posts').select('*').eq('archived', false);
  if (activeTag !== 'all') query = query.contains('tags', [activeTag]);
  if (activeSort === 'popular') query = query.order('likes', { ascending: false });
  else if (activeSort === 'az')  query = query.order('title', { ascending: true });
  else                           query = query.order('created_at', { ascending: false });
  const { data, error } = await query;
  if (error) { console.error(error); return; }
  POSTS = data || [];
  filterGallery();
}

function renderCard(post) {
  const pal     = PALETTES[post.id % PALETTES.length];
  const isVideo = isVideoPath(post.storage_path, post.type);
  const liked   = likedPosts.has(post.id);
  const imgUrl  = getImageUrl(post.storage_path);
  let imgHtml;
  if (imgUrl && isVideo) {
    imgHtml = '<video style="width:100%;display:block" muted playsinline loop onmouseover="this.play()" onmouseout="this.pause()"><source src="' + imgUrl + '"></video><div class="video-badge">&#9654; Video</div>';
  } else if (imgUrl) {
    imgHtml = '<img class="card-img" src="' + imgUrl + '" alt="' + post.title + '">';
  } else {
    imgHtml = '<div class="card-placeholder" style="height:260px;background:linear-gradient(135deg,' + pal[0] + ',' + pal[1] + ')">' + post.title.charAt(0) + '</div>';
  }
  return '<div class="card" onclick="openModal(' + post.id + ')">'
    + '<div class="card-img-wrap">' + imgHtml
    + '<div class="card-overlay">'
    + '<div class="overlay-title">' + post.title + '</div>'
    + '<div class="overlay-tags">' + (post.tags||[]).map(function(t){ return '<span class="overlay-tag" onclick="event.stopPropagation();selectTagByName(\'' + t + '\')">' + t + '</span>'; }).join('') + '</div>'
    + '</div></div>'
    + '<div class="card-footer">'
    + '<span class="card-type' + (post.type && post.type.includes('AI') ? ' ai' : '') + '">' + post.type + '</span>'
    + '<button class="like-btn' + (liked ? ' liked' : '') + '" onclick="toggleLike(event,' + post.id + ')">&#9829; <span id="likes-' + post.id + '">' + post.likes + '</span></button>'
    + '</div></div>';
}

function filterGallery() {
  var q = document.getElementById('searchInput').value.toLowerCase().trim();
  var posts = POSTS.filter(function(p) {
    return !q || p.title.toLowerCase().indexOf(q) > -1 || (p.tags||[]).some(function(t){ return t.indexOf(q) > -1; });
  });
  var grid = document.getElementById('galleryGrid');
  document.getElementById('resultCount').textContent = 'Showing ' + posts.length + ' post' + (posts.length !== 1 ? 's' : '');
  grid.innerHTML = posts.length ? posts.map(renderCard).join('') : '<div class="no-results">No results found</div>';
}

async function loadTagFilters() {
  const { data, error } = await sb.from('posts').select('tags').eq('archived', false);
  if (error) { console.error(error); return; }
  const tagSet = new Set();
  (data || []).forEach(function(p){ (p.tags||[]).forEach(function(t){ if (t) tagSet.add(t); }); });
  renderTagFilters(Array.from(tagSet).sort());
}

function renderTagFilters(tags) {
  var container = document.getElementById('tagFilters');
  container.innerHTML = '<div class="tag-pill' + (activeTag === 'all' ? ' active' : '') + '" data-tag="all" onclick="selectTag(this)">All</div>'
    + tags.map(function(t){
        return '<div class="tag-pill' + (activeTag === t ? ' active' : '') + '" data-tag="' + t + '" onclick="selectTag(this)">' + t + '</div>';
      }).join('');
}

function selectTag(el) {
  document.querySelectorAll('.tag-pill').forEach(function(p){ p.classList.remove('active'); });
  el.classList.add('active');
  activeTag = el.dataset.tag;
  loadPosts();
}

function selectTagByName(tag) {
  activeTag = tag;
  document.querySelectorAll('.tag-pill').forEach(function(p){ p.classList.toggle('active', p.dataset.tag === tag); });
  showPage('gallery');
  loadPosts();
}

function sortGallery(val) { activeSort = val; loadPosts(); }

async function toggleLike(e, id) {
  e.stopPropagation();
  var post = POSTS.find(function(p){ return p.id === id; });
  var el   = document.getElementById('likes-' + id);
  var btn  = el && el.closest('.like-btn');
  if (!post || !el) return;
  var wasLiked = likedPosts.has(id);
  var newLikes = wasLiked ? post.likes - 1 : post.likes + 1;
  wasLiked ? likedPosts.delete(id) : likedPosts.add(id);
  post.likes = newLikes;
  el.textContent = newLikes;
  if (btn) btn.classList.toggle('liked', !wasLiked);
  localStorage.setItem('mff_likes', JSON.stringify([...likedPosts]));
  await sb.from('posts').update({ likes: newLikes }).eq('id', id);
}

function openModal(id) {
  var post = POSTS.find(function(p){ return p.id === id; });
  if (!post) return;
  currentModalId = id;
  var pal    = PALETTES[post.id % PALETTES.length];
  var imgUrl = getImageUrl(post.storage_path);
  var isVid  = isVideoPath(post.storage_path, post.type);
  var img    = document.getElementById('modalImg');
  if (imgUrl && isVid) {
    img.style.background = '';
    img.style.height = '';
    img.innerHTML = '<video controls style="width:100%;max-height:600px;background:#0a0a0a;border-radius:5px 5px 0 0;display:block"><source src="' + imgUrl + '"></video>';
  } else if (imgUrl) {
    img.style.background = '';
    img.style.height = '';
    img.innerHTML = '<img src="' + imgUrl + '" style="width:100%;border-radius:5px 5px 0 0;display:block;max-height:600px;object-fit:contain;background:#0a0a0a">';
  } else {
    img.style.height = '380px';
    img.style.background = 'linear-gradient(135deg,' + pal[0] + ',' + pal[1] + ')';
    img.textContent = post.title.charAt(0);
  }
  document.getElementById('modalTitle').textContent = post.title;
  document.getElementById('modalMeta').textContent  = post.type + ' · ' + post.likes + ' likes';
  document.getElementById('modalTags').innerHTML    = (post.tags||[]).map(function(t){ return '<span class="overlay-tag" onclick="selectTagByName(\'' + t + '\');document.getElementById(\'modal\').classList.remove(\'open\')" style="cursor:pointer">' + t + '</span>'; }).join('');
  var liked = likedPosts.has(post.id);
  document.getElementById('modalLikeBtn').classList.toggle('liked', liked);
  document.getElementById('modalLikeCount').textContent = post.likes;
  document.getElementById('modal').classList.add('open');
}

async function modalLike() {
  if (!currentModalId) return;
  await toggleLike({ stopPropagation: function(){} }, currentModalId);
  var post = POSTS.find(function(p){ return p.id === currentModalId; });
  if (post) {
    document.getElementById('modalLikeCount').textContent = post.likes;
    document.getElementById('modalLikeBtn').classList.toggle('liked', likedPosts.has(currentModalId));
    document.getElementById('modalMeta').textContent = post.type + ' · ' + post.likes + ' likes';
  }
}

function closeModal(e) {
  if (e.target === document.getElementById('modal')) document.getElementById('modal').classList.remove('open');
}

function showPage(name) {
  document.querySelectorAll('.page').forEach(function(p){ p.classList.remove('active'); });
  document.getElementById('page-' + name).classList.add('active');
  window.scrollTo({top:0,behavior:'smooth'});
  closeMobileNav();
}

function toggleMobileNav() {
  var open = document.getElementById('navLinks').classList.toggle('open');
  document.getElementById('hamburgerBtn').classList.toggle('active', open);
  document.getElementById('hamburgerBtn').setAttribute('aria-expanded', open ? 'true' : 'false');
}

function closeMobileNav() {
  document.getElementById('navLinks').classList.remove('open');
  document.getElementById('hamburgerBtn').classList.remove('active');
  document.getElementById('hamburgerBtn').setAttribute('aria-expanded', 'false');
}

function previewTags() {
  var val  = document.getElementById('tagInput').value;
  var tags = val.split(',').map(function(t){ return t.trim(); }).filter(Boolean);
  document.getElementById('tagPreview').innerHTML = tags.map(function(t){ return '<span class="overlay-tag" style="font-size:0.65rem">' + t + '</span>'; }).join('');
}

function handleFiles(input) {
  var names = Array.from(input.files).map(function(f){ return f.name; });
  document.getElementById('fileList').innerHTML = names.map(function(n){ return '<div>&#10003; ' + n + '</div>'; }).join('');
}

async function submitContent() {
  var title = document.getElementById('subTitle').value.trim();
  var tags  = document.getElementById('tagInput').value.split(',').map(function(t){ return t.trim(); }).filter(Boolean);
  var type2 = document.getElementById('subType').value;
  var notes = document.getElementById('subNotes').value.trim();
  var files = document.getElementById('fileInput').files;
  if (!title) { showToast('Please add a title'); return; }
  var storage_path = null;
  if (files.length > 0) {
    var file = files[0];
    var path = 'submissions/' + Date.now() + '_' + file.name;
    var upRes = await sb.storage.from('media').upload(path, file);
    if (upRes.error) { showToast('Upload error: ' + upRes.error.message); return; }
    storage_path = path;
  }
  var res = await sb.from('submissions').insert({ title: title, tags: tags, type: type2, notes: notes, status: 'pending', storage_path: storage_path });
  if (res.error) { showToast('Error: ' + res.error.message); return; }
  emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, { title: title, type: type2, tags: tags.join(', ') || 'none', notes: notes || 'none' }).catch(function(e){ console.log('Email error:', e); });
  showToast('Submitted! We\'ll review within 48h.');
}

async function submitTakedown() {
  var content = document.getElementById('tdContent').value.trim();
  var action  = document.getElementById('tdAction').value;
  var details = document.getElementById('tdDetails').value.trim();
  var email   = document.getElementById('tdEmail').value.trim();
  if (!content || !email) { showToast('Please fill in the content and your email'); return; }
  emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, { title: 'Take Down Request - ' + action, type: email, tags: content, notes: details || 'none' }).catch(function(e){ console.log('Email error:', e); });
  showToast('Request received - we\'ll follow up by email.');
  document.getElementById('tdContent').value = '';
  document.getElementById('tdDetails').value = '';
  document.getElementById('tdEmail').value = '';
}

function ageVerify(isAdult) {
  if (isAdult) {
    sessionStorage.setItem('age_verified', '1');
    document.getElementById('ageGate').classList.add('hidden');
  } else {
    window.location.replace('https://www.google.com');
  }
}

let secretClickCount = 0;
let secretClickTimer = null;
function handleSecretAdminClick() {
  secretClickCount++;
  clearTimeout(secretClickTimer);
  secretClickTimer = setTimeout(function(){ secretClickCount = 0; }, 1500);
  if (secretClickCount >= 5) {
    secretClickCount = 0;
    window.location.href = 'admin-panel.html';
  }
}

function showToast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function(){ t.classList.remove('show'); }, 3500);
}

document.addEventListener('DOMContentLoaded', function() {
  emailjs.init(EMAILJS_PUBLIC);
  if (sessionStorage.getItem('age_verified') === '1') {
    document.getElementById('ageGate').classList.add('hidden');
  }
  loadPosts();
  loadTagFilters();
});
