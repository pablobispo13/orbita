"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthContext } from "@/context/AuthContext";
import api from "@/lib/api";
import {
  DataTable,
  FilterTags,
  Th,
  ViewToggle,
  useViewMode,
  type FilterTag,
} from "@/components/ListControls";

type AdminEstablishment = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  owner: { name: string; email: string };
  _count: { memberships: number; products: number; stockItems: number };
};

const EMPRESA_FILTERS: FilterTag[] = [
  { key: "active", label: "Ativas" },
  { key: "inactive", label: "Inativas" },
];

export function EmpresasView() {
  const { user, activeEstablishmentId, setActiveEstablishment } = useAuthContext();
  const [establishments, setEstablishments] = useState<AdminEstablishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useViewMode("view_empresas");

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

  function toggleFilter(k: string) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const wantActive = active.has("active");
    const wantInactive = active.has("inactive");
    return establishments.filter((e) => {
      const matchesSearch =
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.slug.toLowerCase().includes(q) ||
        e.owner.name.toLowerCase().includes(q);
      const matchesStatus =
        (!wantActive && !wantInactive) ||
        (wantActive && e.active) ||
        (wantInactive && !e.active);
      return matchesSearch && matchesStatus;
    });
  }, [establishments, search, active]);

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

      {/* Barra de ferramentas */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          className="orbita-input flex-1 min-w-56 px-3 py-2.5"
          placeholder="Buscar por nome, slug ou dono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <ViewToggle mode={viewMode} onChange={setViewMode} />
      </div>
      <FilterTags tags={EMPRESA_FILTERS} active={active} onToggle={toggleFilter} />

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="orbita-spinner" />
        </div>
      ) : filtered.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>
          {search.trim() || active.size
            ? "Nenhuma empresa encontrada."
            : "Nenhuma empresa cadastrada ainda."}
        </p>
      ) : viewMode === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {filtered.map((e) => {
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
                  {!e.active && (
                    <span style={{ color: "var(--danger)" }}> · inativa</span>
                  )}
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
      ) : (
        <DataTable>
          <thead>
            <tr>
              <Th>Empresa</Th>
              <Th>Slug</Th>
              <Th>Dono</Th>
              <Th>Membros</Th>
              <Th>Situação</Th>
              <Th>Ação</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => {
              const isActive = e.id === activeEstablishmentId;
              return (
                <tr
                  key={e.id}
                  className="border-b hover:bg-white/5"
                  style={{ borderColor: "var(--border)" }}
                >
                  <td className="px-4 py-2.5 font-medium">{e.name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">
                    <a href={`/${e.slug}`} className="text-[var(--accent)] hover:underline">
                      /{e.slug}
                    </a>
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--text-muted)" }}>
                    {e.owner.name}
                  </td>
                  <td className="px-4 py-2.5">{e._count.memberships}</td>
                  <td className="px-4 py-2.5">
                    {e.active ? (
                      <span style={{ color: "var(--text-muted)" }}>Ativa</span>
                    ) : (
                      <span style={{ color: "var(--danger)" }}>Inativa</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => enter(e)}
                      disabled={isActive}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                      style={{
                        background: isActive ? "var(--accent-soft)" : "var(--brand-soft)",
                        color: isActive ? "var(--accent)" : "var(--brand-text)",
                      }}
                    >
                      {isActive ? "● Ativa" : "Entrar"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      )}
    </div>
  );
}
