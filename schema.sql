-- ================================================
-- maleFOOTfantasy — Supabase Schema
-- Paste this into Supabase > SQL Editor > Run
-- ================================================

-- POSTS (published gallery)
create table posts (
  id          bigint generated always as identity primary key,
  title       text not null,
  type        text not null check (type in ('AI-Gen','Real','Video','AI-Video')),
  tags        text[] default '{}',
  likes       int default 0,
  archived    boolean default false,
  storage_path text,           -- path in Supabase Storage bucket
  created_at  timestamptz default now()
);

-- SUBMISSIONS (user-submitted content pending review)
create table submissions (
  id          bigint generated always as identity primary key,
  title       text not null,
  email       text not null,
  type        text not null check (type in ('AI-Gen','Real','Video','AI-Video')),
  tags        text[] default '{}',
  notes       text default '',
  status      text default 'pending' check (status in ('pending','approved','rejected')),
  archived    boolean default false,
  storage_path text,
  created_at  timestamptz default now()
);

-- ORDERS (paid custom generation requests)
create table orders (
  id          text primary key,             -- e.g. ORD-001
  email       text not null,
  package     text not null,
  price       int not null,
  request     text not null,
  notes       text default '',
  status      text default 'new' check (status in ('new','progress','delivered','refunded')),
  archived    boolean default false,
  ref_path    text,                         -- reference photo path in Storage
  created_at  timestamptz default now()
);

-- ── ROW LEVEL SECURITY ──────────────────────────
-- Public can insert submissions and orders (for the gallery site forms)
-- Only authenticated admin can read/update/delete everything

alter table posts       enable row level security;
alter table submissions enable row level security;
alter table orders      enable row level security;

-- Anyone can read published, non-archived posts
create policy "Public read posts"
  on posts for select
  using (archived = false);

-- Anyone can insert a submission
create policy "Public insert submissions"
  on submissions for insert
  with check (true);

-- Anyone can insert an order
create policy "Public insert orders"
  on orders for insert
  with check (true);

-- Authenticated users (your admin login) can do everything
create policy "Admin all posts"
  on posts for all
  using (auth.role() = 'authenticated');

create policy "Admin all submissions"
  on submissions for all
  using (auth.role() = 'authenticated');

create policy "Admin all orders"
  on orders for all
  using (auth.role() = 'authenticated');

-- ── STORAGE BUCKET ──────────────────────────────
-- Run this in SQL editor too, or create via the Storage UI:
-- Bucket name: media
-- Public: false (serve via signed URLs)
