'use strict';

(function initMailbox() {
  var lettersKey = 'story-mailbox-letters';
  var draftKey = 'story-mailbox-draft';
  var letters = [];
  var draft = null;
  var current = null;
  var editingId = null;
  var draftTimer = 0;
  var storageHealthy = true;
  var stackIndex = 0;
  var composePhotos = [];
  var photoBusy = false;
  var photoUrls = { compose: [], reader: [] };
  var gallery = [];
  var galleryIndex = 0;
  var dbPromise;
  var listPanel = document.getElementById('mailbox-list');
  var composePanel = document.getElementById('letter-compose');
  var reader = document.getElementById('letter-reader');
  var list = document.getElementById('letter-list');
  var form = document.getElementById('letter-form');
  var status = document.getElementById('mailbox-status');
  var draftStatus = document.getElementById('draft-status');
  var resume = document.getElementById('resume-draft');
  var content = document.getElementById('letter-content');
  var memoryLink = document.getElementById('letter-memory-link');
  var fields = {};
  ['sender', 'date', 'title', 'body', 'memory'].forEach(function (name) {
    fields[name] = document.getElementById('letter-' + name);
  });
  var original = { id: 'original-20260819', date: '2026-08-19', title: '小作文', sender: '大大怪', original: true };

  function validLetter(letter, isDraft) {
    return letter && typeof letter.id === 'string' && typeof letter.title === 'string' && typeof letter.body === 'string' &&
      (isDraft && letter.date === '' || /^\d{4}-\d{2}-\d{2}$/.test(letter.date)) && ['大大怪', '小小怪'].indexOf(letter.sender) !== -1;
  }
  try {
    letters = JSON.parse(localStorage.getItem(lettersKey) || '[]');
    if (!Array.isArray(letters) || !letters.every(function (letter) { return validLetter(letter, false); })) throw new Error('invalid letters');
    original.photos = JSON.parse(localStorage.getItem('story-mailbox-original-photos') || '[]');
    draft = JSON.parse(localStorage.getItem(draftKey) || 'null');
    if (draft && !validLetter(draft, true)) throw new Error('invalid draft');
  } catch (e) {
    letters = [];
    draft = null;
    storageHealthy = false;
    status.textContent = '无法读取此浏览器的信件，暂时不能保存新信。原有存储未被覆盖。';
  }

  function node(tag, className, value) {
    var el = document.createElement(tag);
    el.className = className;
    el.textContent = value;
    return el;
  }
  function recipient(letter) { return letter.sender === '大大怪' ? '小小怪' : '大大怪'; }
  function show(panel, focusId) {
    [listPanel, composePanel, reader].forEach(function (el) { el.hidden = el !== panel; });
    if (focusId) {
      var target = document.getElementById(focusId);
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  }
  function renderList() {
    list.replaceChildren();
    var all = [original].concat(letters).sort(function (a, b) { return b.date.localeCompare(a.date) || b.id.localeCompare(a.id); });
    stackIndex = Math.min(stackIndex, all.length - 1);
    all.forEach(function (letter, index) {
      var button = node('button', 'letter-envelope', '');
      button.type = 'button';
      var depth = (index - stackIndex + all.length) % all.length;
      button.style.setProperty('--depth', depth);
      button.style.zIndex = all.length - depth;
      button.hidden = depth > 2;
      button.disabled = depth !== 0;
      if (depth) button.setAttribute('aria-hidden', 'true');
      button.setAttribute('aria-label', '读信：' + letter.title + '，' + letter.date);
      var date = node('time', '', letter.date.replace(/-/g, '.'));
      date.dateTime = letter.date;
      button.appendChild(date);
      button.appendChild(node('strong', '', letter.title));
      button.appendChild(node('span', 'letter-address', letter.sender + ' 写给 ' + recipient(letter)));
      button.appendChild(node('span', 'letter-open', '拆开这封信 →'));
      button.addEventListener('click', function () { readLetter(letter); });
      list.appendChild(button);
    });
    document.getElementById('letter-count').textContent = all.length + ' 封信 · 按写信日期排列';
    document.getElementById('stack-position').textContent = (stackIndex + 1) + ' / ' + all.length;
    document.getElementById('previous-envelope').disabled = stackIndex === 0;
    document.getElementById('next-envelope').disabled = stackIndex === all.length - 1;
    resume.hidden = !draft;
  }
  function readLetter(letter) {
    current = letter;
    renderPhotos('reader', letter.photos || []);
    content.replaceChildren();
    if (letter.original) {
      content.appendChild(document.getElementById('original-letter').content.cloneNode(true));
    } else {
      var article = node('article', 'essay', '');
      var header = node('header', 'essay-head', '');
      header.appendChild(node('p', 'essay-date', letter.date.replace(/-/g, '.')));
      header.appendChild(node('h2', 'essay-title', letter.title));
      article.appendChild(header);
      var body = node('div', 'essay-body', '');
      body.appendChild(node('p', 'essay-p', '给' + recipient(letter) + '：'));
      body.appendChild(node('p', 'essay-p', letter.body));
      body.appendChild(node('p', 'essay-p essay-sign', '——' + letter.sender));
      article.appendChild(body);
      content.appendChild(article);
    }
    memoryLink.hidden = !letter.memory;
    if (letter.memory) memoryLink.href = 'index.html?memory=' + encodeURIComponent(letter.memory) + '#photos';
    document.getElementById('edit-letter').hidden = Boolean(letter.original);
    show(reader, 'letter-content');
  }
  function today() {
    var now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  }
  function compose(letter) {
    composePhotos = (letter && letter.photos || []).slice();
    renderPhotos('compose', composePhotos);
    editingId = letter && letter.id !== 'draft' ? letter.id : null;
    fields.sender.value = letter ? letter.sender : '大大怪';
    fields.date.value = letter ? letter.date : today();
    fields.title.value = letter ? letter.title : '';
    fields.body.value = letter ? letter.body : '';
    fields.memory.value = letter && letter.memory || '';
    fields.title.setCustomValidity('');
    fields.body.setCustomValidity('');
    document.getElementById('compose-title').textContent = editingId ? '修改这封信' : '写一封信';
    draftStatus.textContent = letter ? '已恢复文字，修改后记得收进信箱。' : '草稿会自动保存在此浏览器。';
    show(composePanel, 'compose-title');
  }
  function values() {
    return { id: editingId || 'draft', sender: fields.sender.value, date: fields.date.value, title: fields.title.value, body: fields.body.value, memory: fields.memory.value, photos: composePhotos.slice() };
  }
  function saveDraft() {
    clearTimeout(draftTimer);
    if (!storageHealthy) return false;
    var value = values();
    try {
      if (value.title.trim() || value.body.trim() || value.photos.length) {
        localStorage.setItem(draftKey, JSON.stringify(value));
        draft = value;
        draftStatus.textContent = '草稿已保存在此浏览器';
      } else {
        localStorage.removeItem(draftKey);
        draft = null;
        draftStatus.textContent = '还没有写下内容';
      }
      return true;
    } catch (e) { draftStatus.textContent = '草稿未能保存，请先复制文字留存。'; return false; }
  }
  form.addEventListener('input', function () {
    fields.title.setCustomValidity('');
    fields.body.setCustomValidity('');
    draftStatus.textContent = '正在保存草稿…';
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraft, 300);
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (photoBusy) { draftStatus.textContent = '照片还在保存，请稍候。'; return; }
    var letter = values();
    fields.title.setCustomValidity(letter.title.trim() ? '' : '请填写信的标题');
    fields.body.setCustomValidity(letter.body.trim() || letter.photos.length ? '' : '请填写电子版内容，或添加实体信件照片');
    if (!form.reportValidity()) return;
    if (!storageHealthy) { draftStatus.textContent = '当前无法保存，请先复制文字留存。'; return; }
    clearTimeout(draftTimer);
    letter.id = editingId || crypto.randomUUID();
    letter.title = letter.title.trim();
    var next = letters.filter(function (item) { return item.id !== letter.id; }).concat([letter]);
    try { localStorage.setItem(lettersKey, JSON.stringify(next)); }
    catch (err) { draftStatus.textContent = '信件未能保存，请先复制文字留存。'; return; }
    letters = next;
    try { localStorage.removeItem(draftKey); draft = null; } catch (err) {}
    status.textContent = '这封信已收进当前浏览器的信箱。';
    renderList();
    readLetter(letter);
  });
  document.getElementById('write-letter').addEventListener('click', function () { compose(draft); });
  resume.addEventListener('click', function () { compose(draft); });
  document.getElementById('cancel-letter').addEventListener('click', function () { saveDraft(); renderList(); show(listPanel, 'mailbox-list-title'); });
  document.getElementById('back-to-mailbox').addEventListener('click', function () { renderList(); show(listPanel, 'mailbox-list-title'); });
  document.getElementById('edit-letter').addEventListener('click', function () {
    if (draft && draft.id !== current.id) {
      status.textContent = '还有一封未完成的草稿，请先收进信箱，再修改其他信件。';
      renderList();
      show(listPanel, 'mailbox-list-title');
      return;
    }
    compose(current);
  });
  document.getElementById('download-letter').addEventListener('click', function () {
    var text = current.date + '\n\n' + content.innerText;
    var url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    var link = document.createElement('a');
    link.href = url;
    link.download = current.date + '-' + current.title.replace(/[\\/:*?"<>|]/g, '_') + '.txt';
    link.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });
  window.addEventListener('pagehide', function () { if (!composePanel.hidden) saveDraft(); });
  fetch('data/events.json').then(function (response) { if (!response.ok) throw new Error(); return response.json(); }).then(function (events) {
    events.forEach(function (event) {
      var option = node('option', '', event.date + ' · ' + event.title);
      option.value = event.folder;
      fields.memory.appendChild(option);
    });
    if (!composePanel.hidden && draft) fields.memory.value = draft.memory || '';
  }).catch(function () {
    fields.memory.disabled = true;
    status.textContent = '回忆列表暂时未能加载，仍可写信和读信。';
  });

  document.getElementById('previous-envelope').addEventListener('click', function () { stackIndex--; renderList(); });
  document.getElementById('next-envelope').addEventListener('click', function () { stackIndex++; renderList(); });

  function photoStore(mode, action) {
    if (!dbPromise) dbPromise = new Promise(function (resolve, reject) {
      var request = indexedDB.open('story-mailbox-photos', 1);
      request.onupgradeneeded = function () { request.result.createObjectStore('photos'); };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
    return dbPromise.then(function (db) {
      return new Promise(function (resolve, reject) {
        var transaction = db.transaction('photos', mode);
        var request = action(transaction.objectStore('photos'));
        transaction.oncomplete = function () { resolve(request.result); };
        transaction.onerror = transaction.onabort = function () { reject(transaction.error); };
      });
    });
  }
  function saveReaderPhotos(photos) {
    if (current.original) localStorage.setItem('story-mailbox-original-photos', JSON.stringify(photos));
    else {
      var next = letters.map(function (letter) { return letter.id === current.id ? Object.assign({}, letter, { photos: photos }) : letter; });
      localStorage.setItem(lettersKey, JSON.stringify(next));
      letters = next;
    }
    current.photos = photos;
  }
  async function renderPhotos(place, photos) {
    var container = document.getElementById(place + '-photos');
    var version = String(Number(container.dataset.version || 0) + 1);
    container.dataset.version = version;
    photoUrls[place].forEach(function (url) { URL.revokeObjectURL(url); });
    photoUrls[place] = [];
    container.replaceChildren();
    if (!photos.length) { container.appendChild(node('p', 'photo-empty', '还没有收录实体信照片')); return; }
    for (var index = 0; index < photos.length; index++) {
      var photo = photos[index];
      try {
        var blob = await photoStore('readonly', function (store) { return store.get(photo.id); });
        if (container.dataset.version !== version) return;
        if (!blob) throw new Error('missing photo');
        var url = URL.createObjectURL(blob);
        photoUrls[place].push(url);
        var card = node('div', 'photo-card', '');
        var button = node('button', 'photo-thumbnail', '');
        button.type = 'button';
        var img = document.createElement('img');
        img.src = url; img.alt = '第 ' + (index + 1) + ' 页：' + photo.name;
        button.appendChild(img);
        button.addEventListener('click', (function (page) { return function () {
          gallery = photos.slice(); galleryIndex = page;
          document.getElementById('photo-viewer').showModal(); showPhoto();
        }; })(index));
        card.appendChild(button);
        card.appendChild(node('span', '', '第 ' + (index + 1) + ' 页'));
        var remove = node('button', 'mail-link', '移除'); remove.type = 'button';
        remove.addEventListener('click', (function (id) { return function () {
          var next = (place === 'compose' ? composePhotos : current.photos || []).filter(function (item) { return item.id !== id; });
          try {
            if (place === 'compose') { composePhotos = next; saveDraft(); }
            else saveReaderPhotos(next);
            renderPhotos(place, next);
          } catch (e) { status.textContent = '未能保存照片修改，请重试。'; }
        }; })(photo.id));
        card.appendChild(remove); container.appendChild(card);
      } catch (e) { if (container.dataset.version === version) container.appendChild(node('p', '', '第 ' + (index + 1) + ' 页照片无法读取，请重新添加。')); }
    }
  }
  ['compose', 'reader'].forEach(function (place) {
    var input = document.getElementById(place + '-photo-input');
    input.addEventListener('change', async function () {
      if (photoBusy || !storageHealthy) return;
      photoBusy = true;
      var files = Array.from(input.files);
      var message = place === 'compose' ? draftStatus : status;
      var controls = Array.from(document.querySelectorAll('#letter-form button, #cancel-letter, #back-to-mailbox, #edit-letter, input[type=file]'));
      controls.forEach(function (el) { el.disabled = true; });
      message.textContent = '正在保存照片…';
      try {
        for (var file of files) {
          if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('请使用 JPG、PNG 或 WebP 照片。');
          var bitmap = await createImageBitmap(file); bitmap.close();
          var photo = { id: crypto.randomUUID(), name: file.name };
          await photoStore('readwrite', function (store) { return store.put(file, photo.id); });
          if (place === 'compose') { composePhotos.push(photo); fields.body.setCustomValidity(''); if (!saveDraft()) throw new Error('draft storage failed'); }
          else saveReaderPhotos((current.photos || []).concat([photo]));
        }
        message.textContent = '照片已保存在当前浏览器，点击缩略图可放大。';
      } catch (e) { message.textContent = '部分照片未能保存，请检查图片格式或浏览器存储空间后重试。'; }
      finally {
        photoBusy = false; input.value = '';
        controls.forEach(function (el) { el.disabled = false; });
        renderPhotos(place, place === 'compose' ? composePhotos : current.photos || []);
      }
    });
  });
  var viewer = document.getElementById('photo-viewer');
  var fullImage = document.getElementById('photo-full');
  var fullUrl;
  var viewVersion = 0;
  async function showPhoto() {
    var version = ++viewVersion;
    fullImage.removeAttribute('src'); fullImage.classList.remove('actual-size');
    document.getElementById('photo-zoom').textContent = '查看原尺寸';
    document.getElementById('photo-page').textContent = (galleryIndex + 1) + ' / ' + gallery.length;
    document.getElementById('photo-previous').disabled = galleryIndex === 0;
    document.getElementById('photo-next').disabled = galleryIndex === gallery.length - 1;
    try {
      var blob = await photoStore('readonly', function (store) { return store.get(gallery[galleryIndex].id); });
      if (version !== viewVersion || !viewer.open) return;
      if (!blob) throw new Error();
      if (fullUrl) URL.revokeObjectURL(fullUrl);
      fullUrl = URL.createObjectURL(blob); fullImage.src = fullUrl;
      fullImage.alt = '实体信件第 ' + (galleryIndex + 1) + ' 页';
    } catch (e) { document.getElementById('photo-page').textContent = '照片读取失败'; }
  }
  document.getElementById('photo-close').addEventListener('click', function () { viewer.close(); });
  viewer.addEventListener('close', function () { viewVersion++; fullImage.removeAttribute('src'); if (fullUrl) URL.revokeObjectURL(fullUrl); });
  document.getElementById('photo-previous').addEventListener('click', function () { galleryIndex--; showPhoto(); });
  document.getElementById('photo-next').addEventListener('click', function () { galleryIndex++; showPhoto(); });
  document.getElementById('photo-zoom').addEventListener('click', function () {
    var actual = fullImage.classList.toggle('actual-size'); this.textContent = actual ? '适应屏幕' : '查看原尺寸';
  });
  renderList();
})();
