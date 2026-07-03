import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";

// Lista itens de estoque da empresa ativa (exige STOCK_READ).
export async function GET(req: NextRequest) {
  const { ctx, response } = await requirePermission(req, PERMISSIONS.STOCK_READ);
  if (response) return response;

  const items = await prisma.stockItem.findMany({
    where: { establishmentId: ctx.establishmentId },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ items });
}

const createSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  quantity: z.number().min(0).default(0),
  minLevel: z.number().min(0).default(0),
  costPrice: z.number().min(0).default(0),
});

// Cadastra um insumo no estoque (exige STOCK_WRITE).
export async function POST(req: NextRequest) {
  const { ctx, response } = await requirePermission(req, PERMISSIONS.STOCK_WRITE);
  if (response) return response;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dados inválidos" }, { status: 400 });
  }

  const item = await prisma.stockItem.create({
    data: { ...parsed.data, establishmentId: ctx.establishmentId },
  });

  return NextResponse.json({ item }, { status: 201 });
}
