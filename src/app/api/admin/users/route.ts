import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, jsonError } from "@/lib/auth";
import { withRoute } from "@/lib/http";

// Lista usuários da plataforma (apenas SUPER_ADMIN).
export const GET = withRoute(async (req: NextRequest) => {
  const { user, response } = requireAuth(req);
  if (response) return response;
  if (user.role !== "SUPER_ADMIN") return jsonError("Acesso restrito", 403);

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      mustChangePassword: true,
      memberships: {
        select: { role: true, establishment: { select: { name: true, slug: true } } },
      },
    },
  });

  return NextResponse.json({ users });
});
