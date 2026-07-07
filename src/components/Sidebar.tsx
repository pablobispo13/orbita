"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuthContext } from "@/context/AuthContext";
import { MODULES, type ModuleKey } from "@/lib/modules";
import type { NavigationSettings } from "@/lib/settings";

export type ViewKey =
  | "dashboard"
  | "empresas"
  | "minhas-empresas"
  | "config-empresa"
  | "usuarios"
  | "cargos"
  | "modulos"
  | "produtos"
  | "categorias"
  | "estoque"
  | "financeiro"
  | "gastos-fixos"
  | "simulacao"
  | "relatorios"
  | "comanda"
  | "cozinha"
  | "seguranca";
export type ShellMode = "platform" | "company";

// `module`: item pertence a um módulo plugável — só aparece se ele estiver
// habilitado na empresa (ver src/lib/modules.ts).
type NavItem = { key: ViewKey; label: string; icon: string; module?: ModuleKey };
// `multiCompany`: só aparece para usuário comum com 2+ empresas.
type NavGroup = { label: string; items: NavItem[]; superAdmin?: boolean; multiCompany?: boolean };

// Menu do contexto PLATAFORMA (/dashboard) — gestão da plataforma.
const PLATFORM_GROUPS: NavGroup[] = [
  { label: "Geral", items: [{ key: "dashboard", label: "Dashboard", icon: "🏠" }] },
  {
    label: "Minhas empresas",
    multiCompany: true,
    items: [{ key: "minhas-empresas", label: "Minhas Empresas", icon: "🏢" }],
  },
  {
    label: "Plataforma",
    superAdmin: true,
    items: [
      { key: "empresas", label: "Empresas", icon: "🏢" },
      { key: "usuarios", label: "Usuários", icon: "👥" },
    ],
  },
];

// Menu do contexto EMPRESA (/{slug}/dashboard) — operação da empresa,
// agrupado por categoria: dia a dia (Operação), catálogo/insumos (Cadastros),
// dinheiro (Financeiro) e administração.
const COMPANY_GROUPS: NavGroup[] = [
  {
    label: "Geral",
    items: [{ key: "dashboard", label: "Dashboard", icon: "🏠" }],
  },
  {
    label: "Operação",
    items: [
      // Itens de módulos plugáveis — filtrados pelos módulos ativos da empresa.
      { key: "comanda", label: "Comanda & Mesas", icon: "🧾", module: MODULES.COMANDA },
      { key: "cozinha", label: "Cozinha", icon: "👨‍🍳", module: MODULES.COMANDA },
    ],
  },
  {
    label: "Cadastros",
    items: [
      { key: "produtos", label: "Produtos", icon: "🍕", module: MODULES.PRODUCTS },
      { key: "categorias", label: "Categorias", icon: "🏷️", module: MODULES.PRODUCTS },
      { key: "estoque", label: "Estoque", icon: "📦", module: MODULES.STOCK },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { key: "financeiro", label: "Lançamentos", icon: "💰", module: MODULES.FINANCE },
      { key: "gastos-fixos", label: "Gastos fixos", icon: "🏭", module: MODULES.FINANCE },
      { key: "simulacao", label: "Simulação", icon: "🧮", module: MODULES.PRODUCTS },
      { key: "relatorios", label: "Relatórios", icon: "📊", module: MODULES.FINANCE },
    ],
  },
  {
    label: "Configurações",
    items: [
      { key: "config-empresa", label: "Empresa", icon: "🏢" },
      { key: "cargos", label: "Cargos", icon: "🛡️" },
      { key: "usuarios", label: "Usuários", icon: "👥" },
    ],
  },
  {
    label: "Administração",
    superAdmin: true,
    items: [{ key: "modulos", label: "Módulos", icon: "🧩" }],
  },
];

// Configurações base expostas por empresa no submenu do super admin.
const COMPANY_CONFIG_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: "🏠" },
  { key: "modulos", label: "Módulos", icon: "🧩" },
  { key: "config-empresa", label: "Empresa", icon: "🏢" },
  { key: "cargos", label: "Cargos", icon: "🛡️" },
  { key: "usuarios", label: "Usuários", icon: "👥" },
];

