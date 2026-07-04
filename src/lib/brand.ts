// =============================================================================
// Identidade da marca (white-label).
// O sistema NÃO depende estruturalmente do nome "Órbita": o nome exibido e o
// slogan vêm de variáveis de ambiente. Quem revende o projeto define as suas
// (NEXT_PUBLIC_APP_NAME / NEXT_PUBLIC_APP_TAGLINE) — sem tocar no código.
// Prefixo NEXT_PUBLIC_ => disponível tanto no servidor quanto no cliente.
// =============================================================================

/// Nome comercial exibido na UI (topbar, login, título da aba, docs).
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Órbita";

/// Slogan/descrição curta usada no título da aba e na landing.
export const APP_TAGLINE =
  process.env.NEXT_PUBLIC_APP_TAGLINE?.trim() || "Gestão multi-empresa";
