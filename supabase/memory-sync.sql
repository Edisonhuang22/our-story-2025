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
