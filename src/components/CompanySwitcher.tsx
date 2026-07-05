"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuthContext } from "@/context/AuthContext";

// Seletor de empresa na Topbar. Aparece quando o usuário tem 2+ empresas.
// Agrupa por papel (Dono × Membro) e permite troca rápida. Trocar navega para
// /{slug}/dashboard mantendo o app consistente com o contexto de empresa.
export function CompanySwitcher() {
  const { user, activeEstablishmentId, setActiveEstablishment } = useAuthContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const memberships = useMemo(() => user?.memberships ?? [], [user]);

  const groups = useMemo(() => {
    const owner = memberships.filter((m) => m.role === "ADMIN");
    const member = memberships.filter((m) => m.role === "STAFF");
    return { owner, member };
  }, [memberships]);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  // Só faz sentido com mais de uma empresa.
  if (memberships.length < 2) return null;

  const active = memberships.find((m) => m.establishment.id === activeEstablishmentId);

  function choose(establishment: { id: string; slug: string }) {
    setOpen(false);
    if (establishment.id === activeEstablishmentId) return;
    setActiveEstablishment(establishment.id);
    window.location.href = `/${establishment.slug}/dashboard`;
  }

  function openHub() {
    setOpen(false);
    // Volta à plataforma no hub "Minhas Empresas". Persiste a view para que ela
    // seja restaurada após o reload (o /dashboard recarrega a página inteira).
    setActiveEstablishment("");
    localStorage.setItem("active_view", "minhas-empresas");
    window.location.href = "/dashboard";
  }

  const section = (
    label: string,
    items: typeof memberships
  ) =>
    items.length > 0 && (
      <div className="py-1">
        <div
          className="px-3 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          {label}
        </div>
        {items.map((m) => {
          const isActive = m.establishment.id === activeEstablishmentId;
          return (
            <button
              key={m.establishment.id}
              onClick={() => choose(m.establishment)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-white/5"
              style={{ color: isActive ? "var(--brand-text)" : "var(--text)" }}
            >
              <span aria-hidden className="w-3 shrink-0">
                {isActive ? "●" : ""}
              </span>
              <span className="truncate">{m.establishment.name}</span>
            </button>
          );
        })}
      </div>
    );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Trocar de empresa"
        className="flex items-center gap-1.5 rounded-lg border px-2.5 h-8 text-sm hover:bg-white/5 max-w-[46vw] sm:max-w-none"
        style={{ borderColor: "var(--border-strong)" }}
      >
        <span className="font-display font-bold truncate">
          {active?.establishment.name ?? "Trocar empresa"}
        </span>
        <span aria-hidden className="text-xs opacity-70">
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 mt-1 w-64 max-w-[calc(100vw-1.5rem)] max-h-[70vh] overflow-y-auto rounded-xl border shadow-lg z-50"
          style={{ background: "var(--bg-elevated)", borderColor: "var(--border-strong)" }}
        >
          {section("Onde sou dono", groups.owner)}
          {section("Onde sou membro", groups.member)}
          <div className="border-t" style={{ borderColor: "var(--border)" }}>
            <button
              onClick={openHub}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-white/5"
              style={{ color: "var(--text-muted)" }}
            >
              <span aria-hidden>🏢</span> Minhas empresas
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
