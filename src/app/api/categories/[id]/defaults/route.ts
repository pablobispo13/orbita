import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEstablishment, jsonError, zodError } from "@/lib/auth";
import { withRoute } from "@/lib/http";
import { PERMISSIONS } from "@/lib/permissions";
import type { EstablishmentContext } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

// Insumos PADRÃO de uma categoria (ex.: toda Pizza leva molho e massa).
// Ao criar um produto na categoria, a ficha técnica nasce com estes itens.
// Escrita liberada a quem edita produtos (a ficha é assunto de produto).
function canWrite(ctx: EstablishmentContext): boolean {
  return ctx.permissions.includes(PERMISSIONS.PRODUCT_WRITE);
}

async function categoryOf(ctx: EstablishmentContext, id: string) {
  return prisma.category.findFirst({
    where: { id, establishmentId: ctx.establishmentId },
    select: { id: true },
  });
}

// Lista os insumos padrão da categoria (qualquer membro).
export const GET = withRoute(async (req: NextRequest, { params }: Ctx) => {
  const { ctx, response } = await requireEstablishment(req);
  if (response) return response;

  const { id } = await params;
  if (!(await categoryOf(ctx, id))) return jsonError("Categoria não encontrada", 404);

  const items = await prisma.categoryDefaultItem.findMany({
    where: { categoryId: id, establishmentId: ctx.establishmentId },
    include: { stockItem: { select: { id: true, name: true, unit: true, costPrice: true } } },
    orderBy: { stockItem: { name: "asc" } },
  });
  return NextResponse.json({ items });
});

const createSchema = z.object({
  stockItemId: z.string().min(1, "Selecione o insumo"),
  quantity: z.number().positive("A quantidade deve ser maior que zero"),
});

// Adiciona/atualiza um insumo padrão (upsert por [categoria, insumo]).
export const POST = withRoute(async (req: NextRequest, { params }: Ctx) => {
  const { ctx, response } = await requireEstablishment(req);
  if (response) return response;
  if (!canWrite(ctx)) return jsonError("Permissão insuficiente", 403);

  const { id } = await params;
  if (!(await categoryOf(ctx, id))) return jsonError("Categoria não encontrada", 404);

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const stockItem = await prisma.stockItem.findFirst({
    where: { id: parsed.data.stockItemId, establishmentId: ctx.establishmentId },
    select: { id: true },
  });
  if (!stockItem) return jsonError("Insumo não encontrado", 404);

  await prisma.categoryDefaultItem.upsert({
    where: {
      categoryId_stockItemId: { categoryId: id, stockItemId: parsed.data.stockItemId },
    },
    create: {
      categoryId: id,
      stockItemId: parsed.data.stockItemId,
      quantity: parsed.data.quantity,
      establishmentId: ctx.establishmentId,
    },
    update: { quantity: parsed.data.quantity },
  });

  const items = await prisma.categoryDefaultItem.findMany({
    where: { categoryId: id, establishmentId: ctx.establishmentId },
    include: { stockItem: { select: { id: true, name: true, unit: true, costPrice: true } } },
    orderBy: { stockItem: { name: "asc" } },
  });
  return NextResponse.json({ items }, { status: 201 });
});
