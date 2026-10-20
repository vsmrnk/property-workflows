# Пропозиція: реалізація першого зрізу — запуск шаблону, задачі й прогрес рану

## Why

Реалізуємо перший зріз зі специфікацій `openspec/specs/run-launch/spec.md` і `openspec/specs/run-progress/spec.md`
(переклад вимог PM solomchaak/property-workflows-spec#2 і #3): менеджер запускає шаблон для кейсу, виконавці
позначають задачі, прогрес «N of M done» видно в списку ранів і на сторінці рану.

## What Changes

Зміна покриває всі AC зрізу:

- `run-launch`: AC-RUN-01, AC-RUN-02, AC-RUN-03, AC-RUN-04, AC-RUN-05, AC-RUN-06, AC-RUN-07, AC-RUN-08, AC-RUN-09;
- `run-progress`: AC-TASK-01, AC-TASK-02, AC-TASK-03, AC-TASK-04, AC-TASK-05, AC-TASK-06, AC-TASK-07, AC-TASK-08,
  AC-TASK-09.
