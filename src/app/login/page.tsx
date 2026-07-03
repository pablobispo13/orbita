"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { OrbitaLogo } from "@/components/Logo";
import { PasswordInput } from "@/components/PasswordInput";

const LOGOUT_MESSAGES: Record<string, string> = {
  password_changed: "Senha alterada. Entre novamente com a nova senha.",
  expired: "Sua sessão expirou. Entre novamente.",
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const reason = localStorage.getItem("logout_reason");
    if (reason && LOGOUT_MESSAGES[reason]) setNotice(LOGOUT_MESSAGES[reason]);
    localStorage.removeItem("logout_reason");
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("token", data.token);

      if (data.user?.mustChangePassword) {
        window.location.href = "/trocar-senha";
        return;
      }

      // Super admin cai na plataforma; usuário comum entra na 1ª empresa dele.
      const firstMembership = data.memberships?.[0];
      if (data.user?.role !== "SUPER_ADMIN" && firstMembership) {
        localStorage.setItem("activeEstablishmentId", firstMembership.establishment.id);
        window.location.href = `/${firstMembership.establishment.slug}/dashboard`;
      } else {
        window.location.href = "/dashboard";
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <OrbitaLogo size={40} />
          <div>
            <h1 className="text-xl font-bold">Acesso geral</h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Entre para gerenciar suas empresas
            </p>
          </div>
        </div>

        {notice && (
          <div
            className="rounded-lg px-4 py-3 text-sm text-center"
            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
          >
            {notice}
          </div>
        )}

        <form onSubmit={handleSubmit} className="orbita-card p-6 space-y-4">
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="orbita-input w-full px-3 py-2.5"
            required
          />
          <PasswordInput
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="orbita-input w-full px-3 py-2.5"
            autoComplete="current-password"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="orbita-btn w-full px-4 py-2.5"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
