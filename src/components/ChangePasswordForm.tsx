"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import api, { handleLogout } from "@/lib/api";
import { PasswordInput } from "@/components/PasswordInput";

export function ChangePasswordForm({ forced = false }: { forced?: boolean }) {
  const [open, setOpen] = useState(forced);
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  function reset() {
    setCurrent("");
    setNew("");
    setConfirm("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) {
      toast.error("A confirmação não confere com a nova senha.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/change-password", { currentPassword, newPassword });
      reset();
      // Por segurança, desloga: o usuário precisa entrar de novo com a senha nova.
      handleLogout("password_changed");
    } catch {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-3">
      {!forced && (
        <div className="flex items-center justify-between">
          <h2
            className="text-sm font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-muted)" }}
          >
            Segurança
          </h2>
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-sm hover:underline"
            style={{ color: "var(--accent)" }}
          >
            {open ? "Cancelar" : "Trocar senha"}
          </button>
        </div>
      )}

      {open && (
        <form onSubmit={handleSubmit} className="orbita-card p-5 space-y-3 max-w-sm">
          <PasswordInput
            placeholder="Senha atual"
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
            className="orbita-input w-full px-3 py-2.5"
            autoComplete="current-password"
            required
          />
          <PasswordInput
            placeholder="Nova senha (mín. 6 caracteres)"
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
            className="orbita-input w-full px-3 py-2.5"
            autoComplete="new-password"
            minLength={6}
            required
          />
          <PasswordInput
            placeholder="Confirmar nova senha"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="orbita-input w-full px-3 py-2.5"
            autoComplete="new-password"
            minLength={6}
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="orbita-btn w-full px-4 py-2.5"
          >
            {loading ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>
      )}
    </section>
  );
}
