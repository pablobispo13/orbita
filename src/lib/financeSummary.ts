// =============================================================================
// Agregação de lançamentos financeiros em períodos (ganhos diário/semanal/mensal).
// Puro e client-safe (sem prisma): a UI calcula a partir da lista já carregada.
// A data de referência de um lançamento é `paidAt` (quando o dinheiro moveu) com
// fallback em `createdAt`.
// =============================================================================

export type TxLike = {
  type: "INCOME" | "EXPENSE";
  amount: number;
  paidAt: string | null;
  createdAt: string;
};

export type Totals = { income: number; expense: number; profit: number };

export type DailyPoint = {
  date: string; // ISO (YYYY-MM-DD)
  label: string; // "dd/mm"
} & Totals;

function txDate(t: TxLike): Date {
  return new Date(t.paidAt ?? t.createdAt);
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/// Início da semana (segunda-feira) no horário local.
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const offset = (x.getDay() + 6) % 7; // 0 = segunda
  x.setDate(x.getDate() - offset);
  return x;
}

export function startOfMonth(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

/// Totais de receitas/despesas/lucro no intervalo [from, to).
export function periodTotals(txs: TxLike[], from: Date, to: Date): Totals {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    const d = txDate(t);
    if (d >= from && d < to) {
      if (t.type === "INCOME") income += t.amount;
      else expense += t.amount;
    }
  }
  return { income, expense, profit: income - expense };
}

/// Ganhos de hoje, desta semana e deste mês (até agora).
export function currentPeriods(txs: TxLike[], now = new Date()) {
  const end = new Date(now.getTime() + 1); // inclui o instante atual
  return {
    today: periodTotals(txs, startOfDay(now), end),
    week: periodTotals(txs, startOfWeek(now), end),
    month: periodTotals(txs, startOfMonth(now), end),
  };
}

/// Série diária dos últimos `days` dias (para gráfico de barras).
export function dailySeries(txs: TxLike[], days: number, now = new Date()): DailyPoint[] {
  const points: DailyPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const from = startOfDay(now);
    from.setDate(from.getDate() - i);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    const totals = periodTotals(txs, from, to);
    points.push({
      date: from.toISOString().slice(0, 10),
      label: `${String(from.getDate()).padStart(2, "0")}/${String(from.getMonth() + 1).padStart(2, "0")}`,
      ...totals,
    });
  }
  return points;
}
