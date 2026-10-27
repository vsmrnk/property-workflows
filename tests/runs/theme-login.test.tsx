// @vitest-environment happy-dom
// Тема й повернення після входу (impl-template-versions-2 U5–U6): вибір «Theme», скрипт у <head>, токени темної теми
// для статусів, next після входу. Supabase підмінений; Base UI Select — справжній.
import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ThemeSelect } from "@/app/_components/theme-select";
import { RunStatusBadge } from "@/app/_components/ui";
import { safeNextPath } from "@/lib/auth/next-path";
import { THEME_SCRIPT } from "@/lib/theme";

const signInWithPassword = vi.fn();
let proxyClaims: unknown = null;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signInWithPassword } }),
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims: async () => ({ data: { claims: proxyClaims } }) } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

const { login } = await import("@/app/login/actions");
const { default: LoginPage } = await import("@/app/login/page");
const { updateSession } = await import("@/lib/supabase/proxy");

let systemDark = false;
function setSystem(dark: boolean) {
  systemDark = dark;
  window.matchMedia = ((query: string) => ({
    matches: query === "(prefers-color-scheme: dark)" && systemDark,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}
// Відкрити сторінку: скрипт із <head> до першого малювання (src/app/layout.tsx).
const openPage = () => new Function(THEME_SCRIPT)();

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});
afterEach(() => cleanup());

describe("theme", () => {
  it("AC-DSYS-05: пристрій у темному вигляді, тему не обрано — сторінка темна, «Theme» показує «System»", () => {
    setSystem(true);
    openPage();
    expect(document.documentElement.dataset.theme).toBe("dark");
    render(<ThemeSelect />);
    expect(screen.getByRole("combobox", { name: "Theme" }).textContent).toContain("System");
  });

  it("AC-DSYS-06: обрана «Light» на темному пристрої — світла тема й «Light» до і після повторного відкриття", async () => {
    setSystem(true);
    openPage();
    render(<ThemeSelect />);
    fireEvent.click(screen.getByRole("combobox", { name: "Theme" }));
    const light = await screen.findByRole("option", { name: "Light" });
    light.focus();
    fireEvent.keyDown(light, { key: "Enter" });
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("light"));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(screen.getByRole("combobox", { name: "Theme" }).textContent).toContain("Light");

    // Закрити браузер і відкрити знову: на пристрої лишається лише localStorage.
    cleanup();
    delete document.documentElement.dataset.theme;
    openPage();
    expect(document.documentElement.dataset.theme).toBe("light");
    render(<ThemeSelect />);
    expect(screen.getByRole("combobox", { name: "Theme" }).textContent).toContain("Light");

    // Вибір в іншій вкладці того самого пристрою — ця вкладка теж змінює тему, а не лише назву вибору.
    localStorage.setItem("theme", "dark");
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "theme", newValue: "dark" }));
    });
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("combobox", { name: "Theme" }).textContent).toContain("Dark");
  });

  it("AC-DSYS-07: у темній темі «in progress» синім і «completed» зеленим зі словом поруч, контраст ≥ 4.5", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const dark = tokens(css, ':root[data-theme="dark"] {');
    // Резерв без скрипта (за системою) — ті самі значення.
    expect(tokens(css, ":root:not([data-theme]) {")).toEqual(dark);

    const progress = renderToStaticMarkup(<RunStatusBadge status="in_progress" />);
    const completed = renderToStaticMarkup(<RunStatusBadge status="completed" />);
    expect(progress).toContain(">in progress<");
    expect(progress).toContain("bg-status-progress text-status-progress-foreground");
    expect(completed).toContain(">completed<");
    expect(completed).toContain("bg-status-done text-status-done-foreground");

    // Синій і зелений — як у світлій темі: відтінок OKLCH у тих самих діапазонах.
    expect(hue(dark["status-progress-foreground"])).toBeGreaterThan(240);
    expect(hue(dark["status-progress-foreground"])).toBeLessThan(270);
    expect(hue(dark["status-done-foreground"])).toBeGreaterThan(140);
    expect(hue(dark["status-done-foreground"])).toBeLessThan(165);
    expect(contrast(dark["status-progress-foreground"], dark["status-progress"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(dark["status-done-foreground"], dark["status-done"])).toBeGreaterThanOrEqual(4.5);
  });
});

describe("sign in from a direct link", () => {
  it("AC-DSYS-08: відвідувач без входу за посиланням на ран — вхід, потім сторінка цього рану", async () => {
    proxyClaims = null;
    const res = await updateSession(new NextRequest("https://app.example.test/runs/run-12"));
    const to = new URL(res.headers.get("location")!);
    expect(to.pathname).toBe("/login");
    expect(to.searchParams.get("next")).toBe("/runs/run-12");

    document.body.innerHTML = renderToStaticMarkup(
      await LoginPage({ searchParams: Promise.resolve({ next: "/runs/run-12" }) } as never),
    );
    expect(document.querySelector<HTMLInputElement>('input[type="hidden"][name="next"]')?.value).toBe("/runs/run-12");

    signInWithPassword.mockResolvedValue({ error: null });
    const fd = new FormData();
    fd.set("email", "manager-b@example.test");
    fd.set("password", "x");
    fd.set("next", "/runs/run-12");
    await expect(login(fd)).rejects.toThrow("REDIRECT:/runs/run-12");
  });

  it("AC-DSYS-08: next лише локальний — чужа адреса веде на головну; хибний пароль лишає next", async () => {
    expect(safeNextPath("//evil.example.test")).toBe("/");
    expect(safeNextPath("/\\evil.example.test")).toBe("/");
    expect(safeNextPath("https://evil.example.test")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
    // Табуляція чи перенос (%09, %0A у посиланні) — парсер URL їх викидає, і "/\t/host" стає "//host".
    expect(safeNextPath("/\t/evil.example.test")).toBe("/");
    expect(safeNextPath("/\n/evil.example.test")).toBe("/");
    expect(safeNextPath(decodeURIComponent("/%09/evil.example.test"))).toBe("/");
    expect(safeNextPath("/runs/run-12?tab=1")).toBe("/runs/run-12?tab=1");

    signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    const fd = new FormData();
    fd.set("email", "manager-b@example.test");
    fd.set("password", "wrong");
    fd.set("next", "/runs/run-12");
    await expect(login(fd)).rejects.toThrow("REDIRECT:/login?error=invalid&next=%2Fruns%2Frun-12");
  });
});

// --- OKLCH → WCAG 2.x контраст (як у таблиці DESIGN.md) ---
function tokens(css: string, selector: string) {
  const start = css.indexOf(selector);
  expect(start).toBeGreaterThan(-1);
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}
function parse(value: string) {
  const m = /oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)/.exec(value);
  if (!m) throw new Error(`not oklch: ${value}`);
  return { l: Number(m[1]) / 100, c: Number(m[2]), h: Number(m[3]) };
}
function hue(value: string) {
  return parse(value).h;
}
function luminance(value: string) {
  const { l, c, h } = parse(value);
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ].map((v) => Math.min(1, Math.max(0, v)));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}
function contrast(fg: string, bg: string) {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
