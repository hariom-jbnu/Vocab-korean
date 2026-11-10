-- Progress sync for Vocab Korean.
--
-- The app is local-first: IndexedDB in the browser is the working copy, and
-- these tables hold a signed-in learner's copy so it can follow them to other
-- devices. Every row belongs to one user and is only visible to that user.
--
-- updated_at is the device time of the change and decides which copy wins.
-- synced_at is the server time of the last write and is the cursor devices
-- use to pull what changed since they last looked.

-- One row per word a learner has started: its FSRS memory state.
create table public.cards (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  word_id text not null check (char_length(word_id) between 1 and 100),
  due timestamptz not null,
  stability double precision not null,
  difficulty double precision not null,
  elapsed_days integer not null default 0,
  scheduled_days integer not null,
  learning_steps integer not null default 0,
  reps integer not null,
  lapses integer not null,
  state smallint not null check (state between 0 and 3),
  last_review timestamptz,
  updated_at timestamptz not null,
  synced_at timestamptz not null default now(),
  primary key (user_id, word_id)
);

create index cards_user_synced_at_idx on public.cards (user_id, synced_at, word_id);

-- Every answer, append-only. The id is made on the device, so the same answer
-- uploaded twice is stored once.
create table public.review_logs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id uuid not null,
  word_id text not null check (char_length(word_id) between 1 and 100),
  rating smallint not null check (rating between 1 and 4),
  state smallint not null check (state between 0 and 3),
  reviewed_at timestamptz not null,
  due timestamptz not null,
  stability double precision not null,
  difficulty double precision not null,
  scheduled_days integer not null,
  learning_steps integer not null default 0,
  duration_ms integer check (duration_ms >= 0),
  synced_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index review_logs_user_synced_at_idx on public.review_logs (user_id, synced_at, id);
create index review_logs_user_reviewed_at_idx on public.review_logs (user_id, reviewed_at);

-- Study settings shared across devices, and when progress was last reset so
-- other devices know to drop their copy.
create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default 'epoch',
  progress_reset_at timestamptz,
  synced_at timestamptz not null default now()
);

-- Stamp the server time on every write.
create function public.set_synced_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.synced_at := now();
  return new;
end;
$$;

create trigger cards_set_synced_at before insert or update on public.cards
  for each row execute function public.set_synced_at();
create trigger review_logs_set_synced_at before insert or update on public.review_logs
  for each row execute function public.set_synced_at();
create trigger user_settings_set_synced_at before insert or update on public.user_settings
  for each row execute function public.set_synced_at();

-- Row level security: signed-in learners see and change only their own rows.
alter table public.cards enable row level security;
alter table public.review_logs enable row level security;
alter table public.user_settings enable row level security;

create policy "Learners read their own cards" on public.cards
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Learners add their own cards" on public.cards
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Learners update their own cards" on public.cards
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Learners delete their own cards" on public.cards
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Learners read their own answers" on public.review_logs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Learners add their own answers" on public.review_logs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Learners delete their own answers" on public.review_logs
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Learners read their own settings" on public.user_settings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Learners add their own settings" on public.user_settings
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Learners update their own settings" on public.user_settings
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Visitors who are not signed in get nothing.
revoke all on table public.cards, public.review_logs, public.user_settings from anon;

-- Save cards, keeping whichever copy of each card changed last.
create function public.push_cards(rows jsonb)
returns integer
language sql
security invoker
set search_path = ''
as $$
  with incoming as (
    select *
    from jsonb_to_recordset(rows) as r (
      word_id text,
      due timestamptz,
      stability double precision,
      difficulty double precision,
      elapsed_days integer,
      scheduled_days integer,
      learning_steps integer,
      reps integer,
      lapses integer,
      state smallint,
      last_review timestamptz,
      updated_at timestamptz
    )
  ),
  written as (
    insert into public.cards as c (
      user_id, word_id, due, stability, difficulty, elapsed_days, scheduled_days,
      learning_steps, reps, lapses, state, last_review, updated_at
    )
    select
      auth.uid(), word_id, due, stability, difficulty, elapsed_days, scheduled_days,
      learning_steps, reps, lapses, state, last_review, updated_at
    from incoming
    on conflict (user_id, word_id) do update set
      due = excluded.due,
      stability = excluded.stability,
      difficulty = excluded.difficulty,
      elapsed_days = excluded.elapsed_days,
      scheduled_days = excluded.scheduled_days,
      learning_steps = excluded.learning_steps,
      reps = excluded.reps,
      lapses = excluded.lapses,
      state = excluded.state,
      last_review = excluded.last_review,
      updated_at = excluded.updated_at
    where c.updated_at < excluded.updated_at
    returning 1
  )
  select count(*)::integer from written;
$$;

-- Save settings unless another device saved newer ones.
create function public.push_settings(new_settings jsonb, changed_at timestamptz)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.user_settings as s (user_id, settings, updated_at)
  values (auth.uid(), new_settings, changed_at)
  on conflict (user_id) do update set
    settings = excluded.settings,
    updated_at = excluded.updated_at
  where s.updated_at < excluded.updated_at;
$$;

-- Delete all cards and answers and record the reset, so other devices drop
-- their copy the next time they sync. Returns the reset time.
create function public.reset_progress()
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  reset_at timestamptz := now();
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;
  delete from public.review_logs where user_id = uid;
  delete from public.cards where user_id = uid;
  insert into public.user_settings as s (user_id, progress_reset_at)
  values (uid, reset_at)
  on conflict (user_id) do update set progress_reset_at = excluded.progress_reset_at;
  return reset_at;
end;
$$;

-- Pull rows changed since a point, one page at a time. Paging on
-- (synced_at, key) never skips a row, even while another device writes.
create function public.pull_cards(since timestamptz, after_word text, max_rows integer default 1000)
returns setof public.cards
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from public.cards
  where user_id = (select auth.uid())
    and (synced_at, word_id) > (since, after_word)
  order by synced_at, word_id
  limit least(greatest(max_rows, 1), 1000);
$$;

create function public.pull_reviews(since timestamptz, after_id uuid, max_rows integer default 1000)
returns setof public.review_logs
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from public.review_logs
  where user_id = (select auth.uid())
    and (synced_at, id) > (since, after_id)
  order by synced_at, id
  limit least(greatest(max_rows, 1), 1000);
$$;

revoke execute on function
  public.push_cards(jsonb),
  public.push_settings(jsonb, timestamptz),
  public.reset_progress(),
  public.pull_cards(timestamptz, text, integer),
  public.pull_reviews(timestamptz, uuid, integer)
from public, anon;

grant execute on function
  public.push_cards(jsonb),
  public.push_settings(jsonb, timestamptz),
  public.reset_progress(),
  public.pull_cards(timestamptz, text, integer),
  public.pull_reviews(timestamptz, uuid, integer)
to authenticated;
