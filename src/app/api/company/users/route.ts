import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEstablishment } from "@/lib/auth";

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
