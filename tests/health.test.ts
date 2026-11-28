// D0: /api/health відрізняє «база відповіла» від «база недоступна, призупинена чи ключ хибний».
import { describe, expect, it } from "vitest";
import { appEnvOf, classifyDbProbe, supabaseRefOf } from "@/lib/health";

describe("classifyDbProbe (/api/health)", () => {
  it("рахує базу живою, коли запит пройшов або Postgres відмовив у правах (42501)", () => {
    expect(classifyDbProbe({ status: 200, error: null })).toEqual({ db: "ok", reason: "" });
    expect(classifyDbProbe({ status: 401, error: { code: "42501", message: "permission denied for table profiles" } })).toEqual({
      db: "ok",
      reason: "",
    });
    expect(classifyDbProbe({ status: 400, error: { code: "PGRST100", message: "bad filter" } }).db).toBe("ok");
  });

  it("повідомляє «paused», коли Supabase відповідає 540 (безкоштовний проєкт призупинено)", () => {
    expect(classifyDbProbe({ status: 540, error: { message: "project paused" } })).toEqual({ db: "down", reason: "paused" });
  });

  it("повідомляє про хибний публічний ключ", () => {
    expect(classifyDbProbe({ status: 401, error: { message: "Invalid API key" } })).toEqual({
      db: "down",
      reason: "invalid-api-key",
    });
  });

  it("повідомляє код, коли PostgREST не дістає до бази або мережі немає", () => {
    expect(classifyDbProbe({ status: 503, error: { code: "PGRST002", message: "schema cache" } })).toEqual({
      db: "down",
      reason: "status-503-PGRST002",
    });
    expect(classifyDbProbe({ status: 0, error: { message: "fetch failed" } })).toEqual({ db: "down", reason: "status-0" });
  });
  it("рахує базу недоступною на 5xx навіть із кодом SQLSTATE (53300, 57P03)", () => {
    expect(classifyDbProbe({ status: 503, error: { code: "53300", message: "too many connections" } })).toEqual({
      db: "down",
      reason: "status-503-53300",
    });
    expect(classifyDbProbe({ status: 503, error: { code: "57P03", message: "the database system is starting up" } }).db).toBe("down");
    expect(classifyDbProbe({ status: 500, error: null }).db).toBe("down");
  });
});

// WS11 (A): у якому середовищі й на якій базі деплой — без секретів.
describe("appEnvOf (/api/health → appEnv)", () => {
  it("повертає мітку з APP_ENV, а без змінної — null", () => {
    expect(appEnvOf("staging")).toBe("staging");
    expect(appEnvOf(" Staging ")).toBe("staging");
    expect(appEnvOf(undefined)).toBeNull();
    expect(appEnvOf("")).toBeNull();
  });

  it("не віддає довільний текст: значення не за форматом — null", () => {
    expect(appEnvOf("staging; DROP")).toBeNull();
    expect(appEnvOf("x".repeat(40))).toBeNull();
  });
});

describe("supabaseRefOf (/api/health → supabaseRef)", () => {
  it("бере ref з публічної адреси проєкту Supabase", () => {
    expect(supabaseRefOf("https://abcdefghijklmnopqrst.supabase.co")).toBe("abcdefghijklmnopqrst");
    expect(supabaseRefOf("https://abcdefghijklmnopqrst.supabase.co/")).toBe("abcdefghijklmnopqrst");
  });

  it("без змінної, з локальним стеком чи з чужою адресою — null", () => {
    expect(supabaseRefOf(undefined)).toBeNull();
    expect(supabaseRefOf("http://127.0.0.1:54321")).toBeNull();
    expect(supabaseRefOf("not a url")).toBeNull();
    expect(supabaseRefOf("https://abcdefghijklmnopqrst.supabase.co.example.test")).toBeNull();
  });
});
