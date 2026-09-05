create table if not exists public.games (
  id uuid primary key,
  fen text not null,
  moves jsonb not null default '[]'::jsonb,
  status text not null default 'in_progress',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.games enable row level security;

create policy "Anyone can save games"
  on public.games for insert
  to anon
  with check (true);

create policy "Anyone can update games"
  on public.games for update
  to anon
  using (true)
  with check (true);