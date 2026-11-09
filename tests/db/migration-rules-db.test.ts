// Правила міграцій (AGENTS.md, «База даних»), перевірені на каталозі Postgres після всіх міграцій — тест іде в
// обов'язковий db-check і блокує злиття, а не лише рецензію (відгук викладача до WS8, п. 3: «D1 ловить лише рецензія»).
// Емуляція дає нові об'єкти в public з правами Supabase за замовчуванням (supabase-pglite.ts), тож пропущений revoke
// тут видно.
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";

let t: TestDb;

beforeAll(async () => {
  t = await createTestDb();
});

describe("міграції: правила бази", () => {
  it("security definer — лише в private і лише з set search_path = ''", async () => {
    const rows = await t.asService<{ schema: string; name: string }>(
      `select n.nspname as schema, p.proname as name
       from pg_proc as p
       join pg_namespace as n on n.oid = p.pronamespace
       where p.prosecdef
         and n.nspname not in ('pg_catalog', 'information_schema')
         and (n.nspname <> 'private' or not coalesce(p.proconfig, '{}') @> array['search_path=""'])
       order by 1, 2`,
    );
    expect(rows).toEqual([]);
  });

  it("anon не має прав на жодну таблицю public і не виконує жодної функції public", async () => {
    const tables = await t.asService<{ name: string }>(
      `select c.relname as name
       from pg_class as c
       join pg_namespace as n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
         and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('anon', c.oid, 'insert')
           or has_table_privilege('anon', c.oid, 'update') or has_table_privilege('anon', c.oid, 'delete'))
       order by 1`,
    );
    expect(tables).toEqual([]);
    // Колонковий grant (grant select (email) … to anon) has_table_privilege не бачить — окремо по колонках.
    const columns = await t.asService<{ name: string }>(
      `select c.relname || '.' || a.attname as name
       from pg_attribute as a
       join pg_class as c on c.oid = a.attrelid
       join pg_namespace as n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f') and a.attnum > 0 and not a.attisdropped
         and (has_column_privilege('anon', c.oid, a.attnum, 'select') or has_column_privilege('anon', c.oid, a.attnum, 'insert')
           or has_column_privilege('anon', c.oid, a.attnum, 'update'))
       order by 1`,
    );
    expect(columns).toEqual([]);
    const functions = await t.asService<{ name: string }>(
      `select p.proname as name
       from pg_proc as p
       join pg_namespace as n on n.oid = p.pronamespace
       where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
       order by 1`,
    );
    expect(functions).toEqual([]);
  });

  it("кожна таблиця public — з увімкненим row level security", async () => {
    const rows = await t.asService<{ name: string }>(
      `select c.relname as name
       from pg_class as c
       join pg_namespace as n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
       order by 1`,
    );
    expect(rows).toEqual([]);
  });
});
