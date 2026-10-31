-- «Дано» UAT-специфікацій для одноразової бази в CI (e2e.yml): те саме, що людина готує в UI на проді
-- (docs/qa/uat/README.md) — «Tenant move-in» з версіями 1 і 2, новий шаблон «Repair» без жодної версії.
-- Версію 1 шаблонам із supabase/seed.sql дають міграції, тож тут — одна зміна й збереження версії 2 від імені
-- admin@example.test через RLS і save_template_version, як дії редактора.
-- Лише для локального стеку Supabase в раннері; на проді не запускати.
begin;
select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 'admin@example.test'), true);
set local role authenticated;

insert into public.template_tasks (template_id, section_id, name, required, position)
values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000012', 'Sign handover act', false, 3);
select public.save_template_version('10000000-0000-0000-0000-000000000001');

insert into public.templates (name) values ('Repair');
commit;
