# Пропозиція: реалізація другого зрізу — редактор шаблонів із версіями і дизайн-система

## Why

Реалізуємо другий зріз зі специфікацій `openspec/specs/template-versions/spec.md` і
`openspec/specs/design-system/spec.md` (переклад вимог PM solomchaak/property-workflows-spec#20 і #19):
адміністратор редагує шаблон, зміни зберігаються автоматично як незбережені, збереження створює пронумеровану
версію, менеджери працюють лише з поточною версією, рани показують версію запуску, а всі сторінки — на єдиній
дизайн-системі.

## What Changes

Зміна покриває:

- `template-versions`: AC-EDITOR-01, AC-EDITOR-02, AC-EDITOR-03, AC-EDITOR-04, AC-EDITOR-05, AC-EDITOR-06,
  AC-EDITOR-07, AC-EDITOR-08, AC-EDITOR-09;
- `design-system`: AC-DSYS-02, AC-DSYS-03.

Залежність: AC-DSYS-01 і AC-DSYS-04 реалізує PR дизайн-системи (#17) — каркас і компоненти, на яких стоять сторінки
цього плану.
