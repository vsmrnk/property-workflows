# Tasks

Вертикальні задачі: таблиця/RLS + функція Postgres + server action/сторінка + тест. Кожна закінчується рядком
«Done when» з AC ID; перевірка — `npm test`, `npm run ac:coverage`.

## 1. Запуск шаблону для кейсу (PR «Реалізація» 1)

- [x] 1.1 Міграція ролей `manager`/`admin` (дані → default → constraint); `supabase/demo-users.json` (адміністратор,
  менеджери A, B, C).
  Done when: AC-RUN-05, AC-RUN-06 — ран адміністратора й менеджера має менеджером того, хто запустив.
- [x] 1.2 Міграція `templates`, `template_sections`, `template_tasks`, `runs`, `run_tasks` з RLS і GRANT; функція
  `launch_run`; сид шаблону «Tenant move-in»; тестова база PGlite; тести.
  Done when: AC-RUN-01, AC-RUN-02 — ран із 5 задачами «to do», зміна шаблону ран не змінює.
- [x] 1.3 `src/lib/runs/case-name.ts` + перевірка в `launch_run`; сторінка `/runs/new` і server action; тести.
  Done when: AC-RUN-03, AC-RUN-07 — «Enter a case name», «Case name must be at most 100 characters», ран не створено.
- [x] 1.4 Виконавці на старті: `p_assignments`, `list_assignable_users()` (тимчасово, Q3 #5); вибір виконавця на
  `/runs/new`; тести.
  Done when: AC-RUN-04, AC-RUN-08, AC-RUN-09.

## 2. Виконання задач і прогрес (PR «Реалізація» 2)

- [ ] 2.1 `mark_task_done`, колонковий GRANT і політика update; кнопка «Mark as done» на `/runs/[id]`; тести.
  Done when: AC-TASK-01, AC-TASK-02, AC-TASK-03, AC-TASK-07.
- [ ] 2.2 Тригер завершення рану; тест.
  Done when: AC-TASK-04 — третя обов'язкова задача «done» → ран «completed».
- [ ] 2.3 `src/lib/runs/progress.ts`; прогрес і статуси задач на `/runs/[id]`, прогрес у списку на `/`; тести.
  Done when: AC-TASK-05, AC-TASK-08, AC-TASK-09.
- [ ] 2.4 Видимість ранів (RLS `can_see_run`), `notFound()` для чужого рану (тимчасово, Q2 #4); тест.
  Done when: AC-TASK-06.
- [ ] 2.5 Запис екрана з прод-URL (вхід синтетичним користувачем, запуск шаблону, позначка задачі, прогрес);
  archive `impl-run-launch`.
  Done when: усі AC зрізу — «реалізовано» в `docs/conformance.md`, `npm run ac:coverage` зелений.
