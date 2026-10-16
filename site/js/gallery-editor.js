'use strict';

window.initGalleryEditor = function (stories, gallery) {
  var sync = window.storySync;
  var addButton = document.getElementById('gallery-add');
  var dialog = document.getElementById('gallery-editor');
  var form = document.getElementById('gallery-editor-form');
  var title = document.getElementById('gallery-editor-title');
  var dateInput = document.getElementById('gallery-editor-date');
  var nameInput = document.getElementById('gallery-editor-name');
  var bodyInput = document.getElementById('gallery-editor-body');
  var filesInput = document.getElementById('gallery-editor-files');
  var fileHint = document.getElementById('gallery-editor-file-hint');
  var fileStatus = document.getElementById('gallery-editor-file-status');
  var previews = document.getElementById('gallery-editor-previews');
  var status = document.getElementById('gallery-editor-status');
  var submitButton = document.getElementById('gallery-editor-submit');
  var closeButton = document.getElementById('gallery-editor-close');
  var hiddenPhotos = document.getElementById('gallery-hidden-photos');
  var hiddenEntries = document.getElementById('gallery-hidden-entries');
  var manageActions = document.getElementById('gallery-manage-actions');
  var removePhotoButton = document.getElementById('detail-remove-photo');
  var removeMemoryButton = document.getElementById('detail-delete-memory');
  var purgeMemoryButton = document.getElementById('detail-purge-memory');
  var dangerGroup = document.getElementById('gallery-editor-danger-group');
  var activeStory = null;
  var activePhoto = null;
  var editingStory = null;
  var originalPerspectiveBody = '';
  var queuedPhotos = [];
  var busy = false;

  function folderFromDate(value) {
    var parts = value.split('-');
    return parts[0] + '.' + Number(parts[1]) + '.' + Number(parts[2]);
  }
  function dateFromFolder(folder) {
    var parts = folder.split('.');
    return parts[0] + '-' + parts[1].padStart(2, '0') + '-' + parts[2].padStart(2, '0');
  }
  function fail(error) {
    status.textContent = '保存失败：' + (error.message || String(error));
  }
  function canEditStory(story) {
    return story && Boolean(sync.getRole());
  }
  function renderQueuedPhotos() {
    previews.replaceChildren();
    previews.hidden = !queuedPhotos.length;
    var invalidCount = queuedPhotos.filter(function (item) { return item.reason; }).length;
    fileStatus.textContent = invalidCount ? invalidCount + ' 张照片无法上传。请点红色卡片右上角的 × 移除。' : '';
    queuedPhotos.forEach(function (item) {
      var card = document.createElement('div');
      card.className = 'gallery-editor-preview' + (item.reason ? ' is-invalid' : '');
      var image;
      if (item.url) {
        image = document.createElement('img');
        image.src = item.url;
        image.alt = '';
      } else {
        image = document.createElement('div');
        image.className = 'gallery-editor-preview-empty';
        image.textContent = '无法预览';
      }
      var name = document.createElement('span');
      name.textContent = item.file.name + ' · ' + (Math.ceil(item.file.size / 1048576 * 100) / 100).toFixed(2) + ' MB';
      name.title = item.file.name;
      var remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', '移除待上传照片 ' + item.file.name);
      remove.addEventListener('click', function () {
        if (busy) return;
        queuedPhotos.splice(queuedPhotos.indexOf(item), 1);
        if (item.url) URL.revokeObjectURL(item.url);
        renderQueuedPhotos();
      });
      card.append(image, name);
      if (item.reason) {
        var reason = document.createElement('strong');
        reason.textContent = item.reason;
        card.appendChild(reason);
      }
      card.appendChild(remove);
      previews.appendChild(card);
    });
  }
  function clearQueuedPhotos() {
    queuedPhotos.forEach(function (item) { if (item.url) URL.revokeObjectURL(item.url); });
    queuedPhotos = [];
    filesInput.value = '';
    renderQueuedPhotos();
  }
  function updateButtons() {
    var canEdit = canEditStory(activeStory);
    manageActions.hidden = !canEdit;
    removePhotoButton.hidden = !canEdit || !activePhoto;
    if (!sync.getRole()) { dialog.close(); form.reset(); }
  }
  function makeRestoreButton(label, callback) {
    var button = document.createElement('button');
    button.className = 'gallery-restore';
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', async function () {
      if (busy) return;
      busy = true;
      button.disabled = true;
      status.textContent = '正在恢复…';
      try { await callback(); location.reload(); }
      catch (error) { fail(error); button.disabled = false; busy = false; }
    });
    return button;
  }
  function showHiddenPhotos(folder) {
    hiddenPhotos.replaceChildren();
    var rows = gallery.photos.filter(function (photo) { return photo.folder === folder && photo.static_src && photo.hidden; });
    hiddenPhotos.hidden = !rows.length;
    if (!rows.length) return;
    var heading = document.createElement('p');
    heading.textContent = '已移出的原有照片';
    hiddenPhotos.appendChild(heading);
    rows.forEach(function (photo) {
      hiddenPhotos.appendChild(makeRestoreButton(
        '恢复 ' + photo.static_src.split('/').slice(-2).join('/'),
        function () { return sync.setStaticGalleryPhotoHidden(folder, photo.static_src, false); }
      ));
    });
  }
  function showHiddenEntries() {
    hiddenEntries.replaceChildren();
    var rows = gallery.entries.filter(function (entry) {
      return Boolean(sync.getRole()) &&
        (entry.hidden || !stories.some(function (story) { return story.event.folder === entry.folder; }));
    });
    hiddenEntries.hidden = !rows.length;
    if (!rows.length) return;
    var heading = document.createElement('p');
    heading.textContent = '已移出或待补照片的回忆';
    hiddenEntries.appendChild(heading);
    rows.forEach(function (entry) {
      var item = document.createElement('div');
      item.className = 'gallery-hidden-item';

      var info = document.createElement('span');
      info.className = 'gallery-hidden-info';
      var stateText = entry.hidden ? '已移出' : '待补照片';
      info.textContent = (entry.memory_date || entry.folder) + ' · ' + entry.title + ' (' + stateText + ')';
      info.title = info.textContent;
      item.appendChild(info);

      var actions = document.createElement('div');
      actions.className = 'gallery-hidden-actions';

      if (entry.hidden) {
        actions.appendChild(makeRestoreButton(
          '恢复',
          function () {
            return sync.saveGalleryEntry({
              folder: entry.folder,
              title: entry.title,
              body: entry.body,
              hidden: false,
              author: entry.author,
              memory_date: entry.memory_date
            });
          }
        ));
      } else {
        var button = document.createElement('button');
        button.className = 'gallery-restore';
        button.type = 'button';
        button.textContent = '补传照片';
        button.addEventListener('click', function () {
          openEditor({ event: { folder: entry.folder, title: entry.title, text: entry.body, author: entry.author, memoryDate: entry.memory_date }, photos: [] });
        });
        actions.appendChild(button);
      }

      var purgeButton = document.createElement('button');
      purgeButton.className = 'gallery-purge';
      purgeButton.type = 'button';
      purgeButton.textContent = '彻底删除';
      purgeButton.addEventListener('click', async function () {
        if (busy) return;
        if (!confirm('确定彻底删除回忆【' + entry.title + '】吗？\n所有照片和文字将被永久删除，不可恢复。')) return;
        busy = true;
        purgeButton.disabled = true;
        status.textContent = '正在彻底删除…';
        try {
          await sync.purgeGalleryMemory(entry.folder);
          gallery.entries = gallery.entries.filter(function (e) { return e.folder !== entry.folder; });
          gallery.photos = gallery.photos.filter(function (p) { return p.folder !== entry.folder; });
          showHiddenEntries();
          status.textContent = '已彻底删除回忆【' + entry.title + '】';
          busy = false;
        } catch (error) {
          fail(error);
          purgeButton.disabled = false;
          busy = false;
        }
      });
      actions.appendChild(purgeButton);

      item.appendChild(actions);
      hiddenEntries.appendChild(item);
    });
  }
  function openEditor(story) {
    if (!sync.getRole()) { sync.openAuth(); return; }
    if (story && !canEditStory(story)) return;
    editingStory = story || null;
    form.reset();
    clearQueuedPhotos();
    status.textContent = '';
    var isEditingActive = Boolean(story && story === activeStory);
    removeMemoryButton.hidden = !isEditingActive;
    removeMemoryButton.disabled = false;
    if (purgeMemoryButton) {
      purgeMemoryButton.hidden = !isEditingActive;
      purgeMemoryButton.disabled = false;
    }
    if (dangerGroup) {
      dangerGroup.hidden = !isEditingActive;
    }
    title.textContent = story ? '编辑回忆' : '添加回忆';
    dateInput.disabled = false;
    dateInput.value = story ? story.event.memoryDate || dateFromFolder(story.event.folder) : new Date().toLocaleDateString('sv-SE');
    nameInput.value = story ? story.event.title : '';
    bodyInput.closest('label').hidden = false;
    originalPerspectiveBody = isEditingActive ? window.storyMemoryPerspective.getBody(sync.getRole()) :
      story && story.event.author === sync.getRole() ? story.event.text || '' : '';
    bodyInput.value = isEditingActive ? window.storyMemoryPerspective.getDraft(sync.getRole()) : originalPerspectiveBody;
    fileHint.textContent = story
      ? '可一次选择多张，系统将自动进行视觉无损瘦身压缩；支持 JPG、PNG、WebP，单张最大 50 MB。'
      : '新回忆至少添加一张照片。系统将自动进行视觉无损瘦身压缩；支持 JPG、PNG、WebP，单张最大 50 MB。';
    hiddenEntries.hidden = Boolean(story);
    hiddenPhotos.hidden = !story;
    if (story) showHiddenPhotos(story.event.folder);
    else showHiddenEntries();
    if (!dialog.open) dialog.showModal();
    nameInput.focus();
  }

  addButton.hidden = false;
  addButton.addEventListener('click', function () { openEditor(null); });
  closeButton.addEventListener('click', function () { if (!busy) dialog.close(); });
  dialog.addEventListener('cancel', function (event) { if (busy) event.preventDefault(); });
  dialog.addEventListener('click', function (event) { if (event.target === dialog && !busy) dialog.close(); });
  dialog.addEventListener('close', clearQueuedPhotos);
  sync.onAuthChange(updateButtons);

  filesInput.addEventListener('change', function () {
    if (busy) return;
    Array.from(filesInput.files).forEach(function (file) {
      var supported = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
      queuedPhotos.push({
        file: file,
        url: supported ? URL.createObjectURL(file) : '',
        reason: !supported ? '格式不支持' : file.size > 52428800 ? '超过 50 MB' : ''
      });
    });
    filesInput.value = '';
    renderQueuedPhotos();
  });

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (busy || !sync.getRole() || (editingStory && !canEditStory(editingStory))) return;
    if (queuedPhotos.some(function (item) { return item.reason; })) {
      status.textContent = '请先移除标红的照片，再保存。';
      return;
    }
    var files = queuedPhotos.map(function (item) { return item.file; });
    if (!editingStory && !files.length) { status.textContent = '请先选择至少一张照片。'; return; }
    var folder = editingStory ? editingStory.event.folder : folderFromDate(dateInput.value);
    if (!editingStory && gallery.entries.some(function (entry) { return entry.folder === folder; })) {
      status.textContent = '这一天已有回忆。请打开对应回忆编辑，或先恢复已移出的回忆。';
      return;
    }
    var entry = { folder: folder, memory_date: dateInput.value, title: nameInput.value.trim(), body: editingStory ? editingStory.event.text : bodyInput.value.trim(), hidden: false,
      author: editingStory ? (editingStory.event.author || '大大布') : sync.getRole() };
    if (!entry.title) { status.textContent = '请填写标题。'; return; }
    busy = true;
    submitButton.disabled = true;
    closeButton.disabled = true;
    filesInput.disabled = true;
    var uploaded = 0;
    try {
      status.textContent = '正在保存回忆…';
      if (editingStory && bodyInput.value.trim() !== originalPerspectiveBody) {
        await sync.save(folder, bodyInput.value.trim());
      }
      if (!editingStory || files.length || entry.title !== editingStory.event.title ||
          entry.memory_date !== (editingStory.event.memoryDate || dateFromFolder(folder))) {
        await sync.saveGalleryEntry(entry);
      }
      for (var i = 0; i < files.length; i++) {
        status.textContent = '正在上传第 ' + (i + 1) + ' / ' + files.length + ' 张照片…';
        await sync.uploadGalleryPhoto(folder, files[i]);
        var uploadedItem = queuedPhotos.find(function (item) { return item.file === files[i]; });
        if (uploadedItem) {
          queuedPhotos.splice(queuedPhotos.indexOf(uploadedItem), 1);
          if (uploadedItem.url) URL.revokeObjectURL(uploadedItem.url);
          renderQueuedPhotos();
        }
        uploaded++;
      }
      location.reload();
    } catch (error) {
      if (!editingStory && uploaded === 0) {
        try { await sync.deleteGalleryEntry(folder); } catch (cleanupError) {}
      }
      fail(error);
      if (uploaded) status.textContent += '；已有 ' + uploaded + ' 张上传成功，请刷新页面查看。';
      busy = false;
      submitButton.disabled = false;
      closeButton.disabled = false;
      filesInput.disabled = false;
    }
  });

  removePhotoButton.addEventListener('click', async function () {
    if (!canEditStory(activeStory) || !activePhoto || busy) return;
    var story = activeStory;
    var photo = activePhoto;
    if (story.photos.length === 1) { alert('这是最后一张照片。请先添加新照片，或移除整段回忆。'); return; }
    if (!confirm('确定移除这张照片？')) return;
    busy = true;
    removePhotoButton.disabled = true;
    try {
      if (photo.staticSrc) await sync.setStaticGalleryPhotoHidden(story.event.folder, photo.staticSrc, true);
      else await sync.deleteGalleryPhoto({ id: photo.uploadId, storage_path: photo.storagePath });
      location.reload();
    } catch (error) {
      alert('照片移除失败：' + (error.message || String(error)));
      busy = false;
      removePhotoButton.disabled = false;
    }
  });

  removeMemoryButton.addEventListener('click', async function () {
    if (!canEditStory(activeStory) || busy) return;
    if (!confirm('确定将整段回忆移出展示？之后可以从“添加回忆”里恢复。')) return;
    busy = true;
    removeMemoryButton.disabled = true;
    try {
      await sync.saveGalleryEntry({
        folder: activeStory.event.folder,
        title: activeStory.event.title,
        body: activeStory.event.text,
        author: activeStory.event.author || '大大布',
        hidden: true
      });
      location.reload();
    } catch (error) {
      alert('回忆移除失败：' + (error.message || String(error)));
      busy = false;
      removeMemoryButton.disabled = false;
    }
  });

  if (purgeMemoryButton) {
    purgeMemoryButton.addEventListener('click', async function () {
      if (!canEditStory(activeStory) || busy) return;
      var story = activeStory;
      if (!confirm('确定彻底删除回忆【' + story.event.title + '】吗？\n该回忆包含的所有照片和文字都将被永久删除，不可恢复。')) return;
      busy = true;
      purgeMemoryButton.disabled = true;
      removeMemoryButton.disabled = true;
      status.textContent = '正在彻底删除回忆…';
      try {
        await sync.purgeGalleryMemory(story.event.folder);
        location.reload();
      } catch (error) {
        alert('彻底删除失败：' + (error.message || String(error)));
        busy = false;
        purgeMemoryButton.disabled = false;
        removeMemoryButton.disabled = false;
        status.textContent = '';
      }
    });
  }

  window.storyGalleryEditor = {
    editStory: function () { openEditor(activeStory); },
    openStory: function (story) { activeStory = story; activePhoto = story.photos[0]; updateButtons(); },
    showPhoto: function (photo) { activePhoto = photo; updateButtons(); }
  };
};
