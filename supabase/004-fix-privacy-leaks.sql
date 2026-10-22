-- =========================================================================
-- 隐私防泄漏修复 SQL 脚本 (针对漏洞 1、2、3)
-- 使用方法：登录 Supabase 控制台 -> 进入 SQL Editor -> 粘贴本脚本全部内容 -> 点击 Run
-- 执行顺序：memory-sync.sql -> gallery-management.sql -> 本文件 -> fix-anon-entry-leak.sql
-- =========================================================================

-- -------------------------------------------------------------------------
-- 修复漏洞 1：把《小作文》从仓库里移出，正文只保存在云端信箱
-- -------------------------------------------------------------------------
-- 说明：正文曾以明文写在本脚本与 migrate-to-supabase-complete.sql 里，而仓库是公开的。
-- 2026-10-22 起正文不再进入仓库。这里只负责保证占位行存在：
--   * body 留空，且 on conflict do nothing —— 绝不会覆盖线上已有正文；
--   * 正文的录入/更新改用 work/private/letter.txt + work/sync-private-letter.mjs
--     （work/ 已 gitignore，需要 service_role key，只在本地运行）。
insert into public.story_letters (id, sender, date, title, body, is_original)
values (
  '00000000-0000-0000-0000-000000000001',
  '大大布',
  '2026-08-19',
  '小作文',
  '',
  true
)
on conflict (id) do nothing;

-- -------------------------------------------------------------------------
-- 修复漏洞 2：回忆目录表对匿名访客开放，标题与日期可被整表拉取
-- -------------------------------------------------------------------------
-- 详见 fix-anon-entry-leak.sql。放在这里是为了让"重跑本脚本"也能修掉它。
revoke all on public.story_gallery_entries from anon;
drop policy if exists "Anyone reads displayed gallery entries" on public.story_gallery_entries;
drop policy if exists "Story members read entries" on public.story_gallery_entries;
create policy "Story members read entries"
on public.story_gallery_entries for select to authenticated
using (public.is_story_member());

-- -------------------------------------------------------------------------
-- 修复漏洞 3：收紧云端相册照片表与存储桶权限，杜绝未登录访客直链扒图
-- -------------------------------------------------------------------------

-- 1. 彻底撤销匿名访客 (anon) 读取云端相册照片表的权限，仅允许已认证成员 (authenticated) 读写
revoke all on public.story_gallery_photos from anon;
grant select, insert, update, delete on public.story_gallery_photos to authenticated;

-- 2. 移除原先的公开读取策略，开启行级安全校验：只有白名单成员（大大布与小小二）可读取照片记录
drop policy if exists "Anyone reads displayed gallery photos" on public.story_gallery_photos;
drop policy if exists "Story members read gallery photos" on public.story_gallery_photos;
create policy "Story members read gallery photos"
on public.story_gallery_photos for select to authenticated
using (public.is_story_member());

-- 3. 将 story-gallery 存储桶设置为私有 (public = false)
update storage.buckets
set public = false
where id = 'story-gallery';

-- 4. 确保存储桶读取权限仅限登录的白名单故事成员（大大布与小小二）
drop policy if exists "Story members read gallery files" on storage.objects;
create policy "Story members read gallery files"
on storage.objects for select to authenticated
using (bucket_id = 'story-gallery' and public.is_story_member());

-- 5. 确保只有故事成员可以在自己的用户目录下上传照片
drop policy if exists "Story members upload gallery files" on storage.objects;
create policy "Story members upload gallery files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'story-gallery'
  and public.is_story_member()
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 6. 确保故事成员可以管理与删除照片
drop policy if exists "Story members delete gallery files" on storage.objects;
create policy "Story members delete gallery files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'story-gallery'
  and public.is_story_member()
);
