// =============================================================================
// Regras de notificação programadas (Fase 6). Server-side.
//
// Uma regra combina GATILHO + CONTEÚDO + PÚBLICO (ver schema NotificationRule):
//   - EVENT_SALE  → dispara na hora, a cada venda      (fireSaleEvent)
//   - INTERVAL    → a cada N minutos                    (cron → runScheduledRules)
//   - DAILY       → todo dia num horário (hora do servidor)  (idem)
//
// Conteúdo (kind): SALE_EVENT (aviso de venda), SALES_SUMMARY (resumo do período),
// LOW_STOCK (insumos no/abaixo do mínimo). Cada disparo cria uma notificação
// in-app (sino) e envia Web Push ao público-alvo.
// =============================================================================

import { prisma } from "@/lib/prisma";
import {
  notify,
  establishmentManagerIds,
  establishmentMemberIds,
} from "@/lib/notifications";
import { sendPushToUsers } from "@/lib/push";
import { NOTIFICATION_TYPES, type NotificationType } from "@/lib/notificationTypes";
import type { NotificationRule } from "@prisma/client";

const round2 = (v: number) => Math.round(v * 100) / 100;
const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const hm = (d: Date) =>
  d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

// -----------------------------------------------------------------------------
// Due-logic (PURA e testável): a regra agendada está "vencida" agora?
// -----------------------------------------------------------------------------

export type DueInput = {
  trigger: NotificationRule["trigger"];
  intervalMinutes: number | null;
  dailyMinutes: number | null;
  lastRunAt: Date | null;
};

export function isRuleDue(rule: DueInput, now: Date): boolean {
  if (rule.trigger === "INTERVAL") {
    if (!rule.intervalMinutes || rule.intervalMinutes <= 0) return false;
    if (!rule.lastRunAt) return true;
    return now.getTime() - rule.lastRunAt.getTime() >= rule.intervalMinutes * 60_000;
  }
  if (rule.trigger === "DAILY") {
    if (rule.dailyMinutes == null) return false;
    // Horário-alvo de hoje (hora do servidor).
    const target = new Date(now);
    target.setHours(0, 0, 0, 0);
    target.setMinutes(rule.dailyMinutes);
    if (now < target) return false;
    // Dispara uma vez por dia: só se ainda não rodou depois do alvo de hoje.
    return !rule.lastRunAt || rule.lastRunAt < target;
  }
  return false; // EVENT_SALE não é agendado (dispara por evento)
}

// -----------------------------------------------------------------------------
// Envio (in-app + push) para o público-alvo da regra.
// -----------------------------------------------------------------------------

/// Substitui `{token}` pelas variáveis fornecidas (deixa intactos os desconhecidos).
function render(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) =>
    Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : `{${k}}`
  );
}

/// Variáveis disponíveis por tipo de conteúdo (para a UI orientar o template).
export const TEMPLATE_VARS: Record<NotificationRule["kind"], string[]> = {
  SALE_EVENT: ["valor", "item"],
  SALES_SUMMARY: ["qtd", "total", "desde"],
  LOW_STOCK: ["qtd", "itens"],
  LOW_PROFIT: ["lucro", "meta"],
};

async function dispatch(
  rule: NotificationRule,
  msg: { title: string; message: string; type: NotificationType },
  vars: Record<string, string> = {}
): Promise<void> {
  // Usa os templates da regra quando definidos; senão, o texto padrão.
  const title = rule.titleTemplate ? render(rule.titleTemplate, vars) : msg.title;
  const message = rule.bodyTemplate ? render(rule.bodyTemplate, vars) : msg.message;

  await notify({
    establishmentId: rule.establishmentId,
    type: msg.type,
    title,
    message,
  });
  const userIds =
    rule.audience === "ALL_MEMBERS"
      ? await establishmentMemberIds(rule.establishmentId)
      : await establishmentManagerIds(rule.establishmentId);
  await sendPushToUsers(userIds, { title, body: message, tag: `rule-${rule.id}` });
}

// -----------------------------------------------------------------------------
// Evento: nova venda. Chamado (fire-and-forget) por /api/sales e pelo
// fechamento de comanda. Dispara todas as regras EVENT_SALE ativas da empresa.
// -----------------------------------------------------------------------------

export async function fireSaleEvent(
  establishmentId: string,
  sale: { amount: number; label?: string }
): Promise<void> {
  const rules = await prisma.notificationRule.findMany({
    where: { establishmentId, enabled: true, trigger: "EVENT_SALE", kind: "SALE_EVENT" },
  });
  const valor = brl(round2(sale.amount));
  for (const rule of rules) {
    await dispatch(
      rule,
      {
        title: "Nova venda",
        message: `${sale.label ? sale.label + " — " : ""}${valor}`,
        type: NOTIFICATION_TYPES.GENERIC,
      },
      { valor, item: sale.label ?? "" }
    );
  }
}

// -----------------------------------------------------------------------------
// Execução do conteúdo de uma regra agendada. Retorna se algo foi enviado
// (resumo vazio / sem estoque baixo => não envia, para não gerar ruído).
// -----------------------------------------------------------------------------

