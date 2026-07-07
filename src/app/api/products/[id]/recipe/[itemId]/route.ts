import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule, jsonError } from "@/lib/auth";
import { withRoute } from "@/lib/http";
import { PERMISSIONS } from "@/lib/permissions";
import { MODULES } from "@/lib/modules";

type Ctx = { params: Promise<{ id: string; itemId: string }> };

// Remove um insumo da ficha técnica (módulo Produtos + PRODUCT_WRITE).
export const DELETE = withRoute(async (req: NextRequest, { params }: Ctx) => {
  const { ctx, response } = await requireModule(req, MODULES.PRODUCTS, PERMISSIONS.PRODUCT_WRITE);
  if (response) return response;

  const { id, itemId } = await params;
  const item = await prisma.recipeItem.findFirst({
    where: { id: itemId, productId: id, establishmentId: ctx.establishmentId },
  });
  if (!item) return jsonError("Item da ficha não encontrado", 404);

  await prisma.recipeItem.delete({ where: { id: itemId } });
  return NextResponse.json({ ok: true });
});
