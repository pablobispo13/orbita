import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule, jsonError, zodError } from "@/lib/auth";
import { withRoute } from "@/lib/http";
import { PERMISSIONS } from "@/lib/permissions";
import { MODULES } from "@/lib/modules";
import { isPeriodClosed, financeReferenceDate } from "@/lib/period";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z
  .object({
    type: z.enum(["INCOME", "EXPENSE"]).optional(),
    description: z.string().min(1, "Informe a descrição").optional(),
    amount: z.number().positive("O valor deve ser maior que zero").optional(),
    paidAt: z.string().datetime().nullable().optional(),
    dueAt: z.string().datetime().nullable().optional(),
    categoryId: z.string().min(1).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nada para atualizar" });

// Edita um lançamento (módulo Financeiro + FINANCE_WRITE).
export const PATCH = withRoute(async (req: NextRequest, { params }: Ctx) => {
  const { ctx, response } = await requireModule(req, MODULES.FINANCE, PERMISSIONS.FINANCE_WRITE);
  if (response) return response;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const current = await prisma.transaction.findFirst({
    where: { id, establishmentId: ctx.establishmentId },
  });
  if (!current) return jsonError("Lançamento não encontrado", 404);

  const { paidAt, dueAt, categoryId, ...rest } = parsed.data;

  // Bloqueia editar em período fechado — tanto a data atual quanto a nova.
  // Referência = paidAt ?? createdAt (mesma regra da agregação e do POST).
  const oldDate = financeReferenceDate(current.paidAt, current.createdAt);
  const newDate =
    paidAt !== undefined
      ? financeReferenceDate(paidAt, current.createdAt)
      : oldDate;
  for (const d of [oldDate, newDate]) {
    if (await isPeriodClosed(ctx.establishmentId, d)) {
      return jsonError("Período fechado: reabra o mês para editar este lançamento.", 409);
    }
  }
  if (categoryId) {
    const cat = await prisma.category.findFirst({
      where: { id: categoryId, establishmentId: ctx.establishmentId },
      select: { id: true },
    });
    if (!cat) return jsonError("Categoria inválida", 400);
  }

  const transaction = await prisma.transaction.update({
    where: { id },
    data: {
      ...rest,
      ...(paidAt !== undefined ? { paidAt: paidAt ? new Date(paidAt) : null } : {}),
      ...(dueAt !== undefined ? { dueAt: dueAt ? new Date(dueAt) : null } : {}),
      ...(categoryId !== undefined ? { categoryId: categoryId ?? null } : {}),
    },
  });

  return NextResponse.json({ transaction });
});

// Exclui um lançamento (módulo Financeiro + FINANCE_WRITE).
export const DELETE = withRoute(async (req: NextRequest, { params }: Ctx) => {
  const { ctx, response } = await requireModule(req, MODULES.FINANCE, PERMISSIONS.FINANCE_WRITE);
  if (response) return response;

  const { id } = await params;
  const current = await prisma.transaction.findFirst({
    where: { id, establishmentId: ctx.establishmentId },
  });
  if (!current) return jsonError("Lançamento não encontrado", 404);

  // Não permite excluir lançamento cuja data cai em período fechado (mudaria os
  // totais vivos do mês já apurado).
  const refDate = financeReferenceDate(current.paidAt, current.createdAt);
  if (await isPeriodClosed(ctx.establishmentId, refDate)) {
    return jsonError("Período fechado: reabra o mês para excluir este lançamento.", 409);
  }

  await prisma.transaction.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
