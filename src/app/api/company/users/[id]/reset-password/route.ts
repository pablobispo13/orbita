import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { requirePermission, jsonError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";

// Reset de senha de um FUNCIONÁRIO pelo dono/gestor da empresa (member:manage).
// `id` é o userId do membro. Gera senha temporária, marca mustChangePassword=true
// e a retorna uma vez para repasse. Não se aplica ao Dono (ADMIN) da empresa.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, response } = await requirePermission(req, PERMISSIONS.MEMBER_MANAGE);
  if (response) return response;

  const { id } = await params;

  const membership = await prisma.membership.findUnique({
    where: {
      userId_establishmentId: { userId: id, establishmentId: ctx.establishmentId },
    },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!membership) return jsonError("Membro não encontrado", 404);
  if (membership.role === "ADMIN") {
    return jsonError("A senha do Dono não é redefinida por aqui", 409);
  }

  const generatedPassword = randomBytes(8).toString("base64url");
  const hashed = await bcrypt.hash(generatedPassword, 10);

  await prisma.user.update({
    where: { id: membership.user.id },
    data: { password: hashed, mustChangePassword: true },
  });

  return NextResponse.json({
    email: membership.user.email,
    generatedPassword,
  });
}
