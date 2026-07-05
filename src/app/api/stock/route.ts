import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, zodError } from "@/lib/auth";
import { withRoute } from "@/lib/http";
import { PERMISSIONS } from "@/lib/permissions";

// Lista itens de estoque da empresa ativa (exige STOCK_READ).
export const GET = withRoute(async (req: NextRequest) => {
  const { ctx, response } = await requirePermission(req, PERMISSIONS.STOCK_READ);
  if (response) return response;

  const items = await prisma.stockItem.findMany({
    where: { establishmentId: ctx.establishmentId },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ items });
});

const createSchema = z.object({
  name: z.string().min(1, "Informe o nome do insumo"),
  unit: z.string().min(1, "Informe a unidade (kg, un, L...)"),
  quantity: z.number().min(0, "Quantidade não pode ser negativa").default(0),
  minLevel: z.number().min(0, "Estoque mínimo não pode ser negativo").default(0),
  costPrice: z.number().min(0, "Custo não pode ser negativo").default(0),
});

// Cadastra um insumo no estoque (exige STOCK_WRITE).
export const POST = withRoute(async (req: NextRequest) => {
  const { ctx, response } = await requirePermission(req, PERMISSIONS.STOCK_WRITE);
  if (response) return response;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const item = await prisma.stockItem.create({
    data: { ...parsed.data, establishmentId: ctx.establishmentId },
  });

  return NextResponse.json({ item }, { status: 201 });
});
