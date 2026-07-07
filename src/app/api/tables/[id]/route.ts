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
    name: z.string().min(1, "Informe o nome/número da mesa").optional(),
    seats: z.number().int().positive("Capacidade inválida").nullable().optional(),
    active: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nada para atualizar" });

// Edita uma mesa (módulo Comanda + ORDER_WRITE).
export const PATCH = withRoute(async (req: NextRequest, { params }: Ctx) => {
  const { ctx, response } = await requireModule(req, MODULES.COMANDA, PERMISSIONS.ORDER_WRITE);
  if (response) return response;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const current = await prisma.table.findFirst({
    where: { id, establishmentId: ctx.establishmentId },
  });
  if (!current) return jsonError("Mesa não encontrada", 404);

  const { seats, ...rest } = parsed.data;
  const table = await prisma.table.update({
    where: { id },
    data: { ...rest, ...(seats !== undefined ? { seats: seats ?? null } : {}) },
  });
  return NextResponse.json({ table });
});

// Exclui uma mesa. Bloqueia se houver comanda aberta nela (módulo Comanda + ORDER_WRITE).
export const DELETE = withRoute(async (req: NextRequest, { params }: Ctx) => {
  const { ctx, response } = await requireModule(req, MODULES.COMANDA, PERMISSIONS.ORDER_WRITE);
  if (response) return response;

  const { id } = await params;
  const current = await prisma.table.findFirst({
    where: { id, establishmentId: ctx.establishmentId },
  });
  if (!current) return jsonError("Mesa não encontrada", 404);

  const openOrder = await prisma.order.findFirst({
    where: { tableId: id, status: "OPEN" },
    select: { id: true },
  });
  if (openOrder) return jsonError("Há uma comanda aberta nesta mesa. Feche-a antes de excluir.", 409);

  // Desvincula comandas antigas (fechadas/canceladas) e exclui.
  await prisma.order.updateMany({ where: { tableId: id }, data: { tableId: null } });
  await prisma.table.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
