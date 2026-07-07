import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, jsonError, zodError } from "@/lib/auth";
import { withRoute } from "@/lib/http";
import {
  MODULE_CATALOG,
  getModule,
  isModuleKey,
  resolveEnabledModules,
} from "@/lib/modules";

type Ctx = { params: Promise<{ id: string }> };

// Estado dos módulos de uma empresa (super admin): catálogo + se cada um está
// ativo (override gravado ou padrão do catálogo).
export const GET = withRoute(async (req: NextRequest, { params }: Ctx) => {
  const { user, response } = requireAuth(req);
  if (response) return response;
  if (user.role !== "SUPER_ADMIN") return jsonError("Acesso restrito", 403);

  const { id } = await params;
  const establishment = await prisma.establishment.findUnique({ where: { id } });
  if (!establishment) return jsonError("Empresa não encontrada", 404);

  const overrides = await prisma.establishmentModule.findMany({
    where: { establishmentId: id },
    select: { moduleKey: true, enabled: true },
  });
  const enabled = new Set(resolveEnabledModules(overrides));

  const modules = MODULE_CATALOG.map((m) => ({
    key: m.key,
    label: m.label,
    description: m.description,
    icon: m.icon,
    removable: m.removable,
    enabled: enabled.has(m.key),
  }));

  return NextResponse.json({ modules });
});

// Liga/desliga módulos de uma empresa (super admin). Aceita uma lista parcial de
// alterações; grava overrides via upsert. Módulos não-removíveis não podem ser
// desligados.
const patchSchema = z.object({
  modules: z
    .array(
      z.object({
        key: z.string().min(1),
        enabled: z.boolean(),
      })
    )
    .min(1, "Informe ao menos um módulo para alterar"),
});

export const PATCH = withRoute(async (req: NextRequest, { params }: Ctx) => {
  const { user, response } = requireAuth(req);
  if (response) return response;
  if (user.role !== "SUPER_ADMIN") return jsonError("Acesso restrito", 403);

  const { id } = await params;
  const establishment = await prisma.establishment.findUnique({ where: { id } });
  if (!establishment) return jsonError("Empresa não encontrada", 404);

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  // Valida antes de gravar: chaves conhecidas + respeitar `removable`.
  for (const change of parsed.data.modules) {
    const def = getModule(change.key);
    if (!isModuleKey(change.key) || !def) {
      return jsonError(`Módulo desconhecido: ${change.key}`, 400);
    }
    if (!change.enabled && !def.removable) {
      return jsonError(`O módulo "${def.label}" não pode ser desligado.`, 400);
    }
  }

  for (const change of parsed.data.modules) {
    await prisma.establishmentModule.upsert({
      where: {
        establishmentId_moduleKey: { establishmentId: id, moduleKey: change.key },
      },
      create: { establishmentId: id, moduleKey: change.key, enabled: change.enabled },
      update: { enabled: change.enabled },
    });
  }

  const overrides = await prisma.establishmentModule.findMany({
    where: { establishmentId: id },
    select: { moduleKey: true, enabled: true },
  });
  const enabled = new Set(resolveEnabledModules(overrides));

  const modules = MODULE_CATALOG.map((m) => ({
    key: m.key,
    label: m.label,
    description: m.description,
    icon: m.icon,
    removable: m.removable,
    enabled: enabled.has(m.key),
  }));

  return NextResponse.json({ modules });
});
