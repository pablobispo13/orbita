"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";

type Product = { id: string; name: string; cost: number; price: number };
type RecipeItem = {
  id: string;
  quantity: number;
  stockItem: { id: string; name: string; unit: string; costPrice: number; quantity: number };
};

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const round2 = (v: number) => Math.round(v * 100) / 100;

// Simulação de VENDAS FUTURAS: escolha um produto e a quantidade (ex.: 10
// pizzas) e veja os insumos necessários (vs. estoque atual), o custo de
// produção, a receita e o lucro esperado — com rateio opcional de gastos fixos.
export function SimulacaoView({ companyName }: { companyName?: string | null }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("10");

  const [recipe, setRecipe] = useState<RecipeItem[]>([]);
  const [recipeCost, setRecipeCost] = useState(0);
  const [recipeLoading, setRecipeLoading] = useState(false);

  // Gastos fixos (para rateio). Pode falhar sem o módulo/permissão — vira opcional.
  const [fixedMonthly, setFixedMonthly] = useState<number | null>(null);
  const [monthlyUnits, setMonthlyUnits] = useState("");

  useEffect(() => {
    api
      .get<{ products: Product[] }>("/products", { silent: true })
      .then(({ data }) => setProducts(data.products))
      .catch(() => {})
      .finally(() => setLoading(false));
    api
      .get<{ monthlyTotal: number }>("/finance/fixed-costs", { silent: true })
      .then(({ data }) => setFixedMonthly(data.monthlyTotal))
      .catch(() => setFixedMonthly(null));
  }, []);

  useEffect(() => {
    if (!productId) {
      setRecipe([]);
      setRecipeCost(0);
      return;
    }
    let cancelled = false;
    setRecipeLoading(true);
    api
      .get<{ items: RecipeItem[]; cost: number }>(`/products/${productId}/recipe`, {
        silent: true,
      })
      .then(({ data }) => {
        if (cancelled) return;
        setRecipe(data.items);
        setRecipeCost(data.cost);
      })
      .catch(() => {
        if (!cancelled) {
          setRecipe([]);
          setRecipeCost(0);
        }
      })
      .finally(() => !cancelled && setRecipeLoading(false));
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const product = products.find((p) => p.id === productId) ?? null;
  const n = Math.max(0, Math.floor(Number(qty) || 0));

  const sim = useMemo(() => {
    if (!product || n <= 0) return null;
    // Custo unitário: ficha técnica quando existe; senão o custo cadastrado.
    const unitCost = recipe.length > 0 ? recipeCost : product.cost;
    const insumos = recipe.map((r) => {
      const needed = round2(r.quantity * n);
      return {
        id: r.id,
        name: r.stockItem.name,
        unit: r.stockItem.unit,
        needed,
        available: r.stockItem.quantity,
        enough: r.stockItem.quantity >= needed,
        subtotal: round2(needed * r.stockItem.costPrice),
      };
    });
    const productionCost = round2(unitCost * n);
    const revenue = round2(product.price * n);
    const grossProfit = round2(revenue - productionCost);
    const marginPct = productionCost > 0 ? round2((grossProfit / productionCost) * 100) : null;

    // Rateio de gastos fixos: fixo mensal ÷ unidades vendidas/mês × qtd simulada.
    const mUnits = Math.floor(Number(monthlyUnits) || 0);
    const fixedShare =
      fixedMonthly != null && fixedMonthly > 0 && mUnits > 0
        ? round2((fixedMonthly / mUnits) * n)
        : null;
    const netProfit = fixedShare != null ? round2(grossProfit - fixedShare) : null;

    return { insumos, unitCost, productionCost, revenue, grossProfit, marginPct, fixedShare, netProfit };
  }, [product, n, recipe, recipeCost, fixedMonthly, monthlyUnits]);

  return (
    <div className="p-6 md:p-10 w-full max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Simulação de vendas {companyName ? `· ${companyName}` : ""}
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Quanto custa e quanto rende produzir N unidades de um produto — insumos
          necessários, custo de produção e lucro esperado.
        </p>
      </div>

      {/* Parâmetros */}
      <div className="orbita-card p-5 grid gap-4 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>Produto</span>
          <select
            className="orbita-input w-full px-3 py-2.5"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            disabled={loading}
          >
            <option value="">{loading ? "Carregando..." : "Selecione..."}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {currency(p.price)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Quantidade a produzir
          </span>
          <input
            type="number"
            min={1}
            step={1}
            className="orbita-input w-full px-3 py-2.5"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </label>
      </div>

      {recipeLoading ? (
        <div className="flex justify-center py-10">
          <div className="orbita-spinner" />
        </div>
      ) : !sim ? (
        <p style={{ color: "var(--text-muted)" }}>
          Selecione um produto e a quantidade para simular.
        </p>
      ) : (
        <>
          {/* Insumos necessários */}
          <div className="orbita-card p-5 space-y-3">
            <h2 className="text-lg font-semibold">Insumos para {n} unidade(s)</h2>
            {sim.insumos.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Este produto não tem ficha técnica — o custo usa o valor cadastrado
                ({currency(product!.cost)}/un).
              </p>
            ) : (
              <ul className="space-y-1.5">
                {sim.insumos.map((i) => (
                  <li
                    key={i.id}
                    className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                    style={{ borderColor: i.enough ? "var(--border)" : "var(--danger)" }}
                  >
                    <div className="min-w-0">
                      <span className="font-medium">{i.name}</span>
                      <span className="ml-2 text-xs" style={{ color: "var(--text-muted)" }}>
                        precisa {i.needed} {i.unit} · em estoque {i.available} {i.unit}
                      </span>
                      {!i.enough && (
                        <span className="ml-2 text-xs font-medium" style={{ color: "var(--danger)" }}>
                          falta {round2(i.needed - i.available)} {i.unit}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0">{currency(i.subtotal)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Resultado */}
          <div className="orbita-card p-5 space-y-2">
            <h2 className="text-lg font-semibold">Resultado esperado</h2>
            <Row label={`Custo de produção (${currency(sim.unitCost)}/un)`} value={currency(sim.productionCost)} />
            <Row label={`Receita (${currency(product!.price)}/un)`} value={currency(sim.revenue)} />
            <Row
              label="Lucro bruto"
              value={`${currency(sim.grossProfit)}${sim.marginPct != null ? ` (${sim.marginPct.toFixed(1)}%)` : ""}`}
              highlight={sim.grossProfit >= 0 ? "var(--success)" : "var(--danger)"}
            />

            {/* Rateio de gastos fixos (opcional) */}
            {fixedMonthly != null && fixedMonthly > 0 && (
              <div className="pt-3 mt-2 border-t space-y-2" style={{ borderColor: "var(--border)" }}>
                <label className="flex flex-wrap items-center gap-2 text-sm">
                  <span style={{ color: "var(--text-muted)" }}>
                    Rateio de gastos fixos ({currency(fixedMonthly)}/mês) — unidades vendidas por mês:
                  </span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    className="orbita-input w-28 px-3 py-1.5"
                    placeholder="ex.: 300"
                    value={monthlyUnits}
                    onChange={(e) => setMonthlyUnits(e.target.value)}
                  />
                </label>
                {sim.fixedShare != null && (
                  <>
                    <Row label={`Gastos fixos rateados (${n} un)`} value={`− ${currency(sim.fixedShare)}`} />
                    <Row
                      label="Lucro líquido estimado"
                      value={currency(sim.netProfit!)}
                      highlight={sim.netProfit! >= 0 ? "var(--success)" : "var(--danger)"}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="font-semibold" style={highlight ? { color: highlight } : undefined}>
        {value}
      </span>
    </div>
  );
}
