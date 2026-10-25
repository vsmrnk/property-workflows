# Tasks

Вертикальні задачі: міграція/RLS + функція Postgres + server action/сторінка + тест. Кожна закінчується рядком
«Done when» з AC ID; перевірка — `npm test`, `npm run ac:coverage`, `npm run check:design`, `npm run check:actions`.

## 1. Версії шаблону: модель, збереження, запуск з версії, список версій (PR «Реалізація» 1)

- [x] 1.1 Міграція `…_template_versions.sql` (D1–D7): робоча копія лише для admin, колонки `templates`, тригери
  незбережених змін, `template_versions` (select лише admin), `save_template_version`, `launch_run` з поточної версії
  (+ відкидання призначень поза версією, обрізання пробілів), `runs.template_version`, версія 1 для наявних даних.
  Done when: AC-EDITOR-03, AC-EDITOR-06 — збереження створює версію, ран іде за версією запуску; тести зрізу 1 (`tests/db/runs-*.test.ts`) зелені.
- [x] 1.2 Тести бази з AC ID на кожен AC, що перевіряється в базі, зокрема відмовні: перевіряють і відмову, і незмінні
  дані (`asService`).
  Done when: AC-EDITOR-02, AC-EDITOR-03, AC-EDITOR-04, AC-EDITOR-06, AC-EDITOR-07, AC-EDITOR-08, AC-EDITOR-09,
  AC-DSYS-03.
- [x] 1.3 Сторінки: `/templates` (U2), `/templates/[id]/versions` (U4, U5), «Template version N» на сторінці рану
  (U6), форма запуску з поточної версії (U7), навігація «Templates» (U1).
  Done when: AC-EDITOR-05 (формат і порядок), AC-EDITOR-06 (на сторінці), AC-EDITOR-07 (відмова на сторінці).
- [x] 1.4 Мутаційна перевірка: таблиця «AC → що прибрали → який тест упав» в описі PR; два червоні прогони CI
  (`template_versions_select_admin` → `true`; без перевірки ролі в `save_template_version`) і revert.
  Done when: AC-EDITOR-07, AC-EDITOR-08 — тести червоні без політики й перевірки ролі, зелені після revert.
- [x] 1.5 Рядки `docs/conformance.md` для AC задачі.
  Done when: AC-EDITOR-02, AC-EDITOR-03, AC-EDITOR-05, AC-EDITOR-06, AC-EDITOR-07, AC-EDITOR-08, AC-EDITOR-09,
  AC-DSYS-03 — «реалізовано» з шляхами коду й тестів, `npm run ac:coverage` зелений.

## 2. Редактор шаблону з автозбереженням (PR «Реалізація» 2)

- [ ] 2.1 `src/lib/auth/require-role.ts` (`requireAdmin`: `getClaims` + роль з `profiles`); Server Actions редактора:
  створити шаблон, додати/перейменувати/перемістити/прибрати секцію й задачу, позначка required, «Save».
  Done when: AC-EDITOR-01, AC-EDITOR-08 — дія admin пише робочу копію й ставить позначку; дія менеджера — без запису.
- [ ] 2.2 Сторінка `/templates/[id]/edit` (U3) і `/templates/new`; відмова менеджеру (U5).
  Done when: AC-EDITOR-01, AC-EDITOR-03, AC-DSYS-02 — редактор з позначкою й «Save»; менеджеру — «Not enough rights».
- [ ] 2.3 Тести дій і сторінок: дія пише робочу копію й ставить позначку; менеджер — відмова без запису; «Save» —
  повідомлення AC-EDITOR-04.
  Done when: AC-EDITOR-01, AC-EDITOR-04 (повідомлення), AC-DSYS-02.
- [ ] 2.4 Рядки `docs/conformance.md`; скріни за ролями `docs/img/ws7-role-*`; archive `impl-template-versions`.
  Done when: AC-EDITOR-01, AC-EDITOR-04, AC-DSYS-02 — «реалізовано»; усі AC зрізу 2 у `docs/conformance.md` мають
  чесний статус.
