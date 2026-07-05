import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { withRoute } from "@/lib/http";

export const GET = withRoute(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth.response) return auth.response;

  const user = await prisma.user.findUnique({
    where: { id: auth.user.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      mustChangePassword: true,
      memberships: {
        select: {
          role: true,
          establishment: { select: { id: true, name: true, slug: true } },
          customRole: { select: { id: true, name: true, permissions: true } },
        },
      },
    },
  });

  if (!user) return NextResponse.json({ message: "Usuário não encontrado" }, { status: 401 });

  return NextResponse.json({ user });
});
