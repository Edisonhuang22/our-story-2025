# assets/ —— 只在仓库里保存的源素材

这里放**不参与部署**的原始素材。GitHub Pages 只发布 `site/`，所以放在这里的文件不会出现在线上。

| 路径 | 说明 |
| --- | --- |
| `gate/girl.png` | 会合入口"小小二学妹"抠图原稿（522×478，247KB） |
| `gate/boy.png` | 会合入口"大大布学长"抠图原稿（528×472，169KB） |

线上的对应文件是 `site/img/gate/girl.webp` / `boy.webp`（宽 320、q82、保留透明通道，14.0KB / 10.6KB）。

## 重新生成 WebP

```powershell
# 需要 sharp（work/optimize/node_modules 里已有）
node work/optimize/convert-gate.cjs
```

脚本会把 `assets/gate/*.png` 压成 `site/img/gate/*.webp`。改完记得同步给 HTML 里的 `width`/`height`（当前写的是原图比例，不要跟着缩略尺寸改，否则布局会跳）。