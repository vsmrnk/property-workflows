# Чекліст розробника, день 0

<!--
Заповнюєте ви одразу після заняття, у цьому порядку: власне репо, власні Supabase і Vercel, перший зелений CI, ruleset.
Мета — застосунок працює локально й на вашому прод-URL, міграції в базу застосовує лише CI, а в main усе йде через PR.
Для кожного пункту — доказ: посилання (run CI, PR, preview), назва змінної або знімок екрана в docs/img/
(без справжніх назв клієнта й людей: зображення spec:check не перевіряє).
ЗНАЧЕННЯ СЕКРЕТІВ І ПАРОЛІВ НІКОЛИ НЕ ПИШІТЬ — лише назви змінних і де вони задані.
Заповнений файл (розділи 1–6) — ваш перший PR, тип «Реалізація» (розділ 7): він же перевіряє ruleset. Посилання на сам
цей PR і на preview допишіть наступним PR. Пояснення кроків — README, «Шлях розробника».
Docker не потрібен: локально — лише npm run dev проти вашої бази; міграції на одноразовій базі перевіряє CI (db-check).
-->

Моє репо: https://github.com/vsmrnk/property-workflows · Прод-URL: https://property-workflows.vercel.app
Репо вимог PM: https://github.com/solomchaak/property-workflows-spec · Організація Supabase: особиста (Free)

## 1. Інструменти й репо

- [x] Node 24 (`node -v`), Git, GitHub CLI (`gh auth status`); OpenSpec CLI глобально тієї ж версії, що в `package.json`:
      `npm i -g @fission-ai/openspec@1.14.1` → `openspec --version` = `1.14.1` — Node v24.21.0, OpenSpec 1.14.1, gh (особистий акаунт)
- [x] Репо створено з шаблону (**Use this template → Create a new repository**): власник — ваш особистий акаунт, назва —
      `<team-slug>`, **Public** (ruleset на GitHub Free діє лише в публічних репо; PM у нотатці-порівнянні посилається на
      рядки вашого коду) — https://github.com/vsmrnk/property-workflows (Public, з koldovsky/2026-quitcode-06-project-template)
- [x] `git clone https://github.com/<dev>/<team-slug>.git` → `npm ci` → `cp .env.example .env.local`
      (у PowerShell: `Copy-Item .env.example .env.local`)
- [x] CodeRabbit (GitHub App) встановлено на це репо (github.com/apps/coderabbitai → Configure → Only select repositories) — Only select repositories → `vsmrnk/property-workflows`; рев'ю, напр. https://github.com/vsmrnk/property-workflows/pull/5
- [ ] (Якщо PM надіслав список справжніх назв клієнта особистим повідомленням) — локальний `product/denylist.local.txt`
      (у `.gitignore`; `npm run spec:check` читає його й значень не друкує)

## 2. Supabase: власна база

- [x] Організацію й проєкт створено у вашому акаунті (один із двох безкоштовних проєктів; регіон — найближчий) — особиста організація, проєкт `property-workflows`, Free
- [x] Authentication: «Allow new users to sign up» **вимкнено**, «Confirm email» **вимкнено**
      (точні назви й місце перемикачів перевірте в інтерфейсі) — [docs/img/auth-signups-email.png](img/auth-signups-email.png); перевірено API: спроба signup → `signup_disabled`
- [ ] (Після розділу 4, коли є прод-URL) Authentication → URL Configuration: Site URL = прод-URL Vercel; Redirect URLs
      `http://localhost:3000/**`, `https://*-<slug>.vercel.app/**` — <!-- знімок -->
- [x] `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`
      (Project Settings → API Keys; точну назву розділу перевірте в інтерфейсі) і `DEMO_USER_PASSWORD` (≥ 8 символів).
      Значення не комітимо й не вставляємо в чат — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `DEMO_USER_PASSWORD` — лише в `.env.local` (у .gitignore)

## 3. GitHub: environment `production` і секрети

- [x] Settings → Environments → `production` (якщо перший прогін CI вже створив його автоматично — відкрийте наявний;
      `Production`, яке створює Vercel для своїх деплоїв, — те саме середовище: регістр у назвах GitHub не розрізняє):
      **Deployment branches** = Selected branches → `main` — environment `production`, Deployment branches: Selected → `main`
- [x] Секрет environment `SUPABASE_DB_URL` = рядок **Session pooler** (порт **5432**, не 6543) з Supabase → **Connect**;
      пароль у рядку percent-encoded — секрет environment `SUPABASE_DB_URL` (Session pooler, 5432); секретів репозиторію немає
- [x] Запасний шлях (лише якщо `--db-url` не працює): секрети environment `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`,
      `SUPABASE_PROJECT_ID` (README, «Міграції в прод: запасний шлях») — не потрібно
