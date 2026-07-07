import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, jsonError, zodError } from "@/lib/auth";
import { withRoute } from "@/lib/http";
import { PERMISSIONS } from "@/lib/permissions";
import { ruleSummary } from "@/lib/notificationRules";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z
  .object({
    enabled: z.boolean().optional(),
    audience: z.enum(["MANAGERS", "ALL_MEMBERS"]).optional(),
    intervalMinutes: z.number().int().min(5).max(10080).nullable().optional(),
    dailyMinutes: z.number().int().min(0).max(1439).nullable().optional(),
    threshold: z.number().nullable().optional(),
    titleTemplate: z.string().trim().max(200).nullable().optional(),
    bodyTemplate: z.string().trim().max(500).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nada para atualizar" });

// Edita uma regra (ex.: ativar/desativar, ajustar horário). ESTABLISHMENT_MANAGE.
export const PATCH = withRoute(async (req: NextRequest, { params }: Ctx) => {
  const { ctx, response } = await requirePermission(req, PERMISSIONS.ESTABLISHMENT_MANAGE);
  if (response) return response;

  const { id } = await params;
  const current = await prisma.notificationRule.findFirst({
    where: { id, establishmentId: ctx.establishmentId },
  });
  if (!current) return jsonError("Regra não encontrada", 404);

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  // Só aceita a config do agendamento coerente com o gatilho da regra.
  if (d.intervalMinutes !== undefined && current.trigger !== "INTERVAL") {
    return jsonError("Esta regra não usa intervalo.", 400);
  }
  if (d.dailyMinutes !== undefined && current.trigger !== "DAILY") {
    return jsonError("Esta regra não usa horário diário.", 400);
  }
  if (d.threshold !== undefined && current.kind !== "LOW_PROFIT") {
    return jsonError("Esta regra não usa meta de lucro.", 400);
  }

  const rule = await prisma.notificationRule.update({
    where: { id },
    data: {
      ...(d.enabled !== undefined ? { enabled: d.enabled } : {}),
      ...(d.audience !== undefined ? { audience: d.audience } : {}),
      ...(d.intervalMinutes !== undefined ? { intervalMinutes: d.intervalMinutes } : {}),
      ...(d.dailyMinutes !== undefined ? { dailyMinutes: d.dailyMinutes } : {}),
      ...(d.threshold !== undefined ? { threshold: d.threshold } : {}),
      ...(d.titleTemplate !== undefined ? { titleTemplate: d.titleTemplate || null } : {}),
      ...(d.bodyTemplate !== undefined ? { bodyTemplate: d.bodyTemplate || null } : {}),
    },
  });
  return NextResponse.json({ rule: { ...rule, label: ruleSummary(rule) } });
});

// Exclui uma regra (ESTABLISHMENT_MANAGE).
export const DELETE = withRoute(async (req: NextRequest, { params }: Ctx) => {
  const { ctx, response } = await requirePermission(req, PERMISSIONS.ESTABLISHMENT_MANAGE);
  if (response) return response;

  const { id } = await params;
  const current = await prisma.notificationRule.findFirst({
    where: { id, establishmentId: ctx.establishmentId },
    select: { id: true },
  });
  if (!current) return jsonError("Regra não encontrada", 404);

  await prisma.notificationRule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
