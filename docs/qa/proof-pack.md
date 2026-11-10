# QA proof pack: роль vendor — свої задачі в чужих ранах (вимога 39)

<!--
Шаблон з koldovsky/2026-quitcode-09-software-factory-hw/materials/templates/proof-pack.template.md.
Proof pack WS8 (AC-EDITOR-07, 09, 18) — docs/qa/proof-pack-ws8.md.
Жодних паролів і пароля від accounts.zip. Акаунти — лише адреси *@example.test.
-->

- Прод-URL: https://property-workflows.vercel.app
- Зріз 3: менеджер призначає підрядника (vendor) виконавцем окремих задач рану, а підрядник бачить і позначає лише
  свої задачі — без шаблонів, чужих ранів і даних інших користувачів.
- Вимоги: https://github.com/solomchaak/property-workflows-spec · джерело: issues · знімок 2026-10-31
  (`/requirements-sync` 09.11: вимоги актуальні — https://github.com/vsmrnk/property-workflows/pull/42)
- Спека: https://github.com/vsmrnk/property-workflows/blob/4eb4705/openspec/specs/vendor-access/spec.md
- `/api/health` на момент UAT: sha `4eb4705`, db ok, 10.11.2026

## Доказ на кожен AC зрізу 3

Посилання на тести — на коміт `4eb4705` (`main` після злиття всіх задач). База — PGlite з RLS і ролями Supabase
(`tests/db/supabase-pglite.ts`); компонент — сторінки з підміненим клієнтом Supabase (Vitest, happy-dom); e2e — Playwright
на проді. «Здатен упасти»: SQL-мутанти — `npm run mutation:sql` 10.11 на `main` (16 з 16 вбито, вивід — в описі PR
proof pack), TS-мутанти V8, V9 — #44; червоні коміти — тести з тексту AC до коду: af4392b (#43), 92cae75 (#44).

| AC | Вид | Тест (рівень, посилання) | Здатен упасти | Специфікація UAT | Вердикт UAT і кадр | PR і SHA злиття |
|---|---|---|---|---|---|---|
| AC-VENDOR-01 | основний сценарій (призначення вендора) | база: [vendor-access-db.test.ts#L47](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/db/vendor-access-db.test.ts#L47), [#L208](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/db/vendor-access-db.test.ts#L208) | червоний коміт af4392b (позитивний AC, мутанта немає) | [vendor-access.spec.ts#L35](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/e2e/vendor-access.spec.ts#L35) | **NEEDS-HUMAN (R3)** — перевірки пройшли, агент не прочитав обрізані адреси; [кадр](https://github.com/vsmrnk/property-workflows/blob/26ae0c3/docs/qa/uat/2026-11-10/frames/AC-VENDOR-01-then-1.png) | [#43](https://github.com/vsmrnk/property-workflows/pull/43), `06b7968` |
| AC-VENDOR-02 | видимість даних (лише email у виборі) | база: [#L56](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/db/vendor-access-db.test.ts#L56) | V2 KILLED | [#L81](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/e2e/vendor-access.spec.ts#L81) | **NEEDS-HUMAN (R3)** — те саме: email V обрізано на кадрі; [кадр](https://github.com/vsmrnk/property-workflows/blob/26ae0c3/docs/qa/uat/2026-11-10/frames/AC-VENDOR-02-then-1.png) | #43, `06b7968` |
| AC-VENDOR-03 | відмова (чужі рани) + основний список | база: [#L66](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/db/vendor-access-db.test.ts#L66), [#L107](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/db/vendor-access-db.test.ts#L107), [#L192](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/db/vendor-access-db.test.ts#L192); компонент: [vendor-pages.test.tsx#L103](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/runs/vendor-pages.test.tsx#L103) | V5, V11, V12, V14 KILLED | [#L127](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/e2e/vendor-access.spec.ts#L127) | PASS (R6); [кадр](https://github.com/vsmrnk/property-workflows/blob/26ae0c3/docs/qa/uat/2026-11-10/frames/AC-VENDOR-03-then-1.png) | #43 `06b7968`, [#44](https://github.com/vsmrnk/property-workflows/pull/44) `4eb4705` |
| AC-VENDOR-04 | відмова (чужі задачі й email у рані) | база: [#L76](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/db/vendor-access-db.test.ts#L76); компонент: [#L129](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/runs/vendor-pages.test.tsx#L129), [#L182](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/runs/vendor-pages.test.tsx#L182) | V3, V4, V10 KILLED | [#L171](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/e2e/vendor-access.spec.ts#L171) | PASS (R6); [кадр](https://github.com/vsmrnk/property-workflows/blob/26ae0c3/docs/qa/uat/2026-11-10/frames/AC-VENDOR-04-then-1.png) | #43 `06b7968`, #44 `4eb4705` |
| AC-VENDOR-05 | основний сценарій (позначка своєї задачі) | база: [#L129](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/db/vendor-access-db.test.ts#L129), [#L146](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/db/vendor-access-db.test.ts#L146); компонент: [#L150](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/runs/vendor-pages.test.tsx#L150) | V5 KILLED | [#L415](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/e2e/vendor-access.spec.ts#L415) | PASS (R6); [кадр](https://github.com/vsmrnk/property-workflows/blob/26ae0c3/docs/qa/uat/2026-11-10/frames/AC-VENDOR-05-then-1.png) | #43 `06b7968`, #44 `4eb4705` |
| AC-VENDOR-06 | відмова (чужий ран за посиланням) | база: [#L95](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/db/vendor-access-db.test.ts#L95); компонент: [#L162](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/runs/vendor-pages.test.tsx#L162), [#L177](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/runs/vendor-pages.test.tsx#L177) | V5 KILLED | [#L228](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/e2e/vendor-access.spec.ts#L228) | PASS (R6); [кадр](https://github.com/vsmrnk/property-workflows/blob/26ae0c3/docs/qa/uat/2026-11-10/frames/AC-VENDOR-06-then-1.png) | #43 `06b7968`, #44 `4eb4705` |
| AC-VENDOR-07 | відмова (чужа задача напряму, оминаючи сторінки) | база: [#L158](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/db/vendor-access-db.test.ts#L158), [#L178](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/db/vendor-access-db.test.ts#L178) | V6, V13 KILLED | [#L260](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/e2e/vendor-access.spec.ts#L260) | PASS (R6); [кадр](https://github.com/vsmrnk/property-workflows/blob/26ae0c3/docs/qa/uat/2026-11-10/frames/AC-VENDOR-07-then-1.png) | #43, `06b7968` |
| AC-VENDOR-08 | відмова (заборонена роль: шаблони) | база: [#L101](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/db/vendor-access-db.test.ts#L101); компонент: [#L189](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/runs/vendor-pages.test.tsx#L189) | V7 (SQL), V9 (TS) KILLED | [#L322](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/e2e/vendor-access.spec.ts#L322) | PASS (R6); [кадр](https://github.com/vsmrnk/property-workflows/blob/26ae0c3/docs/qa/uat/2026-11-10/frames/AC-VENDOR-08-then-1.png) | #43 `06b7968`, #44 `4eb4705` |
| AC-VENDOR-09 | відмова (заборонена роль: запуск напряму) | база: [#L168](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/db/vendor-access-db.test.ts#L168); компонент і дія: [#L198](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/runs/vendor-pages.test.tsx#L198), [#L207](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/runs/vendor-pages.test.tsx#L207) | V1 (SQL), V8 (TS) KILLED | [#L354](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/e2e/vendor-access.spec.ts#L354) | PASS (R6); [кадр](https://github.com/vsmrnk/property-workflows/blob/26ae0c3/docs/qa/uat/2026-11-10/frames/AC-VENDOR-09-then-1.png) | #43 `06b7968`, #44 `4eb4705` |
| AC-VENDOR-10 | стан інтерфейсу (порожній стан) | база: [#L122](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/db/vendor-access-db.test.ts#L122); компонент: [#L119](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/runs/vendor-pages.test.tsx#L119), [#L172](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/runs/vendor-pages.test.tsx#L172) | V5 KILLED; червоний коміт 92cae75 | [#L469](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/e2e/vendor-access.spec.ts#L469) | PASS (R6); [кадр](https://github.com/vsmrnk/property-workflows/blob/26ae0c3/docs/qa/uat/2026-11-10/frames/AC-VENDOR-10-then-1.png) | #43 `06b7968`, #44 `4eb4705` |

Специфікація UAT (`tests/e2e/vendor-access.spec.ts`) — [#46](https://github.com/vsmrnk/property-workflows/pull/46), злито
в гілку #44 (`cba9fa3`), на `main` — у складі #44 (`4eb4705`).

## Не перевірено

| AC чи частина | Чому не перевірено | Що зроблено замість | Ризик на проді |
|---|---|---|---|
| AC-VENDOR-01, 02 — повні адреси на кадрі «Тоді» | Довгі синтетичні адреси `uat-<прогін>-vendor-x@example.test` обрізані CSS `truncate` у колонці «Assignee» і в списку вибору; агент-рецензент не звіряє їх з картинки (R3) | Детерміновані перевірки звіряють повний текст DOM: виконавці `[A, A, X, X, A]`, опції — лише email; повні адреси — у DOM-знімку траси (на кадрі й у відео обрізані). Рішення — за PM | Низький для AC; дрібна вада UX: довгі email у списку вибору й таблиці не видно повністю (підказки немає) |
| AC-VENDOR-09 — «Дано»: «Tenant move-in» з поточною версією 1 | На проді поточна версія — 3: версії лише зростають (2 і 3 додано підготовкою UAT WS8 і 09.11), відкочувати шаблон для тесту не будемо | Прогін на проді доводить відмову для поточної версії 3; «поточна версія 1» — тест бази [#L168](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/db/vendor-access-db.test.ts#L168) (шаблон seed з версією 1); примітка у звіті й `givenDeviation` у `manifest.json` (CodeRabbit #47) | Низький: відмову дає `can_launch` за роллю, номер версії на неї не впливає |
| `npm run users:demo` (`scripts/create-demo-users.mjs`, design.md D1): блокування акаунта в Auth, доки роль не перевірено, і видалення нового користувача, якщо роль `vendor` не встановилась | Скрипт працює з Auth Admin API продакшну; інтеграційного тесту на збій посеред створення чи зміни ролі немає | Код переглянуто CodeRabbit у #43 (923e02c: блокування й наявного акаунта, розблокування лише після перевірки ролі, помилка з поясненням, якщо видалення чи розблокування не вдалося) | Середній: якщо блокування чи видалення не спрацює, акаунт лишиться з роллю `manager` за замовчуванням і зможе запускати шаблони (AC-VENDOR-09) |
| Сторінки вендора на телефоні (від 360 px) і в темній темі | UAT зрізу 3 — лише Desktop Chrome, світла тема (System) | Ті самі компоненти, що й у ролі менеджера (AC-DSYS-*), — перевірено у WS7; `npm run check:design` зелений | Низький |
| Помилка бази на сторінках вендора (error boundary замість «No tasks…» / «Run not found») | На проді збій бази безпечно не відтворити | Компонентні тести [#L171–L186](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/runs/vendor-pages.test.tsx#L171) — помилка RPC кидається, а не ховається | Низький |
| AC-VENDOR-04, 06, 08, 09 — чужих назв немає й у вбудованих даних сторінки (payload RSC, відповіді клієнтських переходів і prefetch) | `toContainText` пропускає вміст `<script>`; e2e перевіряє текст сторінки, разом із прихованим (не підставленим) вмістом, але не payload. Перевірку відповідей RSC з декодуванням не додавали (CodeRabbit #49, рішення — не в PR, що лагодить нестабільний тест) | Payload сервер будує з тих самих запитів під сесією вендора; RLS не віддає чужих рядків — тести бази [04](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/db/vendor-access-db.test.ts#L76), [06](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/db/vendor-access-db.test.ts#L95), [08](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/db/vendor-access-db.test.ts#L101), [09](https://github.com/vsmrnk/property-workflows/blob/4eb4705/tests/db/vendor-access-db.test.ts#L168), SQL-мутанти V3/V4/V10, V5, V7, V1 KILLED | Низький: межа — у базі; окрема задача на перевірку payload — на рішення власника репо |
| Зміна ролі під час активної сесії (менеджер → вендор) у браузері | Роль змінює лише `service_role`; UAT не змінює ролей на проді | Тести бази: колишній менеджер не читає колишніх ранів і не позначає чужих задач (V13, V14 KILLED) | Низький: межа — у базі, сторінки читають роль на кожен запит |

## A. Вимоги й спека

- `/requirements-sync`: знімок 2026-10-31 — [#32](https://github.com/vsmrnk/property-workflows/pull/32); 09.11 —
  «Вимоги актуальні» (усі issues PM з тим самим `updatedAt`), зафіксовано в описі #42.
- Спека `add-vendor-access` і план `impl-vendor-access` — PR «Специфікація»:
  [#42](https://github.com/vsmrnk/property-workflows/pull/42) (`bff11db`).
- Зміна `clarify-vendor-access`: для WS9 не потрібна. PM 10.11 у командному чаті: приймання зрізу 3 у WS9 — за
  AC-VENDOR-01…10 у тексті до 10.11 (AC-VENDOR-07 і 08 — у старому, коротшому вигляді); AC-VENDOR-11…18 і AC-TASK-19,
  додані 10.11, у приймання WS9 не входять («у наступному оновленні»), звіти доповнювати не треба. Тому
  `/requirements-sync` після 10.11 не запускав: знімок 2026-10-31 — і є текст приймання.
- Питання PM: у вимозі #39 — «Немає»; неясні місця вже покриті питаннями в репо PM від 02.11
  (solomchaak/property-workflows-spec#41, #44, #49). До 06.11 (вікно уточнень) відповіді не було — рішення розробника
  в Assumptions `proposal.md` і `design.md` (U3–U5). PM закрив їх 10.11 рішеннями, що стали новими AC (#41 →
  AC-VENDOR-11, #44 → AC-VENDOR-13, #49 → AC-VENDOR-08 і 14) — поза прийманням WS9. Власних питань не ставив
  (`docs/spec-reading.md`, «Зріз 3»).

## B. Реалізація

| PR «Реалізація» | Задача з `tasks.md` | AC | Відповіді на знахідки CodeRabbit | `db-deploy` |
|---|---|---|---|---|
| [#43](https://github.com/vsmrnk/property-workflows/pull/43) | 1.1–1.3 (база: роль, RLS, `vendor_runs`, `vendor_run_tasks`, SQL-мутанти) | AC-VENDOR-01…10 (межі в базі) | 12 знахідок — відповідь у треді на кожну, виправлення в 923e02c | [42650177670](https://github.com/vsmrnk/property-workflows/actions/runs/42650177670) (міграція `20261109142910_vendor_role.sql` застосована) |
| [#44](https://github.com/vsmrnk/property-workflows/pull/44) (+ [#46](https://github.com/vsmrnk/property-workflows/pull/46)) | 2.1–2.2 (сторінки вендора), 3.1 (UAT-специфікація) | AC-VENDOR-03…06, 08…10 | 3 знахідки — виправлено; попередження pre-merge — коментар з поясненням | [42777984655](https://github.com/vsmrnk/property-workflows/actions/runs/42777984655) (нових міграцій немає) |
| [#45](https://github.com/vsmrnk/property-workflows/pull/45) | поза `tasks.md`: відгук викладача до WS8 (`accounts.txt` не в git, перевірка міграцій CodeRabbit — `error`) | — | 9 виправлено, 1 відхилено з аргументом (обов'язковий approve у соло-репо) | [42777940993](https://github.com/vsmrnk/property-workflows/actions/runs/42777940993) |
| [#47](https://github.com/vsmrnk/property-workflows/pull/47) (`26ae0c3`) | 3.2 (UAT на проді) | AC-VENDOR-01…10 | 2 знахідки — виправлено в e1ec009 (повні адреси лише в DOM; «Дано» AC-VENDOR-09 — версія 3); pre-merge «Тип PR» — коментар з поясненням | CI на `main`: [42797470344](https://github.com/vsmrnk/property-workflows/actions/runs/42797470344) (міграцій немає) |
| [#49](https://github.com/vsmrnk/property-workflows/pull/49) (`4d7015b`) | 3.2: нестабільний e2e (strict mode `locator("main")` під час потокового рендеру) | AC-VENDOR-04, 06, 08, 09 | 2 знахідки: 1 виправлено (1b265ac — видимий рядок після reload), 1 відхилено з аргументом (перевірка payload RSC → «Не перевірено») | — (міграцій немає) |
| [#50](https://github.com/vsmrnk/property-workflows/pull/50) | 3.2: відео «Тоді» з окремого контексту | AC-VENDOR-07 | інлайн-знахідок немає; pre-merge «Тип PR» (`scripts/**`) — коментар з поясненням | — |

- Ворота на `main` (`quality`): [42777984602](https://github.com/vsmrnk/property-workflows/actions/runs/42777984602)
  (коміт `4eb4705`); обов'язкові перевірки `solo-main` — spec, app, conformance, db-check, «Ворота: fallow audit»,
  «Покриття: доменна підлога», «Ворота: accounts.txt не в git» (додано 10.11 після зеленого job на `main`).
- Мутації: SQL і TS — `npm run mutation:sql` на `main` 10.11: **16 з 16 вбито** (E1–E4 зрізу 2, V1–V7, V10–V14 зрізу 3),
  таблиця «який тест упав» — в описі PR proof pack; TS-мутанти V8, V9 — **2 з 2** у #44. Stryker у зрізі 3 не
  запускали: межі — в базі (SQL-мутанти), сторінки — компонентні тести з червоним комітом.

## C. UAT на проді

- Звіт: https://github.com/vsmrnk/property-workflows/blob/26ae0c3/docs/qa/uat/2026-11-10/report.md — 13 AC
  (AC-VENDOR-01…10 + AC-EDITOR-07, 09, 18 повторно): PASS 11, NEEDS-HUMAN 2, FAIL 0.
- Відео: вкладення в описі [#47](https://github.com/vsmrnk/property-workflows/pull/47) — по одному на AC і NC (AC-VENDOR-07 — з окремого прогону, див. нижче).
- Рецензент: `claude-haiku-5-5`, суперечки → `claude-sonnet-5-5`; $0.0924 за прогін (з них $0.067 — два розбори
  Sonnet для AC-VENDOR-01, 02); ліміт `--max-budget-usd 0.50` на розбір.
- Негативний контроль (`npm run uat:nc`): NC-1 — для AC-EDITOR-07 тест навмисно чекає «Access denied» замість «Not
  enough rights»; NC-2 — для AC-VENDOR-03 чекає «Your tasks: 2 of 2 done» замість «0 of 2». Обидва — **FAIL (R1)**,
  агент перевірки не перекриває:
  https://github.com/vsmrnk/property-workflows/blob/26ae0c3/docs/qa/uat/2026-11-10/negative-controls/report.md
- Дані: `@writes` — синтетичні `uat-261110080639-{manager-a,vendor-v,vendor-x,vendor-y,vendor-w}@example.test` з
  випадковими паролями; «Прибирання»: видалено 5, лишилось 0, їхніх рядків — 0.
- Вада, знайдена під час прогону: `uat` і `uat:nc` писали відео в один `outputDir`, і Playwright стирав відео основного
  прогону — виправлено в #47 (`test-results/artifacts-nc/`), основний прогін повторено.
- Друга вада відео: в AC-VENDOR-07 «Тоді» показує сторінка менеджера A з окремого контексту (`browser.newContext()`),
  а опція `video` діє лише на контекст фікстури `page` — у звіт пішла 1 с порожньої сторінки. Виправлено в
  [#50](https://github.com/vsmrnk/property-workflows/pull/50) (вкладення «video: then»); відео AC-VENDOR-07 в описі #47
  — з окремого прогону лише цього AC на проді 10.11 (PASS). Кадр «Тоді» й вердикт — з основного прогону, не змінились.

### Приймання PM

| AC | Рішення PM | Посилання |
|---|---|---|
| AC-VENDOR-01 | чекає рішення (NEEDS-HUMAN) | звіт 10.11, розділ AC-VENDOR-01 |
| AC-VENDOR-02 | чекає рішення (NEEDS-HUMAN) | звіт 10.11, розділ AC-VENDOR-02 |
| AC-VENDOR-03…10 | чекає приймання (PASS) | звіт 10.11 |

Текст приймання — AC-VENDOR-01…10 зі знімка 2026-10-31 (повідомлення PM у командному чаті 10.11, розділ A).

## D. Прод і ретро

- `/api/health` після злиття всіх задач: sha `4eb4705`, db ok (10.11.2026).
- Нові ролі й акаунти: роль `vendor` — `vendor-v@example.test`, `vendor-w@example.test`, `pm-vendor@example.test`
  (`supabase/demo-users.json`). `accounts.zip` (D0.5) оновлено в цьому PR: ролі зрізів 1–3, AES-256, пароль курсу
  ніде не записаний; перевірка скрипта — правильний пароль дає вміст, хибний — відмову. Штатний `npm run accounts:zip`
  відмовляє, поки шлях `accounts.txt` є в історії git (#30 → прибрано в #40); паролі змінено 31.10, тому архів зібрано
  з ігнорованої копії через `--in`.
- `docs/conformance.md`: https://github.com/vsmrnk/property-workflows/blob/4eb4705/docs/conformance.md (рядки
  AC-VENDOR-01…10 — «реалізовано»; посилання на звіт UAT — у #47).

### Ретро: що б ми взяли з фабрики у свій звичайний процес

- Допуск: уже є — `spec:check`, `ac:coverage` (77/77) і `openspec validate --strict` у CI не пускають AC без сценарію,
  рядка матриці й тесту.
- Захищені тести: візьмемо — CODEOWNERS на `tests/db/` і `tests/e2e/` + перевірка в CI, що PR «Реалізація» не змінює
  тест з AC ID без мітки `tests-changed`; зараз захист — лише червоний коміт до коду.
- Приховані сценарії: не потрібно в соло-проєкті — автор тестів і коду той самий; негативні контролі NC-1, NC-2
  перевіряють, що конвеєр UAT справді вміє впасти.
- Мутації й повтор: уже є — `npm run mutation:sql` (16/16) і TS-мутанти на кожну відмову; візьмемо — запуск у CI на
  PR, що змінює `supabase/migrations/`, а не вручну.
- Рев'ю-спростування: уже є — CodeRabbit з відповіддю на кожну знахідку і рецензент UAT з ескалацією Haiku → Sonnet;
  урок 10.11: R3 через обрізаний текст на кадрі — візьмемо `title` з повним email у клітинках, щоб доказ читався з картинки.
- Пакет доказів з «Не перевірено»: уже є — цей файл; розділ «Не перевірено» знайшов відкат Auth без тесту.
- Рівні автономії: уже є — агент пушить і відкриває PR, зливає людина; UAT з записом у прод запускає людина.
- Бюджети: уже є — `--max-budget-usd 0.50` на розбір і вартість у звіті; візьмемо — сумарну межу на прогін у
  `scripts/uat/run.mjs`.
