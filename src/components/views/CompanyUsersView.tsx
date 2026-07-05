"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import api, { apiErrorMessage } from "@/lib/api";
import { Modal } from "@/components/Modal";
import {
  DataTable,
  FilterTags,
  Th,
  ViewToggle,
  useViewMode,
  type FilterTag,
} from "@/components/ListControls";

type CompanyUser = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  establishmentRole: "ADMIN" | "STAFF";
  roleName: string | null;
};

type Role = { id: string; name: string };
type Credentials = { name: string; email: string; password: string };

const MEMBER_FILTERS: FilterTag[] = [
  { key: "admin", label: "Dono" },
  { key: "staff", label: "Funcionário" },
  { key: "norole", label: "Sem cargo" },
  { key: "inactive", label: "Inativos" },
];

// Usuários (equipe) da empresa ativa. Escopo garantido pelo x-establishment-id.
export function CompanyUsersView({
  companyName,
  focusUserId = null,
  focusNonce = 0,
}: {
  companyName?: string | null;
  focusUserId?: string | null;
  focusNonce?: number;
}) {
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useViewMode("view_membros");

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [newRoleId, setNewRoleId] = useState("");
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [detail, setDetail] = useState<CompanyUser | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const appliedFocus = useRef(0);

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
    const roleFilters = ["admin", "staff"].filter((k) => active.has(k));
    const noRole = active.has("norole");
    const inactiveOnly = active.has("inactive");
    return users.filter((u) => {
      const matchesSearch =
        !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      const vk = u.establishmentRole === "ADMIN" ? "admin" : "staff";
      const matchesVinculo = roleFilters.length === 0 || roleFilters.includes(vk);
      const matchesNoRole = !noRole || (u.establishmentRole === "STAFF" && !u.roleName);
      const matchesInactive = !inactiveOnly || !u.active;
      return matchesSearch && matchesVinculo && matchesNoRole && matchesInactive;
    });
  }, [users, search, active]);

  useEffect(() => {
    load();
  }, []);

  // Foco vindo de uma notificação: filtra pela pessoa em questão.
  useEffect(() => {
    if (!focusNonce || appliedFocus.current === focusNonce || !focusUserId) return;
    const u = users.find((x) => x.id === focusUserId);
    if (u) {
      setActive(new Set());
      setSearch(u.email);
      appliedFocus.current = focusNonce;
    }
  }, [focusNonce, focusUserId, users]);

  async function load() {
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        api.get<{ users: CompanyUser[] }>("/company/users"),
        api
          .get<{ roles: Role[] }>("/roles", { silent: true })
          .catch(() => ({ data: { roles: [] as Role[] } })),
      ]);
      setUsers(usersRes.data.users);
      setRoles(rolesRes.data.roles);
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setName("");
    setEmail("");
    setNewRoleId("");
    setAddError(null);
    setAddOpen(true);
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2 || !email.trim()) return;
    setSaving(true);
    setAddError(null);
    try {
      const { data } = await api.post<{ linked: boolean; generatedPassword?: string }>(
        "/company/users",
        { name: name.trim(), email: email.trim(), customRoleId: newRoleId || null },
        { silent: true }
      );
      setAddOpen(false);
      if (data.generatedPassword) {
        setCredentials({ name: name.trim(), email: email.trim(), password: data.generatedPassword });
      } else {
        toast.success("Usuário já cadastrado foi vinculado à empresa (usa a senha que já possui).");
      }
      await load();
    } catch (err) {
      setAddError(apiErrorMessage(err, "Não foi possível adicionar o membro."));
    } finally {
      setSaving(false);
    }
  }

  async function assignRole(user: CompanyUser, roleId: string) {
    setBusyId(user.id);
    try {
      await api.patch(`/company/users/${user.id}`, { customRoleId: roleId || null });
      const roleName = roles.find((r) => r.id === roleId)?.name ?? null;
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, roleName } : u)));
      setDetail((d) => (d && d.id === user.id ? { ...d, roleName } : d));
      toast.success("Cargo atualizado.");
    } catch {
      /* toast global cuida do erro */
    } finally {
      setBusyId(null);
    }
  }

  async function resetMemberPassword(user: CompanyUser) {
    if (!confirm(`Gerar nova senha temporária para ${user.name}?`)) return;
    setBusyId(user.id);
    try {
      const { data } = await api.post<{ email: string; generatedPassword: string }>(
        `/company/users/${user.id}/reset-password`
      );
      setDetail(null);
      setCredentials({ name: user.name, email: data.email, password: data.generatedPassword });
      toast.success("Senha redefinida. Repasse a nova senha temporária.");
    } catch {
      /* toast global cuida do erro */
    } finally {
      setBusyId(null);
    }
  }

  async function removeMember(user: CompanyUser) {
    if (!confirm(`Remover ${user.name} da empresa?`)) return;
    setBusyId(user.id);
    try {
      await api.delete(`/company/users/${user.id}`);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setDetail(null);
      toast.success("Membro removido.");
    } catch {
      /* toast global cuida do erro */
    } finally {
      setBusyId(null);
    }
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).then(() => toast.success("Copiado."), () => {});
  }

  function label(u: CompanyUser) {
    return u.establishmentRole === "ADMIN" ? "Dono" : u.roleName ?? "Sem cargo";
  }

  return (
    <div className="p-6 md:p-10 w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Usuários {companyName ? `· ${companyName}` : ""}</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Equipe desta empresa. Adicione funcionários e atribua o cargo que define suas
            permissões.
          </p>
        </div>
        <button onClick={openAdd} className="orbita-btn px-4 py-2.5 shrink-0">
          + Adicionar membro
        </button>
      </div>

      {/* Barra de ferramentas */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          className="orbita-input flex-1 min-w-56 px-3 py-2.5"
          placeholder="Buscar por nome ou e-mail..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <ViewToggle mode={viewMode} onChange={setViewMode} />
      </div>
      <FilterTags tags={MEMBER_FILTERS} active={active} onToggle={toggleFilter} />

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="orbita-spinner" />
        </div>
      ) : filtered.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>
          {search.trim() || active.size ? "Nenhum usuário encontrado." : "Nenhum usuário nesta empresa."}
        </p>
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
                {!u.active && (
                  <span className="text-[10px]" style={{ color: "var(--danger)" }}>
                    inativo
                  </span>
                )}
              </div>
              <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                {u.email}
              </div>
              <div className="text-xs" style={{ color: "var(--brand-text)" }}>
                {label(u)}
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
              <Th>Vínculo</Th>
              <Th>Cargo</Th>
              <Th>Situação</Th>
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
                  {u.establishmentRole === "ADMIN" ? "Dono" : "Funcionário"}
                </td>
                <td className="px-4 py-2.5">
                  {u.establishmentRole === "ADMIN" ? "—" : u.roleName ?? "Sem cargo"}
                </td>
                <td className="px-4 py-2.5">
                  {u.active ? (
                    <span style={{ color: "var(--text-muted)" }}>Ativo</span>
                  ) : (
                    <span style={{ color: "var(--danger)" }}>Inativo</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}

      {/* Modal: adicionar membro */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Adicionar membro">
        <form onSubmit={addMember} className="space-y-4">
          <label className="block space-y-1">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Nome
            </span>
            <input
              className="orbita-input w-full px-3 py-2.5"
              placeholder="Nome do funcionário"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              E-mail
            </span>
            <input
              type="email"
              className="orbita-input w-full px-3 py-2.5"
              placeholder="email@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Cargo (opcional)
            </span>
            <select
              className="orbita-input w-full px-3 py-2.5"
              value={newRoleId}
              onChange={(e) => setNewRoleId(e.target.value)}
            >
              <option value="">Sem cargo</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          {addError && (
            <div
              className="rounded-lg px-3 py-2 text-sm"
              style={{ background: "rgba(248,113,113,0.12)", color: "var(--danger)" }}
            >
              {addError}
            </div>
          )}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving || name.trim().length < 2 || !email.trim()}
              className="orbita-btn px-4 py-2.5"
            >
              {saving ? "Adicionando..." : "Adicionar"}
            </button>
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="text-sm hover:underline"
              style={{ color: "var(--text-muted)" }}
            >
              Cancelar
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: credenciais de acesso */}
      <Modal open={!!credentials} onClose={() => setCredentials(null)} title="Credenciais de acesso">
        {credentials && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Repasse estes dados de acesso a <strong>{credentials.name}</strong>. A senha é
              temporária — o sistema exigirá a troca no primeiro login.
            </p>
            <div className="space-y-1">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                E-mail
              </span>
              <div
                className="rounded-lg border px-3 py-2 text-sm select-all break-all"
                style={{ borderColor: "var(--border-strong)" }}
              >
                {credentials.email}
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Senha temporária
              </span>
              <div
                className="rounded-lg border px-3 py-2 text-sm font-mono select-all break-all"
                style={{ borderColor: "var(--border-strong)", color: "var(--accent)" }}
              >
                {credentials.password}
              </div>
            </div>
            <button
              onClick={() => copy(`E-mail: ${credentials.email}\nSenha: ${credentials.password}`)}
              className="orbita-btn px-4 py-2.5 w-full"
            >
              Copiar e-mail e senha
            </button>
          </div>
        )}
      </Modal>

      {/* Modal: detalhes do membro */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? "Membro"}>
        {detail && (
          <div className="space-y-4">
            <div className="space-y-1 text-sm">
              <div>
                <span style={{ color: "var(--text-muted)" }}>E-mail: </span>
                <span className="select-all">{detail.email}</span>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Vínculo: </span>
                {detail.establishmentRole === "ADMIN" ? "Dono (ADMIN)" : "Funcionário (STAFF)"}
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Situação: </span>
                {detail.active ? "Ativo" : "Inativo"}
              </div>
            </div>

            {detail.establishmentRole === "ADMIN" ? (
              <p className="text-sm" style={{ color: "var(--brand-text)" }}>
                O Dono possui todas as permissões e não recebe cargo.
              </p>
            ) : (
              <>
                <label className="block space-y-1">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Cargo
                  </span>
                  <select
                    className="orbita-input w-full px-3 py-2.5"
                    disabled={busyId === detail.id}
                    value={roles.find((r) => r.name === detail.roleName)?.id ?? ""}
                    onChange={(e) => assignRole(detail, e.target.value)}
                  >
                    <option value="">Sem cargo</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={() => resetMemberPassword(detail)}
                  disabled={busyId === detail.id}
                  className="w-full rounded-lg border px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
                  style={{ borderColor: "var(--border-strong)" }}
                >
                  {busyId === detail.id ? "..." : "Resetar senha"}
                </button>
                <button
                  onClick={() => removeMember(detail)}
                  disabled={busyId === detail.id}
                  className="w-full rounded-lg border px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
                  style={{ borderColor: "var(--border-strong)", color: "var(--danger)" }}
                >
                  {busyId === detail.id ? "..." : "Remover da empresa"}
                </button>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
