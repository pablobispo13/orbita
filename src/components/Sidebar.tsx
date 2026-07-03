"use client";

import { useAuthContext } from "@/context/AuthContext";

export type ViewKey = "dashboard" | "empresas" | "usuarios";
export type ShellMode = "platform" | "company";

type NavItem = { key: ViewKey; label: string; icon: string };
type NavGroup = { label: string; items: NavItem[]; superAdmin?: boolean };

// Menu do contexto PLATAFORMA (/dashboard) — gestão da plataforma.
const PLATFORM_GROUPS: NavGroup[] = [
  { label: "Geral", items: [{ key: "dashboard", label: "Dashboard", icon: "🏠" }] },
  {
    label: "Plataforma",
    superAdmin: true,
    items: [
      { key: "empresas", label: "Empresas", icon: "🏢" },
      { key: "usuarios", label: "Usuários", icon: "👥" },
    ],
  },
];

// Menu do contexto EMPRESA (/{slug}/dashboard) — operação da empresa.
const COMPANY_GROUPS: NavGroup[] = [
  {
    label: "Empresa",
    items: [
      { key: "dashboard", label: "Dashboard", icon: "🏠" },
      { key: "usuarios", label: "Usuários", icon: "👥" },
    ],
  },
];

export function viewsForMode(mode: ShellMode, isSuperAdmin: boolean): ViewKey[] {
  const groups = mode === "company" ? COMPANY_GROUPS : PLATFORM_GROUPS;
  return groups
    .filter((g) => !g.superAdmin || isSuperAdmin)
    .flatMap((g) => g.items.map((i) => i.key));
}

export function Sidebar({
  open,
  mode,
  view,
  onSelect,
  onClose,
  mounted = true,
}: {
  open: boolean;
  mode: ShellMode;
  view: ViewKey;
  onSelect: (v: ViewKey) => void;
  onClose: () => void;
  mounted?: boolean;
}) {
  const { user, logout } = useAuthContext();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const groups = (mode === "company" ? COMPANY_GROUPS : PLATFORM_GROUPS).filter(
    (g) => !g.superAdmin || isSuperAdmin
  );

  const panel = (
    <div className="flex h-full flex-col">
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group.label} className="space-y-1">
            <div
              className="px-3 text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
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
      </nav>
      <div className="border-t p-3 space-y-2" style={{ borderColor: "var(--border)" }}>
        <div className="px-2 pb-1">
          <div className="text-sm font-medium truncate">{user?.name}</div>
          <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
            {user?.email}
          </div>
        </div>
        <button
          onClick={logout}
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
