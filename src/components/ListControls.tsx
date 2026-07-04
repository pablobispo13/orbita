"use client";

import { useEffect, useState } from "react";

export type ViewMode = "cards" | "table";

// Modo de visualização (cards/tabela) persistido por tela.
export function useViewMode(key: string): [ViewMode, (m: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>("cards");
  useEffect(() => {
    const s = localStorage.getItem(key);
    if (s === "cards" || s === "table") setMode(s);
  }, [key]);
  const set = (m: ViewMode) => {
    setMode(m);
    localStorage.setItem(key, m);
  };
  return [mode, set];
}

export function ViewToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
}) {
  const opts: { m: ViewMode; label: string }[] = [
    { m: "cards", label: "▦ Cards" },
    { m: "table", label: "☰ Tabela" },
  ];
  return (
    <div
      className="inline-flex rounded-lg border overflow-hidden shrink-0"
      style={{ borderColor: "var(--border-strong)" }}
    >
      {opts.map((o) => (
        <button
          key={o.m}
          onClick={() => onChange(o.m)}
          className="px-3 py-1.5 text-xs"
          style={{
            background: mode === o.m ? "var(--brand-soft)" : "transparent",
            color: mode === o.m ? "var(--brand-text)" : "var(--text-muted)",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export type FilterTag = { key: string; label: string };

// Chips de filtro multi-seleção.
export function FilterTags({
  tags,
  active,
  onToggle,
}: {
  tags: FilterTag[];
  active: Set<string>;
  onToggle: (k: string) => void;
}) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((t) => {
        const on = active.has(t.key);
        return (
          <button
            key={t.key}
            onClick={() => onToggle(t.key)}
            className="text-xs px-3 py-1 rounded-full border transition"
            style={{
              borderColor: on ? "var(--accent)" : "var(--border-strong)",
              background: on ? "var(--accent-soft)" : "transparent",
              color: on ? "var(--accent)" : "var(--text-muted)",
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// Tabela padrão com scroll horizontal em telas estreitas.
export function DataTable({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="w-full overflow-x-auto rounded-xl border"
      style={{ borderColor: "var(--border)" }}
    >
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  );
}

// Célula de cabeçalho padrão.
export function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="text-left font-semibold px-4 py-2.5 border-b whitespace-nowrap"
      style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
    >
      {children}
    </th>
  );
}
