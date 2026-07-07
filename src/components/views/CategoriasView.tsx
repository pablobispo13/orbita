"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import api, { apiErrorMessage } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmProvider";

type Category = {
  id: string;
  name: string;
  _count?: { products: number; transactions: number };
};

type DefaultItem = {
  id: string;
  quantity: number;
  stockItem: { id: string; name: string; unit: string; costPrice: number };
};

type StockItem = { id: string; name: string; unit: string; costPrice: number };

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Cadastro de CATEGORIAS + insumos padrão por categoria (ex.: toda Pizza leva
// molho e massa). Produto criado na categoria nasce com a ficha pré-populada.
export function CategoriasView({ companyName }: { companyName?: string | null }) {
  const confirm = useConfirm();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Category | null>(null);

  // Painel de insumos padrão da categoria selecionada.
  const [defaults, setDefaults] = useState<DefaultItem[]>([]);
  const [defaultsLoading, setDefaultsLoading] = useState(false);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [stockAvailable, setStockAvailable] = useState(true);
  const [addItemId, setAddItemId] = useState("");
  const [addQty, setAddQty] = useState("1");
  const [adding, setAdding] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);

  useEffect(() => {
    load();
    // Insumos para o seletor (módulo Estoque pode estar desligado → esconde painel).
    api
      .get<{ items: StockItem[] }>("/stock", { silent: true })
      .then(({ data }) => setStockItems(data.items))
      .catch(() => setStockAvailable(false));
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get<{ categories: Category[] }>("/categories");
      setCategories(data.categories);
    } catch {
      /* toast global */
    } finally {
      setLoading(false);
    }
  }

  async function create() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await api.post("/categories", { name }, { silent: true });
      setNewName("");
      toast.success("Categoria criada.");
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Não foi possível criar a categoria."));
    } finally {
      setCreating(false);
    }
  }

  async function remove(cat: Category) {
    const ok = await confirm({
      title: "Excluir categoria",
      message: `Excluir "${cat.name}"? Produtos e lançamentos vinculados ficam sem categoria.`,
      confirmLabel: "Excluir",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await api.delete(`/categories/${cat.id}`);
      if (selected?.id === cat.id) setSelected(null);
      toast.success("Categoria excluída.");
      await load();
    } catch {
      /* toast global */
    }
  }

  async function select(cat: Category) {
    setSelected(cat);
    setPanelError(null);
    if (!stockAvailable) return;
    setDefaultsLoading(true);
    try {
      const { data } = await api.get<{ items: DefaultItem[] }>(
        `/categories/${cat.id}/defaults`,
        { silent: true }
      );
      setDefaults(data.items);
    } catch {
      setDefaults([]);
    } finally {
      setDefaultsLoading(false);
    }
  }

  async function addDefault() {
    if (!selected || !addItemId) return;
    const qty = Number(addQty);
    if (!(qty > 0)) {
      setPanelError("Informe uma quantidade maior que zero.");
      return;
    }
    setAdding(true);
    setPanelError(null);
    try {
      const { data } = await api.post<{ items: DefaultItem[] }>(
        `/categories/${selected.id}/defaults`,
        { stockItemId: addItemId, quantity: qty },
        { silent: true }
      );
      setDefaults(data.items);
      setAddItemId("");
      setAddQty("1");
    } catch (err) {
      setPanelError(apiErrorMessage(err, "Não foi possível adicionar o insumo."));
    } finally {
      setAdding(false);
    }
  }

  async function removeDefault(item: DefaultItem) {
    if (!selected) return;
    try {
      await api.delete(`/categories/${selected.id}/defaults/${item.id}`, { silent: true });
      setDefaults((ds) => ds.filter((d) => d.id !== item.id));
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  const defaultsCost = defaults.reduce(
    (s, d) => s + d.quantity * d.stockItem.costPrice,
    0
  );

  return (
    <div className="p-6 md:p-10 w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Categorias {companyName ? `· ${companyName}` : ""}
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Organize produtos e lançamentos, e defina os insumos padrão de cada
          categoria — todo produto novo já nasce com a ficha técnica básica.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Lista + criação */}
        <div className="orbita-card p-5 space-y-4">
          <h2 className="text-lg font-semibold">Suas categorias</h2>
          <div className="flex gap-2">
            <input
              className="orbita-input flex-1 px-3 py-2.5"
              placeholder="Nova categoria (ex.: Pizza, Bebida)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
            />
            <button
              onClick={create}
              disabled={creating || !newName.trim()}
              className="orbita-btn px-4 py-2.5 shrink-0"
            >
              {creating ? "..." : "Criar"}
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="orbita-spinner" />
            </div>
          ) : categories.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Nenhuma categoria ainda.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {categories.map((cat) => {
                const active = selected?.id === cat.id;
                return (
                  <li
                    key={cat.id}
                    className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 cursor-pointer transition"
                    style={{
                      borderColor: active ? "var(--brand)" : "var(--border)",
                      background: active ? "var(--brand-soft)" : "transparent",
                    }}
                    onClick={() => select(cat)}
                  >
                    <div className="min-w-0">
                      <span className="text-sm font-medium">{cat.name}</span>
                      {cat._count && (
                        <span className="ml-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {cat._count.products} produto(s)
                        </span>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(cat);
                      }}
                      className="text-xs px-2 py-1 rounded hover:bg-white/5 shrink-0"
                      style={{ color: "var(--danger)" }}
                    >
                      Excluir
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Insumos padrão da categoria selecionada */}
        <div className="orbita-card p-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">
              Insumos padrão {selected ? `· ${selected.name}` : ""}
            </h2>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Ex.: toda Pizza leva molho e massa. Aplicados à ficha técnica de
              cada produto novo desta categoria.
            </p>
          </div>

          {!stockAvailable ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              O módulo Estoque precisa estar ativo para configurar insumos padrão.
            </p>
          ) : !selected ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Selecione uma categoria ao lado.
            </p>
          ) : defaultsLoading ? (
            <div className="flex justify-center py-8">
              <div className="orbita-spinner" />
            </div>
          ) : (
            <>
              {defaults.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Nenhum insumo padrão nesta categoria.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {defaults.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <div className="min-w-0 text-sm">
                        <span className="font-medium">{d.stockItem.name}</span>
                        <span className="ml-2 text-xs" style={{ color: "var(--text-muted)" }}>
                          {d.quantity} {d.stockItem.unit} ·{" "}
                          {currency(d.quantity * d.stockItem.costPrice)}
                        </span>
                      </div>
                      <button
                        onClick={() => removeDefault(d)}
                        className="text-xs px-2 py-1 rounded hover:bg-white/5 shrink-0"
                        style={{ color: "var(--danger)" }}
                      >
                        Remover
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {defaults.length > 0 && (
                <div
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm"
                  style={{ background: "var(--brand-soft)", color: "var(--brand-text)" }}
                >
                  <span>Custo base por unidade</span>
                  <span className="font-semibold">{currency(defaultsCost)}</span>
                </div>
              )}

              {/* Adicionar insumo padrão */}
              <div className="flex flex-wrap items-end gap-2 pt-1">
                <label className="space-y-1 flex-1 min-w-40">
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    Insumo
                  </span>
                  <select
                    className="orbita-input w-full px-3 py-2"
                    value={addItemId}
                    onChange={(e) => setAddItemId(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {stockItems.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.unit})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 w-24">
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    Qtd/un.
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    className="orbita-input w-full px-3 py-2"
                    value={addQty}
                    onChange={(e) => setAddQty(e.target.value)}
                  />
                </label>
                <button
                  onClick={addDefault}
                  disabled={adding || !addItemId}
                  className="orbita-btn px-4 py-2 shrink-0"
                >
                  {adding ? "..." : "Adicionar"}
                </button>
              </div>

              {panelError && (
                <div
                  className="rounded-lg px-3 py-2 text-sm"
                  style={{ background: "rgba(248,113,113,0.12)", color: "var(--danger)" }}
                >
                  {panelError}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
