import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule, jsonError, zodError } from "@/lib/auth";
import { withRoute } from "@/lib/http";
import { PERMISSIONS } from "@/lib/permissions";
import { MODULES } from "@/lib/modules";
import { parsePagination, pageMeta } from "@/lib/pagination";
import { recipeCost } from "@/lib/recipe";

// Lista produtos da empresa ativa (módulo Produtos + PRODUCT_READ).
// Paginação opt-in via `?page=&pageSize=` (sem eles, devolve a lista inteira).
export const GET = withRoute(async (req: NextRequest) => {
  const { ctx, response } = await requireModule(
    req,
    MODULES.PRODUCTS,
    PERMISSIONS.PRODUCT_READ
  );
  if (response) return response;

  const where = { establishmentId: ctx.establishmentId };
  const pg = parsePagination(req);
  const products = await prisma.product.findMany({
    where,
    orderBy: { name: "asc" },
    include: { category: { select: { id: true, name: true } } },
    ...(pg ? { skip: pg.skip, take: pg.take } : {}),
  });
  if (pg) {
    const total = await prisma.product.count({ where });
    return NextResponse.json({ products, pagination: pageMeta(pg, total) });
  }
  return NextResponse.json({ products });
});

const createSchema = z.object({
  name: z.string().min(1, "Informe o nome do produto"),
  description: z.string().trim().optional(),
  cost: z.number().min(0, "Custo não pode ser negativo").default(0),
  marginPct: z.number().min(0, "Margem não pode ser negativa").default(25),
  price: z.number().min(0, "Preço não pode ser negativo"),
  active: z.boolean().default(true),
  categoryId: z.string().min(1).nullable().optional(),
});

// Cadastra um produto (módulo Produtos + PRODUCT_WRITE).
export const POST = withRoute(async (req: NextRequest) => {
  const { ctx, response } = await requireModule(
    req,
    MODULES.PRODUCTS,
    PERMISSIONS.PRODUCT_WRITE
  );
  if (response) return response;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const { description, categoryId, ...rest } = parsed.data;
  if (categoryId) {
    const cat = await prisma.category.findFirst({
      where: { id: categoryId, establishmentId: ctx.establishmentId },
      select: { id: true },
    });
    if (!cat) return jsonError("Categoria inválida", 400);
  }
  let product = await prisma.product.create({
    data: {
      ...rest,
      description: description || null,
      categoryId: categoryId ?? null,
      establishmentId: ctx.establishmentId,
    },
  });

  // Insumos padrão da categoria → ficha técnica inicial do produto (ex.: toda
  // Pizza nasce com molho e massa). Se o custo não foi informado (0), assume o
  // custo derivado da ficha.
  if (categoryId) {
    const defaults = await prisma.categoryDefaultItem.findMany({
      where: { categoryId, establishmentId: ctx.establishmentId },
      select: { stockItemId: true, quantity: true },
    });
    if (defaults.length > 0) {
      await prisma.recipeItem.createMany({
        data: defaults.map((d) => ({
          productId: product.id,
          stockItemId: d.stockItemId,
          quantity: d.quantity,
          establishmentId: ctx.establishmentId,
        })),
      });
      if ((rest.cost ?? 0) <= 0) {
        const derived = await recipeCost(ctx.establishmentId, product.id);
        if (derived > 0) {
          product = await prisma.product.update({
            where: { id: product.id },
            data: { cost: derived },
          });
        }
      }
    }
  }

  return NextResponse.json({ product }, { status: 201 });
});
