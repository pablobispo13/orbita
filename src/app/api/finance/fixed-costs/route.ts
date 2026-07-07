import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule, zodError } from "@/lib/auth";
import { withRoute } from "@/lib/http";
import { PERMISSIONS } from "@/lib/permissions";
import { MODULES } from "@/lib/modules";

// Gastos FIXOS mensais (operacionais: forno, funcionário, aluguel do salão...).
// Módulo Financeiro. Usados na visão financeira e no rateio da simulação.

// Lista os gastos fixos + total mensal dos ativos (FINANCE_READ).
export const GET = withRoute(async (req: NextRequest) => {
  const { ctx, response } = await requireModule(req, MODULES.FINANCE, PERMISSIONS.FINANCE_READ);
  if (response) return response;

  const costs = await prisma.fixedCost.findMany({
    where: { establishmentId: ctx.establishmentId },
    orderBy: { name: "asc" },
  });
  const monthlyTotal =
    Math.round(costs.filter((c) => c.active).reduce((s, c) => s + c.amount, 0) * 100) / 100;
  return NextResponse.json({ costs, monthlyTotal });
});

const createSchema = z.object({
  name: z.string().min(1, "Informe o nome do gasto (ex.: Forno, Funcionário)"),
  amount: z.number().positive("O valor mensal deve ser maior que zero"),
  note: z.string().trim().optional(),
  active: z.boolean().default(true),
});

// Cadastra um gasto fixo (FINANCE_WRITE).
export const POST = withRoute(async (req: NextRequest) => {
  const { ctx, response } = await requireModule(req, MODULES.FINANCE, PERMISSIONS.FINANCE_WRITE);
  if (response) return response;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const cost = await prisma.fixedCost.create({
    data: {
      name: parsed.data.name.trim(),
      amount: parsed.data.amount,
      note: parsed.data.note || null,
      active: parsed.data.active,
      establishmentId: ctx.establishmentId,
    },
  });
  return NextResponse.json({ cost }, { status: 201 });
});
