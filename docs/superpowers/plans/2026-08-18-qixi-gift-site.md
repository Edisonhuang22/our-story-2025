# 七夕纪念相册网站 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个纯静态纪念相册网站：密码页 + 29 章"左侧 iOS 叠放照片 / 右侧文字"，部署到 GitHub Pages。

**Architecture:** 无构建步骤的静态站点。照片管线脚本（Python）把 `photos/` 里的 HEIC/JPG/PNG 统一压缩为 JPEG 并生成清单；`app.js` 读取 `events.json`（章节文案）与 `photos.json`（照片清单）渲染全部章节，叠放交互纯手写。部署用 GitHub Actions 把 `site/` 发布到 Pages。

**Tech Stack:** HTML/CSS/原生 JS（无依赖）；Pillow + heif-convert（照片处理）；GitHub Actions `actions/deploy-pages`（部署）。验证方式：本地静态服务器 + 应用内浏览器 DOM 断言（本项目为视觉交互型前端，无单元测试框架，以浏览器验证代替 TDD 断言）。

**工作区:** `C:\Users\48478\Documents\Codex\2026-08-17\superpowers-plugin-superpowers-openai-curated-i`（下文简称 `<ws>`）

---

### Task 1: 项目脚手架与 git 初始化

**Files:**
- Create: `<ws>/.gitignore`
- Create: `<ws>/site/index.html`（占位，Task 4 重写）
- Create: `<ws>/site/css/style.css`（占位，Task 5 重写）
- Create: `<ws>/site/js/app.js`（占位，Task 6 重写）
- Create: `<ws>/site/data/`（空目录，放 JSON）

- [ ] **Step 1: 写 .gitignore**

```gitignore
.superpowers/
work/
photos/
outputs/
```

- [ ] **Step 2: 初始化仓库并建目录**

```powershell
cd <ws>
git init -b main
New-Item -ItemType Directory -Force -Path site\css, site\js, site\data | Out-Null
```

- [ ] **Step 3: 提交**

```powershell
git add .gitignore docs
git commit -m "docs: spec, plan and gitignore"
```

### Task 2: 照片处理管线

**Files:**
- Create: `<ws>/tools/process_photos.py`

- [ ] **Step 1: 写入完整脚本**

