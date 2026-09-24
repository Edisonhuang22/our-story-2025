'use strict';

window.initGalleryEditor = function (stories, gallery, baseFolders) {
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
  var status = document.getElementById('gallery-editor-status');
  var submitButton = document.getElementById('gallery-editor-submit');
  var closeButton = document.getElementById('gallery-editor-close');
  var hiddenPhotos = document.getElementById('gallery-hidden-photos');
  var hiddenEntries = document.getElementById('gallery-hidden-entries');
  var manageActions = document.getElementById('gallery-manage-actions');
  var editButton = document.getElementById('detail-edit-memory');
  var removePhotoButton = document.getElementById('detail-remove-photo');
  var removeMemoryButton = document.getElementById('detail-delete-memory');
  var activeStory = null;
  var activePhoto = null;
  var editingStory = null;
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
  function updateButtons() {
    var signedIn = Boolean(sync.getRole());
    manageActions.hidden = !signedIn || !activeStory;
    removePhotoButton.hidden = !signedIn || !activePhoto;
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
      return entry.hidden || !stories.some(function (story) { return story.event.folder === entry.folder; });
    });
    hiddenEntries.hidden = !rows.length;
    if (!rows.length) return;
    var heading = document.createElement('p');
    heading.textContent = '已移出或待补照片的回忆';
    hiddenEntries.appendChild(heading);
    rows.forEach(function (entry) {
      if (entry.hidden) {
        hiddenEntries.appendChild(makeRestoreButton(
          '恢复 ' + entry.folder + ' · ' + entry.title,
          function () { return sync.saveGalleryEntry({ folder: entry.folder, title: entry.title, body: entry.body, hidden: false }); }
        ));
      } else {
        var button = document.createElement('button');
        button.className = 'gallery-restore';
        button.type = 'button';
        button.textContent = '继续添加照片 ' + entry.folder + ' · ' + entry.title;
        button.addEventListener('click', function () {
          openEditor({ event: { folder: entry.folder, title: entry.title, text: entry.body }, photos: [] });
        });
        hiddenEntries.appendChild(button);
      }
    });
  }
  function openEditor(story) {
    if (!sync.getRole()) { sync.openAuth(); return; }
    editingStory = story || null;
    form.reset();
    status.textContent = '';
    title.textContent = story ? '编辑回忆' : '添加回忆';
    dateInput.disabled = Boolean(story);
    dateInput.value = story ? dateFromFolder(story.event.folder) : new Date().toLocaleDateString('sv-SE');
    nameInput.value = story ? story.event.title : '';
    bodyInput.value = story ? story.event.text : '';
    fileHint.textContent = story
      ? '可以添加照片，也可以只修改文字。支持 JPG、PNG、WebP，每张不超过 10 MB。'
      : '新回忆至少添加一张照片。支持 JPG、PNG、WebP，每张不超过 10 MB。';
    hiddenEntries.hidden = Boolean(story);
    hiddenPhotos.hidden = !story;
    if (story) showHiddenPhotos(story.event.folder);
    else showHiddenEntries();
    if (!dialog.open) dialog.showModal();
    nameInput.focus();
  }

  addButton.hidden = false;
  addButton.addEventListener('click', function () { openEditor(null); });
  editButton.addEventListener('click', function () { openEditor(activeStory); });
  closeButton.addEventListener('click', function () { if (!busy) dialog.close(); });
  dialog.addEventListener('cancel', function (event) { if (busy) event.preventDefault(); });
  dialog.addEventListener('click', function (event) { if (event.target === dialog && !busy) dialog.close(); });
  sync.onAuthChange(updateButtons);

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (busy || !sync.getRole()) return;
    var files = Array.from(filesInput.files);
    if (!editingStory && !files.length) { status.textContent = '请先选择至少一张照片。'; return; }
    if (files.some(function (file) { return !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10485760; })) {
      status.textContent = '只能上传 JPG、PNG、WebP，且每张不超过 10 MB。';
      return;
    }
    var folder = editingStory ? editingStory.event.folder : folderFromDate(dateInput.value);
    if (!editingStory && (baseFolders.has(folder) || gallery.entries.some(function (entry) { return entry.folder === folder; }))) {
      status.textContent = '这一天已有回忆。请打开对应回忆编辑，或先恢复已移出的回忆。';
      return;
    }
    var entry = { folder: folder, title: nameInput.value.trim(), body: bodyInput.value.trim(), hidden: false };
    if (!entry.title) { status.textContent = '请填写标题。'; return; }
    busy = true;
    submitButton.disabled = true;
    closeButton.disabled = true;
    var uploaded = 0;
    try {
      status.textContent = '正在保存回忆…';
      await sync.saveGalleryEntry(entry);
      for (var i = 0; i < files.length; i++) {
        status.textContent = '正在上传第 ' + (i + 1) + ' / ' + files.length + ' 张照片…';
        await sync.uploadGalleryPhoto(folder, files[i]);
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
    }
  });

  removePhotoButton.addEventListener('click', async function () {
    if (!activeStory || !activePhoto || busy || !sync.getRole()) return;
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
    if (!activeStory || busy || !sync.getRole()) return;
    if (!confirm('确定将整段回忆移出展示？之后可以从“添加回忆”里恢复。')) return;
    busy = true;
    removeMemoryButton.disabled = true;
    try {
      await sync.saveGalleryEntry({
        folder: activeStory.event.folder,
        title: activeStory.event.title,
        body: activeStory.event.text,
        hidden: true
      });
      location.reload();
    } catch (error) {
      alert('回忆移除失败：' + (error.message || String(error)));
      busy = false;
      removeMemoryButton.disabled = false;
    }
  });

  window.storyGalleryEditor = {
    openStory: function (story) { activeStory = story; activePhoto = story.photos[0]; updateButtons(); },
    showPhoto: function (photo) { activePhoto = photo; updateButtons(); }
  };
};
