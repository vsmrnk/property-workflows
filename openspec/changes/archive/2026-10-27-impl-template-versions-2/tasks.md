# Tasks

Вертикальні задачі: міграція/RLS + функція Postgres + server action/сторінка + тест. Кожна закінчується рядком
«Done when» з AC ID; перевірка — `npm test`, `npm run ac:coverage`, `npm run check:design`, `npm run check:actions`.

## 1. База: назва версії, перевірки збереження, рани (PR «Реалізація» 1)

- [x] 1.1 Міграція (D1–D6): `template_drafts`, `template_versions.name`, `runs.template_name`, версія 1 для старих
  ранів, перевірки `save_template_version`, порожні назви в робочій копії, унікальний індекс назви.
  Done when: AC-EDITOR-12, AC-EDITOR-15, AC-EDITOR-20, AC-EDITOR-21, AC-EDITOR-23, AC-EDITOR-24, AC-EDITOR-27.
- [x] 1.2 Тести бази з AC ID, зокрема прямі запити.
  Done when: AC-EDITOR-11, AC-EDITOR-22, AC-EDITOR-26, AC-EDITOR-29.

## 2. Сторінки й редактор (PR «Реалізація» 1)

- [x] 2.1 Сторінка шаблону для менеджера, порожні стани, форма запуску, назва шаблону в ранах (U1–U3).
  Done when: AC-EDITOR-02, AC-EDITOR-10, AC-EDITOR-16, AC-EDITOR-17, AC-EDITOR-18, AC-EDITOR-22.
- [x] 2.2 Редактор: назва шаблону, перенесення задачі, стан змін, тексти помилок, підтвердження видалення (U4).
  Done when: AC-EDITOR-03, AC-EDITOR-13, AC-EDITOR-14, AC-EDITOR-19, AC-EDITOR-25, AC-EDITOR-28.

## 3. Тема й повернення після входу (PR «Реалізація» 2)

- [x] 3.1 Вибір теми й токени (U5), DESIGN.md.
  Done when: AC-DSYS-05, AC-DSYS-06, AC-DSYS-07.
- [x] 3.2 `next` після входу (U6).
  Done when: AC-DSYS-08.
- [x] 3.3 Рядки `docs/conformance.md`, archive `impl-template-versions-2`.
  Done when: AC-EDITOR-02, AC-EDITOR-03, AC-EDITOR-10…AC-EDITOR-29, AC-DSYS-05…AC-DSYS-08 — «реалізовано» в
  `docs/conformance.md`, `npm run ac:coverage` зелений.
