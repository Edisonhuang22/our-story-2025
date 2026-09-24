'use strict';

(function initStorySync() {
  var allowed = {
    '484784621@qq.com': '大大怪',
    '1014779580@qq.com': '小小怪'
  };
  var client = window.supabase.createClient(
    'https://ewqxttklaaqxybldaklc.supabase.co',
    'sb_publishable_HzCozccJE_h16H9Mhepibw_yC1Q6TIY'
  );
  var currentUser = null;
  var currentRole = null;
  var listeners = [];
  var channel = null;
  var button = document.createElement('button');
  var dialog = document.createElement('dialog');

  button.className = 'sync-account';
  button.type = 'button';
  document.body.appendChild(button);
  dialog.className = 'sync-dialog';
  dialog.innerHTML = '<button class="sync-close" type="button" aria-label="关闭登录窗口">×</button>' +
    '<p class="gallery-kicker">OUR SHARED SPACE</p><h2>登录后同步回忆</h2>' +
    '<p class="sync-intro">只有大大怪和小小怪的指定邮箱可以编辑。</p>' +
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
      button.textContent = '登录以同步回忆';
      button.classList.remove('is-signed-in');
      button.title = '登录或注册';
    }
  }
  function setUser(user) {
    currentUser = user || null;
    currentRole = user && allowed[(user.email || '').toLowerCase()] || null;
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
    if (channel) client.removeChannel(channel);
    channel = client.channel('memory-perspectives')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'memory_perspectives' }, callback)
      .subscribe();
  }
  client.auth.onAuthStateChange(function (_event, session) { setUser(session && session.user); });
  client.auth.getSession().then(function (result) { setUser(result.data.session && result.data.session.user); });

  window.storySync = {
    getRole: function () { return currentRole; },
    openAuth: openAuth,
    load: load,
    save: save,
    onPerspectiveChange: onPerspectiveChange,
    onAuthChange: function (listener) { listeners.push(listener); }
  };
})();
