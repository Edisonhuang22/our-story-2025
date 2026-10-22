-- =========================================================================
-- 修复漏洞 2：回忆目录表对匿名访客开放（anon 可整表拉取 33 条标题与日期）
-- 使用方法：Supabase 控制台 -> SQL Editor -> 粘贴本文件全部内容 -> Run
-- 执行顺序：memory-sync.sql -> gallery-management.sql -> 本文件
-- 幂等：可重复执行。
-- =========================================================================
--
-- 背景：
--   gallery-management.sql 早期版本写的是
--     grant select (folder,title,hidden,author,memory_date) ... to anon;
--     create policy "Anyone reads displayed gallery entries" ... to anon
--     using (auth.role() = 'anon' or public.is_story_member());
--   结果：照片表、文字表、信件表都锁住了，只有目录表没锁。
--   任何拿到页面里 anon key 的人都能：
--     GET /rest/v1/story_gallery_entries?select=folder,title
--   拿到全部回忆的标题和日期。
--
-- 影响面：未登录页面不查询这张表（sync.js 的 loadGallery 在没有角色时直接返回空），
--         因此把读权限收给 authenticated 不会影响任何现有功能。
-- =========================================================================

-- 1. 撤销匿名的表级读权限
revoke all on public.story_gallery_entries from anon;

-- 2. 删掉旧的公开读策略，换成仅成员可读
drop policy if exists "Anyone reads displayed gallery entries" on public.story_gallery_entries;
drop policy if exists "Story members read entries" on public.story_gallery_entries;

create policy "Story members read entries"
on public.story_gallery_entries for select to authenticated
using (public.is_story_member());

-- 3. 成员仍然需要完整的写权限（与 gallery-management.sql 保持一致）
grant select, insert, update, delete on public.story_gallery_entries to authenticated;

-- =========================================================================
-- 验收：下面两条查询应当返回
--   (1) 匿名 select 的 policy 列表为空
--   (2) anon 对 story_gallery_entries 的权限只剩 REFERENCES/TRIGGER/TRUNCATE 之类，
--       不再有 SELECT
-- =========================================================================
select policyname, roles, cmd
from pg_policies
where schemaname = 'public' and tablename = 'story_gallery_entries';

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'story_gallery_entries'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;