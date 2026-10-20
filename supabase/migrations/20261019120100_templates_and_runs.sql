-- Шаблони процесів і рани (перший зріз WS6).
-- Специфікація: openspec/specs/run-launch/spec.md (AC-RUN-*), openspec/specs/run-progress/spec.md (AC-TASK-*).
-- Рішення: openspec/changes/impl-run-launch/design.md (D2–D8).
--
-- Ран — КОПІЯ шаблону на момент запуску: run_tasks не посилаються на template_tasks, тож пізніші зміни шаблону
-- ран не змінюють (AC-RUN-02). Ран створює лише public.launch_run (одна транзакція), задачу позначає
-- лише public.mark_task_done; RLS і GRANT нижче не пускають в обхід них.

-- ── Таблиці шаблонів ────────────────────────────────────────────────────────
create table public.templates (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (char_length(btrim(name)) between 1 and 200),
  created_at timestamptz not null default now()
);

create table public.template_sections (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 200),
  position    integer not null default 0
);

create table public.template_tasks (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates (id) on delete cascade,
  section_id  uuid not null references public.template_sections (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 200),
  required    boolean not null default false,
  position    integer not null default 0
);

create index template_sections_template_idx on public.template_sections (template_id);
create index template_tasks_template_idx on public.template_tasks (template_id);
create index template_tasks_section_idx on public.template_tasks (section_id);

comment on table public.templates is 'Шаблон процесу (glossary: Template). Створює й змінює лише admin.';
comment on table public.template_tasks is 'Задача шаблону; required — обов''язкова (glossary: Required task).';

-- ── Таблиці ранів ───────────────────────────────────────────────────────────
create table public.runs (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references public.templates (id) on delete restrict,
  case_name    text not null,
  manager_id   uuid not null references public.profiles (id) on delete restrict,
  status       text not null default 'in_progress',
  created_at   timestamptz not null default now(),
  completed_at timestamptz,
  -- AC-RUN-03, AC-RUN-07: 1–100 символів після обрізання пробілів (останній рубіж; перевіряє й launch_run).
  constraint runs_case_name_check check (case_name = btrim(case_name) and char_length(case_name) between 1 and 100),
  constraint runs_status_check check (status in ('in_progress', 'completed'))
);

create table public.run_tasks (
  id               uuid primary key default gen_random_uuid(),
  run_id           uuid not null references public.runs (id) on delete cascade,
  section_name     text not null,
  section_position integer not null default 0,
  name             text not null,
  required         boolean not null,
  position         integer not null default 0,
  assignee_id      uuid not null references public.profiles (id) on delete restrict,
  status           text not null default 'to_do',
  done_at          timestamptz,
  done_by          uuid references public.profiles (id) on delete set null,
  constraint run_tasks_status_check check (status in ('to_do', 'done'))
);

create index runs_manager_idx on public.runs (manager_id);
create index run_tasks_run_idx on public.run_tasks (run_id);
create index run_tasks_assignee_idx on public.run_tasks (assignee_id);

comment on table public.runs is 'Ран (glossary: Run): запуск шаблону для кейсу. manager_id — менеджер рану (Run manager).';
comment on table public.run_tasks is 'Задача рану — копія задачі шаблону на момент запуску; assignee_id — виконавець.';

alter table public.templates enable row level security;
alter table public.template_sections enable row level security;
alter table public.template_tasks enable row level security;
alter table public.runs enable row level security;
alter table public.run_tasks enable row level security;

-- ── Права (GRANT) ───────────────────────────────────────────────────────────
revoke all on table public.templates, public.template_sections, public.template_tasks from anon, authenticated;
revoke all on table public.runs, public.run_tasks from anon, authenticated;

-- Шаблони: бачать усі автентифіковані, змінює admin (політики нижче).
grant select, insert, update, delete on table public.templates, public.template_sections, public.template_tasks
  to authenticated;
-- Рани: читання й вставка (лише через launch_run під політиками); статус рану змінює тригер.
grant select, insert on table public.runs to authenticated;
grant select, insert on table public.run_tasks to authenticated;
-- Задача рану: змінюється лише статус і хто/коли позначив (AC-TASK-01…03, 07).
grant update (status, done_at, done_by) on table public.run_tasks to authenticated;

grant select, insert, update, delete on table public.templates, public.template_sections, public.template_tasks,
  public.runs, public.run_tasks to service_role;

-- ── Хелпери (security definer у private, search_path = '') ──────────────────
-- Читають runs/run_tasks в обхід RLS, тож політики runs ↔ run_tasks не зациклюються (42P17).
create or replace function private.is_run_manager(p_run_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.runs as r where r.id = p_run_id and r.manager_id = (select auth.uid())
  );
$$;

