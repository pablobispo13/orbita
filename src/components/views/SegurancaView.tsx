"use client";

import { useAuthContext } from "@/context/AuthContext";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

// Configurações de segurança da conta do usuário (troca de senha).
// Vive num item próprio do menu — antes ficava no rodapé do Dashboard.
export function SegurancaView() {
  const { user } = useAuthContext();
  if (!user) return null;

  return (
    <div className="p-6 md:p-10 w-full max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Segurança</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Gerencie o acesso à sua conta. Ao trocar a senha, você será deslogado e precisará
          entrar novamente com a nova senha.
        </p>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          Trocar senha
        </h2>
        <ChangePasswordForm forced />
      </div>
    </div>
  );
}
