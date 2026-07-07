import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule, jsonError, zodError } from "@/lib/auth";
import { withRoute } from "@/lib/http";
import { PERMISSIONS } from "@/lib/permissions";
import { MODULES } from "@/lib/modules";
import { notify, NOTIFICATION_TYPES } from "@/lib/notifications";
import { parsePagination, pageMeta } from "@/lib/pagination";
import { resolveSettings } from "@/lib/settings";
import { isPeriodClosed } from "@/lib/period";

type Ctx = { params: Promise<{ id: string }> };

// Histórico de movimentações de um insumo (módulo Estoque + STOCK_READ).
// Paginação opt-in via `?page=&pageSize=` (sem eles mantém o teto legado de 100).
export const GET = withRoute(async (req: NextRequest, { params }: Ctx) => {
  const { ctx, response } = await requireModule(req, MODULES.STOCK, PERMISSIONS.STOCK_READ);
  if (response) return response;

  const { id } = await params;
  const item = await prisma.stockItem.findFirst({
    where: { id, establishmentId: ctx.establishmentId },
  });
  if (!item) return jsonError("Insumo não encontrado", 404);

  const where = { stockItemId: id };
  const pg = parsePagination(req);
  const movements = await prisma.stockMovement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: pg?.skip,
    take: pg ? pg.take : 100,
  });
  if (pg) {
    const total = await prisma.stockMovement.count({ where });
    return NextResponse.json({ movements, pagination: pageMeta(pg, total) });
  }
  return NextResponse.json({ movements });
});

const createSchema = z.object({
  type: z.enum(["IN", "OUT"], {
    errorMap: () => ({ message: "Tipo deve ser entrada (IN) ou saída (OUT)" }),
  }),
  quantity: z.number().positive("A quantidade deve ser maior que zero"),
  note: z.string().trim().optional(),
});

// Registra uma movimentação (entrada/saída) e atualiza a quantidade do insumo
// de forma consistente (módulo Estoque + STOCK_WRITE). Dispara alerta de estoque
// baixo (notificação da empresa) quando a saída cruza o nível mínimo.
export const POST = withRoute(async (req: NextRequest, { params }: Ctx) => {
  const { ctx, response } = await requireModule(req, MODULES.STOCK, PERMISSIONS.STOCK_WRITE);
  if (response) return response;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const item = await prisma.stockItem.findFirst({
    where: { id, establishmentId: ctx.establishmentId },
  });
  if (!item) return jsonError("Insumo não encontrado", 404);

  const qty = parsed.data.quantity;
  const isOut = parsed.data.type === "OUT";

  // Atualização ATÔMICA da quantidade — evita "lost update" quando duas
  // movimentações do mesmo insumo chegam simultaneamente (o read-modify-write
  // anterior gravava um valor absoluto e perdia uma das baixas).
  let updated;
  if (isOut) {
    // Saída: só decrementa se houver saldo suficiente. A condição vive no
    // próprio UPDATE (atômica); count === 0 => sem estoque, nenhuma baixa.
    const res = await prisma.stockItem.updateMany({
      where: { id, establishmentId: ctx.establishmentId, quantity: { gte: qty } },
      data: { quantity: { decrement: qty } },
    });
    if (res.count === 0) {
      return jsonError(
        `Saída maior que o estoque disponível (${item.quantity} ${item.unit}).`,
        400
      );
    }
    updated = await prisma.stockItem.findUniqueOrThrow({ where: { id } });
  } else {
    updated = await prisma.stockItem.update({
      where: { id },
      data: { quantity: { increment: qty } },
    });
  }

  const movement = await prisma.stockMovement.create({
    data: {
      type: parsed.data.type,
      quantity: qty,
      note: parsed.data.note || null,
      stockItemId: id,
      establishmentId: ctx.establishmentId,
    },
  });

  // Alerta: cruzou para o nível mínimo agora (evita notificar repetidamente).
  // "before" derivado do resultado atômico, não da leitura inicial (que pode
  // estar desatualizada sob concorrência).
  const before = updated.quantity + (isOut ? qty : -qty);
  const crossedLow = before > updated.minLevel && updated.quantity <= updated.minLevel;
  if (crossedLow) {
    await notify({
      establishmentId: ctx.establishmentId,
      type: NOTIFICATION_TYPES.GENERIC,
      title: "Estoque baixo",
      message: `${updated.name} chegou a ${updated.quantity} ${updated.unit} (mínimo: ${updated.minLevel}).`,
    });
  }

  // Integração com o Financeiro (opt-in por empresa): entrada de estoque gera
  // uma DESPESA de compra (quantidade × custo do insumo), quando a configuração
  // `operations.stockEntryCreatesExpense` está ligada e o módulo Financeiro
  // ativo. Período fechado ou custo zerado => não lança (a entrada não é bloqueada).
  let expense = null;
  if (!isOut && ctx.modules.includes(MODULES.FINANCE)) {
    const est = await prisma.establishment.findUnique({
      where: { id: ctx.establishmentId },
      select: { settings: true },
    });
    const settings = resolveSettings(est?.settings);
    const amount = Math.round(qty * updated.costPrice * 100) / 100;
    const now = new Date();
    if (
      settings.operations.stockEntryCreatesExpense &&
      amount > 0 &&
      !(await isPeriodClosed(ctx.establishmentId, now))
    ) {
      expense = await prisma.transaction.create({
        data: {
          type: "EXPENSE",
          description: `Compra de insumo: ${updated.name} (${qty} ${updated.unit})`,
          amount,
          paidAt: now,
          establishmentId: ctx.establishmentId,
        },
      });
    }
  }

  return NextResponse.json({ movement, item: updated, expense }, { status: 201 });
});
