"use client";

import { useEffect } from "react";

// Modal genérico, theme-aware. Fecha com Esc, clique no fundo ou no ✕.
export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // Trava o scroll do body enquanto o modal está aberto.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.6)" }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${maxWidth} max-h-[85vh] overflow-y-auto rounded-2xl border p-6 space-y-4`}
        style={{ background: "var(--bg-elevated)", borderColor: "var(--border-strong)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg border w-8 h-8 flex items-center justify-center hover:bg-white/5 shrink-0"
            style={{ borderColor: "var(--border-strong)" }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
