import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, jsonError } from "@/lib/auth";

const schema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});

// Registra uma assinatura Web Push do dispositivo atual para o usuário logado.
export async function POST(req: NextRequest) {
  const { user, response } = requireAuth(req);
  if (response) return response;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Assinatura inválida", 400);

  const { endpoint, keys } = parsed.data;

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: user.userId, p256dh: keys.p256dh, auth: keys.auth },
    create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userId: user.userId },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

// Remove a assinatura do dispositivo (ao desativar as notificações).
export async function DELETE(req: NextRequest) {
  const { response } = requireAuth(req);
  if (response) return response;

  const body = await req.json().catch(() => null);
  const endpoint = body?.endpoint;
  if (typeof endpoint !== "string") return jsonError("endpoint obrigatório", 400);

  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  return NextResponse.json({ ok: true });
}
