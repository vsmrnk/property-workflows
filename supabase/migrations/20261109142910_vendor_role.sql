-- Зріз 3: роль вендора (openspec/specs/vendor-access/spec.md, AC-VENDOR-01…10).
-- Рішення: openspec/changes/impl-vendor-access/design.md (D1–D7). Межа — у базі: кожне правило матриці прав для
-- вендора діє й для прямого запиту до PostgREST, сторінки лише показують те, що віддала база.

-- ── D1. Роль vendor ─────────────────────────────────────────────────────────
-- Порядок — як у заголовку 20261012000000_profiles_and_roles.sql: старий constraint → дані → default → новий constraint.
-- Дані не змінюються (жодна наявна роль не стає вендором); default лишається 'manager'.
-- РИЗИК: між drop і add роль не перевіряється; міграція — одна транзакція (db-deploy), інші сесії цього стану не бачать.
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles alter column role set default 'manager';
alter table public.profiles add constraint profiles_role_check
  check (role in ('manager', 'admin', 'vendor'));

-- ── D2. Хто запускає і хто виконує — окремі правила ─────────────────────────
-- Запускає шаблон лише менеджер чи адміністратор (матриця: «Launch a template» — вендору «—», AC-VENDOR-09).
create or replace function private.can_launch(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles as p where p.id = p_user_id and p.role in ('manager', 'admin'));
$$;

-- Виконавцем може бути менеджер, адміністратор або вендор (глосарій «Assignee», AC-VENDOR-01).
create or replace function private.is_assignable(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles as p where p.id = p_user_id and p.role in ('manager', 'admin', 'vendor')
  );
$$;

revoke execute on function private.can_launch(uuid) from public, anon;
grant execute on function private.can_launch(uuid) to authenticated;

