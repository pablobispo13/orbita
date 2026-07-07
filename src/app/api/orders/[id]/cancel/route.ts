import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule, jsonError } from "@/lib/auth";
import { withRoute } from "@/lib/http";
import { PERMISSIONS } from "@/lib/permissions";
import { MODULES } from "@/lib/modules";
import { applyRecipeStock } from "@/lib/recipe";

type Ctx = { params: Promise<{ id: string }> };

// Cancela uma comanda aberta (não gera receita) e estorna o estoque consumido
// pelos itens lançados. Módulo Comanda + ORDER_WRITE.
export const POST = withRoute(async (req: NextRequest, { params }: Ctx) => {
  const { ctx, response } = await requireModule(req, MODULES.COMANDA, PERMISSIONS.ORDER_WRITE);
  if (response) return response;

  const { id } = await params;
  const order = await prisma.order.findFirst({
    where: { id, establishmentId: ctx.establishmentId },
    include: { items: true },
  });
  if (!order) return jsonError("Comanda não encontrada", 404);
  if (order.status !== "OPEN") return jsonError("A comanda não está aberta.", 409);

  // Estorna o consumo de estoque de cada item lançado (ficha técnica).
  if (ctx.modules.includes(MODULES.STOCK)) {
    for (const it of order.items) {
      await applyRecipeStock({
        establishmentId: ctx.establishmentId,
        productId: it.productId,
        units: it.quantity,
        direction: "IN",
        reason: `Estorno (cancelamento) · Comanda #${order.number} · ${it.name}`,
      });
    }
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { status: "CANCELLED", closedAt: new Date() },
  });
  return NextResponse.json({ order: updated });
});
