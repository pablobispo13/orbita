// =============================================================================
// Helpers de período mensal (fechamento financeiro). Server-side.
// Um período é (year, month=1-12). Intervalo [início do mês, início do próximo).
// =============================================================================

import { prisma } from "@/lib/prisma";

export function monthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);
  return { start, end };
}

/// Ano/mês (1-12) de uma data no horário local.
export function yearMonthOf(date: Date): { year: number; month: number } {
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

/// Data de referência de um lançamento para fins de período (fechamento).
/// DEVE casar com a agregação (src/lib/financeSummary.ts → `paidAt ?? createdAt`):
/// se o guard de "período fechado" usar outra data, um lançamento sem `paidAt`
/// escapa do bloqueio e ainda é contado no mês.
export function financeReferenceDate(
  paidAt: Date | string | null | undefined,
  createdAt: Date | string
): Date {
  return paidAt ? new Date(paidAt) : new Date(createdAt);
}

/// Verdadeiro se existe fechamento para o (year, month) da empresa.
export async function isPeriodClosed(
  establishmentId: string,
  date: Date
): Promise<boolean> {
  const { year, month } = yearMonthOf(date);
  const closing = await prisma.periodClosing.findUnique({
    where: { establishmentId_year_month: { establishmentId, year, month } },
  });
  return !!closing;
}
