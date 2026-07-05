// =============================================================================
// Tratamento de erros padronizado das rotas de API (CP2.3).
// `withRoute` embrulha um handler num try/catch único: mapeia erros conhecidos
// do Prisma (colisões, não-encontrado) para respostas limpas e loga o resto.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { jsonError } from "@/lib/auth";

/// Converte um erro em resposta HTTP. Erros inesperados => 500 + log.
export function handleRouteError(err: unknown): NextResponse {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002": // violação de unicidade
        return jsonError("Já existe um registro com esses dados.", 409);
      case "P2025": // registro não encontrado (update/delete)
        return jsonError("Registro não encontrado.", 404);
      case "P2003": // violação de chave estrangeira
        return jsonError("Operação viola um vínculo existente.", 409);
      default:
        console.error(`[api] Prisma ${err.code}:`, err.message);
        return jsonError("Erro ao acessar os dados.", 500);
    }
  }

  console.error("[api] erro inesperado:", err);
  return jsonError("Erro interno. Tente novamente.", 500);
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<NextResponse> | NextResponse;

/// Embrulha um handler de rota com o try/catch padronizado. `C` é inferido do
/// próprio handler (mantém o tipo dos params dinâmicos que o Next espera).
export function withRoute<C>(handler: Handler<C>) {
  return async (req: NextRequest, ctx: C): Promise<NextResponse> => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      return handleRouteError(err);
    }
  };
}
