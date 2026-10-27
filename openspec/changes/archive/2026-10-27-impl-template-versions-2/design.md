# Design: impl-template-versions-2

## Контекст

Уточнення зрізу 2 (`clarify-template-versions`, відповіді PM solomchaak/property-workflows-spec#21–#38). Модель
`impl-template-versions` (D1–D7) лишається: робоча копія (`template_sections`, `template_tasks`) — лише admin; версії
й поточну версію пишуть лише функції `private` (`security definer`, `search_path = ''`); запуск — `private.launch_run`.
Нове: назва шаблону належить версії, перевірки назв і секцій під час збереження, назва шаблону в рані, тема
інтерфейсу, повернення після входу.

## Дані й база (одна міграція)

- **D1. Назва належить версії (AC-EDITOR-21, AC-EDITOR-22, AC-EDITOR-29).** `templates.name` — назва поточної
  версії (для нового шаблону — назва зі створення; менеджер такого шаблону не бачить). Перейменування в редакторі
  пишеться в окрему таблицю `template_drafts (template_id pk, name)` — частину незбережених змін: RLS і GRANT лише
  для admin, тригер ставить позначку «Unpublished changes». У `authenticated` знімається `update (name)` на
  `templates`. Тож менеджер прямим запитом не отримує нової назви (AC-EDITOR-29). `template_versions.name` — назва
  кожної версії.
- **D2. Назва шаблону в рані (AC-EDITOR-22).** `runs.template_name` — копія назви версії на момент запуску
  (`launch_run`); для наявних ранів — поточна назва шаблону. Список ранів і сторінка рану показують саме її.
- **D3. Рани до появи версій (AC-EDITOR-27).** Наявні рани з `template_version is null` отримують `1` (припущення
  PM: шаблони до зрізу стали версією 1, рани до появи версій показують «Template version 1»).
- **D4. Збереження (`save_template_version`) (AC-EDITOR-12, 15, 20, 24).** Додаткові коди помилок за порядком
  перевірок: `NO_CHANGES` (уже є) → `NO_NAME` (назва секції чи задачі або нова назва шаблону порожня після `btrim`)
  → `EMPTY_SECTION` → `NO_REQUIRED_TASK` (уже є) → `DUPLICATE_NAME` (нова назва збігається з назвою іншого
  шаблону за `lower(btrim(...))`). Під час успішного збереження назва з `template_drafts` переходить у
  `templates.name` і `template_versions.name`, чернетка назви видаляється.
- **D5. Порожні назви в робочій копії (AC-EDITOR-20).** Обмеження `char_length(btrim(name)) between 1 and 200` на
  `template_sections.name` і `template_tasks.name` замінюються на `char_length(name) <= 200`: очищена назва
  лишається в незбережених змінах, а відхиляє її збереження (D4).
- **D6. Унікальна назва (AC-EDITOR-23, AC-EDITOR-24).** Унікальний індекс на `lower(btrim(templates.name))` замість
  `unique (name)`: створення з такою назвою дає `23505` → «A template with this name already exists»;
  перейменування — `DUPLICATE_NAME` у D4.
- **D7. Прямі запити (AC-EDITOR-11, AC-EDITOR-26, AC-EDITOR-29).** Наявні межі: `launch_run` відхиляє шаблон без
  версії (`TEMPLATE_NOT_FOUND`); `anon` не має GRANT на таблиці шаблонів; версії, робоча копія й `template_drafts` —
  лише admin. Server Action без входу перенаправляє на `/login`.

## UI

- **U1. Сторінка шаблону для менеджера `/templates/[id]` (AC-EDITOR-02, AC-EDITOR-16).** Лише читання: назва,
  «Version N», секції із задачами з `Badge` «required»/«optional», посилання «Launch». Дані — лише
  `templates.published_sections`. Шаблон без версії (менеджер його не бачить через RLS) — «Template not found».
  Адміністратора сторінка перенаправляє в редактор. У списку шаблонів назва — посилання на цю сторінку.
- **U2. Порожні стани (AC-EDITOR-17, AC-EDITOR-18).** Менеджер: «No templates yet. An administrator creates them.»;
  адміністратор: «No templates yet. Create a template to start.» з посиланням «Create a template»; список версій:
  «No versions yet. Save the template to create version 1.».
- **U3. Форма запуску (AC-EDITOR-10).** Для admin шаблони без версії — у списку вибору недоступні з приміткою
  «Save the template to launch it».
- **U4. Редактор (AC-EDITOR-03, 13, 14, 20, 21, 24, 25, 28).** Назва шаблону редагується на місці (`InlineName`,
  пише `template_drafts`); порожня назва секції чи задачі зберігається як є (D5); тексти помилок збереження —
  дослівно з AC; підтвердження видалення — назва елемента й «This cannot be undone» (уже є). Перенесення задачі —
  вибір «Section» у рядку задачі (клавіатура й миша); задача стає останньою в новій секції. Стан змін — одне місце
  під заголовком: «All changes kept» або «Your last change was not kept. Try again.» (`text-destructive`, `role="alert"`);
  дії робочої копії кидають помилку, якщо запис не вдався, а редактор не очищає введене.
- **U5. Тема (AC-DSYS-05, AC-DSYS-06, AC-DSYS-07).** Вибір «Theme» (System / Light / Dark) у хедері; значення — у
  `localStorage` пристрою; вбудований скрипт у `<head>` ставить `data-theme` на `<html>` до першого малювання.
  Токени темної теми — під `:root[data-theme="dark"]` і, без скрипта, під `prefers-color-scheme: dark`;
  `@custom-variant dark` — за `data-theme`. Статуси використовують ті самі токени, контраст ≥ 4.5 (таблиця DESIGN.md).
- **U6. Повернення після входу (AC-DSYS-08).** `proxy` перенаправляє на `/login?next=<шлях>`; дія входу
  перенаправляє лише на локальний шлях (починається з `/`, не з `//`), інакше на `/`.
