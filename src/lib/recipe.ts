// =============================================================================
// Ficha técnica — baixa/estorno de estoque conforme a receita de um produto.
// Ao lançar um item na comanda, consome os insumos (OUT); ao remover o item ou
// cancelar a comanda, estorna (IN). Cada movimento vira um StockMovement (audit)
// e ajusta a quantidade do insumo. Pode levar o estoque a negativo de propósito
// (não bloqueia a operação — a comida foi feita); dispara alerta de mínimo.
// =============================================================================

import { prisma } from "@/lib/prisma";
import { notify, NOTIFICATION_TYPES } from "@/lib/notifications";

const round2 = (v: number) => Math.round(v * 100) / 100;

export async function applyRecipeStock(params: {
  establishmentId: string;
  productId: string | null;
  units: number;
  direction: "OUT" | "IN";
  reason: string;
}): Promise<void> {
  const { establishmentId, productId, units, direction, reason } = params;
  if (!productId || units <= 0) return;

  const recipe = await prisma.recipeItem.findMany({
    where: { productId, establishmentId },
  });
  if (recipe.length === 0) return; // produto sem ficha técnica: nada a baixar

  for (const r of recipe) {
    const moved = round2(r.quantity * units);
    if (moved <= 0) continue;

    await prisma.stockMovement.create({
      data: {
        type: direction,
        quantity: moved,
        note: reason,
        stockItemId: r.stockItemId,
        establishmentId,
      },
    });
    // Ajuste ATÔMICO da quantidade (increment/decrement) — evita "lost update"
    // quando várias baixas do mesmo insumo ocorrem simultaneamente (o
    // read-modify-write anterior gravava valor absoluto e perdia baixas).
    const updated = await prisma.stockItem.update({
      where: { id: r.stockItemId },
      data: {
        quantity: direction === "OUT" ? { decrement: moved } : { increment: moved },
      },
    });

    // Alerta ao cruzar o nível mínimo (apenas no consumo). "before" derivado do
    // resultado atômico, não da leitura anterior (possivelmente desatualizada).
    const before = round2(updated.quantity + moved);
    if (direction === "OUT" && before > updated.minLevel && updated.quantity <= updated.minLevel) {
      await notify({
        establishmentId,
        type: NOTIFICATION_TYPES.GENERIC,
        title: "Estoque baixo",
        message: `${updated.name} chegou a ${updated.quantity} ${updated.unit} (mínimo: ${updated.minLevel}).`,
      });
    }
  }
}

/// Custo do produto derivado da ficha técnica (Σ consumo × custo do insumo).
export async function recipeCost(
  establishmentId: string,
  productId: string
): Promise<number> {
  const recipe = await prisma.recipeItem.findMany({
    where: { productId, establishmentId },
    include: { stockItem: { select: { costPrice: true } } },
  });
  return round2(recipe.reduce((s, r) => s + r.quantity * r.stockItem.costPrice, 0));
}
