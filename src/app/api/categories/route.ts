import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEstablishment, jsonError, zodError } from "@/lib/auth";
import { withRoute } from "@/lib/http";
import { PERMISSIONS } from "@/lib/permissions";
import type { EstablishmentContext } from "@/lib/auth";
import { parsePagination, pageMeta } from "@/lib/pagination";

// Categorias são uma taxonomia compartilhada (produtos + lançamentos / centros de
// custo). Escrita liberada a quem gerencia produtos OU financeiro.
function canWriteCategories(ctx: EstablishmentContext): boolean {
  return (
    ctx.permissions.includes(PERMISSIONS.PRODUCT_WRITE) ||
    ctx.permissions.includes(PERMISSIONS.FINANCE_WRITE)
  );
}

// Lista categorias da empresa ativa (qualquer membro).
export const GET = withRoute(async (req: NextRequest) => {
  const { ctx, response } = await requireEstablishment(req);
  if (response) return response;

  const where = { establishmentId: ctx.establishmentId };
  const pg = parsePagination(req);
  const categories = await prisma.category.findMany({
    where,
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true, transactions: true } } },
    ...(pg ? { skip: pg.skip, take: pg.take } : {}),
  });
  if (pg) {
    const total = await prisma.category.count({ where });
    return NextResponse.json({ categories, pagination: pageMeta(pg, total) });
  }
  return NextResponse.json({ categories });
});

const createSchema = z.object({
  name: z.string().min(1, "Informe o nome da categoria"),
});

// Cria uma categoria (product:write ou finance:write).
export const POST = withRoute(async (req: NextRequest) => {
  const { ctx, response } = await requireEstablishment(req);
  if (response) return response;
  if (!canWriteCategories(ctx)) return jsonError("Permissão insuficiente", 403);

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const category = await prisma.category.create({
    data: { name: parsed.data.name.trim(), establishmentId: ctx.establishmentId },
  });
  return NextResponse.json({ category }, { status: 201 });
});
