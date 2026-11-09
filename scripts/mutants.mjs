// Мутанти для scripts/mutation-check.mjs (npm run mutation:sql). Мутант = одне правило з AC, навмисно зламане.
// Формат і скрипт — з koldovsky/2026-quitcode-08-quality-hw/materials/testing (WS8, B).
// Поля:
//   id, kind ("sql" | "ts"), ac (який AC це правило доводить), what (що зламано — людською мовою);
//   file — що мутуємо; tests — файли тестів, які мають довести правило (саме їх і запускаємо);
//   find — рядок або RegExp, що трапляється у файлі РІВНО один раз (надійніше за номери рядків, які зсуваються);
//   replace — заміна (вставляється буквально);
//   expect: "survive" + reason — лише для еквівалентного мутанта (поведінка не змінюється) з посиланням на те,
//   що робить його еквівалентним. Без reason скрипт мутант не приймає.
// Новий AC з відмовою, правило якого живе в SQL (політика, grant, функція, тригер), — новий мутант тут.
//
// Гарнес — tests/db/supabase-pglite.ts (PGlite з усіма міграціями). Ролі anon / authenticated там створено без
// default privileges Supabase, тож мутант «прибрати revoke … from anon» у гарнесі нічого б не відкрив і доказом не є —
// натомість мутуємо явні grant і політики.
const VERSIONS = "supabase/migrations/20261025140800_template_versions.sql";
const VERSIONS_DB = "tests/db/template-versions-db.test.ts";
// Сторінки Stryker не мутує (mutate — лише src/lib), тож межі AC на сторінці — точкові TS-мутанти тут.
const VERSIONS_PAGE = "src/app/templates/[id]/versions/page.tsx";
const VENDOR = "supabase/migrations/20261109142910_vendor_role.sql";
const VENDOR_DB = "tests/db/vendor-access-db.test.ts";
const RUNS = "supabase/migrations/20261019120100_templates_and_runs.sql";

export const mutants = [
  {
    id: "E1", kind: "sql", ac: "AC-EDITOR-07", file: VERSIONS, tests: [VERSIONS_DB],
    what: "політика template_versions_select_admin послаблена до true: версії бачить будь-хто з входом, зокрема менеджер",
    find: "create policy template_versions_select_admin on public.template_versions\n  for select to authenticated using ((select private.current_app_role()) = 'admin');",
    replace: "create policy template_versions_select_admin on public.template_versions\n  for select to authenticated using (true);",
  },
  {
    id: "E2", kind: "sql", ac: "AC-EDITOR-09", file: VERSIONS, tests: [VERSIONS_DB],
    what: "grant select на template_versions видано й anon: відвідувач без входу читає таблицю версій (рядки фільтрує лише RLS)",
    find: "grant select on table public.template_versions to authenticated;",
    replace: "grant select on table public.template_versions to authenticated, anon;",
  },
  {
    id: "E3", kind: "sql", ac: "AC-EDITOR-09", file: VERSIONS, tests: [VERSIONS_DB],
    what: "save_template_version: execute не відкликано в PUBLIC — відвідувач без входу може викликати збереження версії",
    find: "public.save_template_version(uuid) from public, anon;",
    replace: "public.save_template_version(uuid) from anon;",
  },
  {
    id: "T1", kind: "ts", ac: "AC-EDITOR-07", file: VERSIONS_PAGE, tests: ["tests/templates/versions-pages.test.tsx"],
    what: "сторінка версій пропускає не-адміністратора: перевірку ролі вимкнено (менеджер бачить сторінку версій)",
    find: 'if (user.role !== "admin") {',
    replace: "if (false) {",
  },
  {
    id: "T2", kind: "ts", ac: "AC-EDITOR-18", file: VERSIONS_PAGE, tests: ["tests/templates/clarify-pages.test.tsx"],
    what: "порожній стан на межі: 0 версій → порожня таблиця замість «No versions yet…» (=== 0 → < 0)",
    find: "(versions ?? []).length === 0 ?",
    replace: "(versions ?? []).length < 0 ?",
  },
  // ── Зріз 3: роль вендора (impl-vendor-access, design.md «Тести й доказ, що тести відмов падають») ──
  {
    id: "V1", kind: "sql", ac: "AC-VENDOR-09", file: VENDOR, tests: [VENDOR_DB],
    what: "can_launch пропускає вендора: вендор запускає шаблон напряму, оминаючи сторінки",
    find: "where p.id = p_user_id and p.role in ('manager', 'admin'));",
    replace: "where p.id = p_user_id and p.role in ('manager', 'admin', 'vendor'));",
  },
  {
    id: "V2", kind: "sql", ac: "AC-VENDOR-02", file: VENDOR, tests: [VENDOR_DB],
    what: "assignable_users без вендорів: у виборі виконавця немає email вендора V",
    find: "where p.role in ('manager', 'admin', 'vendor')\n    and (select private.current_app_role())",
    replace: "where p.role in ('manager', 'admin')\n    and (select private.current_app_role())",
  },
  {
    id: "V3", kind: "sql", ac: "AC-VENDOR-04", file: VENDOR, tests: [VENDOR_DB],
    what: "assignable_users відкрито й вендору: вендор напряму отримує email інших користувачів",
    find: "and (select private.current_app_role()) in ('manager', 'admin')",
    replace: "and (select private.current_app_role()) in ('manager', 'admin', 'vendor')",
  },
  {
    id: "V4", kind: "sql", ac: "AC-VENDOR-04", file: VENDOR, tests: [VENDOR_DB],
    what: "can_see_run для вендора як для менеджера: вендор напряму бачить рядок рану й усі задачі рану, де має задачу",
    find: "(select private.current_app_role()) = 'manager'\n      and (",
    replace: "(select private.current_app_role()) in ('manager', 'vendor')\n      and (",
  },
  {
    id: "V5", kind: "sql", ac: "AC-VENDOR-03", file: VENDOR, tests: [VENDOR_DB],
    what: "vendor_runs без фільтра виконавця: вендор бачить усі рани, а «Your tasks» рахує всі задачі рану",
    find: "join public.run_tasks as t on t.run_id = r.id and t.assignee_id = (select auth.uid())",
    replace: "join public.run_tasks as t on t.run_id = r.id",
  },
  {
    id: "V6", kind: "sql", ac: "AC-VENDOR-07", file: RUNS, tests: [VENDOR_DB],
    what: "mark_task_done без перевірки виконавця: будь-хто з входом позначає чужу задачу напряму",
    find: "    v_task.assignee_id = v_uid\n    or (select private.is_run_manager(v_task.run_id))",
    replace: "    true\n    or (select private.is_run_manager(v_task.run_id))",
  },
  {
    id: "V7", kind: "sql", ac: "AC-VENDOR-08", file: VENDOR, tests: [VENDOR_DB],
    what: "templates_select_visible пропускає будь-кого зі збереженою версією: вендор напряму бачить шаблони",
    find: "or ((select private.current_app_role()) = 'manager' and current_version is not null)",
    replace: "or current_version is not null",
  },
];
