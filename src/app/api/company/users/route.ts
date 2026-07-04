import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEstablishment, requirePermission, jsonError } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";

// Lista os usuários (membros) da EMPRESA ativa — escopo via x-establishment-id.
// Qualquer membro com acesso à empresa pode ver a equipe.
export async function GET(req: NextRequest) {
  const { ctx, response } = await requireEstablishment(req);
  if (response) return response;

  const memberships = await prisma.membership.findMany({
    where: { establishmentId: ctx.establishmentId },
    orderBy: { createdAt: "asc" },
    select: {
      role: true,
      user: {
        select: { id: true, name: true, email: true, active: true, mustChangePassword: true },
      },
      customRole: { select: { name: true } },
    },
  });

  const users = memberships.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
    active: m.user.active,
    mustChangePassword: m.user.mustChangePassword,
    establishmentRole: m.role, // ADMIN | STAFF
    roleName: m.customRole?.name ?? null,
  }));

  return NextResponse.json({ users });
}

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  // Cargo (Role) opcional atribuído ao membro. Deve pertencer à empresa.
  customRoleId: z.string().nullable().optional(),
});

// Adiciona um membro (funcionário) à empresa ativa. Exige MEMBER_MANAGE.
// Se o e-mail já existir, apenas cria o vínculo; senão cria o usuário com uma
// senha temporária (retornada uma vez) e mustChangePassword=true.
export async function POST(req: NextRequest) {
  const { ctx, response } = await requirePermission(req, PERMISSIONS.MEMBER_MANAGE);
  if (response) return response;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonError("Dados inválidos", 400);

  const { name, email, customRoleId } = parsed.data;

  // Valida o cargo (se informado) — precisa ser da própria empresa.
  if (customRoleId) {
    const role = await prisma.role.findUnique({ where: { id: customRoleId } });
    if (!role || role.establishmentId !== ctx.establishmentId) {
      return jsonError("Cargo inválido para esta empresa", 400);
    }
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  // Usuário já existe: apenas vincula à empresa (se ainda não for membro).
  if (existing) {
    const already = await prisma.membership.findUnique({
      where: {
        userId_establishmentId: {
          userId: existing.id,
          establishmentId: ctx.establishmentId,
        },
      },
    });
    if (already) return jsonError("Este usuário já é membro da empresa", 409);

    await prisma.membership.create({
      data: {
        userId: existing.id,
        establishmentId: ctx.establishmentId,
        role: "STAFF",
        customRoleId: customRoleId ?? null,
      },
    });

    return NextResponse.json(
      { linked: true, user: { id: existing.id, name: existing.name, email: existing.email } },
      { status: 201 }
    );
  }

  // Usuário novo: cria com senha temporária + vínculo, em transação.
  const generatedPassword = randomBytes(8).toString("base64url");
  const hashed = await bcrypt.hash(generatedPassword, 10);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { name, email, password: hashed, role: "USER", mustChangePassword: true },
    });
    await tx.membership.create({
      data: {
        userId: created.id,
        establishmentId: ctx.establishmentId,
        role: "STAFF",
        customRoleId: customRoleId ?? null,
      },
    });
    return created;
  });

  return NextResponse.json(
    {
      linked: false,
      user: { id: user.id, name: user.name, email: user.email },
      generatedPassword, // repassar ao funcionário — troca obrigatória no 1º login
    },
    { status: 201 }
  );
}
