'use strict';

/* ---------- Hero 载入淡入 ---------- */
document.body.classList.add('loaded');

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
  return { name: 'desktop', maxNodes: Infinity, frameInterval: 16, visibilityThreshold: -0.56, reducedEffects: false };
}

function selectOrbitPhotos(stories, maxNodes) {
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

Promise.all([
  fetch('data/events.json').then(function (r) { if (!r.ok) throw new Error('文字数据读取失败'); return r.json(); }),
  fetch('data/photos.json').then(function (r) { if (!r.ok) throw new Error('照片数据读取失败'); return r.json(); })
]).then(function (res) {
  var photosByFolder = {};
  res[1].chapters.forEach(function (chapter) { photosByFolder[chapter.folder] = chapter.photos; });
  var stories = res[0].map(function (event) {
    return { event: event, photos: photosByFolder[event.folder] || [] };
  }).filter(function (story) { return story.photos.length; });
  renderOrbit(stories);
  initMemoryModal(stories);
  initMemoryViews(stories);
  var linkedMemory = new URLSearchParams(location.search).get('memory');
  var linkedIndex = stories.findIndex(function (story) { return story.event.folder === linkedMemory; });
  if (linkedIndex >= 0) {
    document.getElementById('photos').scrollIntoView();
    openMemory(linkedIndex, 0, orbitEl);
  }
  if (resumeVisit) {
    requestAnimationFrame(function () {
      window.scrollTo({ top: memoryVisit.scrollY || document.getElementById('photos').offsetTop, behavior: 'instant' });
    });
  }
}).catch(function (e) {
  galleryError.textContent = '照片暂时没有排好队：' + e.message;
});

function initMemoryViews(stories) {
  var orbitPanel = document.getElementById('orbit-panel');
  var timelinePanel = document.getElementById('timeline-panel');
  var orbitButton = document.getElementById('view-orbit');
  var timelineButton = document.getElementById('view-timeline');
  var monthSelect = document.getElementById('memory-month');
  var timeline = document.getElementById('timeline-list');
  var summary = document.getElementById('gallery-summary');
  var months = [];

  function monthOf(story) { return story.event.folder.split('.').slice(0, 2).join('.'); }
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
    button.appendChild(image);
    var copy = makeText('span', 'memory-card-copy', '');
    copy.appendChild(makeText('span', 'memory-card-date', story.event.date));
    copy.appendChild(makeText('strong', '', story.event.title));
    copy.appendChild(makeText('span', 'memory-card-excerpt', story.event.text));
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
  months.forEach(function (month) {
    var option = document.createElement('option');
    option.value = month;
    option.textContent = monthLabel(month);
    monthSelect.appendChild(option);
  });
  monthSelect.value = months.indexOf(memoryVisit.month) !== -1 ? memoryVisit.month : 'all';

  function renderTimeline() {
    timeline.replaceChildren();
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
    memoryVisit.view = view;
    orbitPanel.hidden = view !== 'orbit';
    timelinePanel.hidden = view !== 'timeline';
    orbitButton.setAttribute('aria-pressed', String(view === 'orbit'));
    timelineButton.setAttribute('aria-pressed', String(view === 'timeline'));
    if (view === 'timeline') renderTimeline();
    updateSummary();
  }
  orbitButton.addEventListener('click', function () { setView('orbit'); });
  timelineButton.addEventListener('click', function () { setView('timeline'); });
  monthSelect.addEventListener('change', function () {
    memoryVisit.month = monthSelect.value;
    renderTimeline();
    updateSummary();
  });
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
  var atlasIndex = 0;
  var selectedPhotos = selectOrbitPhotos(stories, orbitProfile.maxNodes);

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
      photo.atlasIndex = atlasIndex;
      var currentAtlasIndex = atlasIndex;
      atlasIndex += 1;
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
      setAtlasPosition(button, currentAtlasIndex);
      button.dataset.storyIndex = String(storyIndex);
      button.dataset.photoIndex = String(photoIndex);
      button.setAttribute('aria-label', story.event.date + '，' + story.event.title + '，第' + (photoIndex + 1) + '张照片');
      fragment.appendChild(button);

      var node = {
        el: button,
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

  var atlasImage = new Image();
  atlasImage.onload = function () { orbitEl.classList.add('is-ready'); };
  atlasImage.onerror = function () { galleryError.textContent = '照片预览图加载失败，请刷新后再试。'; };
  atlasImage.src = 'img/orbit-atlas.webp';
  if (atlasImage.complete && atlasImage.naturalWidth) orbitEl.classList.add('is-ready');

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

function initMemoryModal(stories) {
  var modal = document.getElementById('memory-modal');
  var dialog = modal.querySelector('.memory-dialog');
  var closeBtn = document.getElementById('modal-close');
  var image = document.getElementById('detail-image');
  var thumbs = document.getElementById('detail-thumbs');
  var prevBtn = document.getElementById('detail-prev');
  var nextBtn = document.getElementById('detail-next');
  var photoCount = document.getElementById('detail-photo-count');
  var date = document.getElementById('detail-date');
  var title = document.getElementById('detail-title');
  var text = document.getElementById('detail-text');
  var currentStory = 0;
  var currentPhoto = 0;
  var returnFocus = null;
  var hideTimer = 0;
  var perspectiveForm = document.getElementById('perspective-form');
  var perspectiveText = document.getElementById('perspective-text');
  var perspectiveStatus = document.getElementById('perspective-status');
  var background = document.querySelectorAll('body > header, body > main, body > .egg-footer');

  perspectiveForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var key = 'story-perspective:' + stories[currentStory].event.folder;
    try {
      if (perspectiveText.value.trim()) localStorage.setItem(key, perspectiveText.value);
      else localStorage.removeItem(key);
      perspectiveStatus.textContent = perspectiveText.value.trim() ? '已保存在此浏览器' : '已清空这一段';
    } catch (err) { perspectiveStatus.textContent = '未能保存，请先复制文字留存。'; }
  });
  perspectiveText.addEventListener('input', function () { perspectiveStatus.textContent = '尚未保存'; });

  function showPhoto(index) {
    var story = stories[currentStory];
    currentPhoto = (index + story.photos.length) % story.photos.length;
    var photo = story.photos[currentPhoto];
    image.classList.add('is-loading');
    image.onload = function () { image.classList.remove('is-loading'); };
    image.src = photo.src;
    image.alt = story.event.title + '，第' + (currentPhoto + 1) + '张照片';
    image.width = photo.w;
    image.height = photo.h;
    photoCount.textContent = (currentPhoto + 1) + ' / ' + story.photos.length;
    Array.prototype.forEach.call(thumbs.children, function (thumb, thumbIndex) {
      var selected = thumbIndex === currentPhoto;
      thumb.classList.toggle('is-active', selected);
      thumb.setAttribute('aria-current', selected ? 'true' : 'false');
      if (selected) thumb.scrollIntoView({ block: 'nearest', inline: 'center' });
    });
  }

  function buildThumbs(story) {
    thumbs.innerHTML = '';
    story.photos.forEach(function (photo, index) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'detail-thumb';
      button.setAttribute('aria-label', '查看第' + (index + 1) + '张照片');
      setAtlasPosition(button, photo.atlasIndex);
      button.addEventListener('click', function () { showPhoto(index); });
      thumbs.appendChild(button);
    });
  }

  openMemory = function (storyIndex, photoIndex, source) {
    currentStory = storyIndex;
    returnFocus = source;
    var story = stories[storyIndex];
    date.textContent = story.event.date;
    title.textContent = story.event.title;
    text.textContent = story.event.text;
    perspectiveText.value = '';
    perspectiveStatus.textContent = '';
    try { perspectiveText.value = localStorage.getItem('story-perspective:' + story.event.folder) || ''; } catch (e) {}
    if (perspectiveText.value) perspectiveStatus.textContent = '已读取此浏览器的记录';
    buildThumbs(story);
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
      image.src = '';
      if (returnFocus && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
    }, 220);
  }

  closeBtn.addEventListener('click', closeModal);
  modal.querySelector('[data-modal-close]').addEventListener('click', closeModal);
  prevBtn.addEventListener('click', function () { showPhoto(currentPhoto - 1); });
  nextBtn.addEventListener('click', function () { showPhoto(currentPhoto + 1); });

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
