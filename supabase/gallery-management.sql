-- Run in Supabase SQL Editor after memory-sync.sql and before deploying the gallery editor.
-- Existing photos stay in the static site; these rows override or hide them.

create table if not exists public.story_gallery_entries (
  folder text primary key check (folder ~ '^20[0-9]{2}[.][0-9]{1,2}[.][0-9]{1,2}$'),
  title text not null check (char_length(title) between 1 and 80),
  body text not null default '' check (char_length(body) <= 2000),
  author text not null default '大大怪' check (author in ('大大怪', '小小怪')),
  hidden boolean not null default false
);

-- Keep the stable folder key when the displayed date changes.
alter table public.story_gallery_entries add column if not exists memory_date date;
update public.story_gallery_entries
set memory_date = to_date(folder, 'YYYY.MM.DD') where memory_date is null;

create table if not exists public.story_gallery_photos (
  id uuid primary key default gen_random_uuid(),
  folder text not null check (folder ~ '^20[0-9]{2}[.][0-9]{1,2}[.][0-9]{1,2}$'),
  static_src text,
  storage_path text unique,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  unique (folder, static_src),
  check ((static_src is null) <> (storage_path is null))
);

-- Existing online entries predate author tracking. For dates absent from the
-- original static gallery, the first uploaded photo identifies the creator.
-- Original dates retain 大大怪 attribution even if 小小怪 later added photos.
alter table public.story_gallery_entries add column if not exists author text;
update public.story_gallery_entries as entry
set author = case lower(u.email)
  when '1014779580@qq.com' then '小小怪'
  else '大大怪'
end
from (
  select distinct on (folder) folder, split_part(storage_path, '/', 1) as uploader_id
  from public.story_gallery_photos
  where storage_path is not null
  order by folder, created_at, id
) as first_photo
join auth.users as u on u.id::text = first_photo.uploader_id
where entry.folder = first_photo.folder and entry.author is null
  and entry.folder not in (
    '2025.11.19', '2025.12.1', '2025.12.4', '2025.12.6', '2025.12.12',
    '2025.12.13', '2025.12.16', '2025.12.21', '2025.12.22', '2025.12.24',
    '2025.12.25', '2025.12.28', '2025.12.30', '2025.12.31', '2026.1.6',
    '2026.1.7', '2026.1.11', '2026.1.12', '2026.1.17', '2026.1.25',
    '2026.3.3', '2026.3.4', '2026.3.21', '2026.3.24', '2026.4.3',
    '2026.4.6', '2026.4.19', '2026.4.21', '2026.5.1'
  );
update public.story_gallery_entries set author = '大大怪' where author is null;
alter table public.story_gallery_entries alter column author set default '大大怪';
alter table public.story_gallery_entries alter column author set not null;
do $$ begin
  alter table public.story_gallery_entries add constraint story_gallery_entries_author_check
    check (author in ('大大怪', '小小怪'));
exception when duplicate_object then null;
end $$;

revoke all on public.story_gallery_entries, public.story_gallery_photos from anon, authenticated;
grant select (folder, title, hidden, author, memory_date) on public.story_gallery_entries to anon;
grant select on public.story_gallery_entries to authenticated;
grant select on public.story_gallery_photos to anon, authenticated;
grant insert, update, delete on public.story_gallery_entries, public.story_gallery_photos to authenticated;
alter table public.story_gallery_entries enable row level security;
alter table public.story_gallery_photos enable row level security;

create or replace function public.can_edit_gallery_folder(p_folder text)
returns boolean
language sql
stable
set search_path = public
as $$
  select public.is_story_member();
$$;

drop policy if exists "Anyone reads displayed gallery entries" on public.story_gallery_entries;
create policy "Anyone reads displayed gallery entries"
on public.story_gallery_entries for select to anon, authenticated
using (auth.role() = 'anon' or public.is_story_member());
drop policy if exists "Story members manage gallery entries" on public.story_gallery_entries;
drop policy if exists "Story members add gallery entries" on public.story_gallery_entries;
create policy "Story members add gallery entries"
on public.story_gallery_entries for insert to authenticated
with check (public.is_story_member());
drop policy if exists "Story members edit gallery entries" on public.story_gallery_entries;
create policy "Story members edit gallery entries"
on public.story_gallery_entries for update to authenticated
using (public.is_story_member())
with check (public.is_story_member());
drop policy if exists "Story members delete gallery entries" on public.story_gallery_entries;
create policy "Story members delete gallery entries"
on public.story_gallery_entries for delete to authenticated
using (public.is_story_member());

drop policy if exists "Anyone reads displayed gallery photos" on public.story_gallery_photos;
create policy "Anyone reads displayed gallery photos"
on public.story_gallery_photos for select to anon, authenticated using (true);
drop policy if exists "Story members manage gallery photos" on public.story_gallery_photos;
drop policy if exists "Story members add gallery photos" on public.story_gallery_photos;
create policy "Story members add gallery photos"
on public.story_gallery_photos for insert to authenticated
with check (public.can_edit_gallery_folder(folder));
drop policy if exists "Story members edit gallery photos" on public.story_gallery_photos;
create policy "Story members edit gallery photos"
on public.story_gallery_photos for update to authenticated
using (public.can_edit_gallery_folder(folder))
with check (public.can_edit_gallery_folder(folder));
drop policy if exists "Story members delete gallery photos" on public.story_gallery_photos;
create policy "Story members delete gallery photos"
on public.story_gallery_photos for delete to authenticated
using (public.can_edit_gallery_folder(folder));

-- The current static photos are already public on GitHub Pages. Uploaded
-- gallery photos use the same viewing model; only the two members can write.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('story-gallery', 'story-gallery', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Story members read gallery files" on storage.objects;
create policy "Story members read gallery files"
on storage.objects for select to authenticated
using (bucket_id = 'story-gallery' and public.is_story_member());

drop policy if exists "Story members upload gallery files" on storage.objects;
create policy "Story members upload gallery files"
on storage.objects for insert to authenticated
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

-- Original prose is migrated separately and is kept out of the public repository.
