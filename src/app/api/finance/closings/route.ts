import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule, jsonError, zodError } from "@/lib/auth";
import { withRoute } from "@/lib/http";
import { PERMISSIONS } from "@/lib/permissions";
import { MODULES } from "@/lib/modules";
import { monthRange } from "@/lib/period";
import { parsePagination, pageMeta } from "@/lib/pagination";

// Lista os fechamentos de período da empresa (módulo Financeiro + FINANCE_READ).
// Paginação opt-in.
export const GET = withRoute(async (req: NextRequest) => {
  const { ctx, response } = await requireModule(req, MODULES.FINANCE, PERMISSIONS.FINANCE_READ);
  if (response) return response;

  const where = { establishmentId: ctx.establishmentId };
  const pg = parsePagination(req);
  const closings = await prisma.periodClosing.findMany({
    where,
    orderBy: [{ year: "desc" }, { month: "desc" }],
    ...(pg ? { skip: pg.skip, take: pg.take } : {}),
  });
  if (pg) {
    const total = await prisma.periodClosing.count({ where });
    return NextResponse.json({ closings, pagination: pageMeta(pg, total) });
  }
  return NextResponse.json({ closings });
});

const createSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  note: z.string().trim().optional(),
});

// Fecha um período (mês): apura os totais a partir dos lançamentos com `paidAt`
// no mês e grava um snapshot (módulo Financeiro + FINANCE_WRITE).
export const POST = withRoute(async (req: NextRequest) => {
  const { ctx, response } = await requireModule(req, MODULES.FINANCE, PERMISSIONS.FINANCE_WRITE);
  if (response) return response;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const { year, month, note } = parsed.data;

  const existing = await prisma.periodClosing.findUnique({
    where: { establishmentId_year_month: { establishmentId: ctx.establishmentId, year, month } },
  });
  if (existing) return jsonError("Este período já está fechado.", 409);

  const { start, end } = monthRange(year, month);
  // Referência = paidAt ?? createdAt (mesma regra da agregação e dos bloqueios):
  // lançamentos com paidAt no mês OU sem paidAt e criados no mês.
  const txs = await prisma.transaction.findMany({
    where: {
      establishmentId: ctx.establishmentId,
      OR: [
        { paidAt: { gte: start, lt: end } },
        { paidAt: null, createdAt: { gte: start, lt: end } },
      ],
    },
    select: { type: true, amount: true },
  });

  let totalIncome = 0;
  let totalExpense = 0;
  for (const t of txs) {
    if (t.type === "INCOME") totalIncome += t.amount;
    else totalExpense += t.amount;
  }
  const profit = Math.round((totalIncome - totalExpense) * 100) / 100;

  const closing = await prisma.periodClosing.create({
    data: {
      establishmentId: ctx.establishmentId,
      year,
      month,
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpense: Math.round(totalExpense * 100) / 100,
      profit,
      note: note || null,
    },
  });

  return NextResponse.json({ closing }, { status: 201 });
});