function fallbackSince(rule: NotificationRule, now: Date): Date {
  const mins = rule.trigger === "INTERVAL" ? rule.intervalMinutes ?? 60 : 24 * 60;
  return new Date(now.getTime() - mins * 60_000);
}

export async function executeRule(rule: NotificationRule, now = new Date()): Promise<boolean> {
  if (rule.kind === "SALES_SUMMARY") {
    const since = rule.lastRunAt ?? fallbackSince(rule, now);
    const txs = await prisma.transaction.findMany({
      where: {
        establishmentId: rule.establishmentId,
        type: "INCOME",
        createdAt: { gte: since, lte: now },
      },
      select: { amount: true },
    });
    if (txs.length === 0) return false;
    const total = round2(txs.reduce((s, t) => s + t.amount, 0));
    await dispatch(
      rule,
      {
        title: "Resumo de vendas",
        message: `${txs.length} venda(s) somando ${brl(total)} desde ${hm(since)}.`,
        type: NOTIFICATION_TYPES.PROFIT_REPORT,
      },
      { qtd: String(txs.length), total: brl(total), desde: hm(since) }
    );
    return true;
  }

  if (rule.kind === "LOW_STOCK") {
    // Prisma/Mongo não compara dois campos no where → filtra em memória.
    const items = await prisma.stockItem.findMany({
      where: { establishmentId: rule.establishmentId },
    });
    const low = items.filter((i) => i.quantity <= i.minLevel && (i.minLevel > 0 || i.quantity <= 0));
    if (low.length === 0) return false;
    const list = low
      .slice(0, 10)
      .map((i) => `${i.name}: ${i.quantity} ${i.unit} (mín ${i.minLevel})`)
      .join("; ");
    const itens = `${list}${low.length > 10 ? "…" : ""}`;
    await dispatch(
      rule,
      {
        title: "Estoque baixo",
        message: `${low.length} insumo(s) no/abaixo do mínimo — ${itens}`,
        type: NOTIFICATION_TYPES.GENERIC,
      },
      { qtd: String(low.length), itens }
    );
    return true;
  }

  if (rule.kind === "LOW_PROFIT") {
    // Lucro do DIA (referência: paidAt ?? createdAt, como agregação/fechamento).
    if (rule.threshold == null) return false;
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const txs = await prisma.transaction.findMany({
      where: {
        establishmentId: rule.establishmentId,
        OR: [
          { paidAt: { gte: dayStart, lte: now } },
          { paidAt: null, createdAt: { gte: dayStart, lte: now } },
        ],
      },
      select: { type: true, amount: true },
    });
    let profit = 0;
    for (const t of txs) profit += t.type === "INCOME" ? t.amount : -t.amount;
    profit = round2(profit);
    if (profit >= rule.threshold) return false; // meta atingida: não alerta
    await dispatch(
      rule,
      {
        title: "Lucro do dia abaixo da meta",
        message: `Lucro de hoje: ${brl(profit)} (meta: ${brl(rule.threshold)}).`,
        type: NOTIFICATION_TYPES.PROFIT_REPORT,
      },
      { lucro: brl(profit), meta: brl(rule.threshold) }
    );
    return true;
  }

  return false; // SALE_EVENT só faz sentido por evento
}

// -----------------------------------------------------------------------------
// Núcleo do cron: avalia todas as regras agendadas e dispara as vencidas.
// Atualiza lastRunAt mesmo quando nada é enviado (respeita a janela/1x-por-dia).
// -----------------------------------------------------------------------------

export async function runScheduledRules(
  now = new Date()
): Promise<{ evaluated: number; due: number; fired: number }> {
  const rules = await prisma.notificationRule.findMany({
    where: { enabled: true, trigger: { in: ["INTERVAL", "DAILY"] } },
  });
  let due = 0;
  let fired = 0;
  for (const rule of rules) {
    if (!isRuleDue(rule, now)) continue;
    due++;
    const sent = await executeRule(rule, now);
    await prisma.notificationRule.update({ where: { id: rule.id }, data: { lastRunAt: now } });
    if (sent) fired++;
  }
  return { evaluated: rules.length, due, fired };
}

// -----------------------------------------------------------------------------
// Rótulo legível de uma regra (UI).
// -----------------------------------------------------------------------------

const KIND_LABEL: Record<NotificationRule["kind"], string> = {
  SALE_EVENT: "Aviso de nova venda",
  SALES_SUMMARY: "Resumo de vendas",
  LOW_STOCK: "Estoque baixo",
  LOW_PROFIT: "Lucro do dia abaixo da meta",
};

export function ruleSummary(rule: {
  kind: NotificationRule["kind"];
  trigger: NotificationRule["trigger"];
  intervalMinutes: number | null;
  dailyMinutes: number | null;
}): string {
  const what = KIND_LABEL[rule.kind];
  if (rule.trigger === "EVENT_SALE") return `${what} · a cada venda`;
  if (rule.trigger === "INTERVAL") {
    const m = rule.intervalMinutes ?? 0;
    const when = m % 60 === 0 ? `${m / 60}h` : `${m}min`;
    return `${what} · a cada ${when}`;
  }
  const total = rule.dailyMinutes ?? 0;
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${what} · todo dia às ${hh}:${mm}`;
}
