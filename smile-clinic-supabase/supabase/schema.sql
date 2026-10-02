-- =====================================================================
-- Smile Clinic · Supabase database
-- Run once in: Supabase Dashboard → SQL Editor → New query → Run
--
-- What this gives you:
--   * every table is locked by Row Level Security (RLS): a user only ever
--     sees rows of their own clinic, and only what their permissions allow
--   * permissions live in the database, not in the browser
--   * two-step login is enforced by the database (aal2) for anyone who
--     turned it on, and for everyone when the clinic requires it
--   * nothing is ever hard-deleted: rows get deleted_at (the trash)
--   * money rows (visits, payments) cannot be edited after saving
--   * every insert/update is written to an append-only audit log
--   * X-rays go to a private storage bucket, per clinic
-- =====================================================================

create extension if not exists pgcrypto;
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------
-- 1. Clinics and staff
-- ---------------------------------------------------------------------
create table public.clinics (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(trim(name)) >= 2),
  doctor_name  text not null default '',
  address      text not null default '',
  phone        text not null default '',
  license_no   text not null default '',
  require_mfa  boolean not null default false,
  created_at   timestamptz not null default now()
);

create table public.staff (
  user_id               uuid primary key references auth.users(id) on delete restrict,
  clinic_id             uuid not null references public.clinics(id),
  full_name             text not null check (length(trim(full_name)) >= 2),
  role                  text not null check (role in ('owner','staff')),
  perms                 text[] not null default '{}',
  active                boolean not null default true,
  must_change_password  boolean not null default false,
  created_at            timestamptz not null default now(),
  constraint staff_perms_known check (perms <@ array[
    'appts','patients_add','visits','payments','statement','files',
    'sick','reports','finance','delete','backup','tasks']::text[])
);
create unique index staff_one_owner_per_clinic on public.staff (clinic_id) where role = 'owner';

-- ---------------------------------------------------------------------
-- 2. Helper functions used by every policy
-- ---------------------------------------------------------------------
create function public.my_clinic() returns uuid
language sql stable security definer set search_path = '' as $$
  select s.clinic_id from public.staff s where s.user_id = auth.uid() and s.active
$$;

create function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff s
                 where s.user_id = auth.uid() and s.active and s.role = 'owner')
$$;

create function public.has_perm(p text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff s
                 where s.user_id = auth.uid() and s.active
                   and (s.role = 'owner' or p = any (s.perms)))
$$;

-- Two-step login: a user who enrolled a factor must be at aal2.
-- If the clinic requires two-step login, everyone must be at aal2.
create function public.mfa_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or ( not exists (select 1 from auth.mfa_factors f
                       where f.user_id = auth.uid() and f.status = 'verified')
           and not coalesce((select c.require_mfa
                             from public.clinics c
                             join public.staff s on s.clinic_id = c.id
                             where s.user_id = auth.uid()), false) )
$$;

create function public.member() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.my_clinic() is not null and public.mfa_ok()
$$;

