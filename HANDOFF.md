# 交接文档 · 大大布将军与小小二下士

> 用途：新会话/新接手的人读这一份就够了。
> 最后更新：2026-10-23

---

## 1. 这是什么

一个只给两个人看的私人站点：回忆相册 + 信箱彩蛋。纯静态（HTML/CSS/JS，**无框架、无构建、无 npm 依赖**），托管在 GitHub Pages，数据在 Supabase。

- 线上：https://edisonhuang22.github.io/our-story-2025/
- 仓库：https://github.com/Edisonhuang22/our-story-2025 （origin 是 HTTPS，push 需要 VPN）
- 标题：**大大布将军与小小二下士**（别改）

⚠️ **首页那道密码门只是"别让外人一眼看到"的布帘，不是安全措施**：密码写在前端 JS 里，谁都能读到。真正的访问控制是 Supabase 的登录 + RLS——没登录就只能看到公开的壳子，照片、文字、目录全部拿不到。

## 2. 目录结构

```
site/                     ← 只有这个目录会部署（见 deploy.yml 的 path: site）
  index.html              ← 单页：密码门 → hero → 回忆球 → 时间线 → 卡片 → 详情弹窗
  easter-egg.html         ← 信箱页（独立页面，同样的密码门）
  js/gate.js              ← 密码门
  js/sync.js              ← Supabase 客户端封装（登录、读写、实时订阅、签名 URL）
  js/app.js               ← 首页渲染：回忆球、时间线、卡片、详情弹窗
  js/gallery-editor.js    ← 编辑/上传/删除（仅登录后可用）
  js/mailbox.js           ← 信箱页逻辑
  js/vendor/              ← supabase-js 本地副本（别再引 CDN，见第 7 节）
  css/                    ← style.css / mailbox.css
  img/gate/               ← 压缩后的头像 WebP + 中国地图 SVG
supabase/                 ← 数据库脚本，按编号顺序在控制台执行（见第 5 节）
assets/                   ← 源素材，不部署（见 assets/README.md）
work/                     ← 本地工具与测试，已 gitignore，不部署
```

## 3. 本地跑起来

```powershell
node work/static-server.js        # http://localhost:8901
```

它只是个带正确 MIME 的静态文件服务器（ES 模块、WebP 都靠它）。**不要直接双击 index.html**，`file://` 下 Supabase 登录会失败。

## 4. 改完怎么发布

`git push origin main` → GitHub Actions 自动跑 `.github/workflows/deploy.yml` → 把 `site/` 发到 Pages。

**改了 css/js 之后跑一次**：

```powershell
node work/stamp-versions.mjs          # 把 ?v= 换成本地文件的短内容哈希
node work/stamp-versions.mjs --check  # 只检查，落后就退出码 1
```

GitHub Pages 的 CDN 会把资源缓存 10 分钟，`?v=` 忘了改就会出现"我明明改了但线上没变"。这个脚本按文件内容算哈希，改了哪个就只动哪个，重复跑结果不变。

## 5. Supabase

- 项目 URL 和 publishable key 明文写在 `site/js/sync.js` 顶部——这是**设计如此**（publishable key 本来就是公开的，安全全靠 RLS）。
- **service_role key 绝对不要写进 `site/` 里的任何文件**，它绕过 RLS。
- **"谁是谁"只由数据库决定**：`story_member_role()` 读 JWT 里的邮箱，返回「大大布」/「小小二」/null。前端登录后调这个 RPC 拿身份，**公网 JS 里不再有任何邮箱地址**。加人/换人只改 `supabase/001-memory-sync.sql` 里那个函数并重跑它，前端一行都不用动。

### 首次搭建的执行顺序

按 `supabase/README.md` 里的编号顺序在 SQL Editor 里逐个 Run。每个脚本都是幂等的，重复执行不会毁数据。

### 数据表

