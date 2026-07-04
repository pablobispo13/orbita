import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { requirePermission, jsonError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { NOTIFICATION_TYPES, NOTIFICATION_STATUS } from "@/lib/notifications";

// Processa um pedido de recuperação de senha (member:manage): gera senha temporária
// para o funcionário, marca a notificação como RESOLVIDA e retorna a senha uma vez.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, response } = await requirePermission(req, PERMISSIONS.MEMBER_MANAGE);
  if (response) return response;

  const { id } = await params;
  const notification = await prisma.notification.findUnique({
    where: { id },
    include: { targetUser: { select: { id: true, name: true, email: true } } },
  });

  if (!notification || notification.establishmentId !== ctx.establishmentId) {
    return jsonError("Notificação não encontrada", 404);
  }
  if (notification.type !== NOTIFICATION_TYPES.PASSWORD_RESET_REQUEST || !notification.targetUser) {
    return jsonError("Notificação não é um pedido de senha", 400);
  }

  const generatedPassword = randomBytes(8).toString("base64url");
  const hashed = await bcrypt.hash(generatedPassword, 10);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: notification.targetUser.id },
      data: { password: hashed, mustChangePassword: true },
    }),
    prisma.notification.update({
      where: { id },
      data: { status: NOTIFICATION_STATUS.RESOLVED, read: true },
    }),
  ]);

  return NextResponse.json({
    name: notification.targetUser.name,
    email: notification.targetUser.email,
    generatedPassword,
  });
}