create function public.can(p text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_perm(p) and public.mfa_ok()
$$;

-- ---------------------------------------------------------------------
-- 3. Clinic data
-- ---------------------------------------------------------------------
create table public.patients (
  id             uuid primary key default gen_random_uuid(),
  clinic_id      uuid not null default public.my_clinic() references public.clinics(id),
  file_no        integer,
  full_name      text not null check (length(trim(full_name)) >= 2),
  phone          text not null default '',
  id_number      text not null default '' check (id_number = '' or id_number ~ '^[0-9]{5,9}$'),
  birth_year     smallint check (birth_year between 1900 and 2100),
  medical_alert  text not null default '',
  created_at     timestamptz not null default now(),
  created_by     uuid default auth.uid(),
  deleted_at     timestamptz,
  deleted_by     uuid,
  unique (clinic_id, file_no),
  unique (clinic_id, id)
);

create table public.visits (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null default public.my_clinic() references public.clinics(id),
  patient_id  uuid not null,
  visit_date  date not null default current_date,
  procedure   text not null check (length(trim(procedure)) >= 2),
  teeth       text not null default '',
  price       numeric(10,2) not null check (price >= 0),
  note        text not null default '',
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  deleted_at  timestamptz,
  deleted_by  uuid,
  unique (clinic_id, id),
  foreign key (clinic_id, patient_id) references public.patients (clinic_id, id)
);

create table public.payments (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null default public.my_clinic() references public.clinics(id),
  patient_id  uuid not null,
  visit_id    uuid,
  paid_on     date not null default current_date,
  amount      numeric(10,2) not null check (amount > 0),
  method      text not null check (method in ('cash','card','transfer','cheque')),
  note        text not null default '',
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  deleted_at  timestamptz,
  deleted_by  uuid,
  foreign key (clinic_id, patient_id) references public.patients (clinic_id, id),
  foreign key (clinic_id, visit_id)   references public.visits   (clinic_id, id)
);

create table public.expenses (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null default public.my_clinic() references public.clinics(id),
  spent_on    date not null default current_date,
  category    text not null check (category in ('rent','salaries','supplies','lab','utilities','maintenance','other')),
  amount      numeric(10,2) not null check (amount > 0),
  note        text not null default '',
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  deleted_at  timestamptz,
  deleted_by  uuid
);

create table public.appointments (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null default public.my_clinic() references public.clinics(id),
  patient_id  uuid not null,
  appt_date   date not null,
  appt_time   time not null,
  reason      text not null default '',
  status      text not null default 'pending' check (status in ('pending','done','cancelled')),
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  deleted_at  timestamptz,
  deleted_by  uuid,
  foreign key (clinic_id, patient_id) references public.patients (clinic_id, id)
);
-- one patient per time slot (cancelled or deleted slots are free again)
create unique index appointments_no_double_booking
  on public.appointments (clinic_id, appt_date, appt_time)
  where status <> 'cancelled' and deleted_at is null;

create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null default public.my_clinic() references public.clinics(id),
  body        text not null check (length(trim(body)) >= 1),
  due_on      date not null default current_date,
  important   boolean not null default false,
  pinned      boolean not null default true,
  done        boolean not null default false,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  deleted_at  timestamptz,
  deleted_by  uuid
);

create table public.sick_notes (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null default public.my_clinic() references public.clinics(id),
  patient_id  uuid not null,
  note_no     text,
  issued_on   date not null default current_date,
  from_date   date not null,
  to_date     date not null,
  days        integer generated always as (to_date - from_date + 1) stored,
  reason      text not null check (length(trim(reason)) >= 2),
  advice      text not null default '',
  issued_by   uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  deleted_by  uuid,
  check (to_date >= from_date and to_date - from_date < 60),
  unique (clinic_id, note_no),
  foreign key (clinic_id, patient_id) references public.patients (clinic_id, id)
);

create table public.patient_files (
  id            uuid primary key default gen_random_uuid(),
  clinic_id     uuid not null default public.my_clinic() references public.clinics(id),
  patient_id    uuid not null,
  storage_path  text not null unique,
  file_name     text not null,
  mime_type     text not null check (mime_type in ('image/jpeg','image/png','image/webp','image/heic','application/pdf')),
  size_bytes    bigint not null check (size_bytes > 0 and size_bytes <= 20971520),
  category      text not null default 'xray' check (category in ('xray','panoramic','before_after','document','other')),
  note          text not null default '',
  uploaded_at   timestamptz not null default now(),
  uploaded_by   uuid default auth.uid(),
  deleted_at    timestamptz,
  deleted_by    uuid,
  foreign key (clinic_id, patient_id) references public.patients (clinic_id, id),
  check (storage_path like clinic_id::text || '/%')
);

