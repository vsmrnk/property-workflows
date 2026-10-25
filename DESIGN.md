# Дизайн-система: Property Workflows

- **Джерело:** AI-агент — Claude Code (Claude Opus 5.5); промпт і процес — в описі PR дизайн-системи. Напрям
  задав розробник: «більше схоже на CRM — навігація збоку, хедер, щільний вигляд». Значення — OKLCH, контраст
  пораховано (WCAG 2.x).
- **Вхід від PM:** розділ «Вигляд і тон» у `requirements/product.md` (знімок 2026-10-25,
  solomchaak/property-workflows-spec#1) і вимога «Use one design system across the application»
  (`requirements/19-use-one-design-system.md`, AC-DSYS-01…04). Правила PM нижче — з позначкою «(PM)».
- **Код:** токени — `src/app/globals.css`; компоненти — `src/components/ui/` (shadcn/ui, Base UI); каркас і
  композитні блоки (сайдбар, хедер, заголовок сторінки, бейджі статусів, прогрес) — `src/app/_components/`;
  перевірка — `npm run check:design`.

## 1. Огляд

Внутрішня CRM-подібна система агенції з управління нерухомістю: менеджер запускає шаблон процесу для кейсу
(«Apartment 12, move-in») і веде задачі рану до кінця. Тон **(PM): calm, businesslike, precise** — застосунок
допомагає зайнятому менеджеру пройти довгий список кейсів; без жартів, знаків оклику, звинувачень («You made a
mistake») і жаргону. Працюють за робочим столом (від 1024 px) цілий день, тому інтерфейс **щільний, нейтральний,
передбачуваний**: сайдбар зліва, хедер з хлібними крихтами, дані — таблицями. **Один сильний акцентний колір (індиго)
— лише для основної дії екрана (Launch, Save) і ні для чого іншого (PM)**: навігація, посилання, логотип і фокус —
нейтральні. На телефоні (від 360 px) сайдбар ховається, навігація — рядком під хедером, таблиці ховають другорядні
колонки — назва кейсу, статус і прогрес ідуть першими (PM). Не годиться (PM): яскраві градієнти, декоративна
анімація, дрібний сірий текст, іконки без підпису, спливні вікна для рутинної інформації. Мова інтерфейсу —
англійська (рішення PM, питання #13); тексти — простою англійською, звертаючись до користувача, кнопки починаються з
дієслова («Launch», «Save»), повідомлення з AC — дослівно.

## 2. Кольори

Темна тема — за системою (`@media (prefers-color-scheme: dark)`), класу `.dark` немає. У сторінках — лише класи з
колонки «Клас»: ніколи hex, `bg-[#…]`, сирі палітри (`zinc-500`, `bg-white`, `text-black`) чи колір у `style={{…}}`.
Прозорість — лише від токена (`bg-primary/90`).

| Токен | Для чого | Світла | Темна | Клас |
|---|---|---|---|---|
| `background` / `foreground` | тло контенту й основний текст | `oklch(98.4% 0.003 264)` / `oklch(21% 0.032 264.7)` | `oklch(14.5% 0.012 264)` / `oklch(96.7% 0.003 264.5)` | `bg-background`, `text-foreground` |
| `card` / `card-foreground` | картки, таблиці, хедер, поля | `oklch(100% 0 0)` / `oklch(21% 0.032 264.7)` | `oklch(18.5% 0.015 264)` / `oklch(96.7% 0.003 264.5)` | `bg-card`, `text-card-foreground` |
| `popover` / `popover-foreground` | список вибору, панель підтвердження | `oklch(100% 0 0)` / як `card-foreground` | `oklch(20.5% 0.016 264)` / як `card-foreground` | `bg-popover`, `text-popover-foreground` |
| `primary` / `primary-foreground` | **лише** основна дія екрана (одна на екран) | `oklch(51.1% 0.229 276.9)` / `oklch(100% 0 0)` | `oklch(67.3% 0.182 276.9)` / `oklch(14.5% 0.012 264)` | `bg-primary`, `text-primary-foreground` |
| `secondary` / `secondary-foreground` | другорядна дія («Launch» у рядку, «Cancel») | `oklch(96.7% 0.003 264.5)` / `oklch(21% 0.032 264.7)` | `oklch(24.5% 0.016 264)` / `oklch(96.7% 0.003 264.5)` | `bg-secondary`, `text-secondary-foreground` |
| `muted` / `muted-foreground` | наведення на рядок, статус «to do» (сірий, PM), підписи, допоміжний текст | `oklch(96.7% 0.003 264.5)` / `oklch(46% 0.025 264)` | `oklch(24.5% 0.016 264)` / `oklch(74% 0.02 262)` | `bg-muted`, `text-muted-foreground` |
| `accent` / `accent-foreground` | нейтральне виділення: вибраний пункт списку, іконка-плашка | `oklch(95.6% 0.004 264.5)` / `oklch(21% 0.032 264.7)` | `oklch(26% 0.016 264)` / `oklch(96.7% 0.003 264.5)` | `bg-accent`, `text-accent-foreground` |
| `destructive` / `destructive-soft` | текст помилки / тло повідомлення про помилку | `oklch(50.5% 0.19 27.5)` / `oklch(97.1% 0.013 17.4)` | `oklch(71% 0.17 22)` / `oklch(25.5% 0.06 25)` | `text-destructive`, `bg-destructive-soft` |
| `border` | межі карток, розділювачі рядків, хедер | `oklch(92.8% 0.006 264.5)` | `oklch(27.5% 0.015 264)` | `border-border`, `divide-border` |
| `input` | межа поля вводу й списку вибору | `oklch(64% 0.02 262)` | `oklch(52% 0.02 262)` | `border-input` |
| `ring` | кільце фокусу — завжди видиме (PM), нейтральне | як `foreground` | як `foreground` | `ring-ring`, `outline-ring` |
| `sidebar` / `sidebar-foreground` | бічна навігація / її пункти | `oklch(100% 0 0)` / `oklch(37.3% 0.034 259.7)` | `oklch(17% 0.014 264)` / `oklch(87% 0.01 260)` | `bg-sidebar`, `text-sidebar-foreground` |
| `sidebar-accent` / `-foreground` | поточний пункт навігації (нейтральний, + `font-semibold`) | як `accent` / `accent-foreground` | як `accent` / `accent-foreground` | `bg-sidebar-accent`, `text-sidebar-accent-foreground` |
| `sidebar-border` | межа сайдбару | як `border` | як `border` | `border-sidebar-border` |
| `status-progress` / `-foreground` | статус рану «in progress» | `oklch(97% 0.014 254.6)` / `oklch(48.8% 0.217 264.4)` | `oklch(26% 0.06 260)` / `oklch(80.9% 0.105 251.8)` | `bg-status-progress`, `text-status-progress-foreground` |
| `status-done` / `-foreground` | статус рану «completed», задачі «done» | `oklch(98.2% 0.018 155.8)` / `oklch(44.8% 0.119 151.3)` | `oklch(26% 0.05 152)` / `oklch(84.5% 0.13 155)` | `bg-status-done`, `text-status-done-foreground` |
| `status-draft` / `-foreground` | позначка «Unpublished changes» — теплий жовтий (PM) | `oklch(97.3% 0.05 95)` / `oklch(47.3% 0.137 46.2)` | `oklch(28% 0.06 70)` / `oklch(87.9% 0.15 91.6)` | `bg-status-draft`, `text-status-draft-foreground` |
| `warning` / `warning-foreground` | незворотна дія («Confirm» для «Mark as done» останньої обов'язкової задачі) — помітно інший колір-попередження, завжди з підтвердженням «This cannot be undone» (PM) | `oklch(55.3% 0.195 38.4)` / `oklch(100% 0 0)` | `oklch(75% 0.183 55.9)` / `oklch(14.5% 0.012 264)` | `bg-warning`, `text-warning-foreground` |
| `success` / `success-foreground` | суцільна позначка «виконано» | `oklch(52.7% 0.154 150.1)` / `oklch(100% 0 0)` | `oklch(72.3% 0.17 150)` / `oklch(14.5% 0.012 264)` | `bg-success`, `text-success-foreground` |
| `track` | тло смуги прогресу; заповнення — кольором статусу: `status-progress-foreground` (in progress) чи `status-done-foreground` (completed) | як `border` | як `border` | `bg-track` |

Декоративні токени (не для тексту, контраст не нормується): `skeleton`/`skeleton-shine` — завантаження (`.skeleton`);
`shadow-ink` — колір тіней `shadow-card` і `shadow-float` (розділ 4).

### Контраст

Пораховано WCAG 2.x для значень вище (скрипт з `culori`, вивід — в описі PR).

| Пара | Світла | Темна | Норма |
|---|---|---|---|
| `foreground` на `background` | 16.95 | 17.99 | ≥ 4.5 |
| `muted-foreground` на `background` | 6.81 | 8.58 | ≥ 4.5 |
| `muted-foreground` на `card` | 7.13 | 8.08 | ≥ 4.5 |
| `muted-foreground` на `accent` | 6.27 | 6.74 | ≥ 4.5 |
| `card-foreground` на `card` | 17.74 | 16.94 | ≥ 4.5 |
| `primary-foreground` на `primary` | 6.27 | 6.40 | ≥ 4.5 |
| `primary` на `card` (межа основної кнопки) | 6.27 | 6.03 | ≥ 3 |
| `secondary-foreground` на `secondary` | 16.13 | 14.75 | ≥ 4.5 |
| `accent-foreground` на `accent` | 15.61 | 14.13 | ≥ 4.5 |
| `status-draft-foreground` на `status-draft` | 6.62 | 10.23 | ≥ 4.5 |
| `warning-foreground` на `warning` | 5.25 | 8.44 | ≥ 4.5 |
| `warning` на `card` (межа кнопки) | 5.25 | 7.95 | ≥ 3 |
| `sidebar-foreground` на `sidebar` | 10.31 | 12.91 | ≥ 4.5 |
| `destructive` на `card` | 6.48 | 6.71 | ≥ 4.5 |
| `destructive` на `destructive-soft` | 5.93 | 5.79 | ≥ 4.5 |
| `status-progress-foreground` на `status-progress` | 6.15 | 8.64 | ≥ 4.5 |
| `status-done-foreground` на `status-done` | 6.78 | 9.99 | ≥ 4.5 |
| `success-foreground` на `success` | 4.99 | 8.63 | ≥ 4.5 |
| `input` на `card` | 3.36 | 3.38 | ≥ 3 |
| `input` на `background` | 3.21 | 3.59 | ≥ 3 |
| `ring` на `background` | 16.95 | 17.99 | ≥ 3 |
| `ring` на `card` | 17.74 | 16.94 | ≥ 3 |
| прогрес «in progress» на `track` | 5.42 | 8.22 | ≥ 3 |
| прогрес «completed» на `track` | 5.74 | 9.70 | ≥ 3 |

## 3. Типографіка

Шрифт — Geist (`next/font`, `--font-geist-sans` → `--font-sans`); моно — Geist Mono. Числа (прогрес, дати,
лічильники) — `tabular-nums`. Розмір заголовка сторінки — токен `@theme` (розмір + висота рядка + трекінг разом);
довільних `text-[…]` і `tracking-[…]` у сторінках немає.

| Роль | Клас | Де |
|---|---|---|
| Заголовок сторінки | `text-title font-semibold` (1.375rem / 1.3 / −0.015em) | один `<h1>` у `PageHeader` |
| Заголовок блоку | `text-base font-semibold` або `text-sm font-semibold` | «Assignees», назва секції в шапці картки |
| Заголовок колонки таблиці | `TableHead` (`text-sm font-medium`) | шапки таблиць |
| Основний текст, клітинки | `text-sm` | рядки таблиць, форми |
| Головне в рядку | `font-medium` | назва кейсу, задачі, шаблону |
| Підпис, допоміжний текст | `text-sm text-muted-foreground` — не менше `text-sm` («small grey text» не годиться, PM) | шаблон рану, email, «3 of 3 required» |
| Бейдж | `text-xs font-medium` | статуси, «required»/«optional», роль |

## 4. Каркас, відступи й радіуси

- **Каркас** (`AppShell`): сайдбар `w-60` зліва (`bg-sidebar`, `border-r`; знак продукту зверху у висоті хедера,
  під ним навігація) + колонка контенту: хедер `h-14` (`bg-card`, `border-b`, sticky; хлібні крихти зліва,
  користувач і роль, «Sign out» справа) і `main` (`px-4 py-6 sm:px-6 lg:px-8`, контент на всю ширину колонки, між блоками `gap-6`).
  До `md` сайдбар прихований, навігація — горизонтальний рядок під хедером.
- **Заголовок сторінки** (`PageHeader`): `h1` + бейдж статусу поруч + опис під ним; основна дія — праворуч.
- **Навігація:** пункти `h-9`, `rounded-md`, іконка 16px + текст (іконок без підпису немає, PM); поточний —
  нейтральний `bg-sidebar-accent text-sidebar-accent-foreground` і `aria-current="page"`. Лише наявні сторінки.
- **Відступи:** картка-зведення — `p-4`; картка з формою — `p-5`; шапка картки з таблицею — `px-5 py-3` з `border-b`;
  перша й остання колонки таблиці — `pl-5`/`pr-5`; між полем і підписом — `gap-1.5`; між полями — `gap-4`.
- **Радіуси:** `--radius: 0.5rem`; кнопки, поля, пункти навігації — `rounded-md` (6.4px); картки — `rounded-card`
  (12px); плаваючі панелі — `rounded-lg`; бейджі й аватари — `rounded-full`.
- **Тіні:** `shadow-card` — ледь помітна (1px) під картками, кнопками й полями; `shadow-float` — плаваючі панелі
  (список вибору, підтвердження). Структуру тримають межі (`border`), а не тіні.

## 5. Компоненти й варіанти

Лише з `@/components/ui`. Нові — `npx shadcn@4.22.1 add <назва>`; змінюються в `src/components/ui/` і лише токенами.

| Компонент | Варіанти | Правило |
|---|---|---|
| `Button` | `default`, `secondary`, `outline`, `ghost`, `warning`, `destructive`, `link`; розміри `default` (h-9), `sm` (h-8), `lg`, `icon` | `default` (індиго) — **лише** одна основна дія на екран («Launch a template», «Sign in», «Launch run», «Save»); `warning` — підтвердження незворотної дії; дія в рядку таблиці — `secondary`/`outline` `sm`; «Sign out» у хедері — `ghost` `sm` з текстом. Текст кнопки починається з дієслова (PM). Посилання-кнопка — `buttonVariants()` на `<Link>` |
| `Input` + `Label` | — | у кожного поля `Label` з `htmlFor`; placeholder — лише приклад формату (`name@example.test`) |
| `Card` | — | біле тло, `border`, `rounded-card`, `shadow-card`; таблиця в картці — від краю до краю, шапка картки — `border-b` |
| `Table` | `table-fixed` з ширинами колонок для однакових таблиць одна під одною | списки ранів, шаблонів, задач рану й виконавців — таблиці; на вузькому екрані другорядні колонки ховаються (`hidden md:table-cell`), а їхній зміст — підписом під головною колонкою |
| `Badge` | `progress`, `done`, `muted`, `draft`, `outline` | статус — завжди текстом, колір лише підсилює (PM, AC-DSYS-01): «to do» — `muted` (сірий), «in progress» — `progress` (синій), «done»/«completed» — `done` (зелений), «Unpublished changes» — `draft` (теплий жовтий); «required»/«optional» і роль — `outline` |
| `Select` | — | вибір виконавця: аватар-ініціал + email; клавіатура (стрілки, Enter, Esc) — Base UI |
| Підтвердження на місці | — | незворотна дія («Mark as done» для останньої обов'язкової задачі, AC-TASK-04/16): спливаюча панель `role="alertdialog"` під кнопкою — `bg-popover`, `border`, `shadow-float`, заголовок-питання з назвою задачі, текст наслідку «This cannot be undone», `Button` `secondary` «Cancel» (фокус на ньому) і `Button` `warning` «Confirm». Панель лишається всередині `<form>`, тому не модальна |
| `AlertDialog` / `Dialog` | — | модальні діалоги без власної форми (поки не використовуються); тло — `bg-background/60` |
| `Alert` | `destructive`, `default` | помилка форми — під полем чи над кнопкою дії, текст дослівно з AC; введене лишається в полях |

## 6. Стани

| Стан | Як виглядає | Приклад тексту (дослівно з коду / AC) |
|---|---|---|
| Порожній список ранів | `Card` по центру замість таблиці: іконка-плашка `bg-accent`, повідомлення, посилання «Launch a template» (AC-DSYS-04) | «No runs yet. Launch a template to start one.» |
| Немає шаблонів | `text-sm text-muted-foreground` у `Card`, без дії (шаблони готує адміністратор) | «No templates yet. An administrator prepares templates before they can be launched.» |
| Помилка дії | `Alert` `destructive` під полем; поля зберігають введене | «Enter a case name» · «Case name must be at most 100 characters» (AC-RUN-03, AC-RUN-07) |
| Помилка входу | `Alert` `destructive` над «Sign in» | «Wrong email or password. Check them and try again.» |
| Відмова в доступі | сторінка без даних рану: лише заголовок і посилання назад | «Run not found» (AC-TASK-10: чужий ран не відрізняється від неіснуючого) |
| Відмова дії | текст `text-destructive` під кнопкою в рядку, стан задачі не змінюється | «Only the task's assignee, the run manager, or an administrator can mark a task as done» (AC-TASK-03) |
| Завантаження | `.skeleton` лише на місці даних (рядки таблиць, значення карток); каркас, заголовки, кнопки й навігація видно одразу; `aria-busy` + прихований «Loading…» | — |
| Успіх | без тостів і спливних вікон (PM): змінений стан видно на місці (задача «done», прогрес «N of M done») | «3 of 5 done» · «Version 2 saved» (приклад PM) |
| Вимкнена дія | `disabled` (`opacity-50`) + причина поруч текстом | — |

## 7. Доступність — мінімум

- `Label` у кожного поля; помилка поля — `role="alert"` і пов'язана з полем (`aria-describedby`).
- Видимий фокус: кільце `ring` (2px, відступ 2px) на кожному інтерактивному елементі; Tab проходить сайдбар,
  хедер і форму по порядку.
- Навігація — `<nav aria-label="Main">` з `aria-current="page"`; хлібні крихти — `<nav aria-label="Breadcrumb">`.
- Контраст — таблиця в розділі 2; нова пара кольорів без рядка в ній не з'являється.
- Статус ніколи не лише кольором — у бейджі завжди текст; виконана задача ще й закреслена.
- Смуга прогресу — `role="progressbar"` з `aria-valuetext` («3 of 5 done»).
- Колонка без видимого заголовка (дія в рядку) має `sr-only` заголовок; кнопка «Launch» у рядку — `sr-only` назву шаблону.
- `prefers-reduced-motion: reduce` вимикає відблиск скелетонів і анімації появи.

## 8. Do / Don't

| ✅ Робимо | ❌ Не робимо |
|---|---|
| `bg-primary text-primary-foreground` — лише на основній дії | індиго на навігації, посиланнях, логотипі, прогресі; `bg-indigo-600 text-white`, `bg-[#4f46e5]`, `style={{ color: "#…" }}` |
| підтвердження незворотної дії — `Button variant="warning"` + «This cannot be undone» | незворотна дія без підтвердження чи в кольорі основної дії |
| `text-sm text-muted-foreground` для допоміжного | `text-xs text-muted-foreground` («small grey text») |
| `<Button>` / `buttonVariants()` з потрібним варіантом | власний `<button className="rounded-md bg-…">` у сторінці |
| дані — `Table` у `Card` | список карток-плиток для табличних даних |
| `shadow-card`, межа `border` | `shadow-[0_2px_16px_rgba(…)]`, градієнти, пастельні заливки |
| `text-title font-semibold` у `PageHeader` | `text-[1.75rem] tracking-[-0.03em]` |
| `<Badge variant="done">done</Badge>` | зелена крапка без тексту |
| один `default`-`Button` на екран | дві індиго-кнопки поруч |
| новий пункт навігації — лише для наявної сторінки | пункти «на майбутнє» без сторінки |
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
- Візуально: знімки `/login`, `/`, `/runs/<id>` у світлій і темній темі (`docs/img/ws7-*`), Tab по сайдбару й формі,
  контраст, ширина 390 px.
