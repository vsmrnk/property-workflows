// Вхід кожної ролі один раз за прогін → playwright/.auth/<role>.json (у .gitignore: там живі cookie сесії).
// Тести ролей беруть стан через test.use({ storageState: "playwright/.auth/<role>.json" }).
// У цьому проєкті запис вимкнено (playwright.config.ts: setup — video, trace і screenshot "off"): тут вводиться пароль.
//
// Змінні з паролями (лише назви; значення — у .env.local локально або в secrets CI, ніколи в коді):
//   DEMO_USER_PASSWORD           — спільний пароль акаунтів із supabase/demo-users.json (npm run users:demo);
//   UAT_PASSWORD_<РОЛЬ>          — необов'язково: окремий пароль для ролі, напр. UAT_PASSWORD_ADMIN.
//
// Джерело: демо-репо курсу, tests/e2e/auth.setup.ts (тег ws8-03-uat). ROLES — ВАШІ: роль → адреса акаунта на проді
// (D0.5, *@example.test). Нижче — акаунти цього застосунку (supabase/demo-users.json): адміністратор A і менеджер B.
import { expect, test as setup } from "@playwright/test";
import { hasAdminKey } from "./support/admin";
import { signIn } from "./support/uat";
import { apiAs, createUatUser, launchAs, saveVendorData, stateOf, templateAsManager, type UatKey, type UatUser } from "./support/vendor";

const ROLES = {
  admin: "admin@example.test",
  "manager-b": "manager-b@example.test",
} as const;

// UAT_PASSWORD_MANAGER_B: дефіс у назві змінної середовища незручний — замінюємо на «_».
const envRole = (role: string) => role.toUpperCase().replace(/-/g, "_");

for (const [role, email] of Object.entries(ROLES)) {
  setup(`вхід: ${role}`, async ({ page }) => {
    const password = process.env[`UAT_PASSWORD_${envRole(role)}`] ?? process.env.DEMO_USER_PASSWORD;
    expect(password, `немає пароля для ролі ${role}: DEMO_USER_PASSWORD або UAT_PASSWORD_${envRole(role)}`).toBeTruthy();
    await signIn(page, email, password!);
    // Головна шаблону показує email того, хто увійшов (data-testid="user-email"). Інша головна — свій локатор.
    await expect(page.getByTestId("user-email")).toHaveText(email);
    await page.context().storageState({ path: `playwright/.auth/${role}.json` });
  });
}

// Зріз 3 (AC-VENDOR-01…10): синтетичні менеджер A і вендори uat-<run>-…@example.test та їхні рани — лише з секретним
// ключем (.env.local). Тут, у setup без запису: вхід формою з випадковим паролем і запуск ранів через API.
// Прибирає їх cleanup.teardown.ts (OWNED_ROWS у support/admin.ts: рани менеджера й задачі виконавців).
if (hasAdminKey()) {
  setup("дані зрізу 3: менеджер A, вендори V, X, Y, W і рани «Apartment 12, move-in», «Apartment 14, repair»", async ({ browser }) => {
    // 5 createUser, 5 входів формою і 3 запуски ранів на проді — більше за загальні 60 с з playwright.config.ts при
    // повільній мережі; обірваний setup лишив би користувачів без uat-vendor.json, і впали б усі AC-VENDOR.
    setup.setTimeout(180_000);
    const roles: Record<UatKey, UatUser["role"]> = {
      "manager-a": "manager",
      "vendor-v": "vendor",
      "vendor-x": "vendor",
      "vendor-y": "vendor",
      "vendor-w": "vendor",
    };
    const users = {} as Record<UatKey, UatUser>;
    for (const [key, role] of Object.entries(roles) as [UatKey, UatUser["role"]][]) {
      users[key] = await createUatUser(key, role);
      const context = await browser.newContext();
      const page = await context.newPage();
      await signIn(page, users[key].email, users[key].password);
      await expect(page.getByTestId("user-email")).toHaveText(users[key].email);
      await context.storageState({ path: stateOf(key) });
      await context.close();
    }

    const managerA = await apiAs(users["manager-a"]);
    const template = await templateAsManager(managerA, "Tenant move-in");
    const repair = await templateAsManager(managerA, "Maintenance request");
    // «Дано» AC-VENDOR-01…07: шаблон «Tenant move-in» з 5 задачами — задачі 3 і 4 рахуються саме в ньому. Інша кількість
    // на проді — не та «Дано»: зупиняємось з поясненням, а не призначаємо вендора не тим задачам.
    expect(
      template.tasks.map((t) => t.name),
      "«Дано»: шаблон «Tenant move-in» на проді має мати 5 задач seed.sql — адміністратор приводить його до них і зберігає нову версію (docs/qa/uat/README.md)",
    ).toHaveLength(5);
    const [, , task3, task4] = template.tasks;
    const run12 = await launchAs(managerA, template.id, "Apartment 12, move-in", {
      [task3.id]: users["vendor-v"].id,
      [task4.id]: users["vendor-v"].id,
    });
    const run14 = await launchAs(managerA, repair.id, "Apartment 14, repair");
    const run12y = await launchAs(managerA, template.id, "Apartment 12, move-in", {
      [task3.id]: users["vendor-y"].id,
      [task4.id]: users["vendor-y"].id,
    });
    saveVendorData({ users, template, runs: { run12, run14, run12y } });
  });
}
