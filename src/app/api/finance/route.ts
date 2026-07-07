import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule, jsonError, zodError } from "@/lib/auth";
import { withRoute } from "@/lib/http";
import { PERMISSIONS } from "@/lib/permissions";
import { MODULES } from "@/lib/modules";
import { isPeriodClosed, financeReferenceDate } from "@/lib/period";
import { parsePagination, pageMeta } from "@/lib/pagination";

// Lista lançamentos financeiros da empresa ativa (módulo Financeiro + FINANCE_READ).
// Paginação opt-in via `?page=&pageSize=`. ATENÇÃO: a UI atual agrega os totais no
// cliente sobre a lista inteira — para isso, NÃO envie os parâmetros de página
// (devolve tudo). Use paginação em telas de histórico que não dependam da soma.
export const GET = withRoute(async (req: NextRequest) => {
  const { ctx, response } = await requireModule(
    req,
    MODULES.FINANCE,
    PERMISSIONS.FINANCE_READ
  );
  if (response) return response;

  const where = { establishmentId: ctx.establishmentId };
  const pg = parsePagination(req);
  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { category: { select: { id: true, name: true } } },
    ...(pg ? { skip: pg.skip, take: pg.take } : {}),
  });
  if (pg) {
    const total = await prisma.transaction.count({ where });
    return NextResponse.json({ transactions, pagination: pageMeta(pg, total) });
  }
  return NextResponse.json({ transactions });
});

const createSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"], {
    errorMap: () => ({ message: "Tipo deve ser receita ou despesa" }),
  }),
  description: z.string().min(1, "Informe a descrição do lançamento"),
  amount: z.number().positive("O valor deve ser maior que zero"),
  // Datas opcionais (ISO). `paidAt` marca pago; `dueAt` é o vencimento.
  paidAt: z.string().datetime().optional(),
  dueAt: z.string().datetime().optional(),
  // Centro de custo / categoria (opcional).
  categoryId: z.string().min(1).nullable().optional(),
});

// Registra um lançamento (módulo Financeiro + FINANCE_WRITE).
export const POST = withRoute(async (req: NextRequest) => {
  const { ctx, response } = await requireModule(
    req,
    MODULES.FINANCE,
    PERMISSIONS.FINANCE_WRITE
  );
  if (response) return response;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const { paidAt, dueAt, categoryId, ...rest } = parsed.data;

  // Bloqueia lançamento em período fechado. A data de referência é `paidAt` com
  // fallback na data de criação (agora) — mesma regra da agregação, para um
  // lançamento sem `paidAt` não escapar do bloqueio.
  const refDate = financeReferenceDate(paidAt, new Date());
  if (await isPeriodClosed(ctx.establishmentId, refDate)) {
    return jsonError("Período fechado: reabra o mês para lançar nesta data.", 409);
  }
  if (categoryId && !(await categoryBelongs(ctx.establishmentId, categoryId))) {
    return jsonError("Categoria inválida", 400);
  }

  const transaction = await prisma.transaction.create({
    data: {
      ...rest,
      paidAt: paidAt ? new Date(paidAt) : null,
      dueAt: dueAt ? new Date(dueAt) : null,
      categoryId: categoryId ?? null,
      establishmentId: ctx.establishmentId,
    },
  });

  return NextResponse.json({ transaction }, { status: 201 });
});

// Confere se a categoria pertence à empresa (evita vincular categoria de outra).
async function categoryBelongs(establishmentId: string, categoryId: string): Promise<boolean> {
  const cat = await prisma.category.findFirst({
    where: { id: categoryId, establishmentId },
    select: { id: true },
  });
  return !!cat;
}
