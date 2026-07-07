// =============================================================================
// Paginação padronizada das rotas de listagem.
//
// COMPATÍVEL COM A UI ATUAL: a paginação é OPT-IN. Sem os parâmetros `page`/
// `pageSize` na query, `parsePagination` retorna null e a rota devolve a lista
// inteira como antes (a UI que agrega no cliente segue funcionando). Quando o
// cliente envia `?page=&pageSize=`, a rota devolve a página + metadados em
// `pagination`. Sempre inclua a chave da lista (ex.: `products`) para retrocompat.
// =============================================================================

import type { NextRequest } from "next/server";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export type Pagination = { page: number; pageSize: number; skip: number; take: number };
export type PageMeta = { page: number; pageSize: number; total: number; totalPages: number };

/// Lê `page`/`pageSize` da query. Retorna null se nenhum foi enviado (=> a rota
/// devolve tudo, comportamento legado). Valores são saneados (>=1, teto MAX).
export function parsePagination(req: NextRequest): Pagination | null {
  const sp = req.nextUrl.searchParams;
  if (!sp.has("page") && !sp.has("pageSize")) return null;

  const page = Math.max(1, toInt(sp.get("page"), 1));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, toInt(sp.get("pageSize"), DEFAULT_PAGE_SIZE)));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

/// Monta os metadados da página para a resposta.
export function pageMeta(p: Pagination, total: number): PageMeta {
  return {
    page: p.page,
    pageSize: p.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / p.pageSize)),
  };
}

function toInt(v: string | null, fallback: number): number {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
}
