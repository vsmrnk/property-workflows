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

- PR воріт: https://github.com/vsmrnk/property-workflows/pull/34 (розбір fallow — в описі)
- Зелений `quality` на `main`: https://github.com/vsmrnk/property-workflows/actions/runs/41208090458 (коміт `2360f2e`)
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

### Рівень для кожного AC

| AC | Де живе правило | Рівень | Чому | Тест |
|---|---|---|---|---|
| AC-EDITOR-07 | політика RLS `template_versions_select_admin` (`supabase/migrations/20261025140800_template_versions.sql:40`); сторінка версій — перевірка ролі й текст відмови | база (PGlite) + unit сторінки + e2e | відмова — правило бази: лише тест під роллю менеджера на справжніх міграціях доводить «no versions»; текст «Not enough rights» — на сторінці | `tests/db/template-versions-db.test.ts:228`, `tests/templates/versions-pages.test.tsx:92`, `tests/e2e/template-versions.spec.ts:17` |
| AC-EDITOR-09 | `revoke all … from anon` і явні `grant` (лише `authenticated`) на таблиці шаблону; `revoke execute … save_template_version … from public, anon`; редирект на `/login` у сторінці редактора | база (PGlite) + e2e | «no content of the template» для відвідувача тримають GRANT, а не код сторінки; «sign-in page» видно лише в браузері | `tests/db/template-versions-db.test.ts:263`, `tests/e2e/editor-access.spec.ts:10` |
| AC-EDITOR-18 | сторінка версій: порожній стан замість таблиці; текст — `NO_VERSIONS` у `src/lib/templates/format.ts:57` | unit сторінки + e2e | порожній стан — суто інтерфейс, даних не змінює | `tests/templates/clarify-pages.test.tsx:107`, `tests/e2e/template-versions.spec.ts:65` |

Очікування в усіх тестах — дослівний текст «Тоді» з вимоги PM («Not enough rights», «No versions yet. Save the template
to create version 1.»), а не константи з коду під тестом.

### Покриття

`npm run test:coverage` (Vitest, без тестів бази й e2e у звіті коду сторінок не видно — вони перевіряють SQL і прод):

| Файл за AC | Рядки | Гілки | Чим доведено, якщо 0 % |
|---|---|---|---|
| `src/app/templates/[id]/versions/page.tsx` (07, 18) | 100 % | 64.28 % | — |
| `src/app/templates/[id]/edit/page.tsx` (09) | 100 % | 61.11 % | — |
| `src/lib/auth/require-role.ts` (07) | 100 % | 58.33 % | — |
| `src/lib/templates/format.ts` (07, 18) | 90 % | 66.66 % | — |
| `src/proxy.ts` (09: оновлення сесії перед редиректом) | 0 % | — | e2e: `tests/e2e/editor-access.spec.ts` (відвідувач без входу бачить сторінку входу на проді) |
| `supabase/migrations/20261025140800_template_versions.sql` (07, 09) | — | — | SQL: `tests/db/template-versions-db.test.ts` на PGlite + мутанти E1–E3 нижче |

Підлога покриття (90/85/90/90 на файл) — лише доменні `src/lib/runs/case-name.ts` і `src/lib/runs/progress.ts`; на
файли цих AC поріг не ставимо (гілки сторінок — `?? []` і `?.` для відповідей Supabase).

### Доказ мутацією

| Мутант (файл:рядок, що змінено) | AC під загрозою | До | Тест, посилений з тексту AC | Після |
|---|---|---|---|---|
| E1 `…template_versions.sql:41` політика `using ((select private.current_app_role()) = 'admin')` → `using (true)` | AC-EDITOR-07 | убитий з першого прогону | `tests/db/template-versions-db.test.ts:228`: менеджер бачить 0 версій «Tenant move-in» з версіями 1 і 2 | KILLED |
| E2 `…template_versions.sql:37` `grant select … to authenticated` → `to authenticated, anon` | AC-EDITOR-09 | убитий з першого прогону | `tests/db/template-versions-db.test.ts:263`: відвідувач — `permission denied` на кожній таблиці шаблону | KILLED |
| E3 `…template_versions.sql:192` `revoke execute … from public, anon` → `from anon` | AC-EDITOR-09 | убитий з першого прогону | той самий тест: виклик `save_template_version` без входу — `permission denied`, версій як і було — 1 | KILLED |
| T1 `src/app/templates/[id]/versions/page.tsx:15` `if (user.role !== "admin")` → `if (false)` | AC-EDITOR-07 | убитий з першого прогону | `tests/templates/versions-pages.test.tsx:92`: заголовок «Not enough rights», 0 рядків версій, запиту до `template_versions` немає | KILLED |
| T2 `src/app/templates/[id]/versions/page.tsx:37` `length === 0` → `length < 0` | AC-EDITOR-18 | убитий з першого прогону | `tests/templates/clarify-pages.test.tsx:107`: «No versions yet. Save the template to create version 1.» і жодної таблиці | KILLED |

