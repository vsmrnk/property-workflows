-- Версії шаблонів (зріз 2, openspec/specs/template-versions, AC-EDITOR-*).
-- Рішення: openspec/changes/impl-template-versions/design.md (D1–D7).
--
-- template_sections і template_tasks стають РОБОЧОЮ КОПІЄЮ (незбережені зміни): бачить і змінює лише admin.
-- Збереження (private.save_template_version) робить незмінний знімок робочої копії в template_versions і копіює
-- його в templates.published_sections — поточна версія, яку бачать менеджери й з якої запускаються рани.
-- Записують версії й опубліковані поля лише функції private (security definer, search_path = ''); у authenticated
-- на template_versions — тільки SELECT (лише admin, AC-EDITOR-07), на templates — запис лише колонки name.

-- ── Поточна версія й позначка незбережених змін (D2) ────────────────────────
alter table public.templates
  add column current_version integer check (current_version is null or current_version >= 1),
  add column published_sections jsonb,
  add column has_unpublished_changes boolean not null default true;

comment on column public.templates.current_version is 'Номер поточної версії (glossary: Current version); null — шаблон ще не збережено.';
comment on column public.templates.published_sections is 'Знімок поточної версії: секції із задачами (id задач робочої копії на момент збереження).';
comment on column public.templates.has_unpublished_changes is 'Позначка «Unpublished changes»: робоча копія змінилась після останнього збереження.';

-- ── Версії (D3) ─────────────────────────────────────────────────────────────
create table public.template_versions (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates (id) on delete cascade,
  number      integer not null check (number >= 1),
  sections    jsonb not null,
  created_at  timestamptz not null default now(),
  -- Хто зберіг (email у списку версій, AC-EDITOR-05); null — версія 1 наявних даних, якщо адміністратора ще немає.
  created_by  uuid references public.profiles (id) on delete set null,
  constraint template_versions_number_unique unique (template_id, number)
);

comment on table public.template_versions is 'Збережена версія шаблону (glossary: Version) — незмінна; створює лише private.save_template_version.';

alter table public.template_versions enable row level security;
revoke all on table public.template_versions from anon, authenticated;
-- Лише читання (під RLS — лише admin). Ні insert, ні update, ні delete: версію створює функція, збережена версія не змінюється.
grant select on table public.template_versions to authenticated;
grant select, insert, update, delete on table public.template_versions to service_role;

create policy template_versions_select_admin on public.template_versions
  for select to authenticated using (true);

-- ── Версія рану (D5, AC-EDITOR-06) ──────────────────────────────────────────
alter table public.runs add column template_version integer check (template_version is null or template_version >= 1);
comment on column public.runs.template_version is 'Номер версії шаблону, з якої запущено ран («Template version N»).';

-- ── Права на шаблони (D1, D2) ───────────────────────────────────────────────
-- templates: запис лише назви; поточна версія, знімок і позначка змінюються тільки функціями. Видалення шаблону —
-- поза межами зрізу (#20), тож без GRANT delete.
revoke insert, update, delete on table public.templates from authenticated;
grant insert (name), update (name) on table public.templates to authenticated;

-- Менеджер бачить лише шаблони, збережені як версія (AC-EDITOR-02); admin — усі.
drop policy templates_select_all on public.templates;
create policy templates_select_visible on public.templates
  for select to authenticated
  using ((select private.current_app_role()) = 'admin' or current_version is not null);

-- Робоча копія — лише admin (AC-EDITOR-02, AC-EDITOR-08); insert/update/delete — лише admin, як і раніше.
drop policy template_sections_select_all on public.template_sections;
create policy template_sections_select_admin on public.template_sections
  for select to authenticated using ((select private.current_app_role()) = 'admin');

drop policy template_tasks_select_all on public.template_tasks;
create policy template_tasks_select_admin on public.template_tasks
  for select to authenticated using ((select private.current_app_role()) = 'admin');

-- ── Знімок робочої копії ────────────────────────────────────────────────────
-- [{ name, position, tasks: [{ id, name, required, position }] }] у порядку position.
create or replace function private.template_snapshot(p_template_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', s.name,
        'position', s.position,
        'tasks', coalesce((
          select jsonb_agg(
            jsonb_build_object('id', t.id, 'name', t.name, 'required', t.required, 'position', t.position)
            order by t.position, t.name
          )
          from public.template_tasks as t
          where t.section_id = s.id
        ), '[]'::jsonb)
      )
      order by s.position, s.name
    ),
    '[]'::jsonb
  )
  from public.template_sections as s
  where s.template_id = p_template_id;
$$;

revoke execute on function private.template_snapshot(uuid) from public, anon, authenticated;

-- ── Позначка «Unpublished changes» (D2, AC-EDITOR-01) ───────────────────────
-- Будь-яка зміна робочої копії ставить позначку; оновлення без змін (upsert тих самих значень) — ні.
create or replace function private.mark_template_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.templates as tp
  set has_unpublished_changes = true
  where tp.id = coalesce(new.template_id, old.template_id)
    and not tp.has_unpublished_changes;
  return null;
end;
$$;

revoke execute on function private.mark_template_changed() from public, anon, authenticated;

create trigger template_sections_changed_insert_delete
  after insert or delete on public.template_sections
  for each row execute function private.mark_template_changed();
