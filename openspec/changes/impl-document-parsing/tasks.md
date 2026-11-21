# Tasks

Вертикальні задачі: міграція/RLS + функція Postgres + Server Action/сторінка + тест. Кожна закінчується рядком
«Done when» з AC ID. Перевірки: `npm test`, `npm run ac:coverage`, `npm run check:design`, `npm run check:actions`,
`npm run check:boundary`, `npm run mutation:sql`. Живий виклик моделі ніколи не йде в CI.

## 1. База: записи документа рану й права (PR «Реалізація» 1, `task/document-records-db`)

- [x] 1.1 Тести бази з тексту AC пишуться до міграції (червоний коміт). Охоплення:
  - менеджер рану й адміністратор зберігають запис і бачать його з email і часом, найновіший першим;
  - вендор і менеджер-виконавець не бачать записів, а `can_parse_documents` для них `false`;
  - прямий виклик `save_run_document` вендором чи менеджером B → `NOT_ENOUGH_RIGHTS`, записів 0;
  - прямий `insert` у таблицю відхилено;
  - `anon` нічого не читає й не викликає.

  Done when: AC-DOCAI-04, AC-DOCAI-14, AC-DOCAI-15, AC-DOCAI-16 — тести з AC ID у `tests/db/run-documents-db.test.ts`.
- [x] 1.2 Міграція `document_records` (D1–D5): таблиця `run_documents`, `can_parse_documents`, `save_run_document`,
  політика, grants і revokes. Оновити типи `database.types.ts` і додати код `NOT_ENOUGH_RIGHTS` → «Not enough rights»
  у `src/lib/runs/messages.ts`.
  Done when: AC-DOCAI-04, AC-DOCAI-14, AC-DOCAI-15, AC-DOCAI-16 — тести зелені; `npm run spec:check` і
  `check-migration-order` зелені.
- [x] 1.3 SQL-мутанти відмов у `scripts/mutants.mjs`:
  - `can_parse_documents` пропускає виконавця;
  - `save_run_document` без перевірки права;
  - `grant insert` на `run_documents`;
  - select-політика `true`;
  - revoke без `anon`.

  Прогнати `npm run mutation:sql`.
  Done when: AC-DOCAI-14, AC-DOCAI-15, AC-DOCAI-16 — мутанти KILLED.

## 2. AI-шар: набір, схема, промпт, golden (PR «Реалізація» 2, `task/document-ai`)

- [x] 2.1 Залежності з точними версіями (`npm i --save-exact ai@7.0.162 @openrouter/ai-sdk-provider@3.1.0 zod@4.6.7
  server-only@0.0.1`) і ADR 0004 `docs/decisions/0004-ai-feature-openrouter.md` — у PR цієї задачі: PR «Специфікація»
  `docs/decisions/` не змінює. Скрипти `eval`, `ai:models`, `ai:quota`; `vitest.eval.config.mts`;
  `scripts/free-models.mjs`, `scripts/quota.mjs`; рядок `OPENROUTER_API_KEY=` у `.env.example`.
  Done when: AC-DOCAI-13 — `npm ci && npm test` зелений без ключа й без мережі; `tests/ai-key.test.ts` зелений.
- [x] 2.2 `tests/fixtures/golden/cases.json`: 10 кейсів PM з #40 (ID `GC-01`…`GC-10` = номери кейсів PM). `expected`
  береться з таблиці PM, а не з відповіді моделі; `rubric` описує зміст опису.
  Golden-тести (`it.each`) і тести чистих функцій пишуться до коду (червоний коміт):
  - телефон у будь-якій формі → `555-01xx`;
  - попередження про Total;
  - відмова скидає значення;
  - тип скидає чужі поля;
  - збої: не за схемою, 429, 200+429, таймаут.

  Done when: AC-DOCAI-01, AC-DOCAI-02, AC-DOCAI-06, AC-DOCAI-07, AC-DOCAI-08, AC-DOCAI-09, AC-DOCAI-10,
  AC-DOCAI-13 — тести з AC ID у `tests/golden.test.ts` і `tests/ai/parse.test.ts`.
