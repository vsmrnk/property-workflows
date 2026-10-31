// UAT зрізу «Редагування шаблону й версії» (requirements/20-edit-template-version-control.md): доступ до редактора.
// Лише читання: безпечно на проді. Відвідувач — чистий контекст браузера без жодної сесії.
import { expect, test } from "@playwright/test";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";
import { adminPage, templateLinks } from "./support/templates";

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

test(
  "AC-EDITOR-09: відвідувач без входу за прямим посиланням на редактор «Tenant move-in» бачить сторінку входу без вмісту шаблону",
  { tag: ["@uat"], annotation: { type: "ac", description: "AC-EDITOR-09" } },
  async ({ page, browser }) => {
    let editorHref = "";
    // Вміст шаблону, якого відвідувач не має побачити: назва, назви секцій і задач (з поточної версії, очима адміністратора).
    const content: string[] = ["Tenant move-in"];

    await given("a visitor who is not signed in", async () => {
      const admin = await adminPage(browser);
      try {
        const links = await templateLinks(admin.page, "Tenant move-in");
        editorHref = links.editor;
        await admin.page.goto(links.editor.replace(/\/edit$/, ""));
        content.push(...(await admin.page.getByTestId("template-section").getByRole("heading").allInnerTexts()));
        content.push(...(await admin.page.getByTestId("template-task").locator("td:first-child").allInnerTexts()));
        expect(content.length, "у «Tenant move-in» мають бути секції й задачі").toBeGreaterThan(2);
      } finally {
        await admin.ctx.close();
      }
      // Контекст тесту — без storageState: cookie сесії немає.
      expect(await page.context().cookies()).toEqual([]);
    });

    await when('the visitor opens the editor of the template "Tenant move-in" by a direct link', async () => {
      await page.goto(editorHref);
    });

    await thenStep(
      page,
      {
        clause: "the visitor sees the sign-in page and no content of the template.",
        visible: ['the sign-in page: heading "Sign in", fields "Email" and "Password", button "Sign in"'],
        hidden: [
          "no content of the template: neither the name «Tenant move-in» nor any of its section or task names is on the page",
          "the address is /login (the editor did not render)",
        ],
      },
      async () => {
        await expect(page).toHaveURL((url) => url.pathname === "/login");
        await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in");
        await expect(page.getByLabel("Email")).toBeVisible();
        await expect(page.getByLabel("Password")).toBeVisible();
        await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
        const body = await page.locator("body").innerText();
        for (const text of content.map((t) => t.trim()).filter(Boolean)) {
          expect(body, `на сторінці входу є вміст шаблону: «${text}»`).not.toContain(text);
        }
        await expect(page.getByTestId("editor-section")).toHaveCount(0);
        await expect(page.getByTestId("editor-task")).toHaveCount(0);
      },
    );
  },
);
