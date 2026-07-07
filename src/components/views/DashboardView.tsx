"use client";

import { useEffect, useState } from "react";
import { useAuthContext } from "@/context/AuthContext";
import { navigateToView } from "@/lib/navigation";
import api from "@/lib/api";
import { MODULES, type ModuleKey } from "@/lib/modules";

type QuickFeature = {
  view: string;
  label: string;
  icon: string;
  desc: string;
  module?: ModuleKey; // se definido, só aparece com o módulo ativo
};

// Telas de módulos plugáveis (aparecem conforme os módulos ativos da empresa).
const MODULE_FEATURES: QuickFeature[] = [
  { view: "comanda", module: MODULES.COMANDA, label: "Comanda & Mesas", icon: "🧾", desc: "Abrir comandas e fechar vendas" },
  { view: "cozinha", module: MODULES.COMANDA, label: "Cozinha", icon: "👨‍🍳", desc: "Fila de preparo dos pedidos" },
  { view: "produtos", module: MODULES.PRODUCTS, label: "Produtos", icon: "🍕", desc: "Catálogo e precificação" },
  { view: "estoque", module: MODULES.STOCK, label: "Estoque", icon: "📦", desc: "Insumos e movimentações" },
  { view: "financeiro", module: MODULES.FINANCE, label: "Financeiro", icon: "💰", desc: "Receitas, despesas e ganhos" },
  { view: "relatorios", module: MODULES.FINANCE, label: "Relatórios", icon: "📊", desc: "DRE e fechamento de período" },
];

// Funcionalidades base da empresa (sempre disponíveis) para o acesso rápido.
const QUICK_FEATURES: QuickFeature[] = [
  { view: "config-empresa", label: "Empresa", icon: "🏢", desc: "Dados cadastrais da empresa" },
  { view: "usuarios", label: "Usuários", icon: "👥", desc: "Equipe e permissões" },
  { view: "cargos", label: "Cargos", icon: "🛡️", desc: "Cargos e suas permissões" },
];

