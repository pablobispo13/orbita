import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEstablishment, requirePermission, jsonError, zodError } from "@/lib/auth";
import { withRoute } from "@/lib/http";
import { PERMISSIONS, ALL_PERMISSIONS } from "@/lib/permissions";
import { parsePagination, pageMeta } from "@/lib/pagination";

// Lista os cargos (roles) da empresa ativa. Paginação opt-in.
// Basta gerenciar cargos OU membros — a lista alimenta a atribuição de cargo.
export const GET = withRoute(async (req: NextRequest) => {
  const { ctx, response } = await requireEstablishment(req);
  if (response) return response;
  if (
    !ctx.permissions.includes(PERMISSIONS.ROLE_MANAGE) &&
    !ctx.permissions.includes(PERMISSIONS.MEMBER_MANAGE)
  ) {
    return jsonError("Permissão insuficiente", 403);
  }

  const where = { establishmentId: ctx.establishmentId };
  const pg = parsePagination(req);
  const roles = await prisma.role.findMany({
    where,
    orderBy: { name: "asc" },
    ...(pg ? { skip: pg.skip, take: pg.take } : {}),
  });
  if (pg) {
    const total = await prisma.role.count({ where });
    return NextResponse.json({ roles, pagination: pageMeta(pg, total) });
  }
  return NextResponse.json({ roles });
});

const createSchema = z.object({
  name: z.string().min(2, "O nome do cargo deve ter ao menos 2 caracteres"),
  description: z.string().optional(),
  permissions: z
    .array(z.enum(ALL_PERMISSIONS as [string, ...string[]]), {
      invalid_type_error: "Permissões inválidas",
    })
    .default([]),
});

// Cria um cargo customizado — feito pelo ADMIN dono da empresa.
export const POST = withRoute(async (req: NextRequest) => {
  const { ctx, response } = await requirePermission(req, PERMISSIONS.ROLE_MANAGE);
  if (response) return response;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  try {
    const role = await prisma.role.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        permissions: parsed.data.permissions,
        establishmentId: ctx.establishmentId,
      },
    });
    return NextResponse.json({ role }, { status: 201 });
  } catch {
    // Colisão com o @@unique([establishmentId, name]).
    return jsonError("Já existe um cargo com esse nome", 409);
  }
});
