# 双方手机邮件通知设置指引（方案二：QQ 邮箱互通）

> 目标：当**大大布**添加信件或回忆时，**小小二**的手机/微信收到提醒；当**小小二**添加时，**大大布**的手机/微信收到提醒。  
> 核心逻辑：利用 QQ 邮箱的 SMTP 服务，由 Supabase 在检测到新内容时自动发送精美 HTML 邮件。对方手机端开启了微信「QQ邮箱提醒」或 QQ 邮箱 App 即可实时弹出消息。

---

## 步骤一：获取 QQ 邮箱授权码（只需大大布操作一次，1分钟）

> 说明：因为是小窝发信信使，**只需要大大布开通一次**发信权限，即可作为小窝信使同时给双方发送通知，小小二完全不需要做任何配置！

1. 电脑浏览器打开 [QQ 邮箱网页版](https://mail.qq.com/) 并登录大大布账号（`484784621@qq.com`）。
2. 点击页面左上角（或右上角头像旁边）的 **设置**。
3. 切换到 **账户** 标签页。
4. 向下滚动找到 **POP3/IMAP/SMTP/Exchange/CardDAV/CalDAV服务**：
   - 找到 **POP3/SMTP服务**，如果未开启，点击「**开启**」；如果已开启，点击「**生成授权码**」。
5. 根据屏幕提示用绑定的手机发送一条短信，发送后点击「我已发送」。
6. 页面会弹出一串 **16 位英文字母**（如 `abcdefghijklmnop`），**复制并保存好这串授权码**（它就是发信密码）。

---

## 步骤二：在 Supabase 创建 Edge Function

1. 打开 [Supabase 控制台](https://supabase.com/dashboard) 并进入你们的项目（`ewqxttklaaqxybldaklc`）。
2. 在左侧菜单栏点击 **Edge Functions**。
3. 点击右上角的 **Deploy a new function**（或者已有函数时的创建按钮），选择 **Via Editor**（通过在线编辑器创建）。
4. 函数名称填写：`notify-partner`。
5. 将本地文件 [`supabase/functions/notify-partner/index.ts`](file:///c:/Users/48478/Documents/ChatGPT/网站/supabase/functions/notify-partner/index.ts) 中的全部代码复制，粘贴到在线编辑器中。
6. 点击右上角的 **Deploy**（部署）按钮。

---

## 步骤三：在 Supabase 配置授权码环境变量（Secrets）

1. 在 Supabase 控制台左侧进入 **Edge Functions** $\rightarrow$ **Secrets**（或点击项目左下角 **Project Settings** $\rightarrow$ **Edge Functions**）。
2. 点击 **Add new secret**：
   - **Name**: `SMTP_PASS`
   - **Value**: 填写在步骤一获取的 16 位 QQ 邮箱授权码
3. （可选检查）如果默认使用大大布邮箱发信，无需额外配置；如需特别指定，可再添加一个 Secret：
   - **Name**: `SMTP_USER`
   - **Value**: `484784621@qq.com`

---

## 步骤四：配置数据库 Webhooks（自动监听新信件与新回忆）

只需在 Supabase 控制台点选两次即可完成自动触发配置：

### 1. 监听新信件
1. 在 Supabase 左侧菜单栏点击 **Database** $\rightarrow$ **Webhooks**。
2. 点击 **Create a webhook**：
   - **Name**: `notify_new_letter`
   - **Table**: 选择 `story_letters`
   - **Events**: 勾选 `Insert`（只在新建时提醒）
   - **Webhook configuration**:
     - **Type of webhook**: 选择 `Supabase Edge Functions`
     - **Edge Function**: 选择 `notify-partner`
     - **Method**: `POST`
3. 点击 **Create webhook** 保存。

### 2. 监听新回忆卡片
1. 再次点击 **Create a webhook**：
   - **Name**: `notify_new_memory`
   - **Table**: 选择 `story_gallery_entries`
   - **Events**: 勾选 `Insert`
   - **Webhook configuration**:
     - **Type of webhook**: 选择 `Supabase Edge Functions`
     - **Edge Function**: 选择 `notify-partner`
     - **Method**: `POST`
2. 点击 **Create webhook** 保存。

### 3. （可选）监听回忆心声文字
1. 如果某天旧回忆新增/修改了专属视角心声（`memory_perspectives`），也可创建：
   - **Name**: `notify_memory_perspective`
   - **Table**: 选择 `memory_perspectives`
   - **Events**: 勾选 `Insert` 和 `Update`
   - **Edge Function**: 选择 `notify-partner`

---

## 步骤五：确保手机端微信接收到弹窗提醒

为了让邮件像微信好友消息一样在手机上实时震动弹窗：
1. **微信开启「QQ邮箱提醒」**（最推荐，几乎所有用 QQ 邮箱的人都有）：
   - 微信打开 $\rightarrow$ 右下角 **我** $\rightarrow$ **设置** $\rightarrow$ **通用** $\rightarrow$ **辅助功能** $\rightarrow$ **QQ邮箱提醒**。
   - 确保状态为“已启用”，并勾选“接收邮件提醒”。
2. 或者手机上安装有 **QQ** 或 **QQ邮箱** App，系统通知权限开启即可。
