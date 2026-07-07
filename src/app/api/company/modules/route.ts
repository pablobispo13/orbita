import { NextRequest, NextResponse } from "next/server";
import { requireEstablishment } from "@/lib/auth";
import { withRoute } from "@/lib/http";

// Módulos ativos da empresa em contexto (x-establishment-id). Usado pela UI para
// filtrar os itens de menu — só exibe as telas de módulos habilitados. Qualquer
// membro da empresa (ou super admin) pode consultar; o gate real é por rota.
export const GET = withRoute(async (req: NextRequest) => {
  const { ctx, response } = await requireEstablishment(req);
  if (response) return response;
  return NextResponse.json({ modules: ctx.modules });
});
