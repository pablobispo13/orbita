import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEstablishment, jsonError } from "@/lib/auth";
import { withRoute } from "@/lib/http";
import { PERMISSIONS } from "@/lib/permissions";

type Ctx = { params: Promise<{ id: string; itemId: string }> };

// Remove um insumo padrão da categoria (PRODUCT_WRITE).
export const DELETE = withRoute(async (req: NextRequest, { params }: Ctx) => {
  const { ctx, response } = await requireEstablishment(req);
  if (response) return response;
  if (!ctx.permissions.includes(PERMISSIONS.PRODUCT_WRITE)) {
    return jsonError("Permissão insuficiente", 403);
  }

  const { id, itemId } = await params;
  const item = await prisma.categoryDefaultItem.findFirst({
    where: { id: itemId, categoryId: id, establishmentId: ctx.establishmentId },
    select: { id: true },
  });
  if (!item) return jsonError("Insumo padrão não encontrado", 404);

  await prisma.categoryDefaultItem.delete({ where: { id: itemId } });
  return NextResponse.json({ ok: true });
});
