-- Відповідь PM на Q3 (https://github.com/solomchaak/property-workflows-spec/issues/5): менеджер бачить інших
-- менеджерів і адміністраторів лише за email — без імен, ролей та інших даних профілю (AC-RUN-10, AC-TASK-11).
-- Замінює тимчасове рішення D8 (id, full_name, email). Тип результату змінюється, тож функції пересоздаємо.

drop function public.list_assignable_users();
drop function private.assignable_users();

create function private.assignable_users()
returns table (id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.email
  from public.profiles as p
  where p.role in ('manager', 'admin') and (select auth.uid()) is not null
  order by p.email;
$$;

create function public.list_assignable_users()
returns table (id uuid, email text)
language sql
stable
security invoker
set search_path = ''
as $$
  select u.id, u.email from private.assignable_users() as u;
$$;

revoke execute on function private.assignable_users(), public.list_assignable_users() from public, anon;
grant execute on function private.assignable_users(), public.list_assignable_users() to authenticated;
