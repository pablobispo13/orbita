// =============================================================================
// Helpers de comanda (Order). Server-side.
// =============================================================================

import { prisma } from "@/lib/prisma";

/// Próximo número sequencial de comanda para a empresa (só para exibição). Não é
/// concorrência-safe no Mongo standalone — aceitável para o MVP (revisitar no Postgres).
export async function nextOrderNumber(establishmentId: string): Promise<number> {
  const last = await prisma.order.findFirst({
    where: { establishmentId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return (last?.number ?? 0) + 1;
}

/// Recalcula e persiste o total da comanda a partir dos itens. Retorna o total.
export async function recomputeOrderTotal(orderId: string): Promise<number> {
  const items = await prisma.orderItem.findMany({
    where: { orderId },
    select: { unitPrice: true, quantity: true },
  });
  const total =
    Math.round(items.reduce((s, i) => s + i.unitPrice * i.quantity, 0) * 100) / 100;
  await prisma.order.update({ where: { id: orderId }, data: { total } });
  return total;
}
