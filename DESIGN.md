# Дизайн-система: Property Workflows

- **Джерело:** AI-агент — Claude Code (Claude Opus 5.5); промпт і процес — в описі PR дизайн-системи. Основа —
  візуальна мова, наявна в застосунку після зрізу 1 (PR #9), зведена в токени з іменами shadcn/ui; значення
  переведено в OKLCH, контраст пораховано (WCAG 2.x).
- **Вхід від PM:** розділу «Вигляд і тон» у `requirements/product.md` немає (знімок 2026-10-20) — спираємось на
  бачення й ролі продукту: адміністратор і менеджери однієї агенції, робочий інструмент для повторюваних процесів.
- **Код:** токени — `src/app/globals.css`; компоненти — `src/components/ui/` (shadcn/ui, Base UI); композитні блоки
  застосунку (шапка, смуга прогресу, бейджі статусів) — `src/app/_components/`; перевірка — `npm run check:design`.

## 1. Огляд

Внутрішній робочий інструмент агенції з управління нерухомістю: менеджер запускає шаблон процесу для кейсу
(«Apartment 12, move-in») і веде задачі рану до кінця. Працюють за робочим столом (від 1024 px), але кожен екран
читається й на телефоні (від 360 px, одна колонка). Тон — **спокійний, охайний, впевнений, дружній без грайливості**:
сірий фон, білі картки з великим радіусом, один акцент (індиго) для того, що «в роботі», зелений — для «зроблено».
Уникаємо: яскравих заливок на великих площах, кількох акцентів на екрані, тривожного червоного поза помилками,
декоративних іконок без змісту. Простір важливіший за щільність: список ранів і задач — по одному рядку на об'єкт із
повітрям, без таблиць-«екселів». Мова інтерфейсу — англійська (рішення PM, питання #13).

## 2. Кольори

Темна тема — за системою (`@media (prefers-color-scheme: dark)`), класу `.dark` немає. У сторінках — лише класи з
колонки «Клас»: ніколи hex, `bg-[#…]`, сирі палітри (`zinc-500`, `bg-white`, `text-black`) чи колір у `style={{…}}`.
Прозорість — лише від токена (`border-foreground/10`, `bg-primary/85`).

| Токен | Для чого | Світла | Темна | Клас |
|---|---|---|---|---|
| `background` / `foreground` | тло сторінки й основний текст | `oklch(95.5% 0 0)` / `oklch(19.1% 0 0)` | `oklch(17.1% 0.004 128.7)` / `oklch(94.3% 0.003 106.5)` | `bg-background`, `text-foreground` |
| `card` / `card-foreground` | картки, панелі, поля вводу | `oklch(100% 0 0)` / `oklch(19.1% 0 0)` | `oklch(21.4% 0.008 128.9)` / `oklch(94.3% 0.003 106.5)` | `bg-card`, `text-card-foreground` |
| `popover` / `popover-foreground` | список вибору, діалоги | як `card` | як `card` | `bg-popover`, `text-popover-foreground` |
| `primary` / `primary-foreground` | основна дія (одна на екран), логотип | `oklch(19.1% 0 0)` / `oklch(100% 0 0)` | `oklch(94.3% 0.003 106.5)` / `oklch(18.4% 0.006 122)` | `bg-primary`, `text-primary-foreground` |
| `secondary` / `secondary-foreground` | другорядна дія (Sign out, Cancel) | `oklch(100% 0 0)` / `oklch(19.1% 0 0)` | `oklch(21.4% 0.008 128.9)` / `oklch(94.3% 0.003 106.5)` | `bg-secondary`, `text-secondary-foreground` |
| `muted` / `muted-foreground` | приглушене тло (наведення), підписи, допоміжний текст | `oklch(96.4% 0.003 106.4)` / `oklch(46.8% 0.005 91.5)` | `oklch(25.9% 0.012 129)` / `oklch(71.4% 0.009 106.6)` | `bg-muted`, `text-muted-foreground` |
| `accent` / `accent-foreground` | вибраний рядок, наведення в списку, акцентне слово | `oklch(94.5% 0.02 289.1)` / `oklch(47% 0.173 279)` | `oklch(28.4% 0.068 283.5)` / `oklch(83.2% 0.077 287.1)` | `bg-accent`, `text-accent-foreground` |
| `destructive` / `destructive-soft` | текст помилки / тло повідомлення про помилку | `oklch(50% 0.182 29.5)` / `oklch(93.8% 0.028 25.9)` | `oklch(77.6% 0.111 27.4)` / `oklch(26.1% 0.053 28.4)` | `text-destructive`, `bg-destructive-soft` |
| `border` | розділювачі, межі карток і рядків | `oklch(91.8% 0.005 106.5)` | `oklch(29.6% 0.013 126.1)` | `border-border`, `divide-border` |
| `input` | межа поля вводу й списку вибору | `oklch(62.9% 0.007 97.4)` | `oklch(56.2% 0.019 122)` | `border-input` |
| `ring` | кільце фокусу, межа відкритого списку | `oklch(52.3% 0.171 280.3)` | `oklch(76.9% 0.106 286)` | `ring-ring`, `outline-ring`, `border-ring` |
| `status-progress` / `-foreground` | статус рану «in progress» | `oklch(94.5% 0.02 289.1)` / `oklch(47% 0.173 279)` | `oklch(28.4% 0.068 283.5)` / `oklch(83.2% 0.077 287.1)` | `bg-status-progress`, `text-status-progress-foreground` |
| `status-done` / `-foreground` | статус рану «completed», задачі «done» | `oklch(93.6% 0.032 132.3)` / `oklch(47.2% 0.102 144.1)` | `oklch(28.1% 0.038 144.5)` / `oklch(79.9% 0.114 144.4)` | `bg-status-done`, `text-status-done-foreground` |
| `success` / `success-foreground` | суцільна позначка «виконано» (кружок з галочкою) | `oklch(52.3% 0.111 144.1)` / `oklch(100% 0 0)` | `oklch(79.9% 0.114 144.4)` / `oklch(18.4% 0.006 122)` | `bg-success`, `text-success-foreground` |
| `track` | тло смуги прогресу | `oklch(0% 0 0 / 6%)` | `oklch(100% 0 0 / 10%)` | `bg-track` |

Декоративні токени (не для тексту, контраст не нормується): `card-edge` — біла рамка картки; `tint-{lime,peach,lavender}-{from,to}`
— пастельні панелі (класи `.tint-lime`, `.tint-peach`, `.tint-lavender`); `progress-from`/`progress-to` — градієнт
заповнення (`.progress-fill`); `skeleton`/`skeleton-shine` — завантаження (`.skeleton`); `shadow-color` — колір тіней.
Тіні — лише токени `shadow-card`, `shadow-float`, `shadow-button`, `shadow-outline`, `shadow-outline-strong` (розділ 4).

### Контраст

Пораховано WCAG 2.x для значень вище (скрипт з `culori`, вивід — в описі PR).

| Пара | Світла | Темна | Норма |
|---|---|---|---|
| `foreground` на `background` | 16.17 | 16.13 | ≥ 4.5 |
| `muted-foreground` на `background` | 6.05 | 7.52 | ≥ 4.5 |
| `muted-foreground` на `card` | 6.90 | 6.91 | ≥ 4.5 |
| `card-foreground` на `card` | 18.42 | 14.82 | ≥ 4.5 |
| `primary-foreground` на `primary` | 18.42 | 15.76 | ≥ 4.5 |
| `secondary-foreground` на `secondary` | 18.42 | 14.82 | ≥ 4.5 |
| `accent-foreground` на `accent` | 6.16 | 8.60 | ≥ 4.5 |
| `accent-foreground` на `card` | 7.26 | 10.29 | ≥ 4.5 |
| `destructive` на `card` | 6.57 | 8.26 | ≥ 4.5 |
| `destructive` на `destructive-soft` | 5.44 | 7.45 | ≥ 4.5 |
| `status-progress-foreground` на `status-progress` | 6.16 | 8.60 | ≥ 4.5 |
| `status-done-foreground` на `status-done` | 5.41 | 8.00 | ≥ 4.5 |
| `success-foreground` на `success` | 5.18 | 10.37 | ≥ 4.5 |
| `input` на `card` | 3.50 | 3.82 | ≥ 3 |
| `input` на `background` | 3.08 | 4.16 | ≥ 3 |
| `ring` на `background` | 5.06 | 8.96 | ≥ 3 |
| `ring` на `card` | 5.77 | 8.24 | ≥ 3 |

Що змінено порівняно з кольорами зрізу 1 заради цих норм: межа поля (`#e4e4e0` → `input`, було 1.2:1), текст
акценту в світлій темі (`#5b57c8` → `#4b47b8`), текст «done» (`#3d7a3e` → `#336a34`), текст акценту в темній
(`#aeaaf5` → `#c4c1f8`).

## 3. Типографіка

Шрифт — Plus Jakarta Sans (`next/font`, змінна `--font-jakarta` → `--font-sans`); моно — Geist Mono (`--font-mono`).
Числа прогресу й дати — `tabular-nums`. Розміри заголовків — токени `@theme` (розмір + висота рядка + трекінг разом),
довільних `text-[…]` і `tracking-[…]` у сторінках немає.

| Роль | Клас | Де |
|---|---|---|
| Заголовок промо-панелі | `text-display font-extrabold` (2.4rem / 1.15 / −0.03em) | лише екран входу |
| Заголовок сторінки | `text-title font-extrabold` (1.75rem / 1.25 / −0.03em) | один `<h1>` на сторінку |
| Заголовок розділу | `text-lg font-extrabold tracking-tight` | `<h2>`: «Assignees», назви розділів рану |
| Назва об'єкта в рядку | `font-semibold` або `font-bold` | назва рану, задачі |
| Основний текст | `text-sm` | форми, рядки списків |
| Підпис, допоміжний текст | `text-sm text-muted-foreground` / `text-xs text-muted-foreground` | шаблон рану, «3 of 3 required», email виконавця |
| Бейдж | `text-xs font-semibold` | статуси, «required»/«optional», роль |

## 4. Відступи й радіуси

- Ширина контенту — `max-w-5xl`, поля сторінки — `px-4 sm:px-6`, вертикально — `py-8`; між блоками сторінки — `gap-6`.
- Усередині картки — `p-5`…`p-6`; рядок списку — `px-5 py-4`; між полем і підписом — `gap-1.5`; між полями форми — `gap-4`.
- Радіуси: `--radius: 0.625rem` і похідні shadcn (`rounded-lg` 10px, `rounded-xl` 14px, `rounded-2xl` 18px); поля
  вводу й список вибору — `rounded-xl`, плаваючі панелі — `rounded-2xl`, картки — `rounded-card` (22px), кнопки,
  бейджі й аватари — `rounded-full`. Квадратних кутів у видимих контейнерах немає.
- Тіні (токени `@theme`, колір — `--shadow-color`): `shadow-card` — картки; `shadow-float` — плаваючі панелі (прев'ю
  на вході, список вибору); `shadow-button` — основна кнопка; `shadow-outline` / `shadow-outline-strong` — тонкий
  контур другорядних кнопок і тегів. Довільних `shadow-[…rgba…]` у коді немає.

## 5. Компоненти й варіанти

Лише з `@/components/ui`. Нові — `npx shadcn@4.22.1 add <назва>`; змінюються в `src/components/ui/` і лише токенами.

| Компонент | Варіанти | Правило |
|---|---|---|
| `Button` | `default`, `secondary`, `outline`, `ghost`, `destructive`, `link`; розміри `default`, `sm`, `lg`, `icon` | `default` — одна основна дія на екран («Launch a template», «Sign in», «Launch»); `secondary` — вихід, скасування; `destructive` — лише з підтвердженням. Форма кнопки — пігулка (`rounded-full`). Посилання, що виглядає як кнопка, — `buttonVariants()` на `<Link>` |
| `Input` + `Label` | — | у кожного поля `Label` з `htmlFor`; placeholder — лише приклад формату (`name@example.test`) |
| `Card` | звичайна (`bg-card`) або пастельна (`.tint-*` поверх) | великий радіус, біла рамка `card-edge`, `shadow-card`; пастель — лише для головної картки екрана (зведення рану, порожній стан, промо на вході) |
| `Badge` | `progress`, `done`, `muted`, `outline` | статус — завжди текстом («in progress», «completed», «to do», «done»), колір лише підсилює; «required»/«optional» — `outline` |
| `Select` | — | список вибору виконавця: аватар-ініціал + email; клавіатура (стрілки, Enter, Esc) працює |
| Підтвердження на місці | — | незворотна дія («Mark as done» для останньої обов'язкової задачі, AC-TASK-04/16): панель `role="alertdialog"` замість кнопки — `bg-popover`, `shadow-float`, заголовок-питання з назвою задачі, текст наслідку «This cannot be undone», `Button` `secondary` «Cancel» (фокус на ньому) і `Button` «Confirm». Панель лишається всередині `<form>`, тому не модальна |
| `AlertDialog` / `Dialog` | — | модальні діалоги без власної форми (поки не використовуються); тло — `bg-background/60` |
| `Alert` | `destructive`, `default` | помилка форми — над кнопкою дії, текст дослівно з AC; введене лишається в полях |
| `Table` | — | для майбутніх табличних даних (довідники, кошториси); списки ранів і задач — рядки в `Card`, не таблиця |

## 6. Стани

| Стан | Як виглядає | Приклад тексту (дослівно з коду / AC) |
|---|---|---|
| Порожній список ранів | пастельна `Card` по центру: іконка, заголовок, пояснення, основна дія | «No runs yet» · «Launch a template for a case to start tracking its tasks and progress.» |
| Немає шаблонів | `text-sm text-muted-foreground` у `Card`, без дії (шаблони готує адміністратор) | «No templates yet. An administrator prepares templates before they can be launched.» |
| Помилка дії | `Alert` `destructive` над кнопкою; поля зберігають введене | «Enter a case name» · «Case name must be at most 100 characters» (AC-RUN-03, AC-RUN-07) |
| Помилка входу | `Alert` `destructive` над «Sign in» | «Wrong email or password. Check them and try again.» |
| Відмова в доступі | сторінка без даних рану: лише заголовок і посилання назад | «Run not found» (AC-TASK-10: чужий ран не відрізняється від неіснуючого) |
| Відмова дії | текст `text-destructive` поруч із кнопкою, стан задачі не змінюється | «Only the task's assignee, the run manager, or an administrator can mark a task as done» (AC-TASK-03) |
| Завантаження | `.skeleton` лише на місці даних; заголовки, кнопки й навігація видно одразу; `aria-busy` + прихований «Loading…» | — |
| Успіх | без тостів: змінений стан видно на місці (задача «done», прогрес «N of M done») | «3 of 5 done» |
| Вимкнена дія | `disabled` (`opacity-50`, `cursor-not-allowed`) + причина поруч текстом | — |

## 7. Доступність — мінімум

- `Label` у кожного поля; помилка поля — `role="alert"` і пов'язана з полем (`aria-describedby`).
- Видимий фокус: кільце `ring` (2px, відступ 2px) на кожному інтерактивному елементі; Tab проходить форму по порядку.
- Контраст — таблиця в розділі 2; нова пара кольорів без рядка в ній не з'являється.
- Статус ніколи не лише кольором — у бейджі завжди текст; виконана задача ще й закреслена.
- Смуга прогресу — `role="progressbar"` з `aria-valuetext` («3 of 5 done»).
- `prefers-reduced-motion: reduce` вимикає появу панелей, відблиск скелетонів і анімацію списку.
- Спершу семантичний HTML (`<button>`, `<label>`, `<ul>`); `aria-*` — там, де HTML бракує.

## 8. Do / Don't

| ✅ Робимо | ❌ Не робимо |
|---|---|
| `bg-primary text-primary-foreground` | `bg-zinc-900 text-white`, `bg-[#141414]`, `style={{ color: "#…" }}` |
| `<Button>` / `buttonVariants()` з потрібним варіантом | власний `<button className="rounded-full bg-…">` у сторінці |
| `border-foreground/10` для тонкого розділювача на пастелі | `border-black/10 dark:border-white/10` |
| `shadow-card`, `shadow-outline` | `shadow-[0_2px_16px_rgba(24,30,45,0.045)]` |
| `text-title font-extrabold` | `text-[1.75rem] tracking-[-0.03em]` |
| `<Badge variant="done">done</Badge>` | зелена крапка без тексту |
| один `default`-`Button` на екран | дві чорні кнопки поруч |
| новий токен через розділ 9 | новий колір «лише для цієї сторінки» або сира палітра, перенесена в `src/components/ui` |

## 9. Як додати токен

1. Опишіть токен у таблиці розділу 2: для чого, значення в обох темах (OKLCH), контраст — рядок у таблиці контрасту.
2. `src/app/globals.css`: `--<назва>` у `:root` і в `@media (prefers-color-scheme: dark)`.
3. `--color-<назва>: var(--<назва>);` у `@theme inline` → з'являються класи `bg-<назва>`, `text-<назва>`, `border-<назва>`.
4. `npm run check:design` і знімок сторінки у світлій і темній темі.

## 10. Перевірка

- `npm run check:design` — жодного hex, довільного кольору, сирої палітри чи кольору в inline style поза
  `src/components/ui` і `globals.css`. CI: `.github/workflows/architecture.yml`, job «Дизайн-система: лише токени».
- Виняток — коментар `design-ok: <причина>` у тому самому рядку; кожен виняток — з реальною причиною.
- Візуально: знімки `/login`, `/`, `/runs/<id>` у світлій і темній темі (`docs/img/ws7-*`), Tab по формі, контраст.
