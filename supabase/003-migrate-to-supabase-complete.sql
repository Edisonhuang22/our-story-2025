-- =========================================================================
-- 88张历史照片与一封信全面迁移至 Supabase 数据库与存储桶 SQL 脚本
-- 使用方法：登录 Supabase 控制台 -> 进入 SQL Editor -> 粘贴本脚本全部内容 -> 点击 Run
-- =========================================================================

-- 1. 确保 story_gallery_photos 表包含 thumb_path 缩略图路径字段，用于极速加载小图
alter table public.story_gallery_photos add column if not exists thumb_path text;

-- 2. 授权 authenticated 角色读取和写入 thumb_path 字段
grant select, insert, update, delete on public.story_gallery_photos to authenticated;
grant select (folder, title, hidden, author, memory_date, body) on public.story_gallery_entries to authenticated;

-- 3. 将原先静态嵌入在前端的 29 段历史回忆全部录入 story_gallery_entries 云端数据表
insert into public.story_gallery_entries (folder, title, author, hidden, memory_date)
values
  ('2025.11.19', '第一张照片', '大大布', false, '2025-11-19'),
  ('2025.12.1', '遇见', '大大布', false, '2025-12-01'),
  ('2025.12.4', '打扫卫生', '大大布', false, '2025-12-04'),
  ('2025.12.6', '小费生日', '大大布', false, '2025-12-06'),
  ('2025.12.12', '办公室搞怪', '大大布', false, '2025-12-12'),
  ('2025.12.13', '去看电影', '大大布', false, '2025-12-13'),
  ('2025.12.16', '复习夜', '大大布', false, '2025-12-16'),
  ('2025.12.21', '办公室的冬至', '大大布', false, '2025-12-21'),
  ('2025.12.22', '我拍的照片', '大大布', false, '2025-12-22'),
  ('2025.12.24', '校门外散步', '大大布', false, '2025-12-24'),
  ('2025.12.25', '第一次过夜', '大大布', false, '2025-12-25'),
  ('2025.12.28', '实验室合照', '大大布', false, '2025-12-28'),
  ('2025.12.30', '每晚散步', '大大布', false, '2025-12-30'),
  ('2025.12.31', '跨年', '大大布', false, '2025-12-31'),
  ('2026.1.6', '散散步', '大大布', false, '2026-01-06'),
  ('2026.1.7', '聚餐过敏', '大大布', false, '2026-01-07'),
  ('2026.1.11', '考完试', '大大布', false, '2026-01-11'),
  ('2026.1.12', '武功山', '大大布', false, '2026-01-12'),
  ('2026.1.17', '老照片', '大大布', false, '2026-01-17'),
  ('2026.1.25', '打电话', '大大布', false, '2026-01-25'),
  ('2026.3.3', '又见面', '大大布', false, '2026-03-03'),
  ('2026.3.4', '配锁', '大大布', false, '2026-03-04'),
  ('2026.3.21', '漂亮的字', '大大布', false, '2026-03-21'),
  ('2026.3.24', '摆鬼脸', '大大布', false, '2026-03-24'),
  ('2026.4.3', '小挂件', '大大布', false, '2026-04-03'),
  ('2026.4.6', '好嫩', '大大布', false, '2026-04-06'),
  ('2026.4.19', '熊出没', '大大布', false, '2026-04-19'),
  ('2026.4.21', '漂亮合照', '大大布', false, '2026-04-21'),
  ('2026.5.1', '宝宝来新余', '大大布', false, '2026-05-01')
on conflict (folder) do update
set title = excluded.title,
    memory_date = excluded.memory_date,
    author = coalesce(public.story_gallery_entries.author, excluded.author);

-- 4. 确保《小作文》（初始那一封信）的占位行存在
--    正文不进入仓库：do nothing 保证不会覆盖线上已有内容；
--    正文由 work/sync-private-letter.mjs 从 work/private/letter.txt 读入后写入。
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

-- 5. 确保 storage 桶策略允许成员上传、更新与管理 legacy 历史照片目录
drop policy if exists "Story members upload gallery files" on storage.objects;
create policy "Story members upload gallery files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'story-gallery'
  and public.is_story_member()
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Story members update gallery files" on storage.objects;
create policy "Story members update gallery files"
on storage.objects for update to authenticated
using (
  bucket_id = 'story-gallery'
  and public.is_story_member()
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'story-gallery'
  and public.is_story_member()
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Story members delete gallery files" on storage.objects;
create policy "Story members delete gallery files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'story-gallery'
  and public.is_story_member()
);