```python
import json
import re
import subprocess
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(r"C:\Users\48478\Documents\Codex\2026-08-17\superpowers-plugin-superpowers-openai-curated-i")
PHOTOS_DIR = ROOT / "photos"
OUT_IMG = ROOT / "site" / "img"
OUT_JSON = ROOT / "site" / "data" / "photos.json"
HEIF_CONVERT = r"C:\Users\48478\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\libheif\libheif\bin\heif-convert.exe"
PYTHON = r"C:\Users\48478\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
TMP_DIR = ROOT / "work" / "heic-tmp"
MAX_EDGE = 1400
QUALITY = 82
SUPPORTED = {".jpg", ".jpeg", ".png", ".heic"}


def natural_key(name: str):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", name)]


def parse_date(folder: str):
    m = re.match(r"(\d{4})\.(\d{1,2})\.(\d{1,2})$", folder.strip())
    if not m:
        raise ValueError(f"无法解析日期目录名: {folder}")
    return tuple(int(x) for x in m.groups())


def main():
    OUT_IMG.mkdir(parents=True, exist_ok=True)
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    chapters = []
    folders = [p for p in PHOTOS_DIR.iterdir() if p.is_dir()]
    folders.sort(key=lambda p: parse_date(p.name))
    for folder in folders:
        files = [f for f in folder.iterdir() if f.is_file() and f.suffix.lower() in SUPPORTED]
        if not files:
            print(f"[跳过空目录] {folder.name}")
            continue
        files.sort(key=lambda f: natural_key(f.name))
        slug = folder.name.replace(".", "-")
        out_dir = OUT_IMG / slug
        out_dir.mkdir(parents=True, exist_ok=True)
        photos = []
        for idx, f in enumerate(files, start=1):
            src = f
            tmp = None
            if f.suffix.lower() == ".heic":
                tmp = TMP_DIR / (f.stem + ".jpg")
                subprocess.run([HEIF_CONVERT, str(f), str(tmp)], check=True, capture_output=True)
                src = tmp
            with Image.open(src) as im:
                im = ImageOps.exif_transpose(im)
                if im.mode in ("RGBA", "P", "LA"):
                    rgba = im.convert("RGBA")
                    bg = Image.new("RGB", rgba.size, (255, 255, 255))
                    bg.paste(rgba, mask=rgba.split()[-1])
                    im = bg
                else:
                    im = im.convert("RGB")
                im.thumbnail((MAX_EDGE, MAX_EDGE), Image.Resampling.LANCZOS)
                out_path = out_dir / f"{idx}.jpg"
                im.save(out_path, "JPEG", quality=QUALITY, progressive=True, optimize=True)
                w, h = im.size
                photos.append({"src": f"img/{slug}/{idx}.jpg", "w": w, "h": h})
        chapters.append({"folder": folder.name, "photos": photos})
        print(f"[完成] {folder.name}: {len(photos)} 张")
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps({"chapters": chapters}, ensure_ascii=False, indent=2), encoding="utf-8")
    total = sum(len(c["photos"]) for c in chapters)
    print(f"[完成] 共 {total} 张，写入 {OUT_JSON}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 运行脚本**

```powershell
& "C:\Users\48478\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" <ws>\tools\process_photos.py
```

Expected: 输出 29 个 `[完成]`，最终 `共 88 张`。

- [ ] **Step 3: 抽查产物**

```powershell
$img = Get-ChildItem <ws>\site\img -Recurse -File
"图片数: $($img.Count)"
"总量(MB): $([math]::Round(($img | Measure-Object Length -Sum).Sum / 1MB, 1))"
Get-Content <ws>\site\data\photos.json -TotalCount 8
```

Expected: 88 张；总量 < 25MB；photos.json 首章为 `2025.11.19` 且含 `src/img/2025-11-19/1.jpg`。

- [ ] **Step 4: 提交**

```powershell
git add tools site/img site/data/photos.json
git commit -m "build: photo pipeline and compressed images"
```

### Task 3: 章节文案数据

**Files:**
- Create: `<ws>/site/data/events.json`

- [ ] **Step 1: 写入完整 JSON（29 条，与照片目录一一对应）**

```json
[
  {"folder": "2025.11.19", "date": "2025年11月19日", "title": "第一张照片", "text": "第一次在生科馆看见你们，当时童昊指着你俩不知道说了什么，我觉得很好笑就拍了一张照片哈哈哈。"},
  {"folder": "2025.12.1", "date": "2025年12月1日", "title": "遇见", "text": "中午吃饭的时候遇见了哦。"},
  {"folder": "2025.12.4", "date": "2025年12月4日", "title": "打扫卫生", "text": "办公室打扫卫生。那天下午还是体育课，把你们唬过来哈哈哈。那天好累，但好高兴哦。"},
  {"folder": "2025.12.6", "date": "2025年12月6日", "title": "小费生日", "text": "吃饭、玩剧本杀、爬雷火塔、清晨下山，发生好多事。还闹了点小矛盾，故意不理对方，等到了白天也是冷冷的。"},
  {"folder": "2025.12.12", "date": "2025年12月12日", "title": "办公室搞怪", "text": "在办公室搞怪，莫权篡位！！！"},
  {"folder": "2025.12.13", "date": "2025年12月13日", "title": "去看电影", "text": "去看电影了。当时远远地拍了一张照片，居然被发现了。"},
  {"folder": "2025.12.16", "date": "2025年12月16日", "title": "复习夜", "text": "期末考复习路上遇见，傍晚叫你来办公室复习，可以多跟我们熟络熟络，也可以一起读书嘿嘿。晚上拍了一张神照，还有小摊的偷拍哈哈哈哈哈。"},
  {"folder": "2025.12.21", "date": "2025年12月21日", "title": "办公室的冬至", "text": "在办公室的冬至哦。两个人扭扭捏捏，一个不好意思主动说吃醋，一个不好意思主动说要一起玩。"},
  {"folder": "2025.12.22", "date": "2025年12月22日", "title": "我拍的照片", "text": "又是我拍的照片！好看吧！"},
  {"folder": "2025.12.24", "date": "2025年12月24日", "title": "校门外散步", "text": "校门外散步。当时谭东红老是催促快回去吃面了哈哈哈哈。"},
  {"folder": "2025.12.25", "date": "2025年12月25日", "title": "第一次过夜", "text": "第一次在办公室过夜，有点紧张，但是打着视频好开心哦，当时还会担心被你室友看见。"},
  {"folder": "2025.12.28", "date": "2025年12月28日", "title": "实验室合照", "text": "在实验室拍合照和两人证件照，回宿舍路上又拍了几张我觉得好看的背影照片。好快啊，实验室现在也不开了。"},
  {"folder": "2025.12.30", "date": "2025年12月30日", "title": "每晚散步", "text": "又去校门外散步了。那阵子期末考，天天晚上散步都当作每天的必备项目嘿嘿。白天各自忙碌，晚上一起出校门散散步，很放松很放松。"},
  {"folder": "2025.12.31", "date": "2025年12月31日", "title": "跨年", "text": "你给我拍一张自拍，然后我们就去跨年了：买了烟花，拍了合照，唱了歌，啥好玩就干啥。那天拿烟花时淋成落汤鸡了我去，还好没感冒。也有点小不愉快，但大早上收到小学妹第一次写的小作文，不开心全都烟消云散了。"},
  {"folder": "2026.1.6", "date": "2026年1月6日", "title": "散散步", "text": "我们终于要考完试啦，一起去散散步放松。"},
  {"folder": "2026.1.7", "date": "2026年1月7日", "title": "聚餐过敏", "text": "考完试啦！本来想着今晚一起聚餐，没想到我直接过敏了！我去，让学长在寒风中等了一个小时，手机都没电啦。后来晚上陈玉荣吃了好多好多好多，好开心哈哈哈哈。"},
  {"folder": "2026.1.11", "date": "2026年1月11日", "title": "考完试", "text": "考完试了，我们在办公室睡觉、在办公室玩，好自在！出门后故意放慢脚步，在后面拍了好多照片；再去本校区拍了好多照片，两个人光顾着搞怪了。下午去看电影，我又偷拍一张照片。"},
  {"folder": "2026.1.12", "date": "2026年1月12日", "title": "武功山", "text": "出发武功山，路上好开心哦。到武功山脚下了，我的拍照技术果然更一流——我拍的陈玉荣明显比陈玉荣拍的我好看哈。开始爬山，遇见小猫咪，还喂了火腿肠，肥嘟嘟的小猫。到山顶后好冷呀，还好当时的急救毯起作用了！陈玉荣当时都要说不出话了，好担心你会出事，我去，你知不知道。"},
  {"folder": "2026.1.17", "date": "2026年1月17日", "title": "老照片", "text": "宝宝发的照片，以及我自己找的照片。我们的科协协会大合照喔。"},
  {"folder": "2026.1.25", "date": "2026年1月25日", "title": "打电话", "text": "打电话，伸舌头，装傻子来了哈哈哈哈哈哈。"},
  {"folder": "2026.3.3", "date": "2026年3月3日", "title": "又见面", "text": "我们又又又又见面啦。"},
  {"folder": "2026.3.4", "date": "2026年3月4日", "title": "配锁", "text": "去配锁的路上一直嘻嘻哈哈的。配锁师傅还说我们夫妻俩，暗爽哈哈哈哈。晚上回酒店，给宝宝提前过了个生日，我摆的好看吧？"},
  {"folder": "2026.3.21", "date": "2026年3月21日", "title": "漂亮的字", "text": "陈玉荣假装自己写了非常漂亮的字。"},
  {"folder": "2026.3.24", "date": "2026年3月24日", "title": "摆鬼脸", "text": "又是打电话的摆鬼脸环节。"},
  {"folder": "2026.4.3", "date": "2026年4月3日", "title": "小挂件", "text": "宝宝送的小挂件。"},
  {"folder": "2026.4.6", "date": "2026年4月6日", "title": "好嫩", "text": "这照片拍得我好嫩。"},
  {"folder": "2026.4.19", "date": "2026年4月19日", "title": "熊出没", "text": "我们去熊出没玩啦，好玩！那天的麻辣烫也好吃！还被学委看见了嘿嘿嘿，一天都很开心。"},
  {"folder": "2026.4.21", "date": "2026年4月21日", "title": "漂亮合照", "text": "拍了张非常漂亮的合照。"},
  {"folder": "2026.5.1", "date": "2026年5月1日", "title": "宝宝来新余", "text": "宝宝来新余了。但是当时居然没让你来医院！真该死啊黄书澎，真该死！那天吃的小龙虾、酒店楼下路边摊，看的奔跑吧，都好开心喔。最搞笑的是我在楼下非常想上厕所，憋不住了先回酒店了哈哈哈哈哈。"}
]
```

- [ ] **Step 2: 校验 JSON 合法**

```powershell
node -e "const d=require('<ws>/site/data/events.json');console.log('条数:',d.length)"
```

Expected: `条数: 29`

- [ ] **Step 3: 提交**

```powershell
git add site/data/events.json
git commit -m "content: 29 chapter texts"
```

### Task 4: 页面骨架与密码页

**Files:**
- Create: `<ws>/site/index.html`

- [ ] **Step 1: 写入完整 HTML**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>小小怪下士</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div id="gate" class="gate">
    <div class="gate-card">
      <div class="gate-icon">💌</div>
      <p class="gate-hint">输入一个只有你们知道的数字</p>
      <input id="gate-input" type="password" inputmode="numeric" placeholder="……" autocomplete="off">
      <button id="gate-btn">打开</button>
      <p id="gate-error" class="gate-error"></p>
    </div>
  </div>

  <header class="site-header">
    <h1>小小怪下士</h1>
    <p class="site-sub">2025.11 – 2026.05</p>
  </header>

  <main id="chapters"></main>
  <div id="hearts" aria-hidden="true"></div>

  <script src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: 提交**

```powershell
git add site/index.html
git commit -m "feat: page skeleton and password gate markup"
```

### Task 5: 样式（粉色系 + 叠放 + 响应式）

**Files:**
- Create: `<ws>/site/css/style.css`

- [ ] **Step 1: 写入完整 CSS**

```css
:root {
  --bg-a: #ffe9f2;
  --bg-b: #fff7fa;
  --ink: #4a3a42;
  --ink-soft: #8a7680;
  --accent: #d34a7a;
  --accent-deep: #c22a63;
  --border: #f3d9e4;
  --shadow: 0 10px 28px rgba(214, 105, 150, 0.18);
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  background: linear-gradient(180deg, var(--bg-a), var(--bg-b) 55%, #fdf1f7);
  color: var(--ink);
  line-height: 1.75;
  min-height: 100vh;
  overflow-x: hidden;
}

/* ---------- 密码页 ---------- */
.gate {
  position: fixed; inset: 0; z-index: 100;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(160deg, #ffd9e8, #ffeef6);
  transition: opacity 0.5s ease;
}
.gate.hidden { opacity: 0; pointer-events: none; }
.gate-card {
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid var(--border);
  border-radius: 24px;
  padding: 2.4rem 2rem;
  width: min(340px, 86vw);
  text-align: center;
  box-shadow: var(--shadow);
}
.gate-icon { font-size: 44px; }
.gate-hint { color: var(--ink-soft); font-size: 0.9rem; margin: 0.8rem 0 1.2rem; }
#gate-input {
  width: 100%; padding: 0.7rem 1rem; font-size: 1rem; text-align: center;
  border: 1.5px solid var(--border); border-radius: 14px; outline: none;
  letter-spacing: 4px;
}
#gate-input:focus { border-color: var(--accent); }
#gate-btn {
  margin-top: 1rem; width: 100%; padding: 0.7rem 0;
  border: none; border-radius: 14px; cursor: pointer;
  background: linear-gradient(135deg, #ff8fb3, #e85f93);
  color: #fff; font-size: 1rem; letter-spacing: 6px; text-indent: 6px;
}
#gate-btn:hover { filter: brightness(1.05); }
.gate-error { color: #d6455f; font-size: 0.85rem; min-height: 1.2em; margin-top: 0.7rem; }
.gate-card.shake { animation: shake 0.35s ease; }
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-7px); }
  75% { transform: translateX(7px); }
}

