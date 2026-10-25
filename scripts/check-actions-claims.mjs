#!/usr/bin/env node
// Архітектурне правило «кожна дія перевіряє вхід» (ADR 0002).
// 1) Кожна експортована функція у файлі з "use server" (Server Action — публічний POST-ендпойнт) і кожен обробник
//    Route Handler (route.ts: GET, POST…) викликає supabase.auth.getClaims() ДО будь-якої роботи з даними.
//    Виняток — дії, які сесію створюють або знищують: вхід і вихід (src/app/login/actions.ts), активація за
//    посиланням (src/app/auth/confirm/actions.ts). Там claims ще немає (або вони вже не потрібні).
// 2) Жодного getSession() у коді (коментарі не рахуються): він не перевіряє підпис JWT.
// 3) Немає middleware.ts: у Next.js 16 оновлення сесії — src/proxy.ts.
// Скрипт перевіряє наявність виклику, а не його порядок і не роль — це тести дій і RLS. Розбір — компілятором
// TypeScript (devDependency), тому перед запуском потрібен npm ci.
// Використання: node scripts/check-actions-claims.mjs [--root <dir>]
// Код виходу: 0 — порушень немає, 1 — є порушення, 2 — немає чого перевіряти (ні src/, ні app/).

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join, relative, sep } from "node:path";
import ts from "typescript";

const args = process.argv.slice(2);
const rootIdx = args.indexOf("--root");
const root = rootIdx >= 0 ? args[rootIdx + 1] : process.cwd();

const isDir = (p) => {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
};

const hasSrc = isDir(join(root, "src"));
const BASES = hasSrc ? ["src"] : ["app", "lib"].filter((d) => isDir(join(root, d)));
if (BASES.length === 0) {
  console.error(`check-actions-claims: у ${root} немає ні src/, ні app/ — вкажіть --root <корінь проєкту>.`);
  process.exit(2);
}
const APP = hasSrc ? "src/app" : "app";
// Дії, що створюють чи знищують сесію: getClaims там немає за визначенням (ADR 0002).
const SESSION_FILES = new Set([`${APP}/login/actions.ts`, `${APP}/auth/confirm/actions.ts`]);
const SKIP_DIRS = new Set(["node_modules", ".next", ".git"]);
const EXT = /\.(tsx?|jsx?|mjs|cjs)$/;
const HTTP = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/;

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXT.test(name)) out.push(full);
  }
  return out;
}

// Розбір — компілятором TypeScript (devDependency), а не регулярними виразами: коментарі, рядки, шаблони, регулярні
// вирази й анотації типів він розуміє сам, тож крайніх випадків розбору тексту немає.
const KIND = { ".ts": ts.ScriptKind.TS, ".tsx": ts.ScriptKind.TSX, ".jsx": ts.ScriptKind.JSX };
const parse = (file, text) =>
  ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, KIND[extname(file)] ?? ts.ScriptKind.JS);

