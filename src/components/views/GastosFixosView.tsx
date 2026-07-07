"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import api, { apiErrorMessage } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmProvider";

type FixedCost = {
  id: string;
  name: string;
  amount: number;
  note: string | null;
  active: boolean;
};

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Gastos FIXOS mensais (operacionais): forno, funcionário, aluguel do salão,
// energia... Alimentam a visão financeira e o rateio da simulação de vendas.
export function GastosFixosView({ companyName }: { companyName?: string | null }) {
  const confirm = useConfirm();
  const [costs, setCosts] = useState<FixedCost[]>([]);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get<{ costs: FixedCost[]; monthlyTotal: number }>(
        "/finance/fixed-costs"
      );
      setCosts(data.costs);
      setMonthlyTotal(data.monthlyTotal);
    } catch {
      /* toast global */
    } finally {
      setLoading(false);
    }
  }

  async function create() {
    const amt = Number(amount);
    if (!name.trim() || !(amt > 0)) {
      setFormError("Informe o nome e um valor mensal maior que zero.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await api.post(
        "/finance/fixed-costs",
        { name: name.trim(), amount: amt, note: note.trim() || undefined },
        { silent: true }
      );
      setName("");
      setAmount("");
      setNote("");
      toast.success("Gasto fixo cadastrado.");
      await load();
    } catch (err) {
      setFormError(apiErrorMessage(err, "Não foi possível cadastrar."));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(c: FixedCost) {
    try {
      await api.patch(`/finance/fixed-costs/${c.id}`, { active: !c.active }, { silent: true });
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function remove(c: FixedCost) {
    const ok = await confirm({
      title: "Excluir gasto fixo",
      message: `Excluir "${c.name}" (${currency(c.amount)}/mês)?`,
      confirmLabel: "Excluir",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await api.delete(`/finance/fixed-costs/${c.id}`);
      toast.success("Gasto fixo excluído.");
      await load();
    } catch {
      /* toast global */
    }
  }

  return (
    <div className="p-6 md:p-10 w-full max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Gastos fixos {companyName ? `· ${companyName}` : ""}
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Custos operacionais mensais recorrentes: forno, funcionário, aluguel do
          salão, energia... Usados no rateio da simulação de vendas.
        </p>
      </div>

      {/* Total mensal */}
      <div className="orbita-card p-4 flex items-center justify-between">
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          Total mensal (ativos)
        </span>
        <span className="text-xl font-bold" style={{ color: "var(--accent)" }}>
          {currency(monthlyTotal)}
        </span>
      </div>

      {/* Novo gasto */}
      <div className="orbita-card p-5 space-y-3">
        <h2 className="text-lg font-semibold">Novo gasto fixo</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Nome</span>
            <input
              className="orbita-input w-full px-3 py-2.5"
              placeholder="Ex.: Forno, Funcionário"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Valor mensal (R$)</span>
            <input
              type="number"
              min={0}
              step="any"
              className="orbita-input w-full px-3 py-2.5"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Observação (opcional)</span>
            <input
              className="orbita-input w-full px-3 py-2.5"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
        </div>
        {formError && (
          <div className="rounded-lg px-3 py-2 text-sm" style={{ background: "rgba(248,113,113,0.12)", color: "var(--danger)" }}>
            {formError}
          </div>
        )}
        <button onClick={create} disabled={saving} className="orbita-btn px-4 py-2.5">
          {saving ? "Salvando..." : "Adicionar gasto"}
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="orbita-spinner" />
        </div>
      ) : costs.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>Nenhum gasto fixo cadastrado.</p>
      ) : (
        <ul className="space-y-2">
          {costs.map((c) => (
            <li
              key={c.id}
              className="orbita-card px-4 py-3 flex items-center justify-between gap-3"
              style={{ opacity: c.active ? 1 : 0.55 }}
            >
              <div className="min-w-0">
                <div className="font-medium truncate">
                  {c.name}
                  {!c.active && (
                    <span className="ml-2 text-[10px] px-2 py-0.5 rounded" style={{ background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                      Inativo
                    </span>
                  )}
                </div>
                {c.note && (
                  <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                    {c.note}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-semibold">{currency(c.amount)}/mês</span>
                <button
                  onClick={() => toggleActive(c)}
                  className="text-xs px-2 py-1 rounded border hover:bg-white/5"
                  style={{ borderColor: "var(--border-strong)" }}
                >
                  {c.active ? "Desativar" : "Ativar"}
                </button>
                <button
                  onClick={() => remove(c)}
                  className="text-xs px-2 py-1 rounded hover:bg-white/5"
                  style={{ color: "var(--danger)" }}
                >
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
