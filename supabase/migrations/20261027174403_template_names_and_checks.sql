-- Уточнення зрізу 2 (openspec/specs/template-versions, AC-EDITOR-11…29): назва шаблону належить версії, перевірки
-- збереження, назва шаблону в рані, рани до появи версій.
-- Рішення: openspec/changes/impl-template-versions-2/design.md (D1–D7).

-- ── Нова назва шаблону — незбережена зміна (D1, AC-EDITOR-21, AC-EDITOR-29) ──
-- templates.name — назва поточної версії (для нового шаблону — назва зі створення). Перейменування в редакторі
-- пишеться сюди й переходить у templates.name лише під час збереження; таблицю бачить і змінює лише admin.
create table public.template_drafts (
  template_id uuid primary key references public.templates (id) on delete cascade,
  name        text not null check (char_length(name) <= 200)
);

comment on table public.template_drafts is 'Незбережена нова назва шаблону (частина незбережених змін); лише admin.';

alter table public.template_drafts enable row level security;
revoke all on table public.template_drafts from anon, authenticated;
grant select, insert, update, delete on table public.template_drafts to authenticated;
grant select, insert, update, delete on table public.template_drafts to service_role;

create policy template_drafts_select_admin on public.template_drafts
  for select to authenticated using ((select auth.uid()) is not null and (select private.current_app_role()) = 'admin');
create policy template_drafts_insert_admin on public.template_drafts
  for insert to authenticated with check ((select auth.uid()) is not null and (select private.current_app_role()) = 'admin');
create policy template_drafts_update_admin on public.template_drafts
  for update to authenticated
  using ((select auth.uid()) is not null and (select private.current_app_role()) = 'admin')
  with check ((select auth.uid()) is not null and (select private.current_app_role()) = 'admin');
create policy template_drafts_delete_admin on public.template_drafts
  for delete to authenticated using ((select auth.uid()) is not null and (select private.current_app_role()) = 'admin');

create trigger template_drafts_changed_insert_delete
  after insert or delete on public.template_drafts
  for each row execute function private.mark_template_changed();
create trigger template_drafts_changed_update
  after update on public.template_drafts
  for each row when (old is distinct from new) execute function private.mark_template_changed();

-- Назву поточної версії змінює лише функція збереження.
revoke update (name) on table public.templates from authenticated;

-- ── Унікальна назва без регістру й крайніх пробілів (D6, AC-EDITOR-23) ───
alter table public.templates drop constraint templates_name_key;
create unique index templates_name_unique on public.templates (lower(btrim(name)));

-- ── Порожня назва секції чи задачі лишається в незбережених змінах (D5, AC-EDITOR-20) ──
-- Відхиляє її збереження версії (NO_NAME), а не запис робочої копії.
alter table public.template_sections drop constraint template_sections_name_check;
alter table public.template_sections add constraint template_sections_name_check check (char_length(name) <= 200);
alter table public.template_tasks drop constraint template_tasks_name_check;
alter table public.template_tasks add constraint template_tasks_name_check check (char_length(name) <= 200);

-- ── Назва версії й назва шаблону в рані (D1, D2, AC-EDITOR-21, AC-EDITOR-22) ──
alter table public.template_versions add column name text;
update public.template_versions as v set name = tp.name from public.templates as tp where tp.id = v.template_id;
alter table public.template_versions alter column name set not null;
comment on column public.template_versions.name is 'Назва шаблону в цій версії.';

alter table public.runs add column template_name text;
update public.runs as r set template_name = tp.name from public.templates as tp where tp.id = r.template_id;
alter table public.runs alter column template_name set not null;
comment on column public.runs.template_name is 'Назва шаблону з версії, з якої запущено ран (AC-EDITOR-22).';

-- ── Рани до появи версій — «Template version 1» (D3, AC-EDITOR-27) ──────
-- Припущення PM (#33): шаблони, що існували до зрізу, стали версією 1; рани, запущені до появи версій, показують її.
update public.runs set template_version = 1 where template_version is null;

-- ── Збереження з перевірками (D4, AC-EDITOR-12, 15, 20, 21, 24) ─────────
-- Коди помилок (message) за порядком перевірок: NOT_AUTHENTICATED, NOT_ALLOWED, TEMPLATE_NOT_FOUND, NO_CHANGES,
-- NO_NAME, EMPTY_SECTION, NO_REQUIRED_TASK, DUPLICATE_NAME.
create or replace function private.save_template_version(p_template_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_template public.templates%rowtype;
  v_name text;
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

  v_name := btrim(coalesce((select d.name from public.template_drafts as d where d.template_id = p_template_id), v_template.name));
  if v_name = ''
    or exists (select 1 from public.template_sections as s where s.template_id = p_template_id and btrim(s.name) = '')
    or exists (select 1 from public.template_tasks as t where t.template_id = p_template_id and btrim(t.name) = '')
  then
    raise exception 'NO_NAME' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.template_sections as s
    where s.template_id = p_template_id
      and not exists (
        select 1 from public.template_tasks as t where t.template_id = p_template_id and t.section_id = s.id
      )
  ) then
    raise exception 'EMPTY_SECTION' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.template_tasks as t where t.template_id = p_template_id and t.required
  ) then
    raise exception 'NO_REQUIRED_TASK' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.templates as tp
    where tp.id <> p_template_id and lower(btrim(tp.name)) = lower(v_name)
  ) then
    raise exception 'DUPLICATE_NAME' using errcode = 'P0001';
  end if;

  v_number := coalesce(v_template.current_version, 0) + 1;
  v_snapshot := private.template_snapshot(p_template_id);

  insert into public.template_versions (template_id, number, sections, name, created_by)
  values (p_template_id, v_number, v_snapshot, v_name, v_uid);

  -- Чернетку назви прибираємо до оновлення позначки: її тригер знову ставить «Unpublished changes».
  delete from public.template_drafts where template_id = p_template_id;

  update public.templates
  set name = v_name, current_version = v_number, published_sections = v_snapshot, has_unpublished_changes = false
  where id = p_template_id;

  return v_number;
end;
$$;

-- ── Запуск: назва шаблону з версії (D2, AC-EDITOR-22) ───────────────────
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
  -- Виконавець — лише менеджер чи адміністратор.
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