create trigger template_sections_changed_update
  after update on public.template_sections
  for each row when (old is distinct from new) execute function private.mark_template_changed();
create trigger template_tasks_changed_insert_delete
  after insert or delete on public.template_tasks
  for each row execute function private.mark_template_changed();
create trigger template_tasks_changed_update
  after update on public.template_tasks
  for each row when (old is distinct from new) execute function private.mark_template_changed();

-- ── Збереження версії (D4, AC-EDITOR-03, AC-EDITOR-04, AC-EDITOR-08) ────────
-- Коди помилок (message): NOT_AUTHENTICATED, NOT_ALLOWED, TEMPLATE_NOT_FOUND, NO_CHANGES (Q3 #22, варіант A),
-- NO_REQUIRED_TASK («A template needs at least one required task»).
create or replace function private.save_template_version(p_template_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_template public.templates%rowtype;
  v_number integer;
  v_snapshot jsonb;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  -- Шаблони змінює й зберігає лише адміністратор (матриця прав; AC-EDITOR-08).
  if (select private.current_app_role()) is distinct from 'admin' then
    raise exception 'NOT_ALLOWED' using errcode = 'P0001';
  end if;

  select * into v_template from public.templates as tp where tp.id = p_template_id for update;
  if not found then
    raise exception 'TEMPLATE_NOT_FOUND' using errcode = 'P0001';
  end if;
  if not v_template.has_unpublished_changes then
    raise exception 'NO_CHANGES' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.template_tasks as t where t.template_id = p_template_id and t.required
  ) then
    raise exception 'NO_REQUIRED_TASK' using errcode = 'P0001';
  end if;

  v_number := coalesce(v_template.current_version, 0) + 1;
  v_snapshot := private.template_snapshot(p_template_id);

  insert into public.template_versions (template_id, number, sections, created_by)
  values (p_template_id, v_number, v_snapshot, v_uid);

  update public.templates
  set current_version = v_number, published_sections = v_snapshot, has_unpublished_changes = false
  where id = p_template_id;

  return v_number;
end;
$$;

create or replace function public.save_template_version(p_template_id uuid)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select private.save_template_version(p_template_id);
$$;

revoke execute on function private.save_template_version(uuid), public.save_template_version(uuid) from public, anon;
grant execute on function private.save_template_version(uuid), public.save_template_version(uuid) to authenticated;

-- ── Запуск із поточної версії (D5, AC-RUN-*, AC-EDITOR-06) ──────────────────
-- Задачі рану — зі знімка поточної версії; шаблон без версії не запускається (Q2 #21, варіант A).
-- Призначення до задач, яких немає в поточній версії, відкидаються (рішення PM solomchaak/property-workflows-spec#9);
-- ASSIGNEE_INVALID — лише для невалідного користувача. Назву кейсу обрізаємо від будь-яких пробільних символів —
-- як trim() у формі.
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
  v_run_id uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  -- Запускає шаблон лише менеджер або адміністратор (матриця прав, «Launch a template»).
  if not (select private.is_assignable(v_uid)) then
    raise exception 'NOT_ALLOWED' using errcode = 'P0001';
  end if;
  if v_name = '' then
    raise exception 'CASE_NAME_REQUIRED' using errcode = 'P0001';
  end if;
  if char_length(v_name) > 100 then
    raise exception 'CASE_NAME_TOO_LONG' using errcode = 'P0001';
  end if;

  select tp.published_sections, tp.current_version into v_sections, v_version
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
  -- Виконавець — лише менеджер чи адміністратор.
  if exists (
    select 1
    from jsonb_each_text(v_assignments) as a (task_id, user_id)
    where a.user_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or not (select private.is_assignable(a.user_id::uuid))
  ) then
    raise exception 'ASSIGNEE_INVALID' using errcode = 'P0001';
  end if;

  insert into public.runs (template_id, case_name, manager_id, template_version)
  values (p_template_id, v_name, v_uid, v_version)
  returning id into v_run_id;

  insert into public.run_tasks (run_id, section_name, section_position, name, required, position, assignee_id)
  select v_run_id, s ->> 'name', (s ->> 'position')::integer, t ->> 'name', (t ->> 'required')::boolean,
         (t ->> 'position')::integer, coalesce((v_assignments ->> (t ->> 'id'))::uuid, v_uid)
  from jsonb_array_elements(v_sections) as s, jsonb_array_elements(s -> 'tasks') as t;

  return v_run_id;
end;
$$;

-- ── Наявні дані: версія 1 (D6, власне припущення add-template-versions) ─────
insert into public.template_versions (template_id, number, sections, created_by, created_at)
select tp.id, 1, private.template_snapshot(tp.id),
       (select p.id from public.profiles as p where p.role = 'admin' order by p.created_at, p.id limit 1),
       tp.created_at
from public.templates as tp
where tp.current_version is null
  and exists (select 1 from public.template_tasks as t where t.template_id = tp.id and t.required);

update public.templates as tp
set current_version = v.number, published_sections = v.sections, has_unpublished_changes = false
from public.template_versions as v
where v.template_id = tp.id and v.number = 1 and tp.current_version is null;

update public.runs set template_version = 1 where template_version is null;
alter table public.runs alter column template_version set not null;