/* ---------- 页头 ---------- */
.site-header { text-align: center; padding: 4.2rem 1rem 2.6rem; }
.site-header h1 { font-size: clamp(1.8rem, 5vw, 2.6rem); letter-spacing: 0.2em; text-indent: 0.2em; color: var(--accent-deep); }
.site-sub { color: var(--ink-soft); font-size: 0.9rem; letter-spacing: 0.25em; margin-top: 0.5rem; }

/* ---------- 章节 ---------- */
#chapters { max-width: 1080px; margin: 0 auto; padding: 0 1.25rem 5rem; display: flex; flex-direction: column; gap: 4.5rem; }
.chapter { opacity: 0; transform: translateY(28px); transition: opacity 0.7s ease, transform 0.7s ease; }
.chapter.visible { opacity: 1; transform: none; }
.chapter-layout { display: flex; gap: 2.5rem; align-items: stretch; }
.stack-side { flex: 0 0 330px; }
.stack-wrap {
  position: relative; width: 320px; height: 400px; margin: 0 auto;
  cursor: pointer; user-select: none; touch-action: pan-y;
}
.photo-card {
  position: absolute; left: 0; top: 0; width: 320px; height: 400px;
  border-radius: 20px; overflow: hidden;
  background: #fde7ef; border: 4px solid #fff;
  box-shadow: var(--shadow);
  transition: transform 0.38s cubic-bezier(0.22, 0.9, 0.35, 1), opacity 0.38s ease;
  will-change: transform, opacity;
}
.photo-card img { width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
.deck-controls { display: flex; gap: 0.6rem; align-items: center; justify-content: center; margin-top: 1.1rem; }
.deck-controls button {
  width: 42px; height: 38px; font-size: 17px; cursor: pointer;
  background: #fff; border: 1px solid var(--border); border-radius: 12px; color: var(--accent-deep);
}
.deck-controls button:hover { border-color: var(--accent); }
.deck-counter { font-size: 0.85rem; color: var(--ink-soft); min-width: 64px; text-align: center; }

/* ---------- 文字面板 ---------- */
.desc-panel {
  flex: 1; min-width: 0;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 2rem 2.2rem;
  display: flex; flex-direction: column; justify-content: center;
}
.desc-date { color: var(--accent); font-weight: 600; font-size: 0.9rem; letter-spacing: 0.06em; }
.desc-title { font-size: 1.55rem; font-weight: 700; margin: 0.5rem 0 1rem; }
.desc-text { color: var(--ink-soft); font-size: 1.02rem; }
.desc-panel.fade-out { opacity: 0; transform: translateY(6px); transition: opacity 0.12s ease, transform 0.12s ease; }
.desc-panel.fade-in { opacity: 1; transform: translateY(0); transition: opacity 0.22s ease, transform 0.22s ease; }

/* ---------- 爱心粒子 ---------- */
.heart { position: fixed; top: -40px; opacity: 0.3; pointer-events: none; animation: fall linear infinite; }
@keyframes fall { to { transform: translateY(115vh) rotate(25deg); } }

/* ---------- 移动端 ---------- */
@media (max-width: 760px) {
  #chapters { gap: 3.2rem; }
  .chapter-layout { flex-direction: column; gap: 1.4rem; }
  .stack-side { flex: none; }
  .stack-wrap, .photo-card { width: min(320px, 78vw); height: calc(min(320px, 78vw) * 1.25); }
  .desc-panel { padding: 1.5rem 1.4rem; }
  .site-header { padding-top: 3rem; }
}
```

- [ ] **Step 2: 提交**

```powershell
git add site/css/style.css
git commit -m "feat: pastel styles, stack deck and responsive layout"
```

### Task 6: 交互逻辑（密码门 + 叠放 + 渲染）

**Files:**
- Create: `<ws>/site/js/app.js`

- [ ] **Step 1: 写入完整 JS**

```javascript
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

/* ---------- 数据加载 ---------- */
var chaptersEl = document.getElementById('chapters');

Promise.all([
  fetch('data/events.json').then(function (r) { return r.json(); }),
  fetch('data/photos.json').then(function (r) { return r.json(); })
]).then(function (res) {
  var events = res[0], photosByFolder = {};
  res[1].chapters.forEach(function (c) { photosByFolder[c.folder] = c.photos; });
  renderChapters(events, photosByFolder);
}).catch(function (e) {
  chaptersEl.innerHTML = '<p style="text-align:center;padding:3rem">加载失败：' + e.message + '</p>';
});

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
    '<div class="desc-title"></div>' +
    '<div class="desc-text"></div>';
  var dateEl = panel.querySelector('.desc-date');
  var titleEl = panel.querySelector('.desc-title');
  var textEl = panel.querySelector('.desc-text');
  return {
    el: panel,
    show: function () {
      panel.classList.remove('fade-in');
      panel.classList.add('fade-out');
      setTimeout(function () {
        dateEl.textContent = chapter.date;
        titleEl.textContent = chapter.title;
        textEl.textContent = chapter.text;
        panel.classList.remove('fade-out');
        panel.classList.add('fade-in');
      }, 120);
    }
  };
}

