// WS11 (B): тестовий маршрут трекера помилок — помилку дістає лише адміністратор і лише в preview/staging/dev.
// Назви без AC ID: технічна перевірка, а не критерій приймання PM.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ sub: null as string | null, role: null as string | null }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: async () => ({ data: state.sub ? { claims: { sub: state.sub } } : null }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.role ? { role: state.role } : null }) }) }),
    }),
  }),
}));

import { GET } from "@/app/api/ops/error-drill/route";

describe("/api/ops/error-drill", () => {
  beforeEach(() => {
    state.sub = null;
    state.role = null;
    vi.stubEnv("VERCEL_ENV", "preview");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("на проді — 404 навіть для адміністратора", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    state.sub = "u1";
    state.role = "admin";
    expect((await GET()).status).toBe(404);
  });

  it("поза дозволеними середовищами (VERCEL_ENV не задано, як у `next start`) — 404 навіть для адміністратора", async () => {
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("APP_ENV", "");
    state.sub = "u1";
    state.role = "admin";
    expect((await GET()).status).toBe(404);
  });

  it("гілка staging (APP_ENV=staging) — дозволено", async () => {
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("APP_ENV", "staging");
    state.sub = "u1";
    state.role = "admin";
    await expect(GET()).rejects.toThrow("Intentional server error: error tracker check");
  });

  it("без входу — 401", async () => {
    expect((await GET()).status).toBe(401);
  });

  it("менеджер чи вендор — 403 «Not enough rights», помилки немає", async () => {
    for (const role of ["manager", "vendor"]) {
      state.sub = "u1";
      state.role = role;
      const res = await GET();
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "Not enough rights" });
    }
  });

  it("адміністратор не на проді — навмисна помилка сервера для onRequestError", async () => {
    state.sub = "u1";
    state.role = "admin";
    await expect(GET()).rejects.toThrow("Intentional server error: error tracker check");
  });
});
