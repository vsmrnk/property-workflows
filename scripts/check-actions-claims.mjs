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

// Прибирає текст рядкових літералів ('…', "…", текст шаблону `…`), зберігаючи переноси рядків і лапки: виклик у тексті
// рядка — не виклик. Вирази `${…}` у шаблонах — це код, тож їх лишаємо (зі вкладеними {} і рядками).
function stripStrings(text) {
  const out = [...text];
  const blank = (from, to) => {
    for (let k = from; k < to; k++) if (out[k] !== "\n") out[k] = " ";
  };
  // Код з позиції i до закривної «}» на глибині 0 (або до кінця); повертає позицію після неї.
  function code(i, untilBrace) {
    for (let depth = 0; i < text.length; i++) {
      const c = text[i];
      if (c === "'" || c === '"') i = quoted(i, c) - 1;
      else if (c === "`") i = template(i) - 1;
      else if (c === "{") depth++;
      else if (c === "}" && untilBrace && depth-- === 0) return i + 1;
    }
    return i;
  }
  function quoted(start, q) {
    let i = start + 1;
    while (i < text.length && text[i] !== q && text[i] !== "\n") i += text[i] === "\\" ? 2 : 1;
    blank(start + 1, Math.min(i, text.length));
    return i + 1;
  }
  function template(start) {
    let i = start + 1;
    let from = i;
    while (i < text.length && text[i] !== "`") {
      if (text[i] === "\\") i += 2;
      else if (text[i] === "$" && text[i + 1] === "{") {
        blank(from, i);
        i = code(i + 2, true);
        from = i;
      } else i++;
    }
    blank(from, Math.min(i, text.length));
    return i + 1;
  }
  code(0, false);
  return out.join("");
}

const lineOf = (text, index) => text.slice(0, index).split("\n").length;

// Тіло функції, оголошеної з позиції start: параметри (…) → тип результату (дужки всередині <…> пропускаємо) →
// тіло { … } за парними дужками. Стрілкова функція з виразом замість тіла — до «;» на верхньому рівні.
function functionBody(code, start) {
  let i = code.indexOf("(", start);
  if (i < 0) return code.slice(start);
  for (let depth = 0; i < code.length; i++) {
    if (code[i] === "(") depth++;
    else if (code[i] === ")" && --depth === 0) {
      i++;
      break;
    }
  }
  for (let angle = 0; i < code.length; i++) {
    const c = code[i];
    if (c === "<") angle++;
    else if (c === ">" && code[i - 1] !== "=") angle = Math.max(0, angle - 1);
    else if (c === "{" && angle === 0) break;
    else if (c === ";" && angle === 0) return code.slice(start, i);
  }
  let end = i;
  for (let depth = 0; end < code.length; end++) {
    if (code[end] === "{") depth++;
    else if (code[end] === "}" && --depth === 0) {
      end++;
      break;
    }
  }
  return code.slice(start, end);
}

// Експортовані функції файлу: export (async) function name(…) { … } і export const name = async (…)[: Тип] => { … }.
function exportedFunctions(code) {
  const re = /^export\s+(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z0-9_$]*)|^export\s+const\s+([A-Za-z0-9_$]+)\s*(?::(?:=>|[^=])+)?=(?!>)\s*(?=async\b|function\b|\()/gm;
  const found = [];
  let m;
  while ((m = re.exec(code))) found.push({ name: m[1] || m[2] || "default", start: m.index });
  // Оголошення окремо, експорт списком: async function POST() { … } + export { POST } / export { save as default }.
  const list = /^export\s*\{([^}]*)\}/gm;
  while ((m = list.exec(code))) {
    for (const item of m[1].split(",").map((x) => x.trim()).filter(Boolean)) {
      const [local, alias] = item.split(/\s+as\s+/).map((x) => x.trim());
      const name = local.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $ у JS-іменах — не якір регулярного виразу
      const decl = new RegExp(
        `^(?:async\\s+)?function\\s*\\*?\\s*${name}\\s*\\(|^(?:const|let|var)\\s+${name}\\s*(?::(?:=>|[^=])+)?=(?!>)\\s*(?=async\\b|function\\b|\\()`,
        "m",
      ).exec(code);
      if (decl) found.push({ name: alias || local, start: decl.index });
    }
  }
  return found.map((f) => ({ ...f, body: functionBody(code, f.start) }));
}

const problems = [];
const report = (file, line, message) => problems.push(`${file.split(sep).join("/")}:${line}  ${message}`);
let checkedActions = 0;

for (const file of BASES.flatMap((b) => walk(join(root, b)))) {
  const rel = relative(root, file).split(sep).join("/");
  const withStrings = stripComments(readFileSync(file, "utf8"));
  const code = stripStrings(withStrings);

  const session = /\bgetSession\s*\(/.exec(code);
  if (session) report(rel, lineOf(code, session.index), "getSession() — не перевіряє підпис JWT; для авторизації — getClaims()");

  const isServerActions = /^\s*["']use server["']/.test(withStrings);
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
