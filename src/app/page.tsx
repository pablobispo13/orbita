"use client";

import { useEffect, useState } from "react";
import { OrbitaLogo } from "@/components/Logo";

export default function Home() {
  const [checking, setChecking] = useState(true);

  // Se já houver sessão válida, entra direto no sistema (sem passar pela landing).
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setChecking(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          setChecking(false);
          return;
        }
        const { user } = await res.json();
        if (user.mustChangePassword) {
          window.location.href = "/trocar-senha";
        } else if (user.role !== "SUPER_ADMIN" && user.memberships?.[0]) {
          window.location.href = `/${user.memberships[0].establishment.slug}/dashboard`;
        } else {
          window.location.href = "/dashboard";
        }
      } catch {
        setChecking(false);
      }
    })();
  }, []);

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="orbita-spinner" />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-8 text-center">
      <OrbitaLogo size={44} />

      <div className="space-y-3">
        <h1 className="text-4xl md:text-5xl font-bold max-w-2xl">
          Seu comando central de empresas
        </h1>
        <p className="max-w-md mx-auto" style={{ color: "var(--text-muted)" }}>
          Gestão financeira e de estoque para múltiplas empresas — num só lugar.
        </p>
      </div>

      <a href="/login" className="orbita-btn px-6 py-3">
        Entrar
      </a>

      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        É de uma empresa específica? Acesse por{" "}
        <span className="font-mono text-[var(--accent)]">/sua-empresa</span>
      </p>
    </main>
  );
}
