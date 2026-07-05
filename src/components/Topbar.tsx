"use client";

import { OrbitaLogo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationsBell } from "@/components/NotificationsBell";
import { CompanySwitcher } from "@/components/CompanySwitcher";
import { useAuthContext } from "@/context/AuthContext";

// Navbar superior fixa: controla o menu, o tema e (no contexto empresa) mostra
// o nome da empresa e o botão de sair dela. Com 2+ empresas, o nome vira um
// seletor de troca rápida.
export function Topbar({
  menuOpen,
  onToggleMenu,
  companyName,
  onExitCompany,
}: {
  menuOpen: boolean;
  onToggleMenu: () => void;
  companyName?: string | null;
  onExitCompany?: () => void;
}) {
  const { user } = useAuthContext();
  const multiCompany = (user?.memberships?.length ?? 0) >= 2;
  const inCompany = !!companyName;

  return (
    <header
      className="fixed top-0 inset-x-0 z-40 h-14 flex items-center justify-between px-3 sm:px-4 border-b"
      style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleMenu}
          aria-label={menuOpen ? "Fechar menu lateral" : "Abrir menu lateral"}
          title={menuOpen ? "Fechar menu" : "Abrir menu"}
          className="rounded-lg border w-9 h-9 flex items-center justify-center hover:bg-white/5 shrink-0"
          style={{ borderColor: "var(--border-strong)" }}
        >
          {menuOpen ? "✕" : "☰"}
        </button>
        <OrbitaLogo size={24} showWordmark={!companyName} />
        {inCompany && (
          <div className="flex items-center gap-2 min-w-0">
            <span style={{ color: "var(--text-muted)" }}>›</span>
            {multiCompany ? (
              <CompanySwitcher />
            ) : (
              <span className="font-display font-bold truncate">{companyName}</span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <NotificationsBell />
        {companyName && onExitCompany && (
          <button
            onClick={onExitCompany}
            className="rounded-lg border px-3 h-9 text-sm hover:bg-white/5 hidden sm:block"
            style={{ borderColor: "var(--border-strong)" }}
          >
            Sair da empresa
          </button>
        )}
        <ThemeToggle compact />
      </div>
    </header>
  );
}
