-- Сид-дані проєкту. Застосовується:
--   локально — під час `supabase db reset` (потрібен Docker);
--   у хмарі — лише з `supabase db push --include-seed` (звичайний db push сид не виконує).
--
-- Правила:
--   * лише синтетичні дані, email-и тільки *@example.test;
--   * файл має бути ІДЕМПОТЕНТНИМ: повторний запуск нічого не дублює
--     (insert ... on conflict do nothing / do update);
--   * користувачів Auth (auth.users) тут НЕ створюємо: їх створює
--     scripts/create-demo-users.mjs через Admin API (npm run users:demo)
--     за списком supabase/demo-users.json, а тригер on_auth_user_created додає профілі.
--
-- Приклад для довідкової таблиці, коли вона з'явиться у вашій міграції:
--   insert into public.departments (code, name)
--   values ('MATH', 'Кафедра математики'), ('LANG', 'Кафедра мов')
--   on conflict (code) do update set name = excluded.name;

-- ── Шаблони процесів (design.md impl-run-launch, D2) ────────────────────────
-- Шаблони в першому зрізі — початкові дані: екран редагування поза зрізом (власне припущення в add-run-launch).
-- «Tenant move-in» — 2 секції, 5 задач, 3 обов'язкові (як у AC-RUN-01).
insert into public.templates (id, name) values
  ('10000000-0000-0000-0000-000000000001', 'Tenant move-in'),
  ('10000000-0000-0000-0000-000000000002', 'Maintenance request')
on conflict (id) do update set name = excluded.name;

insert into public.template_sections (id, template_id, name, position) values
  ('20000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', 'Before move-in', 1),
  ('20000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000001', 'Move-in day', 2),
  ('20000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000002', 'Intake', 1),
  ('20000000-0000-0000-0000-000000000022', '10000000-0000-0000-0000-000000000002', 'Repair', 2)
on conflict (id) do update set name = excluded.name, position = excluded.position;

insert into public.template_tasks (id, template_id, section_id, name, required, position) values
  ('30000000-0000-0000-0000-000000000111', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000011', 'Inspect the unit', true, 1),
  ('30000000-0000-0000-0000-000000000112', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000011', 'Prepare the lease', true, 2),
  ('30000000-0000-0000-0000-000000000113', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000011', 'Order cleaning', false, 3),
  ('30000000-0000-0000-0000-000000000121', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000012', 'Hand over the keys', true, 1),
  ('30000000-0000-0000-0000-000000000122', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000012', 'Record meter readings', false, 2),
  ('30000000-0000-0000-0000-000000000211', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000021', 'Register the request', true, 1),
  ('30000000-0000-0000-0000-000000000212', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000021', 'Contact the tenant', false, 2),
  ('30000000-0000-0000-0000-000000000221', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000022', 'Fix the issue', true, 1),
  ('30000000-0000-0000-0000-000000000222', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000022', 'Close the request', true, 2)
on conflict (id) do update
  set name = excluded.name, required = excluded.required, position = excluded.position, section_id = excluded.section_id;
