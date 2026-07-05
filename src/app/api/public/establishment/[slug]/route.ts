import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRoute } from "@/lib/http";

// Endpoint PÚBLICO (sem auth): resolve um slug de empresa para exibir a
// identidade dela na tela de login específica (/[slug]).
// Retorna apenas dados não-sensíveis.
export const GET = withRoute(async (
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) => {
  const { slug } = await params;

  const establishment = await prisma.establishment.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, active: true },
  });

  if (!establishment || !establishment.active) {
    return NextResponse.json({ message: "Empresa não encontrada" }, { status: 404 });
  }

  // O id não é sensível: qualquer rota protegida ainda exige JWT válido +
  // membership (ou SUPER_ADMIN). Ele é necessário para o super admin definir
  // a empresa ativa ao acessar via /[slug] sem possuir vínculo.
  return NextResponse.json({
    establishment: {
      id: establishment.id,
      name: establishment.name,
      slug: establishment.slug,
    },
  });
});
