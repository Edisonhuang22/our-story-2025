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

-- 4. 确保《小作文》（初始那一封信）已录入受保护的云端信箱表 story_letters
insert into public.story_letters (id, sender, date, title, body, is_original)
values (
  '00000000-0000-0000-0000-000000000001',
  '大大布',
  '2026-08-19',
  '小作文',
  '小小学妹陈玉荣

好久不见喔~

想不到最终还是被你找到这个入口了，果然小学妹还是聪明！距离上一次写信已经过去好久了，这段时间发生了不少事，特别是在假期我们总会有摩擦，但好在都能选择面对问题好好处理。七夕对你来说肯定还是很意外，虽然以前两个人都说过我们不过这种除了生日以外的节日但是真要到来时我还是会去想好好准备一番，不能以过不过节日来评判对方喜不喜欢，但你这小脑袋肯定会比我更敏感当在朋友圈在其他地方看到别人过七夕，怎么能让你羡慕其他人呢！买礼物你这个笨蛋肯定又想着找个时间“还”给我，索性我就换别的方式继续表达我的爱吼吼。

每次翻看刚认识那阵子的聊天记录、照片总会感觉很开心，那时候有不开心会直接告诉对方，我们都能体会到对方很强烈的爱意，所以不用去顾虑对方到底喜不喜欢而决定要不要说，后来相处的事情多啦总会有不理解的点，但最重要的还是要信任对方，即使不理解但是也选择信任这样也会很顺很顺哒。人因为顾虑而犹豫做一件事是很正常的，但是只要愿意去做并逐渐的改变那两个人一定是不会走散的。比如我不是很理解为什么能告诉同学朋友但是不能告诉爸妈，但是我相信你一定会告诉爸爸妈妈，所以这件事虽然不理解但是觉得一定会完成所以我就不会因为这种事而内耗而去怀疑我们之间的感情。然后！关于我们什么时候公开我想直接在我去找你的时候我们不避嫌，直接走一起吃一起玩一起！我适应了准备好后找个节日或是去某个地方玩我们就发朋友圈。

我有想好好在一起，两个人在一起时我也不会喜欢除你以外的其他女生或对其有意思有好感，更不会允许其他女生来刻意接近我，听见了吗！所以你要是吃醋要是怀疑要是不高兴你不要觉得“反正我说了也没用，都是你说‘陈玉荣你该怎么怎么做’”而是要跟我说出来，尽管问题很尖锐但说出来后其实很小，因为我们都喜欢对方啊，当然能够明白对方为什么吃醋而且也愿意去哄，就比如那次我们即使说完了，但是到了第二天我又因为你期末考后吃饭那件事不开心，我觉得我还有话想说，虽然这种两性问题很尖锐但是重点就在于说出来这一瞬间，说出来后其实对方都能领会哒。所以以后不要有说了没用这种想法喔，我也有很多既是优点又是缺点的地方，但我一定是喜欢你的，我会好好改，我们都要好好说话不要把对方越推越远。即使吵得很凶很凶！但是也不要缩小对方之前的好放大对方的不好。

讲到这里也差不多该结束啦，以后还有很长很长一起陪伴的日子，我们要好好哒，大胆把爱告诉对方、相信对方。这是我第一次做网站，做的还很粗糙，特别是图片要加载好久好久，以及这些排版也没达到我真正想要体现的样子，以后一点一点继续优化~

纸短情长，不尽依依

——皇叔皇叔',
  true
)
on conflict (id) do update
set body = excluded.body,
    sender = excluded.sender,
    date = excluded.date,
    title = excluded.title;

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

