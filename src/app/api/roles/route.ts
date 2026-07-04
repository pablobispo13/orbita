import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEstablishment, requirePermission, jsonError } from "@/lib/auth";
import { PERMISSIONS, ALL_PERMISSIONS } from "@/lib/permissions";

// Lista os cargos (roles) da empresa ativa.
// Basta gerenciar cargos OU membros — a lista alimenta a atribuição de cargo.
export async function GET(req: NextRequest) {
  const { ctx, response } = await requireEstablishment(req);
  if (response) return response;
  if (
    !ctx.permissions.includes(PERMISSIONS.ROLE_MANAGE) &&
    !ctx.permissions.includes(PERMISSIONS.MEMBER_MANAGE)
  ) {
    return jsonError("Permissão insuficiente", 403);
  }

  const roles = await prisma.role.findMany({
    where: { establishmentId: ctx.establishmentId },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ roles });
}

const createSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  permissions: z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])).default([]),
});

// Cria um cargo customizado — feito pelo ADMIN dono da empresa.
export async function POST(req: NextRequest) {
  const { ctx, response } = await requirePermission(req, PERMISSIONS.ROLE_MANAGE);
  if (response) return response;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos" }, { status: 400 });
  }

  const role = await prisma.role.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      permissions: parsed.data.permissions,
      establishmentId: ctx.establishmentId,
    },
  });

  return NextResponse.json({ role }, { status: 201 });
}
