"use client";

import { useEffect, useState } from "react";
import { useAuthContext } from "@/context/AuthContext";
import api from "@/lib/api";

type AdminEstablishment = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  owner: { name: string; email: string };
  _count: { memberships: number; products: number; stockItems: number };
};

export function EmpresasView() {
  const { user, activeEstablishmentId, setActiveEstablishment } = useAuthContext();
  const [establishments, setEstablishments] = useState<AdminEstablishment[]>([]);
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  useEffect(() => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }
    api
      .get<{ establishments: AdminEstablishment[] }>("/admin/establishments")
      .then(({ data }) => setEstablishments(data.establishments))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isSuperAdmin]);

  if (!user) return null;

  if (!isSuperAdmin) {
    return (
      <div className="p-6 md:p-10 max-w-4xl mx-auto">
        <p style={{ color: "var(--text-muted)" }}>Acesso restrito ao super admin.</p>
      </div>
    );
  }

  function enter(e: AdminEstablishment) {
    setActiveEstablishment(e.id);
    // Entra no contexto da empresa com URL própria: /{slug}/dashboard
    window.location.href = `/${e.slug}/dashboard`;
  }

  return (
    <div className="p-6 md:p-10 w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Empresas</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Todas as empresas da plataforma. Selecione uma para operar como super admin.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="orbita-spinner" />
        </div>
      ) : establishments.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>Nenhuma empresa cadastrada ainda.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {establishments.map((e) => {
            const isActive = e.id === activeEstablishmentId;
            return (
              <div
                key={e.id}
                className="orbita-card p-4 space-y-3"
                style={{ borderColor: isActive ? "var(--accent)" : "var(--border)" }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{e.name}</span>
                  <a
                    href={`/${e.slug}`}
                    className="text-xs font-mono text-[var(--accent)] hover:underline"
                  >
                    /{e.slug}
                  </a>
                </div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Dono: {e.owner.name}
                </div>
                <div className="flex gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
                  <span>👥 {e._count.memberships}</span>
                  <span>🍕 {e._count.products}</span>
                  <span>📦 {e._count.stockItems}</span>
                </div>
                <button
                  onClick={() => enter(e)}
                  disabled={isActive}
                  className="w-full rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-60"
                  style={{
                    background: isActive ? "var(--accent-soft)" : "var(--brand-soft)",
                    color: isActive ? "var(--accent)" : "var(--brand-text)",
                  }}
                >
                  {isActive ? "● Empresa ativa" : "Entrar na empresa"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
