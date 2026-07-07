import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEstablishment, requirePermission, zodError } from "@/lib/auth";
import { withRoute } from "@/lib/http";
import { PERMISSIONS } from "@/lib/permissions";
import { ruleSummary } from "@/lib/notificationRules";

// Regras de notificação da empresa ativa (Fase 6). Leitura por qualquer membro;
// criação apenas com ESTABLISHMENT_MANAGE (dono/gestor).

// Lista as regras (com um rótulo legível pronto para a UI).
export const GET = withRoute(async (req: NextRequest) => {
  const { ctx, response } = await requireEstablishment(req);
  if (response) return response;

  const rules = await prisma.notificationRule.findMany({
    where: { establishmentId: ctx.establishmentId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ rules: rules.map((r) => ({ ...r, label: ruleSummary(r) })) });
});

const createSchema = z
  .object({
    kind: z.enum(["SALE_EVENT", "SALES_SUMMARY", "LOW_STOCK", "LOW_PROFIT"]),
    trigger: z.enum(["EVENT_SALE", "INTERVAL", "DAILY"]),
    intervalMinutes: z.number().int().min(5, "Mínimo de 5 minutos").max(10080).nullable().optional(),
    dailyMinutes: z.number().int().min(0).max(1439).nullable().optional(),
    // Condição numérica (LOW_PROFIT: meta de lucro do dia, em R$).
    threshold: z.number().nullable().optional(),
    audience: z.enum(["MANAGERS", "ALL_MEMBERS"]).default("MANAGERS"),
    enabled: z.boolean().default(true),
    titleTemplate: z.string().trim().max(200).nullable().optional(),
    bodyTemplate: z.string().trim().max(500).nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "SALE_EVENT" && v.trigger !== "EVENT_SALE") {
      ctx.addIssue({ code: "custom", message: "Aviso de venda usa o gatilho 'a cada venda'.", path: ["trigger"] });
    }
    if (v.kind !== "SALE_EVENT" && v.trigger === "EVENT_SALE") {
      ctx.addIssue({ code: "custom", message: "Este conteúdo precisa de agendamento (intervalo ou diário).", path: ["trigger"] });
    }
    if (v.trigger === "INTERVAL" && !v.intervalMinutes) {
      ctx.addIssue({ code: "custom", message: "Informe o intervalo em minutos.", path: ["intervalMinutes"] });
    }
    if (v.trigger === "DAILY" && v.dailyMinutes == null) {
      ctx.addIssue({ code: "custom", message: "Informe o horário diário.", path: ["dailyMinutes"] });
    }
    if (v.kind === "LOW_PROFIT" && v.trigger !== "DAILY") {
      ctx.addIssue({ code: "custom", message: "O alerta de lucro é verificado uma vez por dia.", path: ["trigger"] });
    }
    if (v.kind === "LOW_PROFIT" && (v.threshold == null || !Number.isFinite(v.threshold))) {
      ctx.addIssue({ code: "custom", message: "Informe a meta de lucro do dia (R$).", path: ["threshold"] });
    }
  });

// Cria uma regra (ESTABLISHMENT_MANAGE).
export const POST = withRoute(async (req: NextRequest) => {
  const { ctx, response } = await requirePermission(req, PERMISSIONS.ESTABLISHMENT_MANAGE);
  if (response) return response;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const d = parsed.data;
  const rule = await prisma.notificationRule.create({
    data: {
      kind: d.kind,
      trigger: d.trigger,
      audience: d.audience,
      enabled: d.enabled,
      // Só guarda a config do agendamento relevante ao gatilho escolhido.
      intervalMinutes: d.trigger === "INTERVAL" ? d.intervalMinutes ?? null : null,
      dailyMinutes: d.trigger === "DAILY" ? d.dailyMinutes ?? null : null,
      threshold: d.kind === "LOW_PROFIT" ? d.threshold ?? null : null,
      titleTemplate: d.titleTemplate || null,
      bodyTemplate: d.bodyTemplate || null,
      establishmentId: ctx.establishmentId,
    },
  });
  return NextResponse.json({ rule: { ...rule, label: ruleSummary(rule) } }, { status: 201 });
});
