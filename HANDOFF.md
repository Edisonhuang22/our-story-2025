# 七夕网站项目交接汇总

> 用途：新对话开局文档。新会话先读本文件，再读 `site/data/events.json`、`site/data/photos.json`、`site/js/app.js`。
> 最后更新：2026-08-19

---

## 1. 项目速览

- 性质：七夕礼物网站，纯静态站（HTML/CSS/JS，无框架、无构建），部署于 GitHub Pages。
- 标题：**大大怪将军与小小怪下士**
- 内容：29 个章节 / 88 张照片，时间跨度 2025.11 – 2026.05，每章一张卡片：左照片叠放、右文字描述。
- 访问密码：**20251213**（首页密码门，输入后解锁，纯前端校验）。
- 彩蛋页：`site/easter-egg.html`（同款密码门 + 小作文），入口藏在首页页尾：一只若隐若现的 🐣，无文字，hover 才变明显。
- 线上地址：https://edisonhuang22.github.io/our-story-2025/
- 仓库：https://github.com/Edisonhuang22/our-story-2025 （origin 为 HTTPS，push 需要 VPN）

## 2. 本地路径

- 主目录（用户一直用的这份）：`C:\Users\48478\Documents\Codex\2026-08-17\superpowers-plugin-superpowers-openai-curated-i`
- 另一份同仓库 worktree：`C:\Users\48478\.codex\worktrees\96c1\superpowers-plugin-superpowers-openai-curated-i`（当前两处内容一致，均有未提交改动，见第 6 节）

## 3. 仓库结构（只关注 site/）

| 路径 | 说明 |
| --- | --- |
| `site/index.html` | 单页：密码门 + 首屏 hero + 照片带 + 章节卡片容器 + 页尾隐藏彩蛋入口 |
| `site/easter-egg.html` | 彩蛋页：独立页面，同款密码门；`essay` 区域内写小作文 |
| `site/css/style.css` | 全部样式，可爱系配色 |
| `site/js/app.js` | 密码校验、照片带渲染/拖拽、卡片叠放交互、懒加载 |
| `site/data/events.json` | 29 条事件：`{folder, date, title, text}`，**章节文字的唯一来源**，不要重写文案，改文案只改这里 |
| `site/data/photos.json` | 29 章：`{folder, photos:[{src, w, h, thumb, card}]}`，88 条 |
| `site/img/<日期>/N.webp` | 正图 88 张（1050×1400 内，q80）+ 1 张 hero（`img/2026-4-21/hero.webp`，**520×360 横向**，v6 从方形原图 1.webp 按 attention 裁出），共 89 个文件 |
| `site/thumbs/<日期>/N.webp` | 照片带缩略图 88 张（560×360），1.38MB |
| `site/cards/<日期>/N.webp` | 卡片叠放图 88 张（~640×812），2.39MB，**v5 未提交** |
| `.github/workflows/*.yml` | push 到 main 自动部署 `site/` 到 Pages |

`folder` 格式：`2025.11.19`（events.json）对应图片目录 `2025-11-19`（photos.json 的 src 路径）。

## 4. 用户定下的设计决策（红线，不要回退）

1. 风格：可爱系配色；用户明确讨厌土味元素——实时计数器、七夕寄语、七夕快乐、情书均已删除，不要加回。
2. 卡片大小统一：所有章节卡片同一尺寸（此前"从小到大"已改为统一最后一张的尺寸），手机/电脑一致。
3. 无吸顶效果：曾因手机端滚动时卡片顺序乱跳而移除，不要再加吸顶。
4. 无顶部导航：原"故事、照片、时间线、一句话"四块已删除。
5. 顶部照片带：**手动左右拖动**（initDrag），不允许随页面滚动自动横滑；标题文案为"**开始了！！！**"（替代原"88张照片，从2025年11月到2026年5月"）。
6. 密码门保留，密码 20251213；标题保留"大大怪将军与小小怪下士"。
7. 88 张照片已是最终数量；三个空文件夹用户已删。
8. 首页 hero 为**更小的横向图**（520×360）；hero 左下文案为用户指定的“第一次加载可能要有点长时间，不要着急吼”，保持原文不要改。

## 5. 版本历史

| 提交 | 内容 | 状态 |
| --- | --- | --- |
| `0abea30` | v2 portfolio 风格布局（参照用户给的 3D Creator Jack 样例，可爱配色） | 已上线（旧） |
| `31cecc3` | v3：统一卡片尺寸、照片带改手滑、移除导航与吸顶 | 已上线（旧） |
| `34b7ba8` | **v4 性能优化，当前线上版本** | 已上线 |
| v6（未提交） | hero 改横向 520×360；hero 文案改为加载提示；新增彩蛋页 + 首页入口 | 本地验证通过 |

v4 做了什么（已验证并推送）：
- 88 张正图 JPG→WebP：13.8MB→7.55MB；新增 88 张照片带缩略图（1.38MB）；
- 修复照片带重复渲染（264 张请求→88 张）；卡片 img 补 width/height；
- 卡片图片 `loading="lazy"`；hero 独立压缩 + `fetchpriority="high"`；
- 首屏从"全量 13.8MB/264 图"降到约 2.66MB/46 图；
- 线上核验通过：29 章/88 图、src 全部 .webp、thumb 字段齐全、抽查图片 200 + image/webp、无 404。

