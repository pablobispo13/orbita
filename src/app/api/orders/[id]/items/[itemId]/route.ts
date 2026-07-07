import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule, jsonError, zodError } from "@/lib/auth";
import { withRoute } from "@/lib/http";
import { PERMISSIONS } from "@/lib/permissions";
import { MODULES } from "@/lib/modules";
import { recomputeOrderTotal } from "@/lib/orders";
import { applyRecipeStock } from "@/lib/recipe";

type Ctx = { params: Promise<{ id: string; itemId: string }> };

const patchSchema = z.object({ prepared: z.boolean() });

// Marca/desmarca um item como preparado (cozinha/KDS). Módulo Comanda + ORDER_WRITE.
export const PATCH = withRoute(async (req: NextRequest, { params }: Ctx) => {
  const { ctx, response } = await requireModule(req, MODULES.COMANDA, PERMISSIONS.ORDER_WRITE);
  if (response) return response;

  const { id, itemId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const order = await prisma.order.findFirst({
    where: { id, establishmentId: ctx.establishmentId },
    select: { id: true },
  });
  if (!order) return jsonError("Comanda não encontrada", 404);

  const item = await prisma.orderItem.findFirst({ where: { id: itemId, orderId: id } });
  if (!item) return jsonError("Item não encontrado", 404);

  const updated = await prisma.orderItem.update({
    where: { id: itemId },
    data: { prepared: parsed.data.prepared },
  });
  return NextResponse.json({ item: updated });
});

// Remove um item da comanda e recalcula o total (módulo Comanda + ORDER_WRITE).
export const DELETE = withRoute(async (req: NextRequest, { params }: Ctx) => {
  const { ctx, response } = await requireModule(req, MODULES.COMANDA, PERMISSIONS.ORDER_WRITE);
  if (response) return response;

  const { id, itemId } = await params;
  const order = await prisma.order.findFirst({
    where: { id, establishmentId: ctx.establishmentId },
  });
  if (!order) return jsonError("Comanda não encontrada", 404);
  if (order.status !== "OPEN") return jsonError("A comanda não está aberta.", 409);

  const item = await prisma.orderItem.findFirst({ where: { id: itemId, orderId: id } });
  if (!item) return jsonError("Item não encontrado", 404);

  await prisma.orderItem.delete({ where: { id: itemId } });

  // Estorna o consumo de estoque do item removido (ficha técnica).
  if (ctx.modules.includes(MODULES.STOCK)) {
    await applyRecipeStock({
      establishmentId: ctx.establishmentId,
      productId: item.productId,
      units: item.quantity,
      direction: "IN",
      reason: `Estorno · Comanda #${order.number} · ${item.name}`,
    });
  }

  const total = await recomputeOrderTotal(id);
  const items = await prisma.orderItem.findMany({
    where: { orderId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ items, total });
});
