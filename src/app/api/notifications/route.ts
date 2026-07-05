import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  requireEstablishment,
  requirePermission,
  jsonError,
  zodError,
} from "@/lib/auth";
import { withRoute } from "@/lib/http";
import { PERMISSIONS } from "@/lib/permissions";
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_STATUS,
  notify,
  establishmentMemberIds,
} from "@/lib/notifications";
import { sendPushToUsers } from "@/lib/push";

// Lista notificações. Com empresa ativa (header x-establishment-id): notificações
// da empresa (pedidos de senha só p/ member:manage) + as pessoais de plataforma.
// Sem empresa ativa (ex.: super admin no /dashboard): só as pessoais de plataforma.
export const GET = withRoute(async (req: NextRequest) => {
  const hasEstablishment = !!req.headers.get("x-establishment-id");

  if (!hasEstablishment) {
    const { user, response } = requireAuth(req);
    if (response) return response;
    const notifications = await prisma.notification.findMany({
      where: { establishmentId: null, targetUserId: user.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const unread = notifications.filter((n) => !n.read).length;
    return NextResponse.json({ notifications, unread });
  }

  const { ctx, response } = await requireEstablishment(req);
  if (response) return response;

  const canManageMembers = ctx.permissions.includes(PERMISSIONS.MEMBER_MANAGE);

  const where = {
    OR: [
      {
        establishmentId: ctx.establishmentId,
        ...(canManageMembers
          ? {}
          : { type: { not: NOTIFICATION_TYPES.PASSWORD_RESET_REQUEST } }),
      },
      { establishmentId: null, targetUserId: ctx.user.userId },
    ],
  };

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const unread = notifications.filter((n) => !n.read).length;
  return NextResponse.json({ notifications, unread });
});

const createSchema = z.object({
  title: z.string().min(2, "O título deve ter ao menos 2 caracteres"),
  message: z.string().min(1, "A mensagem não pode ficar vazia"),
});

// Cria um aviso genérico (member:manage). Módulos internos usam `notify()` direto.
export const POST = withRoute(async (req: NextRequest) => {
  const { ctx, response } = await requirePermission(req, PERMISSIONS.MEMBER_MANAGE);
  if (response) return response;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const notification = await notify({
    establishmentId: ctx.establishmentId,
    type: NOTIFICATION_TYPES.GENERIC,
    status: NOTIFICATION_STATUS.INFO,
    title: parsed.data.title,
    message: parsed.data.message,
  });

  // Envia por push a todos os membros da empresa (dispositivos assinados).
  const members = await establishmentMemberIds(ctx.establishmentId);
  await sendPushToUsers(members, {
    title: parsed.data.title,
    body: parsed.data.message,
    tag: `notif-${notification.id}`,
  });

  return NextResponse.json({ notification }, { status: 201 });
});
