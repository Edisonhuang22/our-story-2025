'use strict';

(function initStorySync() {
  var allowed = {
    '484784621@qq.com': '大大布',
    '1014779580@qq.com': '小小二'
  };
  var client = window.supabase.createClient(
    'https://ewqxttklaaqxybldaklc.supabase.co',
    'sb_publishable_HzCozccJE_h16H9Mhepibw_yC1Q6TIY'
  );
  var currentUser = null;
  var currentRole = null;
  var listeners = [];
  var perspectiveChannel = null;
  var mailboxChannel = null;
  var ready = client.auth.getSession().then(function (result) { setUser(result.data.session && result.data.session.user); });
  var button = document.createElement('button');
  var dialog = document.createElement('dialog');

  button.className = 'sync-account';
  button.type = 'button';
  document.body.appendChild(button);
  dialog.className = 'sync-dialog';
  dialog.innerHTML = '<button class="sync-close" type="button" aria-label="关闭登录窗口">×</button>' +
    '<p class="gallery-kicker">OUR SHARED SPACE</p><h2>登录后同步回忆和信箱</h2>' +
    '<p class="sync-intro">只有大大布和小小二的指定邮箱可以编辑。</p>' +
    '<form id="sync-auth-form"><label>邮箱<input id="sync-email" type="email" autocomplete="email" required></label>' +
    '<label>密码<input id="sync-password" type="password" autocomplete="current-password" minlength="8" required></label>' +
    '<div class="sync-actions"><button class="small-btn" type="submit">登录</button><button class="sync-link" id="sync-signup" type="button">第一次使用，注册</button></div>' +
    '<p id="sync-status" role="status"></p></form>';
  document.body.appendChild(dialog);
  var form = dialog.querySelector('#sync-auth-form');
  var email = dialog.querySelector('#sync-email');
  var password = dialog.querySelector('#sync-password');
  var status = dialog.querySelector('#sync-status');

  function notify() {
    listeners.forEach(function (listener) { listener(currentUser, currentRole); });
    window.dispatchEvent(new CustomEvent('story-auth-change', { detail: { user: currentUser, role: currentRole } }));
  }
  function updateButton() {
    if (currentRole) {
      button.textContent = currentRole + ' · 已登录';
      button.classList.add('is-signed-in');
      button.title = '点击退出登录';
    } else {
      button.textContent = '登录以同步回忆和信箱';
      button.classList.remove('is-signed-in');
      button.title = '登录或注册';
    }
  }
  function setUser(user) {
    currentUser = user || null;
    currentRole = user && allowed[(user.email || '').toLowerCase()] || null;
    document.body.classList.toggle('is-logged-in', Boolean(currentRole));
    document.documentElement.classList.toggle('is-logged-in', Boolean(currentRole));
    updateButton();
    notify();
  }
  function openAuth() {
    if (currentRole) {
      client.auth.signOut();
      return;
    }
    status.textContent = '';
    dialog.showModal();
    email.focus();
  }
  button.addEventListener('click', openAuth);
  dialog.querySelector('.sync-close').addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('click', function (event) { if (event.target === dialog) dialog.close(); });

  async function authenticate(isSignUp) {
    var address = email.value.trim().toLowerCase();
    if (!allowed[address]) {
      status.textContent = '这个邮箱不在共同回忆的名单里。';
      return;
    }
    status.textContent = isSignUp ? '正在创建账号…' : '正在登录…';
    var result = isSignUp
      ? await client.auth.signUp({ email: address, password: password.value, options: { emailRedirectTo: location.origin + location.pathname } })
      : await client.auth.signInWithPassword({ email: address, password: password.value });
    if (result.error) { status.textContent = result.error.message; return; }
    if (isSignUp && !result.data.session) {
      status.textContent = '确认邮件已发出，请到邮箱点开链接后再回来登录。';
      return;
    }
    dialog.close();
  }
  form.addEventListener('submit', function (event) { event.preventDefault(); authenticate(false); });
  dialog.querySelector('#sync-signup').addEventListener('click', function () { authenticate(true); });

  async function load(folder) {
    if (!currentRole) return [];
    var result = await client.from('memory_perspectives').select('folder,author,body,updated_at').eq('folder', folder);
    if (result.error) throw result.error;
    return result.data || [];
  }
  async function save(folder, body) {
    if (!currentRole) throw new Error('请先登录');
    var result = await client.from('memory_perspectives').upsert(
      { folder: folder, author: currentRole, body: body },
      { onConflict: 'folder,author' }
    );
    if (result.error) throw result.error;
  }
  function onPerspectiveChange(callback) {
    if (perspectiveChannel) client.removeChannel(perspectiveChannel);
    perspectiveChannel = client.channel('memory-perspectives')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'memory_perspectives' }, callback)
      .subscribe();
  }

  // ---------- 签名 URL 智能持久化缓存（大幅消除每次打开网站的签名等待时间） ----------
  var signedUrls = new Map();
  var SIGNED_CACHE_KEY = 'story-signed-urls-cache-v2';

  function loadCachedSignedUrls() {
    try {
      var raw = sessionStorage.getItem(SIGNED_CACHE_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      var now = Date.now();
      if (parsed && typeof parsed === 'object') {
        Object.keys(parsed).forEach(function (path) {
          var item = parsed[path];
          // 只要签名剩余有效期大于 1 小时，就直接从缓存复用
          if (item && item.url && item.expiresAt > now + 3600000) {
            signedUrls.set(path, item.url);
          }
        });
      }
    } catch (e) {}
  }
  loadCachedSignedUrls();

  function saveCachedSignedUrls() {
    try {
      var record = {};
      var now = Date.now();
      signedUrls.forEach(function (url, path) {
        record[path] = { url: url, expiresAt: now + 20 * 3600 * 1000 };
      });
      sessionStorage.setItem(SIGNED_CACHE_KEY, JSON.stringify(record));
    } catch (e) {}
  }

  // ---------- 客户端高画质图片压缩工具（将 10MB 手机原图无损转为 ~150KB WebP，极速上传与加载） ----------
  function compressImage(file, maxDimension, quality) {
    return new Promise(function (resolve) {
      // 若浏览器不支持 Canvas，直接返回原图
      if (!window.createImageBitmap && !window.FileReader) {
        resolve(file);
        return;
      }
      var img = new Image();
      var objectUrl = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(objectUrl);
        var width = img.naturalWidth || img.width;
        var height = img.naturalHeight || img.height;
        var scale = Math.min(1, maxDimension / Math.max(width, height));
        var targetWidth = Math.max(1, Math.round(width * scale));
        var targetHeight = Math.max(1, Math.round(height * scale));

        var canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        var ctx = canvas.getContext('2d');
        if (!ctx) { resolve(file); return; }
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        canvas.toBlob(function (blob) {
          if (!blob) { resolve(file); return; }
          resolve(blob);
        }, 'image/webp', quality);
      };
      img.onerror = function () {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      };
      img.src = objectUrl;
    });
  }

  async function loadGallery() {
    await ready;
    if (!currentRole) return { entries: [], photos: [] };
    var columns = 'folder,title,hidden,author,memory_date,body';
    var photoColumns = 'id,folder,static_src,storage_path,thumb_path,hidden,created_at';
    var results = await Promise.all([
      client.from('story_gallery_entries').select(columns),
      client.from('story_gallery_photos').select(photoColumns).order('created_at', { ascending: true })
    ]);
    if (results[0].error) throw new Error('回忆记录 HTTP ' + results[0].status + '：' + results[0].error.message);
    if (results[1].error) throw new Error('照片记录 HTTP ' + results[1].status + '：' + results[1].error.message);
    var photos = results[1].data || [];
    
    // 收集所有需要签名的路径（原图与缩略图）
    var allPaths = [];
    photos.forEach(function (p) {
      if (p.storage_path) allPaths.push(p.storage_path);
      if (p.thumb_path) allPaths.push(p.thumb_path);
    });

    // 过滤出未缓存或已失效的路径，减少无意义的云端网络请求
    var missingPaths = allPaths.filter(function (path) { return path && !signedUrls.has(path); });
    if (missingPaths.length > 0) {
      try {
        var signed = await client.storage.from('story-gallery').createSignedUrls(missingPaths, 60 * 60 * 24);
        if (signed && signed.data) {
          signed.data.forEach(function (item) {
            if (item.signedUrl) signedUrls.set(item.path, item.signedUrl);
          });
          saveCachedSignedUrls();
        }
      } catch (signError) {
        console.warn('获取照片签名链接提示：', signError);
      }
    }
    return { entries: results[0].data || [], photos: photos };
  }

  function galleryPhotoUrl(path) {
    if (!path) return '';
    if (signedUrls.has(path)) return signedUrls.get(path);
    return client.storage.from('story-gallery').getPublicUrl(path).data.publicUrl;
  }

  async function saveGalleryEntry(entry) {
    if (!currentRole) throw new Error('请先登录');
    var result = await client.from('story_gallery_entries').upsert(entry, { onConflict: 'folder' });
    if (result.error) throw result.error;
  }

  async function deleteGalleryEntry(folder) {
    if (!currentRole) throw new Error('请先登录');
    var result = await client.from('story_gallery_entries').delete().eq('folder', folder);
    if (result.error) throw result.error;
  }

  async function uploadGalleryPhoto(folder, file) {
    if (!currentRole || !currentUser) throw new Error('请先登录');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw new Error('照片格式不符合要求，仅支持 JPG、PNG 或 WebP');
    }

    var photoId = crypto.randomUUID();
    var mainPath = currentUser.id + '/' + photoId + '.webp';
    var thumbPath = currentUser.id + '/' + photoId + '_thumb.webp';

    // 自动在客户端压缩生成高清大图 (最长边 1600px, 82% WebP, 约 150KB) 与 极速缩略图 (最长边 320px, 75% WebP, 约 15KB)
    var mainBlob = await compressImage(file, 1600, 0.82);
    var thumbBlob = await compressImage(file, 320, 0.75);

    var uploadMain = await client.storage.from('story-gallery').upload(mainPath, mainBlob, { contentType: 'image/webp', upsert: false });
    if (uploadMain.error) throw uploadMain.error;

    var uploadThumb = await client.storage.from('story-gallery').upload(thumbPath, thumbBlob, { contentType: 'image/webp', upsert: false });
    if (uploadThumb.error) {
      await client.storage.from('story-gallery').remove([mainPath]);
      throw uploadThumb.error;
    }

    // 预热两张签名的本地缓存
    try {
      var signRes = await client.storage.from('story-gallery').createSignedUrls([mainPath, thumbPath], 60 * 60 * 24);
      if (signRes && signRes.data) {
        signRes.data.forEach(function (item) {
          if (item.signedUrl) signedUrls.set(item.path, item.signedUrl);
        });
        saveCachedSignedUrls();
      }
    } catch (signError) {}

    var row = await client.from('story_gallery_photos').insert({
      folder: folder,
      storage_path: mainPath,
      thumb_path: thumbPath,
      hidden: false
    }).select('id,folder,storage_path,thumb_path').single();

    if (row.error) {
      await client.storage.from('story-gallery').remove([mainPath, thumbPath]);
      throw row.error;
    }
    return row.data;
  }

  // 专用于迁移已有 88 张 WebP 历史照片与缩略图的快速直传通道
  async function uploadGalleryPhotoLegacy(folder, mainBlob, thumbBlob, filenameStem) {
    if (!currentRole || !currentUser) throw new Error('请先登录');
    var stem = filenameStem || crypto.randomUUID();
    var slug = folder.replace(/\./g, '-');
    var mainPath = currentUser.id + '/legacy/' + slug + '/' + stem + '.webp';
    var thumbPath = currentUser.id + '/legacy/' + slug + '/' + stem + '_thumb.webp';

    var upMain = await client.storage.from('story-gallery').upload(mainPath, mainBlob, { contentType: 'image/webp', upsert: true });
    if (upMain.error) throw upMain.error;
    var upThumb = await client.storage.from('story-gallery').upload(thumbPath, thumbBlob, { contentType: 'image/webp', upsert: true });
    if (upThumb.error) throw upThumb.error;

    var row = await client.from('story_gallery_photos').insert({
      folder: folder,
      storage_path: mainPath,
      thumb_path: thumbPath,
      hidden: false
    }).select('id,folder,storage_path,thumb_path').maybeSingle();
    if (row.error && row.error.code !== '23505' && !String(row.error.message || '').includes('duplicate key')) {
      throw row.error;
    }
    return row.data || { folder: folder, storage_path: mainPath, thumb_path: thumbPath };
  }

  async function setStaticGalleryPhotoHidden(folder, src, hidden) {
    if (!currentRole) throw new Error('请先登录');
    var result = await client.from('story_gallery_photos').upsert(
      { folder: folder, static_src: src, hidden: hidden }, { onConflict: 'folder,static_src' }
    );
    if (result.error) throw result.error;
  }

  async function deleteGalleryPhoto(photo) {
    if (!currentRole) throw new Error('请先登录');
    var result = await client.from('story_gallery_photos').delete().eq('id', photo.id);
    if (result.error) throw result.error;
    var toRemove = [photo.storage_path, photo.thumb_path].filter(Boolean);
    if (toRemove.length > 0) {
      var removal = await client.storage.from('story-gallery').remove(toRemove);
      if (removal.error) throw removal.error;
    }
  }

  async function purgeGalleryMemory(folder) {
    if (!currentRole) throw new Error('请先登录');
    var photosResult = await client.from('story_gallery_photos').select('id,storage_path,thumb_path').eq('folder', folder);
    if (photosResult.error) throw photosResult.error;
    var storagePaths = [];
    (photosResult.data || []).forEach(function (p) {
      if (p.storage_path) storagePaths.push(p.storage_path);
      if (p.thumb_path) storagePaths.push(p.thumb_path);
    });
    if (storagePaths.length > 0) {
      try {
        var removal = await client.storage.from('story-gallery').remove(storagePaths);
        if (removal.error) console.warn('存储文件清理提示：', removal.error);
      } catch (storageError) {
        console.warn('存储文件清理异常：', storageError);
      }
    }
    var deletePhotos = await client.from('story_gallery_photos').delete().eq('folder', folder);
    if (deletePhotos.error) throw deletePhotos.error;
    try {
      await client.from('memory_perspectives').delete().eq('folder', folder);
    } catch (perspectiveError) {
      console.warn('视角文字清理提示：', perspectiveError);
    }
    try {
      await client.from('story_letters').update({ memory: null }).eq('memory', folder);
    } catch (letterError) {
      console.warn('信件关联解绑提示：', letterError);
    }
    var deleteEntry = await client.from('story_gallery_entries').delete().eq('folder', folder);
    if (deleteEntry.error) throw deleteEntry.error;
  }

  async function loadMailbox() {
    if (!currentRole) return { letters: [], photos: [] };
    var results = await Promise.all([
      client.from('story_letters').select('id,sender,date,title,body,memory,is_original,created_at,updated_at'),
      client.from('story_letter_photos').select('id,letter_id,name,storage_path,sort_order,author,created_at').order('sort_order', { ascending: true }).order('created_at', { ascending: true })
    ]);
    if (results[0].error) throw results[0].error;
    if (results[1].error) throw results[1].error;
    return { letters: results[0].data || [], photos: results[1].data || [] };
  }

  async function saveLetter(letter) {
    if (!currentRole || !currentUser) throw new Error('请先登录');
    var result = await client.from('story_letters').upsert({
      id: letter.id,
      sender: currentRole,
      author_id: currentUser.id,
      date: letter.date,
      title: letter.title,
      body: letter.body,
      memory: letter.memory || null
    }, { onConflict: 'id' }).select('id,sender,date,title,body,memory,created_at,updated_at').single();
    if (result.error) throw result.error;
    return result.data;
  }

  async function uploadLetterPhoto(letterId, file, name, sortOrder) {
    if (!currentRole || !currentUser) throw new Error('请先登录');
    var id = crypto.randomUUID();
    var path = currentUser.id + '/' + letterId + '/' + id + '.webp';
    // 压缩实体信件照片（保持超清文字可读，同时体积从 10MB 骤降至 ~200KB）
    var compressedBlob = await compressImage(file, 1600, 0.85);

    var upload = await client.storage.from('story-letter-photos').upload(path, compressedBlob, {
      contentType: 'image/webp',
      upsert: false
    });
    if (upload.error) throw upload.error;
    var result = await client.from('story_letter_photos').insert({
      id: id,
      letter_id: letterId,
      name: name,
      storage_path: path,
      sort_order: sortOrder,
      author: currentRole
    }).select('id,letter_id,name,storage_path,sort_order,author,created_at').single();
    if (result.error) {
      await client.storage.from('story-letter-photos').remove([path]);
      throw result.error;
    }
    return result.data;
  }

  async function removeLetterPhoto(photo) {
    if (!currentRole) throw new Error('请先登录');
    var result = await client.from('story_letter_photos').delete().eq('id', photo.id);
    if (result.error) throw result.error;
    var removal = await client.storage.from('story-letter-photos').remove([photo.storage_path]);
    if (removal.error) throw removal.error;
  }

  async function downloadLetterPhoto(path) {
    if (!currentRole) throw new Error('请先登录');
    var result = await client.storage.from('story-letter-photos').download(path);
    if (result.error) throw result.error;
    return result.data;
  }

  async function deleteLetter(letterId) {
    if (!currentRole) throw new Error('请先登录');
    var photosResult = await client.from('story_letter_photos').select('id,storage_path').eq('letter_id', letterId);
    if (photosResult.error) throw photosResult.error;
    var storagePaths = (photosResult.data || []).map(function (p) { return p.storage_path; }).filter(Boolean);
    if (storagePaths.length > 0) {
      try {
        var removal = await client.storage.from('story-letter-photos').remove(storagePaths);
        if (removal.error) console.warn('信件照片存储清理提示：', removal.error);
      } catch (storageError) {
        console.warn('信件照片存储清理异常：', storageError);
      }
    }
    var result = await client.from('story_letters').delete().eq('id', letterId);
    if (result.error) throw result.error;
    return true;
  }

  function onMailboxChange(callback) {
    if (mailboxChannel) client.removeChannel(mailboxChannel);
    mailboxChannel = client.channel('story-mailbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'story_letters' }, callback)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'story_letter_photos' }, callback)
      .subscribe();
  }

  client.auth.onAuthStateChange(function (_event, session) { setUser(session && session.user); });

  window.storySync = {
    getRole: function () { return currentRole; },
    getUserId: function () { return currentUser && currentUser.id; },
    openAuth: openAuth,
    load: load,
    save: save,
    onPerspectiveChange: onPerspectiveChange,
    loadGallery: loadGallery,
    galleryPhotoUrl: galleryPhotoUrl,
    saveGalleryEntry: saveGalleryEntry,
    deleteGalleryEntry: deleteGalleryEntry,
    uploadGalleryPhoto: uploadGalleryPhoto,
    uploadGalleryPhotoLegacy: uploadGalleryPhotoLegacy,
    setStaticGalleryPhotoHidden: setStaticGalleryPhotoHidden,
    deleteGalleryPhoto: deleteGalleryPhoto,
    purgeGalleryMemory: purgeGalleryMemory,
    loadMailbox: loadMailbox,
    saveLetter: saveLetter,
    deleteLetter: deleteLetter,
    uploadLetterPhoto: uploadLetterPhoto,
    removeLetterPhoto: removeLetterPhoto,
    downloadLetterPhoto: downloadLetterPhoto,
    compressImage: compressImage,
    onMailboxChange: onMailboxChange,
    onAuthChange: function (listener) { listeners.push(listener); listener(currentUser, currentRole); }
  };
})();
