import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, jsonError } from "@/lib/auth";

// Rota exclusiva do SUPER_ADMIN: enxerga TODAS as empresas da plataforma.
export async function GET(req: NextRequest) {
  const { user, response } = requireAuth(req);
  if (response) return response;
  if (user.role !== "SUPER_ADMIN") return jsonError("Acesso restrito", 403);

  const establishments = await prisma.establishment.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { memberships: true, products: true, stockItems: true } },
    },
  });

  return NextResponse.json({ establishments });
}