-- AC-TASK-06: менеджер бачить ран, якщо він менеджер рану або виконавець хоча б однієї задачі; admin — усі.
create or replace function private.can_see_run(p_run_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.current_app_role()) = 'admin'
    or exists (select 1 from public.runs as r where r.id = p_run_id and r.manager_id = (select auth.uid()))
    or exists (
      select 1 from public.run_tasks as t where t.run_id = p_run_id and t.assignee_id = (select auth.uid())
    );
$$;

-- Виконавцем може бути лише менеджер або адміністратор (requirements/product.md, «Assignee»).
create or replace function private.is_assignable(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles as p where p.id = p_user_id and p.role in ('manager', 'admin'));
$$;

-- design.md D8 (тимчасово, питання Q3 — solomchaak/property-workflows-spec#5): для вибору й показу виконавця
-- менеджер бачить лише id, ім'я та email менеджерів і адміністраторів — без ролей та інших даних профілю.
create or replace function private.assignable_users()
returns table (id uuid, full_name text, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, p.email
  from public.profiles as p
  where p.role in ('manager', 'admin') and (select auth.uid()) is not null
  order by coalesce(p.full_name, p.email);
$$;

revoke execute on function private.is_run_manager(uuid), private.can_see_run(uuid), private.is_assignable(uuid),
  private.assignable_users() from public, anon;
grant execute on function private.is_run_manager(uuid), private.can_see_run(uuid), private.is_assignable(uuid),
  private.assignable_users() to authenticated;

-- ── Політики RLS ────────────────────────────────────────────────────────────
create policy templates_select_all on public.templates
  for select to authenticated using (true);
create policy templates_insert_admin on public.templates
  for insert to authenticated with check ((select private.current_app_role()) = 'admin');
create policy templates_update_admin on public.templates
  for update to authenticated
  using ((select private.current_app_role()) = 'admin')
  with check ((select private.current_app_role()) = 'admin');
create policy templates_delete_admin on public.templates
  for delete to authenticated using ((select private.current_app_role()) = 'admin');

create policy template_sections_select_all on public.template_sections
  for select to authenticated using (true);
create policy template_sections_insert_admin on public.template_sections
  for insert to authenticated with check ((select private.current_app_role()) = 'admin');
create policy template_sections_update_admin on public.template_sections
  for update to authenticated
  using ((select private.current_app_role()) = 'admin')
  with check ((select private.current_app_role()) = 'admin');
create policy template_sections_delete_admin on public.template_sections
  for delete to authenticated using ((select private.current_app_role()) = 'admin');

create policy template_tasks_select_all on public.template_tasks
  for select to authenticated using (true);
create policy template_tasks_insert_admin on public.template_tasks
  for insert to authenticated with check ((select private.current_app_role()) = 'admin');
create policy template_tasks_update_admin on public.template_tasks
  for update to authenticated
  using ((select private.current_app_role()) = 'admin')
  with check ((select private.current_app_role()) = 'admin');
create policy template_tasks_delete_admin on public.template_tasks
  for delete to authenticated using ((select private.current_app_role()) = 'admin');

-- AC-TASK-06: видимість рану.
-- Пряма умова manager_id потрібна й для INSERT … RETURNING у launch_run: STABLE-хелпер бачить знімок
-- на початок оператора, тож щойно вставленого рядка ще не знаходить.
create policy runs_select_visible on public.runs
  for select to authenticated
  using (manager_id = (select auth.uid()) or (select private.can_see_run(id)));
-- AC-RUN-05, AC-RUN-06: менеджер рану — той, хто вставляє (launch_run).
create policy runs_insert_own on public.runs
  for insert to authenticated
  with check (manager_id = (select auth.uid()) and status = 'in_progress');

create policy run_tasks_select_visible on public.run_tasks
  for select to authenticated
  using (assignee_id = (select auth.uid()) or (select private.can_see_run(run_id)));
-- AC-RUN-04, AC-RUN-08, AC-RUN-09: задачі вставляє лише менеджер рану, виконавець — менеджер чи адміністратор.
create policy run_tasks_insert_by_run_manager on public.run_tasks
  for insert to authenticated
  with check (
    (select private.is_run_manager(run_id))
    and status = 'to_do'
    and (select private.is_assignable(assignee_id))
  );
-- AC-TASK-01, AC-TASK-02, AC-TASK-03, AC-TASK-07: позначити може виконавець, менеджер рану або адміністратор.
create policy run_tasks_update_allowed on public.run_tasks
  for update to authenticated
  using (
    assignee_id = (select auth.uid())
    or (select private.is_run_manager(run_id))
    or (select private.current_app_role()) = 'admin'
  )
  with check (
    status = 'done'
    and (
      assignee_id = (select auth.uid())
      or (select private.is_run_manager(run_id))
      or (select private.current_app_role()) = 'admin'
    )
  );

-- ── Завершення рану (AC-TASK-04) ────────────────────────────────────────────
-- Коли в рані не лишилось обов'язкових задач «to do», ран отримує «completed». Необов'язкові задачі не впливають.
create or replace function private.complete_run_if_done()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.runs as r
  set status = 'completed', completed_at = now()
  where r.id = new.run_id
    and r.status = 'in_progress'
    and not exists (
      select 1 from public.run_tasks as t where t.run_id = new.run_id and t.required and t.status <> 'done'
    );
  return null;
end;
$$;

revoke execute on function private.complete_run_if_done() from public, anon, authenticated;

create trigger run_tasks_complete_run
  after update of status on public.run_tasks
  for each row
  when (new.status = 'done' and old.status is distinct from 'done')
  execute function private.complete_run_if_done();

-- ── Запуск шаблону (AC-RUN-01…AC-RUN-09) ────────────────────────────────────
-- security invoker: працює від імені користувача під політиками вище; одна транзакція — ран і всі задачі разом.
-- p_assignments: {"<template_task_id>": "<user_id>"}; задачі без призначення отримує менеджер рану.
-- Коди помилок (message): CASE_NAME_REQUIRED, CASE_NAME_TOO_LONG, TEMPLATE_NOT_FOUND, ASSIGNEE_INVALID, NOT_AUTHENTICATED.
create or replace function public.launch_run(
  p_template_id uuid,
  p_case_name text,
  p_assignments jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_case_name, ''));
  v_assignments jsonb := coalesce(p_assignments, '{}'::jsonb);
  v_run_id uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  if v_name = '' then
    raise exception 'CASE_NAME_REQUIRED' using errcode = 'P0001';
  end if;
  if char_length(v_name) > 100 then
    raise exception 'CASE_NAME_TOO_LONG' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.templates as tp where tp.id = p_template_id) then
    raise exception 'TEMPLATE_NOT_FOUND' using errcode = 'P0001';
  end if;
  if jsonb_typeof(v_assignments) <> 'object' then
    raise exception 'ASSIGNEE_INVALID' using errcode = 'P0001';
  end if;
  -- Кожне призначення — задача цього шаблону і користувач-менеджер чи адміністратор.
  if exists (
    select 1
    from jsonb_each_text(v_assignments) as a (task_id, user_id)
    where a.user_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or a.task_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or not exists (
        select 1 from public.template_tasks as tt where tt.id = a.task_id::uuid and tt.template_id = p_template_id
      )
      or not (select private.is_assignable(a.user_id::uuid))
  ) then
    raise exception 'ASSIGNEE_INVALID' using errcode = 'P0001';
  end if;

  insert into public.runs (template_id, case_name, manager_id)
  values (p_template_id, v_name, v_uid)
  returning id into v_run_id;

  insert into public.run_tasks (run_id, section_name, section_position, name, required, position, assignee_id)
  select v_run_id, s.name, s.position, tt.name, tt.required, tt.position,
         coalesce((v_assignments ->> tt.id::text)::uuid, v_uid)
  from public.template_tasks as tt
  join public.template_sections as s on s.id = tt.section_id
  where tt.template_id = p_template_id;

  return v_run_id;
