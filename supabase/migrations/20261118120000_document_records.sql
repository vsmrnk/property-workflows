-- Зріз 4: записи документа рану (openspec/specs/document-parsing/spec.md, AC-DOCAI-04, AC-DOCAI-13…16).
-- Рішення: openspec/changes/impl-document-parsing/design.md (D1–D5). Модель нічого не пише: запис — лише значення,
-- які людина перевірила й зберегла («Save values»); вставлений текст і відповідь моделі не зберігаються.
-- Межа — у базі: блок і записи — лише менеджер рану й адміністратор, і для прямого запиту до PostgREST теж.

-- ── D1. Таблиця ─────────────────────────────────────────────────────────────
create table public.run_documents (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs (id) on delete cascade,
  document_type text not null check (document_type in ('maintenance_request', 'estimate')),
  -- Заявка. null = «not found» (AC-DOCAI-06): значення не вигадується.
  phone text check (char_length(phone) <= 30),
  description text check (char_length(description) <= 2000),
  category text check (
    category in ('plumbing', 'electrical', 'heating and cooling', 'appliance', 'structure and doors', 'other')
  ),
  urgency text check (urgency in ('urgent', 'not urgent')),
  -- Кошторис: позиції {name, quantity, unitPrice} і Total як написано в документі (AC-DOCAI-08).
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  total numeric(12, 2) check (total >= 0),
  confirmed_by uuid not null references public.profiles (id),
  confirmed_at timestamptz not null default now()
);

-- D5. Записи рану — найновіший першим (припущення PM «the newest is first»).
create index run_documents_run_confirmed_idx on public.run_documents (run_id, confirmed_at desc);

-- ── D2. Хто може ────────────────────────────────────────────────────────────
-- Менеджер рану або адміністратор (будь-який ран — «Users and roles» PM; #61/#62 — варіант A). Вендор і менеджер,
-- що лише виконавець задачі, — false (AC-DOCAI-14, AC-DOCAI-15).
create function private.can_parse_documents(p_run_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.current_app_role()) = 'admin'
    or (select private.is_run_manager(p_run_id));
$$;

create function public.can_parse_documents(p_run_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.can_parse_documents(p_run_id);
$$;

-- ── D3. Читання ─────────────────────────────────────────────────────────────
alter table public.run_documents enable row level security;
revoke all on table public.run_documents from anon, authenticated;
grant select on table public.run_documents to authenticated;

create policy run_documents_select on public.run_documents
  for select to authenticated
  using ((select private.can_parse_documents(run_id)));

-- ── D4. Запис ───────────────────────────────────────────────────────────────
-- Право — до будь-якого запису (AC-DOCAI-16). confirmed_by і confirmed_at ставить база, а не клієнт.
-- Поля іншого типу документа не зберігаються: у заявки немає позицій, у кошторису — телефону й категорії.
create function private.save_run_document(
  p_run_id uuid,
  p_document_type text,
  p_phone text,
  p_description text,
  p_category text,
  p_urgency text,
  p_items jsonb,
  p_total numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_items jsonb := coalesce(p_items, '[]'::jsonb);
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  if not private.can_parse_documents(p_run_id) then
    raise exception 'NOT_ENOUGH_RIGHTS' using errcode = 'P0001';
  end if;
  if p_document_type is null then
    raise exception 'DOCUMENT_TYPE_REQUIRED' using errcode = 'P0001';
  end if;

  if p_document_type = 'estimate' then
    if jsonb_typeof(v_items) <> 'array' or exists (
      select 1
      from jsonb_array_elements(v_items) as e (item)
      where jsonb_typeof(e.item) <> 'object'
         or jsonb_typeof(e.item -> 'name') <> 'string'
         or btrim(e.item ->> 'name') = ''
         or jsonb_typeof(e.item -> 'quantity') <> 'number'
         or (e.item ->> 'quantity')::numeric <= 0
         or jsonb_typeof(e.item -> 'unitPrice') <> 'number'
         or (e.item ->> 'unitPrice')::numeric < 0
    ) then
      raise exception 'ITEM_INVALID' using errcode = 'P0001';
    end if;
    -- Лише три поля позиції — нічого зайвого з браузера.
    v_items := coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', btrim(e.item ->> 'name'),
        'quantity', (e.item -> 'quantity'),
        'unitPrice', (e.item -> 'unitPrice')
      ) order by e.ord)
      from jsonb_array_elements(v_items) with ordinality as e (item, ord)
    ), '[]'::jsonb);
    insert into public.run_documents (run_id, document_type, items, total, confirmed_by)
    values (p_run_id, p_document_type, v_items, p_total, v_uid)
    returning id into v_id;
  else
    insert into public.run_documents (run_id, document_type, phone, description, category, urgency, confirmed_by)
    values (
      p_run_id, p_document_type,
      nullif(btrim(p_phone), ''), nullif(btrim(p_description), ''), p_category, p_urgency,
      v_uid
    )
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

create function public.save_run_document(
  p_run_id uuid,
  p_document_type text,
  p_phone text,
  p_description text,
  p_category text,
  p_urgency text,
  p_items jsonb,
  p_total numeric
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.save_run_document(p_run_id, p_document_type, p_phone, p_description, p_category, p_urgency, p_items, p_total);
$$;

revoke execute on function private.can_parse_documents(uuid), public.can_parse_documents(uuid),
  private.save_run_document(uuid, text, text, text, text, text, jsonb, numeric),
  public.save_run_document(uuid, text, text, text, text, text, jsonb, numeric)
  from public, anon;
grant execute on function private.can_parse_documents(uuid), public.can_parse_documents(uuid),
  private.save_run_document(uuid, text, text, text, text, text, jsonb, numeric),
  public.save_run_document(uuid, text, text, text, text, text, jsonb, numeric)
  to authenticated;
