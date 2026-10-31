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
];
