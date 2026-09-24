-- Run in Supabase SQL Editor after memory-sync.sql and before deploying the gallery editor.
-- Existing photos stay in the static site; these rows override or hide them.

create table if not exists public.story_gallery_entries (
  folder text primary key check (folder ~ '^20[0-9]{2}[.][0-9]{1,2}[.][0-9]{1,2}$'),
  title text not null check (char_length(title) between 1 and 80),
  body text not null default '' check (char_length(body) <= 2000),
  hidden boolean not null default false
);

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

revoke all on public.story_gallery_entries, public.story_gallery_photos from anon, authenticated;
grant select on public.story_gallery_entries, public.story_gallery_photos to anon, authenticated;
grant insert, update, delete on public.story_gallery_entries, public.story_gallery_photos to authenticated;
alter table public.story_gallery_entries enable row level security;
alter table public.story_gallery_photos enable row level security;

drop policy if exists "Anyone reads displayed gallery entries" on public.story_gallery_entries;
create policy "Anyone reads displayed gallery entries"
on public.story_gallery_entries for select to anon, authenticated using (true);
drop policy if exists "Story members manage gallery entries" on public.story_gallery_entries;
drop policy if exists "Story members add gallery entries" on public.story_gallery_entries;
create policy "Story members add gallery entries"
on public.story_gallery_entries for insert to authenticated
with check (public.is_story_member());
drop policy if exists "Story members edit gallery entries" on public.story_gallery_entries;
create policy "Story members edit gallery entries"
on public.story_gallery_entries for update to authenticated
using (public.is_story_member()) with check (public.is_story_member());
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
with check (public.is_story_member());
drop policy if exists "Story members edit gallery photos" on public.story_gallery_photos;
create policy "Story members edit gallery photos"
on public.story_gallery_photos for update to authenticated
using (public.is_story_member()) with check (public.is_story_member());
drop policy if exists "Story members delete gallery photos" on public.story_gallery_photos;
create policy "Story members delete gallery photos"
on public.story_gallery_photos for delete to authenticated
using (public.is_story_member());

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
using (bucket_id = 'story-gallery' and public.is_story_member());
