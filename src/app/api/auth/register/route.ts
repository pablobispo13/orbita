import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, jsonError, zodError } from "@/lib/auth";
import { withRoute } from "@/lib/http";
import { uniqueEstablishmentSlug } from "@/lib/slug";

// Onboarding de um DONO + empresa. Apenas o SUPER_ADMIN pode criar tenants
// (mesma política do CP1.3); não é auto-cadastro público. O dono definido aqui
// entra com a senha informada e faz login normalmente depois.
const schema = z.object({
  name: z.string().min(2, "O nome deve ter ao menos 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "A senha deve ter ao menos 6 caracteres"),
  establishmentName: z.string().min(2, "O nome da empresa deve ter ao menos 2 caracteres"),
});

export const POST = withRoute(async (req: NextRequest) => {
  // Só o SUPER_ADMIN pode registrar novos donos/empresas.
  const auth = requireAuth(req);
  if (auth.response) return auth.response;
  if (auth.user.role !== "SUPER_ADMIN") {
    return jsonError("Apenas o super admin pode criar empresas.", 403);
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const { name, email, password, establishmentName } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return jsonError("E-mail já cadastrado", 400);

  const hashed = await bcrypt.hash(password, 10);

  // Slug único para a empresa.
  const slug = await uniqueEstablishmentSlug(establishmentName);

  // User + Establishment + Membership de forma atômica (evita registros órfãos).
  const establishment = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email, password: hashed, role: "USER" },
    });
    const est = await tx.establishment.create({
      data: { name: establishmentName, slug, ownerId: user.id },
    });
    await tx.membership.create({
      data: { userId: user.id, establishmentId: est.id, role: "ADMIN" },
    });
    return est;
  });

  return NextResponse.json(
    {
      user: { name, email },
      establishment: { id: establishment.id, name: establishment.name, slug: establishment.slug },
    },
    { status: 201 }
  );
});
