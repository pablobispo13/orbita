// =============================================================================
// Geração de slug para empresas (rota /{slug}). Estável: uma vez gerado, não
// é regerado ao renomear a empresa (o slug é o identificador de rota).
// =============================================================================

import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";

export { slugify };

/// Gera um slug único para Establishment a partir de um nome, evitando colisões
/// (`empresa`, `empresa-2`, `empresa-3`...).
export async function uniqueEstablishmentSlug(name: string): Promise<string> {
  const base = slugify(name) || "empresa";
  let slug = base;
  let n = 1;
  while (await prisma.establishment.findUnique({ where: { slug } })) {
    slug = `${base}-${++n}`;
  }
  return slug;
}

/// Resolve o slug desejado a partir de uma entrada do usuário, garantindo que
/// esteja normalizado e livre. Ignora a própria empresa (`exceptId`).
/// Retorna o slug válido, ou uma mensagem de erro para a UI.
export async function resolveEditableSlug(
  input: string,
  exceptId: string
): Promise<{ slug: string; error?: never } | { slug?: never; error: string }> {
  const slug = slugify(input);
  if (slug.length < 2) {
    return { error: "A URL pública deve ter ao menos 2 caracteres (letras/números)." };
  }
  const existing = await prisma.establishment.findUnique({ where: { slug } });
  if (existing && existing.id !== exceptId) {
    return { error: "Essa URL pública já está em uso por outra empresa." };
  }
  return { slug };
}
