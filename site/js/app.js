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

/* ---------- 数据加载 ---------- */
var chaptersEl = document.getElementById('chapters');
var marqueeSectionTop = 0;

Promise.all([
  fetch('data/events.json').then(function (r) { return r.json(); }),
  fetch('data/photos.json').then(function (r) { return r.json(); })
]).then(function (res) {
  var events = res[0];
  var photosByFolder = {};
  var allPhotos = [];
  res[1].chapters.forEach(function (c) {
    photosByFolder[c.folder] = c.photos;
    c.photos.forEach(function (p) { allPhotos.push(p); });
  });
  renderChapters(events, photosByFolder);
  renderMarquee(allPhotos);
  measureMarquee();
  renderAboutLine();
  marqueeSectionTop = document.getElementById('photos').getBoundingClientRect().top + window.scrollY;
  onMarqueeScroll();
}).catch(function (e) {
  chaptersEl.innerHTML = '<p style="text-align:center;padding:3rem">加载失败：' + e.message + '</p>';
});

/* ---------- 照片跑马灯 ---------- */
var marqueeRows = [];

function renderMarquee(allPhotos) {
  var row1 = [], row2 = [];
  allPhotos.forEach(function (p, i) { (i % 2 === 0 ? row1 : row2).push(p); });
  buildRow('marquee-row-1', row1, 1);
  buildRow('marquee-row-2', row2, -1);
}

function buildRow(id, list, dir) {
  var el = document.getElementById(id);
  for (var t = 0; t < 3; t++) {
    list.forEach(function (p) {
      var d = document.createElement('div');
      d.className = 'marquee-tile';
      var img = document.createElement('img');
      img.src = p.src;
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      d.appendChild(img);
      el.appendChild(d);
    });
  }
  marqueeRows.push({ el: el, list: list, dir: dir, setW: 0 });
}

function measureMarquee() {
  marqueeRows.forEach(function (r) {
    var tile = r.el.firstElementChild;
    r.setW = r.list.length * ((tile ? tile.offsetWidth : 280) + 12);
  });
}

function onMarqueeScroll() {
  var offset = (window.scrollY - marqueeSectionTop + window.innerHeight) * 0.3;
  marqueeRows.forEach(function (r) {
    if (!r.setW) return;
    var x = (offset - 200) % r.setW;
    if (x < 0) x += r.setW;
    r.el.style.transform = 'translateX(' + (r.dir * x) + 'px)';
  });
}

var marqueeTicking = false;
window.addEventListener('scroll', function () {
  if (!marqueeTicking) {
    marqueeTicking = true;
    requestAnimationFrame(function () { onMarqueeScroll(); marqueeTicking = false; });
  }
}, { passive: true });

window.addEventListener('resize', function () {
  measureMarquee();
  marqueeSectionTop = document.getElementById('photos').getBoundingClientRect().top + window.scrollY;
  positionCards();
});

/* ---------- 过渡段逐字显现 ---------- */
function renderAboutLine() {
  var el = document.getElementById('about-text');
  var text = '88 张照片，从 2025 年 11 月到 2026 年 5 月。';
  var spans = [];
  text.split('').forEach(function (ch) {
    var s = document.createElement('span');
    s.className = 'achar';
    s.textContent = ch;
    el.appendChild(s);
    spans.push(s);
  });
  var done = false;
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting && !done) {
        done = true;
        spans.forEach(function (s, i) {
          setTimeout(function () { s.classList.add('lit'); }, 40 * i);
        });
        observer.disconnect();
      }
    });
  }, { threshold: 0.5 });
  observer.observe(el);
}

