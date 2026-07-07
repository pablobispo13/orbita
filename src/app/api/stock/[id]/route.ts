import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule, jsonError, zodError } from "@/lib/auth";
import { withRoute } from "@/lib/http";
import { PERMISSIONS } from "@/lib/permissions";
import { MODULES } from "@/lib/modules";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z
  .object({
    name: z.string().min(1, "Informe o nome do insumo").optional(),
    unit: z.string().min(1, "Informe a unidade").optional(),
    minLevel: z.number().min(0, "Estoque mínimo não pode ser negativo").optional(),
    costPrice: z.number().min(0, "Custo não pode ser negativo").optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nada para atualizar" });

// Edita dados de um insumo (módulo Estoque + STOCK_WRITE). A quantidade NÃO é
// editada aqui — ela muda por movimentação (ver ./movements).
export const PATCH = withRoute(async (req: NextRequest, { params }: Ctx) => {
  const { ctx, response } = await requireModule(req, MODULES.STOCK, PERMISSIONS.STOCK_WRITE);
  if (response) return response;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const current = await prisma.stockItem.findFirst({
    where: { id, establishmentId: ctx.establishmentId },
  });
  if (!current) return jsonError("Insumo não encontrado", 404);

  const item = await prisma.stockItem.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ item });
});

// Exclui um insumo e suas movimentações (módulo Estoque + STOCK_WRITE).
export const DELETE = withRoute(async (req: NextRequest, { params }: Ctx) => {
  const { ctx, response } = await requireModule(req, MODULES.STOCK, PERMISSIONS.STOCK_WRITE);
  if (response) return response;

  const { id } = await params;
  const current = await prisma.stockItem.findFirst({
    where: { id, establishmentId: ctx.establishmentId },
  });
  if (!current) return jsonError("Insumo não encontrado", 404);

  await prisma.recipeItem.deleteMany({ where: { stockItemId: id } });
  await prisma.stockMovement.deleteMany({ where: { stockItemId: id } });
  await prisma.stockItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
