-- Security tests for schema.sql. Run after supabase_stub.sql and schema.sql.
-- Every check prints PASS or raises an error that stops the run.
\set ON_ERROR_STOP on
create schema t;
grant usage on schema t to authenticated;

create function t.act(email text, aal text default 'aal1') returns void language plpgsql security definer as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where users.email = act.email), 'aal', aal, 'role', 'authenticated')::text, false);
end $$;
create function t.ok(label text, cond boolean) returns void language plpgsql as $$
begin
  if not cond then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;
create function t.denied(label text, stmt text) returns void language plpgsql as $$
begin
  begin execute stmt;
  exception when others then raise notice 'PASS: % (blocked: %)', label, sqlerrm; return; end;
  raise exception 'FAIL: % was allowed', label;
end $$;
create function t.no_rows(label text, stmt text) returns void language plpgsql as $$
declare n int;
begin
  begin execute stmt; get diagnostics n = row_count;
  exception when others then raise notice 'PASS: % (blocked: %)', label, sqlerrm; return; end;
  if n <> 0 then raise exception 'FAIL: % changed % rows', label, n; end if;
  raise notice 'PASS: % (no rows reachable)', label;
end $$;
create function t.cid(n text) returns uuid language sql security definer as $$ select id from public.clinics where name = n $$;
grant usage on schema t to anon;
grant execute on all functions in schema t to authenticated, anon;

-- people
insert into auth.users (email) values ('doctor@a.test'), ('reem@a.test'), ('nurse@a.test'), ('doctor@b.test');
select public.setup_owner('doctor@a.test', 'מרפאת החיוך', 'ד״ר סאמר');
select public.setup_owner('doctor@b.test', 'Other Clinic', 'Dr B');

set role authenticated;

-- ---- the doctor of clinic A works normally
select t.act('doctor@a.test');
select public.add_staff('reem@a.test', 'ריים', array['appts','patients_add','payments','tasks']);
select public.add_staff('nurse@a.test', 'אחות', array['visits']);
insert into public.patients (full_name, phone) values ('أحمد خليل', '053-1111111'), ('سمر عودة', '054-2222222');
select t.ok('file numbers start at 1001', (select array_agg(file_no order by file_no) from public.patients) = array[1001,1002]);
insert into public.visits (patient_id, procedure, price, teeth) select id, 'filling', 350, '36' from public.patients where file_no = 1001;
insert into public.payments (patient_id, visit_id, amount, method)
  select v.patient_id, v.id, 175, 'cash' from public.visits v;
select t.ok('balance = 175 owed', (select billed - paid from public.patient_balances b join public.patients p on p.id = b.patient_id where p.file_no = 1001) = 175);
insert into public.expenses (category, amount) values ('rent', 4500);
insert into public.sick_notes (patient_id, from_date, to_date, reason)
  select id, current_date, current_date + 2, 'extraction' from public.patients where file_no = 1001;
select t.ok('sick note numbered YYYY-0001 with 3 days',
  (select note_no = to_char(current_date,'YYYY') || '-0001' and days = 3 from public.sick_notes));
select t.ok('doctor sees audit log', (select count(*) from public.audit_log) > 0);

-- ---- money cannot be edited, nothing is hard-deleted
select t.denied('changing a saved price', $$update public.visits set price = 1 $$);
select t.denied('changing a saved payment', $$update public.payments set amount = 1 $$);
select t.denied('hard delete of a patient', $$delete from public.patients $$);
select t.denied('editing the audit log', $$update public.audit_log set action = 'x' $$);
update public.payments set deleted_at = now();
select t.ok('doctor can move a payment to the trash', (select deleted_by is not null from public.payments));
update public.payments set deleted_at = null;
select t.ok('and restore it', (select deleted_at is null and deleted_by is null from public.payments));
select t.ok('trash and restore recorded in audit log',
  (select count(*) from public.audit_log where table_name = 'payments' and action in ('DELETE (to trash)','RESTORE')) = 2);

