import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, jsonError } from "@/lib/auth";
import type { JwtPayload } from "@/lib/jwt";

// Autoriza operar numa notificação: dono do alvo, super admin, ou membro da
// empresa dona da notificação. Funciona no contexto empresa e no de plataforma.
async function canAccess(
  user: JwtPayload,
  n: { targetUserId: string | null; establishmentId: string | null }
): Promise<boolean> {
  if (user.role === "SUPER_ADMIN") return true;
  if (n.targetUserId && n.targetUserId === user.userId) return true;
  if (n.establishmentId) {
    const membership = await prisma.membership.findUnique({
      where: {
        userId_establishmentId: { userId: user.userId, establishmentId: n.establishmentId },
      },
      select: { id: true },
    });
    return !!membership;
  }
  return false;
}

const updateSchema = z.object({ read: z.boolean() });

// Marca uma notificação como lida/não-lida.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response } = requireAuth(req);
  if (response) return response;

  const { id } = await params;
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification || !(await canAccess(user, notification))) {
    return jsonError("Notificação não encontrada", 404);
  }

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return jsonError("Dados inválidos", 400);

  await prisma.notification.update({ where: { id }, data: { read: parsed.data.read } });
  return NextResponse.json({ ok: true });
}

// Remove uma notificação.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response } = requireAuth(req);
  if (response) return response;

  const { id } = await params;
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification || !(await canAccess(user, notification))) {
    return jsonError("Notificação não encontrada", 404);
  }

  await prisma.notification.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
