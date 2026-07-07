// =============================================================================
// Precificação por CUSTO + MARGEM (markup sobre o custo).
//
// Modelo do documento de proposta: preço = custo × (1 + margem). Dois patamares
// padrão — "Lançamento" (15%) e "Pleno" (25%) — servem de sugestão; o preço de
// venda real fica em Product.price e o custo em Product.cost.
//
// `actualMarginPct` devolve a margem real embutida no preço praticado, para a UI
// mostrar se o preço cobre o custo (piso) e qual lucro ele gera.
// =============================================================================

export type MarginTier = { key: string; label: string; pct: number };

/// Patamares de margem sugeridos (sobre o custo). Editável conforme a estratégia.
export const MARGIN_TIERS: MarginTier[] = [
  { key: "launch", label: "Lançamento", pct: 15 },
  { key: "full", label: "Pleno", pct: 25 },
];

/// Preço sugerido para um custo e uma margem (%), arredondado a 2 casas.
export function suggestedPrice(cost: number, marginPct: number): number {
  return round2(cost * (1 + marginPct / 100));
}

/// Margem real (%) embutida num preço, dado o custo. 0 se custo <= 0.
export function actualMarginPct(cost: number, price: number): number {
  if (cost <= 0) return 0;
  return round2(((price - cost) / cost) * 100);
}

/// Lucro unitário (preço - custo).
export function unitProfit(cost: number, price: number): number {
  return round2(price - cost);
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
