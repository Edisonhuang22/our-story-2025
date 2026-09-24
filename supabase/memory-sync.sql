-- Run this file once in Supabase: SQL Editor -> New query -> Run.
-- It limits shared-memory access to the two addresses below.

create or replace function public.story_member_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case lower(coalesce(auth.jwt() ->> 'email', ''))
    when '484784621@qq.com' then '大大怪'
    when '1014779580@qq.com' then '小小怪'
    else null
  end;
$$;

create or replace function public.is_story_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.story_member_role() is not null;
$$;

create table if not exists public.memory_perspectives (
  folder text not null check (folder ~ '^20[0-9]{2}[.][0-9]{1,2}[.][0-9]{1,2}$'),
  author text not null check (author in ('大大怪', '小小怪')),
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 2000),
  updated_at timestamptz not null default now(),
  primary key (folder, author)
);

create or replace function public.set_memory_perspective_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists memory_perspectives_updated_at on public.memory_perspectives;
create trigger memory_perspectives_updated_at
before update on public.memory_perspectives
for each row execute function public.set_memory_perspective_updated_at();

revoke all on public.memory_perspectives from anon;
grant select, insert, update on public.memory_perspectives to authenticated;
alter table public.memory_perspectives enable row level security;

drop policy if exists "Story members read memories" on public.memory_perspectives;
create policy "Story members read memories"
on public.memory_perspectives for select to authenticated
using (public.is_story_member());

drop policy if exists "Story members add only their memory" on public.memory_perspectives;
create policy "Story members add only their memory"
on public.memory_perspectives for insert to authenticated
with check (
  public.is_story_member()
  and author = public.story_member_role()
  and author_id = auth.uid()
);

drop policy if exists "Story members edit only their memory" on public.memory_perspectives;
create policy "Story members edit only their memory"
on public.memory_perspectives for update to authenticated
using (public.is_story_member() and author_id = auth.uid())
with check (
  public.is_story_member()
  and author = public.story_member_role()
  and author_id = auth.uid()
);

do $$
begin
  alter publication supabase_realtime add table public.memory_perspectives;
exception when duplicate_object then null;
end $$;

-- Shared mailbox. The original letter keeps a fixed row so that its attached
-- paper-letter photos can also be synchronized without duplicating its text.
create table if not exists public.story_letters (
  id uuid primary key,
  sender text not null check (sender in ('大大怪', '小小怪')),
  author_id uuid references auth.users(id) on delete cascade,
  date date not null,
  title text not null check (char_length(title) between 1 and 80),
  body text not null default '' check (char_length(body) <= 30000),
  memory text check (memory is null or memory ~ '^20[0-9]{2}[.][0-9]{1,2}[.][0-9]{1,2}$'),
  is_original boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((is_original and author_id is null) or (not is_original and author_id is not null))
);

insert into public.story_letters (id, sender, date, title, body, is_original)
values ('00000000-0000-0000-0000-000000000001', '大大怪', '2026-08-19', '小作文', '', true)
on conflict (id) do nothing;

create or replace function public.set_story_letter_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists story_letters_updated_at on public.story_letters;
create trigger story_letters_updated_at
before update on public.story_letters
for each row execute function public.set_story_letter_updated_at();

create table if not exists public.story_letter_photos (
  id uuid primary key,
  letter_id uuid not null references public.story_letters(id) on delete cascade,
  author text not null check (author in ('大大怪', '小小怪')),
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 255),
  storage_path text not null unique,
  sort_order integer not null default 0 check (sort_order >= 0 and sort_order <= 1000),
  created_at timestamptz not null default now()
);

revoke all on public.story_letters from anon;
revoke all on public.story_letter_photos from anon;
grant select, insert, update, delete on public.story_letters to authenticated;
grant select, insert, delete on public.story_letter_photos to authenticated;
alter table public.story_letters enable row level security;
alter table public.story_letter_photos enable row level security;

drop policy if exists "Story members read letters" on public.story_letters;
create policy "Story members read letters"
on public.story_letters for select to authenticated
using (public.is_story_member());

drop policy if exists "Story members add their letters" on public.story_letters;
create policy "Story members add their letters"
on public.story_letters for insert to authenticated
with check (
  public.is_story_member()
  and not is_original
  and sender = public.story_member_role()
  and author_id = auth.uid()
);

drop policy if exists "Story members edit their letters" on public.story_letters;
create policy "Story members edit their letters"
on public.story_letters for update to authenticated
using (public.is_story_member() and not is_original and author_id = auth.uid())
with check (
  public.is_story_member()
  and not is_original
  and sender = public.story_member_role()
  and author_id = auth.uid()
);

drop policy if exists "Story members delete their letters" on public.story_letters;
create policy "Story members delete their letters"
on public.story_letters for delete to authenticated
using (public.is_story_member() and not is_original and author_id = auth.uid());

drop policy if exists "Story members read letter photos" on public.story_letter_photos;
create policy "Story members read letter photos"
on public.story_letter_photos for select to authenticated
using (public.is_story_member());

drop policy if exists "Story members add their letter photos" on public.story_letter_photos;
create policy "Story members add their letter photos"
on public.story_letter_photos for insert to authenticated
with check (
  public.is_story_member()
  and author = public.story_member_role()
  and author_id = auth.uid()
  and exists (
    select 1
    from public.story_letters as letter
    where letter.id = letter_id
      and (letter.is_original or letter.author_id = auth.uid())
  )
);

drop policy if exists "Story members delete their letter photos" on public.story_letter_photos;
create policy "Story members delete their letter photos"
on public.story_letter_photos for delete to authenticated
using (public.is_story_member() and author_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('story-letter-photos', 'story-letter-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Story members read mailbox files" on storage.objects;
create policy "Story members read mailbox files"
on storage.objects for select to authenticated
using (bucket_id = 'story-letter-photos' and public.is_story_member());

drop policy if exists "Story members upload their mailbox files" on storage.objects;
create policy "Story members upload their mailbox files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'story-letter-photos'
  and public.is_story_member()
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Story members delete their mailbox files" on storage.objects;
create policy "Story members delete their mailbox files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'story-letter-photos'
  and public.is_story_member()
  and (storage.foldername(name))[1] = auth.uid()::text
);

do $$
begin
  alter publication supabase_realtime add table public.story_letters;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.story_letter_photos;
exception when duplicate_object then null;
end $$;
