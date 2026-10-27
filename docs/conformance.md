# Матриця відповідності (AC → код → тест → статус)

<!--
Ваша матриця: один рядок на кожен AC з openspec/specs/** — вашої специфікації, у яку ви перекладаєте вимоги PM
(їхній знімок у requirements/ приносить команда агента /requirements-sync).
Рядок «Вимоги» під цим коментарем заповнює лише /requirements-sync: адреса репо вимог PM, звідки взято вимоги (issues
або файли docs/), і дата знімка, через « · ». Руками його не змінюйте: з нього /requirements-sync знає, звідки брати
вимоги наступного разу, а скіли spec-clarify, spec-review і /conformance — куди ставити питання й яку версію вимог ви
реалізуєте. Рядків таблиці /requirements-sync не додає.
Рядки змінюєте ви:
  PR «Специфікація» — після archive зміни: рядок кожного нового AC зі статусом «відкладено (чекає реалізації)»; рядки AC,
                      прибраних зі специфікації (REMOVED), — видалити;
  PR «Реалізація»   — рядок AC задачі в тому самому PR, що й код і тест.
Перебудувати автоматично: /conformance (Claude Code, Cursor).
Перевірка в CI: npm run ac:coverage — падає, якщо
  NO-ROW     AC є в специфікації, а рядка немає (типово — PR «Специфікація» без нових рядків або рядок видалено);
  MISSING    статус «реалізовано», а непропущеного тесту, назва якого починається з цього AC ID, у файлах
             *.test.ts / *.test.tsx немає (*.spec.ts і допоміжні файли Vitest не запускає — вони не рахуються);
  ORPHAN     тест посилається на AC, якого немає в специфікації (AC прибрано або вимогу PM ще не перекладено);
  BAD-STATUS статус не «реалізовано» і не «відкладено (причина)»;
  WRONG-REF  шляху `src/…`/`tests/…`/`supabase/…` з колонок «Код»/«Тест» немає або тест із цим AC в іншому файлі;
і попереджає, не падаючи: AC з вимог PM (requirements/), якого ще немає в openspec/specs/, — «вимогу PM ще не перекладено
в специфікацію».

Приклад рядків (усередині коментаря — скрипт їх не читає):
| AC-LEAVE-02 | заявка на дві посади дає два записи main і additional | `src/app/requests/actions.ts` (createRequest) | `tests/requests.test.ts` | реалізовано |
| AC-LEAVE-04 | заблоковані дні не рахуються | — | — | відкладено (чекаю відповідь PM на Q2, <pm>/<team-slug>-spec#5) |
| AC-LEAVE-07 | менеджер бачить лише свій відділ | — | — | відкладено (рішення PM: поза зрізом 1, <pm>/<team-slug>-spec#8) |
| AC-LEAVE-10 | діапазон лише із заблокованих днів | — | — | відкладено (чекає реалізації) |
-->

Вимоги: https://github.com/solomchaak/property-workflows-spec · джерело: issues · знімок 2026-10-27

| AC | Що перевіряє | Код | Тест | Статус |
|---|---|---|---|---|
| AC-RUN-01 | запуск шаблону створює один ран «in progress» з усіма 5 задачами «to do» | `supabase/migrations/20261019120100_templates_and_runs.sql` (launch_run) | `tests/db/runs-launch-db.test.ts` | реалізовано |
| AC-RUN-05 | адміністратор запускає шаблон і стає менеджером рану | `supabase/migrations/20261019120100_templates_and_runs.sql` (launch_run) | `tests/db/runs-launch-db.test.ts` | реалізовано |
| AC-RUN-02 | зміна шаблону після запуску не змінює задачі рану | `supabase/migrations/20261019120100_templates_and_runs.sql` (run_tasks — копія шаблону) | `tests/db/runs-launch-db.test.ts` | реалізовано |
| AC-RUN-03 | порожня назва кейсу чи з самих пробілів — ран не створено, «Enter a case name» | `src/lib/runs/case-name.ts` (validateCaseName), `src/app/runs/actions.ts` (launchRun) | `tests/runs/case-name.test.ts` | реалізовано |
| AC-RUN-07 | назва кейсу 101 символ — ран не створено, повідомлення про межу 100 | `src/lib/runs/case-name.ts` (validateCaseName), `src/app/runs/actions.ts` (launchRun) | `tests/runs/case-name.test.ts` | реалізовано |
| AC-RUN-06 | менеджер, який запустив шаблон, — менеджер рану | `supabase/migrations/20261019120100_templates_and_runs.sql` (launch_run) | `tests/db/runs-launch-db.test.ts` | реалізовано |
| AC-RUN-04 | 2 задачі призначено менеджеру B, решта 3 — менеджеру A | `src/app/runs/actions.ts` (launchRun), `supabase/migrations/20261019120100_templates_and_runs.sql` (launch_run) | `tests/db/runs-launch-db.test.ts` | реалізовано |
| AC-RUN-08 | менеджер без призначень — виконавець усіх 5 задач | `supabase/migrations/20261019120100_templates_and_runs.sql` (launch_run) | `tests/db/runs-launch-db.test.ts` | реалізовано |
| AC-RUN-09 | адміністратор без призначень — виконавець усіх 5 задач | `supabase/migrations/20261019120100_templates_and_runs.sql` (launch_run) | `tests/db/runs-launch-db.test.ts` | реалізовано |
| AC-TASK-01 | виконавець позначає свою задачу «done» | `supabase/migrations/20261019120100_templates_and_runs.sql` (private.mark_task_done), `src/app/runs/[id]/actions.ts` (markTaskDone) | `tests/db/runs-progress-db.test.ts` | реалізовано |
| AC-TASK-02 | менеджер рану позначає задачу іншого виконавця «done» | `supabase/migrations/20261019120100_templates_and_runs.sql` (private.mark_task_done), `src/app/runs/[id]/actions.ts` (markTaskDone) | `tests/db/runs-progress-db.test.ts` | реалізовано |
| AC-TASK-03 | сторонній менеджер не може позначити задачу, бачить повідомлення | `supabase/migrations/20261019120100_templates_and_runs.sql` (private.mark_task_done → NOT_ALLOWED), `src/lib/runs/messages.ts` | `tests/db/runs-progress-db.test.ts` | реалізовано |
| AC-TASK-07 | адміністратор позначає задачу в чужому рані «done» | `supabase/migrations/20261019120100_templates_and_runs.sql` (private.mark_task_done), `src/app/runs/[id]/actions.ts` (markTaskDone) | `tests/db/runs-progress-db.test.ts` | реалізовано |
| AC-TASK-04 | третя обов'язкова задача «done» після підтвердження — ран «completed» | `src/lib/runs/progress.ts` (needsConfirmation), `src/app/runs/[id]/mark-done-button.tsx` | `tests/runs/clarify.test.tsx` | реалізовано |
| AC-TASK-05 | сторінка рану показує прогрес «2 of 5 done» | `src/lib/runs/progress.ts` (progressOf), `src/app/runs/[id]/page.tsx` | `tests/runs/progress.test.ts` | реалізовано |
| AC-TASK-08 | сторінка рану показує статус кожної з 5 задач | `src/app/runs/[id]/page.tsx`, `supabase/migrations/20261019120100_templates_and_runs.sql` (run_tasks_select_visible) | `tests/db/runs-progress-db.test.ts` | реалізовано |
| AC-TASK-09 | список ранів показує прогрес «2 of 5 done» | `src/lib/runs/progress.ts` (progressOf), `src/app/page.tsx` | `tests/runs/progress.test.ts` | реалізовано |
| AC-TASK-06 | менеджер бачить лише свої рани і рани, де він виконавець | `supabase/migrations/20261019120100_templates_and_runs.sql` (private.can_see_run, runs_select_visible), `src/app/runs/[id]/page.tsx` (notFound) | `tests/db/runs-progress-db.test.ts` | реалізовано |
| AC-RUN-10 | вибір виконавця показує лише email менеджерів і адміністраторів | `supabase/migrations/20261020120000_assignable_users_email_only.sql`, `src/app/runs/new/assignee-select.tsx` | `tests/db/runs-clarify-db.test.ts` | реалізовано |
| AC-RUN-11 | назва зі 100 символів і пробілом попереду — ран створено, пробіл прибрано | `src/lib/runs/case-name.ts` (validateCaseName), `supabase/migrations/20261019120100_templates_and_runs.sql` (launch_run) | `tests/db/runs-clarify-db.test.ts` | реалізовано |
| AC-RUN-12 | перейменування й перенесення секцій у шаблоні не змінюють секції рану | `supabase/migrations/20261019120100_templates_and_runs.sql` (run_tasks.section_name, section_position) | `tests/db/runs-clarify-db.test.ts` | реалізовано |
| AC-TASK-10 | чужий ран за посиланням — «Run not found», без задач | `src/app/runs/[id]/not-found.tsx`, `src/app/runs/[id]/page.tsx` (notFound) | `tests/runs/clarify.test.tsx` | реалізовано |
| AC-TASK-11 | поруч із задачею email виконавця, без імен і ролей | `src/lib/runs/people.ts` (emailOf), `src/app/runs/[id]/page.tsx` | `tests/db/runs-clarify-db.test.ts` | реалізовано |
| AC-TASK-12 | задачі двома групами за секціями в порядку секцій | `src/lib/runs/progress.ts` (groupBySection), `src/app/runs/[id]/page.tsx` | `tests/runs/clarify.test.tsx` | реалізовано |
| AC-TASK-13 | завершений ран у списку — «completed» і «4 of 5 done» | `src/app/page.tsx`, `supabase/migrations/20261019120100_templates_and_runs.sql` (complete_run_if_done) | `tests/db/runs-clarify-db.test.ts` | реалізовано |
| AC-TASK-14 | список: новіші зверху, назва кейсу й шаблону | `src/app/page.tsx` (order created_at desc) | `tests/db/runs-clarify-db.test.ts` | реалізовано |
| AC-TASK-15 | кожна задача позначена «required» або «optional» | `src/lib/runs/progress.ts` (requirementLabel), `src/app/_components/ui.tsx` (RequirementTag) | `tests/runs/clarify.test.tsx` | реалізовано |
| AC-TASK-16 | скасування на підтвердженні — задача «to do», ран «in progress» | `src/app/runs/[id]/mark-done-button.tsx` (Cancel), `src/lib/runs/progress.ts` (needsConfirmation) | `tests/runs/clarify.test.tsx` | реалізовано |
| AC-TASK-17 | виконавець бачить у списку прогрес «2 of 5 done» | `supabase/migrations/20261019120100_templates_and_runs.sql` (run_tasks_select_visible), `src/app/page.tsx` | `tests/db/runs-clarify-db.test.ts` | реалізовано |
| AC-TASK-18 | дія позначення лише на своїй задачі | `src/lib/runs/progress.ts` (canMarkDone), `src/app/runs/[id]/page.tsx` | `tests/runs/clarify.test.tsx` | реалізовано |
| AC-DSYS-01 | статус рану тими самими словами й кольором у списку й на сторінці рану, слово поруч із кольором | `src/app/_components/ui.tsx` (RunStatusBadge), `src/app/globals.css` (status-progress, status-done) | `tests/runs/design-system.test.tsx` | реалізовано |
| AC-DSYS-02 | менеджер у редакторі — «Not enough rights» і «Back to templates» у спільному макеті, шаблон без змін | `src/app/templates/[id]/edit/page.tsx` (AccessDenied), `src/app/_components/ui.tsx` (AccessDenied) | `tests/templates/editor.test.tsx` | реалізовано |
| AC-DSYS-03 | відвідувач без входу на сторінці рану — сторінка входу в спільному макеті, без даних рану | `src/proxy.ts`, `src/app/login/page.tsx`, `supabase/migrations/20261019120100_templates_and_runs.sql` | `tests/db/template-versions-db.test.ts` | реалізовано |
| AC-DSYS-04 | менеджер без ранів — «No runs yet. Launch a template to start one.» і «Launch a template», без порожньої таблиці | `src/app/_components/ui.tsx` (RunsEmpty), `src/app/page.tsx`, `src/lib/runs/messages.ts` (NO_RUNS) | `tests/runs/design-system.test.tsx` | реалізовано |
| AC-DSYS-05 | тема за пристроєм за замовчуванням, вибір «Theme» показує «System» | — | — | відкладено (чекає реалізації) |
| AC-DSYS-06 | обрана «Light» зберігається на пристрої після закриття браузера | — | — | відкладено (чекає реалізації) |
| AC-DSYS-07 | статуси «in progress» синім і «completed» зеленим у темній темі, контраст ≥ 4.5 | — | — | відкладено (чекає реалізації) |
| AC-DSYS-08 | після входу за прямим посиланням — сторінка рану, куди вело посилання | — | — | відкладено (чекає реалізації) |
| AC-EDITOR-01 | незбережена задача лишається після виходу з редактора, позначка «Unpublished changes» | `src/app/templates/[id]/edit/actions.ts` (addTask та інші дії робочої копії), `src/app/templates/[id]/edit/page.tsx`, `supabase/migrations/20261025140800_template_versions.sql` (mark_template_changed) | `tests/db/template-versions-db.test.ts`, `tests/templates/editor.test.tsx` | реалізовано |
| AC-EDITOR-02 | менеджер зі списку шаблонів бачить версію 1 з 5 задачами й позначками required/optional, без незбережених змін | `src/app/templates/[id]/page.tsx`, `src/app/templates/page.tsx`, `supabase/migrations/20261025140800_template_versions.sql` (templates_select_visible) | `tests/db/template-versions-db.test.ts`, `tests/templates/format.test.ts`, `tests/templates/clarify-pages.test.tsx` | реалізовано |
| AC-EDITOR-03 | збереження — «Version 2 saved», версія 2 з 6 задачами, позначка зникає | `supabase/migrations/20261025140800_template_versions.sql` (save_template_version), `src/app/templates/page.tsx` | `tests/db/template-versions-db.test.ts` | реалізовано |
| AC-EDITOR-04 | шаблон без обов'язкової задачі не зберігається — «A template needs at least one required task» | `supabase/migrations/20261025140800_template_versions.sql` (save_template_version), `src/app/templates/[id]/edit/actions.ts` (saveVersion), `src/lib/templates/format.ts` (NO_REQUIRED_TASK) | `tests/db/template-versions-db.test.ts`, `tests/templates/editor.test.tsx` | реалізовано |
| AC-EDITOR-05 | список версій від новішої: номер, дата й час за Києвом, email автора | `src/app/templates/[id]/versions/page.tsx`, `src/lib/templates/format.ts` (formatSavedAt) | `tests/db/template-versions-db.test.ts`, `tests/templates/versions-pages.test.tsx` | реалізовано |
| AC-EDITOR-06 | ран показує «Template version 1» і 5 задач версії 1 | `supabase/migrations/20261025140800_template_versions.sql` (launch_run, runs.template_version), `src/app/runs/[id]/page.tsx` | `tests/db/template-versions-db.test.ts`, `tests/templates/versions-pages.test.tsx` | реалізовано |
| AC-EDITOR-07 | менеджер за прямим посиланням на список версій — «Not enough rights», жодної версії | `supabase/migrations/20261025140800_template_versions.sql` (template_versions_select_admin), `src/app/templates/[id]/versions/page.tsx` (AccessDenied) | `tests/db/template-versions-db.test.ts`, `tests/templates/versions-pages.test.tsx` | реалізовано |
| AC-EDITOR-08 | менеджер змінює шаблон напряму — шаблон на версії 1 з 5 задачами, без незбережених змін | `supabase/migrations/20261025140800_template_versions.sql` (column grants, save_template_version) | `tests/db/template-versions-db.test.ts` | реалізовано |
| AC-EDITOR-09 | відвідувач без входу за посиланням на редактор — сторінка входу, без вмісту шаблону | `src/proxy.ts`, `supabase/migrations/20261025140800_template_versions.sql` | `tests/db/template-versions-db.test.ts` | реалізовано |
| AC-EDITOR-10 | шаблон без версії у формі запуску недоступний, «Save the template to launch it» | `src/app/runs/new/page.tsx` (chooseTemplate) | `tests/templates/clarify-pages.test.tsx` | реалізовано |
| AC-EDITOR-11 | запуск шаблону без версії напряму — рану не створено | `supabase/migrations/20261027174403_template_names_and_checks.sql` (launch_run) | `tests/db/template-clarify-db.test.ts` | реалізовано |
| AC-EDITOR-12 | збереження без незбережених змін не створює версію 3 | `supabase/migrations/20261027174403_template_names_and_checks.sql` (save_template_version, NO_CHANGES), `src/app/templates/[id]/edit/save-version.tsx` | `tests/db/template-clarify-db.test.ts` | реалізовано |
| AC-EDITOR-13 | скасування видалення секції — секція й 3 задачі лишаються | `src/app/templates/[id]/edit/editor.tsx` (ConfirmRemove) | `tests/templates/editor-client.test.tsx` | реалізовано |
| AC-EDITOR-14 | підтверджене видалення секції — зникає з незбережених змін, версія 1 без змін | `src/app/templates/[id]/edit/editor.tsx` (ConfirmRemove), `src/app/templates/[id]/edit/actions.ts` (removeSection) | `tests/db/template-clarify-db.test.ts`, `tests/templates/editor-client.test.tsx` | реалізовано |
| AC-EDITOR-15 | секція без задач — «Every section needs at least one task», версії немає | `supabase/migrations/20261027174403_template_names_and_checks.sql` (save_template_version, EMPTY_SECTION), `src/lib/templates/format.ts` (saveErrorMessage) | `tests/db/template-clarify-db.test.ts`, `tests/templates/editor.test.tsx` | реалізовано |
| AC-EDITOR-16 | менеджер на сторінці шаблону без версії — «Template not found» | `src/app/templates/[id]/page.tsx` | `tests/templates/clarify-pages.test.tsx` | реалізовано |
| AC-EDITOR-17 | менеджер без збережених шаблонів — «No templates yet. An administrator creates them.» | `src/app/templates/page.tsx`, `src/lib/templates/format.ts` (NO_TEMPLATES_MANAGER) | `tests/templates/clarify-pages.test.tsx` | реалізовано |
| AC-EDITOR-18 | список версій без версій — «No versions yet. Save the template to create version 1.» | `src/app/templates/[id]/versions/page.tsx`, `src/lib/templates/format.ts` (NO_VERSIONS) | `tests/templates/clarify-pages.test.tsx` | реалізовано |
| AC-EDITOR-19 | порожня назва нового шаблону — «Enter a template name» | `src/app/templates/actions.ts` (createTemplate) | `tests/templates/editor.test.tsx` | реалізовано |
| AC-EDITOR-20 | задача з порожньою назвою — «Every section and task needs a name», версії немає | `supabase/migrations/20261027174403_template_names_and_checks.sql` (save_template_version, NO_NAME), `src/app/templates/[id]/edit/actions.ts` (renameTask) | `tests/db/template-clarify-db.test.ts`, `tests/templates/editor.test.tsx` | реалізовано |
| AC-EDITOR-21 | перейменування зберігається з версією 2, менеджер бачить нову назву | `supabase/migrations/20261027174403_template_names_and_checks.sql` (template_drafts, save_template_version), `src/app/templates/[id]/edit/actions.ts` (renameTemplate) | `tests/db/template-clarify-db.test.ts`, `tests/templates/editor.test.tsx` | реалізовано |
| AC-EDITOR-22 | ран показує назву шаблону з версії, з якої його запущено | `supabase/migrations/20261027174403_template_names_and_checks.sql` (runs.template_name, launch_run), `src/app/runs/[id]/page.tsx`, `src/app/page.tsx` | `tests/db/template-clarify-db.test.ts`, `tests/templates/clarify-pages.test.tsx` | реалізовано |
| AC-EDITOR-23 | новий шаблон з наявною назвою (регістр, пробіли) — «A template with this name already exists» | `supabase/migrations/20261027174403_template_names_and_checks.sql` (templates_name_unique), `src/app/templates/actions.ts` (createTemplate) | `tests/db/template-clarify-db.test.ts`, `tests/templates/editor.test.tsx` | реалізовано |
| AC-EDITOR-24 | перейменування на наявну назву — повідомлення, версії немає | `supabase/migrations/20261027174403_template_names_and_checks.sql` (save_template_version, DUPLICATE_NAME) | `tests/db/template-clarify-db.test.ts`, `tests/templates/editor.test.tsx` | реалізовано |
| AC-EDITOR-25 | зміну не збережено — «Your last change was not kept. Try again.», задача лишається | `src/app/templates/[id]/edit/editor.tsx` (Editor, KeepContext), `src/app/templates/[id]/edit/keep.ts` | `tests/templates/editor-client.test.tsx` | реалізовано |
| AC-EDITOR-26 | відвідувач без входу змінює шаблон напряму — відхилено, вхід, шаблон без змін | `src/lib/auth/require-role.ts` (denyUnlessAdmin), `supabase/migrations/20261027174403_template_names_and_checks.sql` (GRANT лише authenticated) | `tests/db/template-clarify-db.test.ts`, `tests/templates/editor.test.tsx` | реалізовано |
| AC-EDITOR-27 | ран до появи версій — «Template version 1» і задачі на момент запуску | `supabase/migrations/20261027174403_template_names_and_checks.sql` (runs.template_version = 1), `src/lib/templates/format.ts` (runVersionLabel) | `tests/templates/versions-pages.test.tsx` | реалізовано |
| AC-EDITOR-28 | перенесення задачі в іншу секцію зберігається з новою версією | `src/app/templates/[id]/edit/actions.ts` (moveTaskToSection), `src/app/templates/[id]/edit/editor.tsx` (SectionSelect) | `tests/db/template-clarify-db.test.ts`, `tests/templates/editor.test.tsx` | реалізовано |
| AC-EDITOR-29 | менеджер напряму отримує лише поточну версію, без старих версій і незбережених змін | `supabase/migrations/20261027174403_template_names_and_checks.sql` (template_drafts — лише admin), `supabase/migrations/20261025140800_template_versions.sql` (RLS робочої копії й версій) | `tests/db/template-clarify-db.test.ts` | реалізовано |