const lineOf = (sf, node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
const hasModifier = (node, kind) => (ts.canHaveModifiers(node) ? ts.getModifiers(node) ?? [] : []).some((m) => m.kind === kind);

// Директива "use server" — серед рядкових інструкцій на початку файлу.
function isUseServer(sf) {
  for (const st of sf.statements) {
    if (!ts.isExpressionStatement(st) || !ts.isStringLiteral(st.expression)) return false;
    if (st.expression.text === "use server") return true;
  }
  return false;
}

// Функція в ініціалізаторі: async () => …, async function () …, також у дужках, as і satisfies.
function functionOf(expr) {
  while (expr && (ts.isParenthesizedExpression(expr) || ts.isAsExpression(expr) || ts.isSatisfiesExpression(expr))) {
    expr = expr.expression;
  }
  return expr && (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) ? expr : null;
}

// Усі виклики у вузлі (зокрема у вкладених функціях і виразах ${…}).
function someCall(node, test) {
  let found = null;
  const visit = (n) => {
    if (found) return;
    if (ts.isCallExpression(n) && test(n.expression)) found = n;
    else ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}
const callee = (name) => (e) => (ts.isPropertyAccessExpression(e) ? e.name.text === name : ts.isIdentifier(e) && e.text === name);
const isGetClaims = (e) =>
  ts.isPropertyAccessExpression(e) &&
  e.name.text === "getClaims" &&
  ts.isPropertyAccessExpression(e.expression) &&
  e.expression.name.text === "auth";

// Експорти файлу: export (default) (async) function, export const name(: Тип) = async (…) => …,
// export default <функція чи ім'я>, а також оголошення окремо + export { name, local as alias }. Експорт не функцією
// (export const GET = createHandler(…)) повертається з fn: null — перевірити його тіло неможливо, це теж порушення.
function exportedFunctions(sf) {
  const local = new Map();
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name) local.set(st.name.text, { node: st, fn: st });
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) local.set(d.name.text, { node: d, fn: functionOf(d.initializer) });
      }
    }
  }
  const found = [];
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && hasModifier(st, ts.SyntaxKind.ExportKeyword) && st.body) {
      found.push({ name: hasModifier(st, ts.SyntaxKind.DefaultKeyword) ? "default" : st.name?.text ?? "default", node: st, fn: st });
    } else if (ts.isVariableStatement(st) && hasModifier(st, ts.SyntaxKind.ExportKeyword)) {
      for (const d of st.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) found.push({ name: d.name.text, node: d, fn: functionOf(d.initializer) });
      }
    } else if (ts.isExportAssignment(st) && !st.isExportEquals) {
      const decl = ts.isIdentifier(st.expression) ? local.get(st.expression.text) : null;
      found.push({ name: "default", ...(decl ?? { node: st, fn: functionOf(st.expression) }) });
    } else if (ts.isExportDeclaration(st) && !st.moduleSpecifier && st.exportClause && ts.isNamedExports(st.exportClause)) {
      for (const spec of st.exportClause.elements) {
        const decl = local.get((spec.propertyName ?? spec.name).text);
        if (decl) found.push({ name: spec.name.text, ...decl });
      }
    }
  }
  return found;
}

const problems = [];
const report = (file, line, message) => problems.push(`${file.split(sep).join("/")}:${line}  ${message}`);
let checkedActions = 0;

for (const file of BASES.flatMap((b) => walk(join(root, b)))) {
  const rel = relative(root, file).split(sep).join("/");
  const sf = parse(file, readFileSync(file, "utf8"));

  const session = someCall(sf, callee("getSession"));
  if (session) report(rel, lineOf(sf, session), "getSession() — не перевіряє підпис JWT; для авторизації — getClaims()");

  const isServerActions = isUseServer(sf);
  const isRoute = basename(file).startsWith("route.");
  if (!(isServerActions || isRoute) || SESSION_FILES.has(rel)) continue;

  for (const fn of exportedFunctions(sf)) {
    if (isRoute && !HTTP.test(fn.name)) continue;
    checkedActions++;
    if (!fn.fn) {
      report(
        rel,
        lineOf(sf, fn.node),
        `${fn.name}: ${isRoute ? "Route Handler" : "Server Action"} не оголошено функцією (фабрика чи обгортка) — ` +
          "наявність getClaims() не перевірити; оголосіть дію функцією й викличте supabase.auth.getClaims() у ній",
      );
    } else if (!fn.fn.body || !someCall(fn.fn.body, isGetClaims)) {
      report(
        rel,
        lineOf(sf, fn.node),
        `${fn.name}: ${isRoute ? "Route Handler" : "Server Action"} без supabase.auth.getClaims() — дію можна викликати ` +
          "напряму, оминаючи сторінку; перевірте вхід у самій дії до будь-якого запису",
      );
    }
  }
}

for (const name of ["middleware.ts", "middleware.js"]) {
  for (const dir of hasSrc ? ["", "src"] : [""]) {
    if (existsSync(join(root, dir, name))) report(join(dir, name), 1, "middleware.ts — у Next.js 16 оновлення сесії живе в src/proxy.ts");
  }
}

if (!hasSrc) console.log(`check-actions-claims: теки src/ немає — перевіряю ${BASES.map((b) => `${b}/`).join(", ")}.`);
if (problems.length === 0) {
  console.log(`check-actions-claims: OK — ${checkedActions} дій перевіряють вхід (getClaims), getSession() і middleware.ts немає.`);
  process.exit(0);
}
for (const p of problems) console.log(p);
console.log(`\ncheck-actions-claims: ${problems.length} порушень. Правило — docs/decisions/0002 і AGENTS.md (розділ «Межі»).`);
process.exit(1);
