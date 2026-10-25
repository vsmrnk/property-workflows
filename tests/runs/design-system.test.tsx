// @vitest-environment happy-dom
// Дизайн-система (solomchaak/property-workflows-spec#19): що бачить користувач — статус рану на сторінці списку й на
// сторінці рану, порожній список ранів — і що кольори статусів у токенах справді ті, що в «Вигляд і тон» PM.
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RunStatusBadge, RunsEmpty } from "@/app/_components/ui";
import Home from "@/app/page";
import RunPage from "@/app/runs/[id]/page";

// Підмінений клієнт Supabase: ланцюжок select/eq/order повертає рядки таблиці, maybeSingle — перший рядок.
const RUNS = [
  { id: "r-progress", case_name: "Apartment 12, move-in", status: "in_progress", manager_id: "m-a", created_at: "2026-10-20T08:00:00Z", templates: { name: "Tenant move-in" }, run_tasks: [{ status: "done", required: true }, { status: "done", required: true }, { status: "to_do", required: true }, { status: "to_do", required: false }, { status: "to_do", required: false }] },
  { id: "r-completed", case_name: "Apartment 14, move-in", status: "completed", manager_id: "m-a", created_at: "2026-10-19T08:00:00Z", templates: { name: "Tenant move-in" }, run_tasks: [...Array.from({ length: 5 }, () => ({ status: "done", required: true })), { status: "to_do", required: false }] },
];
let runForPage = RUNS[0];
const rows: Record<string, () => unknown[]> = {
  profiles: () => [{ email: "manager-a@example.test", role: "manager" }],
  runs: () => [runForPage],
  run_tasks: () => runForPage.run_tasks.map((t, i) => ({ id: `t${i}`, section_name: "Before move-in", section_position: 1, name: `Task ${i + 1}`, position: i, assignee_id: "m-a", ...t })),
};
function query(table: string) {
  const list = table === "runs" ? () => RUNS : rows[table];
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    maybeSingle: async () => ({ data: (table === "runs" ? rows.runs() : list())[0] ?? null }),
    then: (resolve: (v: { data: unknown[] }) => unknown) => resolve({ data: list() }),
  };
  return builder;
}
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: { sub: "m-a", email: "manager-a@example.test" } } }) },
    from: (table: string) => query(table),
    rpc: async () => ({ data: [{ id: "m-a", email: "manager-a@example.test" }] }),
  }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

/** Бейджі статусу рану на відрендереній сторінці: слово й класи кольору. */
function statusBadges(html: string) {
  document.body.innerHTML = html;
  return [...document.querySelectorAll('[data-testid="run-status"]')].map((el) => ({
    text: el.textContent?.trim(),
    className: el.getAttribute("class") ?? "",
  }));
}

const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
const [lightCss, darkCss] = css.split("@media (prefers-color-scheme: dark)");

/** Відтінок (hue) OKLCH токена `--<name>` у блоці теми. */
function hue(block: string, name: string): number {
  const m = new RegExp(`--${name}:\\s*oklch\\([^)]*\\s([\\d.]+)\\)`).exec(block);
  if (!m) throw new Error(`немає токена --${name}`);
  return Number(m[1]);
}

const BLUE = [230, 270]; // OKLCH hue: синій
const GREEN = [130, 170]; // OKLCH hue: зелений
const inRange = (h: number, [lo, hi]: number[]) => h >= lo && h <= hi;

describe("design system", () => {
  it("AC-DSYS-01: «in progress» — синій, «completed» — зелений, слово статусу завжди поруч із кольором", () => {
    // Список ранів і сторінка рану показують статус тим самим компонентом.
    const progress = renderToStaticMarkup(<RunStatusBadge status="in_progress" />);
    const completed = renderToStaticMarkup(<RunStatusBadge status="completed" />);
    expect(progress).toContain(">in progress<");
    expect(progress).toContain("bg-status-progress");
    expect(completed).toContain(">completed<");
    expect(completed).toContain("bg-status-done");

    for (const block of [lightCss, darkCss]) {
      expect(inRange(hue(block, "status-progress-foreground"), BLUE)).toBe(true);
      expect(inRange(hue(block, "status-done-foreground"), GREEN)).toBe(true);
    }
  });

  it("AC-DSYS-01: список ранів і сторінка кожного рану показують «in progress» синім і «completed» зеленим", async () => {
    const list = statusBadges(renderToStaticMarkup(await Home()));
    expect(list.map((b) => b.text)).toEqual(["in progress", "completed"]);
    expect(list[0].className).toContain("bg-status-progress");
    expect(list[1].className).toContain("bg-status-done");
    // Колір заповнення смуги — за статусом рану: «completed» з невиконаною необов'язковою задачею — зелений.
    const fills = [...document.querySelectorAll('[role="progressbar"] > div')].map((el) => el.getAttribute("class") ?? "");
    expect(fills[0]).toContain("bg-status-progress-foreground");
    expect(fills[1]).toContain("bg-status-done-foreground");

    for (const [run, word, cls, fill] of [
      [RUNS[0], "in progress", "bg-status-progress", "bg-status-progress-foreground"],
      [RUNS[1], "completed", "bg-status-done", "bg-status-done-foreground"],
    ] as const) {
      runForPage = run;
      const page = statusBadges(renderToStaticMarkup(await RunPage({ params: Promise.resolve({ id: run.id }) } as never)));
      expect(page).toHaveLength(1);
      expect(page[0].text).toBe(word);
      expect(page[0].className).toContain(cls);
      expect(document.querySelector('[role="progressbar"] > div')?.getAttribute("class")).toContain(fill);
    }
  });

  it("AC-DSYS-04: менеджер без ранів — «No runs yet. Launch a template to start one.» і «Launch a template», без таблиці", () => {
    const html = renderToStaticMarkup(<RunsEmpty />);
    expect(html).toContain("No runs yet. Launch a template to start one.");
    expect(html).toMatch(/<a[^>]*href="\/runs\/new"[^>]*>Launch a template<\/a>/);
    expect(html).not.toContain("<table");
  });
});
