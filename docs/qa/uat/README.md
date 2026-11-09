# UAT на проді (WS8–WS9, трек C)

Специфікації — `tests/e2e/*.spec.ts`, по одному `test` на AC; звіти прогонів — `docs/qa/uat/<YYYY-MM-DD>/`
(`report.md`, `manifest.json`, `frames/`). Відео, trace, HTML-звіт і `playwright/.auth/` у git не кладемо.
Звіт негативних контролів (`npm run uat:nc`) — поруч, у `<YYYY-MM-DD>/negative-controls/` (копія
`test-results/uat-report-nc/`). Після копіювання замініть у `manifest.json` поля `screenshot`
`test-results/uat-report-nc/frames/…` на `docs/qa/uat/<YYYY-MM-DD>/negative-controls/frames/…`: `test-results/` у git немає.

| AC | Специфікація | Роль | Пише в базу |
|---|---|---|---|
| AC-EDITOR-07 | `tests/e2e/template-versions.spec.ts` | manager-b@example.test (+ admin для звірки «Дано») | ні |
| AC-EDITOR-09 | `tests/e2e/editor-access.spec.ts` | відвідувач без входу (+ admin для звірки «Дано») | ні |
| AC-EDITOR-18 | `tests/e2e/template-versions.spec.ts` | admin@example.test | ні |
| AC-VENDOR-01 | `tests/e2e/vendor-access.spec.ts` | менеджер A (`uat-…-manager-a`), вендор X у виборі | так (новий ран) |
| AC-VENDOR-02 | `tests/e2e/vendor-access.spec.ts` | менеджер A (`uat-…-manager-a`) | ні (дані — setup) |
| AC-VENDOR-03 | `tests/e2e/vendor-access.spec.ts` | вендор V (`uat-…-vendor-v`) (+ менеджер A для звірки «Дано») | ні (дані — setup) |
| AC-VENDOR-04 | `tests/e2e/vendor-access.spec.ts` | вендор V | ні (дані — setup) |
| AC-VENDOR-05 | `tests/e2e/vendor-access.spec.ts` | вендор Y (`uat-…-vendor-y`, власний ран) (+ менеджер A, крок 5 сценарію PM) | так (позначка задачі) |
| AC-VENDOR-06 | `tests/e2e/vendor-access.spec.ts` | вендор V | ні (дані — setup) |
| AC-VENDOR-07 | `tests/e2e/vendor-access.spec.ts` | вендор V (прямий запит supabase-js у Node) + менеджер A (сторінка рану) | ні (запит відхилено) |
| AC-VENDOR-08 | `tests/e2e/vendor-access.spec.ts` | вендор V | ні (дані — setup) |
| AC-VENDOR-09 | `tests/e2e/vendor-access.spec.ts` | вендор V (прямий запит supabase-js у Node) | ні (запит відхилено) |
| AC-VENDOR-10 | `tests/e2e/vendor-access.spec.ts` | вендор W (`uat-…-vendor-w`, без задач) | ні (дані — setup) |
| NC-1 (негативний контроль AC-EDITOR-07) | `tests/e2e/negative-controls.spec.ts` | manager-b@example.test | ні |
| NC-2 (негативний контроль AC-VENDOR-03) | `tests/e2e/negative-controls.spec.ts` | вендор V (`uat-…-vendor-v`) | ні (дані — setup) |

## Дані «Дано» на проді (готує людина в UI, один раз)

Тести лише читають: вони перевіряють «Дано» й падають з поясненням, якщо даних немає, але самі їх не створюють.

1. **AC-EDITOR-07:** «Tenant move-in» має версії 1 і 2 (з 09.11 — ще й 3). Увійти як `admin@example.test` → Templates → Edit
   «Tenant move-in» → внести будь-яку зміну (напр. додати задачу) → Save. На сторінці Versions — «Version 2» і «Version 1» (на проді з 09.11 — ще й «Version 3»; тест
   перевіряє, що 1 і 2 серед них).
2. **AC-EDITOR-18:** новий шаблон «Repair» без жодної версії. Templates → New template → назва `Repair` → Create.
   **Не натискати Save** у редакторі: інакше з'явиться версія 1.

## Дані «Дано» зрізу 3 (створює проєкт `setup`, прибирає `cleanup`)

Людина нічого не готує: усі AC-VENDOR-* — `@writes`, потрібен `SUPABASE_SECRET_KEY` у `.env.local`. Проєкт `setup`
(`tests/e2e/auth.setup.ts`, без відео й trace — паролі й токени на кадри не потрапляють) створює синтетичних
`uat-<прогін>-manager-a`, `-vendor-v`, `-vendor-x`, `-vendor-y`, `-vendor-w@example.test` з випадковими паролями, входить
кожним через форму (стан сесії — `playwright/.auth/uat-<ключ>.json`) і від імені менеджера A через API запускає
«Tenant move-in» «Apartment 12, move-in» (задачі 3 і 4 → V), «Maintenance request» «Apartment 14, repair» (без V) і
окремий «Apartment 12, move-in» для Y (AC-VENDOR-05 позначає задачу, не зачіпаючи «Дано» інших AC). Дані прогону —
`playwright/.auth/uat-vendor.json`. `cleanup.teardown.ts` видаляє ці рани й задачі (`OWNED_ROWS` у
`tests/e2e/support/admin.ts`) і самих користувачів.

«Дано» «шаблон "Tenant move-in" з 5 задачами»: setup і тест AC-VENDOR-01 звіряють кількість задач і падають з поясненням,
якщо їх не 5. Підготовка UAT WS8 додала в шаблон задачу «Test» (версія 2, 6 задач); 09.11 адміністратор прибрав її в
редакторі й зберіг версію 3 — 5 задач seed.sql (Inspect the unit, Prepare the lease, Order cleaning, Hand over the keys,
Record meter readings). Версії 1 і 2 лишились — «Дано» AC-EDITOR-07 не змінилось. «Поточна версія 1» (AC-VENDOR-09):
на проді поточна — 3; номер версії йде вкладенням `given-template.json` і на «Тоді» не впливає (відмову запуску вендору
перевіряє `can_launch`, не версія).

## Запуск (у власному терміналі)

```bash
npx playwright install chromium                                      # один раз
npm run uat -- --url https://property-workflows.vercel.app           # 13 AC → docs/qa/uat/<дата>/
npm run uat:nc -- --url https://property-workflows.vercel.app        # NC-1, NC-2, очікуваний вердикт FAIL (R1)
```

Пароль ролей — `DEMO_USER_PASSWORD` з `.env.local` (вхід — у проєкті `setup` без запису відео й trace).
