"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import api, { apiErrorMessage } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmProvider";

type TxType = "INCOME" | "EXPENSE";

type Transaction = {
  id: string;
  type: TxType;
  amount: number;
  paidAt: string | null;
  createdAt: string;
  category: { id: string; name: string } | null;
};

type Closing = {
  id: string;
  year: number;
  month: number;
  totalIncome: number;
  totalExpense: number;
  profit: number;
  closedAt: string;
};

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const profitColor = (v: number) => (v >= 0 ? "var(--accent)" : "var(--danger)");

// Agrupa valores por categoria (nome), para um tipo de lançamento.
function groupByCategory(txs: Transaction[], type: TxType): { name: string; total: number }[] {
  const map = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== type) continue;
    const key = t.category?.name ?? "Sem categoria";
    map.set(key, (map.get(key) ?? 0) + t.amount);
  }
  return [...map.entries()]
    .map(([name, total]) => ({ name, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => b.total - a.total);
}

// Relatórios financeiros — DRE simplificada por mês (receitas/despesas por
// categoria) + fechamento formal do período. Módulo Financeiro.
export function RelatoriosView({ companyName }: { companyName?: string | null }) {
  const confirm = useConfirm();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12

  const [txs, setTxs] = useState<Transaction[]>([]);
  const [closings, setClosings] = useState<Closing[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [tx, cl] = await Promise.all([
        api.get<{ transactions: Transaction[] }>("/finance", { silent: true }),
        api.get<{ closings: Closing[] }>("/finance/closings", { silent: true }),
      ]);
      setTxs(tx.data.transactions);
      setClosings(cl.data.closings);
    } catch {
      /* silencioso */
    } finally {
      setLoading(false);
    }
  }

  const monthTxs = useMemo(
    () =>
      txs.filter((t) => {
        const d = new Date(t.paidAt ?? t.createdAt);
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      }),
    [txs, year, month]
  );

  const income = groupByCategory(monthTxs, "INCOME");
  const expense = groupByCategory(monthTxs, "EXPENSE");
  const totalIncome = income.reduce((s, r) => s + r.total, 0);
  const totalExpense = expense.reduce((s, r) => s + r.total, 0);
  const result = Math.round((totalIncome - totalExpense) * 100) / 100;
  const marginPct = totalIncome > 0 ? (result / totalIncome) * 100 : 0;

  const closed = useMemo(
    () => closings.find((c) => c.year === year && c.month === month) ?? null,
    [closings, year, month]
  );

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y--;
    } else if (m > 12) {
      m = 1;
      y++;
    }
    setMonth(m);
    setYear(y);
  }

  async function closePeriod() {
    const ok = await confirm({
      title: "Fechar período",
      message: `Fechar ${MONTHS[month - 1]}/${year}? Novos lançamentos e edições nesse mês ficarão bloqueados.`,
      confirmLabel: "Fechar período",
    });
    if (!ok) return;
    setClosing(true);
    try {
      await api.post("/finance/closings", { year, month }, { silent: true });
      toast.success("Período fechado.");
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Não foi possível fechar o período."));
    } finally {
      setClosing(false);
    }
  }

  async function reopenPeriod() {
    if (!closed) return;
    const ok = await confirm({
      title: "Reabrir período",
      message: `Reabrir ${MONTHS[month - 1]}/${year}? Voltará a aceitar lançamentos e edições.`,
      confirmLabel: "Reabrir",
    });
    if (!ok) return;
    setClosing(true);
    try {
      await api.delete(`/finance/closings/${closed.id}`, { silent: true });
      toast.success("Período reaberto.");
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Não foi possível reabrir."));
    } finally {
      setClosing(false);
    }
  }

  // Gera a DRE do mês em uma janela imprimível (o usuário salva como PDF pela
  // caixa de impressão do navegador — sem dependência externa).
  function generatePdf() {
    const esc = (s: string) =>
      s.replace(/[&<>"]/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string)
      );
    const rows = (list: { name: string; total: number }[]) =>
      list.length === 0
        ? `<tr><td class="muted" colspan="2">Sem lançamentos.</td></tr>`
        : list
            .map(
              (r) =>
                `<tr><td>${esc(r.name)}</td><td class="right">${currency(r.total)}</td></tr>`
            )
            .join("");

    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>DRE ${MONTHS[month - 1]}/${year}${companyName ? " - " + esc(companyName) : ""}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #111; margin: 32px; }
  h1 { font-size: 20px; margin: 0; }
  .sub { color: #666; font-size: 13px; margin-top: 4px; }
  h2 { font-size: 14px; margin: 24px 0 8px; text-transform: uppercase; letter-spacing: .04em; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  td, th { padding: 6px 8px; border-bottom: 1px solid #e5e5e5; text-align: left; }
  .right { text-align: right; }
  .muted { color: #888; }
  .total td { font-weight: 700; border-top: 2px solid #333; border-bottom: none; }
  .result { margin-top: 24px; padding: 16px; border: 2px solid #333; border-radius: 10px; }
  .result .val { font-size: 24px; font-weight: 800; }
  .pos { color: #0a7d3c; } .neg { color: #b3261e; }
  .badge { display: inline-block; margin-top: 8px; font-size: 12px; color: #555; }
  @media print { body { margin: 12mm; } .noprint { display: none; } }
</style></head><body>
  <h1>DRE Simplificada${companyName ? " — " + esc(companyName) : ""}</h1>
  <div class="sub">Período: ${MONTHS[month - 1]} de ${year} · Gerado em ${new Date().toLocaleString("pt-BR")}${
      closed ? " · <strong>Período fechado</strong>" : ""
    }</div>

  <h2>Receitas</h2>
  <table>${rows(income)}
    <tr class="total"><td>Total de receitas</td><td class="right">${currency(totalIncome)}</td></tr>
  </table>

  <h2>Despesas</h2>
  <table>${rows(expense)}
    <tr class="total"><td>Total de despesas</td><td class="right">${currency(totalExpense)}</td></tr>
  </table>

  <div class="result">
    <div>Resultado do período (lucro/prejuízo)</div>
    <div class="val ${result >= 0 ? "pos" : "neg"}">${currency(result)}</div>
    <div class="badge">Margem sobre receita: ${marginPct.toFixed(1)}%</div>
  </div>

  <script>window.onload = function(){ window.print(); }</script>
</body></html>`;

    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) {
      toast.error("Permita pop-ups para gerar o PDF.");
      return;
    }
    w.document.write(html);
    w.document.close();
  }

  return (
    <div className="p-6 md:p-10 w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            Relatórios {companyName ? `· ${companyName}` : ""}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            DRE simplificada por mês e fechamento formal de período.
          </p>
        </div>
        <button
          onClick={generatePdf}
          disabled={loading}
          className="orbita-btn px-4 py-2.5 shrink-0 disabled:opacity-50"
        >
          📄 Gerar PDF
        </button>
      </div>

      {/* Seletor de mês */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => shiftMonth(-1)}
          className="orbita-btn-secondary px-3 py-2 text-sm"
          aria-label="Mês anterior"
        >
          ←
        </button>
        <div className="text-lg font-semibold min-w-44 text-center">
          {MONTHS[month - 1]} {year}
        </div>
        <button
          onClick={() => shiftMonth(1)}
          className="orbita-btn-secondary px-3 py-2 text-sm"
          aria-label="Próximo mês"
        >
          →
        </button>
        {closed ? (
          <span
            className="ml-2 text-[11px] px-2 py-1 rounded"
            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
          >
            🔒 Fechado em {new Date(closed.closedAt).toLocaleDateString("pt-BR")}
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="orbita-spinner" />
        </div>
      ) : (
        <>
          {/* DRE simplificada */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="orbita-card p-4 space-y-3">
              <div className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
                Receitas
              </div>
              {income.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Sem receitas no período.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {income.map((r) => (
                    <li key={r.name} className="flex justify-between text-sm">
                      <span style={{ color: "var(--text-muted)" }}>{r.name}</span>
                      <span>{currency(r.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div
                className="flex justify-between border-t pt-2 text-sm font-medium"
                style={{ borderColor: "var(--border)" }}
              >
                <span>Total de receitas</span>
                <span style={{ color: "var(--accent)" }}>{currency(totalIncome)}</span>
              </div>
            </div>

            <div className="orbita-card p-4 space-y-3">
              <div className="text-sm font-semibold" style={{ color: "var(--danger)" }}>
                Despesas
              </div>
              {expense.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Sem despesas no período.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {expense.map((r) => (
                    <li key={r.name} className="flex justify-between text-sm">
                      <span style={{ color: "var(--text-muted)" }}>{r.name}</span>
                      <span>{currency(r.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div
                className="flex justify-between border-t pt-2 text-sm font-medium"
                style={{ borderColor: "var(--border)" }}
              >
                <span>Total de despesas</span>
                <span style={{ color: "var(--danger)" }}>{currency(totalExpense)}</span>
              </div>
            </div>
          </div>

          {/* Resultado do período */}
          <div className="orbita-card p-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                Resultado (lucro/prejuízo)
              </div>
              <div className="text-2xl font-bold" style={{ color: profitColor(result) }}>
                {currency(result)}
              </div>
              <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                Margem sobre receita: {marginPct.toFixed(1)}%
              </div>
            </div>
            {closed ? (
              <div className="flex flex-col items-end gap-1">
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  Snapshot no fechamento: {currency(closed.profit)}
                </span>
                <button
                  onClick={reopenPeriod}
                  disabled={closing}
                  className="orbita-btn-secondary px-4 py-2 text-sm"
                >
                  {closing ? "..." : "Reabrir período"}
                </button>
              </div>
            ) : (
              <button onClick={closePeriod} disabled={closing} className="orbita-btn px-4 py-2.5">
                {closing ? "Fechando..." : "Fechar período"}
              </button>
            )}
          </div>

          {/* Histórico de fechamentos */}
          {closings.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Períodos fechados</div>
              <div className="flex flex-wrap gap-2">
                {closings.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setYear(c.year);
                      setMonth(c.month);
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg border hover:bg-white/5"
                    style={{ borderColor: "var(--border-strong)" }}
                  >
                    {MONTHS[c.month - 1].slice(0, 3)}/{c.year} ·{" "}
                    <span style={{ color: profitColor(c.profit) }}>{currency(c.profit)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
