# Design: impl-run-launch

## Контекст

Специфікація: `openspec/specs/run-launch/spec.md` (AC-RUN-*), `openspec/specs/run-progress/spec.md` (AC-TASK-*).
Стек шаблону: Next.js 16 App Router (server components + server actions), Supabase Postgres з RLS, `getClaims()`
для авторизації, `src/proxy.ts` для сесії. Відкриті питання до PM: Q2 (solomchaak/property-workflows-spec#4) і Q3
(solomchaak/property-workflows-spec#5) — рішення нижче тимчасові й позначені.

## Рішення

### D1. Ролі `manager` і `admin` (AC-RUN-05, AC-RUN-06, AC-TASK-07)

Окрема міграція замінює ролі шаблону `member`/`admin` на `manager`/`admin` у порядку з заголовка стартової
міграції: зняти `profiles_role_check` → `update … set role = 'manager' where role = 'member'` → default `'manager'`
→ новий `profiles_role_check`. `supabase/demo-users.json`: адміністратор і три менеджери (A, B, C для AC-TASK-03,
AC-TASK-06), лише `*@example.test`.

### D2. Модель даних

- `templates` (назва), `template_sections` (назва, порядок), `template_tasks` (назва, `required`, порядок) — шаблон.
  Шаблони — початкові дані в `supabase/seed.sql` (власне припущення в proposal зміни `add-run-launch`): «Tenant
  move-in» — 2 секції, 5 задач, 3 обов'язкові (AC-RUN-01).
- `runs`: `template_id`, `case_name`, `manager_id` (менеджер рану), `status` (`in_progress` | `completed`).
- `run_tasks`: **копія** задачі шаблону на момент запуску — `section_name`, `name`, `required`, `position`, а також
  `assignee_id`, `status` (`to_do` | `done`), `done_at`, `done_by`. Ран не посилається на задачі шаблону, тож зміна
  шаблону його не змінює (AC-RUN-02).
- Check `char_length(case_name) between 1 and 100` і `case_name = btrim(case_name)` — останній рубіж для
  AC-RUN-03, AC-RUN-07.

### D3. Запуск — одна функція Postgres `public.launch_run` (AC-RUN-01…AC-RUN-09)

`supabase.rpc('launch_run', { p_template_id, p_case_name, p_assignments })` — `security invoker`, одна транзакція:
обрізає назву, перевіряє 1–100 символів (помилки `CASE_NAME_REQUIRED`, `CASE_NAME_TOO_LONG`), вставляє `runs` з
`manager_id = auth.uid()` і копіює всі задачі шаблону в `run_tasks`; виконавець — із `p_assignments`
(`{template_task_id: user_id}`), інакше менеджер рану (AC-RUN-04, AC-RUN-08, AC-RUN-09). Виконавцем може бути лише
користувач з роллю `manager` чи `admin` (`ASSIGNEE_INVALID`). Ту саму перевірку назви робить
`src/lib/runs/case-name.ts` до виклику, щоб показати повідомлення PM дослівно.

### D4. Позначення задачі — `public.mark_task_done` (AC-TASK-01, 02, 03, 07)

`security invoker`: дозволено виконавцю задачі, менеджеру рану чи адміністратору, інакше помилка `NOT_ALLOWED`
(повідомлення AC-TASK-03). Повторна позначка `done` нічого не змінює (припущення PM). Колонковий `grant update
(status, done_at, done_by)` і політика update з тією самою умовою — захист і без функції.

### D5. Завершення рану — тригер (AC-TASK-04)

`after update of status on run_tasks` → `private.complete_run_if_done()` (`security definer`, `search_path = ''`):
коли в рані не лишилось обов'язкових задач `to_do`, ран отримує `completed`. Необов'язкові задачі не впливають
(припущення PM).

### D6. Видимість — RLS (AC-TASK-06, AC-TASK-08)

`runs` і `run_tasks` select: `admin`, або менеджер рану, або виконавець хоча б однієї задачі рану — через
`private.can_see_run(run_id)` (`security definer`, щоб політики `runs` ↔ `run_tasks` не зациклювались). Insert —
лише через `launch_run` під політиками «вставляю свій ран». Шаблони бачать усі автентифіковані; змінює лише admin.

### D7. Прогрес (AC-TASK-05, AC-TASK-09)

Прогрес рахує `src/lib/runs/progress.ts` з задач рану: `formatProgress(done, total)` → «N of M done», де M — усі
задачі (припущення PM). Показується в списку ранів (`/`) і на сторінці рану (`/runs/[id]`).

### D8. Імена користувачів для вибору виконавця — тимчасово, Q3 (AC-RUN-04, AC-TASK-08)

Профілі інших користувачів RLS не віддає (матриця прав). Для вибору виконавця й показу виконавців —
`public.list_assignable_users()` → `private.assignable_users()` (`security definer`): лише `id`, `full_name`,
`email` менеджерів і адміністраторів, без ролей. Це рекомендований варіант A питання Q3 (#5); після відповіді
PM — нова зміна, якщо він обере інше.

### D9. Чужий ран за прямим посиланням — тимчасово, Q2 (AC-TASK-03)

`/runs/[id]` для рану, який RLS не віддає, — `notFound()` («Run not found»): так за AC-TASK-06 менеджер його не
бачить. Повідомлення AC-TASK-03 повертає `mark_task_done` (і server action) на будь-яку спробу без права — це
перевіряють тести. Рекомендований варіант A питання Q2 (#4).

### D10. Сторінки

- `/` — список видимих ранів: назва кейсу, шаблон, статус, прогрес; кнопка «Launch a template».
- `/runs/new` — вибір шаблону, назва кейсу, виконавець для кожної задачі (за замовчуванням — «me, the run manager»).
- `/runs/[id]` — прогрес, статус рану, задачі за секціями зі статусом і виконавцем, кнопка «Mark as done», якщо можна.

### D11. Тести

`tests/db/` — справжній Postgres у WASM (PGlite, devDependency `@electric-sql/pglite`) з емуляцією ролей Supabase:
ті самі `supabase/migrations/*.sql` і `supabase/seed.sql`; хелпер узято з демо курсу
(koldovsky/2026-quitcode-06-leave-portal-demo, `tests/db/supabase-pglite.ts`) з посиланням у PR. Тести RLS,
`launch_run`, `mark_task_done`, тригера — від імені конкретного користувача. Чисті функції
(`case-name.ts`, `progress.ts`) — окремі unit-тести. Назва кожного тесту починається з AC ID.
