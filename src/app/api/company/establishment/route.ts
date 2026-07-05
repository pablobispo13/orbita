import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEstablishment, requirePermission, jsonError, zodError } from "@/lib/auth";
import { withRoute } from "@/lib/http";
import { PERMISSIONS } from "@/lib/permissions";
import { resolveEditableSlug } from "@/lib/slug";

// Dados da empresa ATIVA (escopo via x-establishment-id). Qualquer membro lê.
export const GET = withRoute(async (req: NextRequest) => {
  const { ctx, response } = await requireEstablishment(req);
  if (response) return response;

  const establishment = await prisma.establishment.findUnique({
    where: { id: ctx.establishmentId },
    select: {
      id: true,
      name: true,
      slug: true,
      document: true,
      phone: true,
      address: true,
      active: true,
    },
  });

  return NextResponse.json({ establishment });
});

// Edição dos dados da própria empresa pelo dono/gestor. Exige ESTABLISHMENT_MANAGE.
// Não permite inativar (ativar/inativar é exclusivo do super admin) nem trocar o slug.
const updateSchema = z
  .object({
    name: z.string().min(2, "O nome da empresa deve ter ao menos 2 caracteres").optional(),
    // URL pública (slug). Normalizada e validada como única no handler.
    slug: z.string().optional(),
    document: z.string().trim().nullable().optional(),
    phone: z.string().trim().nullable().optional(),
    address: z.string().trim().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nada para atualizar" });

export const PATCH = withRoute(async (req: NextRequest) => {
  const { ctx, response } = await requirePermission(req, PERMISSIONS.ESTABLISHMENT_MANAGE);
  if (response) return response;

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const { name, slug: slugInput, document, phone, address } = parsed.data;

  // Troca da URL pública: normaliza e garante unicidade.
  let newSlug: string | undefined;
  if (slugInput !== undefined) {
    const res = await resolveEditableSlug(slugInput, ctx.establishmentId);
    if (res.error) return jsonError(res.error, 409);
    newSlug = res.slug;
  }

  const establishment = await prisma.establishment.update({
    where: { id: ctx.establishmentId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(newSlug ? { slug: newSlug } : {}),
      ...(document !== undefined ? { document: document || null } : {}),
      ...(phone !== undefined ? { phone: phone || null } : {}),
      ...(address !== undefined ? { address: address || null } : {}),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      document: true,
      phone: true,
      address: true,
      active: true,
    },
  });

  return NextResponse.json({ establishment });
});
