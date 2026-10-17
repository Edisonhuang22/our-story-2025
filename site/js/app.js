'use strict';

/* ---------- Hero 载入淡入 ---------- */
document.body.classList.add('loaded');

var heroMemoryBtn = document.getElementById('hero-memory-btn') || document.querySelector('.pill-btn[href="#photos"]');
if (heroMemoryBtn) {
  heroMemoryBtn.addEventListener('click', function (event) {
    event.preventDefault();
    if (!window.storySync || !window.storySync.getRole()) {
      window.storySync && window.storySync.openAuth();
      return;
    }
    document.getElementById('photos').scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      block: 'start'
    });
  });
}

var heroPortraitEl = document.getElementById('hero-portrait');
if (heroPortraitEl) {
  heroPortraitEl.addEventListener('click', function () {
    if (!window.storySync || !window.storySync.getRole()) {
      window.storySync && window.storySync.openAuth();
    }
  });
}

var memoryLockedLoginBtn = document.getElementById('memory-locked-login');
if (memoryLockedLoginBtn) {
  memoryLockedLoginBtn.addEventListener('click', function () {
    window.storySync && window.storySync.openAuth();
  });
}

/* ---------- 固定合照的轻微倾斜 ---------- */
(function initHeroPortraitTilt() {
  var hero = document.querySelector('.hero');
  var portrait = hero && hero.querySelector('.hero-portrait-pos');
  if (!portrait || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  hero.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    var rect = hero.getBoundingClientRect();
    var x = (e.clientX - rect.left) / rect.width - 0.5;
    var y = (e.clientY - rect.top) / rect.height - 0.5;
    portrait.style.transform = 'perspective(900px) rotateX(' + (-y * 5).toFixed(1) + 'deg) rotateY(' + (x * 5).toFixed(1) + 'deg) rotate(3deg)';
  });
  hero.addEventListener('pointerleave', function () {
    portrait.style.transform = '';
  });
})();

/* ---------- 继续上一次的回忆 ---------- */
var memoryVisit = { view: 'orbit', month: 'all', scrollY: 0, yaw: -0.48, pitch: -0.08 };
var resumeVisit = new URLSearchParams(location.search).get('resume') === '1';
if (resumeVisit) {
  try {
    var savedVisit = JSON.parse(sessionStorage.getItem('story-last-visit'));
    if (savedVisit) Object.assign(memoryVisit, savedVisit);
  } catch (e) {}
}
var saveOrbitPosition = function () {};
function saveMemoryVisit() {
  saveOrbitPosition();
  memoryVisit.scrollY = window.scrollY;
  try { sessionStorage.setItem('story-last-visit', JSON.stringify(memoryVisit)); } catch (e) {}
}
window.addEventListener('pagehide', saveMemoryVisit);
document.querySelector('.egg-footer').addEventListener('click', saveMemoryVisit);

/* ---------- 照片故事球 ---------- */
var orbitEl = document.getElementById('memory-orbit');
var orbitStage = document.getElementById('orbit-stage');
var orbitDate = document.getElementById('orbit-date');
var orbitTitle = document.getElementById('orbit-title');
var orbitCount = document.getElementById('orbit-count');
var galleryError = document.getElementById('gallery-error');
var ORBIT_ATLAS_COLUMNS = 11;
var ORBIT_ATLAS_ROWS = 8;
var orbitProfile = getOrbitProfile();

document.documentElement.dataset.orbitProfile = orbitProfile.name;
if (orbitProfile.reducedEffects) document.documentElement.classList.add('orbit-reduced-fx');

function getOrbitProfile() {
  var touchDevice = window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 700;
  var memory = navigator.deviceMemory || 0;
  var cores = navigator.hardwareConcurrency || 0;
  var saveData = Boolean(navigator.connection && navigator.connection.saveData);
  var lowPower = (memory > 0 && memory <= 4) || (cores > 0 && cores <= 4) || saveData;

  if (touchDevice && lowPower) {
    return { name: 'touch-lite', maxNodes: 34, frameInterval: 20, visibilityThreshold: -0.2, reducedEffects: true };
  }
  if (touchDevice) {
    return { name: 'touch', maxNodes: 46, frameInterval: 16, visibilityThreshold: -0.35, reducedEffects: true };
  }
  if (lowPower) {
    return { name: 'balanced', maxNodes: 64, frameInterval: 20, visibilityThreshold: -0.45, reducedEffects: true };
  }
  return { name: 'desktop-single', maxNodes: Infinity, onePhotoPerStory: true, frameInterval: 16, visibilityThreshold: -0.56, reducedEffects: false };
}

function selectOrbitPhotos(stories, maxNodes, onePhotoPerStory) {
  if (onePhotoPerStory) {
    var firstPhotos = Object.create(null);
    stories.forEach(function (story, storyIndex) {
      firstPhotos[storyIndex + ':0'] = true;
    });
    return firstPhotos;
  }
  var total = stories.reduce(function (sum, story) { return sum + story.photos.length; }, 0);
  if (total <= maxNodes) return null;

  var selected = Object.create(null);
  var extras = [];
  stories.forEach(function (story, storyIndex) {
    selected[storyIndex + ':0'] = true;
    for (var photoIndex = 1; photoIndex < story.photos.length; photoIndex++) {
      extras.push(storyIndex + ':' + photoIndex);
    }
  });

  var remaining = Math.max(0, maxNodes - stories.length);
  for (var i = 0; i < remaining; i++) {
    selected[extras[Math.floor(i * extras.length / remaining)]] = true;
  }
  return selected;
}

