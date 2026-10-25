# Design: impl-template-versions

## Контекст

Зріз 2 (`openspec/specs/template-versions`, `openspec/specs/design-system`): адміністратор редагує шаблон, зміни
зберігаються автоматично (незбережені зміни), збереження створює незмінну пронумеровану версію; менеджер бачить лише
поточну версію; ран іде за версією запуску. Відкриті питання PM: Q2 — чи можна запустити шаблон без версії
(solomchaak/property-workflows-spec#21), Q3 — «Save» без змін (solomchaak/property-workflows-spec#22); до відповіді
реалізуємо рекомендовані варіанти A, а рядки матриці посилаються на питання.

Зріз 1 (design.md `impl-run-launch`, D2–D6): запис ранів — лише функціями `private` (`security definer`,
`search_path = ''`), у `authenticated` на `runs`/`run_tasks` лише `SELECT` під RLS. Цю модель запису зберігаємо й для
версій. Рішення PM, яких раніше бракувало: email замість імен — solomchaak/property-workflows-spec#5 (D8 зрізу 1),
«Run not found» для чужого рану — solomchaak/property-workflows-spec#4 (D9 зрізу 1).

## UI і компоненти

Усе — на компонентах `@/components/ui` і токенах `DESIGN.md` (каркас `AppShell`, `PageHeader`, `Table`, `Badge`,
`Button`, `Alert`); тексти AC — дослівно.

- **U1. Каркас і навігація (AC-DSYS-02, AC-DSYS-03).** Сайдбар: «Runs» (`/`), «Templates» (`/templates`). Усі
  сторінки зрізів 1 і 2 — в `AppShell`; сторінка відмови й сторінка входу — у тому самому макеті (бренд, картка,
  токени). Кнопка «Launch a template» і посилання порожнього стану ведуть на `/templates`.
- **U2. Список шаблонів `/templates` (AC-EDITOR-01, AC-EDITOR-02).** `Table`: назва, поточна версія («Version N» чи
  «—»), для admin — `Badge variant="draft"` «Unpublished changes»; дії: «Launch» (шаблон з версією), для admin —
  «Edit», «Versions», кнопка «New template». Менеджер бачить лише шаблони з версією, без позначки (AC-EDITOR-02).
  Шаблон без версії у формі запуску не показуємо нікому (Q2, варіант A, #21).
- **U3. Редактор `/templates/[id]/edit` (AC-EDITOR-01, AC-EDITOR-03, AC-EDITOR-04).** Секції й задачі робочої копії:
  додати, перейменувати, змінити порядок (вгору/вниз), прибрати, позначка required/optional. Кожна зміна —
  окрема Server Action, тож зберігається одразу (автозбереження) — вийти без збереження нічого не губить. Шапка:
  «Unpublished changes» (`Badge draft`), поточна версія, `Button` «Save» (основна дія; недоступна без незбережених
  змін — Q3, варіант A, #22). Помилка збереження — `Alert` «A template needs at least one required task» (AC-EDITOR-04);
  успіх — «Version N saved» на місці, без спливних вікон.
- **U4. Список версій `/templates/[id]/versions` (AC-EDITOR-05).** `Table`: «Version N», дата й час
  `DD.MM.YYYY HH:MM` (Europe/Kyiv, `src/lib/templates/format.ts`), email автора; від новішої.
- **U5. Відмова (AC-EDITOR-07, AC-DSYS-02).** Менеджер на `/templates/[id]/edit` чи `/versions` — `PageHeader`
  «Not enough rights», посилання «Back to templates», жодних даних шаблону; запитів до робочої копії й версій сторінка
  для менеджера не робить.
- **U6. Сторінка рану (AC-EDITOR-06).** Під назвою: «Template version N» (з `runs.template_version`); задачі — з
  `run_tasks` (копія версії на момент запуску).
- **U7. Форма запуску `/runs/new?template=…` (AC-RUN-01, AC-RUN-04, AC-RUN-10, AC-RUN-12, AC-EDITOR-02).** Секції й задачі — з поточної версії
  (`templates.published_sections`), не з робочої копії.

## Дані й RLS

Одна міграція `…_template_versions.sql` (застосовані міграції не змінюємо).

- **D1. Робоча копія = незбережені зміни (AC-EDITOR-01, AC-EDITOR-02, AC-EDITOR-08).** Наявні `template_sections` і
  `template_tasks` стають робочою копією. Політики `select` — **лише admin** (`*_select_admin` замість `*_select_all`);
  `insert`/`update`/`delete` — лише admin (як і були). Менеджер робочої копії не бачить і не змінює: прямий `UPDATE` —
  0 рядків, `INSERT` — помилка RLS (AC-EDITOR-08).
- **D2. `templates` (AC-EDITOR-01…03).** Нові колонки: `current_version integer` (null — ще не збережено),
  `published_sections jsonb` (знімок поточної версії: секції з задачами, id задач робочої копії на момент збереження),
  `has_unpublished_changes boolean not null default true`. Column grants: `authenticated` — `select` на всі колонки,
  `insert (name)`, `update (name)`; `current_version`, `published_sections`, `has_unpublished_changes` змінює лише
  функція. Політика `templates_select`: admin — усі; manager — лише `current_version is not null` (AC-EDITOR-02).
  Тригери `after insert/update/delete` на `template_sections`/`template_tasks` (`private.mark_template_changed`,
  `security definer`) ставлять `has_unpublished_changes = true`.
- **D3. `template_versions` (AC-EDITOR-03, AC-EDITOR-05, AC-EDITOR-07).** `id`, `template_id`, `number`,
  `sections jsonb`, `created_at`, `created_by → profiles`; `unique (template_id, number)`. RLS: `select` — лише admin
  (`template_versions_select_admin`); `insert/update/delete` — жодних GRANT і політик: версію створює лише функція,
  збережена версія не змінюється (AC-EDITOR-03, припущення PM). Менеджер — 0 рядків (AC-EDITOR-07).
- **D4. Збереження — `private.save_template_version(p_template_id)` (AC-EDITOR-03, AC-EDITOR-04, AC-EDITOR-08).**
  `security definer`, `set search_path = ''`, обгортка `public.save_template_version` (`security invoker`), `grant
  execute` лише `authenticated`. Першим рядком: `auth.uid()` є і `private.current_app_role() = 'admin'`, інакше
  `NOT_ALLOWED` (AC-EDITOR-08). Блокує шаблон `for update`; без незбережених змін — `NO_CHANGES` (Q3, A); без жодної
  обов'язкової задачі — `NO_REQUIRED_TASK` («A template needs at least one required task», версії немає, робоча копія
  й позначка без змін — AC-EDITOR-04). Інакше: номер = `coalesce(current_version, 0) + 1`, знімок робочої копії →
  `template_versions` і `templates.published_sections`, `current_version`, `has_unpublished_changes = false`.
- **D5. Запуск із поточної версії — `private.launch_run` (новою міграцією, `create or replace`; AC-RUN-01,
  AC-RUN-02, AC-RUN-03, AC-RUN-04, AC-RUN-07, AC-RUN-08, AC-RUN-09, AC-RUN-11, AC-RUN-12, AC-EDITOR-06).** Задачі рану — з `templates.published_sections`; шаблон без версії — `TEMPLATE_NOT_FOUND` (Q2, A).
  `runs.template_version integer` (not null після заповнення наявних ранів версією 1). Призначення до задач, яких
  немає в поточній версії, відкидаються, а не валять запуск — `ASSIGNEE_INVALID` лише для невалідного користувача
  (рішення PM solomchaak/property-workflows-spec#9; фідбек до WS6). Назва кейсу обрізається
  `regexp_replace(…, '^\s+|\s+$', '', 'g')` — як `trim()` у формі.
- **D6. Наявні дані (власне припущення `add-template-versions`).** Для кожного наявного шаблону — версія 1 зі знімком
  робочої копії (`created_by` — перший admin), `current_version = 1`, `has_unpublished_changes = false`; наявні рани —
  `template_version = 1`. Сид і міграція `initial_templates` — без змін (дані версії робить нова міграція).
- **D7. Без входу (AC-EDITOR-09, AC-DSYS-03).** `anon` не має GRANT на жодну таблицю шаблонів, версій і ранів —
  тест бази `asAnon` бачить помилку доступу; сторінки перенаправляє `src/proxy.ts`.

## Auth

- **A1.** `src/proxy.ts` лише перенаправляє на `/login` (UX); захист — RLS, GRANT і перевірка в кожній дії (ADR 0002).
- **A2.** Кожна Server Action редактора (`src/app/templates/[id]/edit/actions.ts`) і створення шаблону
  (`src/app/templates/actions.ts`): `getClaims()` → роль з `profiles` (`requireAdmin` у `src/lib/auth/require-role.ts`)
  **до** будь-якого запису; не admin — «Not enough rights», без запису. Запис — серверним клієнтом користувача (діють
  RLS і GRANT), збереження версії — лише `rpc('save_template_version')`.
- **A3.** Сторінки редактора й версій перевіряють роль з `profiles` і для менеджера рендерять відмову (U5) без
  запитів до даних; дані однаково захищає RLS (D1, D3).
- **A4.** Admin-клієнт (`SUPABASE_SECRET_KEY`) не потрібен: зріз не викликає Admin API, ключа у Vercel немає.
- **A5.** Роль — лише з `profiles.role`, ніколи з `user_metadata`.

## Тести

- База (PGlite, `tests/db/template-versions-db.test.ts`): AC-EDITOR-02 (менеджер не бачить робочої копії, бачить
  версію 1), AC-EDITOR-03, AC-EDITOR-04, AC-EDITOR-05 (порядок і автори), AC-EDITOR-06, AC-EDITOR-07 (0 версій для
  менеджера), AC-EDITOR-08 (прямий UPDATE/INSERT/save менеджера — дані без змін), AC-EDITOR-09 і AC-DSYS-03 (`asAnon`).
- Дії й сторінки: AC-EDITOR-01 (дія редактора пише робочу копію, позначка), AC-DSYS-02 (відмова в редакторі —
  розмітка й відсутність запитів), формат дати AC-EDITOR-05.
- Мутаційна перевірка: послабити `template_versions_select_admin` до `true` → AC-EDITOR-07 червоний; прибрати перевірку
  ролі в `private.save_template_version` → AC-EDITOR-08 червоний (обидва — червоні прогони CI в PR задачі 1).
