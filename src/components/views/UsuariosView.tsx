"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useAuthContext } from "@/context/AuthContext";
import api from "@/lib/api";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "USER";
  mustChangePassword: boolean;
  memberships: { role: string; establishment: { name: string; slug: string } }[];
};

export function UsuariosView() {
  const { user } = useAuthContext();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});
  const [resettingId, setResettingId] = useState<string | null>(null);

  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  useEffect(() => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }
    api
      .get<{ users: AdminUser[] }>("/admin/users")
      .then(({ data }) => setUsers(data.users))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isSuperAdmin]);

  async function resetPassword(target: AdminUser) {
    if (!confirm(`Resetar a senha de ${target.email}? Uma senha temporária será gerada.`))
      return;
    setResettingId(target.id);
    try {
      const { data } = await api.post<{ generatedPassword: string }>(
        `/admin/users/${target.id}/reset-password`
      );
      setResetPasswords((prev) => ({ ...prev, [target.id]: data.generatedPassword }));
      setUsers((prev) =>
        prev.map((u) => (u.id === target.id ? { ...u, mustChangePassword: true } : u))
      );
      toast.success("Senha resetada. Repasse a senha temporária ao usuário.");
    } finally {
      setResettingId(null);
    }
  }

  if (!user) return null;

  if (!isSuperAdmin) {
    return (
      <div className="p-6 md:p-10 max-w-4xl mx-auto">
        <p style={{ color: "var(--text-muted)" }}>Acesso restrito ao super admin.</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Usuários</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Usuários da plataforma. Resete a senha de quem esquecer (troca obrigatória no
          próximo acesso).
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="orbita-spinner" />
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {users.map((u) => (
            <div
              key={u.id}
              className="orbita-card p-3 flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <div className="font-medium text-sm">{u.name}</div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {u.email}
                </div>
                {/* Empresas relacionadas ao usuário */}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {u.role === "SUPER_ADMIN" ? (
                    <span
                      className="text-[10px] px-2 py-0.5 rounded"
                      style={{ background: "var(--brand-soft)", color: "var(--brand-text)" }}
                    >
                      Plataforma (todas as empresas)
                    </span>
                  ) : u.memberships.length === 0 ? (
                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      Sem empresa vinculada
                    </span>
                  ) : (
                    u.memberships.map((m) => (
                      <span
                        key={m.establishment.slug}
                        className="text-[10px] px-2 py-0.5 rounded"
                        style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}
                      >
                        🏢 {m.establishment.name} ·{" "}
                        {m.role === "ADMIN" ? "Dono" : "Funcionário"}
                      </span>
                    ))
                  )}
                </div>
                {resetPasswords[u.id] && (
                  <div className="text-xs mt-1" style={{ color: "var(--warning)" }}>
                    Senha temporária:{" "}
                    <span className="font-mono select-all">{resetPasswords[u.id]}</span>{" "}
                    — repasse ao usuário (troca obrigatória no login).
                  </div>
                )}
                {!resetPasswords[u.id] && u.mustChangePassword && (
                  <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    ⏳ troca de senha pendente
                  </div>
                )}
              </div>
              <button
                onClick={() => resetPassword(u)}
                disabled={resettingId === u.id}
                className="rounded-lg border px-3 py-1.5 text-xs hover:bg-white/5 disabled:opacity-50"
                style={{ borderColor: "var(--border-strong)" }}
              >
                {resettingId === u.id ? "Resetando..." : "Resetar senha"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