function setAtlasPosition(el, index) {
  el.style.setProperty('--atlas-x', ((index % ORBIT_ATLAS_COLUMNS) / (ORBIT_ATLAS_COLUMNS - 1) * 100).toFixed(3) + '%');
  el.style.setProperty('--atlas-y', (Math.floor(index / ORBIT_ATLAS_COLUMNS) / (ORBIT_ATLAS_ROWS - 1) * 100).toFixed(3) + '%');
}

var stories = [];
var gallery = { entries: [], photos: [] };
var textLoadId = 0;
var memoryLocked = document.getElementById('memory-locked');
var galleryToolbar = document.getElementById('gallery-toolbar');
var orbitPanel = document.getElementById('orbit-panel');
var timelinePanel = document.getElementById('timeline-panel');
var linkedMemory = new URLSearchParams(location.search).get('memory');

function buildStoriesFromGallery(data) {
  if (!data || !data.entries) return [];
  var photosByFolder = {};
  var seenPhotoKeys = new Set();

  (data.photos || []).forEach(function (row) {
    if (row.hidden) return;
    var photoKey = row.storage_path || (row.folder + ':' + row.static_src) || row.id;
    if (seenPhotoKeys.has(photoKey)) return;
    seenPhotoKeys.add(photoKey);

    if (!photosByFolder[row.folder]) photosByFolder[row.folder] = [];
    var src = row.storage_path ? window.storySync.galleryPhotoUrl(row.storage_path) : (row.static_src || '');
    var thumb = row.thumb_path ? window.storySync.galleryPhotoUrl(row.thumb_path) : src;

    photosByFolder[row.folder].push({
      src: src,
      thumb: thumb,
      card: thumb,
      uploadId: row.id,
      storagePath: row.storage_path,
      thumbPath: row.thumb_path,
      createdAt: row.created_at
    });
  });

  // 同一回忆内的照片严格排序（历史照片按序号 1, 2, ...；新上传照片按时间排序）
  Object.keys(photosByFolder).forEach(function (f) {
    photosByFolder[f].sort(function (a, b) {
      var aNum = a.storagePath && a.storagePath.match(/\/legacy\/[^/]+\/(\d+)\.webp$/);
      var bNum = b.storagePath && b.storagePath.match(/\/legacy\/[^/]+\/(\d+)\.webp$/);
      if (aNum && bNum) return Number(aNum[1]) - Number(bNum[1]);
      if (a.createdAt && b.createdAt) return a.createdAt.localeCompare(b.createdAt);
      return 0;
    });
  });

  var role = window.storySync.getRole();
  var result = data.entries.map(function (entry) {
    var photos = photosByFolder[entry.folder] || [];
    var parts = (entry.memory_date || entry.folder).split(/[-.]/);
    var dateFormatted = parts[0] + '年' + Number(parts[1]) + '月' + Number(parts[2]) + '日';
    return {
      event: {
        folder: entry.folder,
        title: entry.title,
        date: dateFormatted,
        text: role ? entry.body || '' : '',
        author: entry.author || '大大布',
        memoryDate: entry.memory_date
      },
      photos: photos,
      hidden: entry.hidden
    };
  });

  result = result.filter(function (story) { return !story.hidden && story.photos.length > 0; });
  result.sort(function (a, b) {
    var left = (a.event.memoryDate || a.event.folder).split(/[-.]/).map(Number);
    var right = (b.event.memoryDate || b.event.folder).split(/[-.]/).map(Number);
    return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
  });
  return result;
}

function updateGalleryAuthState(role) {
  var heroImg = document.getElementById('hero-img');
  if (heroImg) {
    if (role) {
      if (!heroImg.src || heroImg.src.indexOf('hero.webp') === -1) {
        heroImg.src = heroImg.dataset.src || 'img/hero.webp';
      }
    } else {
      heroImg.removeAttribute('src');
    }
  }
  if (heroMemoryBtn) {
    heroMemoryBtn.innerHTML = role ? '打开我们的回忆 <span aria-hidden="true">↓</span>' : '登录查看回忆 <span aria-hidden="true">🔒</span>';
  }
  if (memoryLocked) memoryLocked.hidden = Boolean(role);
  if (galleryToolbar) galleryToolbar.hidden = !role;
  if (!role) {
    if (orbitPanel) orbitPanel.hidden = true;
    if (timelinePanel) timelinePanel.hidden = true;
    if (window.closeMemoryModal) window.closeMemoryModal();
    var editorDialog = document.getElementById('gallery-editor');
    if (editorDialog && editorDialog.open) editorDialog.close();
  } else {
    if (memoryVisit.view === 'timeline') {
      if (timelinePanel) timelinePanel.hidden = false;
      if (orbitPanel) orbitPanel.hidden = true;
    } else {
      if (orbitPanel) orbitPanel.hidden = false;
      if (timelinePanel) timelinePanel.hidden = true;
    }
  }
}