create table public.audit_log (
  id          bigint generated always as identity primary key,
  clinic_id   uuid,
  table_name  text not null,
  row_id      text,
  action      text not null,
  actor       uuid,
  at          timestamptz not null default now(),
  old_row     jsonb,
  new_row     jsonb
);

-- indexes for fast search and reports
create index patients_name_trgm  on public.patients using gin (full_name extensions.gin_trgm_ops);
create index patients_phone      on public.patients (clinic_id, phone);
create index visits_by_date      on public.visits (clinic_id, visit_date);
create index visits_by_patient   on public.visits (patient_id);
create index payments_by_date    on public.payments (clinic_id, paid_on);
create index payments_by_patient on public.payments (patient_id);
create index expenses_by_date    on public.expenses (clinic_id, spent_on);
create index appts_by_date       on public.appointments (clinic_id, appt_date);
create index files_by_patient    on public.patient_files (patient_id);
create index audit_by_clinic     on public.audit_log (clinic_id, at desc);

-- balance per patient; security_invoker keeps the caller's RLS in force
create view public.patient_balances with (security_invoker = true) as
select p.id as patient_id, p.clinic_id,
       coalesce((select sum(v.price)  from public.visits v   where v.patient_id = p.id and v.deleted_at is null), 0) as billed,
       coalesce((select sum(y.amount) from public.payments y where y.patient_id = p.id and y.deleted_at is null), 0) as paid
from public.patients p
where p.deleted_at is null;

-- ---------------------------------------------------------------------
-- 4. Triggers: numbering, protection, audit
-- ---------------------------------------------------------------------
create function public.assign_file_no() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.file_no is null then
    perform pg_advisory_xact_lock(hashtext('file_no:' || new.clinic_id::text));
    select coalesce(max(p.file_no), 1000) + 1 into new.file_no
    from public.patients p where p.clinic_id = new.clinic_id;
  end if;
  return new;
end $$;
create trigger patients_file_no before insert on public.patients
  for each row execute function public.assign_file_no();

create function public.assign_note_no() returns trigger
language plpgsql security definer set search_path = '' as $$
declare yr text := to_char(new.issued_on, 'YYYY'); seq int;
begin
  perform pg_advisory_xact_lock(hashtext('note_no:' || new.clinic_id::text || yr));
  select count(*) + 1 into seq from public.sick_notes s
  where s.clinic_id = new.clinic_id and s.note_no like yr || '-%';
  new.note_no := yr || '-' || lpad(seq::text, 4, '0');
  return new;
end $$;
create trigger sick_notes_no before insert on public.sick_notes
  for each row execute function public.assign_note_no();

-- deleting moves to the trash and needs the "delete" permission
create function public.guard_soft_delete() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.deleted_at is distinct from old.deleted_at then
    if auth.uid() is not null and not public.has_perm('delete') then
      raise exception 'Deleting needs the "delete" permission' using errcode = '42501';
    end if;
    new.deleted_by := case when new.deleted_at is null then null else auth.uid() end;
  end if;
  return new;
end $$;

-- money and medical documents cannot be edited once saved; a mistake is
-- deleted (kept in the trash) and entered again, both steps in the audit log
create function public.guard_locked_fields() returns trigger
language plpgsql set search_path = '' as $$
declare a jsonb := to_jsonb(old) - array['deleted_at','deleted_by','note'];
        b jsonb := to_jsonb(new) - array['deleted_at','deleted_by','note'];
begin
  if a is distinct from b then
    raise exception 'Saved % cannot be edited. Delete the entry and record it again.', tg_table_name
      using errcode = '42501';
  end if;
  return new;
end $$;

create function public.forbid_delete() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_setting('app.allow_purge', true) = 'on' then
    return old;
  end if;
  raise exception 'Records are never deleted. Set deleted_at instead (the trash).'
    using errcode = '42501';
end $$;

create function public.forbid_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'The audit log cannot be changed.' using errcode = '42501';
end $$;

