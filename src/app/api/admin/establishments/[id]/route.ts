import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, jsonError, zodError } from "@/lib/auth";
import { withRoute } from "@/lib/http";
import { resolveEditableSlug } from "@/lib/slug";

type Ctx = { params: Promise<{ id: string }> };

// Detalhes de uma empresa (super admin).
export const GET = withRoute(async (req: NextRequest, { params }: Ctx) => {
  const { user, response } = requireAuth(req);
  if (response) return response;
  if (user.role !== "SUPER_ADMIN") return jsonError("Acesso restrito", 403);

  const { id } = await params;
  const establishment = await prisma.establishment.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { memberships: true, products: true, stockItems: true } },
    },
  });
  if (!establishment) return jsonError("Empresa não encontrada", 404);

  return NextResponse.json({ establishment });
});

// Edição de dados + ativar/inativar + troca de dono (super admin). Slug NÃO é
// regerado ao renomear — é o identificador estável de rota.
const updateSchema = z
  .object({
    name: z.string().min(2, "O nome da empresa deve ter ao menos 2 caracteres").optional(),
    // URL pública (slug). Normalizada e validada como única no handler.
    slug: z.string().optional(),
    document: z.string().trim().nullable().optional(),
    phone: z.string().trim().nullable().optional(),
    address: z.string().trim().nullable().optional(),
    active: z.boolean().optional(),
    // Conjunto de donos da empresa (ids de usuários). Cada um vira ADMIN; quem
    // era dono e saiu da lista é rebaixado a STAFF. Precisa de ao menos 1.
    ownerIds: z.array(z.string().min(1)).min(1, "A empresa precisa de ao menos um dono").optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nada para atualizar" });

export const PATCH = withRoute(async (req: NextRequest, { params }: Ctx) => {
  const { user, response } = requireAuth(req);
  if (response) return response;
  if (user.role !== "SUPER_ADMIN") return jsonError("Acesso restrito", 403);

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const { name, slug: slugInput, document, phone, address, active, ownerIds } = parsed.data;

  const current = await prisma.establishment.findUnique({ where: { id } });
  if (!current) return jsonError("Empresa não encontrada", 404);

  // Troca da URL pública: normaliza e garante unicidade.
  let newSlug: string | undefined;
  if (slugInput !== undefined) {
    const res = await resolveEditableSlug(slugInput, id);
    if (res.error) return jsonError(res.error, 409);
    if (res.slug !== current.slug) newSlug = res.slug;
  }

  // Reconcilia o conjunto de donos (memberships ADMIN). Cada id vira ADMIN;
  // quem era ADMIN e saiu da lista volta a STAFF (mantém o vínculo, perde o
  // status de dono). O ownerId "primário" passa a ser o primeiro da lista.
  let primaryOwnerId: string | undefined;
  if (ownerIds) {
    const unique = [...new Set(ownerIds)];
    const users = await prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true } });
    if (users.length !== unique.length) {
      return jsonError("Um ou mais usuários selecionados não existem", 400);
    }

    const admins = await prisma.membership.findMany({
      where: { establishmentId: id, role: "ADMIN" },
      select: { id: true, userId: true },
    });
    const adminIds = new Set(admins.map((m) => m.userId));

    // Promove/insere os novos donos.
    for (const userId of unique) {
      if (adminIds.has(userId)) continue;
      const existing = await prisma.membership.findUnique({
        where: { userId_establishmentId: { userId, establishmentId: id } },
      });
      if (existing) {
        await prisma.membership.update({
          where: { id: existing.id },
          data: { role: "ADMIN", customRoleId: null },
        });
      } else {
        await prisma.membership.create({
          data: { userId, establishmentId: id, role: "ADMIN" },
        });
      }
    }

    // Rebaixa quem deixou de ser dono.
    const keep = new Set(unique);
    for (const m of admins) {
      if (!keep.has(m.userId)) {
        await prisma.membership.update({ where: { id: m.id }, data: { role: "STAFF" } });
      }
    }

    primaryOwnerId = unique[0];
  }

  const establishment = await prisma.establishment.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(newSlug ? { slug: newSlug } : {}),
      ...(document !== undefined ? { document: document || null } : {}),
      ...(phone !== undefined ? { phone: phone || null } : {}),
      ...(address !== undefined ? { address: address || null } : {}),
      ...(active !== undefined ? { active } : {}),
      ...(primaryOwnerId ? { ownerId: primaryOwnerId } : {}),
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      memberships: {
        where: { role: "ADMIN" },
        select: { user: { select: { id: true, name: true, email: true } } },
      },
      _count: { select: { memberships: true, products: true, stockItems: true } },
    },
  });

  return NextResponse.json({
    establishment: { ...establishment, owners: establishment.memberships.map((m) => m.user) },
  });
});
