"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import api, { apiErrorMessage } from "@/lib/api";
import { Modal } from "@/components/Modal";

type RecipeItem = {
  id: string;
  quantity: number;
  stockItem: { id: string; name: string; unit: string; costPrice: number };
};

type StockItemRef = { id: string; name: string; unit: string; costPrice: number };

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Ficha técnica de um produto: insumos consumidos por unidade vendida. Mostra o
// custo derivado (Σ consumo × custo do insumo) e permite aplicá-lo ao produto.
// `onApplied` devolve o novo custo para o pai atualizar a lista.
export function RecipeModal({
  product,
  onClose,
  onApplied,
}: {
  product: { id: string; name: string } | null;
  onClose: () => void;
  onApplied?: (cost: number) => void;
}) {
  const [items, setItems] = useState<RecipeItem[]>([]);
  const [cost, setCost] = useState(0);
  const [stock, setStock] = useState<StockItemRef[]>([]);
  const [stockOff, setStockOff] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ stockItemId: "", quantity: "" });
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (product) load(product.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  async function load(productId: string) {
    setLoading(true);
    try {
      const { data } = await api.get<{ items: RecipeItem[]; cost: number }>(
        `/products/${productId}/recipe`,
        { silent: true }
      );
      setItems(data.items);
      setCost(data.cost);
    } catch {
      /* silencioso */
    } finally {
      setLoading(false);
    }
    // Insumos para o seletor (requer módulo Estoque).
    try {
      const { data } = await api.get<{ items: StockItemRef[] }>("/stock", { silent: true });
      setStock(data.items);
      setStockOff(false);
    } catch {
      setStockOff(true);
    }
  }

  async function addItem() {
    if (!product || !form.stockItemId) return;
    const qty = Number(form.quantity);
    if (!(qty > 0)) return;
    setSaving(true);
    try {
      const { data } = await api.post<{ items: RecipeItem[]; cost: number }>(
        `/products/${product.id}/recipe`,
        { stockItemId: form.stockItemId, quantity: qty },
        { silent: true }
      );
      setItems(data.items);
      setCost(data.cost);
      setForm({ stockItemId: "", quantity: "" });
    } catch (err) {
      toast.error(apiErrorMessage(err, "Não foi possível adicionar o insumo."));
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(itemId: string) {
    if (!product) return;
    setBusyId(itemId);
    try {
      await api.delete(`/products/${product.id}/recipe/${itemId}`, { silent: true });
      await load(product.id);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Não foi possível remover."));
    } finally {
      setBusyId(null);
    }
  }

  async function applyCost() {
    if (!product) return;
    setApplying(true);
    try {
      await api.patch(`/products/${product.id}`, { cost }, { silent: true });
      toast.success(`Custo do produto atualizado para ${currency(cost)}.`);
      onApplied?.(cost);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Não foi possível aplicar o custo."));
    } finally {
      setApplying(false);
    }
  }

  const selectedUnit = stock.find((s) => s.id === form.stockItemId)?.unit;

  return (
    <Modal
      open={!!product}
      onClose={onClose}
      title={product ? `Ficha técnica · ${product.name}` : "Ficha técnica"}
      maxWidth="max-w-lg"
    >
      <div className="space-y-5">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Insumos consumidos por unidade vendida. Ao lançar o item numa comanda, o
          estoque é baixado automaticamente por esta receita.
        </p>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="orbita-spinner" />
          </div>
        ) : (
          <>
            {items.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Nenhum insumo na ficha ainda.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {items.map((it) => (
                  <li
                    key={it.id}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <span className="flex-1 text-sm">
                      {it.stockItem.name}
                      <span className="ml-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {it.quantity} {it.stockItem.unit} · {currency(it.quantity * it.stockItem.costPrice)}
                      </span>
                    </span>
                    <button
                      onClick={() => removeItem(it.id)}
                      disabled={busyId === it.id}
                      className="text-xs px-2 py-1 rounded-lg border hover:bg-white/5 disabled:opacity-50"
                      style={{ borderColor: "var(--border-strong)", color: "var(--danger)" }}
                    >
                      {busyId === it.id ? "..." : "Remover"}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Adicionar insumo */}
            {stockOff ? (
              <p className="text-xs" style={{ color: "var(--danger)" }}>
                Ative o módulo Estoque para montar a ficha técnica.
              </p>
            ) : (
              <div className="flex gap-2">
                <select
                  className="orbita-input flex-1 px-3 py-2"
                  value={form.stockItemId}
                  onChange={(e) => setForm((f) => ({ ...f, stockItemId: e.target.value }))}
                >
                  <option value="">Selecione o insumo</option>
                  {stock.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.unit})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  step="any"
                  className="orbita-input w-24 px-2 py-2"
                  placeholder={selectedUnit ? selectedUnit : "Qtd"}
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                />
                <button
                  onClick={addItem}
                  disabled={saving || !form.stockItemId || !(Number(form.quantity) > 0)}
                  className="orbita-btn px-4 py-2 shrink-0 disabled:opacity-50"
                >
                  {saving ? "..." : "Add"}
                </button>
              </div>
            )}

            {/* Custo derivado */}
            <div
              className="flex flex-wrap items-center justify-between gap-3 border-t pt-3"
              style={{ borderColor: "var(--border)" }}
            >
              <div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Custo pela ficha técnica
                </div>
                <div className="text-lg font-bold">{currency(cost)}</div>
              </div>
              <button
                onClick={applyCost}
                disabled={applying || cost <= 0}
                className="orbita-btn-secondary px-4 py-2.5 disabled:opacity-50"
              >
                {applying ? "..." : "Aplicar custo ao produto"}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
