import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule, jsonError } from "@/lib/auth";
import { withRoute } from "@/lib/http";
import { PERMISSIONS } from "@/lib/permissions";
import { MODULES } from "@/lib/modules";

type Ctx = { params: Promise<{ id: string }> };

// Detalhe de uma comanda com itens e mesa (módulo Comanda + ORDER_READ).
export const GET = withRoute(async (req: NextRequest, { params }: Ctx) => {
  const { ctx, response } = await requireModule(req, MODULES.COMANDA, PERMISSIONS.ORDER_READ);
  if (response) return response;

  const { id } = await params;
  const order = await prisma.order.findFirst({
    where: { id, establishmentId: ctx.establishmentId },
    include: {
      table: { select: { id: true, name: true } },
      items: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) return jsonError("Comanda não encontrada", 404);
  return NextResponse.json({ order });
});
