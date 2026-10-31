// Помічники UAT для шаблонів: адміністратор A у ОКРЕМОМУ контексті браузера (власна збережена сесія) перевіряє «Дано»
// і знаходить адреси за назвою шаблону, як це зробила б людина, — без секретного ключа й без запису в базу.
// Не *.spec.ts: Playwright цей файл як тест не запускає, а ac:coverage його не рахує.
import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

export const ADMIN_STATE = "playwright/.auth/admin.json";
export const MANAGER_B_STATE = "playwright/.auth/manager-b.json";

export type TemplateLinks = { editor: string; versions: string };

/** Контекст адміністратора; закривайте його після «Дано» (await ctx.close()). */
export async function adminPage(browser: Browser): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ storageState: ADMIN_STATE });
  return { ctx, page: await ctx.newPage() };
}

/** Адреси редактора й списку версій шаблону за точною назвою — зі списку /templates адміністратора. */
export async function templateLinks(admin: Page, name: string): Promise<TemplateLinks> {
  await admin.goto("/templates");
  const editor = admin.getByRole("link", { name: `Edit “${name}”`, exact: true });
  const versions = admin.getByRole("link", { name: `Versions of “${name}”`, exact: true });
  await expect(editor, `шаблону «${name}» немає в списку адміністратора`).toHaveCount(1);
  await expect(versions).toHaveCount(1);
  return { editor: (await editor.getAttribute("href"))!, versions: (await versions.getAttribute("href"))! };
}

/** Номери збережених версій на сторінці списку версій (адміністратор), напр. ["Version 2", "Version 1"]. */
export async function versionLabels(admin: Page, versionsHref: string): Promise<string[]> {
  await admin.goto(versionsHref);
  await expect(admin.getByRole("heading", { level: 1 })).toBeVisible();
  return (await admin.getByTestId("version").locator("td:first-child").allInnerTexts()).map((t) => t.trim());
}
