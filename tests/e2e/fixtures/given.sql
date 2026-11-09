-- «Дано» UAT-специфікацій для одноразової бази в CI (e2e.yml): те саме, що людина готує в UI на проді
-- (docs/qa/uat/README.md) — «Tenant move-in» з версіями 1, 2 і 3 (поточна — 5 задач seed), новий шаблон «Repair» без
-- жодної версії.
-- Версію 1 шаблонам із supabase/seed.sql дають міграції, тож тут — одна зміна й збереження версії 2 від імені
-- admin@example.test через RLS і save_template_version, як дії редактора.
-- Лише для локального стеку Supabase в раннері; на проді не запускати.
begin;
select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 'admin@example.test'), true);
set local role authenticated;

insert into public.template_tasks (template_id, section_id, name, required, position)
values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000012', 'Sign handover act', false, 3);
select public.save_template_version('10000000-0000-0000-0000-000000000001');

-- Як на проді з 09.11: задачу прибрано й збережено версію 3 — знову 5 задач seed.sql («Дано» AC-VENDOR-01…07:
-- «Tenant move-in» з 5 задачами); версії 1 і 2 для AC-EDITOR-07 лишаються.
delete from public.template_tasks
where template_id = '10000000-0000-0000-0000-000000000001' and name = 'Sign handover act';
select public.save_template_version('10000000-0000-0000-0000-000000000001');

insert into public.templates (name) values ('Repair');
commit;
