import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEstablishment, jsonError, zodError } from "@/lib/auth";
import { withRoute } from "@/lib/http";
import { PERMISSIONS } from "@/lib/permissions";
import type { EstablishmentContext } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

function canWriteCategories(ctx: EstablishmentContext): boolean {
  return (
    ctx.permissions.includes(PERMISSIONS.PRODUCT_WRITE) ||
    ctx.permissions.includes(PERMISSIONS.FINANCE_WRITE)
  );
}

const updateSchema = z.object({
  name: z.string().min(1, "Informe o nome da categoria"),
});

// Renomeia uma categoria.
export const PATCH = withRoute(async (req: NextRequest, { params }: Ctx) => {
  const { ctx, response } = await requireEstablishment(req);
  if (response) return response;
  if (!canWriteCategories(ctx)) return jsonError("Permissão insuficiente", 403);

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const current = await prisma.category.findFirst({
    where: { id, establishmentId: ctx.establishmentId },
  });
  if (!current) return jsonError("Categoria não encontrada", 404);

  const category = await prisma.category.update({
    where: { id },
    data: { name: parsed.data.name.trim() },
  });
  return NextResponse.json({ category });
});

// Exclui uma categoria, desvinculando produtos e lançamentos (categoryId => null).
export const DELETE = withRoute(async (req: NextRequest, { params }: Ctx) => {
  const { ctx, response } = await requireEstablishment(req);
  if (response) return response;
  if (!canWriteCategories(ctx)) return jsonError("Permissão insuficiente", 403);

  const { id } = await params;
  const current = await prisma.category.findFirst({
    where: { id, establishmentId: ctx.establishmentId },
  });
  if (!current) return jsonError("Categoria não encontrada", 404);

  await prisma.product.updateMany({ where: { categoryId: id }, data: { categoryId: null } });
  await prisma.transaction.updateMany({ where: { categoryId: id }, data: { categoryId: null } });
  await prisma.category.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
