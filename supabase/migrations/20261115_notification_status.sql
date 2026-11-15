-- Pode ser executado em um projeto existente. Não apaga dados.
create table if not exists public.reminder_runtime (
  id text primary key check(id='scheduler'),
  last_run_at timestamptz not null default now()
);
alter table public.reminder_runtime enable row level security;
revoke all on public.reminder_runtime from anon,authenticated;
grant all on public.reminder_runtime to service_role;
