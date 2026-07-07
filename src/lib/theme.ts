// =============================================================================
// Injeção de tema por empresa em runtime (Fase 6, client-side).
// Aplica os overrides de cor das configurações da empresa (src/lib/settings.ts)
// como CSS custom properties no `:root`, sobre os design tokens de globals.css.
// É THEME-AWARE: reaplica quando o usuário alterna claro/escuro (observa o
// atributo data-theme no <html>), para hover/soft/text ficarem coerentes.
// =============================================================================

import { type CompanySettings, settingsToCssVars } from "@/lib/settings";

// CSS vars que o tema por empresa pode sobrescrever (limpas antes de reaplicar).
const MANAGED_VARS = [
  "--brand",
  "--brand-hover",
  "--brand-soft",
  "--brand-text",
  "--accent",
  "--accent-soft",
  "--bg",
  "--bg-elevated",
  "--surface",
  "--border",
  "--border-strong",
  "--text",
  "--text-muted",
  "--success",
  "--warning",
  "--danger",
  "--radius-card",
  "--radius-control",
  "--font-scale",
  "--font-body",
  "--font-display",
];

let current: CompanySettings | null = null;
let observing = false;

function isDark(): boolean {
  if (typeof document === "undefined") return true;
  return document.documentElement.getAttribute("data-theme") !== "light";
}

function paint(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const v of MANAGED_VARS) root.style.removeProperty(v);
  if (!current) return;
  for (const [k, val] of Object.entries(settingsToCssVars(current, { dark: isDark() }))) {
    root.style.setProperty(k, val);
  }
}

// Reaplica ao alternar o tema (o ThemeToggle troca data-theme no <html>).
function ensureThemeObserver(): void {
  if (observing || typeof document === "undefined") return;
  observing = true;
  new MutationObserver(paint).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
}

/// Aplica os overrides da empresa no documento. Passe as configs resolvidas.
export function applyCompanyTheme(settings: CompanySettings): void {
  current = settings;
  paint();
  ensureThemeObserver();
}

/// Remove todos os overrides (volta aos tokens padrão) — ex.: ao sair da empresa.
export function clearCompanyTheme(): void {
  current = null;
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const v of MANAGED_VARS) root.style.removeProperty(v);
}