window.storySync.onAuthChange(async function (_user, role) {
  var requestId = ++textLoadId;
  updateGalleryAuthState(role);
  stories.forEach(function (story) { story.event.text = ''; });
  if (gallery.entries) gallery.entries.forEach(function (entry) { delete entry.body; });
  window.dispatchEvent(new Event('story-gallery-text-change'));
  if (!role) {
    stories = [];
    renderOrbit(stories);
    initMemoryViews(stories);
    return;
  }
  galleryError.textContent = '';
  try {
    gallery = await window.storySync.loadGallery();
    if (requestId !== textLoadId || !window.storySync.getRole()) return;
    stories = buildStoriesFromGallery(gallery);
    renderOrbit(stories);
    initMemoryViews(stories);
    initMemoryModal(stories);
    if (window.initGalleryEditor) window.initGalleryEditor(stories, gallery);
    window.dispatchEvent(new Event('story-gallery-text-change'));
    if (linkedMemory) {
      var linkedIndex = stories.findIndex(function (story) { return story.event.folder === linkedMemory; });
      if (linkedIndex >= 0) {
        document.getElementById('photos').scrollIntoView();
        openMemory(linkedIndex, 0, orbitEl);
        linkedMemory = null;
      }
    }
  } catch (error) {
    galleryError.textContent = '回忆读取失败：' + (error.message || '请刷新重试');
  }
});

if (resumeVisit && window.storySync.getRole()) {
  requestAnimationFrame(function () {
    window.scrollTo({ top: memoryVisit.scrollY || document.getElementById('photos').offsetTop, behavior: 'instant' });
  });
}

var viewsInitialized = false;
function initMemoryViews(stories) {
  var orbitPanel = document.getElementById('orbit-panel');
  var timelinePanel = document.getElementById('timeline-panel');
  var orbitButton = document.getElementById('view-orbit');
  var timelineButton = document.getElementById('view-timeline');
  var monthSelect = document.getElementById('memory-month');
  var timeline = document.getElementById('timeline-list');
  var summary = document.getElementById('gallery-summary');
  var months = [];

  function monthOf(story) { return (story.event.memoryDate || story.event.folder).split(/[-.]/).slice(0, 2).map(Number).join('.'); }
  function monthLabel(month) { var parts = month.split('.'); return parts[0] + ' 年 ' + parts[1] + ' 月'; }
  function makeText(tag, className, text) {
    var el = document.createElement(tag);
    el.className = className;
    el.textContent = text;
    return el;
  }
  function makeCard(story, index) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'memory-card';
    button.dataset.storyIndex = String(index);
    button.setAttribute('aria-label', story.event.date + '，' + story.event.title + '，查看回忆');
    var photo = story.photos[0];
    var image = document.createElement('img');
    image.src = photo.thumb || photo.src;
    image.alt = '';
    image.width = 560;
    image.height = 350;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.onerror = function () {
      if (photo.src && image.src !== photo.src) image.src = photo.src;
    };
    button.appendChild(image);
    var copy = makeText('span', 'memory-card-copy', '');
    copy.appendChild(makeText('span', 'memory-card-date', story.event.date));
    copy.appendChild(makeText('strong', '', story.event.title));
    copy.appendChild(makeText('span', 'memory-card-excerpt', window.storySync.getRole() ? story.event.text : '登录后查看回忆文字'));
    var meta = makeText('span', 'memory-card-meta', '');
    meta.appendChild(makeText('span', '', story.photos.length + ' 张照片'));
    meta.appendChild(makeText('span', '', '打开回忆 ↗'));
    copy.appendChild(meta);
    button.appendChild(copy);
    button.addEventListener('click', function () { openMemory(index, 0, button); });
    return button;
  }
  stories.forEach(function (story) {
    var month = monthOf(story);
    if (months.indexOf(month) === -1) months.push(month);
  });

  // 重置并重新生成月份选项（避免重复 append）
  monthSelect.replaceChildren();
  var defaultOpt = document.createElement('option');
  defaultOpt.value = 'all';
  defaultOpt.textContent = '全部月份';
  monthSelect.appendChild(defaultOpt);
  months.forEach(function (month) {
    var option = document.createElement('option');
    option.value = month;
    option.textContent = monthLabel(month);
    monthSelect.appendChild(option);
  });
  monthSelect.value = months.indexOf(memoryVisit.month) !== -1 ? memoryVisit.month : 'all';

  function renderTimeline() {
    timeline.replaceChildren();
    if (!window.storySync || !window.storySync.getRole()) return;
    months.forEach(function (month) {
      if (monthSelect.value !== 'all' && monthSelect.value !== month) return;
      var section = document.createElement('section');
      section.className = 'timeline-month';
      section.appendChild(makeText('h3', '', monthLabel(month)));
      var entries = makeText('div', 'timeline-entries', '');
      stories.forEach(function (story, index) {
        if (monthOf(story) === month) entries.appendChild(makeCard(story, index));
      });
      section.appendChild(entries);
      timeline.appendChild(section);
    });
  }
  function updateSummary() {
    var shown = stories.filter(function (story) { return memoryVisit.view === 'orbit' || monthSelect.value === 'all' || monthOf(story) === monthSelect.value; });
    var count = shown.reduce(function (sum, story) { return sum + story.photos.length; }, 0);
    summary.textContent = shown.length + ' 段回忆 · ' + count + ' 张照片';
  }
  function setView(view) {
    var role = window.storySync && window.storySync.getRole();
    memoryVisit.view = view;
    orbitPanel.hidden = !role || view !== 'orbit';
    timelinePanel.hidden = !role || view !== 'timeline';
    orbitButton.setAttribute('aria-pressed', String(view === 'orbit'));
    timelineButton.setAttribute('aria-pressed', String(view === 'timeline'));
    if (view === 'timeline') renderTimeline();
    updateSummary();
  }

  if (!viewsInitialized) {
    viewsInitialized = true;
    orbitButton.addEventListener('click', function () { setView('orbit'); });
    timelineButton.addEventListener('click', function () { setView('timeline'); });
    monthSelect.addEventListener('change', function () {
      memoryVisit.month = monthSelect.value;
      renderTimeline();
      updateSummary();
    });
    window.addEventListener('story-gallery-text-change', renderTimeline);
  }
  setView(memoryVisit.view === 'timeline' ? 'timeline' : 'orbit');
}