-- ---- the receptionist sees only what she is allowed
select t.act('reem@a.test');
select t.ok('reception sees patients', (select count(*) from public.patients) = 2);
select t.ok('reception sees balances (has payments)', (select count(*) from public.payments) = 1);
select t.ok('reception does not see expenses', (select count(*) from public.expenses) = 0);
select t.ok('reception does not see sick notes', (select count(*) from public.sick_notes) = 0);
select t.ok('reception does not see the audit log', (select count(*) from public.audit_log) = 0);
select t.ok('reception sees only her own staff row', (select count(*) from public.staff) = 1);
insert into public.payments (patient_id, amount, method) select id, 100, 'card' from public.patients where file_no = 1001;
select t.denied('reception records a treatment', $$insert into public.visits (patient_id, procedure, price) select id, 'x-ray', 120 from public.patients limit 1$$);
select t.denied('reception deletes a payment', $$update public.payments set deleted_at = now()$$);
select t.no_rows('reception gives herself permissions', $$update public.staff set perms = array['finance'] where user_id = auth.uid()$$);
select t.denied('reception adds staff', $$select public.add_staff('nurse@a.test','x',array['finance'])$$);
select t.no_rows('reception edits clinic settings', $$update public.clinics set name = 'hacked'$$);
select t.ok('clinic settings unchanged by reception', (select count(*) from public.clinics where name = 'מרפאת החיוך') = 1);

-- ---- clinics are fully separated
select t.act('doctor@b.test');
select t.ok('other clinic sees no patients of clinic A', (select count(*) from public.patients) = 0);
select t.ok('other clinic sees no payments of clinic A', (select count(*) from public.payments) = 0);
select t.denied('other clinic writes into clinic A',
  $$insert into public.patients (clinic_id, full_name) values (t.cid('מרפאת החיוך'), 'intruder')$$);
select t.no_rows('other clinic edits clinic A patients', $$update public.patients set full_name = 'x' where clinic_id = t.cid('מרפאת החיוך')$$);

-- ---- two-step login is enforced by the database
reset role;
insert into auth.mfa_factors (user_id, status) select id, 'verified' from auth.users where email = 'doctor@a.test';
set role authenticated;
select t.act('doctor@a.test', 'aal1');
select t.ok('doctor with 2FA, password only: no data', (select count(*) from public.patients) = 0);
select t.act('doctor@a.test', 'aal2');
select t.ok('doctor with 2FA, after the code: data visible', (select count(*) from public.patients) = 2);
update public.clinics set require_mfa = true;
select t.act('reem@a.test', 'aal1');
select t.ok('clinic requires 2FA: reception without it sees nothing', (select count(*) from public.patients) = 0);
select t.ok('but can still read her own profile to set it up', (select count(*) from public.me()) = 1);
select t.act('doctor@a.test', 'aal2');
update public.clinics set require_mfa = false;

-- ---- deactivating a team member cuts access immediately
update public.staff set active = false where full_name = 'ריים';
select t.denied('doctor deactivates himself', $$update public.staff set active = false where user_id = auth.uid() returning 1$$);
select t.act('reem@a.test');
select t.ok('deactivated reception sees nothing', (select count(*) from public.patients) = 0);

-- ---- private X-ray storage
select t.act('doctor@a.test', 'aal2');
insert into storage.objects (bucket_id, name)
  select 'patient-files', c.id || '/' || p.id || '/xray.jpg' from public.clinics c, public.patients p where p.file_no = 1001;
select t.ok('doctor uploads into his clinic folder', (select count(*) from storage.objects) = 1);
select t.denied('upload into another clinic folder',
  $$insert into storage.objects (bucket_id, name) values ('patient-files', gen_random_uuid() || '/x/y.jpg')$$);
select t.act('nurse@a.test');
select t.ok('team member without "files" cannot list X-rays', (select count(*) from storage.objects) = 0);

-- ---- anonymous visitors get nothing
reset role;
set role anon;
select t.denied('anonymous reads patients', $$select count(*) from public.patients$$);
reset role;
\echo ALL TESTS PASSED
