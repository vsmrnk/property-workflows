-- run_documents для серверних скриптів із секретним ключем (service_role), як profiles, runs, run_tasks.
-- 20261118120000_document_records.sql видав права лише authenticated, а автогрантів немає: на локальному стеку
-- (e2e у CI) service_role не міг ні прочитати записи для перевірки UAT, ні прибрати записи синтетичних користувачів
-- (tests/e2e/support/admin.ts, OWNED_ROWS). Права anon і authenticated та політики RLS не змінюються.
grant select, insert, update, delete on table public.run_documents to service_role;
