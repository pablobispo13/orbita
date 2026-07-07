import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/auth";
import { withRoute } from "@/lib/http";
import { runScheduledRules } from "@/lib/notificationRules";

// Endpoint de CRON: avalia as regras de notificação AGENDADAS (INTERVAL/DAILY) e
// dispara as vencidas. Não é uma rota de usuário — é chamado pelo agendador do
// Vercel (ver vercel.json) ou por um cron externo, protegido por CRON_SECRET.
//
// O Vercel Cron envia `Authorization: Bearer $CRON_SECRET` quando a env existe;
// também aceitamos `?secret=` para testes/cron externos.
export const dynamic = "force-dynamic";

async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return jsonError("CRON_SECRET não configurado.", 503);

  const header = req.headers.get("authorization");
  const provided = header?.startsWith("Bearer ")
    ? header.slice(7)
    : req.nextUrl.searchParams.get("secret");
  if (provided !== secret) return jsonError("Não autorizado", 401);

  const result = await runScheduledRules(new Date());
  return NextResponse.json({ ok: true, ...result });
}

export const GET = withRoute(handle);
export const POST = withRoute(handle);