| 表 | 用途 | 谁能读 |
| --- | --- | --- |
| `story_gallery_entries` | 回忆的标题/日期/正文 | 仅登录的两位成员 |
| `story_gallery_photos` | 照片行（真实文件在 Storage） | 仅登录的两位成员 |
| `story_letters` | 信箱里的信 | 仅登录的两位成员 |
| `story_letter_photos` | 信里的配图 | 仅登录的两位成员 |
| `memory_perspectives` | 同一段回忆，两个人各自的视角 | 仅登录的两位成员 |

Storage 用两个**私有桶**：`story-gallery`（回忆照片）、`story-letter-photos`（信的配图）。私有桶没有公开直链，前端一律走 `createSignedUrls` 拿 24 小时有效的签名 URL。

## 6. 《小作文》正文怎么维护

正文**不在代码仓库里**，只存在 Supabase 的 `story_letters` 表中（id 固定为全零 UUID）。

- 本地唯一副本：`work/private/letter.txt`（已 gitignore）
- 更新线上：`node work/sync-private-letter.mjs`（需要 `SUPABASE_SERVICE_ROLE_KEY` 环境变量，见 `work/private/README.md`）
- 只检查不改：`node work/sync-private-letter.mjs --check`

历史上正文曾经硬编码在 SQL 文件里、还进了公开仓库的 git 历史，所以 P0-3（清理历史）仍然待办。

## 7. 已知的坑

| 坑 | 说明 |
| --- | --- |
| 别再引 CDN | 2026-10 有一次 jsdelivr 抽风，整个站直接白屏。supabase-js 已经落到 `site/js/vendor/`，本地引用。 |
| 版本号 | 见第 4 节。忘了改就会"我明明改了啊"。 |
| `renderOrbit` / `initGalleryEditor` 会重复调用 | 两者都做了幂等处理：前者先 teardown 再重绘，后者只绑定一次监听、靠 `liveStories` / `liveGallery` 更新数据。**改这两个函数时别把守卫拆了**，否则一次保存会写好几遍。 |
| 上传体积 | 前端压缩后单张上限 10 MB（三处文案已统一）。压缩逻辑在 `sync.js` 的 `compressImage`。 |
| `static_src` | 早期 88 张照片是静态图片，行里只有 `static_src` 没有 `storage_path`；新上传的正好相反。两种都要兼容。 |
| 正文到底写哪张表 | **"编辑回忆"只管 `story_gallery_entries.body`（卡片/时间线上的主叙事）**；"大大布记得的 / 小小二记得的"是 `memory_perspectives`，只能在详情弹窗里写。两边各有一个写入口，别再把它们混在一起——混过一次，表现为"改了正文但卡片没变"。 |
| 会合门的两个标记 | `story-map-complete`（session，本次浏览已过关）+ `story-gate-complete`（local，曾经通过，彩蛋页据此放行）。旧的 `unlocked` 只在检测到时迁移一次。 |
| 时间线/回忆球需要登录 | 没登录时 `#orbit-panel` 是 hidden 的，这是故意的，不是 bug。 |

## 8. 验收

```powershell
node work/pwtest/verify-p0-sql.mjs        # SQL/RLS 断言（PGlite 起真实 Postgres）
node work/pwtest/verify-idempotent.mjs    # 重复渲染不叠加节点/监听
node work/static-server.js                # 另开一个窗口
node work/pwtest/audit-shots.mjs          # 首屏字节、控制台错误、降级模式
node work/pwtest/audit-shots2.mjs         # 移动端点击区域、横向溢出
```

改动的优先级清单在 `待改清单.md`，进度也记在那里。

## 9. 不要动的部分

- 标题"大大布将军与小小二下士"
- 可爱系配色、统一的卡片尺寸、没有吸顶导航
- hero 那句提示文案"第一次加载可能要有点长时间，不要着急吼"（用户指定）
- 不要加计数器、七夕寄语、love-letter 之类的土味元素