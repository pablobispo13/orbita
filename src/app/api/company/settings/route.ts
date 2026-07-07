import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEstablishment, requirePermission, zodError } from "@/lib/auth";
import { withRoute } from "@/lib/http";
import { PERMISSIONS } from "@/lib/permissions";
import {
  resolveSettings,
  mergeSettings,
  HEX_COLOR,
  RADIUS_CHOICES,
  DENSITY_CHOICES,
  FONT_CHOICES,
  COMPANY_MENU_KEYS,
  type CompanySettings,
} from "@/lib/settings";

// Configurações da EMPRESA ativa (Fase 6). Leitura por qualquer membro (a UI
// aplica o tema); escrita apenas com ESTABLISHMENT_MANAGE (dono/gestor).
// Módulos NÃO entram aqui (ficam sob o super admin em /api/admin/.../modules).

// Lê as configurações resolvidas (defaults + overrides gravados).
export const GET = withRoute(async (req: NextRequest) => {
  const { ctx, response } = await requireEstablishment(req);
  if (response) return response;

  const est = await prisma.establishment.findUnique({
    where: { id: ctx.establishmentId },
    select: { settings: true },
  });
  return NextResponse.json({ settings: resolveSettings(est?.settings) });
});

// Cor hex opcional e anulável (null limpa o override, voltando ao padrão do tema).
const hex = z
  .string()
  .regex(HEX_COLOR, "Use uma cor no formato #rrggbb")
  .nullable();

const patchSchema = z
  .object({
    appearance: z
      .object({
        brand: hex.optional(),
        accent: hex.optional(),
        lightBrand: hex.optional(),
        lightAccent: hex.optional(),
        bg: hex.optional(),
        lightBg: hex.optional(),
        text: hex.optional(),
        lightText: hex.optional(),
        success: hex.optional(),
        warning: hex.optional(),
        danger: hex.optional(),
        radius: z.enum(RADIUS_CHOICES).nullable().optional(),
        density: z.enum(DENSITY_CHOICES).nullable().optional(),
        font: z.enum(FONT_CHOICES).nullable().optional(),
      })
      .optional(),
    operations: z
      .object({
        stockEntryCreatesExpense: z.boolean().optional(),
      })
      .optional(),
    navigation: z
      .object({
        hidden: z.array(z.enum(COMPANY_MENU_KEYS)).optional(),
        order: z.array(z.enum(COMPANY_MENU_KEYS)).optional(),
      })
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nada para atualizar" });

// Atualiza (merge parcial) as configurações.
//   - `appearance`: EXCLUSIVA do SUPER_ADMIN (identidade visual do sistema).
//   - `operations`: dono/gestor com ESTABLISHMENT_MANAGE.
export const PATCH = withRoute(async (req: NextRequest) => {
  const { ctx, response } = await requirePermission(req, PERMISSIONS.ESTABLISHMENT_MANAGE);
  if (response) return response;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  if (parsed.data.appearance && !ctx.isSuperAdmin) {
    return NextResponse.json(
      { message: "Apenas o super admin pode alterar a aparência." },
      { status: 403 }
    );
  }

  const est = await prisma.establishment.findUnique({
    where: { id: ctx.establishmentId },
    select: { settings: true },
  });
  const current: CompanySettings = resolveSettings(est?.settings);
  const next = mergeSettings(current, parsed.data);

  await prisma.establishment.update({
    where: { id: ctx.establishmentId },
    data: { settings: next },
  });

  return NextResponse.json({ settings: next });
});
