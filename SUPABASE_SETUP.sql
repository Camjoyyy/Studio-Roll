-- ═══════════════════════════════════════════════════════════════
-- STUDIO ROLL v3 — Run this ONCE in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- Step 1: Clean slate
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists handle_new_user() cascade;
drop function if exists my_role() cascade;
drop function if exists is_studio_member(uuid) cascade;
drop table if exists sessions cascade;
drop table if exists clients cascade;
drop table if exists studio_members cascade;
drop table if exists studios cascade;
drop table if exists user_profiles cascade;

-- Step 2: Tables
create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'instructor' check (role in ('admin','management','instructor')),
  created_at timestamptz default now()
);

create table studios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references auth.users(id) on delete set null,
  classes text[] default '{"Mat Pilates","Reformer","Barre","Core & Stretch","Beginners Pilates"}',
  created_at timestamptz default now()
);

create table studio_members (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid references studios(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  unique (studio_id, user_id)
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid references studios(id) on delete cascade,
  name text not null,
  created_at timestamptz default now(),
  unique (studio_id, name)
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid references studios(id) on delete cascade,
  date date not null,
  class_type text not null,
  attended text[] default '{}',
  created_at timestamptz default now()
);

-- Step 3: Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_profiles (id, email, role)
  values (new.id, new.email, 'instructor')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Step 4: Helper functions
create or replace function my_role()
returns text language sql security definer stable set search_path = public as $$
  select coalesce(
    (select role from public.user_profiles where id = auth.uid()),
    'instructor'
  )
$$;

create or replace function is_studio_member(sid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.studio_members
    where studio_id = sid and user_id = auth.uid()
  )
$$;

-- Step 5: Enable RLS
alter table user_profiles enable row level security;
alter table studios enable row level security;
alter table studio_members enable row level security;
alter table clients enable row level security;
alter table sessions enable row level security;

-- Step 6: Policies

-- user_profiles: open read, own write, trigger insert
create policy "profiles_select" on user_profiles for select using (true);
create policy "profiles_insert" on user_profiles for insert with check (true);
create policy "profiles_update" on user_profiles for update using (id = auth.uid());
create policy "profiles_delete" on user_profiles for delete using (my_role() = 'admin');

-- studios: full open access for authenticated users (role enforced in app)
create policy "studios_select" on studios for select using (auth.uid() is not null);
create policy "studios_insert" on studios for insert with check (auth.uid() is not null);
create policy "studios_update" on studios for update using (auth.uid() is not null);
create policy "studios_delete" on studios for delete using (auth.uid() is not null);

-- studio_members
create policy "members_select" on studio_members for select using (auth.uid() is not null);
create policy "members_insert" on studio_members for insert with check (auth.uid() is not null);
create policy "members_delete" on studio_members for delete using (auth.uid() is not null);

-- clients
create policy "clients_all" on clients for all using (auth.uid() is not null);

-- sessions
create policy "sessions_all" on sessions for all using (auth.uid() is not null);

