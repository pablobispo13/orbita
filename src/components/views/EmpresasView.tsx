"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useAuthContext } from "@/context/AuthContext";
import api, { apiErrorMessage } from "@/lib/api";
import { slugify } from "@/lib/slugify";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  DataTable,
  FilterTags,
  Th,
  ViewToggle,
  useViewMode,
  type FilterTag,
} from "@/components/ListControls";

type AdminEstablishment = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  document: string | null;
  phone: string | null;
  address: string | null;
  owner: { id: string; name: string; email: string };
  owners: { id: string; name: string; email: string }[];
  _count: { memberships: number; products: number; stockItems: number };
};

type SystemUser = { id: string; name: string; email: string };

type Credentials = { name: string; email: string; password: string };

const EMPRESA_FILTERS: FilterTag[] = [
  { key: "active", label: "Ativas" },
  { key: "inactive", label: "Inativas" },
];

// ownerId === NEW_OWNER => cadastrar um dono novo (por e-mail).
const NEW_OWNER = "__new__";
const emptyForm = {
  name: "",
  ownerId: "",
  ownerEmail: "",
  ownerName: "",
  document: "",
  phone: "",
  address: "",
};
type Form = typeof emptyForm;

export function EmpresasView() {
  const { user, activeEstablishmentId, setActiveEstablishment } = useAuthContext();
  const [establishments, setEstablishments] = useState<AdminEstablishment[]>([]);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useViewMode("view_empresas");

  // Criação.
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);

  // Edição.
  const [editing, setEditing] = useState<AdminEstablishment | null>(null);
  const [editForm, setEditForm] = useState({ name: "", slug: "", document: "", phone: "", address: "" });
  const [ownerIds, setOwnerIds] = useState<string[]>([]);
  const [ownerSearch, setOwnerSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Confirmação (modal) para ativar/inativar empresa.
  const [confirmToggle, setConfirmToggle] = useState<AdminEstablishment | null>(null);

  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  useEffect(() => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }
    load();
  }, [isSuperAdmin]);

  async function load() {
    setLoading(true);
    try {
      const [estRes, usersRes] = await Promise.all([
        api.get<{ establishments: AdminEstablishment[] }>("/admin/establishments"),
        api
          .get<{ users: SystemUser[] }>("/admin/users", { silent: true })
          .catch(() => ({ data: { users: [] as SystemUser[] } })),
      ]);
      setEstablishments(estRes.data.establishments);
      setUsers(usersRes.data.users);
    } catch {
      /* toast global cuida do erro */
    } finally {
      setLoading(false);
    }
  }

  // Recarrega só a lista de empresas (após criar/editar), preservando usuários.
  async function reloadEstablishments() {
    try {
      const { data } = await api.get<{ establishments: AdminEstablishment[] }>("/admin/establishments");
      setEstablishments(data.establishments);
    } catch {
      /* toast global cuida do erro */
    }
  }

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
    const wantActive = active.has("active");
    const wantInactive = active.has("inactive");
    return establishments.filter((e) => {
      const matchesSearch =
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.slug.toLowerCase().includes(q) ||
        e.owner.name.toLowerCase().includes(q);
      const matchesStatus =
        (!wantActive && !wantInactive) ||
        (wantActive && e.active) ||
        (wantInactive && !e.active);
      return matchesSearch && matchesStatus;
    });
  }, [establishments, search, active]);

  // Candidatos a dono na edição: todos os usuários + garante os donos atuais,
  // filtrados pela busca do modal.
  const ownerCandidates = useMemo(() => {
    const base: SystemUser[] = [...users];
    if (editing) {
      for (const o of editing.owners) if (!base.some((u) => u.id === o.id)) base.push(o);
      if (!base.some((u) => u.id === editing.owner.id)) base.push(editing.owner);
    }
    const q = ownerSearch.trim().toLowerCase();
    return q
      ? base.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      : base;
  }, [users, editing, ownerSearch]);

  if (!user) return null;

  if (!isSuperAdmin) {
    return (
      <div className="p-6 md:p-10 max-w-4xl mx-auto">
        <p style={{ color: "var(--text-muted)" }}>Acesso restrito ao super admin.</p>
      </div>
    );
  }

  function enter(e: AdminEstablishment) {
    setActiveEstablishment(e.id);
    window.location.href = `/${e.slug}/dashboard`;
  }

  function openCreate() {
    // Pré-seleciona o 1º usuário da lista (ou "novo dono" se não houver nenhum).
    setForm({ ...emptyForm, ownerId: users[0]?.id ?? NEW_OWNER });
    setFormError(null);
    setCreateOpen(true);
  }

  const creatingNewOwner = form.ownerId === NEW_OWNER;
  const createValid =
    form.name.trim().length >= 2 &&
    (creatingNewOwner ? !!form.ownerEmail.trim() : !!form.ownerId);

  async function createEstablishment(ev: React.FormEvent) {
    ev.preventDefault();
    if (!createValid) return;
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: form.name.trim(),
        document: form.document.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        ...(creatingNewOwner
          ? { ownerEmail: form.ownerEmail.trim(), ownerName: form.ownerName.trim() || undefined }
          : { ownerId: form.ownerId }),
      };
      const { data } = await api.post<{ generatedPassword: string | null; ownerCreated: boolean }>(
        "/admin/establishments",
        payload,
        { silent: true }
      );
      setCreateOpen(false);
      if (data.generatedPassword) {
        setCredentials({
          name: form.ownerName.trim() || form.ownerEmail.trim(),
          email: form.ownerEmail.trim(),
          password: data.generatedPassword,
        });
      } else {
        toast.success("Empresa criada e vinculada ao dono.");
      }
      await reloadEstablishments();
    } catch (err) {
      setFormError(apiErrorMessage(err, "Não foi possível criar a empresa."));
    } finally {
      setSaving(false);
    }
  }

  function openEdit(e: AdminEstablishment) {
    setEditing(e);
    setFormError(null);
    setOwnerSearch("");
    setEditForm({
      name: e.name,
      slug: e.slug,
      document: e.document ?? "",
      phone: e.phone ?? "",
      address: e.address ?? "",
    });
    // Donos atuais (memberships ADMIN); cai no dono primário se a lista vier vazia.
    setOwnerIds(e.owners.length ? e.owners.map((o) => o.id) : [e.owner.id]);
  }

  function toggleOwner(userId: string) {
    setOwnerIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  async function saveEdit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!editing || editForm.name.trim().length < 2) return;
    if (ownerIds.length === 0) {
      setFormError("Selecione ao menos um dono para a empresa.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const currentOwners = (editing.owners.length ? editing.owners.map((o) => o.id) : [editing.owner.id]).slice().sort();
      const nextOwners = ownerIds.slice().sort();
      const ownersChanged = JSON.stringify(currentOwners) !== JSON.stringify(nextOwners);
      const nextSlug = slugify(editForm.slug);
      const slugChanged = nextSlug && nextSlug !== editing.slug;
      const { data } = await api.patch<{ establishment: AdminEstablishment }>(
        `/admin/establishments/${editing.id}`,
        {
          name: editForm.name.trim(),
          document: editForm.document.trim() || null,
          phone: editForm.phone.trim() || null,
          address: editForm.address.trim() || null,
          ...(ownersChanged ? { ownerIds } : {}),
          ...(slugChanged ? { slug: nextSlug } : {}),
        },
        { silent: true }
      );
      setEstablishments((prev) => prev.map((e) => (e.id === editing.id ? { ...e, ...data.establishment } : e)));
      setEditing(null);
      toast.success(ownersChanged ? "Empresa e donos atualizados." : "Empresa atualizada.");
    } catch (err) {
      setFormError(apiErrorMessage(err, "Não foi possível salvar."));
    } finally {
      setSaving(false);
    }
  }

  async function confirmToggleActive() {
    const e = confirmToggle;
    if (!e) return;
    setBusyId(e.id);
    try {
      const { data } = await api.patch<{ establishment: AdminEstablishment }>(
        `/admin/establishments/${e.id}`,
        { active: !e.active }
      );
      setEstablishments((prev) => prev.map((x) => (x.id === e.id ? { ...x, active: data.establishment.active } : x)));
      toast.success(e.active ? "Empresa inativada." : "Empresa ativada.");
      setConfirmToggle(null);
    } catch {
      /* toast global cuida do erro */
    } finally {
      setBusyId(null);
    }
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).then(() => toast.success("Copiado."), () => {});
  }

  return (
    <div className="p-6 md:p-10 w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Empresas</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Todas as empresas da plataforma. Crie, edite e selecione uma para operar como super admin.
          </p>
        </div>
        <button onClick={openCreate} className="orbita-btn px-4 py-2.5 shrink-0">
          + Nova empresa
        </button>
      </div>

      {/* Barra de ferramentas */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          className="orbita-input flex-1 min-w-56 px-3 py-2.5"
          placeholder="Buscar por nome, slug ou dono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <ViewToggle mode={viewMode} onChange={setViewMode} />
      </div>
      <FilterTags tags={EMPRESA_FILTERS} active={active} onToggle={toggleFilter} />

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="orbita-spinner" />
        </div>
      ) : filtered.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>
          {search.trim() || active.size
            ? "Nenhuma empresa encontrada."
            : "Nenhuma empresa cadastrada ainda."}
        </p>
      ) : viewMode === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {filtered.map((e) => {
            const isActive = e.id === activeEstablishmentId;
            return (
              <div
                key={e.id}
                className="orbita-card p-4 space-y-3 flex flex-col h-full"
                style={{ borderColor: isActive ? "var(--accent)" : "var(--border)" }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{e.name}</span>
                  <a href={`/${e.slug}`} className="text-xs font-mono text-[var(--accent)] hover:underline">
                    /{e.slug}
                  </a>
                </div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Dono: {e.owner.name}
                  {!e.active && <span style={{ color: "var(--danger)" }}> · inativa</span>}
                </div>
                <div className="flex gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
                  <span>👥 {e._count.memberships}</span>
                  <span>🍕 {e._count.products}</span>
                  <span>📦 {e._count.stockItems}</span>
                </div>
                <div className="flex gap-2 mt-auto pt-1">
                  <button
                    onClick={() => enter(e)}
                    disabled={isActive}
                    className="flex-1 rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-60"
                    style={{
                      background: isActive ? "var(--accent-soft)" : "var(--brand-soft)",
                      color: isActive ? "var(--accent)" : "var(--brand-text)",
                    }}
                  >
                    {isActive ? "● Ativa" : "Entrar"}
                  </button>
                  <button
                    onClick={() => openEdit(e)}
                    className="rounded-lg border px-3 py-2 text-xs hover:bg-white/5"
                    style={{ borderColor: "var(--border-strong)" }}
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => setConfirmToggle(e)}
                    disabled={busyId === e.id}
                    className="rounded-lg border px-3 py-2 text-xs hover:bg-white/5 disabled:opacity-50"
                    style={{ borderColor: "var(--border-strong)", color: e.active ? "var(--danger)" : "var(--text)" }}
                  >
                    {e.active ? "Inativar" : "Ativar"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <DataTable>
          <thead>
            <tr>
              <Th>Empresa</Th>
              <Th>Slug</Th>
              <Th>Dono</Th>
              <Th>Membros</Th>
              <Th>Situação</Th>
              <Th>Ações</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => {
              const isActive = e.id === activeEstablishmentId;
              return (
                <tr key={e.id} className="border-b hover:bg-white/5" style={{ borderColor: "var(--border)" }}>
                  <td className="px-4 py-2.5 font-medium">{e.name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">
                    <a href={`/${e.slug}`} className="text-[var(--accent)] hover:underline">
                      /{e.slug}
                    </a>
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--text-muted)" }}>
                    {e.owner.name}
                  </td>
                  <td className="px-4 py-2.5">{e._count.memberships}</td>
                  <td className="px-4 py-2.5">
                    {e.active ? (
                      <span style={{ color: "var(--text-muted)" }}>Ativa</span>
                    ) : (
                      <span style={{ color: "var(--danger)" }}>Inativa</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-2">
                      <button
                        onClick={() => enter(e)}
                        disabled={isActive}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                        style={{
                          background: isActive ? "var(--accent-soft)" : "var(--brand-soft)",
                          color: isActive ? "var(--accent)" : "var(--brand-text)",
                        }}
                      >
                        {isActive ? "● Ativa" : "Entrar"}
                      </button>
                      <button
                        onClick={() => openEdit(e)}
                        className="rounded-lg border px-3 py-1.5 text-xs hover:bg-white/5"
                        style={{ borderColor: "var(--border-strong)" }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => setConfirmToggle(e)}
                        disabled={busyId === e.id}
                        className="rounded-lg border px-3 py-1.5 text-xs hover:bg-white/5 disabled:opacity-50"
                        style={{ borderColor: "var(--border-strong)", color: e.active ? "var(--danger)" : "var(--text)" }}
                      >
                        {e.active ? "Inativar" : "Ativar"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      )}

      {/* Modal: nova empresa */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nova empresa">
        <form onSubmit={createEstablishment} className="space-y-4">
          <Field label="Nome da empresa" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Pizzaria do João" />

          <label className="block space-y-1">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Dono
            </span>
            <select
              className="orbita-input w-full px-3 py-2.5 truncate"
              style={{ textOverflow: "ellipsis" }}
              value={form.ownerId}
              onChange={(e) => setForm((f) => ({ ...f, ownerId: e.target.value }))}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} — {u.email}
                </option>
              ))}
              <option value={NEW_OWNER}>➕ Cadastrar novo dono…</option>
            </select>
          </label>

          {creatingNewOwner && (
            <div className="space-y-4 rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
              <Field label="E-mail do novo dono" type="email" value={form.ownerEmail} onChange={(v) => setForm((f) => ({ ...f, ownerEmail: v }))} placeholder="dono@empresa.com" />
              <Field label="Nome do novo dono" value={form.ownerName} onChange={(v) => setForm((f) => ({ ...f, ownerName: v }))} placeholder="Opcional — usamos o e-mail se vazio" />
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Se o e-mail já existir, a empresa é vinculada a esse usuário. Se for novo, criamos o
                dono com uma senha temporária mostrada uma única vez.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Documento" value={form.document} onChange={(v) => setForm((f) => ({ ...f, document: v }))} placeholder="CNPJ/CPF" />
            <Field label="Telefone" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} placeholder="(00) 00000-0000" />
          </div>
          <Field label="Endereço" value={form.address} onChange={(v) => setForm((f) => ({ ...f, address: v }))} placeholder="Rua, número, bairro" />
          {formError && (
            <div className="rounded-lg px-3 py-2 text-sm" style={{ background: "rgba(248,113,113,0.12)", color: "var(--danger)" }}>
              {formError}
            </div>
          )}
          <div className="flex items-center gap-3 pt-1">
            <button type="button" onClick={() => setCreateOpen(false)} className="orbita-btn-secondary px-4 py-2.5">
              Cancelar
            </button>
            <button type="submit" disabled={saving || !createValid} className="orbita-btn px-4 py-2.5">
              {saving ? "Criando..." : "Criar empresa"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: editar empresa */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar empresa">
        <form onSubmit={saveEdit} className="space-y-4">
          <Field label="Nome" value={editForm.name} onChange={(v) => setEditForm((f) => ({ ...f, name: v }))} placeholder="Nome da empresa" />

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Donos ({ownerIds.length})
              </span>
            </div>
            <input
              className="orbita-input w-full px-3 py-2"
              placeholder="Buscar usuário por nome ou e-mail..."
              value={ownerSearch}
              onChange={(e) => setOwnerSearch(e.target.value)}
            />
            <div
              className="rounded-lg border max-h-52 overflow-y-auto divide-y"
              style={{ borderColor: "var(--border-strong)" }}
            >
              {ownerCandidates.length === 0 ? (
                <div className="px-3 py-3 text-sm" style={{ color: "var(--text-muted)" }}>
                  Nenhum usuário encontrado.
                </div>
              ) : (
                ownerCandidates.map((u) => {
                  const checked = ownerIds.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-white/5"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOwner(u.id)}
                        className="shrink-0"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium truncate">{u.name}</span>
                        <span className="block text-xs truncate" style={{ color: "var(--text-muted)" }}>
                          {u.email}
                        </span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              Marque um ou mais donos. Cada dono é ADMIN (acesso total) da empresa. Desmarcar um dono
              o rebaixa a funcionário (mantém o vínculo).
            </span>
          </div>

          <label className="block space-y-1">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              URL pública
            </span>
            <div
              className="flex items-center rounded-lg border overflow-hidden"
              style={{ borderColor: "var(--border-strong)" }}
            >
              <span className="px-3 py-2.5 text-sm select-none" style={{ color: "var(--text-muted)", background: "var(--surface)" }}>
                /
              </span>
              <input
                className="orbita-input flex-1 px-3 py-2.5 border-0 rounded-none"
                value={editForm.slug}
                onChange={(e) => setEditForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
                placeholder="minha-empresa"
              />
            </div>
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              Este é o endereço de acesso (ex.: /{slugify(editForm.slug) || "minha-empresa"}). Trocar
              invalida o link antigo.
            </span>
          </label>

          <Field label="Documento" value={editForm.document} onChange={(v) => setEditForm((f) => ({ ...f, document: v }))} placeholder="CNPJ/CPF" />
          <Field label="Telefone" value={editForm.phone} onChange={(v) => setEditForm((f) => ({ ...f, phone: v }))} placeholder="(00) 00000-0000" />
          <Field label="Endereço" value={editForm.address} onChange={(v) => setEditForm((f) => ({ ...f, address: v }))} placeholder="Rua, número, bairro" />
          {formError && (
            <div className="rounded-lg px-3 py-2 text-sm" style={{ background: "rgba(248,113,113,0.12)", color: "var(--danger)" }}>
              {formError}
            </div>
          )}
          <div className="flex items-center gap-3 pt-1">
            <button type="button" onClick={() => setEditing(null)} className="orbita-btn-secondary px-4 py-2.5">
              Cancelar
            </button>
            <button type="submit" disabled={saving || editForm.name.trim().length < 2} className="orbita-btn px-4 py-2.5">
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: credenciais do dono recém-criado */}
      <Modal open={!!credentials} onClose={() => setCredentials(null)} title="Credenciais do dono">
        {credentials && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Repasse estes dados ao dono <strong>{credentials.name}</strong>. A senha é temporária —
              o sistema exigirá a troca no primeiro login.
            </p>
            <div className="space-y-1">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>E-mail</span>
              <div className="rounded-lg border px-3 py-2 text-sm select-all break-all" style={{ borderColor: "var(--border-strong)" }}>
                {credentials.email}
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>Senha temporária</span>
              <div className="rounded-lg border px-3 py-2 text-sm font-mono select-all break-all" style={{ borderColor: "var(--border-strong)", color: "var(--accent)" }}>
                {credentials.password}
              </div>
            </div>
            <button onClick={() => copy(`E-mail: ${credentials.email}\nSenha: ${credentials.password}`)} className="orbita-btn px-4 py-2.5 w-full">
              Copiar e-mail e senha
            </button>
          </div>
        )}
      </Modal>

      {/* Confirmação: ativar/inativar empresa */}
      <ConfirmDialog
        open={!!confirmToggle}
        title={confirmToggle?.active ? "Inativar empresa" : "Ativar empresa"}
        message={
          confirmToggle?.active ? (
            <>
              Deseja inativar a empresa <strong>{confirmToggle?.name}</strong>? Ela deixa de aparecer
              como ativa na plataforma.
            </>
          ) : (
            <>
              Deseja reativar a empresa <strong>{confirmToggle?.name}</strong>?
            </>
          )
        }
        confirmLabel={confirmToggle?.active ? "Inativar" : "Ativar"}
        tone={confirmToggle?.active ? "danger" : "default"}
        loading={busyId === confirmToggle?.id}
        onConfirm={confirmToggleActive}
        onCancel={() => setConfirmToggle(null)}
      />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <input
        type={type}
        className="orbita-input w-full px-3 py-2.5"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
