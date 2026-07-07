// =============================================================================
// Catálogo de permissões do sistema.
// O ADMIN de cada empresa monta cargos (Role) escolhendo entre estas chaves.
// Armazenadas como String[] em Role.permissions (portável Mongo/Postgres).
// =============================================================================

export const PERMISSIONS = {
  // Gestão do estabelecimento / RBAC
  ESTABLISHMENT_MANAGE: "establishment:manage",
  ROLE_MANAGE: "role:manage",
  MEMBER_MANAGE: "member:manage",

  // Produtos
  PRODUCT_READ: "product:read",
  PRODUCT_WRITE: "product:write",

  // Estoque
  STOCK_READ: "stock:read",
  STOCK_WRITE: "stock:write",

  // Financeiro
  FINANCE_READ: "finance:read",
  FINANCE_WRITE: "finance:write",

  // Comanda & Mesas (operação / PDV)
  ORDER_READ: "order:read",
  ORDER_WRITE: "order:write",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/// Todas as permissões (usado como conjunto do ADMIN dono da empresa).
export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

/// Agrupamento pronto para exibir na UI de criação de cargos.
export const PERMISSION_GROUPS: {
  label: string;
  permissions: { key: Permission; label: string }[];
}[] = [
  {
    label: "Gestão",
    permissions: [
      { key: PERMISSIONS.ESTABLISHMENT_MANAGE, label: "Gerenciar empresa" },
      { key: PERMISSIONS.ROLE_MANAGE, label: "Gerenciar cargos" },
      { key: PERMISSIONS.MEMBER_MANAGE, label: "Gerenciar funcionários" },
    ],
  },
  {
    label: "Produtos",
    permissions: [
      { key: PERMISSIONS.PRODUCT_READ, label: "Ver produtos" },
      { key: PERMISSIONS.PRODUCT_WRITE, label: "Editar produtos" },
    ],
  },
  {
    label: "Estoque",
    permissions: [
      { key: PERMISSIONS.STOCK_READ, label: "Ver estoque" },
      { key: PERMISSIONS.STOCK_WRITE, label: "Movimentar estoque" },
    ],
  },
  {
    label: "Financeiro",
    permissions: [
      { key: PERMISSIONS.FINANCE_READ, label: "Ver financeiro" },
      { key: PERMISSIONS.FINANCE_WRITE, label: "Lançar financeiro" },
    ],
  },
  {
    label: "Comanda & Mesas",
    permissions: [
      { key: PERMISSIONS.ORDER_READ, label: "Ver comandas e mesas" },
      { key: PERMISSIONS.ORDER_WRITE, label: "Abrir, lançar e fechar comandas" },
    ],
  },
];
