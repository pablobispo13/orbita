"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import api, { apiErrorMessage } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { DataTable, Th } from "@/components/ListControls";
import { CategoriesModal, type Category } from "@/components/CategoriesModal";
import { useConfirm } from "@/components/ConfirmProvider";
import {
  currentPeriods,
  dailySeries,
  type TxLike,
  type Totals,
} from "@/lib/financeSummary";

type TxType = "INCOME" | "EXPENSE";

type Transaction = {
  id: string;
  type: TxType;
  description: string;
  amount: number;
  paidAt: string | null;
  dueAt: string | null;
  createdAt: string;
  category: { id: string; name: string } | null;
};

type FormState = {
  id: string | null; // null => criando
  type: TxType;
  description: string;
  amount: string;
  paid: boolean;
  categoryId: string;
};

const emptyForm: FormState = {
  id: null,
  type: "INCOME",
  description: "",
  amount: "0",
  paid: true,
  categoryId: "",
};

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

const profitColor = (v: number) => (v >= 0 ? "var(--accent)" : "var(--danger)");

// Card de ganhos de um período (lucro em destaque + receitas/despesas).
function PeriodCard({ label, totals }: { label: string; totals: Totals }) {
  return (
    <div className="orbita-card p-4 space-y-1">
      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className="text-xl font-bold" style={{ color: profitColor(totals.profit) }}>
        {currency(totals.profit)}
      </div>
      <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        <span style={{ color: "var(--accent)" }}>+{currency(totals.income)}</span>
        {" · "}
        <span style={{ color: "var(--danger)" }}>−{currency(totals.expense)}</span>
      </div>
    </div>
  );
}