- [x] 2.3 `src/lib/ai/{schema,models,openrouter,parse}.ts`, `src/lib/ai/prompts/{document,judge}.ts`,
  `src/lib/ai/scorer.ts`, `evals/golden.live.eval.ts` — з набору, під домен (AI1–AI5, AI8).
  `src/lib/ai/openrouter.ts` — єдиний файл, що читає ключ, з `import "server-only"`.
  `recorded.json` до запису — заглушки, позначені як заглушки.
  Done when: AC-DOCAI-01, AC-DOCAI-02, AC-DOCAI-06, AC-DOCAI-07, AC-DOCAI-08, AC-DOCAI-09, AC-DOCAI-10,
  AC-DOCAI-13 — реплей і тести чистих функцій зелені; TS-мутант попередження про Total KILLED.
- [ ] 2.4 Розробник (не агент) кладе ключ у `.env.local` і запускає `RECORD=1 npm run eval`. Результат — звіт
  `evals/reports/<дата>.md` з часткою успіху за моделлю й `recorded.json` зі справжніми відповідями (`modelId`, дата,
  `DOCUMENT_PROMPT_VERSION`).
  Done when: AC-DOCAI-09, AC-DOCAI-10 пройшли, а загалом ≥ 8 з 10 у живому звіті; у чаті курсу — «eval готовий».

## 3. Блок на сторінці рану (PR «Реалізація» 3, `task/document-block`)

- [x] 3.1 Компонентні тести й тести дій пишуться з тексту AC до коду (червоний коміт):
  - «Reading the document…» і вимкнена кнопка;
  - форма значень із «not found», примітками й попередженням;
  - «Save values» → запис у списку з email і датою «12 Nov 2026, 10:15»;
  - «Discard» → порожньо;
  - порожній текст;
  - файл `photo.png`;
  - асистент недоступний (без ключа) → ручне заповнення й збереження;
  - блоку немає для вендора й менеджера-виконавця;
  - `proposeValues` і `saveValues` від вендора чи менеджера B → «Not enough rights» (у `saveValues` — ще до перевірки
    значень), модель не викликана.

  Done when: AC-DOCAI-03, AC-DOCAI-04, AC-DOCAI-05, AC-DOCAI-11, AC-DOCAI-12, AC-DOCAI-13, AC-DOCAI-14,
  AC-DOCAI-15, AC-DOCAI-16 — тести з AC ID у `tests/runs/parse-document.test.tsx` і
  `tests/runs/document-actions.test.ts`.
- [x] 3.2 `src/app/runs/[id]/document-actions.ts` (A1, A2), `parse-document-block.tsx`, `saved-documents.tsx`,
  `src/components/ui/textarea.tsx`, `src/lib/documents/format.ts`; підключення до `page.tsx` (U1–U9).
  Done when: AC-DOCAI-01…AC-DOCAI-16 — «реалізовано» в `docs/conformance.md`; `npm run ac:coverage`,
  `check:design`, `check:actions`, `check:boundary` зелені.

## 4. Прод і UAT (PR 4, `task/uat-document-parsing`)

- [ ] 4.1 Розробник додає `OPENROUTER_API_KEY` у Vercel (Production і Preview) і робить redeploy. `/api/health` на
  SHA `main` має бути зеленим.
  Done when: AC-DOCAI-01 — на проді з ключем у Vercel блок пропонує значення для тексту AC-DOCAI-01 (гілка AI, а не
  ручне заповнення AC-DOCAI-13); `/api/health` показує SHA `main`.
- [ ] 4.2 `tests/e2e/document-parsing.spec.ts`: щонайменше AC-DOCAI-04 (людина змінює Urgency і зберігає) і обидві
  відмови — AC-DOCAI-16 (прямий виклик `save_run_document` від вендора на проді → помилка з кодом
  `NOT_ENOUGH_RIGHTS`, записів 0; текст «Not enough rights» для цього коду дають `saveValues` і `proposeValues` — це
  доводять `tests/runs/document-actions.test.ts`, бо форми, з якої вендор міг би викликати дію, на сторінці немає) і
  AC-DOCAI-14 (вендор не бачить блоку). Дослівне «Тоді», синтетичні дані `uat-…@example.test` з прибиранням.
  Прогін на проді й негативний контроль дають `docs/qa/uat/<дата>/`.
  Done when: AC-DOCAI-04, AC-DOCAI-14, AC-DOCAI-16 — рядок у звіті UAT на SHA `main`; `docs/conformance.md` посилається на звіт.
