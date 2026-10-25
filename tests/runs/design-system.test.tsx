// Дизайн-система (solomchaak/property-workflows-spec#19): що бачить користувач — бейдж статусу рану й порожній список
// ранів — і що кольори статусів у токенах справді ті, що в «Вигляд і тон» PM.
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RunStatusBadge, RunsEmpty } from "@/app/_components/ui";

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

  it("AC-DSYS-04: менеджер без ранів — «No runs yet. Launch a template to start one.» і «Launch a template», без таблиці", () => {
    const html = renderToStaticMarkup(<RunsEmpty />);
    expect(html).toContain("No runs yet. Launch a template to start one.");
    expect(html).toMatch(/<a[^>]*href="\/runs\/new"[^>]*>Launch a template<\/a>/);
    expect(html).not.toContain("<table");
  });
});
