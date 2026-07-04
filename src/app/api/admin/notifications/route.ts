import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, jsonError } from "@/lib/auth";
import { notify, NOTIFICATION_TYPES, NOTIFICATION_STATUS } from "@/lib/notifications";
import { sendPushToUser } from "@/lib/push";

const schema = z.object({
  userId: z.string(),
  title: z.string().min(2),
  message: z.string().min(1),
});

// SUPER_ADMIN dispara uma notificação de plataforma para qualquer usuário do
// sistema. Persiste in-app (aparece no sino do usuário) e envia por push.
export async function POST(req: NextRequest) {
  const { user, response } = requireAuth(req);
  if (response) return response;
  if (user.role !== "SUPER_ADMIN") return jsonError("Acesso restrito", 403);

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Dados inválidos", 400);

  const target = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true },
  });
  if (!target) return jsonError("Usuário não encontrado", 404);

  await notify({
    establishmentId: null, // notificação de plataforma
    type: NOTIFICATION_TYPES.GENERIC,
    status: NOTIFICATION_STATUS.INFO,
    title: parsed.data.title,
    message: parsed.data.message,
    targetUserId: target.id,
  });

  await sendPushToUser(target.id, {
    title: parsed.data.title,
    body: parsed.data.message,
    tag: `admin-${target.id}-${Date.now()}`,
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
