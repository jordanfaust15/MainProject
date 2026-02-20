-- Reentry: Supabase schema for session and capture persistence

create table if not exists sessions (
  id uuid primary key,
  project_id text not null,
  entry_time timestamptz not null,
  exit_time timestamptz,
  capture_id text,
  feedback_rating int,
  feedback_time timestamptz
);

create index if not exists idx_sessions_project_id on sessions (project_id);

create table if not exists captures (
  id uuid primary key,
  session_id uuid not null references sessions (id),
  type text not null check (type in ('quick', 'interrupt')),
  original_input text not null,
  context_elements jsonb not null,
  timestamp timestamptz not null
);

create index if not exists idx_captures_session_id on captures (session_id);

-- Permissive RLS policies for MVP (no auth)
alter table sessions enable row level security;
alter table captures enable row level security;

create policy "Allow all on sessions" on sessions for all using (true) with check (true);
create policy "Allow all on captures" on captures for all using (true) with check (true);
