# supabase/ · 数据库脚本

数据库里的**结构、策略、白名单、迁移数据**全在这几个文件里。没有 CLI、没有 migration 框架，就是手动在 Supabase 控制台的 SQL Editor 里粘贴执行。

## 执行顺序

| 顺序 | 文件 | 干什么 | 什么时候执行 |
| --- | --- | --- | --- |
| 001 | `001-memory-sync.sql` | 建 `story_letters` / `story_letter_photos` / `memory_perspectives`，建两个白名单函数（`story_member_role()` / `is_story_member()`），建 `story-letter-photos` 桶 | **只执行一次**（首次搭建） |
| 002 | `002-gallery-management.sql` | 建 `story_gallery_entries` / `story_gallery_photos`，建 `story-gallery` 桶与策略 | 一次 |
| 003 | `003-migrate-to-supabase-complete.sql` | 把早期 88 张静态照片和那封信的行数据写进库（只写行，图片文件本身另说） | 一次；**要在 002 之后** |
| 004 | `004-fix-privacy-leaks.sql` | 收紧 `story_letters` / `story_gallery_photos` / `story_gallery_entries` 的策略，堵住匿名读 | 每次发现策略回退都可以重跑 |
| 005 | `005-fix-anon-entry-leak.sql` | 专门把 `story_gallery_entries` 的匿名读彻底关掉（`revoke all from anon` + 只留成员策略） | **最后跑**，跑完用文末的两条校验 SQL 确认 |

> 001–003 是"从零搭起来"，004–005 是"补洞"。已经有数据的环境**不要重跑 001–003**（虽然幂等，但 003 会把正文写成空串——见下）。

## 幂等性与坑

- **每个脚本都可以重复执行**，不会重复插数据、不会删表。
- `003` 里《小作文》正文是空串，且用 `on conflict … do nothing`：这样即使误跑，也**不会把线上已有的正文清空**。正文的维护走 `work/sync-private-letter.mjs`，不写在 SQL 里。
- `004` / `005` 会先 `drop policy if exists` 再 `create policy`，可以放心重跑。
- 改白名单（换邮箱/换角色名）**只需要改 001 里的 `story_member_role()` 并重跑它**。前端登录后是通过 `client.rpc('story_member_role')` 问数据库要身份的，公网 JS 里没有邮箱清单，不需要同步改任何前端文件。
- 这个函数对 `anon` 也可执行（Postgres 默认给 PUBLIC 授权），但匿名请求的 JWT 里没有 email，只会返回 `null`，不泄露任何信息。

## 校验（跑完 005 之后）

```sql
select tablename, policyname, roles, cmd from pg_policies
where schemaname = 'public' and tablename like 'story_%' order by tablename;

select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'anon' and table_name like 'story_%';
```

第二条**必须返回 0 行**。如果还有 `anon` 的授权，说明脚本没跑完。

## 还需要你在控制台手动做的事

1. Authentication → Providers → Email：**关掉 "Enable sign ups"**，只留你手动建的两个账号（否则陌生人能注册）。
2. Authentication → URL Configuration：Site URL 填线上地址，Redirect URLs 加上 `https://edisonhuang22.github.io/our-story-2025/easter-egg.html` 和本地调试地址（重置密码的邮件会跳回来）。
3. 每次改完前端记得同步 `?v=` 版本号（见 `HANDOFF.md` 第 4 节）。

`NOTIFICATION_SETUP.md` 是信件提醒（Edge Function / 邮件）的配置说明，与建表无关，按需再看。