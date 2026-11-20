-- Usernames for quick sign-in: type a short username and the password
-- instead of the whole email address (handy on shared computers).
--
-- Supabase Auth signs in with an email, so the app first asks
-- vocab_login_email for the email behind a username. It only answers when the
-- password is right, so a username never reveals anyone's email, and repeated
-- wrong passwords for a username are refused for 15 minutes.

-- One username per learner, lower case letters, digits, _ and -.
create table public.vocab_profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_-]{3,20}$'),
  updated_at timestamptz not null default now()
);

alter table public.vocab_profiles enable row level security;

create policy "Learners read their own profile" on public.vocab_profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Learners add their own profile" on public.vocab_profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Learners update their own profile" on public.vocab_profiles
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on table public.vocab_profiles from anon;

-- Wrong passwords given with a username, kept for a day to slow down guessing.
-- Only vocab_login_email reads and writes it.
create table public.vocab_login_attempts (
  username text not null,
  attempted_at timestamptz not null default now()
);

create index vocab_login_attempts_username_idx on public.vocab_login_attempts (username, attempted_at);

alter table public.vocab_login_attempts enable row level security;
revoke all on table public.vocab_login_attempts from anon, authenticated;

-- The email for a username, or null when the username or password is wrong.
create function public.vocab_login_email(login text, password text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  name text := lower(btrim(coalesce(login, '')));
  stored_hash text;
  mail text;
begin
  if name !~ '^[a-z0-9_-]{3,20}$' or coalesce(password, '') = '' then
    return null;
  end if;

  delete from public.vocab_login_attempts where attempted_at < now() - interval '1 day';
  if (
    select count(*) from public.vocab_login_attempts
    where username = name and attempted_at > now() - interval '15 minutes'
  ) >= 10 then
    raise exception 'too_many_attempts' using errcode = 'P0001';
  end if;

  select u.email, u.encrypted_password into mail, stored_hash
  from public.vocab_profiles p
  join auth.users u on u.id = p.user_id
  where p.username = name;

  if coalesce(stored_hash, '') = '' then
    -- Take as long as a real check, so timing does not tell which usernames exist.
    perform extensions.crypt(password, extensions.gen_salt('bf', 10));
  end if;
  if coalesce(stored_hash, '') = '' or extensions.crypt(password, stored_hash) <> stored_hash then
    insert into public.vocab_login_attempts (username) values (name);
    return null;
  end if;

  delete from public.vocab_login_attempts where username = name;
  return mail;
end;
$$;

revoke execute on function public.vocab_login_email(text, text) from public;
grant execute on function public.vocab_login_email(text, text) to anon, authenticated;
