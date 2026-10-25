#!/usr/bin/env node
// Архітектурне правило «кожна дія перевіряє вхід» (ADR 0002).
// 1) Кожна експортована функція у файлі з "use server" (Server Action — публічний POST-ендпойнт) і кожен обробник
//    Route Handler (route.ts: GET, POST…) викликає supabase.auth.getClaims() ДО будь-якої роботи з даними.
//    Виняток — дії, які сесію створюють або знищують: вхід і вихід (src/app/login/actions.ts), активація за
//    посиланням (src/app/auth/confirm/actions.ts). Там claims ще немає (або вони вже не потрібні).
// 2) Жодного getSession() у коді (коментарі не рахуються): він не перевіряє підпис JWT.
// 3) Немає middleware.ts: у Next.js 16 оновлення сесії — src/proxy.ts.
// Скрипт перевіряє наявність виклику, а не його порядок і не роль — це тести дій і RLS.
// Використання: node scripts/check-actions-claims.mjs [--root <dir>]
// Код виходу: 0 — порушень немає, 1 — є порушення, 2 — немає чого перевіряти (ні src/, ні app/).

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";

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

// Прибирає коментарі, зберігаючи рядки (номери рядків у звіті лишаються правильними). Рядки з "//" усередині
// лапок (адреси https://…) не чіпаємо: коментар рядка — лише після пробілу чи з початку рядка.
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[\s;{}(),])\/\/.*$/gm, "$1");
}

const lineOf = (text, index) => text.slice(0, index).split("\n").length;

// Експортовані функції файлу: export (async) function name(…) { … } і export const name = async (…) => { … }.
// Тіло — від оголошення до наступного експорту верхнього рівня або кінця файлу.
function exportedFunctions(code) {
  const re = /^export\s+(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z0-9_$]*)|^export\s+const\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_$]+)\s*=>/gm;
  const found = [];
  let m;
  while ((m = re.exec(code))) found.push({ name: m[1] || m[2] || "default", start: m.index });
  return found.map((f, i) => ({ ...f, body: code.slice(f.start, found[i + 1]?.start ?? code.length) }));
}

const problems = [];
const report = (file, line, message) => problems.push(`${file.split(sep).join("/")}:${line}  ${message}`);
let checkedActions = 0;

for (const file of BASES.flatMap((b) => walk(join(root, b)))) {
  const rel = relative(root, file).split(sep).join("/");
  const code = stripComments(readFileSync(file, "utf8"));

  const session = /\bgetSession\s*\(/.exec(code);
  if (session) report(rel, lineOf(code, session.index), "getSession() — не перевіряє підпис JWT; для авторизації — getClaims()");

  const isServerActions = /^\s*["']use server["']/.test(code);
  const isRoute = basename(file).startsWith("route.");
  if (!(isServerActions || isRoute) || SESSION_FILES.has(rel)) continue;

  for (const fn of exportedFunctions(code)) {
    if (isRoute && !HTTP.test(fn.name)) continue;
    checkedActions++;
    if (!/\.auth\.getClaims\s*\(/.test(fn.body)) {
      report(
        rel,
        lineOf(code, fn.start),
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
