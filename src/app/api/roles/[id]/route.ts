import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, jsonError } from "@/lib/auth";
import { PERMISSIONS, ALL_PERMISSIONS } from "@/lib/permissions";

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().nullable().optional(),
  permissions: z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])).optional(),
});

/// Garante que o cargo existe e pertence à empresa ativa.
async function findScopedRole(id: string, establishmentId: string) {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role || role.establishmentId !== establishmentId) return null;
  return role;
}

// Atualiza um cargo (nome, descrição, permissões) da empresa ativa.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, response } = await requirePermission(req, PERMISSIONS.ROLE_MANAGE);
  if (response) return response;

  const { id } = await params;
  const role = await findScopedRole(id, ctx.establishmentId);
  if (!role) return jsonError("Cargo não encontrado", 404);

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return jsonError("Dados inválidos", 400);

  try {
    const updated = await prisma.role.update({
      where: { id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        permissions: parsed.data.permissions,
      },
    });
    return NextResponse.json({ role: updated });
  } catch {
    // Colisão com o @@unique([establishmentId, name]).
    return jsonError("Já existe um cargo com esse nome", 409);
  }
}

// Remove um cargo da empresa ativa. Bloqueia se houver funcionários vinculados.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, response } = await requirePermission(req, PERMISSIONS.ROLE_MANAGE);
  if (response) return response;

  const { id } = await params;
  const role = await findScopedRole(id, ctx.establishmentId);
  if (!role) return jsonError("Cargo não encontrado", 404);

  const inUse = await prisma.membership.count({ where: { customRoleId: id } });
  if (inUse > 0) {
    return jsonError(
      `Cargo em uso por ${inUse} funcionário(s). Reatribua-os antes de excluir.`,
      409
    );
  }

  await prisma.role.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