/* ---------- 渲染章节 ---------- */
function renderChapters(events, photosByFolder) {
  events.forEach(function (ev) {
    var photos = photosByFolder[ev.folder] || [];
    var section = document.createElement('section');
    section.className = 'chapter';
    var layout = document.createElement('div');
    layout.className = 'chapter-layout';
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
    layout.appendChild(stackSide);
    layout.appendChild(panel.el);
    section.appendChild(layout);
    chaptersEl.appendChild(section);

    if (photos.length) {
      createStack(wrap, photos).bindControls(prevBtn, nextBtn, counter, panel);
    } else {
      panel.show();
      counter.textContent = '0 / 0';
    }
  });

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) {
        en.target.classList.add('visible');
        observer.unobserve(en.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.chapter').forEach(function (ch) { observer.observe(ch); });
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
```

- [ ] **Step 2: 提交**

```powershell
git add site/js/app.js
git commit -m "feat: password gate, stack interaction and chapter rendering"
```

### Task 7: 本地验证

**Files:** 无（验证任务）

- [ ] **Step 1: 起本地静态服务器**

```powershell
Start-Process -FilePath "C:\Users\48478\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" -ArgumentList "-m","http.server","8901","--directory","<ws>\site" -WindowStyle Hidden
```

- [ ] **Step 2: 应用内浏览器验证（node_repl）**

复用浏览器运行时（`globalThis.agent/browser`，若绑定丢失按 browser 技能重建），新建标签页打开 `http://localhost:8901/`，逐项断言：

1. `h1` 文本 = `小小怪下士`。
2. 密码门：`#gate` 可见；输入错误值（`000000`）点 `#gate-btn` 后 `#gate-error` 非空且 `#gate` 仍可见；输入 `20251213` 后 `#gate` 含 `hidden` 类。
3. `.chapter` 数量 = 29；`.photo-card` 数量 = 88。
4. 图片全部加载：滚动到底触发 lazy load 后 `Array.from(document.images).every(i => i.complete && i.naturalWidth > 0)` 为 true。
5. 第 5 章（2025.12.12，4 张照片）：点击其 `.stack-wrap`，等待 500ms，其 `.deck-counter` 文本 = `2 / 4`。
6. 移动端：用浏览器 viewport 能力（先读该能力文档）设为 375x700，检查第 1 章 `.desc-panel` 的 boundingBox.top 大于其 `.stack-wrap` 的 bottom。
7. 控制台无 error 级日志。

任何一项失败 → 修复后重跑本步骤，直到全绿。

- [ ] **Step 3: 提交修复（如有）**

```powershell
git add -A
git commit -m "fix: issues found during browser verification"
```

### Task 8: 部署 GitHub Pages

**Files:**
- Create: `<ws>/.github/workflows/deploy.yml`

- [ ] **Step 1: 写入工作流**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: site
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: 提交全部**

```powershell
git add .github site
git commit -m "deploy: github pages workflow"
```

- [ ] **Step 3: 建仓库并推送（需用户 GitHub 登录）**

```powershell
gh auth status
```

若未登录：让用户运行 `gh auth login`（浏览器授权）后继续。默认仓库名 `our-story-2025`（与用户确认）。

```powershell
cd <ws>
gh repo create our-story-2025 --public --source=. --push
$owner = (gh api user -q .login)
gh api -X PUT repos/$owner/our-story-2025/pages -f build_type=workflow
```

Expected: 仓库创建成功；`PUT pages` 返回 200 或 204。若 PUT 报错，让用户在仓库 `Settings → Pages → Source` 选 `GitHub Actions`。

- [ ] **Step 4: 等待部署并验证**

等待约 2 分钟后：

```powershell
$u = "https://$owner.github.io/our-story-2025/"
$r = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 30
"HTTP $($r.StatusCode)"
```

Expected: `HTTP 200`。打开该 URL 与应用内浏览器各验证一次（密码门 + 首章图片）。

- [ ] **Step 5: 交付**

把链接 + 密码交给用户，并说明：公开仓库 + 密码页是免费方案下最稳妥的隐私组合；删除仓库即可下线。

### Task 9: v2 版式改造（作品集式排版 + 粉色系）

**Files:**
- Modify: `<ws>/site/index.html`（新结构：hero + marquee + about-line + chapters）
- Modify: `<ws>/site/css/style.css`（重写版式，保留 gate/hearts/stack 样式）
- Modify: `<ws>/site/js/app.js`（新增 marquee/magnet/char-reveal/sticky 卡片渲染）

要点（实现即文档，结构见上方 v2 设计）：hero 磁性主图注意用外层定位 + 内层 transform，避免与居中 transform 冲突；跑马灯行宽 = 集合内照片数 × (280+12)px，x = (offset−200) mod setW，offset = (scrollY − sectionTop + innerHeight) × 0.3，第 1 排正方向、第 2 排负方向；卡片 top 与 scale 由 JS 内联设置；验证清单同 Task 7 另加：marquee 瓦片数 = 88×3、滚动后两排 transform 非空、about-text 子 span 数 ≈ 22、hero 主图加载正常。

验证通过后：本地预览交用户确认 → `git commit` → 推送到 main → 等 Actions 部署完成 → 验证线上 URL。
