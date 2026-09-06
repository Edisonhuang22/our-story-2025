'use strict';

/* ---------- sha256（密码哈希比较） ---------- */
function sha256(ascii) {
  function rightRotate(value, amount) { return (value >>> amount) | (value << (32 - amount)); }
  var mathPow = Math.pow, maxWord = mathPow(2, 32), result = '';
  var words = [], asciiBitLength = ascii.length * 8;
  var hash = sha256.h = sha256.h || [], k = sha256.k = sha256.k || [];
  var primeCounter = k.length, isComposite = {}, i, j, candidate;
  for (candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  ascii += '\x80';
  while ((ascii.length % 64) - 56) ascii += '\x00';
  for (i = 0; i < ascii.length; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return '';
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;
  for (j = 0; j < words.length;) {
    var w = words.slice(j, (j += 16)), oldHash = hash;
    hash = hash.slice(0, 8);
    for (i = 0; i < 64; i++) {
      var w15 = w[i - 15], w2 = w[i - 2];
      var a = hash[0], e = hash[4];
      var temp1 = hash[7] + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
        + ((e & hash[5]) ^ (~e & hash[6])) + k[i]
        + (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
          + w[i - 7] + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) | 0);
      var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
        + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }
    for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }
  for (i = 0; i < 8; i++) {
    for (j = 3; j + 1; j--) {
      var b = (hash[i] >> (j * 8)) & 255;
      result += ((b < 16) ? 0 : '') + b.toString(16);
    }
  }
  return result;
}

/* ---------- 密码门 ---------- */
var PASSWORD_HASH = '2c789f164e82993b3422581c8a4d70f1a643284a395e5111f1643509aee0caca'; // sha256('20251213')

(function initGate() {
  var gate = document.getElementById('gate');
  var input = document.getElementById('gate-input');
  var btn = document.getElementById('gate-btn');
  var err = document.getElementById('gate-error');
  var card = gate.querySelector('.gate-card');

  function unlock() {
    gate.classList.add('hidden');
    try { sessionStorage.setItem('unlocked', '1'); } catch (e) {}
  }
  function attempt() {
    if (sha256(input.value) === PASSWORD_HASH) { unlock(); return; }
    err.textContent = '不对哦，再想想';
    card.classList.remove('shake');
    void card.offsetWidth;
    card.classList.add('shake');
  }

  var already = false;
  try { already = sessionStorage.getItem('unlocked') === '1'; } catch (e) {}
  if (already) { gate.classList.add('hidden'); return; }

  btn.addEventListener('click', attempt);
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') attempt(); });
})();

/* ---------- Hero 载入淡入 ---------- */
window.addEventListener('load', function () {
  document.body.classList.add('loaded');
});

/* ---------- Hero 主图磁性跟随 ---------- */
(function initMagnet() {
  var el = document.getElementById('hero-portrait');
  if (!el) return;
  var leaving = true;
  document.addEventListener('mousemove', function (e) {
    var r = el.getBoundingClientRect();
    var pad = 150;
    var inside = e.clientX > r.left - pad && e.clientX < r.right + pad && e.clientY > r.top - pad && e.clientY < r.bottom + pad;
    if (inside) {
      var dx = e.clientX - (r.left + r.width / 2);
      var dy = e.clientY - (r.top + r.height / 2);
      el.style.transition = 'transform 0.3s ease-out';
      el.style.transform = 'translate3d(' + (dx / 3) + 'px,' + (dy / 3) + 'px,0)';
      leaving = true;
    } else if (leaving) {
      leaving = false;
      el.style.transition = 'transform 0.6s ease-in-out';
      el.style.transform = 'translate3d(0,0,0)';
    }
  });
})();

/* ---------- 照片故事球 ---------- */
var orbitEl = document.getElementById('memory-orbit');
var orbitStage = document.getElementById('orbit-stage');
var orbitDate = document.getElementById('orbit-date');
var orbitTitle = document.getElementById('orbit-title');
var orbitCount = document.getElementById('orbit-count');
var galleryError = document.getElementById('gallery-error');
var ORBIT_ATLAS_COLUMNS = 11;
var ORBIT_ATLAS_ROWS = 8;

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
}).catch(function (e) {
  galleryError.textContent = '照片暂时没有排好队：' + e.message;
});

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
      setAtlasPosition(button, atlasIndex);
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
        z: -1
      };
      nodes.push(node);
      atlasIndex += 1;
      button.addEventListener('click', function () {
        if (!drag.moved) openMemory(storyIndex, photoIndex, button);
      });
    });
  });
  orbitStage.appendChild(fragment);

  var atlasImage = new Image();
  atlasImage.onload = function () { orbitEl.classList.add('is-ready'); };
  atlasImage.onerror = function () { galleryError.textContent = '照片预览图加载失败，请刷新后再试。'; };
  atlasImage.src = 'img/orbit-atlas.webp';
  if (atlasImage.complete && atlasImage.naturalWidth) orbitEl.classList.add('is-ready');

  var state = { yaw: -0.48, pitch: -0.08, vx: 0, vy: 0 };
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
      node.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) scale(' + scale.toFixed(3) + ') rotate(' + node.el.style.getPropertyValue('--photo-tilt') + ')';
      node.el.style.opacity = opacity.toFixed(3);
      node.el.style.zIndex = String(Math.round(depth * 1000));
      var visible = z2 > -0.56;
      if (visible !== node.visible) {
        node.visible = visible;
        node.el.style.visibility = visible ? 'visible' : 'hidden';
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
    if (now - lastFrame < 30) { frame = requestAnimationFrame(animate); return; }
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
    positionNodes();
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
    buildThumbs(story);
    showPhoto(photoIndex);
    clearTimeout(hideTimer);
    modal.hidden = false;
    document.body.classList.add('modal-open');
    requestAnimationFrame(function () {
      modal.classList.add('is-open');
      dialog.focus();
    });
  };

  function closeModal() {
    if (modal.hidden) return;
    modal.classList.remove('is-open');
    document.body.classList.remove('modal-open');
    hideTimer = setTimeout(function () {
      modal.hidden = true;
      image.src = '';
      if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
    }, 220);
  }

  closeBtn.addEventListener('click', closeModal);
  modal.querySelector('[data-modal-close]').addEventListener('click', closeModal);
  prevBtn.addEventListener('click', function () { showPhoto(currentPhoto - 1); });
  nextBtn.addEventListener('click', function () { showPhoto(currentPhoto + 1); });

  modal.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); showPhoto(currentPhoto - 1); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); showPhoto(currentPhoto + 1); return; }
    if (e.key !== 'Tab') return;
    var focusable = modal.querySelectorAll('button:not([disabled])');
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}

/* ---------- 爱心粒子 ---------- */
(function makeHearts() {
  var layer = document.getElementById('hearts');
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
