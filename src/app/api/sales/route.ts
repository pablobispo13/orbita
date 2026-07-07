import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule, jsonError, zodError } from "@/lib/auth";
import { withRoute } from "@/lib/http";
import { PERMISSIONS } from "@/lib/permissions";
import { MODULES } from "@/lib/modules";
import { isPeriodClosed } from "@/lib/period";
import { fireSaleEvent } from "@/lib/notificationRules";

const createSchema = z.object({
  productId: z.string().min(1, "Informe o produto"),
  quantity: z.number().int().positive("A quantidade deve ser maior que zero").default(1),
});

// Registra uma VENDA de um produto: gera um lançamento de receita no Financeiro
// (prévia da Comanda — Fase 5; ainda não consome estoque). Módulo Financeiro +
// FINANCE_WRITE. A receita herda a categoria do produto (agrupa na DRE).
export const POST = withRoute(async (req: NextRequest) => {
  const { ctx, response } = await requireModule(req, MODULES.FINANCE, PERMISSIONS.FINANCE_WRITE);
  if (response) return response;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const { productId, quantity } = parsed.data;

  const product = await prisma.product.findFirst({
    where: { id: productId, establishmentId: ctx.establishmentId },
  });
  if (!product) return jsonError("Produto não encontrado", 404);

  const now = new Date();
  if (await isPeriodClosed(ctx.establishmentId, now)) {
    return jsonError("Período fechado: reabra o mês para registrar vendas nesta data.", 409);
  }

  const amount = Math.round(product.price * quantity * 100) / 100;
  const transaction = await prisma.transaction.create({
    data: {
      type: "INCOME",
      description: `Venda: ${product.name}${quantity > 1 ? ` (x${quantity})` : ""}`,
      amount,
      paidAt: now,
      categoryId: product.categoryId,
      establishmentId: ctx.establishmentId,
    },
  });

  // Regras de notificação "a cada nova venda" (best-effort, não bloqueia a resposta).
  void fireSaleEvent(ctx.establishmentId, {
    amount,
    label: `${product.name}${quantity > 1 ? ` (x${quantity})` : ""}`,
  }).catch(() => {});

  return NextResponse.json({ transaction }, { status: 201 });
});
