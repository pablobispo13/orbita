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
    name: z.string().min(1, "Informe o nome do produto").optional(),
    description: z.string().trim().nullable().optional(),
    cost: z.number().min(0, "Custo não pode ser negativo").optional(),
    marginPct: z.number().min(0, "Margem não pode ser negativa").optional(),
    price: z.number().min(0, "Preço não pode ser negativo").optional(),
    active: z.boolean().optional(),
    categoryId: z.string().min(1).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nada para atualizar" });

// Edita um produto (módulo Produtos + PRODUCT_WRITE). Escopo garantido por empresa.
export const PATCH = withRoute(async (req: NextRequest, { params }: Ctx) => {
  const { ctx, response } = await requireModule(
    req,
    MODULES.PRODUCTS,
    PERMISSIONS.PRODUCT_WRITE
  );
  if (response) return response;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const current = await prisma.product.findFirst({
    where: { id, establishmentId: ctx.establishmentId },
  });
  if (!current) return jsonError("Produto não encontrado", 404);

  const { description, categoryId, ...rest } = parsed.data;
  if (categoryId) {
    const cat = await prisma.category.findFirst({
      where: { id: categoryId, establishmentId: ctx.establishmentId },
      select: { id: true },
    });
    if (!cat) return jsonError("Categoria inválida", 400);
  }
  const product = await prisma.product.update({
    where: { id },
    data: {
      ...rest,
      ...(description !== undefined ? { description: description || null } : {}),
      ...(categoryId !== undefined ? { categoryId: categoryId ?? null } : {}),
    },
  });

  return NextResponse.json({ product });
});

// Exclui um produto (módulo Produtos + PRODUCT_WRITE).
export const DELETE = withRoute(async (req: NextRequest, { params }: Ctx) => {
  const { ctx, response } = await requireModule(
    req,
    MODULES.PRODUCTS,
    PERMISSIONS.PRODUCT_WRITE
  );
  if (response) return response;

  const { id } = await params;
  const current = await prisma.product.findFirst({
    where: { id, establishmentId: ctx.establishmentId },
  });
  if (!current) return jsonError("Produto não encontrado", 404);

  await prisma.recipeItem.deleteMany({ where: { productId: id } });
  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
