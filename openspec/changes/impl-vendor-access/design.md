# Design: impl-vendor-access

## Контекст

Зріз 3 (`openspec/specs/vendor-access`, AC-VENDOR-01…10): роль `vendor`. Модель зрізів 1–2 лишається: рани й задачі
ранів пишуть лише функції `private` (`security definer`, `search_path = ''`) через обгортки `public` (`security
invoker`); роль — з `public.profiles.role` через `private.current_app_role()`, ніколи з `user_metadata` (ADR 0002).
Межа зрізу — у базі: кожне правило матриці прав для вендора діє й для прямого запиту до PostgREST (припущення PM
«Every limit in the rights matrix of the Product is enforced for direct requests too»), сторінки лише показують те, що
віддала база.

## Дані й RLS (одна міграція `vendor_role`)

- **D1. Роль `vendor` (AC-VENDOR-01…10).** Порядок з `20261012000000_profiles_and_roles.sql`: зняти
  `profiles_role_check` → дані не змінюються (жодна наявна роль не стає вендором) → `default` лишається `manager` →
  новий `profiles_role_check` з `('manager', 'admin', 'vendor')`. Роль, як і раніше, змінює лише `service_role`
  (column grant `update (full_name)`); вендора створює `npm run users:demo` (`supabase/demo-users.json`).
- **D2. Хто запускає і хто виконує — окремі правила (AC-VENDOR-01, AC-VENDOR-09).** Досі `private.is_assignable`
  означало і «може запускати», і «може бути виконавцем». Тепер:
  - `private.can_launch(uid)` — `manager` або `admin` (матриця: «Launch a template» — вендору «—»);
  - `private.is_assignable(uid)` — `manager`, `admin` або `vendor` (глосарій «Assignee»).
  `private.launch_run` (нова версія, `create or replace`) перевіряє запуск через `can_launch` → `NOT_ALLOWED` до будь-
  якого запису, а виконавців — через `is_assignable`. Вендор ніколи не стає менеджером рану: менеджер рану — лише
  `auth.uid()` того, хто пройшов `can_launch`.
- **D3. Email у виборі виконавця (AC-VENDOR-02, AC-VENDOR-04).** `private.assignable_users()` повертає `id` і `email`
  менеджерів, адміністраторів і вендорів, але лише коли викликає `manager` чи `admin`; вендору — порожньо (матриця:
  «See the email of other users» — вендору «—»). Обгортка `public.list_assignable_users()` не змінюється.
- **D4. Рани й задачі для вендора (AC-VENDOR-03, AC-VENDOR-04, AC-VENDOR-06).** `private.can_see_run` для вендора —
  `false`: політика `runs_select_visible` не віддає вендору рядків `runs` напряму (там `manager_id`, `template_name`,
  `template_version`, яких вендор не бачить — матриця: «See which template version a run follows» — «—»). Політика
  `run_tasks_select_visible` (`assignee_id = auth.uid() or can_see_run(run_id)`) віддає вендору лише його задачі.
  Профілі інших людей вендор і так не бачить (`profiles_select_own_or_admin`).
