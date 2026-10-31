# QA proof pack: редактор шаблону з версіями (вимога 20)

<!--
Шаблон з koldovsky/2026-quitcode-08-quality-hw/materials/templates/proof-pack.template.md.
Жодних паролів і пароля від accounts.zip. Акаунти — лише адреси *@example.test.
Цей файл — вхід для конвеєра WS9: на кожен AC видно, чим він доведений.
-->

- Прод-URL: https://property-workflows.vercel.app
- Вимоги: https://github.com/solomchaak/property-workflows-spec · джерело: issues · знімок 2026-10-31
- `/api/health` на момент UAT: sha `5cc1f43`, db ok, 31.10.2026

## 3 AC

Вимога PM — `requirements/20-edit-template-version-control.md` (solomchaak/property-workflows-spec, issue «Вимога» 20).

| AC | Вид | «Тоді» (дослівно з вимоги PM) |
|---|---|---|
| AC-EDITOR-07 | відмова в браузері (заборонена роль: менеджер) | Then B sees the message "Not enough rights" and no versions. |
| AC-EDITOR-09 | відмова в браузері (не увійшов) | Then the visitor sees the sign-in page and no content of the template. |
| AC-EDITOR-18 | стан інтерфейсу (порожній стан) | Then A sees the message "No versions yet. Save the template to create version 1." and no empty table. |

## A. Ворота

- PR воріт: <!-- …/pull/N — після відкриття -->
- Зелений `quality` на `main`: <!-- …/actions/runs/N — після злиття -->
- Обов'язкові перевірки в `solo-main` з <!-- дата -->: «Ворота: fallow audit», «Покриття: доменна підлога»
  («Порада: вразливі залежності» — лише порада, в ruleset не додаємо)

Що в воротах (`.github/workflows/quality.yml`, з `materials/gates` курсу):

- `fallow audit --base origin/main` — лише нові знахідки відносно `main` (успадковане не блокує PR); локально —
  `npm run gates` (lint + typecheck + audit).
- ESLint (`eslint.config.mjs`, блоки WS8): правила `@vitest/eslint-plugin` і `eslint-plugin-playwright`, заборона мокати
  власні модулі (`vi.mock("@/…")`). Два винятки з обґрунтуванням у рядку — моки Server Actions у тестах UI
  (`tests/runs/clarify.test.tsx`, `tests/templates/editor-client.test.tsx`): дія — мережева межа, саму дію перевіряють
  `tests/runs/actions.test.ts`, `tests/templates/editor.test.tsx` і SQL/RLS у `tests/db/`.
- Підлога покриття (`vitest.coverage.config.mts`, `npm run test:coverage`): 90 % рядків / 85 % гілок / 90 % функцій /
  90 % інструкцій на файл для доменних правил `src/lib/runs/case-name.ts` і `src/lib/runs/progress.ts` (обидва 100 %).
  Загалом по `src/` — 75 % рядків, 58 % гілок (`npm run coverage:summary`): сторінки й дії доводяться тестами дій,
  SQL/RLS і e2e, а не unit-покриттям.

Розбір першого повного прогону `fallow` (той самий — в описі PR воріт):

| Група знахідок | Скільки | Справжня / навмисна / хибна | Дія і причина |
|---|---|---|---|
| Невикористаний файл `src/lib/supabase/client.ts` (браузерний клієнт шаблону) | 1 | справжня, успадкована з шаблону | лишили: ворота — лише нове; прибрати — окремим PR, коли буде певність, що клієнтський Supabase не знадобиться |
| Невикористані `src/components/ui/dialog.tsx`, `alert-dialog.tsx` | 2 | навмисна | `ignoreFindings`: набір shadcn/ui дизайн-системи, DESIGN.md §5 — «поки не використовуються» |
| Невикористаний експорт `AC_ID_GLOBAL` у `scripts/lib/spec-lib.mjs` | 1 | справжня, код шаблону курсу | лишили: скрипт шаблону, виправлення — через «Оновлення шаблону» |
| Невикористаний експорт `ENTER_TEMPLATE_NAME` (`src/lib/templates/format.ts`) | 1 | справжня | виправлено: `src/app/templates/actions.ts` дублював рядок замість імпорту константи |
| Дублікати в `src/app/globals.css` | 1 група | навмисна | `duplicates.ignore`: блоки `:root[data-theme="dark"]` і `@media (prefers-color-scheme: dark)` мають бути однакові (AC-DSYS-07, тест їх звіряє) |
| Дублікати в `scripts/check-actions-claims.mjs`, `check-design-tokens.mjs`, `check-server-boundary.mjs` | кілька груп | навмисна (код курсу) | `duplicates.ignore`: самодостатні скрипти architecture.yml з курсу, не наш код |
| Дублікати в `src/app/templates/[id]/edit/actions.ts` | 6 груп | справжня | лишили з поясненням: повторюваний каркас дій (getClaims → denyUnlessAdmin → запис → revalidatePath); рефакторинг — окремим PR із тестами дій |
| Складність скриптів шаблону й курсу (`check-*`, `create-demo-users`) | — | навмисна (зовнішній код) | `health.ignore` |
| Складність сторінок `src/app/**` (`runs/new/page.tsx`, `editor.tsx`, `templates/page.tsx`, `runs/[id]/page.tsx` …) | 9 | справжня, але CRAP оцінено без покриття | лишили: сторінки доводяться e2e і тестами дій; рішення — після B (покриття й мутації) |

## B. Якість тестів

<!-- далі: рівень для кожного AC, покриття, Stryker, SQL-мутації -->

## C. UAT на проді

| AC | Специфікація | Тест (твердження) | Агент | Вердикт | Кадр |
|---|---|---|---|---|---|
| AC-EDITOR-07 | `tests/e2e/template-versions.spec.ts` | passed | Haiku: PASS | **PASS** (R6) | `docs/qa/uat/2026-10-31/frames/AC-EDITOR-07-then-1.png` |
| AC-EDITOR-09 | `tests/e2e/editor-access.spec.ts` | passed | Haiku: PASS | **PASS** (R6) | `docs/qa/uat/2026-10-31/frames/AC-EDITOR-09-then-1.png` |
| AC-EDITOR-18 | `tests/e2e/template-versions.spec.ts` | passed | Haiku: PASS | **PASS** (R6) | `docs/qa/uat/2026-10-31/frames/AC-EDITOR-18-then-1.png` |

- Звіт: `docs/qa/uat/2026-10-31/report.md`; PR — https://github.com/vsmrnk/property-workflows/pull/33
- Рецензент: `claude-haiku-5-5` (суперечки — `claude-sonnet-5-5`, не знадобився); $0.0053 за прогін
- Негативний контроль: NC-1 (`npm run uat:nc`, AC-EDITOR-07) — у тесті навмисно хибний текст «Access denied» замість
  «Not enough rights»; перевірка впала → **FAIL** (R1), хоча агент сказав PASS. Звіт —
  `docs/qa/uat/2026-10-31/negative-controls/report.md`
- Дані: лише читання (жоден AC нічого не пише; прибирання uat-*: видалено 0, лишилось 0)

### Приймання PM

| AC | Рішення PM | Посилання |
|---|---|---|
| AC-EDITOR-07 | <!-- ✅ / ❌ --> | |
| AC-EDITOR-09 | <!-- ✅ / ❌ --> | |
| AC-EDITOR-18 | <!-- ✅ / ❌ --> | |

## D. Eval рецензента

<!-- далі -->