/* ---------- 叠放组件 ---------- */
function createStack(wrapEl, photos) {
  var n = photos.length;
  var order = [];
  for (var i = 0; i < n; i++) order.push(i);
  var cards = [];
  var animating = false;
  var counterEl = null, panel = null;

  function buildCards() {
    photos.forEach(function (p) {
      var c = document.createElement('div');
      c.className = 'photo-card';
      var img = document.createElement('img');
      img.src = p.src;
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      c.appendChild(img);
      wrapEl.appendChild(c);
      cards.push(c);
    });
    if (cards.length) cards[0].querySelector('img').loading = 'eager';
  }

  function stackStyle(pos) {
    if (pos === 0) return { t: 'translate(0px,0px) rotate(0deg)', o: 1, z: 30 };
    var d = Math.min(pos, 3);
    var x = (d % 2 === 0 ? -7 : 7) * d;
    return { t: 'translate(' + x + 'px,' + (16 * d) + 'px) rotate(' + ((d % 2 === 0 ? -1.4 : 1.4) * d) + 'deg)', o: pos <= 3 ? 0.92 : 0, z: 30 - d };
  }

  function applyPositions() {
    cards.forEach(function (c, i) {
      var s = stackStyle(order.indexOf(i));
      c.style.transform = s.t;
      c.style.opacity = s.o;
      c.style.zIndex = s.z;
    });
  }

  function notify(idx) {
    if (counterEl) counterEl.textContent = (idx + 1) + ' / ' + n;
    if (panel) panel.show();
  }

  function goNext() {
    if (animating || n < 2) return;
    animating = true;
    var top = order[0], c = cards[top];
    c.style.transition = 'transform .32s ease-in, opacity .32s ease-in';
    c.style.zIndex = 1;
    c.style.transform = 'translate(-150%, 24px) rotate(-14deg)';
    c.style.opacity = '0';
    order.push(order.shift());
    notify(order[0]);
    setTimeout(function () {
      c.style.transition = 'none';
      var s = stackStyle(order.indexOf(top));
      c.style.transform = s.t;
      c.style.zIndex = s.z;
      void c.offsetWidth;
      c.style.transition = '';
      applyPositions();
      animating = false;
    }, 330);
  }

  function goPrev() {
    if (animating || n < 2) return;
    animating = true;
    var last = order[order.length - 1], c = cards[last];
    c.style.transition = 'none';
    c.style.transform = 'translate(120%, 0) rotate(10deg)';
    c.style.opacity = '0';
    void c.offsetWidth;
    c.style.transition = 'transform .32s ease-out, opacity .32s ease-out';
    order.pop();
    order.unshift(last);
    c.style.zIndex = 40;
    c.style.transform = 'translate(0px,0px) rotate(0deg)';
    c.style.opacity = '1';
    notify(order[0]);
    setTimeout(function () { applyPositions(); animating = false; }, 340);
  }

  var startX = null;
  wrapEl.addEventListener('pointerdown', function (e) { startX = e.clientX; });
  wrapEl.addEventListener('pointerup', function (e) {
    if (startX === null) return;
    var dx = e.clientX - startX;
    if (dx > 40) goPrev();
    else if (dx < -40) goNext();
    startX = null;
  });
  wrapEl.addEventListener('click', function () { goNext(); });

  buildCards();
  applyPositions();

  return {
    next: goNext,
    prev: goPrev,
    bindControls: function (prevBtn, nextBtn, counter, descPanel) {
      counterEl = counter;
      panel = descPanel;
      prevBtn.addEventListener('click', function () { goPrev(); });
      nextBtn.addEventListener('click', function () { goNext(); });
      if (n < 2) {
        prevBtn.style.visibility = 'hidden';
        nextBtn.style.visibility = 'hidden';
        counter.style.visibility = 'hidden';
      }
      notify(0);
    }
  };
}

/* ---------- 文字面板 ---------- */
function makeTextPanel(chapter) {
  var panel = document.createElement('div');
  panel.className = 'desc-panel';
  panel.innerHTML =
    '<div class="desc-date"></div>' +
    '<div class="desc-text"></div>';
  var dateEl = panel.querySelector('.desc-date');
  var textEl = panel.querySelector('.desc-text');
  return {
    el: panel,
    show: function () {
      panel.classList.remove('fade-in');
      panel.classList.add('fade-out');
      setTimeout(function () {
        dateEl.textContent = chapter.date;
        textEl.textContent = chapter.text;
        panel.classList.remove('fade-out');
        panel.classList.add('fade-in');
      }, 120);
    }
  };
}

/* ---------- 渲染章节（sticky 叠压卡片） ---------- */
var cardList = [];

function renderChapters(events, photosByFolder) {
  var total = events.length;
  events.forEach(function (ev, idx) {
    var photos = photosByFolder[ev.folder] || [];
    var slot = document.createElement('div');
    slot.className = 'card-slot';

    var card = document.createElement('article');
    card.className = 'chapter-card';

    var head = document.createElement('div');
    head.className = 'card-head';
    var num = document.createElement('span');
    num.className = 'card-num';
    num.textContent = (idx + 1 < 10 ? '0' : '') + (idx + 1);
    var meta = document.createElement('div');
    meta.className = 'card-meta';
    var dateEl = document.createElement('div');
    dateEl.className = 'desc-date';
    dateEl.textContent = ev.date;
    var titleEl = document.createElement('h3');
    titleEl.className = 'desc-title';
    titleEl.textContent = ev.title;
    meta.appendChild(dateEl);
    meta.appendChild(titleEl);
    var count = document.createElement('span');
    count.className = 'card-count';
    count.textContent = photos.length + ' PHOTOS';
    head.appendChild(num);
    head.appendChild(meta);
    head.appendChild(count);
    card.appendChild(head);

    var body = document.createElement('div');
    body.className = 'card-body';
    var stackSide = document.createElement('div');
    stackSide.className = 'stack-side';
    var wrap = document.createElement('div');
    wrap.className = 'stack-wrap';
    var controls = document.createElement('div');
    controls.className = 'deck-controls';
    var prevBtn = document.createElement('button');
    prevBtn.textContent = '‹';
    var counter = document.createElement('span');
    counter.className = 'deck-counter';
    var nextBtn = document.createElement('button');
    nextBtn.textContent = '›';
    controls.appendChild(prevBtn);
    controls.appendChild(counter);
    controls.appendChild(nextBtn);
    stackSide.appendChild(wrap);
    stackSide.appendChild(controls);

    var panel = makeTextPanel(ev);
    body.appendChild(stackSide);
    body.appendChild(panel.el);
    card.appendChild(body);
    slot.appendChild(card);
    chaptersEl.appendChild(slot);

    if (photos.length) {
      createStack(wrap, photos).bindControls(prevBtn, nextBtn, counter, panel);
    } else {
      panel.show();
      counter.textContent = '0 / 0';
    }

    cardList.push({ card: card, idx: idx, total: total });
  });
  positionCards();
}

function positionCards() {
  var mobile = window.innerWidth < 760;
  cardList.forEach(function (item) {
    item.card.style.top = (mobile ? 16 + item.idx * 8 : 24 + item.idx * 10) + 'px';
    item.card.style.transform = 'scale(' + (1 - (item.total - 1 - item.idx) * 0.015) + ')';
    item.card.style.zIndex = item.idx + 1;
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
