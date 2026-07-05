"use client";

import { useEffect, useState } from "react";
import api, { handleLogout } from "@/lib/api";
import { useAuthContext } from "@/context/AuthContext";
import { Topbar } from "@/components/Topbar";
import { Sidebar, viewsForMode, type ViewKey, type ShellMode } from "@/components/Sidebar";
import { DashboardView } from "@/components/views/DashboardView";
import { EmpresasView } from "@/components/views/EmpresasView";
import { MinhasEmpresasView } from "@/components/views/MinhasEmpresasView";
import { UsuariosView } from "@/components/views/UsuariosView";
import { CompanyUsersView } from "@/components/views/CompanyUsersView";
import { CargosView } from "@/components/views/CargosView";
import { ConfiguracoesEmpresaView } from "@/components/views/ConfiguracoesEmpresaView";
import { SegurancaView } from "@/components/views/SegurancaView";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import { onNavigate } from "@/lib/navigation";

// Shell autenticado. Duas modalidades:
//  - platform (/dashboard): gestão da plataforma (super admin).
//  - company (/{slug}/dashboard): operação de uma empresa específica.
export function AppShell({ mode, slug }: { mode: ShellMode; slug?: string }) {
  const { user, loading, setActiveEstablishment } = useAuthContext();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(true);
  const [view, setView] = useState<ViewKey>("dashboard");

  // Contexto empresa: nome resolvido + estado de resolução.
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [resolving, setResolving] = useState(mode === "company");
  // Enquanto redireciona (ex.: funcionário caiu em /dashboard), segura a UI.
  const [redirecting, setRedirecting] = useState(false);
  // Foco vindo de uma notificação (ex.: abrir usuários filtrado por um usuário).
  const [focus, setFocus] = useState<{ userId: string; nonce: number } | null>(null);

  useEffect(() => {
    setMounted(true);
    const storedMenu = localStorage.getItem("menu_open");
    if (storedMenu === "1" || storedMenu === "0") setMenuOpen(storedMenu === "1");
    else setMenuOpen(window.matchMedia("(min-width: 768px)").matches);

    const storedView = localStorage.getItem("active_view");
    if (
      storedView === "dashboard" ||
      storedView === "empresas" ||
      storedView === "minhas-empresas" ||
      storedView === "config-empresa" ||
      storedView === "usuarios" ||
      storedView === "cargos" ||
      storedView === "seguranca"
    ) {
      setView(storedView);
    }
  }, []);

  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  // Resolve o contexto (empresa vs plataforma) quando o usuário carrega.
  useEffect(() => {
    if (!user) return;

    if (mode === "platform") {
      // A plataforma é do super admin. Usuário comum:
      //  - 1 empresa: vai direto para o dashboard dela (fluxo antigo);
      //  - 2+ empresas: fica na plataforma e vê o hub "Minhas Empresas".
      if (!isSuperAdmin) {
        if (user.memberships.length === 1) {
          const first = user.memberships[0];
          setRedirecting(true);
          setActiveEstablishment(first.establishment.id);
          window.location.href = `/${first.establishment.slug}/dashboard`;
          return;
        }
        if (user.memberships.length >= 2 && !localStorage.getItem("active_view")) {
          setView("minhas-empresas");
        }
      }
      setActiveEstablishment(""); // sem empresa ativa na plataforma
      return;
    }

    // mode === "company"
    let cancelled = false;
    (async () => {
      // 1) tenta pelo vínculo do usuário
      const membership = user.memberships.find((m) => m.establishment.slug === slug);
      if (membership) {
        if (cancelled) return;
        setActiveEstablishment(membership.establishment.id);
        setCompanyName(membership.establishment.name);
        setResolving(false);
        return;
      }
      // 2) super admin: resolve pelo endpoint público
      if (isSuperAdmin && slug) {
        try {
          const { data } = await api.get<{ establishment: { id: string; name: string } }>(
            `/public/establishment/${slug}`,
            { silent: true }
          );
          if (cancelled) return;
          setActiveEstablishment(data.establishment.id);
          setCompanyName(data.establishment.name);
          setResolving(false);
          return;
        } catch {
          /* cai no redirect abaixo */
        }
      }
      // 3) sem acesso → volta ao login da empresa
      if (!cancelled) window.location.href = `/${slug}`;
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, mode, slug, isSuperAdmin]);

  // Título da aba: nome da empresa no contexto empresa, marca no contexto plataforma.
  // Efeito dedicado (roda após o metadata do Next) garante que o título "gruda".
  useEffect(() => {
    if (mode === "company") {
      if (companyName) document.title = `${companyName} · ${APP_NAME}`;
    } else {
      document.title = `${APP_NAME} — ${APP_TAGLINE}`;
    }
  }, [mode, companyName]);

  function setMenu(v: boolean) {
    setMenuOpen(v);
    localStorage.setItem("menu_open", v ? "1" : "0");
  }

  function selectView(v: ViewKey) {
    setView(v);
    localStorage.setItem("active_view", v);
  }

  // Ações vindas de notificações: troca de aba (+ foco num usuário, se houver).
  useEffect(() => {
    return onNavigate(({ view: v, userId }) => {
      if (
        v === "dashboard" ||
        v === "empresas" ||
        v === "minhas-empresas" ||
        v === "config-empresa" ||
        v === "usuarios" ||
        v === "cargos" ||
        v === "seguranca"
      ) {
        selectView(v);
      }
      if (userId) setFocus({ userId, nonce: Date.now() });
    });
  }, []);

  function exitCompany() {
    setActiveEstablishment("");
    window.location.href = "/dashboard";
  }

  // Super admin: entra numa empresa já num view específico (submenu da sidebar).
  function enterCompany(
    company: { id: string; slug: string },
    targetView: ViewKey
  ) {
    setActiveEstablishment(company.id);
    localStorage.setItem("active_view", targetView);
    window.location.href = `/${company.slug}/dashboard`;
  }

  const multiCompany = !isSuperAdmin && (user?.memberships?.length ?? 0) >= 2;
  const allowed = viewsForMode(mode, !!isSuperAdmin, multiCompany);
  const effectiveView: ViewKey = allowed.includes(view) ? view : "dashboard";

  const ready =
    !loading && !!user && !redirecting && !(mode === "company" && resolving);

  // "Sair da empresa" (voltar à plataforma) só faz sentido para o super admin.
  const canExitToPlatform = mode === "company" && isSuperAdmin;
  // Funcionário da empresa: ao sair, volta para o login da própria empresa (/{slug}).
  const companyLogout =
    mode === "company" && !isSuperAdmin && slug
      ? () => handleLogout("manual", `/${slug}`)
      : undefined;

  return (
    <div className="min-h-screen">
      <Topbar
        menuOpen={menuOpen}
        onToggleMenu={() => setMenu(!menuOpen)}
        companyName={mode === "company" ? companyName : null}
        onExitCompany={canExitToPlatform ? exitCompany : undefined}
      />
      <div className="flex pt-14 min-h-screen">
        {ready ? (
          <Sidebar
            open={menuOpen}
            mounted={mounted}
            mode={mode}
            view={effectiveView}
            onSelect={selectView}
            onEnterCompany={enterCompany}
            onLogout={companyLogout}
            onClose={() => setMenu(false)}
          />
        ) : (
          menuOpen && (
            <div
              className="hidden md:block md:w-64 md:shrink-0 border-r"
              style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
            />
          )
        )}

        <main className="flex-1 min-w-0">
          {!ready ? (
            <div className="flex items-center justify-center py-24">
              <div className="orbita-spinner" />
            </div>
          ) : mode === "company" ? (
            effectiveView === "usuarios" ? (
              <CompanyUsersView
                companyName={companyName}
                focusUserId={focus?.userId ?? null}
                focusNonce={focus?.nonce ?? 0}
              />
            ) : effectiveView === "cargos" ? (
              <CargosView companyName={companyName} />
            ) : effectiveView === "config-empresa" ? (
              <ConfiguracoesEmpresaView companyName={companyName} />
            ) : effectiveView === "seguranca" ? (
              <SegurancaView />
            ) : (
              <DashboardView companyMode />
            )
          ) : effectiveView === "empresas" ? (
            <EmpresasView />
          ) : effectiveView === "minhas-empresas" ? (
            <MinhasEmpresasView />
          ) : effectiveView === "usuarios" ? (
            <UsuariosView />
          ) : effectiveView === "seguranca" ? (
            <SegurancaView />
          ) : (
            <DashboardView />
          )}
        </main>
      </div>

      {/* Botão flutuante "Voltar ao início" — atalho para o Dashboard sem abrir o
          menu. Só aparece fora do próprio Dashboard. */}
      {ready && effectiveView !== "dashboard" && (
        <button
          onClick={() => selectView("dashboard")}
          title="Voltar ao início"
          aria-label="Voltar ao início"
          className="fixed bottom-5 right-5 z-30 flex items-center gap-2 rounded-full px-4 h-11 shadow-lg text-sm font-medium hover:opacity-90 transition"
          style={{ background: "var(--brand-soft)", color: "var(--brand-text)", border: "1px solid var(--border-strong)" }}
        >
          <span aria-hidden className="text-base">←</span>
          <span className="hidden sm:inline">Voltar</span>
        </button>
      )}
    </div>
  );
}