- Stryker 10.1.1 (`npm run mutation:ts -- --mutate src/lib/templates/format.ts`): 75.71 % (з покриттям 89.83 %) —
  46 убито, 7 timeout, 6 вижили, 11 без покриття. Рядки 3 і 57 (тексти AC-07 і AC-18) — усі мутанти вбиті (тест
  порівнює з дослівним текстом). Вижилі — у `saveErrorMessage` (рядки 66–69: `?.` → `.` і `if (true)` на
  `NO_REQUIRED_TASK`), без покриття — рядки 70–72 (`NOT_ALLOWED`, `NO_CHANGES`, запасний текст) і рядок 38: це
  збереження версії (AC-EDITOR-04/15/24), не ці 3 AC. Сторінки Stryker не мутує (`mutate` — лише `src/lib`), тому межі
  на сторінці — ручні мутанти T1, T2.
- SQL-мутації (`npm run mutation:sql -- --markdown`): E1, E2, E3 — KILLED (3 з 3); ручні TS-мутанти
  (`node scripts/mutation-check.mjs --kind ts`): T1, T2 — KILLED (2 з 2).
- Еквівалентні мутанти: немає. Мутант «прибрати `revoke … from anon`» свідомо не взято: у гарнесі PGlite немає default
  privileges Supabase, тож він нічого б не відкрив і доказом не був би (див. коментар у `scripts/mutants.mjs`).

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

- PR з вадами (не злитий, закритий): https://github.com/vsmrnk/property-workflows/pull/35
- Ключ і таблиця: https://github.com/vsmrnk/property-workflows/pull/35#issuecomment-6544252242

| # | Вада (ключ) | CodeRabbit | `/code-review high` |
|---|---|---|---|
| 1 | права в даних: `supabase/migrations/20261031140000_template_version_counts.sql:4` — `public.template_version_count` `security definer` без `set search_path = ''` і без перевірки ролі, `grant execute … to authenticated` → менеджер бачить кількість версій в обхід RLS (AC-EDITOR-07) | знайшов, але як **Minor**: «**Authorization Bypass** … CWE-862»; про `search_path` — нічого | знайшов: «SECURITY DEFINER and granted to every `authenticated` user, so it bypasses the admin-only RLS policy»; «CLAUDE.md violation: … without `set search_path = ''`» |
| 2 | тести: `tests/db/template-versions-db.test.ts:235` — `toHaveLength(0)` → `toBeDefined()` у тесті AC-EDITOR-07 | знайшов: «`toBeDefined()` проходить і тоді, коли менеджер отримує версії» | знайшов: «weakened from `toHaveLength(0)` to `toBeDefined()`, so the test passes even if managers can read every version» |
| 3 | логіка (межа): `src/app/templates/page.tsx:115` — «Versions» лише при `count > 1` (AC-EDITOR-05, -18) | знайшов: «показуйте його для всіх адміністраторів, незалежно від кількості версій» | знайшов: «Off-by-one in the threshold: `> 1` also hides the link for templates with exactly one saved version» |
| П | приманка: `isAdmin(user)` замість `user.role !== "admin"` (поведінка та сама) | без хибної тривоги — коментарів немає | без хибної тривоги — лише «The admin check now lives in three places» (дублювання) |

- Інші знахідки:
  - CodeRabbit: немає UI-тесту на посилання «Versions» — слушна;
  - `/code-review`: проковтнута помилка `rpc` (`data ?? 0`) — слушна;
  - `/code-review`: N+1 `rpc` замість `template_versions(count)` — слушна;
  - `/code-review`: не оновлено рядок `conformance.md` — слушна;
  - `/code-review`: ручна правка `database.types.ts` — слушна дрібниця;
  - шуму немає.
- Правило, що закриває пропуск: `AGENTS.md`, розділ «База даних» → «Рецензія міграцій» (`security definer` у `public` чи без `set search_path = ''` — must fix) — https://github.com/vsmrnk/property-workflows/pull/36, https://github.com/vsmrnk/property-workflows/commit/42e29e283cf310b11dbf0d3017b59d49ce99e24b
- Повторний прогін (гілку оновлено з main із правилом): https://github.com/vsmrnk/property-workflows/pull/35#issuecomment-6544589909
  - `/code-review high` цитує правило й ставить must fix: «AGENTS.md, section 'База даних': "нова чи змінена функція `security definer` у схемі `public` або будь-яка функція `security definer` без `set search_path = ''` — помилка рівня «must fix»"».
  - CodeRabbit (`full review`): нових inline-коментарів не дав, а серйозність наявного не підвищив. `search_path` назвав лише в pre-merge check «Міграції: RLS, Grant і політики» (Warning, не блокує): «`public.template_version_count` … має `security definer`, розміщена у схемі `public` і не містить `set search_path = ''`. Це порушує вимогу для кожної нової міграції». Тож для CodeRabbit правило не підняло серйозність. Запобіжником від D1–D2 лишаються тест AC-EDITOR-07 і мутант E1 (розділ B).
