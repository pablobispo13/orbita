// =============================================================================
// Configurações da empresa (Fase 6) — personalizáveis pelo DONO (ADMIN).
//
// Fonte única da estrutura + defaults das configs por empresa, persistidas em
// Establishment.settings (JSON). NÃO inclui módulos (esses ficam em
// EstablishmentModule, sob o super admin). Client-safe (sem prisma): usado tanto
// na API quanto na UI (injeção de tema em runtime).
//
// Estratégia igual à dos módulos: guardamos só OVERRIDES; `resolveSettings`
// combina o que está gravado com os defaults, então empresas sem nada gravado
// (ou com JSON parcial/antigo) seguem funcionando.
// =============================================================================

/// Cor hexadecimal de 6 dígitos (#rrggbb). Vazio/nulo = usar o token padrão.
export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/// Raio dos cantos (forma dos componentes). null = padrão.
export const RADIUS_CHOICES = ["sharp", "normal", "rounded"] as const;
export type RadiusChoice = (typeof RADIUS_CHOICES)[number];

/// Densidade / tamanho da fonte (escala tipográfica global). null = padrão.
export const DENSITY_CHOICES = ["compact", "normal", "comfortable"] as const;
export type DensityChoice = (typeof DENSITY_CHOICES)[number];

/// Família tipográfica. null = padrão da marca (Space Grotesk + Inter).
export const FONT_CHOICES = ["system", "serif", "mono"] as const;
export type FontChoice = (typeof FONT_CHOICES)[number];

export type Appearance = {
  /// Cor de marca (--brand). Base: vale para os dois temas, salvo override claro.
  brand: string | null;
  /// Cor de destaque (--accent). Base.
  accent: string | null;
  /// Override da marca SÓ no tema claro (null = usa a base). Permite paleta
  /// diferente no claro vs escuro.
  lightBrand: string | null;
  /// Override do destaque só no tema claro.
  lightAccent: string | null;
  /// Cor de FUNDO do sistema no tema escuro (troca o roxo-preto). Painéis,
  /// cards e bordas são derivados dela. null = padrão.
  bg: string | null;
  /// Cor de fundo no tema claro. null = padrão.
  lightBg: string | null;
  /// Cor do TEXTO no tema escuro (o texto secundário é derivado). null = padrão.
  text: string | null;
  /// Cor do texto no tema claro. null = padrão.
  lightText: string | null;
  /// Cores semânticas (aplicam aos dois temas). null = padrão.
  success: string | null;
  warning: string | null;
  danger: string | null;
  /// Raio dos cantos dos componentes. null = padrão.
  radius: RadiusChoice | null;
  /// Densidade (escala da fonte). null = padrão.
  density: DensityChoice | null;
  /// Família tipográfica. null = padrão da marca.
  font: FontChoice | null;
};

/// Preferências de OPERAÇÃO da empresa (regras de negócio configuráveis).
export type Operations = {
  /// Entrada de estoque (movimento IN) gera despesa no Financeiro
  /// (quantidade × custo do insumo). Padrão: desligado.
  stockEntryCreatesExpense: boolean;
};

/// Itens de menu PERSONALIZÁVEIS pelo dono (ocultar/ordenar). Itens de núcleo
/// (dashboard, empresa, cargos, usuários, segurança) ficam sempre visíveis.
export const COMPANY_MENU_KEYS = [
  "comanda",
  "cozinha",
  "produtos",
  "categorias",
  "estoque",
  "financeiro",
  "gastos-fixos",
  "simulacao",
  "relatorios",
] as const;
export type CompanyMenuKey = (typeof COMPANY_MENU_KEYS)[number];

/// Estrutura de tela: visibilidade e ordem dos itens de menu da empresa.
export type NavigationSettings = {
  /// Itens ocultos do menu (cosmético — as rotas continuam acessíveis).
  hidden: CompanyMenuKey[];
  /// Ordem personalizada. Itens fora da lista mantêm a posição padrão, após os listados.
  order: CompanyMenuKey[];
};

export type CompanySettings = {
  appearance: Appearance;
  operations: Operations;
  navigation: NavigationSettings;
};

export const DEFAULT_SETTINGS: CompanySettings = {
  appearance: {
    brand: null,
    accent: null,
    lightBrand: null,
    lightAccent: null,
    bg: null,
    lightBg: null,
    text: null,
    lightText: null,
    success: null,
    warning: null,
    danger: null,
    radius: null,
    density: null,
    font: null,
  },
  operations: {
    stockEntryCreatesExpense: false,
  },
  navigation: {
    hidden: [],
    order: [],
  },
};