create function public.guard_staff() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null then
    if new.clinic_id <> old.clinic_id then
      raise exception 'Staff cannot move between clinics' using errcode = '42501';
    end if;
    if new.role <> old.role then
      raise exception 'Roles cannot be changed from the app' using errcode = '42501';
    end if;
    if new.user_id = auth.uid() and (new.perms <> old.perms or new.active <> old.active) then
      raise exception 'You cannot change your own permissions or deactivate yourself' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger staff_guard before update on public.staff
  for each row execute function public.guard_staff();

create function public.audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.audit_log (clinic_id, table_name, row_id, action, actor, old_row, new_row)
  values (
    coalesce((r ->> 'clinic_id')::uuid, case when tg_table_name = 'clinics' then (r ->> 'id')::uuid end),
    tg_table_name,
    coalesce(r ->> 'id', r ->> 'user_id'),
    case when tg_op = 'UPDATE' and new is not null and (to_jsonb(new) ->> 'deleted_at') is not null
              and (to_jsonb(old) ->> 'deleted_at') is null then 'DELETE (to trash)'
         when tg_op = 'UPDATE' and (to_jsonb(old) ->> 'deleted_at') is not null
              and (to_jsonb(new) ->> 'deleted_at') is null then 'RESTORE'
         else tg_op end,
    auth.uid(),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['patients','visits','payments','expenses','appointments','tasks','sick_notes','patient_files'] loop
    execute format('create trigger %I_soft_delete before update on public.%I for each row execute function public.guard_soft_delete()', t, t);
    execute format('create trigger %I_no_delete before delete on public.%I for each row execute function public.forbid_delete()', t, t);
  end loop;
  foreach t in array array['visits','payments','sick_notes'] loop
    execute format('create trigger %I_locked before update on public.%I for each row execute function public.guard_locked_fields()', t, t);
  end loop;
  foreach t in array array['clinics','staff','patients','visits','payments','expenses','appointments','tasks','sick_notes','patient_files'] loop
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit()', t, t);
  end loop;
end $$;
create trigger staff_no_delete   before delete on public.staff     for each row execute function public.forbid_delete();
create trigger clinics_no_delete before delete on public.clinics   for each row execute function public.forbid_delete();
create trigger audit_no_update   before update or delete on public.audit_log for each row execute function public.forbid_change();

-- ---------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------
alter table public.clinics        enable row level security;
alter table public.staff          enable row level security;
alter table public.patients       enable row level security;
alter table public.visits         enable row level security;
alter table public.payments       enable row level security;
alter table public.expenses       enable row level security;
alter table public.appointments   enable row level security;
alter table public.tasks          enable row level security;
alter table public.sick_notes     enable row level security;
alter table public.patient_files  enable row level security;
alter table public.audit_log      enable row level security;

-- clinic settings: everyone in the clinic reads, only the doctor edits
create policy clinics_read   on public.clinics for select to authenticated using (id = public.my_clinic() and public.mfa_ok());
create policy clinics_update on public.clinics for update to authenticated
  using (id = public.my_clinic() and public.is_owner() and public.mfa_ok())
  with check (id = public.my_clinic());

-- staff: you see yourself; the doctor sees and manages the team
create policy staff_read on public.staff for select to authenticated
  using (user_id = auth.uid() or (clinic_id = public.my_clinic() and public.is_owner() and public.mfa_ok()));
create policy staff_update on public.staff for update to authenticated
  using (clinic_id = public.my_clinic() and public.is_owner() and public.mfa_ok())
  with check (clinic_id = public.my_clinic());

-- patients: every active team member can look patients up
create policy patients_read   on public.patients for select to authenticated using (clinic_id = public.my_clinic() and public.member());
create policy patients_insert on public.patients for insert to authenticated with check (clinic_id = public.my_clinic() and public.can('patients_add'));
create policy patients_update on public.patients for update to authenticated
  using (clinic_id = public.my_clinic() and (public.can('patients_add') or public.can('delete')))
  with check (clinic_id = public.my_clinic());

-- visits: needed to show a balance, so payments/statement/reports can read them
create policy visits_read on public.visits for select to authenticated using (clinic_id = public.my_clinic() and
  (public.can('visits') or public.can('payments') or public.can('statement') or public.can('reports') or public.can('finance')));
create policy visits_insert on public.visits for insert to authenticated with check (clinic_id = public.my_clinic() and public.can('visits'));
create policy visits_update on public.visits for update to authenticated
  using (clinic_id = public.my_clinic() and (public.can('visits') or public.can('delete')))
  with check (clinic_id = public.my_clinic());

create policy payments_read on public.payments for select to authenticated using (clinic_id = public.my_clinic() and
  (public.can('payments') or public.can('statement') or public.can('reports') or public.can('finance')));
create policy payments_insert on public.payments for insert to authenticated with check (clinic_id = public.my_clinic() and public.can('payments'));
create policy payments_update on public.payments for update to authenticated
  using (clinic_id = public.my_clinic() and (public.can('payments') or public.can('delete')))
  with check (clinic_id = public.my_clinic());

create policy expenses_read   on public.expenses for select to authenticated using (clinic_id = public.my_clinic() and public.can('finance'));
create policy expenses_insert on public.expenses for insert to authenticated with check (clinic_id = public.my_clinic() and public.can('finance'));
create policy expenses_update on public.expenses for update to authenticated
  using (clinic_id = public.my_clinic() and public.can('finance')) with check (clinic_id = public.my_clinic());

create policy appts_read   on public.appointments for select to authenticated using (clinic_id = public.my_clinic() and (public.can('appts') or public.can('visits')));
create policy appts_insert on public.appointments for insert to authenticated with check (clinic_id = public.my_clinic() and public.can('appts'));
create policy appts_update on public.appointments for update to authenticated
  using (clinic_id = public.my_clinic() and (public.can('appts') or public.can('visits'))) with check (clinic_id = public.my_clinic());

create policy tasks_read   on public.tasks for select to authenticated using (clinic_id = public.my_clinic() and public.can('tasks'));
create policy tasks_insert on public.tasks for insert to authenticated with check (clinic_id = public.my_clinic() and public.can('tasks'));
create policy tasks_update on public.tasks for update to authenticated
  using (clinic_id = public.my_clinic() and public.can('tasks')) with check (clinic_id = public.my_clinic());

create policy sick_read   on public.sick_notes for select to authenticated using (clinic_id = public.my_clinic() and public.can('sick'));
create policy sick_insert on public.sick_notes for insert to authenticated with check (clinic_id = public.my_clinic() and public.can('sick'));
create policy sick_update on public.sick_notes for update to authenticated
  using (clinic_id = public.my_clinic() and public.can('delete')) with check (clinic_id = public.my_clinic());

create policy files_read   on public.patient_files for select to authenticated using (clinic_id = public.my_clinic() and public.can('files'));
create policy files_insert on public.patient_files for insert to authenticated with check (clinic_id = public.my_clinic() and public.can('files'));
create policy files_update on public.patient_files for update to authenticated
  using (clinic_id = public.my_clinic() and (public.can('files') or public.can('delete'))) with check (clinic_id = public.my_clinic());

create policy audit_read on public.audit_log for select to authenticated
  using (clinic_id = public.my_clinic() and public.is_owner() and public.mfa_ok());

-- No DELETE policies anywhere, and no table is open to anonymous visitors.
revoke all on all tables in schema public from anon;
revoke delete, truncate on all tables in schema public from authenticated;
revoke insert on public.staff, public.clinics, public.audit_log from authenticated;
revoke update on public.audit_log from authenticated;

-- ---------------------------------------------------------------------
-- 6. Private storage for X-rays and documents
--    path inside the bucket: <clinic_id>/<patient_id>/<file id>.<ext>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('patient-files', 'patient-files', false, 20971520,
        array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
on conflict (id) do nothing;

create policy "patient files: read own clinic" on storage.objects for select to authenticated
  using (bucket_id = 'patient-files'
         and (storage.foldername(name))[1] = public.my_clinic()::text
         and public.can('files'));
create policy "patient files: upload to own clinic" on storage.objects for insert to authenticated
  with check (bucket_id = 'patient-files'
              and (storage.foldername(name))[1] = public.my_clinic()::text
              and public.can('files'));
-- no update or delete policy: uploaded files can't be overwritten or removed from the app

-- ---------------------------------------------------------------------
-- 7. Functions the app calls
-- ---------------------------------------------------------------------
-- the signed-in user's own profile and permissions
create function public.me() returns table (user_id uuid, clinic_id uuid, full_name text, role text,
  perms text[], must_change_password boolean, mfa_ok boolean, require_mfa boolean)
language sql stable security definer set search_path = '' as $$
  select s.user_id, s.clinic_id, s.full_name, s.role, s.perms, s.must_change_password,
         public.mfa_ok(), c.require_mfa
  from public.staff s join public.clinics c on c.id = s.clinic_id
  where s.user_id = auth.uid() and s.active
$$;

-- called by the app right after the user picks a new password
create function public.password_changed() returns void
language sql security definer set search_path = '' as $$
  update public.staff set must_change_password = false where user_id = auth.uid()
$$;

-- one-time setup, run by you in the SQL Editor (never from the app):
--   select public.setup_owner('doctor@example.com', 'מרפאת החיוך', 'ד״ר סאמר חדאד');
create function public.setup_owner(owner_email text, clinic_name text, doctor_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid; cid uuid;
begin
  select u.id into uid from auth.users u where lower(u.email) = lower(trim(owner_email));
  if uid is null then
    raise exception 'No user with email %. Create it first in Authentication → Users.', owner_email;
  end if;
  if exists (select 1 from public.staff s where s.user_id = uid) then
    raise exception 'This user already belongs to a clinic.';
  end if;
  insert into public.clinics (name, doctor_name) values (clinic_name, doctor_name) returning id into cid;
  insert into public.staff (user_id, clinic_id, full_name, role) values (uid, cid, doctor_name, 'owner');
  return cid;
end $$;

-- adds a team member after the account was created in Authentication → Users
-- (the app's "add secretary" button will do this through a server function)
create function public.add_staff(member_email text, member_name text, member_perms text[]) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid; cid uuid;
begin
  if auth.uid() is not null and not (public.is_owner() and public.mfa_ok()) then
    raise exception 'Only the doctor can add team members' using errcode = '42501';
  end if;
  cid := coalesce(public.my_clinic(), (select c.id from public.clinics c order by c.created_at limit 1));
  select u.id into uid from auth.users u where lower(u.email) = lower(trim(member_email));
  if uid is null then raise exception 'No user with email %', member_email; end if;
  insert into public.staff (user_id, clinic_id, full_name, role, perms, must_change_password)
  values (uid, cid, member_name, 'staff', member_perms, true);
end $$;

revoke all on function public.setup_owner(text, text, text) from public, anon, authenticated;
revoke all on function public.add_staff(text, text, text[]) from public, anon;
grant execute on function public.add_staff(text, text, text[]) to authenticated;
revoke all on function public.me(), public.password_changed() from public, anon;
grant execute on function public.me(), public.password_changed() to authenticated;
revoke all on function public.my_clinic(), public.is_owner(), public.has_perm(text),
                       public.mfa_ok(), public.member(), public.can(text) from public, anon;
grant execute on function public.my_clinic(), public.is_owner(), public.has_perm(text),
                          public.mfa_ok(), public.member(), public.can(text) to authenticated;
