"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme") as Theme | null;
    if (current) setTheme(current);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    setTheme(next);
  }

  const icon = theme === "dark" ? "🌙" : "☀️";
  const label = theme === "dark" ? "Tema escuro" : "Tema claro";

  if (compact) {
    return (
      <button
        onClick={toggle}
        aria-label={`Alternar tema (atual: ${label})`}
        title={label}
        className="rounded-lg border w-9 h-9 flex items-center justify-center hover:bg-white/5"
        style={{ borderColor: "var(--border-strong)" }}
      >
        {icon}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      className="w-full flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-white/5"
      style={{ borderColor: "var(--border-strong)" }}
      aria-label="Alternar tema"
    >
      {icon} {label}
    </button>
  );
}