-- Тіло — з 20261027174403_template_names_and_checks.sql; змінено лише перевірку запуску (is_assignable → can_launch).
create or replace function private.launch_run(
  p_template_id uuid,
  p_case_name text,
  p_assignments jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := regexp_replace(coalesce(p_case_name, ''), '^\s+|\s+$', '', 'g');
  v_assignments jsonb := coalesce(p_assignments, '{}'::jsonb);
  v_sections jsonb;
  v_version integer;
  v_template_name text;
  v_run_id uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  -- Запускає шаблон лише менеджер або адміністратор; вендор — NOT_ALLOWED до будь-якого запису (AC-VENDOR-09).
  if not (select private.can_launch(v_uid)) then
    raise exception 'NOT_ALLOWED' using errcode = 'P0001';
  end if;
  if v_name = '' then
    raise exception 'CASE_NAME_REQUIRED' using errcode = 'P0001';
  end if;
  if char_length(v_name) > 100 then
    raise exception 'CASE_NAME_TOO_LONG' using errcode = 'P0001';
  end if;

  -- Шаблон без збереженої версії не запускається (AC-EDITOR-11).
  select tp.published_sections, tp.current_version, tp.name into v_sections, v_version, v_template_name
  from public.templates as tp
  where tp.id = p_template_id;
  if v_version is null then
    raise exception 'TEMPLATE_NOT_FOUND' using errcode = 'P0001';
  end if;
  if jsonb_typeof(v_assignments) <> 'object' then
    raise exception 'ASSIGNEE_INVALID' using errcode = 'P0001';
  end if;

  -- Лише призначення до задач поточної версії.
  v_assignments := coalesce((
    select jsonb_object_agg(a.key, a.value)
    from jsonb_each_text(v_assignments) as a
    where exists (
      select 1
      from jsonb_array_elements(v_sections) as s, jsonb_array_elements(s -> 'tasks') as t
      where t ->> 'id' = a.key
    )
  ), '{}'::jsonb);
  -- Виконавець — менеджер, адміністратор або вендор (AC-VENDOR-01).
  if exists (
    select 1
    from jsonb_each_text(v_assignments) as a (task_id, user_id)
    where a.user_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or not (select private.is_assignable(a.user_id::uuid))
  ) then
    raise exception 'ASSIGNEE_INVALID' using errcode = 'P0001';
  end if;

  insert into public.runs (template_id, case_name, manager_id, template_version, template_name)
  values (p_template_id, v_name, v_uid, v_version, v_template_name)
  returning id into v_run_id;

  insert into public.run_tasks (run_id, section_name, section_position, name, required, position, assignee_id)
  select v_run_id, s ->> 'name', (s ->> 'position')::integer, t ->> 'name', (t ->> 'required')::boolean,
         (t ->> 'position')::integer, coalesce((v_assignments ->> (t ->> 'id'))::uuid, v_uid)
  from jsonb_array_elements(v_sections) as s, jsonb_array_elements(s -> 'tasks') as t;

  return v_run_id;
end;
$$;

-- ── D3. Email у виборі виконавця ────────────────────────────────────────────
-- Менеджери, адміністратори й вендори — лише id і email (AC-VENDOR-02); бачать їх лише менеджер і адміністратор.
-- Вендору — порожньо: «See the email of other users» — «—» (AC-VENDOR-04).
create or replace function private.assignable_users()
returns table (id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.email
  from public.profiles as p
  where p.role in ('manager', 'admin', 'vendor')
    and (select private.current_app_role()) in ('manager', 'admin')
  order by p.email;
$$;

-- ── D4. Рани й задачі для вендора ───────────────────────────────────────────
-- Вендор не бачить рядків runs напряму (manager_id, template_name, template_version — «—» у матриці), а
-- run_tasks_select_visible (assignee_id = auth.uid() or can_see_run) віддає йому лише його задачі
-- (AC-VENDOR-03, AC-VENDOR-04, AC-VENDOR-06). Для manager і admin вираз той самий, що й раніше (AC-TASK-06).
create or replace function private.can_see_run(p_run_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.current_app_role()) = 'admin'
    or (
      (select private.current_app_role()) = 'manager'
      and (
        exists (select 1 from public.runs as r where r.id = p_run_id and r.manager_id = (select auth.uid()))
        or exists (
          select 1 from public.run_tasks as t where t.run_id = p_run_id and t.assignee_id = (select auth.uid())
        )
      )
    );
$$;

-- ── D5. Що вендор бачить про ран ────────────────────────────────────────────
-- Рани вендора: назва кейсу, статус рану й «Your tasks: N of K done» — лише його задачі (AC-VENDOR-03, AC-VENDOR-10).
-- Для інших ролей — порожньо (у них свій список через RLS).
create or replace function private.vendor_runs()
returns table (id uuid, case_name text, status text, created_at timestamptz, my_done integer, my_total integer)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.case_name, r.status, r.created_at,
         count(*) filter (where t.status = 'done')::integer,
         count(*)::integer
  from public.runs as r
  join public.run_tasks as t on t.run_id = r.id and t.assignee_id = (select auth.uid())
  where (select private.current_app_role()) = 'vendor'
  group by r.id, r.case_name, r.status, r.created_at
  order by r.created_at desc;
$$;

-- Задачі вендора в рані: назва, секція, позначка й статус (AC-VENDOR-04). completes_run — задача обов'язкова, «to do»
-- і в рані не лишилось інших обов'язкових «to do»: тоді сторінка просить підтвердження «This cannot be undone»
-- (припущення PM); більше про прогрес рану воно не розкриває.
create or replace function private.vendor_run_tasks(p_run_id uuid)
returns table (
  id uuid, section_name text, section_position integer, name text, required boolean, "position" integer,
  status text, completes_run boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.section_name, t.section_position, t.name, t.required, t.position, t.status,
         t.required and t.status = 'to_do' and not exists (
           select 1 from public.run_tasks as o
           where o.run_id = t.run_id and o.id <> t.id and o.required and o.status <> 'done'
         )
  from public.run_tasks as t
  where t.run_id = p_run_id
    and t.assignee_id = (select auth.uid())
    and (select private.current_app_role()) = 'vendor'
  order by t.section_position, t.position;
$$;

create function public.vendor_runs()
returns table (id uuid, case_name text, status text, created_at timestamptz, my_done integer, my_total integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.vendor_runs();
$$;

create function public.vendor_run_tasks(p_run_id uuid)
returns table (
  id uuid, section_name text, section_position integer, name text, required boolean, "position" integer,
  status text, completes_run boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.vendor_run_tasks(p_run_id);
$$;

revoke execute on function private.vendor_runs(), private.vendor_run_tasks(uuid),
  public.vendor_runs(), public.vendor_run_tasks(uuid) from public, anon;
grant execute on function private.vendor_runs(), private.vendor_run_tasks(uuid),
  public.vendor_runs(), public.vendor_run_tasks(uuid) to authenticated;

-- ── D6. Шаблони ─────────────────────────────────────────────────────────────
-- admin — усі; manager — збережені як версія; vendor — жодного (AC-VENDOR-08).
drop policy templates_select_visible on public.templates;
create policy templates_select_visible on public.templates
  for select to authenticated
  using (
    (select private.current_app_role()) = 'admin'
    or ((select private.current_app_role()) = 'manager' and current_version is not null)
  );

-- D7. private.mark_task_done не змінюється: позначає виконавець, менеджер рану чи admin; вендор не буває менеджером
-- рану, тож позначає лише свої задачі (AC-VENDOR-05), чужа — NOT_ALLOWED (AC-VENDOR-07).
