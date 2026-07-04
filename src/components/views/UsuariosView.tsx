"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useAuthContext } from "@/context/AuthContext";
import api from "@/lib/api";
import { Modal } from "@/components/Modal";
import {
  DataTable,
  FilterTags,
  Th,
  ViewToggle,
  useViewMode,
  type FilterTag,
} from "@/components/ListControls";

const USER_FILTERS: FilterTag[] = [
  { key: "super", label: "Super admin" },
  { key: "user", label: "Usuário" },
  { key: "pending", label: "Troca de senha pendente" },
];

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
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useViewMode("view_usuarios");
  const [detail, setDetail] = useState<AdminUser | null>(null);
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});
  const [resettingId, setResettingId] = useState<string | null>(null);

  // Envio de notificação (super admin -> usuário).
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyMessage, setNotifyMessage] = useState("");
  const [sendingNotify, setSendingNotify] = useState(false);

  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  function toggleFilter(k: string) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const roleFilters = ["super", "user"].filter((k) => active.has(k));
    const pendingOnly = active.has("pending");
    return users.filter((u) => {
      const matchesSearch =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.memberships.some((m) => m.establishment.name.toLowerCase().includes(q));
      const roleKey = u.role === "SUPER_ADMIN" ? "super" : "user";
      const matchesRole = roleFilters.length === 0 || roleFilters.includes(roleKey);
      const matchesPending = !pendingOnly || u.mustChangePassword;
      return matchesSearch && matchesRole && matchesPending;
    });
  }, [users, search, active]);

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

  async function sendNotification(target: AdminUser) {
    if (notifyTitle.trim().length < 2 || !notifyMessage.trim()) return;
    setSendingNotify(true);
    try {
      await api.post("/admin/notifications", {
        userId: target.id,
        title: notifyTitle.trim(),
        message: notifyMessage.trim(),
      });
      toast.success(`Notificação enviada a ${target.name}.`);
      setNotifyTitle("");
      setNotifyMessage("");
    } catch {
      /* toast global cuida do erro */
    } finally {
      setSendingNotify(false);
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
          Usuários da plataforma. Clique para ver detalhes e resetar a senha (troca obrigatória
          no próximo acesso).
        </p>
      </div>

      {/* Barra de ferramentas: busca + alternância de visualização */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          className="orbita-input flex-1 min-w-56 px-3 py-2.5"
          placeholder="Buscar por nome, e-mail ou empresa..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <ViewToggle mode={viewMode} onChange={setViewMode} />
      </div>
      <FilterTags tags={USER_FILTERS} active={active} onToggle={toggleFilter} />

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="orbita-spinner" />
        </div>
      ) : filtered.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>Nenhum usuário encontrado.</p>
      ) : viewMode === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {filtered.map((u) => (
            <button
              key={u.id}
              onClick={() => setDetail(u)}
              className="orbita-card p-4 space-y-2 text-left"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium truncate">{u.name}</div>
                {u.role === "SUPER_ADMIN" && (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded shrink-0"
                    style={{ background: "var(--brand-soft)", color: "var(--brand-text)" }}
                  >
                    Plataforma
                  </span>
                )}
              </div>
              <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                {u.email}
              </div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                {u.role === "SUPER_ADMIN"
                  ? "Todas as empresas"
                  : `${u.memberships.length} empresa(s)`}
                {u.mustChangePassword && " · ⏳ troca de senha pendente"}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <DataTable>
          <thead>
            <tr>
              <Th>Nome</Th>
              <Th>E-mail</Th>
              <Th>Nível</Th>
              <Th>Empresas</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr
                key={u.id}
                onClick={() => setDetail(u)}
                className="cursor-pointer border-b hover:bg-white/5"
                style={{ borderColor: "var(--border)" }}
              >
                <td className="px-4 py-2.5 font-medium">{u.name}</td>
                <td className="px-4 py-2.5" style={{ color: "var(--text-muted)" }}>
                  {u.email}
                </td>
                <td className="px-4 py-2.5">
                  {u.role === "SUPER_ADMIN" ? "Super admin" : "Usuário"}
                </td>
                <td className="px-4 py-2.5" style={{ color: "var(--text-muted)" }}>
                  {u.role === "SUPER_ADMIN" ? "Todas" : u.memberships.length}
                </td>
                <td className="px-4 py-2.5">
                  {u.mustChangePassword ? (
                    <span style={{ color: "var(--warning)" }}>⏳ senha pendente</span>
                  ) : (
                    <span style={{ color: "var(--text-muted)" }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}

      {/* Modal: detalhes do usuário */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? "Usuário"}>
        {detail && (
          <div className="space-y-4">
            <div className="text-sm space-y-1">
              <div>
                <span style={{ color: "var(--text-muted)" }}>E-mail: </span>
                <span className="select-all">{detail.email}</span>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Nível: </span>
                {detail.role === "SUPER_ADMIN" ? "Super admin (plataforma)" : "Usuário"}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                Empresas
              </div>
              {detail.role === "SUPER_ADMIN" ? (
                <span className="text-sm">Acesso a todas as empresas da plataforma.</span>
              ) : detail.memberships.length === 0 ? (
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Sem empresa vinculada.
                </span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {detail.memberships.map((m) => (
                    <span
                      key={m.establishment.slug}
                      className="text-[11px] px-2 py-0.5 rounded"
                      style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}
                    >
                      🏢 {m.establishment.name} · {m.role === "ADMIN" ? "Dono" : "Funcionário"}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {resetPasswords[detail.id] && (
              <div
                className="rounded-lg px-4 py-3 text-sm"
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
              >
                Senha temporária:{" "}
                <span className="font-mono select-all">{resetPasswords[detail.id]}</span> —
                repasse ao usuário (troca obrigatória no login).
              </div>
            )}

            {/* Enviar notificação (in-app + push) para este usuário */}
            <div
              className="rounded-lg border p-3 space-y-2"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                Enviar notificação
              </div>
              <input
                className="orbita-input w-full px-3 py-2"
                placeholder="Título"
                value={notifyTitle}
                onChange={(e) => setNotifyTitle(e.target.value)}
              />
              <textarea
                className="orbita-input w-full px-3 py-2"
                placeholder="Mensagem"
                rows={2}
                value={notifyMessage}
                onChange={(e) => setNotifyMessage(e.target.value)}
              />
              <button
                onClick={() => sendNotification(detail)}
                disabled={
                  sendingNotify || notifyTitle.trim().length < 2 || !notifyMessage.trim()
                }
                className="orbita-btn px-4 py-2 w-full"
              >
                {sendingNotify ? "Enviando..." : "Enviar notificação"}
              </button>
            </div>

            <button
              onClick={() => resetPassword(detail)}
              disabled={resettingId === detail.id}
              className="w-full rounded-lg border px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
              style={{ borderColor: "var(--border-strong)" }}
            >
              {resettingId === detail.id ? "Resetando..." : "Resetar senha"}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
