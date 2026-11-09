# Tasks

Вертикальні задачі: міграція/RLS + функція Postgres + server action/сторінка + тест. Кожна закінчується рядком
«Done when» з AC ID; перевірка — `npm test`, `npm run ac:coverage`, `npm run check:design`, `npm run check:actions`,
`npm run mutation:sql`.

## 1. База: роль вендора й межі в базі (PR «Реалізація» 1, `task/vendor-db`)

- [x] 1.1 Тести бази з тексту AC — до міграції (червоний коміт): призначення вендора, email у виборі, рани й задачі
  вендора, прямі запити (чужа задача, запуск, шаблони).
  Done when: AC-VENDOR-01, AC-VENDOR-02, AC-VENDOR-07, AC-VENDOR-09 — тести з AC ID у `tests/db/vendor-access-db.test.ts`.
- [x] 1.2 Міграція `vendor_role` (D1–D6): роль `vendor`, `can_launch` / `is_assignable`, `launch_run`,
  `assignable_users`, `can_see_run`, `templates_select_visible`, `vendor_runs()`, `vendor_run_tasks()`; типи
  `database.types.ts`; вендори в `supabase/demo-users.json`; текст `ASSIGNEE_INVALID`.
  Done when: AC-VENDOR-01, AC-VENDOR-02, AC-VENDOR-07, AC-VENDOR-09 — тести зелені; рядки `docs/conformance.md`.
- [x] 1.3 SQL-мутанти відмов у `scripts/mutants.mjs` → `npm run mutation:sql` → KILLED.
  Done when: AC-VENDOR-02, AC-VENDOR-04, AC-VENDOR-07, AC-VENDOR-08, AC-VENDOR-09 — мутанти KILLED.

## 2. Сторінки вендора (PR «Реалізація» 2, `task/vendor-pages`)

- [x] 2.1 Компонентні тести з тексту AC — до коду (червоний коміт): список ранів вендора, порожній стан, сторінка
  рану, «Run not found», відмова на сторінках шаблонів, `launchRun` для вендора.
  Done when: AC-VENDOR-03, AC-VENDOR-04, AC-VENDOR-05, AC-VENDOR-06, AC-VENDOR-08, AC-VENDOR-10 — тести з AC ID у
  `tests/runs/vendor-pages.test.tsx`.
- [x] 2.2 Головна й сторінка рану для вендора (U2, U3), відмови й навігація (U4, U5), роль у `launchRun` (A1).
  Done when: AC-VENDOR-03, AC-VENDOR-04, AC-VENDOR-05, AC-VENDOR-06, AC-VENDOR-08, AC-VENDOR-09, AC-VENDOR-10 —
  «реалізовано» в `docs/conformance.md`, `npm run ac:coverage` зелений.

## 3. UAT на кожен AC (PR 3, `task/uat-vendor-access`)

- [ ] 3.1 `tests/e2e/vendor-access.spec.ts` — по `test` на кожен AC з дослівним «Тоді»; ролі вендора в
  `tests/e2e/auth.setup.ts`; синтетичні дані `uat-…@example.test` з прибиранням.
  Done when: AC-VENDOR-01…AC-VENDOR-10 — специфікація на кожен AC.
- [ ] 3.2 Прогін на проді й негативний контроль: `docs/qa/uat/<дата>/` (`report.md`, `manifest.json`, `frames/`).
  Done when: AC-VENDOR-01…AC-VENDOR-10 — рядок у звіті UAT на SHA `main`.

## 4. Докази й закриття зрізу (PR 4, `docs/proof-pack-ws9`)

- [ ] 4.1 `docs/qa/proof-pack.md` за шаблоном WS9 (proof pack WS8 → `docs/qa/proof-pack-ws8.md`), розділ «Не
  перевірено», ретро «що взяти з фабрики».
  Done when: AC-VENDOR-01…AC-VENDOR-10 — рядок proof pack на кожен AC.
- [ ] 4.2 Archive `impl-vendor-access`.
  Done when: AC-VENDOR-01…AC-VENDOR-10 — «реалізовано» в `docs/conformance.md`, `npm run ac:coverage` зелений.
