import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule, zodError } from "@/lib/auth";
import { withRoute } from "@/lib/http";
import { PERMISSIONS } from "@/lib/permissions";
import { MODULES } from "@/lib/modules";
import { parsePagination, pageMeta } from "@/lib/pagination";

// Lista as mesas da empresa ativa, com a comanda aberta (se houver) para a UI
// mostrar status livre/ocupada (módulo Comanda + ORDER_READ). Paginação opt-in.
export const GET = withRoute(async (req: NextRequest) => {
  const { ctx, response } = await requireModule(req, MODULES.COMANDA, PERMISSIONS.ORDER_READ);
  if (response) return response;

  const where = { establishmentId: ctx.establishmentId };
  const pg = parsePagination(req);
  const tables = await prisma.table.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      orders: {
        where: { status: "OPEN" },
        select: { id: true, number: true, total: true, openedAt: true },
      },
    },
    ...(pg ? { skip: pg.skip, take: pg.take } : {}),
  });
  if (pg) {
    const total = await prisma.table.count({ where });
    return NextResponse.json({ tables, pagination: pageMeta(pg, total) });
  }
  return NextResponse.json({ tables });
});

const createSchema = z.object({
  name: z.string().min(1, "Informe o nome/número da mesa"),
  seats: z.number().int().positive("Capacidade inválida").nullable().optional(),
  active: z.boolean().default(true),
});

// Cadastra uma mesa (módulo Comanda + ORDER_WRITE).
export const POST = withRoute(async (req: NextRequest) => {
  const { ctx, response } = await requireModule(req, MODULES.COMANDA, PERMISSIONS.ORDER_WRITE);
  if (response) return response;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const table = await prisma.table.create({
    data: {
      name: parsed.data.name.trim(),
      seats: parsed.data.seats ?? null,
      active: parsed.data.active,
      establishmentId: ctx.establishmentId,
    },
  });
  return NextResponse.json({ table }, { status: 201 });
});
