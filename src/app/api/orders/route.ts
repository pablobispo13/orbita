import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireModule, jsonError, zodError } from "@/lib/auth";
import { withRoute } from "@/lib/http";
import { PERMISSIONS } from "@/lib/permissions";
import { MODULES } from "@/lib/modules";
import { nextOrderNumber } from "@/lib/orders";
import { parsePagination, pageMeta } from "@/lib/pagination";

// Lista comandas da empresa ativa (módulo Comanda + ORDER_READ). `?status=OPEN`
// (padrão) filtra por situação; use `all` para todas. Paginação opt-in via
// `?page=&pageSize=` (sem eles mantém o teto legado de 100, p/ salão e KDS).
export const GET = withRoute(async (req: NextRequest) => {
  const { ctx, response } = await requireModule(req, MODULES.COMANDA, PERMISSIONS.ORDER_READ);
  if (response) return response;

  const status = req.nextUrl.searchParams.get("status") ?? "OPEN";
  const where: { establishmentId: string; status?: "OPEN" | "CLOSED" | "CANCELLED" } = {
    establishmentId: ctx.establishmentId,
  };
  if (status === "OPEN" || status === "CLOSED" || status === "CANCELLED") {
    where.status = status;
  }

  // `?items=1` inclui os itens (usado pela cozinha/KDS) e ordena da mais antiga
  // para a mais nova (fila de preparo).
  const withItems = req.nextUrl.searchParams.get("items") === "1";
  const pg = parsePagination(req);

  const orders = await prisma.order.findMany({
    where,
    orderBy: { openedAt: withItems ? "asc" : "desc" },
    skip: pg?.skip,
    take: pg ? pg.take : 100,
    include: {
      table: { select: { id: true, name: true } },
      _count: { select: { items: true } },
      ...(withItems ? { items: { orderBy: { createdAt: "asc" as const } } } : {}),
    },
  });
  if (pg) {
    const total = await prisma.order.count({ where });
    return NextResponse.json({ orders, pagination: pageMeta(pg, total) });
  }
  return NextResponse.json({ orders });
});

const createSchema = z.object({
  type: z.enum(["TABLE", "COUNTER", "DELIVERY"]).default("TABLE"),
  tableId: z.string().min(1).nullable().optional(),
  customerName: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

// Abre uma comanda (módulo Comanda + ORDER_WRITE). Para mesa, exige mesa livre.
export const POST = withRoute(async (req: NextRequest) => {
  const { ctx, response } = await requireModule(req, MODULES.COMANDA, PERMISSIONS.ORDER_WRITE);
  if (response) return response;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const { type, tableId, customerName, note } = parsed.data;

  if (type === "TABLE") {
    if (!tableId) return jsonError("Selecione a mesa da comanda.", 400);
    const table = await prisma.table.findFirst({
      where: { id: tableId, establishmentId: ctx.establishmentId },
    });
    if (!table) return jsonError("Mesa não encontrada", 404);
    const open = await prisma.order.findFirst({
      where: { tableId, status: "OPEN" },
      select: { id: true },
    });
    if (open) return jsonError("Já existe uma comanda aberta nesta mesa.", 409);
  }

  const number = await nextOrderNumber(ctx.establishmentId);
  const order = await prisma.order.create({
    data: {
      number,
      type,
      status: "OPEN",
      tableId: type === "TABLE" ? tableId! : null,
      customerName: customerName || null,
      note: note || null,
      total: 0,
      establishmentId: ctx.establishmentId,
    },
    include: { table: { select: { id: true, name: true } }, items: true },
  });
  return NextResponse.json({ order }, { status: 201 });
});
