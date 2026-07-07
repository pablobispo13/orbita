import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule, jsonError, zodError } from "@/lib/auth";
import { withRoute } from "@/lib/http";
import { PERMISSIONS } from "@/lib/permissions";
import { MODULES } from "@/lib/modules";
import { recipeCost } from "@/lib/recipe";

type Ctx = { params: Promise<{ id: string }> };

// Ficha técnica de um produto (insumos consumidos por unidade) + custo derivado
// (módulo Produtos + PRODUCT_READ).
export const GET = withRoute(async (req: NextRequest, { params }: Ctx) => {
  const { ctx, response } = await requireModule(req, MODULES.PRODUCTS, PERMISSIONS.PRODUCT_READ);
  if (response) return response;

  const { id } = await params;
  const product = await prisma.product.findFirst({
    where: { id, establishmentId: ctx.establishmentId },
    select: { id: true },
  });
  if (!product) return jsonError("Produto não encontrado", 404);

  const items = await prisma.recipeItem.findMany({
    where: { productId: id, establishmentId: ctx.establishmentId },
    include: {
      stockItem: {
        select: { id: true, name: true, unit: true, costPrice: true, quantity: true },
      },
    },
    orderBy: { stockItem: { name: "asc" } },
  });
  const cost = await recipeCost(ctx.establishmentId, id);
  return NextResponse.json({ items, cost });
});

const createSchema = z.object({
  stockItemId: z.string().min(1, "Selecione o insumo"),
  quantity: z.number().positive("A quantidade deve ser maior que zero"),
});

// Adiciona/atualiza um insumo na ficha técnica (upsert por [produto, insumo]).
export const POST = withRoute(async (req: NextRequest, { params }: Ctx) => {
  const { ctx, response } = await requireModule(req, MODULES.PRODUCTS, PERMISSIONS.PRODUCT_WRITE);
  if (response) return response;

  const { id } = await params;
  const product = await prisma.product.findFirst({
    where: { id, establishmentId: ctx.establishmentId },
    select: { id: true },
  });
  if (!product) return jsonError("Produto não encontrado", 404);

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const stockItem = await prisma.stockItem.findFirst({
    where: { id: parsed.data.stockItemId, establishmentId: ctx.establishmentId },
    select: { id: true },
  });
  if (!stockItem) return jsonError("Insumo não encontrado", 404);

  await prisma.recipeItem.upsert({
    where: { productId_stockItemId: { productId: id, stockItemId: parsed.data.stockItemId } },
    create: {
      productId: id,
      stockItemId: parsed.data.stockItemId,
      quantity: parsed.data.quantity,
      establishmentId: ctx.establishmentId,
    },
    update: { quantity: parsed.data.quantity },
  });

  const items = await prisma.recipeItem.findMany({
    where: { productId: id, establishmentId: ctx.establishmentId },
    include: {
      stockItem: {
        select: { id: true, name: true, unit: true, costPrice: true, quantity: true },
      },
    },
    orderBy: { stockItem: { name: "asc" } },
  });
  const cost = await recipeCost(ctx.establishmentId, id);
  return NextResponse.json({ items, cost }, { status: 201 });
});
