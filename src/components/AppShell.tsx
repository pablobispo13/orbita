"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuthContext } from "@/context/AuthContext";
import { Topbar } from "@/components/Topbar";
import { Sidebar, viewsForMode, type ViewKey, type ShellMode } from "@/components/Sidebar";
import { DashboardView } from "@/components/views/DashboardView";
import { EmpresasView } from "@/components/views/EmpresasView";
import { UsuariosView } from "@/components/views/UsuariosView";
import { CompanyUsersView } from "@/components/views/CompanyUsersView";

// Shell autenticado. Duas modalidades:
//  - platform (/dashboard): gestão da plataforma (super admin).
//  - company (/{slug}/dashboard): operação de uma empresa específica.
export function AppShell({ mode, slug }: { mode: ShellMode; slug?: string }) {
  const { user, loading, activeEstablishmentId, setActiveEstablishment } = useAuthContext();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(true);
  const [view, setView] = useState<ViewKey>("dashboard");

  // Contexto empresa: nome resolvido + estado de resolução.
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [resolving, setResolving] = useState(mode === "company");

  useEffect(() => {
    setMounted(true);
    const storedMenu = localStorage.getItem("menu_open");
    if (storedMenu === "1" || storedMenu === "0") setMenuOpen(storedMenu === "1");
    else setMenuOpen(window.matchMedia("(min-width: 768px)").matches);

    const storedView = localStorage.getItem("active_view");
    if (storedView === "dashboard" || storedView === "empresas" || storedView === "usuarios") {
      setView(storedView);
    }
  }, []);

  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  // Resolve o contexto (empresa vs plataforma) quando o usuário carrega.
  useEffect(() => {
    if (!user) return;

    if (mode === "platform") {
      setActiveEstablishment(""); // sem empresa ativa na plataforma
      document.title = "Órbita — Gestão multi-empresa";
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
        document.title = `${membership.establishment.name} · Órbita`;
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
          document.title = `${data.establishment.name} · Órbita`;
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

  function setMenu(v: boolean) {
    setMenuOpen(v);
    localStorage.setItem("menu_open", v ? "1" : "0");
  }

  function selectView(v: ViewKey) {
    setView(v);
    localStorage.setItem("active_view", v);
  }

  function exitCompany() {
    setActiveEstablishment("");
    window.location.href = "/dashboard";
  }

  const allowed = viewsForMode(mode, !!isSuperAdmin);
  const effectiveView: ViewKey = allowed.includes(view) ? view : "dashboard";

  const ready = !loading && !!user && !(mode === "company" && resolving);

  return (
    <div className="min-h-screen">
      <Topbar
        menuOpen={menuOpen}
        onToggleMenu={() => setMenu(!menuOpen)}
        companyName={mode === "company" ? companyName : null}
        onExitCompany={exitCompany}
      />
      <div className="flex pt-14 min-h-screen">
        {ready ? (
          <Sidebar
            open={menuOpen}
            mounted={mounted}
            mode={mode}
            view={effectiveView}
            onSelect={selectView}
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
              <CompanyUsersView companyName={companyName} />
            ) : (
              <DashboardView companyMode />
            )
          ) : effectiveView === "empresas" ? (
            <EmpresasView />
          ) : effectiveView === "usuarios" ? (
            <UsuariosView />
          ) : (
            <DashboardView />
          )}
        </main>
      </div>
    </div>
  );
}