- **D5. Що вендор бачить про ран — функції (AC-VENDOR-03, AC-VENDOR-04, AC-VENDOR-05, AC-VENDOR-10).**
  - `public.vendor_runs()` → `private.vendor_runs()`: для вендора — рани, де він виконавець хоча б однієї задачі:
    `id`, `case_name`, `status`, `created_at`, `my_done`, `my_total` (лише його задачі — припущення PM про «Your
    tasks: N of K done»); для інших ролей — порожньо.
  - `public.vendor_run_tasks(p_run_id)` → `private.vendor_run_tasks(…)`: лише задачі вендора в цьому рані — `id`,
    `section_name`, `section_position`, `name`, `required`, `position`, `status` і `completes_run` (задача обов'язкова,
    «to do» і в рані не лишилось інших обов'язкових «to do»). `completes_run` потрібне для підтвердження «This cannot be
    undone» (припущення PM) і розкриває рівно те, що розкриває саме підтвердження, — не прогрес рану.
- **D6. Шаблони (AC-VENDOR-08).** `templates_select_visible`: `admin` — усі; `manager` — збережені як версія; вендор —
  нічого. Робоча копія, версії й `template_drafts` — і так лише `admin`.
- **D7. Позначення задачі (AC-VENDOR-05, AC-VENDOR-07).** `private.mark_task_done` не змінюється: позначає виконавець,
  менеджер рану чи `admin`; вендор не буває менеджером рану, тож позначає лише свої задачі. Чужа задача —
  `NOT_ALLOWED`, статус не змінюється.

## UI і компоненти

- **U1. Роль у коді.** `AppRole` — `"manager" | "admin" | "vendor"`; хелпер `isVendor(role)`.
- **U2. Список ранів вендора `/` (AC-VENDOR-03, AC-VENDOR-10).** Для вендора головна бере `vendor_runs()` і показує
  `Table` у `Card`: «Case» (посилання на ран), «Status» (`RunStatusBadge`), «Your tasks» — «Your tasks: N of K
  done» (`yourTasksLabel` у `src/lib/runs/progress.ts`). Без «Launch a template», без колонок шаблону й менеджера рану.
  Порожньо — `Card` з «No tasks assigned to you yet.» замість таблиці.
- **U3. Сторінка рану для вендора `/runs/[id]` (AC-VENDOR-04, AC-VENDOR-05, AC-VENDOR-06).** Ран, якого немає у
  `vendor_runs()`, — `notFound()` → «Run not found» без задач (те саме, що AC-TASK-10). Інакше: заголовок — назва
  кейсу (вендор уже бачить її в списку), під ним «Your tasks: N of K done»; задачі групами за секціями (`Card` на
  секцію з назвою секції): назва, `RequirementTag` («required»/«optional»), `TaskStatusBadge`, «Mark as done» для «to
  do». Без колонки виконавця, без «Run manager», версії шаблону й прогресу всього рану. Підтвердження «This cannot be
  undone» — коли `completes_run` (D5).
- **U4. Відмови на сторінках шаблонів (AC-VENDOR-08).** `/templates`, `/templates/new`, `/templates/[id]`,
  `/templates/[id]/edit`, `/templates/[id]/versions` і `/runs/new` для вендора показують `AccessDenied`
  («Not enough rights») без жодного запиту до даних шаблонів; посилання на відмові для вендора — «Back to runs» на
  `/` (рішення розробника: «Back to templates» вів би на ту саму відмову; питання solomchaak/property-workflows-spec#49
  без відповіді).
- **U5. Навігація (рішення розробника, solomchaak/property-workflows-spec#44 без відповіді).** Вендор бачить лише пункт
  «Runs»; `SidebarNav` отримує роль від `AppShell`.
- **U6. Вибір виконавця (AC-VENDOR-01, AC-VENDOR-02).** Без змін у компоненті: список email з
  `list_assignable_users()` тепер містить вендорів. Текст `ASSIGNEE_INVALID` — «An assignee can only be a manager, an
  administrator or a vendor» (глосарій «Assignee»).

## Auth і Server Actions

- **A1. `launchRun` (AC-VENDOR-09).** Після `getClaims()` дія читає роль з `profiles` і для ролі поза `manager`/`admin`
  повертає «Not enough rights» до виклику `launch_run`; базу однаково захищає `can_launch` (D2) — прямий запит до
  `/rest/v1/rpc/launch_run` теж відхилено.
- **A2. `markTaskDone` (AC-VENDOR-05, AC-VENDOR-07).** Без змін: `getClaims()` → `mark_task_done`; право перевіряє
  база (D7).
- **A3. Сторінки.** Роль — `currentUser()` (`getClaims()` + `profiles`); `proxy` для вендора не змінюється.

## Тести й доказ, що тести відмов падають

| AC | Рівень | Тест | Доказ, що падає |
|---|---|---|---|
| AC-VENDOR-01 | база (PGlite) | `tests/db/vendor-access-db.test.ts` | — (позитивний) |
| AC-VENDOR-02 | база (PGlite) | `tests/db/vendor-access-db.test.ts` | SQL-мутант: вендори не в `assignable_users` → KILLED |
| AC-VENDOR-03 | база + компонент | `tests/db/vendor-access-db.test.ts`, `tests/runs/vendor-pages.test.tsx` | SQL-мутант: `can_see_run` віддає вендору ран → KILLED |
| AC-VENDOR-04 | база + компонент | ті самі | SQL-мутант: `can_see_run` для вендора → KILLED |
| AC-VENDOR-05 | база + компонент | ті самі | — (позитивний) |
| AC-VENDOR-06 | база + компонент | ті самі | SQL-мутант: `can_see_run` для вендора → KILLED |
| AC-VENDOR-07 | база | `tests/db/vendor-access-db.test.ts` | SQL-мутант: `mark_task_done` без перевірки виконавця → KILLED |
| AC-VENDOR-08 | база + компонент | `tests/db/vendor-access-db.test.ts`, `tests/runs/vendor-pages.test.tsx` | SQL-мутант: `templates_select_visible` пропускає вендора → KILLED |
| AC-VENDOR-09 | база + дія | `tests/db/vendor-access-db.test.ts`, `tests/runs/vendor-pages.test.tsx` | SQL-мутант: `can_launch` пропускає вендора → KILLED |
| AC-VENDOR-10 | компонент | `tests/runs/vendor-pages.test.tsx` | — (стан інтерфейсу) |

Тести пишуться до коду з тексту AC (червоний коміт перед реалізацією). Те, що видно на екрані, — ще й UAT-специфікація
`tests/e2e/vendor-access.spec.ts` на проді (трек C).

## Ризики

- Зміна `can_see_run` торкається всіх ролей: для `manager` і `admin` вираз той самий — регресію ловлять наявні тести
  AC-TASK-06, AC-TASK-10.
- `launch_run` пересоздається повністю: тіло — з `20261027174403_template_names_and_checks.sql`, змінено лише перевірку
  запуску; регресію ловлять тести AC-RUN-*, AC-EDITOR-11, AC-EDITOR-22.