function normalize(v) {
  var length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function renderOrbit(stories) {
  var nodes = [];
  var fragment = document.createDocumentFragment();
  var clusterColors = ['#8f83d8', '#e28b8b', '#75a998', '#d49a54', '#8aa6d1'];
  var goldenAngle = Math.PI * (3 - Math.sqrt(5));
  var selectedPhotos = selectOrbitPhotos(stories, orbitProfile.maxNodes, orbitProfile.onePhotoPerStory);

  stories.forEach(function (story, storyIndex) {
    var t = stories.length === 1 ? 0.5 : storyIndex / (stories.length - 1);
    var y = 1 - 2 * t;
    var ring = Math.sqrt(Math.max(0, 1 - y * y));
    var angle = storyIndex * goldenAngle;
    var center = [Math.cos(angle) * ring, y, Math.sin(angle) * ring];
    var helper = Math.abs(center[1]) > 0.86 ? [1, 0, 0] : [0, 1, 0];
    var tangentX = normalize(cross(helper, center));
    var tangentY = normalize(cross(center, tangentX));

    story.photos.forEach(function (photo, photoIndex) {
      if (selectedPhotos && !selectedPhotos[storyIndex + ':' + photoIndex]) return;

      var localAngle = photoIndex * goldenAngle + storyIndex * 0.31;
      var localRadius = story.photos.length === 1 ? 0 : 0.075 + 0.048 * Math.sqrt(photoIndex);
      var vector = normalize([
        center[0] + tangentX[0] * Math.cos(localAngle) * localRadius + tangentY[0] * Math.sin(localAngle) * localRadius,
        center[1] + tangentX[1] * Math.cos(localAngle) * localRadius + tangentY[1] * Math.sin(localAngle) * localRadius,
        center[2] + tangentX[2] * Math.cos(localAngle) * localRadius + tangentY[2] * Math.sin(localAngle) * localRadius
      ]);

      var button = document.createElement('button');
      button.className = 'orbit-photo';
      button.type = 'button';
      button.style.setProperty('--cluster-color', clusterColors[storyIndex % clusterColors.length]);
      button.style.setProperty('--photo-tilt', (((photoIndex * 7 + storyIndex * 3) % 13) - 6) + 'deg');
      button.style.backgroundSize = 'cover';
      button.style.backgroundPosition = 'center';
      var thumbUrl = photo.thumb || photo.src;
      button.dataset.storyIndex = String(storyIndex);
      button.dataset.photoIndex = String(photoIndex);
      button.setAttribute('aria-label', story.event.date + '，' + story.event.title + '，第' + (photoIndex + 1) + '张照片');
      fragment.appendChild(button);

      var node = {
        el: button,
        thumbUrl: thumbUrl,
        loaded: false,
        vector: vector,
        storyIndex: storyIndex,
        photoIndex: photoIndex,
        interactive: null,
        keyboard: null,
        visible: null,
        zIndex: null,
        z: -1
      };
      nodes.push(node);
      button.addEventListener('click', function () {
        if (!drag.moved) openMemory(storyIndex, photoIndex, button);
      });
    });
  });
  orbitStage.appendChild(fragment);
  orbitEl.dataset.orbitProfile = orbitProfile.name;
  orbitEl.dataset.orbitNodes = String(nodes.length);
  if (!nodes.length) {
    orbitDate.textContent = '';
    orbitTitle.textContent = '还没有照片回忆';
    orbitCount.textContent = '';
    return;
  }

  orbitEl.classList.add('is-ready');

  var state = { yaw: memoryVisit.yaw, pitch: memoryVisit.pitch, vx: 0, vy: 0 };
  saveOrbitPosition = function () { memoryVisit.yaw = state.yaw; memoryVisit.pitch = state.pitch; };
  var drag = { active: false, moved: false, x: 0, y: 0, time: 0, pointerId: null, capturePending: false };
  var activeNodeIndex = -1;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var inView = false;
  var frame = 0;
  var lastFrame = performance.now();

  function positionNodes() {
    var width = orbitEl.clientWidth;
    var height = orbitEl.clientHeight;
    var radius = Math.min(width, height) * (width < 600 ? 0.37 : 0.4);
    var sinY = Math.sin(state.yaw), cosY = Math.cos(state.yaw);
    var sinX = Math.sin(state.pitch), cosX = Math.cos(state.pitch);
    var nearest = 0;
    var nearestZ = -2;

    nodes.forEach(function (node, index) {
      var v = node.vector;
      var x1 = v[0] * cosY + v[2] * sinY;
      var z1 = -v[0] * sinY + v[2] * cosY;
      var y2 = v[1] * cosX - z1 * sinX;
      var z2 = v[1] * sinX + z1 * cosX;
      var depth = (z2 + 1) / 2;
      var perspective = 0.7 + depth * 0.38;
      var scale = 0.46 + depth * 0.72;
      var opacity = 0.07 + Math.pow(depth, 1.55) * 0.93;
      var x = x1 * radius * perspective;
      var y = y2 * radius * perspective;

      node.z = z2;
      var visible = z2 > orbitProfile.visibilityThreshold;
      if (visible !== node.visible) {
        node.visible = visible;
        node.el.style.visibility = visible ? 'visible' : 'hidden';
      }
      if (visible) {
        // 优先加载面向视角的照片（z2 > -0.15），显著减少首屏并发网络拥堵；其余节点在闲时或旋转到正面时顺畅载入
        if (!node.loaded && node.thumbUrl && (z2 > -0.15 || orbitIdleLoaded)) {
          node.loaded = true;
          node.el.style.backgroundImage = 'url("' + node.thumbUrl.replace(/"/g, '%22') + '")';
        }
        node.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) scale(' + scale.toFixed(3) + ') rotate(' + node.el.style.getPropertyValue('--photo-tilt') + ')';
        node.el.style.opacity = opacity.toFixed(3);
        var nextZIndex = Math.round(depth * 100);
        if (nextZIndex !== node.zIndex) {
          node.zIndex = nextZIndex;
          node.el.style.zIndex = String(nextZIndex);
        }
      }
      var interactive = z2 > 0.03;
      if (interactive !== node.interactive) {
        node.interactive = interactive;
        node.el.style.pointerEvents = interactive ? 'auto' : 'none';
      }
      var keyboard = z2 > 0.28;
      if (keyboard !== node.keyboard) {
        node.keyboard = keyboard;
        node.el.tabIndex = keyboard ? 0 : -1;
      }
      if (z2 > nearestZ) { nearestZ = z2; nearest = index; }
    });

    if (nearest !== activeNodeIndex) {
      if (activeNodeIndex >= 0) nodes[activeNodeIndex].el.classList.remove('is-nearest');
      activeNodeIndex = nearest;
      nodes[nearest].el.classList.add('is-nearest');
      var story = stories[nodes[nearest].storyIndex];
      orbitDate.textContent = story.event.date;
      orbitTitle.textContent = story.event.title;
      orbitCount.textContent = story.photos.length + ' 张照片';
    }
  }

  function animate(now) {
    if (!inView) { frame = 0; return; }
    if (now - lastFrame < orbitProfile.frameInterval) { frame = requestAnimationFrame(animate); return; }
    var delta = Math.min(40, now - lastFrame);
    lastFrame = now;
    if (!drag.active && !reducedMotion) {
      state.yaw += state.vx * delta + 0.000035 * delta;
      state.pitch += state.vy * delta;
      state.vx *= Math.pow(0.94, delta / 16);
      state.vy *= Math.pow(0.94, delta / 16);
      state.pitch = Math.max(-1.25, Math.min(1.25, state.pitch));
    }
    positionNodes();
    frame = requestAnimationFrame(animate);
  }

  function startAnimation() {
    if (frame) return;
    lastFrame = performance.now();
    frame = requestAnimationFrame(animate);
  }

  var orbitIdleLoaded = false;
  function idleLoadOrbitPhotos() {
    if (orbitIdleLoaded || !nodes.length) return;
    var unloaded = nodes.filter(function (n) { return !n.loaded && n.thumbUrl; });
    if (!unloaded.length) { orbitIdleLoaded = true; return; }
    var chunk = unloaded.slice(0, 4);
    chunk.forEach(function (n) {
      n.loaded = true;
      n.el.style.backgroundImage = 'url("' + n.thumbUrl.replace(/"/g, '%22') + '")';
    });
    if (window.requestIdleCallback) {
      window.requestIdleCallback(idleLoadOrbitPhotos, { timeout: 1000 });
    } else {
      setTimeout(idleLoadOrbitPhotos, 80);
    }
  }
  setTimeout(idleLoadOrbitPhotos, 500);

  new IntersectionObserver(function (entries) {
    inView = entries[0].isIntersecting;
    if (inView) startAnimation();
  }, { threshold: 0.05 }).observe(orbitEl);

  orbitEl.addEventListener('pointerdown', function (e) {
    if (e.button !== undefined && e.button !== 0) return;
    drag.active = true;
    drag.moved = false;
    drag.x = e.clientX;
    drag.y = e.clientY;
    drag.time = performance.now();
    drag.pointerId = e.pointerId;
    drag.capturePending = Boolean(e.target.closest('.orbit-photo'));
    state.vx = 0;
    state.vy = 0;
    orbitEl.classList.add('is-dragging');
    if (!drag.capturePending) {
      try { orbitEl.setPointerCapture(e.pointerId); } catch (err) {}
    }
  });

  orbitEl.addEventListener('pointermove', function (e) {
    if (!drag.active) return;
    var dx = e.clientX - drag.x;
    var dy = e.clientY - drag.y;
    var elapsed = Math.max(8, performance.now() - drag.time);
    if (Math.abs(dx) + Math.abs(dy) > 3) {
      drag.moved = true;
      if (drag.capturePending) {
        drag.capturePending = false;
        try { orbitEl.setPointerCapture(drag.pointerId); } catch (err) {}
      }
    }
    state.yaw += dx * 0.006;
    state.pitch -= dy * 0.005;
    state.pitch = Math.max(-1.25, Math.min(1.25, state.pitch));
    state.vx = dx * 0.006 / elapsed;
    state.vy = -dy * 0.005 / elapsed;
    drag.x = e.clientX;
    drag.y = e.clientY;
    drag.time = performance.now();
  });

  function endDrag() {
    drag.active = false;
    drag.capturePending = false;
    drag.pointerId = null;
    orbitEl.classList.remove('is-dragging');
    setTimeout(function () { drag.moved = false; }, 0);
  }
  orbitEl.addEventListener('pointerup', endDrag);
  orbitEl.addEventListener('pointercancel', endDrag);

  orbitEl.addEventListener('keydown', function (e) {
    var handled = true;
    if (e.key === 'ArrowLeft') state.yaw -= 0.18;
    else if (e.key === 'ArrowRight') state.yaw += 0.18;
    else if (e.key === 'ArrowUp') state.pitch += 0.14;
    else if (e.key === 'ArrowDown') state.pitch -= 0.14;
    else if (e.key === 'Enter' && activeNodeIndex >= 0) {
      var active = nodes[activeNodeIndex];
      openMemory(active.storyIndex, active.photoIndex, orbitEl);
    } else handled = false;
    if (handled) { e.preventDefault(); positionNodes(); }
  });

  window.addEventListener('resize', positionNodes);
  positionNodes();
}

