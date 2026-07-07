import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule, zodError } from "@/lib/auth";
import { withRoute } from "@/lib/http";
import { PERMISSIONS } from "@/lib/permissions";
import { MODULES } from "@/lib/modules";
import { parsePagination, pageMeta } from "@/lib/pagination";

// Lista itens de estoque da empresa ativa (módulo Estoque + STOCK_READ).
// Paginação opt-in via `?page=&pageSize=` (sem eles, devolve a lista inteira).
export const GET = withRoute(async (req: NextRequest) => {
  const { ctx, response } = await requireModule(req, MODULES.STOCK, PERMISSIONS.STOCK_READ);
  if (response) return response;

  const where = { establishmentId: ctx.establishmentId };
  const pg = parsePagination(req);
  const items = await prisma.stockItem.findMany({
    where,
    orderBy: { name: "asc" },
    ...(pg ? { skip: pg.skip, take: pg.take } : {}),
  });
  if (pg) {
    const total = await prisma.stockItem.count({ where });
    return NextResponse.json({ items, pagination: pageMeta(pg, total) });
  }
  return NextResponse.json({ items });
});

const createSchema = z.object({
  name: z.string().min(1, "Informe o nome do insumo"),
  unit: z.string().min(1, "Informe a unidade (kg, un, L...)"),
  quantity: z.number().min(0, "Quantidade não pode ser negativa").default(0),
  minLevel: z.number().min(0, "Estoque mínimo não pode ser negativo").default(0),
  costPrice: z.number().min(0, "Custo não pode ser negativo").default(0),
});

// Cadastra um insumo no estoque (módulo Estoque + STOCK_WRITE).
export const POST = withRoute(async (req: NextRequest) => {
  const { ctx, response } = await requireModule(req, MODULES.STOCK, PERMISSIONS.STOCK_WRITE);
  if (response) return response;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const item = await prisma.stockItem.create({
    data: { ...parsed.data, establishmentId: ctx.establishmentId },
  });

  return NextResponse.json({ item }, { status: 201 });
});
