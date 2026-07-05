import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, jsonError, zodError } from "@/lib/auth";
import { withRoute } from "@/lib/http";
import { uniqueEstablishmentSlug } from "@/lib/slug";

// Rota exclusiva do SUPER_ADMIN: enxerga TODAS as empresas da plataforma.
export const GET = withRoute(async (req: NextRequest) => {
  const { user, response } = requireAuth(req);
  if (response) return response;
  if (user.role !== "SUPER_ADMIN") return jsonError("Acesso restrito", 403);

  const establishments = await prisma.establishment.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      // Donos = todos os membros com papel ADMIN (uma empresa pode ter vários).
      memberships: {
        where: { role: "ADMIN" },
        select: { user: { select: { id: true, name: true, email: true } } },
      },
      _count: { select: { memberships: true, products: true, stockItems: true } },
    },
  });

  return NextResponse.json({
    establishments: establishments.map((e) => ({
      ...e,
      owners: e.memberships.map((m) => m.user),
    })),
  });
});

// Criação de empresa pelo SUPER_ADMIN. O dono é definido de duas formas:
//   - ownerId: usuário JÁ existente escolhido na lista do sistema (preferido);
//   - ownerEmail: e-mail avulso — usa o usuário se existir, senão cria um novo
//     com senha temporária.
// O dono recebe um Membership ADMIN (todas as permissões da própria empresa).
const createSchema = z
  .object({
    name: z.string().min(2, "O nome da empresa deve ter ao menos 2 caracteres"),
    ownerId: z.string().min(1).optional(),
    ownerEmail: z.string().email("E-mail do dono inválido").optional(),
    ownerName: z.string().min(2, "O nome do dono deve ter ao menos 2 caracteres").optional(),
    document: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    address: z.string().trim().optional(),
  })
  .refine((d) => !!d.ownerId || !!d.ownerEmail, {
    message: "Selecione o dono ou informe um e-mail",
    path: ["ownerId"],
  });

export const POST = withRoute(async (req: NextRequest) => {
  const { user, response } = requireAuth(req);
  if (response) return response;
  if (user.role !== "SUPER_ADMIN") return jsonError("Acesso restrito", 403);

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const { name, ownerId, ownerEmail, ownerName, document, phone, address } = parsed.data;

  // Resolve o dono (id do usuário) — sem transação interativa, para funcionar
  // também em MongoDB standalone (mesmo padrão do register).
  let resolvedOwnerId: string;
  let ownerCreated = false;
  let generatedPassword: string | null = null;

  if (ownerId) {
    const owner = await prisma.user.findUnique({ where: { id: ownerId } });
    if (!owner) return jsonError("Usuário selecionado não encontrado", 400);
    resolvedOwnerId = owner.id;
  } else {
    const email = ownerEmail!; // garantido pelo refine
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      resolvedOwnerId = existing.id;
    } else {
      generatedPassword = randomBytes(8).toString("base64url");
      const hashed = await bcrypt.hash(generatedPassword, 10);
      const created = await prisma.user.create({
        data: {
          name: ownerName?.trim() || email.split("@")[0],
          email,
          password: hashed,
          role: "USER",
          mustChangePassword: true,
        },
      });
      resolvedOwnerId = created.id;
      ownerCreated = true;
    }
  }

  const slug = await uniqueEstablishmentSlug(name);

  const establishment = await prisma.establishment.create({
    data: {
      name,
      slug,
      document: document || null,
      phone: phone || null,
      address: address || null,
      ownerId: resolvedOwnerId,
    },
  });

  await prisma.membership.create({
    data: { userId: resolvedOwnerId, establishmentId: establishment.id, role: "ADMIN" },
  });

  return NextResponse.json(
    {
      establishment,
      ownerCreated,
      // Repassar ao dono — troca obrigatória no 1º login. Retornado só uma vez.
      generatedPassword,
    },
    { status: 201 }
  );
});