// Módulo Financeiro — lançamentos + ganhos por período (diário/semanal/mensal).
export function FinanceiroView({ companyName }: { companyName?: string | null }) {
  const confirm = useConfirm();
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [catsOpen, setCatsOpen] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const editing = form.id !== null;
  const valid = form.description.trim().length >= 1 && Number(form.amount) > 0;

  const periods = useMemo(() => currentPeriods(txs as TxLike[]), [txs]);
  const series = useMemo(() => dailySeries(txs as TxLike[], 14), [txs]);
  const maxProfitAbs = useMemo(
    () => Math.max(1, ...series.map((p) => Math.abs(p.profit))),
    [series]
  );

  useEffect(() => {
    load();
    loadCategories();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get<{ transactions: Transaction[] }>("/finance");
      setTxs(data.transactions);
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

  function openEdit(t: Transaction) {
    setForm({
      id: t.id,
      type: t.type,
      description: t.description,
      amount: String(t.amount),
      paid: !!t.paidAt,
      categoryId: t.category?.id ?? "",
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function submit() {
    if (!valid) return;
    setSaving(true);
    setFormError(null);
    const payload = {
      type: form.type,
      description: form.description.trim(),
      amount: Number(form.amount) || 0,
      paidAt: form.paid ? new Date().toISOString() : null,
      categoryId: form.categoryId || null,
    };
    try {
      if (editing) {
        await api.patch(`/finance/${form.id}`, payload, { silent: true });
        toast.success("Lançamento atualizado.");
      } else {
        await api.post("/finance", { ...payload, paidAt: payload.paidAt ?? undefined }, { silent: true });
        toast.success("Lançamento registrado.");
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      setFormError(apiErrorMessage(err, "Não foi possível salvar o lançamento."));
    } finally {
      setSaving(false);
    }
  }

  async function remove(t: Transaction) {
    const ok = await confirm({
      title: "Excluir lançamento",
      message: `Excluir o lançamento "${t.description}"?`,
      confirmLabel: "Excluir",
      tone: "danger",
    });
    if (!ok) return;
    setDeletingId(t.id);
    try {
      await api.delete(`/finance/${t.id}`);
      toast.success("Lançamento excluído.");
      await load();
    } catch {
      /* toast global cuida do erro */
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="p-6 md:p-10 w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            Financeiro {companyName ? `· ${companyName}` : ""}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Ganhos por período e lançamentos de receitas e despesas.
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
            + Novo lançamento
          </button>
        </div>
      </div>

      {/* Ganhos por período (lucro = receitas − despesas) */}
      <div className="grid gap-4 sm:grid-cols-3">
        <PeriodCard label="Hoje" totals={periods.today} />
        <PeriodCard label="Esta semana" totals={periods.week} />
        <PeriodCard label="Este mês" totals={periods.month} />
      </div>

      {/* Gráfico de barras: lucro diário dos últimos 14 dias */}
      <div className="orbita-card p-4 space-y-3">
        <div className="text-sm font-medium">Lucro diário — últimos 14 dias</div>
        <div className="flex items-end gap-1.5 h-32">
          {series.map((p) => {
            const h = Math.round((Math.abs(p.profit) / maxProfitAbs) * 100);
            const positive = p.profit >= 0;
            return (
              <div
                key={p.date}
                className="flex-1 flex flex-col items-center justify-end h-full gap-1"
                title={`${p.label}: ${currency(p.profit)}`}
              >
                <div
                  className="w-full rounded-t"
                  style={{
                    height: `${Math.max(h, p.profit !== 0 ? 4 : 0)}%`,
                    background: positive ? "var(--accent)" : "var(--danger)",
                    opacity: p.profit === 0 ? 0.15 : 1,
                    minHeight: p.profit === 0 ? "2px" : undefined,
                  }}
                />
                <span
                  className="text-[9px] leading-none"
                  style={{ color: "var(--text-muted)" }}
                >
                  {p.label.slice(0, 2)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="orbita-spinner" />
        </div>
      ) : txs.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>
          Nenhum lançamento ainda. Use “+ Novo lançamento”.
        </p>
      ) : (
        <DataTable>
          <thead>
            <tr>
              <Th>Descrição</Th>
              <Th>Categoria</Th>
              <Th>Tipo</Th>
              <Th>Valor</Th>
              <Th>Pago em</Th>
              <Th>Ações</Th>
            </tr>
          </thead>
          <tbody>
            {txs.map((t) => {
              const income = t.type === "INCOME";
              return (
                <tr
                  key={t.id}
                  className="border-b"
                  style={{ borderColor: "var(--border)" }}
                >
                  <td className="px-4 py-2.5 font-medium">{t.description}</td>
                  <td className="px-4 py-2.5" style={{ color: "var(--text-muted)" }}>
                    {t.category?.name ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className="text-[10px] px-2 py-0.5 rounded"
                      style={{
                        background: income ? "var(--brand-soft)" : "rgba(248,113,113,0.12)",
                        color: income ? "var(--brand-text)" : "var(--danger)",
                      }}
                    >
                      {income ? "Receita" : "Despesa"}
                    </span>
                  </td>
                  <td
                    className="px-4 py-2.5"
                    style={{ color: income ? "var(--accent)" : "var(--danger)" }}
                  >
                    {income ? "+" : "−"} {currency(t.amount)}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--text-muted)" }}>
                    {formatDate(t.paidAt)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(t)}
                        className="rounded-lg border px-2.5 py-1 text-xs hover:bg-white/5"
                        style={{ borderColor: "var(--border-strong)" }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => remove(t)}
                        disabled={deletingId === t.id}
                        className="rounded-lg border px-2.5 py-1 text-xs hover:bg-white/5 disabled:opacity-50"
                        style={{ borderColor: "var(--border-strong)", color: "var(--danger)" }}
                      >
                        {deletingId === t.id ? "..." : "Excluir"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Editar lançamento" : "Novo lançamento"}
        maxWidth="max-w-lg"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Tipo
            </span>
            <select
              className="orbita-input w-full px-3 py-2.5"
              value={form.type}
              onChange={(e) =>
                setForm((p) => ({ ...p, type: e.target.value as TxType }))
              }
            >
              <option value="INCOME">Receita</option>
              <option value="EXPENSE">Despesa</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Valor (R$)
            </span>
            <input
              type="number"
              min={0}
              step="any"
              className="orbita-input w-full px-3 py-2.5"
              value={form.amount}
              onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
            />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Descrição
            </span>
            <input
              className="orbita-input w-full px-3 py-2.5"
              placeholder="Ex.: Venda balcão, Compra de insumos"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Categoria / centro de custo (opcional)
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
          <label className="flex items-center gap-2 text-sm cursor-pointer sm:col-span-2">
            <input
              type="checkbox"
              checked={form.paid}
              onChange={(e) => setForm((p) => ({ ...p, paid: e.target.checked }))}
            />
            Marcar como pago hoje
          </label>
        </div>

        {formError && (
          <div
            className="rounded-lg px-3 py-2 text-sm mt-4"
            style={{ background: "rgba(248,113,113,0.12)", color: "var(--danger)" }}
          >
            {formError}
          </div>
        )}

        <div className="flex items-center gap-3 pt-4">
          <button
            onClick={submit}
            disabled={!valid || saving}
            className="orbita-btn px-4 py-2.5"
          >
            {saving ? "Salvando..." : editing ? "Salvar alterações" : "Registrar lançamento"}
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
    </div>
  );
}
