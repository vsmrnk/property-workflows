-- Кількість збережених версій шаблону — для списку шаблонів (посилання «Versions» лише там, де є історія).
-- Рахуємо на боці бази одним викликом rpc(), без вибірки всіх рядків template_versions на сторінку.

create or replace function public.template_version_count(p_template_id uuid)
returns integer
language sql
stable
security definer
as $$
  select count(*)::integer from public.template_versions where template_id = p_template_id;
$$;

revoke execute on function public.template_version_count(uuid) from public, anon;
grant execute on function public.template_version_count(uuid) to authenticated;
