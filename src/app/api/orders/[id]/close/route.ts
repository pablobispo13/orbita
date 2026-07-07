import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule, jsonError, zodError } from "@/lib/auth";
import { withRoute } from "@/lib/http";
import { PERMISSIONS } from "@/lib/permissions";
import { MODULES } from "@/lib/modules";
import { recomputeOrderTotal } from "@/lib/orders";
import { isPeriodClosed } from "@/lib/period";
import { fireSaleEvent } from "@/lib/notificationRules";

type Ctx = { params: Promise<{ id: string }> };

const round2 = (v: number) => Math.round(v * 100) / 100;

const closeSchema = z.object({
  serviceFee: z.number().min(0).default(0), // valor em R$ (ex.: 10% já calculado no cliente)
  discount: z.number().min(0).default(0),
  people: z.number().int().positive().nullable().optional(),
  paymentMethod: z.enum(["CASH", "CARD", "PIX", "OTHER"]).nullable().optional(),
});

// Fecha a comanda com taxa de serviço, desconto, divisão e forma de pagamento.
// Gera receita no Financeiro (se o módulo estiver ativo) pelo valor final e
// respeita período fechado. Requer módulo Comanda + ORDER_WRITE.
export const POST = withRoute(async (req: NextRequest, { params }: Ctx) => {
  const { ctx, response } = await requireModule(req, MODULES.COMANDA, PERMISSIONS.ORDER_WRITE);
  if (response) return response;

  const { id } = await params;
  const order = await prisma.order.findFirst({
    where: { id, establishmentId: ctx.establishmentId },
    include: { table: { select: { name: true } } },
  });
  if (!order) return jsonError("Comanda não encontrada", 404);
  if (order.status !== "OPEN") return jsonError("A comanda não está aberta.", 409);

  const body = await req.json().catch(() => ({}));
  const parsed = closeSchema.safeParse(body ?? {});
  if (!parsed.success) return zodError(parsed.error);
  const { serviceFee, discount, people, paymentMethod } = parsed.data;

  const subtotal = await recomputeOrderTotal(id);
  const finalAmount = Math.max(0, round2(subtotal + serviceFee - discount));
  const now = new Date();

  const financeOn = ctx.modules.includes(MODULES.FINANCE);
  const willGenerateFinance = financeOn && finalAmount > 0;

  // Bloqueia fechamento com data em período fechado (antes de tocar no banco).
  if (willGenerateFinance && (await isPeriodClosed(ctx.establishmentId, now))) {
    return jsonError("Período fechado: reabra o mês para fechar comandas nesta data.", 409);
  }

  const where =
    order.type === "TABLE" && order.table
      ? `Mesa ${order.table.name}`
      : order.type === "DELIVERY"
        ? "Delivery"
        : "Balcão";

  // Fecha a comanda e gera a receita ATOMICAMENTE (ou nada acontece). Evita a
  // receita órfã / faturamento em dobro quando algo falha no meio. O updateMany
  // condicional (status: OPEN) também barra o fechamento duplo concorrente.
  const ALREADY_CLOSED = "__ALREADY_CLOSED__";
  try {
    await prisma.$transaction(async (tx) => {
      const guard = await tx.order.updateMany({
        where: { id, status: "OPEN" },
        data: {
          status: "CLOSED",
          closedAt: now,
          total: subtotal,
          serviceFee,
          discount,
          people: people ?? null,
          paymentMethod: paymentMethod ?? null,
        },
      });
      if (guard.count === 0) throw new Error(ALREADY_CLOSED);

      if (willGenerateFinance) {
        const created = await tx.transaction.create({
          data: {
            type: "INCOME",
            description: `Comanda #${order.number} · ${where}`,
            amount: finalAmount,
            paidAt: now,
            establishmentId: ctx.establishmentId,
          },
          select: { id: true },
        });
        await tx.order.update({ where: { id }, data: { transactionId: created.id } });
      }
    });
  } catch (err) {
    if (err instanceof Error && err.message === ALREADY_CLOSED) {
      return jsonError("A comanda não está aberta.", 409);
    }
    throw err;
  }

  // Regras de notificação "a cada nova venda" — só quando gerou receita
  // (best-effort, não bloqueia a resposta).
  if (willGenerateFinance) {
    void fireSaleEvent(ctx.establishmentId, {
      amount: finalAmount,
      label: `Comanda #${order.number} · ${where}`,
    }).catch(() => {});
  }

  const updated = await prisma.order.findUniqueOrThrow({
    where: { id },
    include: { table: { select: { id: true, name: true } }, items: true },
  });

  return NextResponse.json({
    order: updated,
    finalAmount,
    financeGenerated: willGenerateFinance,
  });
});
