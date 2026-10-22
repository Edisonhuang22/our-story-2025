/* 彩蛋页的收尾小动效。
   原来内联在 </body> 前，抽出来是为了让 CSP 能禁用内联脚本（script-src 'self'）。
   它依赖前面的 sync.js / mailbox.js 已经执行完，所以引用位置必须留在最后。 */
(function () {
  'use strict';

  document.body.classList.add('loaded');

  /* 点一下鸡蛋孵小鸡 */
  var egg = document.getElementById('egg-big');
  if (egg) {
    var flipped = false;
    egg.addEventListener('click', function () {
      flipped = !flipped;
      egg.textContent = flipped ? '🐣' : '🥚';
    });
  }

  /* 爱心粒子 */
  var layer = document.getElementById('hearts');
  if (layer) {
    for (var i = 0; i < 10; i++) {
      var h = document.createElement('span');
      h.className = 'heart';
      h.textContent = '♥';
      h.style.left = (Math.random() * 100) + '%';
      h.style.fontSize = (8 + Math.random() * 10) + 'px';
      h.style.animationDuration = (11 + Math.random() * 12) + 's';
      h.style.animationDelay = (-Math.random() * 20) + 's';
      layer.appendChild(h);
    }
  }
})();