/// Sanitiza uma lista de chaves de menu (descarta desconhecidas e duplicadas).
function cleanMenuKeys(v: unknown): CompanyMenuKey[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: CompanyMenuKey[] = [];
  for (const k of v) {
    if (
      typeof k === "string" &&
      (COMPANY_MENU_KEYS as readonly string[]).includes(k) &&
      !seen.has(k)
    ) {
      seen.add(k);
      out.push(k as CompanyMenuKey);
    }
  }
  return out;
}

function cleanHex(v: unknown): string | null {
  return typeof v === "string" && HEX_COLOR.test(v) ? v.toLowerCase() : null;
}

function cleanRadius(v: unknown): RadiusChoice | null {
  return RADIUS_CHOICES.includes(v as RadiusChoice) ? (v as RadiusChoice) : null;
}

function cleanDensity(v: unknown): DensityChoice | null {
  return DENSITY_CHOICES.includes(v as DensityChoice) ? (v as DensityChoice) : null;
}

function cleanFont(v: unknown): FontChoice | null {
  return FONT_CHOICES.includes(v as FontChoice) ? (v as FontChoice) : null;
}

/// Combina o JSON gravado (parcial/desconhecido) com os defaults. Sempre retorna
/// um objeto completo e válido — valores inválidos caem no default.
export function resolveSettings(raw: unknown): CompanySettings {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const appearance = (obj.appearance ?? {}) as Record<string, unknown>;
  const operations = (obj.operations ?? {}) as Record<string, unknown>;
  return {
    appearance: {
      brand: cleanHex(appearance.brand),
      accent: cleanHex(appearance.accent),
      lightBrand: cleanHex(appearance.lightBrand),
      lightAccent: cleanHex(appearance.lightAccent),
      bg: cleanHex(appearance.bg),
      lightBg: cleanHex(appearance.lightBg),
      text: cleanHex(appearance.text),
      lightText: cleanHex(appearance.lightText),
      success: cleanHex(appearance.success),
      warning: cleanHex(appearance.warning),
      danger: cleanHex(appearance.danger),
      radius: cleanRadius(appearance.radius),
      density: cleanDensity(appearance.density),
      font: cleanFont(appearance.font),
    },
    operations: {
      stockEntryCreatesExpense: operations.stockEntryCreatesExpense === true,
    },
    navigation: {
      hidden: cleanMenuKeys((obj.navigation as Record<string, unknown> | undefined)?.hidden),
      order: cleanMenuKeys((obj.navigation as Record<string, unknown> | undefined)?.order),
    },
  };
}

/// Aplica um patch parcial sobre as configs atuais e devolve o objeto completo
/// a ser persistido. Campos ausentes no patch preservam o valor atual.
export function mergeSettings(
  current: CompanySettings,
  patch: DeepPartial<CompanySettings>
): CompanySettings {
  const p = patch.appearance;
  const o = patch.operations;
  return {
    appearance: {
      brand: p && "brand" in p ? cleanHex(p.brand) : current.appearance.brand,
      accent: p && "accent" in p ? cleanHex(p.accent) : current.appearance.accent,
      lightBrand: p && "lightBrand" in p ? cleanHex(p.lightBrand) : current.appearance.lightBrand,
      lightAccent: p && "lightAccent" in p ? cleanHex(p.lightAccent) : current.appearance.lightAccent,
      bg: p && "bg" in p ? cleanHex(p.bg) : current.appearance.bg,
      lightBg: p && "lightBg" in p ? cleanHex(p.lightBg) : current.appearance.lightBg,
      text: p && "text" in p ? cleanHex(p.text) : current.appearance.text,
      lightText: p && "lightText" in p ? cleanHex(p.lightText) : current.appearance.lightText,
      success: p && "success" in p ? cleanHex(p.success) : current.appearance.success,
      warning: p && "warning" in p ? cleanHex(p.warning) : current.appearance.warning,
      danger: p && "danger" in p ? cleanHex(p.danger) : current.appearance.danger,
      radius: p && "radius" in p ? cleanRadius(p.radius) : current.appearance.radius,
      density: p && "density" in p ? cleanDensity(p.density) : current.appearance.density,
      font: p && "font" in p ? cleanFont(p.font) : current.appearance.font,
    },
    operations: {
      stockEntryCreatesExpense:
        o && "stockEntryCreatesExpense" in o
          ? o.stockEntryCreatesExpense === true
          : current.operations.stockEntryCreatesExpense,
    },
    navigation: {
      hidden:
        patch.navigation && "hidden" in patch.navigation
          ? cleanMenuKeys(patch.navigation.hidden)
          : current.navigation.hidden,
      order:
        patch.navigation && "order" in patch.navigation
          ? cleanMenuKeys(patch.navigation.order)
          : current.navigation.order,
    },
  };
}

