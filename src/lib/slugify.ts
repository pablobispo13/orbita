// =============================================================================
// Normalização de slug — função PURA (sem Prisma), segura para o cliente.
// Usada tanto no servidor (validação) quanto na UI (preview ao digitar).
// =============================================================================

/// Normaliza um texto em slug: minúsculas, sem acentos, só [a-z0-9-].
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