/* ---------- 照片与文字详情 ---------- */
var openMemory = function () {};
var modalInitialized = false;
var modalStories = [];

function initMemoryModal(_stories) {
  if (_stories) stories = _stories;
  if (modalInitialized) return;
  modalInitialized = true;

  var modal = document.getElementById('memory-modal');
  var dialog = modal.querySelector('.memory-dialog');
  var closeBtn = document.getElementById('modal-close');
  var image = document.getElementById('detail-image');
  var thumbs = document.getElementById('detail-thumbs');
  var prevBtn = document.getElementById('detail-prev');
  var nextBtn = document.getElementById('detail-next');
  var originalBtn = document.getElementById('detail-original');
  var photoCount = document.getElementById('detail-photo-count');
  var date = document.getElementById('detail-date');
  var title = document.getElementById('detail-title');
  var currentStory = 0;
  var currentPhoto = 0;
  var returnFocus = null;
  var hideTimer = 0;
  var photoRequestId = 0;
  var previewRequests = Object.create(null);
  var perspectiveForms = {
    '大大布': document.getElementById('big-perspective-form'),
    '小小二': document.getElementById('little-perspective-form')
  };
  var perspectiveTexts = {
    '大大布': document.getElementById('big-perspective-text'),
    '小小二': document.getElementById('little-perspective-text')
  };
  var perspectiveDisplays = {
    '大大布': document.getElementById('big-perspective-display'),
    '小小二': document.getElementById('little-perspective-display')
  };
  var perspectiveStatuses = {
    '大大布': document.getElementById('big-perspective-status'),
    '小小二': document.getElementById('little-perspective-status')
  };
  var perspectiveLogin = document.getElementById('perspective-login');
  var perspectiveLoginButton = document.getElementById('perspective-login-button');
  var editMemoryButton = document.getElementById('detail-edit-memory');
  var perspectiveRows = {};
  var perspectiveLoadId = 0;
  var background = document.querySelectorAll('body > header, body > main, body > .egg-footer');

  function defaultPerspective(author) {
    var story = stories[currentStory];
    return author === (story.event.author || '大大布') ? story.event.text : '';
  }
  function perspectiveBody(author) {
    return Object.prototype.hasOwnProperty.call(perspectiveRows, author) ? perspectiveRows[author] : defaultPerspective(author);
  }
  window.storyMemoryPerspective = {
    getBody: perspectiveBody,
    getDraft: function (author) {
      return perspectiveForms[author].hidden ? perspectiveBody(author) : perspectiveTexts[author].value;
    }
  };
  function renderPerspectives() {
    var role = window.storySync && window.storySync.getRole();
    ['大大布', '小小二'].forEach(function (author) {
      var body = role ? perspectiveBody(author) : '';
      perspectiveDisplays[author].textContent = role ? body || '还没有写下这一段回忆。' : '';
      perspectiveDisplays[author].hidden = !role || (role === author && !body);
      perspectiveForms[author].hidden = role !== author || Boolean(body);
      if (perspectiveForms[author].hidden) perspectiveTexts[author].value = '';
      document.getElementById(author === '大大布' ? 'big-perspective-label' : 'little-perspective-label').hidden = !role || (role === author && !body);
      document.getElementById(author === '大大布' ? 'big-perspective-block' : 'little-perspective-block').hidden = !role;
    });
    if (role) editMemoryButton.textContent = perspectiveBody(role) ? '修改回忆 / 添加照片' : '保存回忆 / 添加照片';
    perspectiveLogin.hidden = Boolean(role);
  }
  async function loadPerspectives() {
    var folder = stories[currentStory].event.folder;
    var requestId = ++perspectiveLoadId;
    perspectiveRows = {};
    renderPerspectives();
    if (!window.storySync || !window.storySync.getRole()) return;
    try {
      var rows = await window.storySync.load(folder);
      if (requestId !== perspectiveLoadId || folder !== stories[currentStory].event.folder) return;
      rows.forEach(function (row) { perspectiveRows[row.author] = row.body; });
      var legacyDraft = '';
      if (!Object.prototype.hasOwnProperty.call(perspectiveRows, '小小二')) {
        try {
          var legacyLittle = localStorage.getItem('story-perspective:' + folder);
          if (legacyLittle && window.storySync.getRole() === '小小二') {
            legacyDraft = legacyLittle;
          }
        } catch (e) {}
      }
      renderPerspectives();
      if (legacyDraft && !perspectiveForms['小小二'].hidden) {
        perspectiveTexts['小小二'].value = legacyDraft;
        perspectiveStatuses['小小二'].textContent = '已带入旧记录，点“保存回忆 / 添加照片”即可迁移。';
      }
    } catch (err) {
      var role = window.storySync.getRole();
      if (role) perspectiveStatuses[role].textContent = '同步暂不可用，请确认数据库脚本已运行。';
    }
  }
  ['大大布', '小小二'].forEach(function (author) {
    perspectiveForms[author].addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!window.storySync || window.storySync.getRole() !== author) return;
      var folder = stories[currentStory].event.folder;
      var body = perspectiveTexts[author].value.trim();
      if (!body) { perspectiveStatuses[author].textContent = '请先写下回忆。'; return; }
      perspectiveStatuses[author].textContent = '正在同步…';
      try {
        await window.storySync.save(folder, body);
        perspectiveRows[author] = body;
        perspectiveStatuses[author].textContent = '';
        renderPerspectives();
      } catch (err) {
        perspectiveStatuses[author].textContent = '同步失败，请稍后重试。';
      }
    });
    perspectiveTexts[author].addEventListener('input', function () {
      perspectiveStatuses[author].textContent = '尚未同步';
    });
  });
  editMemoryButton.addEventListener('click', function () {
    var role = window.storySync.getRole();
    if (!role) return;
    if (!perspectiveBody(role) && perspectiveTexts[role].value.trim()) perspectiveForms[role].requestSubmit();
    else if (window.storyGalleryEditor) window.storyGalleryEditor.editStory();
  });
  perspectiveLoginButton.addEventListener('click', function () { window.storySync.openAuth(); });
  window.storySync.onAuthChange(function () { renderPerspectives(); loadPerspectives(); });
  window.addEventListener('story-gallery-text-change', renderPerspectives);
  window.storySync.onPerspectiveChange(function (payload) {
    if (payload.new && payload.new.folder === stories[currentStory].event.folder) loadPerspectives();
  });

  function preloadPhoto(photo) {
    if (!photo) return;
    var thumb = photo.thumb || photo.src;
    if (thumb && !previewRequests[thumb]) {
      var p1 = new Image();
      previewRequests[thumb] = p1;
      p1.decoding = 'async';
      p1.src = thumb;
    }
    var full = photo.src;
    if (full && !previewRequests[full]) {
      var p2 = new Image();
      previewRequests[full] = p2;
      p2.decoding = 'async';
      p2.src = full;
    }
  }

  function preloadPreview(photo) {
    preloadPhoto(photo);
  }

  function loadPhoto(photo, instantThumb, fullSrc) {
    var requestId = ++photoRequestId;
    var story = stories[currentStory];

    image.alt = story.event.title + '，第' + (currentPhoto + 1) + '张照片';
    if (photo.w && photo.h) { image.width = photo.w; image.height = photo.h; }
    else { image.removeAttribute('width'); image.removeAttribute('height'); }

    originalBtn.hidden = false;

    // 如果没有独立大图，直接以缩略图呈现
    if (!fullSrc || fullSrc === instantThumb) {
      image.src = instantThumb;
      image.classList.remove('is-loading');
      originalBtn.textContent = '已显示原图';
      originalBtn.disabled = true;
      return;
    }

    // 若大图已在浏览器内存/预载缓存中，直接展示高清
    if (previewRequests[fullSrc] && previewRequests[fullSrc].complete && previewRequests[fullSrc].naturalWidth) {
      image.src = fullSrc;
      image.classList.remove('is-loading');
      originalBtn.textContent = '已显示高清原图';
      originalBtn.disabled = true;
      return;
    }

    // 渐进式呈现：先以极速缩略图作为即时底图（0ms 白屏等待），后台静默替换为全屏超清原图
    image.src = instantThumb;
    image.classList.add('is-loading');
    originalBtn.disabled = false;
    originalBtn.textContent = '高清载入中…';

    image.onerror = function () {
      if (requestId !== photoRequestId) return;
      if (!fullSrc || fullSrc === instantThumb) {
        image.classList.remove('is-loading');
        originalBtn.disabled = false;
        originalBtn.textContent = '照片加载失败，点击重试';
      }
    };

    var fullImg = new Image();
    fullImg.decoding = 'async';
    fullImg.onload = function () {
      if (requestId !== photoRequestId) return;
      image.src = fullSrc;
      image.classList.remove('is-loading');
      originalBtn.textContent = '已显示高清原图';
      originalBtn.disabled = true;
    };
    fullImg.onerror = function () {
      if (requestId !== photoRequestId) return;
      image.classList.remove('is-loading');
      originalBtn.disabled = false;
      originalBtn.textContent = (image.naturalWidth > 0) ? '原图加载失败，点击重试' : '照片加载失败，点击重试';
    };
    fullImg.src = fullSrc;
  }

  function showPhoto(index) {
    var story = stories[currentStory];
    currentPhoto = (index + story.photos.length) % story.photos.length;
    var photo = story.photos[currentPhoto];
    if (window.storyGalleryEditor) window.storyGalleryEditor.showPhoto(photo);
    var instantThumb = photo.thumb || photo.src;
    var fullSrc = photo.src;
    loadPhoto(photo, instantThumb, fullSrc);
    photoCount.textContent = (currentPhoto + 1) + ' / ' + story.photos.length;
    Array.prototype.forEach.call(thumbs.children, function (thumb, thumbIndex) {
      var selected = thumbIndex === currentPhoto;
      thumb.classList.toggle('is-active', selected);
      thumb.setAttribute('aria-current', selected ? 'true' : 'false');
      if (selected) thumb.scrollIntoView({ block: 'nearest', inline: 'center' });
    });
    preloadPhoto(story.photos[(currentPhoto + 1) % story.photos.length]);
    preloadPhoto(story.photos[(currentPhoto - 1 + story.photos.length) % story.photos.length]);
  }

  function buildThumbs(story) {
    thumbs.innerHTML = '';
    story.photos.forEach(function (photo, index) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'detail-thumb';
      button.setAttribute('aria-label', '查看第' + (index + 1) + '张照片');
      button.style.backgroundImage = 'url("' + (photo.thumb || photo.src).replace(/"/g, '%22') + '")';
      button.style.backgroundSize = 'cover';
      button.style.backgroundPosition = 'center';
      button.addEventListener('click', function () { showPhoto(index); });
      thumbs.appendChild(button);
    });
  }

  openMemory = function (storyIndex, photoIndex, source) {
    if (!window.storySync || !window.storySync.getRole()) {
      if (window.storySync && window.storySync.openAuth) window.storySync.openAuth();
      return;
    }
    currentStory = storyIndex;
    returnFocus = source;
    var story = stories[storyIndex];
    if (window.storyGalleryEditor) window.storyGalleryEditor.openStory(story);
    date.textContent = story.event.date;
    title.textContent = story.event.title;
    Object.keys(perspectiveStatuses).forEach(function (author) { perspectiveStatuses[author].textContent = ''; });
    Object.keys(perspectiveTexts).forEach(function (author) { perspectiveTexts[author].value = ''; });
    loadPerspectives();
    buildThumbs(story);
    preloadPhoto(story.photos[photoIndex]);
    showPhoto(photoIndex);
    clearTimeout(hideTimer);
    modal.hidden = false;
    document.body.classList.add('modal-open');
    background.forEach(function (el) { el.inert = true; });
    dialog.scrollTop = 0;
    modal.querySelector('.detail-copy').scrollTop = 0;
    requestAnimationFrame(function () {
      modal.classList.add('is-open');
      dialog.focus();
    });
  };

  function closeModal() {
    if (modal.hidden) return;
    modal.classList.remove('is-open');
    document.body.classList.remove('modal-open');
    background.forEach(function (el) { el.inert = false; });
    hideTimer = setTimeout(function () {
      modal.hidden = true;
      photoRequestId++;
      image.src = '';
      if (returnFocus && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
    }, 220);
  }
  window.closeMemoryModal = closeModal;

  closeBtn.addEventListener('click', closeModal);
  modal.querySelector('[data-modal-close]').addEventListener('click', closeModal);
  prevBtn.addEventListener('click', function () { showPhoto(currentPhoto - 1); });
  nextBtn.addEventListener('click', function () { showPhoto(currentPhoto + 1); });
  originalBtn.addEventListener('click', async function () {
    var photo = stories[currentStory].photos[currentPhoto];
    if (!photo) return;
    if (originalBtn.textContent.includes('重试')) {
      originalBtn.disabled = true;
      originalBtn.textContent = '正在重新获取…';
      if (photo.storagePath && window.storySync && window.storySync.refreshSignedUrls) {
        try {
          var refreshed = await window.storySync.refreshSignedUrls([photo.storagePath, photo.thumbPath].filter(Boolean));
          if (refreshed[photo.storagePath]) photo.src = refreshed[photo.storagePath];
          if (refreshed[photo.thumbPath]) photo.thumb = refreshed[photo.thumbPath];
        } catch (_) {}
      }
      loadPhoto(photo, photo.thumb || photo.src, photo.src);
    } else if (photo.src) {
      window.open(photo.src, '_blank');
    }
  });

  modal.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeModal(); return; }
    var editing = e.target.tagName === 'TEXTAREA';
    if (!editing && e.key === 'ArrowLeft') { e.preventDefault(); showPhoto(currentPhoto - 1); return; }
    if (!editing && e.key === 'ArrowRight') { e.preventDefault(); showPhoto(currentPhoto + 1); return; }
    if (e.key !== 'Tab') return;
    var focusable = Array.prototype.filter.call(modal.querySelectorAll('button:not([disabled]), textarea'), function (el) { return el.getClientRects().length; });
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}

/* ---------- 爱心粒子 ---------- */
(function makeHearts() {
  var layer = document.getElementById('hearts');
  if (document.documentElement.classList.contains('orbit-reduced-fx')) return;
  for (var i = 0; i < 16; i++) {
    var h = document.createElement('span');
    h.className = 'heart';
    h.textContent = '♥';
    h.style.left = (Math.random() * 100) + '%';
    h.style.fontSize = (8 + Math.random() * 10) + 'px';
    h.style.animationDuration = (11 + Math.random() * 12) + 's';
    h.style.animationDelay = (-Math.random() * 20) + 's';
    layer.appendChild(h);
  }
})();
