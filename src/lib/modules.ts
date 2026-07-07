// =============================================================================
// Catálogo de MÓDULOS do sistema (ferramentas plugáveis por empresa).
//
// Cada módulo é uma "ferramenta" que o SUPER_ADMIN pode habilitar/desabilitar
// por empresa (ver EstablishmentModule no schema + ModulosView na UI). Um módulo
// desligado some do menu da empresa E tem suas rotas bloqueadas (requireModule).
//
// Este arquivo é a ÚNICA fonte de verdade: liga chave do módulo → permissões
// (src/lib/permissions.ts) e → telas expostas (ViewKey da Sidebar). Módulos de
// GESTÃO (empresa/cargos/usuários) NÃO são módulos: são o núcleo, sempre ativo.
//
// Persistência: só gravamos OVERRIDES em EstablishmentModule. Uma empresa sem
// linha para um módulo usa o `defaultEnabled` do catálogo — assim empresas
// antigas (sem linhas) continuam funcionando e novos módulos entram por padrão.
// =============================================================================

import { PERMISSIONS, type Permission } from "@/lib/permissions";

export const MODULES = {
  PRODUCTS: "products",
  STOCK: "stock",
  FINANCE: "finance",
  COMANDA: "comanda",
} as const;

export type ModuleKey = (typeof MODULES)[keyof typeof MODULES];

export type ModuleDef = {
  key: ModuleKey;
  label: string;
  description: string;
  icon: string;
  /// Permissões que pertencem a este módulo (ver src/lib/permissions.ts).
  permissions: Permission[];
  /// Chaves de tela (ViewKey) que este módulo adiciona ao menu da empresa.
  views: string[];
  /// Se o SUPER_ADMIN pode desligar o módulo. Módulos de núcleo seriam `false`.
  removable: boolean;
  /// Estado do módulo numa empresa que ainda não tem override gravado.
  defaultEnabled: boolean;
};

export const MODULE_CATALOG: ModuleDef[] = [
  {
    key: MODULES.PRODUCTS,
    label: "Produtos",
    description: "Catálogo de itens vendáveis (pizzas, bebidas) com preço e categoria.",
    icon: "🍕",
    permissions: [PERMISSIONS.PRODUCT_READ, PERMISSIONS.PRODUCT_WRITE],
    views: ["produtos", "categorias", "simulacao"],
    removable: true,
    defaultEnabled: true,
  },
  {
    key: MODULES.STOCK,
    label: "Estoque",
    description: "Insumos, quantidades, custo, estoque mínimo e movimentações.",
    icon: "📦",
    permissions: [PERMISSIONS.STOCK_READ, PERMISSIONS.STOCK_WRITE],
    views: ["estoque"],
    removable: true,
    defaultEnabled: true,
  },
  {
    key: MODULES.FINANCE,
    label: "Financeiro",
    description: "Lançamentos de receitas e despesas, fluxo de caixa e relatórios.",
    icon: "💰",
    permissions: [PERMISSIONS.FINANCE_READ, PERMISSIONS.FINANCE_WRITE],
    views: ["financeiro", "gastos-fixos", "relatorios"],
    removable: true,
    defaultEnabled: true,
  },
  {
    key: MODULES.COMANDA,
    label: "Comanda & Mesas",
    description: "Mesas, comandas, lançamento de itens (PDV) e painel da cozinha.",
    icon: "🧾",
    permissions: [PERMISSIONS.ORDER_READ, PERMISSIONS.ORDER_WRITE],
    views: ["comanda", "cozinha"],
    removable: true,
    defaultEnabled: true,
  },
];

const MODULE_BY_KEY = new Map<string, ModuleDef>(
  MODULE_CATALOG.map((m) => [m.key, m])
);

export function isModuleKey(key: string): key is ModuleKey {
  return MODULE_BY_KEY.has(key);
}

export function getModule(key: string): ModuleDef | undefined {
  return MODULE_BY_KEY.get(key);
}

/// Chaves de todos os módulos (na ordem do catálogo).
export const MODULE_KEYS: ModuleKey[] = MODULE_CATALOG.map((m) => m.key);

/// Módulos ligados por padrão (para uma empresa sem overrides gravados).
export const DEFAULT_ENABLED_MODULES: ModuleKey[] = MODULE_CATALOG.filter(
  (m) => m.defaultEnabled
).map((m) => m.key);

/// Resolve os módulos EFETIVAMENTE ativos combinando os overrides gravados
/// (EstablishmentModule) com os padrões do catálogo. `overrides` é o mapa
/// moduleKey → enabled vindo do banco; módulos sem linha caem no `defaultEnabled`.
export function resolveEnabledModules(
  overrides: { moduleKey: string; enabled: boolean }[]
): ModuleKey[] {
  const map = new Map(overrides.map((o) => [o.moduleKey, o.enabled]));
  return MODULE_CATALOG.filter((m) =>
    map.has(m.key) ? map.get(m.key)! : m.defaultEnabled
  ).map((m) => m.key);
}
