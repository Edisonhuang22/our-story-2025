-- =========================================================================
-- 隐私防泄漏修复 SQL 脚本 (针对漏洞 1 和漏洞 3)
-- 使用方法：登录 Supabase 控制台 -> 进入 SQL Editor -> 粘贴本脚本全部内容 -> 点击 Run
-- =========================================================================

-- -------------------------------------------------------------------------
-- 修复漏洞 1：将《小作文》原文收录进受保护的云端信箱，彻底告别前端明文泄露
-- -------------------------------------------------------------------------

-- 确保原始小作文占位行存在，并将正文内容安全录入
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