export function DashboardView({ companyMode = false }: { companyMode?: boolean }) {
  const { user, activeEstablishmentId, setActiveEstablishment } = useAuthContext();
  const [superAdminActiveName, setSuperAdminActiveName] = useState<string | null>(null);
  const [enabledModules, setEnabledModules] = useState<ModuleKey[] | null>(null);

  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  // Módulos ativos da empresa (contexto empresa) para filtrar o acesso rápido.
  useEffect(() => {
    if (!companyMode || !activeEstablishmentId) {
      setEnabledModules(null);
      return;
    }
    let cancelled = false;
    api
      .get<{ modules: ModuleKey[] }>("/company/modules", { silent: true })
      .then(({ data }) => {
        if (!cancelled) setEnabledModules(data.modules);
      })
      .catch(() => {
        if (!cancelled) setEnabledModules(null);
      });
    return () => {
      cancelled = true;
    };
  }, [companyMode, activeEstablishmentId]);
  const membershipActive =
    user?.memberships.find((m) => m.establishment.id === activeEstablishmentId) ?? null;

  // Super admin não tem vínculo: resolve o nome da empresa que está operando.
  useEffect(() => {
    if (isSuperAdmin && activeEstablishmentId && !membershipActive) {
      api
        .get<{ establishments: { id: string; name: string }[] }>("/admin/establishments")
        .then(({ data }) => {
          const found = data.establishments.find((e) => e.id === activeEstablishmentId);
          setSuperAdminActiveName(found?.name ?? null);
        })
        .catch(() => {});
    } else {
      setSuperAdminActiveName(null);
    }
  }, [isSuperAdmin, activeEstablishmentId, membershipActive]);

  if (!user) return null;

  return (
    <div className="p-6 md:p-10 w-full space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Olá, {user.name} 👋</h1>
        {isSuperAdmin && (
          <span
            className="inline-block mt-2 rounded px-2 py-0.5 text-xs font-medium"
            style={{ background: "var(--brand-soft)", color: "var(--brand-text)" }}
          >
            SUPER ADMIN · acesso à plataforma inteira
          </span>
        )}
      </div>

      {/* Empresa ativa (membro OU super admin operando) */}
      {membershipActive ? (
        <div
          className="orbita-card p-4"
          style={{ borderColor: "var(--accent)", background: "var(--accent-soft)" }}
        >
          <div className="text-sm">
            🏢 Empresa ativa: <strong>{membershipActive.establishment.name}</strong>
          </div>
          <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Cargo:{" "}
            {membershipActive.role === "ADMIN"
              ? "Dono (ADMIN) · acesso total"
              : membershipActive.customRole?.name ?? "Funcionário"}
          </div>
        </div>
      ) : superAdminActiveName ? (
        <div
          className="orbita-card p-4 flex flex-wrap items-center justify-between gap-3"
          style={{ borderColor: "var(--accent)", background: "var(--accent-soft)" }}
        >
          <div>
            <div className="text-sm">
              🏢 Operando em: <strong>{superAdminActiveName}</strong>
            </div>
            <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Acesso total como super admin
            </div>
          </div>
          {!companyMode && (
            <button
              onClick={() => setActiveEstablishment("")}
              className="rounded-lg border px-3 py-1.5 text-xs hover:bg-white/5"
              style={{ borderColor: "var(--border-strong)" }}
            >
              Sair da empresa
            </button>
          )}
        </div>
      ) : isSuperAdmin ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Nenhuma empresa ativa. Selecione uma em <strong>Empresas</strong> no menu.
        </p>
      ) : null}

      {/* Acesso rápido: telas de módulos ativos + funcionalidades base */}
      {companyMode && (() => {
        const moduleItems = MODULE_FEATURES.filter(
          (f) => !f.module || (enabledModules?.includes(f.module) ?? false)
        );
        const items = [...moduleItems, ...QUICK_FEATURES];
        return (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Acesso rápido
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((f) => (
                <button
                  key={f.view}
                  onClick={() => navigateToView({ view: f.view })}
                  className="text-left orbita-card p-4 transition hover:border-[var(--accent)]"
                >
                  <div className="text-2xl" aria-hidden>
                    {f.icon}
                  </div>
                  <div className="font-medium mt-2">{f.label}</div>
                  <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    {f.desc}
                  </div>
                </button>
              ))}
            </div>
          </section>
        );
      })()}

      {/* Trocar de empresa: outras empresas do usuário (dentro de uma empresa) */}
      {companyMode && (() => {
        const others = user.memberships.filter((m) => m.establishment.id !== activeEstablishmentId);
        if (others.length === 0) return null;
        return (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Trocar de empresa
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {others.map((m) => (
                <button
                  key={m.establishment.id}
                  onClick={() => {
                    setActiveEstablishment(m.establishment.id);
                    window.location.href = `/${m.establishment.slug}/dashboard`;
                  }}
                  className="text-left orbita-card p-4 transition hover:border-[var(--accent)]"
                >
                  <div className="flex items-center gap-2">
                    <span aria-hidden>🏢</span>
                    <span className="font-medium truncate">{m.establishment.name}</span>
                  </div>
                  <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    {m.role === "ADMIN" ? "Você é o dono" : m.customRole?.name ?? "Funcionário"}
                  </div>
                  <div className="text-xs mt-2 text-[var(--accent)]">Entrar →</div>
                </button>
              ))}
            </div>
          </section>
        );
      })()}

      {/* Empresas do usuário (não super admin, só no contexto plataforma) */}
      {!isSuperAdmin && !companyMode && (
        <section className="space-y-3">
          <h2
            className="text-sm font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-muted)" }}
          >
            Suas empresas
          </h2>
          {user.memberships.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Você ainda não pertence a nenhuma empresa.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {user.memberships.map((m) => {
                const active = m.establishment.id === activeEstablishmentId;
                return (
                  <button
                    key={m.establishment.id}
                    onClick={() => {
                      setActiveEstablishment(m.establishment.id);
                      window.location.href = `/${m.establishment.slug}/dashboard`;
                    }}
                    className="text-left orbita-card p-4 transition"
                    style={{
                      borderColor: active ? "var(--accent)" : "var(--border)",
                      background: active ? "var(--accent-soft)" : "var(--surface)",
                    }}
                  >
                    <div className="font-medium">{m.establishment.name}</div>
                    <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                      {m.role === "ADMIN" ? "Dono (ADMIN)" : m.customRole?.name ?? "Funcionário"}
                    </div>
                    {active && (
                      <div className="text-xs mt-2 text-[var(--accent)]">● Ativa</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