- [ ] (Необов'язково) секрет репо `SPEC_DENYLIST` — ті самі справжні назви через кому, для CI

## 4. Vercel

- [x] Add New → Project → імпорт вашого репо, Node 24.x — https://property-workflows.vercel.app, Node 24.x — [docs/img/vercel-node.png](img/vercel-node.png)
- [x] Змінні Production і Preview — лише `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`;
      `SUPABASE_SECRET_KEY` — **ніколи** — [docs/img/vercel-env.png](img/vercel-env.png): лише дві `NEXT_PUBLIC_…`, Production and Preview
- [x] Settings → Deployment Protection → **Require Log In** вимкнено → Save (інакше PM і викладач не відкриють ваші preview;
      точну назву перемикача перевірте в інтерфейсі) — [docs/img/vercel-protection.png](img/vercel-protection.png)
- [x] Після змінних — редеплой; прод-URL відкривається — https://property-workflows.vercel.app — [docs/img/prod-login.png](img/prod-login.png)

## 5. База й перший зелений CI

- [x] Actions → CI → **Run workflow** (гілка `main`, `include_seed` ✓) → job `db-deploy` застосував першу міграцію й сид — https://github.com/vsmrnk/property-workflows/actions/runs/39117215282
- [x] `npm run users:demo` (синтетичні користувачі з `supabase/demo-users.json`) → `npm run dev` → `http://localhost:3000` →
      вхід як `admin@example.test` працює локально й на прод-URL
- [x] CI на `main` зелений: `spec`, `app`, `conformance`, `db-check`, `db-deploy` — https://github.com/vsmrnk/property-workflows/actions/runs/39117215282

## 6. Ruleset `solo-main` (лише після зеленого CI на `main`)

- [x] Settings → Rules → Rulesets → **New ruleset → Import a ruleset** → `solo-main.json` з курсового репо
      (`materials/rulesets/solo-main.json`) або вручну: target — гілка за замовчуванням (`main`); Restrict deletions;
      Block force pushes; Require a pull request — **0 approvals** (колег у вашому репо немає); Require status checks
      (джерело GitHub Actions, без «up to date»): `spec`, `app`, `conformance`, `db-check`; Allowed merge methods —
      **Squash** і **Merge**; Bypass list — **порожній** (навіть для власника); Enforcement — Active
      (точні назви полів перевірте в інтерфейсі) — ruleset `solo-main` імпортовано з `materials/rulesets/solo-main.json` (enforcement active, bypass порожній)

## 7. Перший PR (перевірка ruleset-у)

- [x] `git switch -c setup/bootstrap` → цей файл із доказами розділів 1–6 → push → `gh pr create --web` (тип «Реалізація»)
      → окремим коментарем `@coderabbitai review` — https://github.com/vsmrnk/property-workflows/pull/1
- [x] Поки перевірки не зелені, кнопка merge заблокована; push у `main` напряму відхиляється — `git push origin setup/bootstrap:main` → `GH013: Changes must be made through a pull request` (ruleset `solo-main`, обов'язкові `spec`, `app`, `conformance`, `db-check`)
- [x] Vercel створив preview для PR — https://property-workflows-git-setup-bootstrap-pimpyuwus-projects.vercel.app
- [x] **Squash and merge** → прод-деплой Vercel пройшов — https://property-workflows.vercel.app
- [x] (З першою задачею, що має міграцію) `db-check` зелений, після merge `db-deploy` застосував її у вашу базу — https://github.com/vsmrnk/property-workflows/pull/5 → https://github.com/vsmrnk/property-workflows/actions/runs/39381467363

## 8. Вимоги PM і специфікація

- [x] Адресу репо вимог PM узято з чату команди; на зустрічі команди (дні 0–2, до кінця 15.10, організує PM; якщо
      команда не зібралася — діра в чат команди до обіду 16.10) — перший раунд питань до брифу — https://github.com/solomchaak/property-workflows-spec
- [x] PM написав у чаті команди «вимоги оновлено» (у курсі перші вимоги — до кінця 16.10) → у Claude Code чи Cursor
      `/requirements-sync <pm>/<team-slug>-spec` → PR «Оновлення вимог» злито; шапка `docs/conformance.md` показує
      адресу, джерело (issues чи docs) і дату знімка — https://github.com/vsmrnk/property-workflows/pull/2 (знімок 19.10), https://github.com/vsmrnk/property-workflows/pull/10 (знімок 20.10)
- [x] Читання вимог: скіл `spec-clarify` → питання — issues «Питання до вимог» у репо PM через вебформу → журнал
      `docs/spec-reading.md` — https://github.com/solomchaak/property-workflows-spec/issues/4, https://github.com/solomchaak/property-workflows-spec/issues/5, https://github.com/solomchaak/property-workflows-spec/issues/12
- [x] Переклад у специфікацію (гілка `spec/add-<зріз>`): `/opsx:propose add-<зріз>` → `npx openspec validate add-<зріз> --strict`
      → скіл `spec-review` → `npx openspec archive add-<зріз> -y` → `/conformance` → PR «Специфікація» злито;
      `npm run ac:coverage` без «вимогу PM ще не перекладено» — https://github.com/vsmrnk/property-workflows/pull/3 (`add-run-launch`), https://github.com/vsmrnk/property-workflows/pull/11 (`clarify-run-launch`)