## 6. 当前仓库状态（重要：有未提交的 v5 在途改动）

`git status --short`（主目录）：
```
 M site/css/style.css
 M site/data/photos.json
 M site/img/2026-4-21/hero.webp   (v6: 520x360 横向)
 M site/index.html                (v6: hero 文案 + 彩蛋入口)
 M site/js/app.js
?? HANDOFF.md
?? site/cards/
?? site/easter-egg.html          (v6: 彩蛋页)
```

v5 改动内容（**未测试、未提交、未推送**，线上仍是 v4）：
- 新增 `site/cards/` 88 张卡片级 webp（~2.39MB），photos.json 每条加 `card` 字段；
- `app.js`：卡片叠放改用 `photos[idx].card` 图（img 固定 640×812），`IntersectionObserver` 只加载顶部 3 张、翻牌时 `ensureTopLoaded()` 按需加载；新增 `loadImg()` 失败重试（最多 2 次，加 query 破缓存）；照片带缩略图也从 `loading="lazy"` 改为 observer 方式（`lazyImgObserver`，rootMargin 400px）；
- `style.css`：`.card-slot` 加 `content-visibility: auto; contain-intrinsic-size: auto 720px;`。

**v6 改动内容（叠加在 v5 上，已验证、未提交、未推送）**：
- `site/img/2026-4-21/hero.webp`：由 520×650 竖向改为 **520×360 横向**（源用方形原图 `1.webp`，`resize({fit:"cover", position:"attention"})`，q80，12KB）；
- `site/index.html`：hero img `width/height` 改为 520×360；`.hero-tag` 文案改为“第一次加载可能要有点长时间，不要着急吼”；新增页尾隐藏彩蛋入口 `<a class="egg-footer" href="easter-egg.html">🐣</a>`（无文字、低透明度，hover/focus 才显现）；
- `site/css/style.css`：hero 显示尺寸/比例调整（aspect-ratio 13/9，桌面 clamp(260px,28vw,440px)）；新增 `.egg-footer` 样式（页尾居中、opacity 0.35，hover/focus 才显现，无边框无背景无动画）；
- `site/easter-egg.html`：新页面，同款密码门（sessionStorage 解锁互通），彩蛋动画 + 小作文（已写入 `.essay-body`，共 8 段，署名右对齐）；
- `work/pwtest/opt-verify.mjs`：更新为覆盖 v5 懒加载 + v6 改动的 19 项检查（彩蛋入口：链接正确/基础 opacity<0.6/点击跳转彩蛋页），本地全部通过。

新会话第一步：先本地起服 + 无头浏览器过一遍 v5，确认 88 张卡片图无 404、交互正常，再决定 commit/push。**不要直接 push 未验证的 v5。**

## 7. 本地开发与验证

- 测试服务器：`work/static-server.js`（静态服务器，已配 webp MIME，端口 8901）：
  `node work/static-server.js` → http://localhost:8901/
- 无头验证脚本：`work/pwtest/opt-verify.mjs`（Puppeteer + Edge headless，2026-08-19 已更新）：19 项检查，含 88 张照片带、v5 cards 懒加载（滚动后前 3 张用 /cards/ webp）、hero 520×360 横向、hero 文案、页尾彩蛋入口（链接正确/低透明度/点击跳转）、彩蛋页密码门/小作文/点蛋孵化、无 404、无控制台报错。
- 截图目录：`work/shots/`。
- `work/`、`photos/`、`.superpowers/`、`outputs/` 已被 gitignore，测试产物不要 commit。

## 8. Windows 环境注意事项（前几轮踩过的坑）

- 本机没有 `apply_patch` 工具，改文件用 Node 精确替换脚本（先读再写），或 PowerShell here-string + `Set-Content -Encoding UTF8`。
- `rg` 被拦，用 `Select-String` 替代。
- 原始 HEIC 无法用 sharp 直转（libheif iref 数量超限）；HEIC→JPG 的中间产物在 `work/heic-tmp/*.jpg`（46 张齐全），**转图一律以这里为源**。
- push 前确保 VPN 已开（用户已知）。
- PowerShell 里 `$HOME`、`$PWD` 是保留变量，脚本别用来当普通变量名。

## 9. 部署与核验流程（v4 已验证过一次）

```powershell
git push origin main
gh run list --repo Edisonhuang22/our-story-2025 --limit 1   # 取 run id
gh run watch <id> --repo Edisonhuang22/our-story-2025 --exit-status
```

线上核验要点（PowerShell）：
```powershell
$base='https://edisonhuang22.github.io/our-story-2025/'
$json = Invoke-RestMethod ($base + 'data/photos.json')
# 断言：chapters=29、photos 总数=88、src 全部 .webp、thumb/card 字段齐全
Invoke-WebRequest ($base + 'img/2025-11-19/1.webp') -Method Head   # 200 + image/webp
Invoke-WebRequest ($base + 'thumbs/2025-11-19/1.webp') -Method Head
Invoke-WebRequest ($base + 'js/app.js') -Method Head               # 无 404
```

提醒用户：每次上线后手机端要**清缓存/强刷**，否则看到旧资源。

## 10. 后续可选优化（未做，用户未定）

- 正图降档 900×1200 q75：总量再减约一半，放大看细节略糊；
- v5 上线后若还想省：cards 图已在 2.39MB，基本到头；
- 其他未决事项：无。