end;
$$;

-- ── Позначення задачі виконаною (AC-TASK-01, 02, 03, 07) ────────────────────
-- Повторна позначка «done» нічого не змінює (припущення PM). Задача, якої користувач не бачить або не може
-- позначити, — NOT_ALLOWED (повідомлення AC-TASK-03).
create or replace function public.mark_task_done(p_task_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_task public.run_tasks%rowtype;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_task from public.run_tasks as t where t.id = p_task_id;
  if not found then
    raise exception 'NOT_ALLOWED' using errcode = 'P0001';
  end if;
  if not (
    v_task.assignee_id = v_uid
    or (select private.is_run_manager(v_task.run_id))
    or (select private.current_app_role()) = 'admin'
  ) then
    raise exception 'NOT_ALLOWED' using errcode = 'P0001';
  end if;
  if v_task.status = 'done' then
    return;
  end if;

  update public.run_tasks
  set status = 'done', done_at = now(), done_by = v_uid
  where id = p_task_id;
end;
$$;

-- design.md D8: обгортка для Data API (private-схему PostgREST не бачить).
create or replace function public.list_assignable_users()
returns table (id uuid, full_name text, email text)
language sql
stable
security invoker
set search_path = ''
as $$
  select u.id, u.full_name, u.email from private.assignable_users() as u;
$$;

revoke execute on function public.launch_run(uuid, text, jsonb), public.mark_task_done(uuid),
  public.list_assignable_users() from public, anon;
grant execute on function public.launch_run(uuid, text, jsonb), public.mark_task_done(uuid),
  public.list_assignable_users() to authenticated;
