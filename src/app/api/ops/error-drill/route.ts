// WS11 (B): тестовий маршрут для перевірки трекера помилок (src/instrumentation.ts → onRequestError → Telegram).
// Навмисно кидає помилку сервера, але лише: (1) не на проді — на проді завжди 404; (2) з входом — інакше 401
// (proxy і так веде на /login); (3) для адміністратора — роль з public.profiles, не з user_metadata (ADR 0002).
// Текст помилки — без даних користувача: у Telegram однаково йдуть лише назва, digest і рядки «at …» стеку.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ERROR_DRILL_MESSAGE = "Intentional server error: error tracker check";

export async function GET() {
  if (process.env.VERCEL_ENV === "production") return new NextResponse(null, { status: 404 });
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!sub) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", sub).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Not enough rights" }, { status: 403 });
  throw new Error(ERROR_DRILL_MESSAGE);
}
