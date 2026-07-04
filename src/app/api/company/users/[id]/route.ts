import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, jsonError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";

// `id` aqui é o userId do membro dentro da empresa ativa.
async function findMembership(userId: string, establishmentId: string) {
  return prisma.membership.findUnique({
    where: { userId_establishmentId: { userId, establishmentId } },
  });
}

const updateSchema = z.object({
  // Reatribui (ou remove, com null) o cargo do membro.
  customRoleId: z.string().nullable(),
});

// Atualiza o cargo de um membro da empresa ativa. Exige MEMBER_MANAGE.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, response } = await requirePermission(req, PERMISSIONS.MEMBER_MANAGE);
  if (response) return response;

  const { id } = await params;
  const membership = await findMembership(id, ctx.establishmentId);
  if (!membership) return jsonError("Membro não encontrado", 404);

  // O Dono (ADMIN) tem todas as permissões de forma implícita — cargo não se aplica.
  if (membership.role === "ADMIN") {
    return jsonError("O Dono da empresa não recebe cargo", 409);
  }

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return jsonError("Dados inválidos", 400);

  const { customRoleId } = parsed.data;
  if (customRoleId) {
    const role = await prisma.role.findUnique({ where: { id: customRoleId } });
    if (!role || role.establishmentId !== ctx.establishmentId) {
      return jsonError("Cargo inválido para esta empresa", 400);
    }
  }

  await prisma.membership.update({
    where: { id: membership.id },
    data: { customRoleId },
  });

  return NextResponse.json({ ok: true });
}

// Remove um membro da empresa ativa (desvincula). Exige MEMBER_MANAGE.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, response } = await requirePermission(req, PERMISSIONS.MEMBER_MANAGE);
  if (response) return response;

  const { id } = await params;
  const membership = await findMembership(id, ctx.establishmentId);
  if (!membership) return jsonError("Membro não encontrado", 404);

  // Não permite remover o Dono da empresa.
  if (membership.role === "ADMIN") {
    return jsonError("O Dono da empresa não pode ser removido", 409);
  }

  await prisma.membership.delete({ where: { id: membership.id } });
  return NextResponse.json({ ok: true });
}
