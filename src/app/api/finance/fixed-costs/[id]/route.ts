import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule, jsonError, zodError } from "@/lib/auth";
import { withRoute } from "@/lib/http";
import { PERMISSIONS } from "@/lib/permissions";
import { MODULES } from "@/lib/modules";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z
  .object({
    name: z.string().min(1).optional(),
    amount: z.number().positive("O valor mensal deve ser maior que zero").optional(),
    note: z.string().trim().nullable().optional(),
    active: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nada para atualizar" });

// Edita um gasto fixo (FINANCE_WRITE).
export const PATCH = withRoute(async (req: NextRequest, { params }: Ctx) => {
  const { ctx, response } = await requireModule(req, MODULES.FINANCE, PERMISSIONS.FINANCE_WRITE);
  if (response) return response;

  const { id } = await params;
  const current = await prisma.fixedCost.findFirst({
    where: { id, establishmentId: ctx.establishmentId },
    select: { id: true },
  });
  if (!current) return jsonError("Gasto fixo não encontrado", 404);

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const cost = await prisma.fixedCost.update({
    where: { id },
    data: {
      ...(d.name !== undefined ? { name: d.name.trim() } : {}),
      ...(d.amount !== undefined ? { amount: d.amount } : {}),
      ...(d.note !== undefined ? { note: d.note || null } : {}),
      ...(d.active !== undefined ? { active: d.active } : {}),
    },
  });
  return NextResponse.json({ cost });
});

// Exclui um gasto fixo (FINANCE_WRITE).
export const DELETE = withRoute(async (req: NextRequest, { params }: Ctx) => {
  const { ctx, response } = await requireModule(req, MODULES.FINANCE, PERMISSIONS.FINANCE_WRITE);
  if (response) return response;

  const { id } = await params;
  const current = await prisma.fixedCost.findFirst({
    where: { id, establishmentId: ctx.establishmentId },
    select: { id: true },
  });
  if (!current) return jsonError("Gasto fixo não encontrado", 404);

  await prisma.fixedCost.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
