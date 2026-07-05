"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "react-toastify";
import api from "@/lib/api";
import { OrbitMark } from "@/components/Logo";
import { PasswordInput } from "@/components/PasswordInput";
import { Modal } from "@/components/Modal";
import { APP_NAME } from "@/lib/brand";

type Establishment = { id: string; name: string; slug: string };

type MeMembership = { establishment: { id: string; slug: string } };
type Me = {
  role: "SUPER_ADMIN" | "USER";
  mustChangePassword: boolean;
  memberships: MeMembership[];
};

export default function EstablishmentLoginPage() {
  const { slug } = useParams<{ slug: string }>();

  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [checking, setChecking] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Recuperação de senha (pedido ao gestor da empresa).
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSending, setForgotSending] = useState(false);

  async function requestPasswordReset(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotSending(true);
    try {
      const { data } = await api.post<{ message: string }>(
        `/public/establishment/${slug}/password-reset-request`,
        { email: forgotEmail.trim() }
      );
      toast.success(data.message);
      setForgotOpen(false);
      setForgotEmail("");
    } catch {
      /* toast global cuida do erro */
    } finally {
      setForgotSending(false);
    }
  }

  // Entra na empresa: grava a empresa ativa e vai pro dashboard
  // (ou para a troca obrigatória de senha, se pendente).
  function enter(
    establishmentId: string,
    token?: string,
    mustChange?: boolean,
    refreshToken?: string
  ) {
    if (token) localStorage.setItem("token", token);
    if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
    localStorage.setItem("activeEstablishmentId", establishmentId);
    window.location.href = mustChange ? "/trocar-senha" : `/${slug}/dashboard`;
  }

  useEffect(() => {
    if (!slug) return;

    (async () => {
      // 1) Resolve a empresa pelo slug (identidade + id).
      let est: Establishment;
      try {
        const { data } = await api.get<{ establishment: Establishment }>(
          `/public/establishment/${slug}`,
          { silent: true }
        );
        est = data.establishment;
        setEstablishment(est);
      } catch {
        setNotFound(true);
        setChecking(false);
        return;
      }

      // 2) Já está logado? Se puder acessar esta empresa, entra sem relogar.
      //    Usa fetch cru para NÃO acionar o logout automático do interceptor em 401.
      const token = localStorage.getItem("token");
      if (token) {
        try {
          const res = await fetch("/api/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const { user } = (await res.json()) as { user: Me };
            const canAccess =
              user.role === "SUPER_ADMIN" ||
              user.memberships.some((m) => m.establishment.slug === slug);
            if (canAccess) {
              // já tem token válido; respeita a troca obrigatória se pendente
              enter(est.id, undefined, user.mustChangePassword);
              return; // mantém a tela de "carregando" durante o redirect
            }
          }
        } catch {
          // token inválido/expirado — segue para o formulário de login
        }
      }

      setChecking(false);
    })();
  }, [slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });

      // SUPER_ADMIN acessa qualquer empresa. Demais usuários precisam de vínculo.
      const isSuperAdmin = data.user?.role === "SUPER_ADMIN";
      const membership = data.memberships?.find(
        (m: { establishment: { slug: string; id: string } }) =>
          m.establishment.slug === slug
      );

      const targetEstablishmentId =
        membership?.establishment.id ?? (isSuperAdmin ? establishment?.id : null);

      if (!targetEstablishmentId) {
        toast.error("Você não tem acesso a esta empresa.");
        return;
      }

      enter(
        targetEstablishmentId,
        data.token,
        data.user?.mustChangePassword,
        data.refreshToken
      );
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ color: "var(--text-muted)" }}
      >
        Carregando...
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <OrbitMark size={40} />
        <h1 className="text-xl font-bold">Empresa não encontrada</h1>
        <p style={{ color: "var(--text-muted)" }}>
          Não existe empresa com o endereço{" "}
          <span className="font-mono text-[var(--accent)]">/{slug}</span>.
        </p>
        <a href="/login" className="text-sm underline" style={{ color: "var(--text-muted)" }}>
          Ir para o acesso geral
        </a>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <OrbitMark size={40} />
          <div>
            <h1 className="text-xl font-bold">{establishment?.name}</h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Acesso da empresa · via{" "}
              <span className="text-[var(--accent)]">{APP_NAME}</span>
            </p>
          </div>
        </div>

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
            {loading ? "Entrando..." : `Entrar em ${establishment?.name ?? ""}`}
          </button>
        </form>

        <button
          onClick={() => {
            setForgotEmail(email);
            setForgotOpen(true);
          }}
          className="w-full text-center text-sm hover:underline"
          style={{ color: "var(--text-muted)" }}
        >
          Esqueci minha senha
        </button>
      </div>

      {/* Modal: pedido de recuperação de senha (o gestor gera e repassa) */}
      <Modal open={forgotOpen} onClose={() => setForgotOpen(false)} title="Recuperar senha">
        <form onSubmit={requestPasswordReset} className="space-y-4">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Informe seu e-mail. O gestor da empresa será avisado para gerar uma nova senha
            e repassá-la a você.
          </p>
          <input
            type="email"
            placeholder="E-mail"
            value={forgotEmail}
            onChange={(e) => setForgotEmail(e.target.value)}
            className="orbita-input w-full px-3 py-2.5"
            required
          />
          <button
            type="submit"
            disabled={forgotSending || !forgotEmail.trim()}
            className="orbita-btn w-full px-4 py-2.5"
          >
            {forgotSending ? "Enviando..." : "Enviar pedido"}
          </button>
        </form>
      </Modal>
    </main>
  );
}
