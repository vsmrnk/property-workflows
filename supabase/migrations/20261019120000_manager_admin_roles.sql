-- Ролі продукту: manager і admin (requirements/product.md, «Користувачі й ролі») замість member/admin шаблону.
-- Порядок — як у заголовку 20261012000000_profiles_and_roles.sql:
-- старий constraint → дані → default → новий constraint.
-- AC: AC-RUN-05, AC-RUN-06, AC-TASK-07 (design.md impl-run-launch, D1).

alter table public.profiles drop constraint profiles_role_check;

update public.profiles set role = 'manager' where role = 'member';

alter table public.profiles alter column role set default 'manager';

alter table public.profiles add constraint profiles_role_check
  check (role in ('manager', 'admin'));
