"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import api, { apiErrorMessage } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { DataTable, Th, ViewToggle, useViewMode } from "@/components/ListControls";
import { CategoriesModal, type Category } from "@/components/CategoriesModal";
import { RecipeModal } from "@/components/RecipeModal";
import { useConfirm } from "@/components/ConfirmProvider";
import {
  MARGIN_TIERS,
  suggestedPrice,
  actualMarginPct,
  unitProfit,
} from "@/lib/pricing";

type Product = {
  id: string;
  name: string;
  description: string | null;
  cost: number;
  marginPct: number;
  price: number;
  active: boolean;
  category: { id: string; name: string } | null;
};

type FormState = {
  id: string | null; // null => criando
  name: string;
  description: string;
  cost: string;
  marginPct: string;
  price: string;
  active: boolean;
  categoryId: string;
};

const emptyForm: FormState = {
  id: null,
  name: "",
  description: "",
  cost: "0",
  marginPct: "25",
  price: "0",
  active: true,
  categoryId: "",
};

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const marginColor = (pct: number) => (pct >= 0 ? "var(--accent)" : "var(--danger)");

export function ProdutosView({ companyName }: { companyName?: string | null }) {
  const confirm = useConfirm();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useViewMode("view_produtos");
  const [catsOpen, setCatsOpen] = useState(false);
  const [recipeFor, setRecipeFor] = useState<{ id: string; name: string } | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Venda rápida (gera receita no Financeiro).
  const [sale, setSale] = useState<{ product: Product; quantity: string } | null>(null);
  const [selling, setSelling] = useState(false);
  const [saleError, setSaleError] = useState<string | null>(null);

  const editing = form.id !== null;
  const costNum = Number(form.cost) || 0;
  const priceNum = Number(form.price) || 0;
  const marginNum = Number(form.marginPct) || 0;
  const valid = form.name.trim().length >= 1 && priceNum >= 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, search]);

  useEffect(() => {
    load();
    loadCategories();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get<{ products: Product[] }>("/products");
      setProducts(data.products);
    } catch {
      /* toast global cuida do erro */
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const { data } = await api.get<{ categories: Category[] }>("/categories", {
        silent: true,
      });
      setCategories(data.categories);
    } catch {
      /* silencioso */
    }
  }

  function openCreate() {
    setForm(emptyForm);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(p: Product) {
    setForm({
      id: p.id,
      name: p.name,
      description: p.description ?? "",
      cost: String(p.cost),
      marginPct: String(p.marginPct),
      price: String(p.price),
      active: p.active,
      categoryId: p.category?.id ?? "",
    });
    setFormError(null);
    setFormOpen(true);
  }

  // Aplica um patamar de margem: ajusta marginPct e recalcula o preço.
  function applyMargin(pct: number) {
    setForm((p) => ({
      ...p,
      marginPct: String(pct),
      price: String(suggestedPrice(Number(p.cost) || 0, pct)),
    }));
  }

  // Margem digitada AFETA o preço na hora (ex.: 200% na borda de catupiry).
  function changeMargin(value: string) {
    setForm((p) => {
      const cost = Number(p.cost) || 0;
      const pct = Number(value);
      return {
        ...p,
        marginPct: value,
        // Só recalcula com custo válido e margem numérica (campo vazio não zera o preço).
        ...(cost > 0 && Number.isFinite(pct) && value.trim() !== ""
          ? { price: String(suggestedPrice(cost, pct)) }
          : {}),
      };
    });
  }

  // Mudar o custo recalcula o preço mantendo a margem-alvo.
  function changeCost(value: string) {
    setForm((p) => {
      const cost = Number(value) || 0;
      const pct = Number(p.marginPct);
      return {
        ...p,
        cost: value,
        ...(cost > 0 && Number.isFinite(pct)
          ? { price: String(suggestedPrice(cost, pct)) }
          : {}),
      };
    });
  }

  async function submit() {
    if (!valid) return;
    setSaving(true);
    setFormError(null);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      cost: costNum,
      marginPct: marginNum,
      price: priceNum,
      active: form.active,
      categoryId: form.categoryId || null,
    };
    try {
      if (editing) {
        await api.patch(`/products/${form.id}`, payload, { silent: true });
        toast.success("Produto atualizado.");
      } else {
        await api.post("/products", payload, { silent: true });
        toast.success("Produto cadastrado.");
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      setFormError(apiErrorMessage(err, "Não foi possível salvar o produto."));
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: Product) {
    const ok = await confirm({
      title: "Excluir produto",
      message: `Excluir o produto "${p.name}"?`,
      confirmLabel: "Excluir",
      tone: "danger",
    });
    if (!ok) return;
    setDeletingId(p.id);
    try {
      await api.delete(`/products/${p.id}`);
      toast.success("Produto excluído.");
      await load();
    } catch {
      /* toast global cuida do erro */
    } finally {
      setDeletingId(null);
    }
  }

  function openSale(p: Product) {
    setSale({ product: p, quantity: "1" });
    setSaleError(null);
  }

  async function submitSale() {
    if (!sale) return;
    const qty = Math.floor(Number(sale.quantity));
    if (!(qty > 0)) {
      setSaleError("Informe uma quantidade maior que zero.");
      return;
    }
    setSelling(true);
    setSaleError(null);
    try {
      await api.post(
        "/sales",
        { productId: sale.product.id, quantity: qty },
        { silent: true }
      );
      toast.success(
        `Venda registrada — ${currency(sale.product.price * qty)} no Financeiro.`
      );
      setSale(null);
    } catch (err) {
      setSaleError(apiErrorMessage(err, "Não foi possível registrar a venda."));
    } finally {
      setSelling(false);
    }
  }

  return (
    <div className="p-6 md:p-10 w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            Produtos {companyName ? `· ${companyName}` : ""}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Catálogo de itens vendáveis com precificação por custo e margem.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setCatsOpen(true)}
            className="orbita-btn-secondary px-4 py-2.5"
          >
            Categorias
          </button>
          <button onClick={openCreate} className="orbita-btn px-4 py-2.5">
            + Novo produto
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          className="orbita-input flex-1 min-w-56 px-3 py-2.5"
          placeholder="Buscar produto por nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <ViewToggle mode={viewMode} onChange={setViewMode} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="orbita-spinner" />
        </div>
      ) : filtered.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>
          {search.trim()
            ? "Nenhum produto encontrado."
            : "Nenhum produto cadastrado ainda. Use “+ Novo produto”."}
        </p>
      ) : viewMode === "cards" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((product) => {
            const margin = actualMarginPct(product.cost, product.price);
            return (
              <div key={product.id} className="orbita-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{product.name}</div>
                    {product.category && (
                      <span
                        className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded"
                        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                      >
                        {product.category.name}
                      </span>
                    )}
                  </div>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded shrink-0"
                    style={{
                      background: product.active ? "var(--brand-soft)" : "var(--bg-elevated)",
                      color: product.active ? "var(--brand-text)" : "var(--text-muted)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {product.active ? "Ativo" : "Inativo"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      Custo
                    </div>
                    <div>{currency(product.cost)}</div>
                  </div>
                  <div>
                    <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      Preço
                    </div>
                    <div className="font-medium">{currency(product.price)}</div>
                  </div>
                  <div>
                    <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      Margem
                    </div>
                    <div style={{ color: marginColor(margin) }}>
                      {product.cost > 0 ? `${margin.toFixed(1)}%` : "—"}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  {product.active && (
                    <button
                      onClick={() => openSale(product)}
                      className="orbita-btn w-full px-3 py-1.5 text-xs"
                    >
                      🛒 Vender
                    </button>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setRecipeFor({ id: product.id, name: product.name })}
                      className="w-full rounded-lg border px-2 py-1.5 text-xs hover:bg-white/5"
                      style={{ borderColor: "var(--border-strong)" }}
                    >
                      Ficha
                    </button>
                    <button
                      onClick={() => openEdit(product)}
                      className="w-full rounded-lg border px-2 py-1.5 text-xs hover:bg-white/5"
                      style={{ borderColor: "var(--border-strong)" }}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => remove(product)}
                      disabled={deletingId === product.id}
                      className="w-full rounded-lg border px-2 py-1.5 text-xs hover:bg-white/5 disabled:opacity-50"
                      style={{ borderColor: "var(--border-strong)", color: "var(--danger)" }}
                    >
                      {deletingId === product.id ? "..." : "Excluir"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <DataTable>
          <thead>
            <tr>
              <Th>Produto</Th>
              <Th>Categoria</Th>
              <Th>Custo</Th>
              <Th>Preço</Th>
              <Th>Margem</Th>
              <Th>Status</Th>
              <Th>Ações</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((product) => {
              const margin = actualMarginPct(product.cost, product.price);
              return (
                <tr key={product.id} className="border-b" style={{ borderColor: "var(--border)" }}>
                  <td className="px-4 py-2.5 font-medium">{product.name}</td>
                  <td className="px-4 py-2.5" style={{ color: "var(--text-muted)" }}>
                    {product.category?.name ?? "—"}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--text-muted)" }}>
                    {currency(product.cost)}
                  </td>
                  <td className="px-4 py-2.5">{currency(product.price)}</td>
                  <td className="px-4 py-2.5">
                    <span style={{ color: marginColor(margin) }}>
                      {product.cost > 0 ? `${margin.toFixed(1)}%` : "—"}
                    </span>
                    <span className="ml-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                      ({currency(unitProfit(product.cost, product.price))})
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className="text-[10px] px-2 py-0.5 rounded"
                      style={{
                        background: product.active ? "var(--brand-soft)" : "var(--bg-elevated)",
                        color: product.active ? "var(--brand-text)" : "var(--text-muted)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      {product.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-2">
                      {product.active && (
                        <button
                          onClick={() => openSale(product)}
                          className="rounded-lg px-2.5 py-1 text-xs"
                          style={{ background: "var(--brand-soft)", color: "var(--brand-text)" }}
                        >
                          🛒 Vender
                        </button>
                      )}
                      <button
                        onClick={() => setRecipeFor({ id: product.id, name: product.name })}
                        className="rounded-lg border px-2.5 py-1 text-xs hover:bg-white/5"
                        style={{ borderColor: "var(--border-strong)" }}
                      >
                        Ficha
                      </button>
                      <button
                        onClick={() => openEdit(product)}
                        className="rounded-lg border px-2.5 py-1 text-xs hover:bg-white/5"
                        style={{ borderColor: "var(--border-strong)" }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => remove(product)}
                        disabled={deletingId === product.id}
                        className="rounded-lg border px-2.5 py-1 text-xs hover:bg-white/5 disabled:opacity-50"
                        style={{ borderColor: "var(--border-strong)", color: "var(--danger)" }}
                      >
                        {deletingId === product.id ? "..." : "Excluir"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      )}

      {/* Modal: criar / editar produto */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Editar produto" : "Novo produto"}
        maxWidth="max-w-lg"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Nome do produto
            </span>
            <input
              className="orbita-input w-full px-3 py-2.5"
              placeholder="Ex.: Pizza Pepperoni, Refrigerante 2L"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Descrição (opcional)
            </span>
            <input
              className="orbita-input w-full px-3 py-2.5"
              placeholder="Breve descrição do produto"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Categoria (opcional)
            </span>
            <select
              className="orbita-input w-full px-3 py-2.5"
              value={form.categoryId}
              onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))}
            >
              <option value="">Sem categoria</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Custo total (R$)
            </span>
            <input
              type="number"
              min={0}
              step="any"
              className="orbita-input w-full px-3 py-2.5"
              value={form.cost}
              onChange={(e) => changeCost(e.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Preço de venda (R$)
            </span>
            <input
              type="number"
              min={0}
              step="any"
              className="orbita-input w-full px-3 py-2.5"
              value={form.price}
              onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
            />
          </label>
        </div>

        {/* Precificação por margem (personalizável) */}
        <div
          className="rounded-lg border p-3 mt-4 space-y-3"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Precificação por margem</span>
            <span
              className="text-[11px]"
              style={{ color: marginColor(actualMarginPct(costNum, priceNum)) }}
            >
              Margem atual: {costNum > 0 ? `${actualMarginPct(costNum, priceNum).toFixed(1)}%` : "—"}
            </span>
          </div>

          <div className="flex items-end gap-2">
            <label className="space-y-1 flex-1">
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                Margem alvo (%)
              </span>
              <input
                type="number"
                min={0}
                step="any"
                className="orbita-input w-full px-3 py-2"
                value={form.marginPct}
                onChange={(e) => changeMargin(e.target.value)}
              />
            </label>
            <div
              className="px-3 py-2 text-sm shrink-0 rounded-lg"
              style={{ background: "var(--brand-soft)", color: "var(--brand-text)" }}
            >
              Preço: {costNum > 0 ? currency(suggestedPrice(costNum, marginNum)) : "—"}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="text-[11px] self-center" style={{ color: "var(--text-muted)" }}>
              Atalhos:
            </span>
            {MARGIN_TIERS.map((tier) => (
              <button
                key={tier.key}
                type="button"
                onClick={() => applyMargin(tier.pct)}
                disabled={costNum <= 0}
                className="text-xs px-3 py-1 rounded-full border hover:bg-white/5 disabled:opacity-50"
                style={{ borderColor: "var(--border-strong)" }}
              >
                {tier.label} ({tier.pct}%)
              </button>
            ))}
          </div>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            O custo é o piso: preços abaixo dele geram margem negativa (prejuízo).
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer mt-4">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
          />
          Disponível para venda
        </label>

        {formError && (
          <div
            className="rounded-lg px-3 py-2 text-sm mt-4"
            style={{ background: "rgba(248,113,113,0.12)", color: "var(--danger)" }}
          >
            {formError}
          </div>
        )}

        <div className="flex items-center gap-3 pt-4">
          <button onClick={submit} disabled={!valid || saving} className="orbita-btn px-4 py-2.5">
            {saving ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar produto"}
          </button>
          <button
            type="button"
            onClick={() => setFormOpen(false)}
            className="orbita-btn-secondary px-4 py-2.5"
          >
            Cancelar
          </button>
        </div>
      </Modal>

      <CategoriesModal
        open={catsOpen}
        onClose={() => setCatsOpen(false)}
        onChange={loadCategories}
      />

      <RecipeModal
        product={recipeFor}
        onClose={() => setRecipeFor(null)}
        onApplied={() => load()}
      />

      {/* Modal: registrar venda (gera receita no Financeiro) */}
      <Modal
        open={!!sale}
        onClose={() => setSale(null)}
        title="Registrar venda"
        maxWidth="max-w-sm"
      >
        {sale && (
          <div className="space-y-4">
            <div>
              <div className="font-medium">{sale.product.name}</div>
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>
                Preço unitário: {currency(sale.product.price)}
              </div>
            </div>
            <label className="space-y-1 block">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Quantidade
              </span>
              <input
                type="number"
                min={1}
                step={1}
                autoFocus
                className="orbita-input w-full px-3 py-2.5"
                value={sale.quantity}
                onChange={(e) =>
                  setSale((s) => (s ? { ...s, quantity: e.target.value } : s))
                }
              />
            </label>
            <div
              className="flex items-center justify-between rounded-lg border px-3 py-2"
              style={{ borderColor: "var(--border)" }}
            >
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                Total da venda
              </span>
              <span className="text-lg font-bold" style={{ color: "var(--accent)" }}>
                {currency(sale.product.price * (Math.floor(Number(sale.quantity)) || 0))}
              </span>
            </div>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              Gera um lançamento de receita no Financeiro
              {sale.product.category ? ` na categoria "${sale.product.category.name}"` : ""}.
            </p>

            {saleError && (
              <div
                className="rounded-lg px-3 py-2 text-sm"
                style={{ background: "rgba(248,113,113,0.12)", color: "var(--danger)" }}
              >
                {saleError}
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button onClick={submitSale} disabled={selling} className="orbita-btn px-4 py-2.5">
                {selling ? "Registrando..." : "Registrar venda"}
              </button>
              <button
                type="button"
                onClick={() => setSale(null)}
                className="orbita-btn-secondary px-4 py-2.5"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
