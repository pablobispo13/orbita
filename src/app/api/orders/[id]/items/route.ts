import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule, jsonError, zodError } from "@/lib/auth";
import { withRoute } from "@/lib/http";
import { PERMISSIONS } from "@/lib/permissions";
import { MODULES } from "@/lib/modules";
import { recomputeOrderTotal } from "@/lib/orders";
import { applyRecipeStock } from "@/lib/recipe";

type Ctx = { params: Promise<{ id: string }> };

const createSchema = z.object({
  productId: z.string().min(1, "Selecione o produto"),
  quantity: z.number().int().positive("Quantidade inválida").default(1),
  note: z.string().trim().optional(),
});

// Lança um item na comanda a partir do catálogo (snapshot de nome/preço) e
// recalcula o total (módulo Comanda + ORDER_WRITE). A comanda precisa estar aberta.
export const POST = withRoute(async (req: NextRequest, { params }: Ctx) => {
  const { ctx, response } = await requireModule(req, MODULES.COMANDA, PERMISSIONS.ORDER_WRITE);
  if (response) return response;

  const { id } = await params;
  const order = await prisma.order.findFirst({
    where: { id, establishmentId: ctx.establishmentId },
  });
  if (!order) return jsonError("Comanda não encontrada", 404);
  if (order.status !== "OPEN") return jsonError("A comanda não está aberta.", 409);

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const product = await prisma.product.findFirst({
    where: { id: parsed.data.productId, establishmentId: ctx.establishmentId },
  });
  if (!product) return jsonError("Produto não encontrado", 404);

  await prisma.orderItem.create({
    data: {
      name: product.name,
      unitPrice: product.price,
      quantity: parsed.data.quantity,
      note: parsed.data.note || null,
      orderId: id,
      productId: product.id,
    },
  });

  // Baixa automática de estoque pela ficha técnica (se o módulo Estoque estiver on).
  if (ctx.modules.includes(MODULES.STOCK)) {
    await applyRecipeStock({
      establishmentId: ctx.establishmentId,
      productId: product.id,
      units: parsed.data.quantity,
      direction: "OUT",
      reason: `Consumo · Comanda #${order.number} · ${product.name}`,
    });
  }

  const total = await recomputeOrderTotal(id);
  const items = await prisma.orderItem.findMany({
    where: { orderId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ items, total }, { status: 201 });
});