type CompanyRef = { id: string; name: string; slug: string };

// Um item de módulo só é permitido se o módulo estiver ativo. `enabledModules`
// nulo = ainda não carregado: não bloqueia (evita "chutar" a view antes da hora).
function itemAllowedByModule(item: NavItem, enabledModules?: ModuleKey[] | null): boolean {
  if (!item.module) return true;
  if (enabledModules == null) return true;
  return enabledModules.includes(item.module);
}

export function viewsForMode(
  mode: ShellMode,
  isSuperAdmin: boolean,
  multiCompany = false,
  enabledModules?: ModuleKey[] | null
): ViewKey[] {
  const groups = mode === "company" ? COMPANY_GROUPS : PLATFORM_GROUPS;
  const keys = groups
    .filter((g) => (!g.superAdmin || isSuperAdmin) && (!g.multiCompany || multiCompany))
    .flatMap((g) => g.items.filter((i) => itemAllowedByModule(i, enabledModules)).map((i) => i.key));
  // "Segurança" é da conta do usuário — disponível em qualquer contexto.
  return [...keys, "seguranca"];
}

export function Sidebar({
  open,
  mode,
  view,
  onSelect,
  onEnterCompany,
  onLogout,
  onClose,
  mounted = true,
  enabledModules = null,
  navigation = null,
}: {
  open: boolean;
  mode: ShellMode;
  view: ViewKey;
  onSelect: (v: ViewKey) => void;
  // Navega para dentro de uma empresa num view específico (super admin).
  onEnterCompany: (company: CompanyRef, view: ViewKey) => void;
  // Sobrescreve o comportamento de logout (ex.: voltar ao login da empresa).
  onLogout?: () => void;
  onClose: () => void;
  mounted?: boolean;
  // Módulos ativos da empresa (contexto company). Filtra os itens de módulo.
  enabledModules?: ModuleKey[] | null;
  // Estrutura de tela da empresa (Fase 6): itens ocultos e ordem personalizada.
  navigation?: NavigationSettings | null;
}) {
  const { user, logout } = useAuthContext();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const multiCompany = !isSuperAdmin && (user?.memberships?.length ?? 0) >= 2;

  // Ordem personalizada: itens listados em `order` vêm primeiro (na ordem
  // salva); os demais mantêm a posição padrão do grupo.
  const rank = (key: string, defaultIdx: number): number => {
    const i = navigation?.order.indexOf(key as NavigationSettings["order"][number]) ?? -1;
    return i >= 0 ? i : (navigation?.order.length ?? 0) + defaultIdx;
  };

  const groups = (mode === "company" ? COMPANY_GROUPS : PLATFORM_GROUPS)
    .filter((g) => (!g.superAdmin || isSuperAdmin) && (!g.multiCompany || multiCompany))
    .map((g) => ({
      ...g,
      items: g.items
        .filter((i) => itemAllowedByModule(i, enabledModules))
        .filter((i) => !navigation?.hidden.includes(i.key as NavigationSettings["hidden"][number]))
        .map((item, idx) => ({ item, idx }))
        .sort((a, b) => rank(a.item.key, a.idx) - rank(b.item.key, b.idx))
        .map(({ item }) => item),
    }))
    .filter((g) => g.items.length > 0);

  // Lista de empresas para o submenu do super admin (só no contexto plataforma).
  const [companies, setCompanies] = useState<CompanyRef[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const showCompanyTree = mode === "platform" && isSuperAdmin;

  useEffect(() => {
    if (!showCompanyTree) return;
    api
      .get<{ establishments: CompanyRef[] }>("/admin/establishments", { silent: true })
      .then(({ data }) =>
        setCompanies(
          data.establishments.map((e) => ({ id: e.id, name: e.name, slug: e.slug }))
        )
      )
      .catch(() => {});
  }, [showCompanyTree]);

  const groupLabelStyle = {
    color: "var(--text-muted)",
  } as const;

  const panel = (
    <div className="flex h-full flex-col">
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group.label} className="space-y-1">
            <div
              className="px-3 text-[10px] font-semibold uppercase tracking-wider"
              style={groupLabelStyle}
            >
              {group.label}
            </div>
            {group.items.map((item) => {
              const activeLink = view === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => onSelect(item.key)}
                  className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition text-left"
                  style={{
                    background: activeLink ? "var(--brand-soft)" : "transparent",
                    color: activeLink ? "var(--brand-text)" : "var(--text)",
                  }}
                >
                  <span aria-hidden>{item.icon}</span>
                  {item.label}
                </button>
              );
            })}
          </div>
        ))}

        {/* Árvore de empresas (super admin): cada empresa abre suas configs base */}
        {showCompanyTree && (
          <div className="space-y-1">
            <div
              className="px-3 text-[10px] font-semibold uppercase tracking-wider"
              style={groupLabelStyle}
            >
              Empresas
            </div>
            {companies.length === 0 ? (
              <div className="px-3 py-2 text-xs" style={{ color: "var(--text-muted)" }}>
                Nenhuma empresa.
              </div>
            ) : (
              companies.map((company) => {
                const isOpen = expanded === company.id;
                return (
                  <div key={company.id}>
                    <button
                      onClick={() => setExpanded(isOpen ? null : company.id)}
                      className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition text-left"
                      style={{ color: "var(--text)" }}
                    >
                      <span
                        aria-hidden
                        className="inline-block w-3 text-xs transition-transform"
                        style={{ transform: isOpen ? "rotate(90deg)" : "none" }}
                      >
                        ▶
                      </span>
                      <span aria-hidden>🏢</span>
                      <span className="truncate">{company.name}</span>
                    </button>
                    {isOpen && (
                      <div
                        className="ml-4 border-l pl-2 space-y-0.5"
                        style={{ borderColor: "var(--border)" }}
                      >
                        {COMPANY_CONFIG_ITEMS.map((item) => (
                          <button
                            key={item.key}
                            onClick={() => onEnterCompany(company, item.key)}
                            className="w-full flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition text-left hover:bg-white/5"
                            style={{ color: "var(--text-muted)" }}
                          >
                            <span aria-hidden>{item.icon}</span>
                            {item.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </nav>

      {/* Segurança: último item, ancorado logo acima dos dados do usuário/logout. */}
      <div className="px-3 pb-2">
        <button
          onClick={() => onSelect("seguranca")}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition text-left"
          style={{
            background: view === "seguranca" ? "var(--brand-soft)" : "transparent",
            color: view === "seguranca" ? "var(--brand-text)" : "var(--text)",
          }}
        >
          <span aria-hidden>🔒</span>
          Segurança
        </button>
      </div>

      <div className="border-t p-3 space-y-2" style={{ borderColor: "var(--border)" }}>
        <div className="px-2 pb-1">
          <div className="text-sm font-medium truncate">{user?.name}</div>
          <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
            {user?.email}
          </div>
        </div>
        <button
          onClick={onLogout ?? logout}
          className="w-full rounded-lg border px-3 py-2 text-sm hover:bg-white/5"
          style={{ borderColor: "var(--border-strong)" }}
        >
          Sair
        </button>
      </div>
    </div>
  );

  if (!open) return null;

  return (
    <>
      {/* Coluna fixa no desktop (abaixo da topbar) */}
      <aside
        className="hidden md:flex md:w-64 md:flex-col md:shrink-0 border-r sticky top-14 self-start h-[calc(100vh-3.5rem)]"
        style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
      >
        {panel}
      </aside>

      {/* Drawer sobreposto no mobile (só após montar, evita flash no SSR) */}
      {mounted && (
        <div className="md:hidden fixed top-14 bottom-0 inset-x-0 z-30 flex">
          <div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={onClose}
          />
          <aside
            className="relative w-64 border-r"
            style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
          >
            {panel}
          </aside>
        </div>
      )}
    </>
  );
}