/// Converte as configs em overrides de CSS custom properties. É THEME-AWARE:
/// no tema escuro o hover/texto clareiam a marca; no claro, escurecem — como os
/// tokens de globals.css. Só inclui o que foi personalizado (o resto usa o padrão).
export function settingsToCssVars(
  s: CompanySettings,
  opts: { dark?: boolean } = {}
): Record<string, string> {
  const dark = opts.dark ?? true;
  const vars: Record<string, string> = {};
  // No tema claro, usa o override claro se houver; senão a base (que também
  // serve ao escuro). A derivação hover/soft/text continua theme-aware.
  const brand = dark ? s.appearance.brand : s.appearance.lightBrand ?? s.appearance.brand;
  const accent = dark ? s.appearance.accent : s.appearance.lightAccent ?? s.appearance.accent;

  if (brand) {
    vars["--brand"] = brand;
    vars["--brand-hover"] = dark ? lighten(brand, 0.14) : darken(brand, 0.14);
    vars["--brand-soft"] = hexToRgba(brand, dark ? 0.16 : 0.14);
    // Texto sobre fundos "soft": clarear bastante no escuro, escurecer no claro.
    vars["--brand-text"] = dark ? lighten(brand, 0.5) : darken(brand, 0.12);
  }
  if (accent) {
    vars["--accent"] = accent;
    vars["--accent-soft"] = hexToRgba(accent, dark ? 0.16 : 0.12);
  }

  // Fundo do sistema: painéis, cards e bordas derivam da cor escolhida.
  // No escuro, superfícies clareiam sobre o fundo; no claro, superfícies são
  // brancas e as bordas escurecem levemente o fundo.
  const bg = dark ? s.appearance.bg : s.appearance.lightBg;
  if (bg) {
    vars["--bg"] = bg;
    if (dark) {
      vars["--bg-elevated"] = lighten(bg, 0.05);
      vars["--surface"] = lighten(bg, 0.09);
      vars["--border"] = lighten(bg, 0.16);
      vars["--border-strong"] = lighten(bg, 0.26);
    } else {
      vars["--bg-elevated"] = "#ffffff";
      vars["--surface"] = "#ffffff";
      vars["--border"] = darken(bg, 0.06);
      vars["--border-strong"] = darken(bg, 0.13);
    }
  }

  // Cor do texto: o secundário (--text-muted) é derivado aproximando o texto
  // do fundo (escurece no tema escuro, clareia no claro).
  const text = dark ? s.appearance.text : s.appearance.lightText;
  if (text) {
    vars["--text"] = text;
    vars["--text-muted"] = dark ? darken(text, 0.32) : lighten(text, 0.35);
  }

  // Semânticas: aplicam aos dois temas.
  if (s.appearance.success) vars["--success"] = s.appearance.success;
  if (s.appearance.warning) vars["--warning"] = s.appearance.warning;
  if (s.appearance.danger) vars["--danger"] = s.appearance.danger;

  // Forma (raio) e densidade (escala da fonte) — não dependem do tema.
  if (s.appearance.radius) {
    const [card, control] = RADIUS_REM[s.appearance.radius];
    vars["--radius-card"] = card;
    vars["--radius-control"] = control;
  }
  if (s.appearance.density) {
    vars["--font-scale"] = FONT_SCALE[s.appearance.density];
  }
  if (s.appearance.font) {
    const stack = FONT_STACK[s.appearance.font];
    vars["--font-body"] = stack;
    vars["--font-display"] = stack;
  }
  return vars;
}

// Pilhas de fonte por escolha (sem carregar nada externo — usa fontes do sistema).
const FONT_STACK: Record<FontChoice, string> = {
  system: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, "Cascadia Code", "Courier New", monospace',
};

// [card, control] em rem para cada opção de raio.
const RADIUS_REM: Record<RadiusChoice, [string, string]> = {
  sharp: ["0.5rem", "0.375rem"],
  normal: ["1rem", "0.75rem"],
  rounded: ["1.5rem", "1.25rem"],
};

// Multiplicador da fonte-base (html font-size) por densidade.
const FONT_SCALE: Record<DensityChoice, string> = {
  compact: "0.9375",
  normal: "1",
  comfortable: "1.0625",
};

// --- helpers de cor (puros) --------------------------------------------------

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const toHex = (n: number) => Math.round(clamp(n)).toString(16).padStart(2, "0");
const clamp = (n: number) => Math.max(0, Math.min(255, n));

/// Mistura a cor com branco (clarear) por `amount` (0..1).
function lighten(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `#${toHex(r + (255 - r) * amount)}${toHex(g + (255 - g) * amount)}${toHex(b + (255 - b) * amount)}`;
}

/// Mistura a cor com preto (escurecer) por `amount` (0..1).
function darken(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `#${toHex(r * (1 - amount))}${toHex(g * (1 - amount))}${toHex(b * (1 - amount))}`;
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
