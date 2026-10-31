# UAT на проді (WS8, трек C)

Специфікації — `tests/e2e/*.spec.ts`, по одному `test` на AC; звіти прогонів — `docs/qa/uat/<YYYY-MM-DD>/`
(`report.md`, `manifest.json`, `frames/`). Відео, trace, HTML-звіт і `playwright/.auth/` у git не кладемо.
Звіт негативних контролів (`npm run uat:nc`, локальна збірка) — поруч, у `<YYYY-MM-DD>/negative-controls/`
(копія `test-results/uat-report-nc/`).

| AC | Специфікація | Роль | Пише в базу |
|---|---|---|---|
| AC-EDITOR-07 | `tests/e2e/template-versions.spec.ts` | manager-b@example.test (+ admin для звірки «Дано») | ні |
| AC-EDITOR-09 | `tests/e2e/editor-access.spec.ts` | відвідувач без входу (+ admin для звірки «Дано») | ні |
| AC-EDITOR-18 | `tests/e2e/template-versions.spec.ts` | admin@example.test | ні |
| NC-1 (негативний контроль AC-EDITOR-07) | `tests/e2e/negative-controls.spec.ts` | manager-b@example.test | ні |

## Дані «Дано» на проді (готує людина в UI, один раз)

Тести лише читають: вони перевіряють «Дано» й падають з поясненням, якщо даних немає, але самі їх не створюють.

1. **AC-EDITOR-07:** «Tenant move-in» має версії 1 і 2. Увійти як `admin@example.test` → Templates → Edit
   «Tenant move-in» → внести будь-яку зміну (напр. додати задачу) → Save. На сторінці Versions — «Version 2» і «Version 1».
2. **AC-EDITOR-18:** новий шаблон «Repair» без жодної версії. Templates → New template → назва `Repair` → Create.
   **Не натискати Save** у редакторі: інакше з'явиться версія 1.

## Запуск (у власному терміналі)

```bash
npx playwright install chromium                                      # один раз
npm run uat -- --url https://property-workflows.vercel.app           # 3 AC → docs/qa/uat/<дата>/
npm run uat:nc -- --url https://property-workflows.vercel.app        # NC-1, очікуваний вердикт FAIL (R1)
```

Пароль ролей — `DEMO_USER_PASSWORD` з `.env.local` (вхід — у проєкті `setup` без запису відео й trace).
