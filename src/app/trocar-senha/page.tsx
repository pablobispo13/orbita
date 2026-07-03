"use client";

import { useEffect, useState } from "react";
import { handleLogout } from "@/lib/api";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { OrbitMark } from "@/components/Logo";

// Troca de senha OBRIGATÓRIA (ex.: após reset pelo super admin).
export default function ForcedChangePasswordPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      handleLogout("manual");
      return;
    }
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ color: "var(--text-muted)" }}
      >
        Carregando...
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <OrbitMark size={40} />
          <div>
            <h1 className="text-xl font-bold">Defina uma nova senha</h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Sua senha foi redefinida. Crie uma nova para continuar.
            </p>
          </div>
        </div>

        <ChangePasswordForm forced />

        <button
          onClick={() => handleLogout("manual")}
          className="w-full text-center text-sm hover:underline"
          style={{ color: "var(--text-muted)" }}
        >
          Sair
        </button>
      </div>
    </main>
  );
}
