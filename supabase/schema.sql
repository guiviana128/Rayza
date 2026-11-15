-- Execute uma vez no SQL Editor do seu projeto Supabase.
create extension if not exists pgcrypto;

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  title text not null check (length(trim(title)) between 1 and 120),
  starts_at timestamptz not null,
  category text not null default 'pessoal' check (category in ('pessoal','saude','estudo','encontro','outro')),
  location text not null default '' check (length(location)<=200),
  notes text not null default '' check (length(notes)<=2000),
  reminder_minutes integer not null default 15 check (reminder_minutes in (0,5,15,30,60,1440)),
  completed boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  title text not null check(length(trim(title)) between 1 and 120),
  taken_on date not null default current_date,
  caption text not null default '' check(length(caption)<=1000),
  photo_path text not null,
  favorite boolean not null default false,
  created_at timestamptz not null default now()
);
create function public.valid_exercises(exercises jsonb) returns boolean
language plpgsql immutable set search_path=public as $$
declare item jsonb; series numeric; rest_seconds numeric;
begin
  if jsonb_typeof(exercises) is distinct from 'array' then return false; end if;
  if jsonb_array_length(exercises) not between 1 and 30 then return false; end if;
  for item in select value from jsonb_array_elements(exercises) loop
    if jsonb_typeof(item) is distinct from 'object' then return false; end if;
    if jsonb_typeof(item->'name') is distinct from 'string' or length(trim(item->>'name')) not between 1 and 100 then return false; end if;
    if jsonb_typeof(item->'reps') is distinct from 'string' or length(trim(item->>'reps')) not between 1 and 30 then return false; end if;
    if jsonb_typeof(item->'weight') is distinct from 'string' or length(item->>'weight')>40 then return false; end if;
    if jsonb_typeof(item->'sets') is distinct from 'number' or jsonb_typeof(item->'rest') is distinct from 'number' then return false; end if;
    series := (item->>'sets')::numeric; rest_seconds := (item->>'rest')::numeric;
    if series<1 or series>100 or series<>trunc(series) or rest_seconds<0 or rest_seconds>3600 or rest_seconds<>trunc(rest_seconds) then return false; end if;
  end loop;
  return true;
end $$;
create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  title text not null check(length(trim(title)) between 1 and 100),
  focus text not null default '' check(length(focus)<=100),
  days integer[] not null default '{}' check(days <@ array[0,1,2,3,4,5,6]),
  duration integer not null default 45 check(duration between 1 and 360),
  notes text not null default '' check(length(notes)<=2000),
  exercises jsonb not null check(public.valid_exercises(exercises)),
  created_at timestamptz not null default now()
);
create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  workout_id uuid not null references public.workouts on delete cascade,
  done_on date not null,
  unique(workout_id,done_on)
);
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  endpoint text not null unique check(length(endpoint)<4096 and endpoint like 'https://%'),
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.appointments enable row level security;
alter table public.memories enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_logs enable row level security;
alter table public.push_subscriptions enable row level security;
create policy "own appointments" on public.appointments for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "own memories" on public.memories for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and split_part(photo_path,'/',1)=auth.uid()::text);
create policy "own workouts" on public.workouts for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "own workout logs" on public.workout_logs for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and exists(select 1 from public.workouts w where w.id=workout_id and w.user_id=auth.uid()));
create policy "own subscriptions" on public.push_subscriptions for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create index on public.appointments(user_id,starts_at);
create index on public.memories(user_id,taken_on);
create index on public.workouts(user_id);
create index on public.push_subscriptions(user_id);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('memories','memories',false,8388608,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy "own photos read" on storage.objects for select to authenticated using(bucket_id='memories' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "own photos insert" on storage.objects for insert to authenticated with check(bucket_id='memories' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "own photos delete" on storage.objects for delete to authenticated using(bucket_id='memories' and (storage.foldername(name))[1]=auth.uid()::text);

-- A fila só é acessível por service_role. Clientes não podem disparar notificações arbitrárias.
create table public.reminder_jobs (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  due_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null default 'pending' check(status in ('pending','processing','sent','cancelled','expired','failed')),
  attempts integer not null default 0,
  failures integer not null default 0,
  available_at timestamptz not null,
  locked_until timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
alter table public.reminder_jobs enable row level security;
create index reminder_due on public.reminder_jobs(status,available_at);
create table public.reminder_deliveries (
  job_id uuid references public.reminder_jobs on delete cascade,
  subscription_id uuid references public.push_subscriptions on delete cascade,
  sent_at timestamptz not null default now(),
  primary key(job_id,subscription_id)
);
alter table public.reminder_deliveries enable row level security;

create function public.enqueue_reminder() returns trigger language plpgsql security definer set search_path=public as $$
declare due timestamptz;
begin
  if TG_OP='UPDATE' and (new.title,new.starts_at,new.reminder_minutes,new.completed,new.location) is not distinct from (old.title,old.starts_at,old.reminder_minutes,old.completed,old.location) then return new; end if;
  update public.reminder_jobs set status='cancelled' where appointment_id=new.id and status in ('pending','processing');
  if not new.completed and new.starts_at>now() then
    due := new.starts_at-make_interval(mins=>new.reminder_minutes);
    insert into public.reminder_jobs(appointment_id,user_id,due_at,available_at,expires_at)
    values(new.id,new.user_id,due,greatest(due,now()),new.starts_at+interval '1 hour');
  end if;
  return new;
end $$;
create trigger appointment_reminder after insert or update on public.appointments for each row execute function public.enqueue_reminder();
revoke all on function public.enqueue_reminder() from public,anon,authenticated;

create function public.claim_reminder_jobs(batch_size integer default 20) returns setof public.reminder_jobs
language plpgsql security definer set search_path=public as $$
begin
  update public.reminder_jobs set status='expired' where status in ('pending','processing') and expires_at<now();
  update public.reminder_jobs set status='failed' where failures>=5 and status='processing' and locked_until<now();
  return query
  with picked as (
    select id from public.reminder_jobs
    where failures<5 and expires_at>now() and available_at<=now()
    and (status='pending' or (status='processing' and locked_until<now()))
    order by due_at limit least(greatest(batch_size,1),20) for update skip locked
  )
  update public.reminder_jobs j set status='processing',attempts=j.attempts+1,locked_until=now()+interval '2 minutes'
  from picked where j.id=picked.id returning j.*;
end $$;
revoke all on function public.claim_reminder_jobs(integer) from public,anon,authenticated;
grant execute on function public.claim_reminder_jobs(integer) to service_role;
