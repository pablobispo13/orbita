"use client";

import { useEffect, useMemo, useState } from "react";
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
import { ALL_PERMISSIONS, PERMISSION_GROUPS, type Permission } from "@/lib/permissions";
import { useConfirm } from "@/components/ConfirmProvider";

// Filtros: um por grupo de permissão + "sem permissões".
const CARGO_FILTERS: FilterTag[] = [
  ...PERMISSION_GROUPS.map((g) => ({ key: g.label, label: g.label })),
  { key: "__none__", label: "Sem permissões" },
];

type Role = {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
};

type FormState = {
  id: string | null; // null => criando
  name: string;
  description: string;
  permissions: Set<string>;
};

const emptyForm: FormState = {
  id: null,
  name: "",
  description: "",
  permissions: new Set(),
};

// Rótulos legíveis das permissões (chave -> label), montados a partir dos grupos.
const PERMISSION_LABELS: Record<string, string> = Object.fromEntries(
  PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => [p.key, p.label]))
);

// Cargo de sistema: o Dono (ADMIN) da empresa. Tem todas as permissões de forma
// implícita (ver src/lib/auth.ts) — por isso é apenas exibido, não editável.
const OWNER_ROLE: Role = {
  id: "__owner__",
  name: "Dono",
  description: "Dono da empresa — acesso total. Cargo padrão, não editável.",
  permissions: ALL_PERMISSIONS as string[],
};

// CRUD de cargos (Roles) da empresa ativa. Escopo garantido pelo x-establishment-id.
export function CargosView({ companyName }: { companyName?: string | null }) {
  const confirm = useConfirm();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useViewMode("view_cargos");

  // Modal de criação/edição.
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Modal de detalhes (somente leitura). __owner__ => cargo Dono.
  const [detail, setDetail] = useState<Role | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const editing = form.id !== null;
  // Permissões são OPCIONAIS (um cargo pode nascer sem nenhuma — útil para a
  // modularização futura, quando módulos como estoque/financeiro podem estar off).
  const valid = form.name.trim().length >= 2;

  function toggleFilter(k: string) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  // Um cargo passa nos filtros de grupo se tiver alguma permissão do grupo (OR),
  // ou se "Sem permissões" estiver ativo e ele não tiver nenhuma.
  function matchesFilters(perms: string[]): boolean {
    const groups = PERMISSION_GROUPS.filter((g) => active.has(g.label));
    const noneActive = active.has("__none__");
    if (groups.length === 0 && !noneActive) return true;
    const inGroup = groups.some((g) => g.permissions.some((p) => perms.includes(p.key)));
    return inGroup || (noneActive && perms.length === 0);
  }

  function matchesSearch(name: string, description: string | null): boolean {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return name.toLowerCase().includes(q) || (description ?? "").toLowerCase().includes(q);
  }

  const filtered = useMemo(
    () =>
      roles.filter((r) => matchesSearch(r.name, r.description) && matchesFilters(r.permissions)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roles, search, active]
  );

  const showOwner =
    matchesSearch(OWNER_ROLE.name, OWNER_ROLE.description) &&
    matchesFilters(OWNER_ROLE.permissions);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get<{ roles: Role[] }>("/roles");
      setRoles(data.roles);
    } catch {
      /* toast global cuida do erro */
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setForm({ ...emptyForm, permissions: new Set() });
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(role: Role) {
    setForm({
      id: role.id,
      name: role.name,
      description: role.description ?? "",
      permissions: new Set(role.permissions),
    });
    setFormError(null);
    setFormOpen(true);
  }

  function togglePermission(key: Permission) {
    setForm((prev) => {
      const next = new Set(prev.permissions);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...prev, permissions: next };
    });
  }

  function toggleGroup(keys: Permission[], allOn: boolean) {
    setForm((prev) => {
      const next = new Set(prev.permissions);
      keys.forEach((k) => (allOn ? next.delete(k) : next.add(k)));
      return { ...prev, permissions: next };
    });
  }

  async function submit() {
    if (!valid) return;
    setSaving(true);
    setFormError(null);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      permissions: Array.from(form.permissions),
    };
    try {
      // `silent`: tratamos o motivo do erro inline na modal (sem toast duplicado).
      if (editing) {
        await api.put(`/roles/${form.id}`, payload, { silent: true });
        toast.success("Cargo atualizado.");
      } else {
        await api.post("/roles", payload, { silent: true });
        toast.success("Cargo criado.");
      }
      setFormOpen(false);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setFormError(apiErrorMessage(err, "Não foi possível salvar o cargo."));
    } finally {
      setSaving(false);
    }
  }

  async function remove(role: Role) {
    const ok = await confirm({
      title: "Excluir cargo",
      message: `Excluir o cargo "${role.name}"?`,
      confirmLabel: "Excluir",
      tone: "danger",
    });
    if (!ok) return;
    setDeletingId(role.id);
    try {
      await api.delete(`/roles/${role.id}`);
      toast.success("Cargo excluído.");
      await load();
    } catch {
      /* toast global cuida do erro */
    } finally {
      setDeletingId(null);
    }
  }

  const isOwnerDetail = detail?.id === OWNER_ROLE.id;

  return (
    <div className="p-6 md:p-10 w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Cargos {companyName ? `· ${companyName}` : ""}</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Defina cargos e as permissões que cada funcionário herda ao ser vinculado a eles.
          </p>
        </div>
        <button onClick={openCreate} className="orbita-btn px-4 py-2.5 shrink-0">
          + Novo cargo
        </button>
      </div>

      {/* Barra de ferramentas */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          className="orbita-input flex-1 min-w-56 px-3 py-2.5"
          placeholder="Buscar cargo por nome ou descrição..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <ViewToggle mode={viewMode} onChange={setViewMode} />
      </div>
      <FilterTags tags={CARGO_FILTERS} active={active} onToggle={toggleFilter} />

      {/* Lista de cargos */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="orbita-spinner" />
        </div>
      ) : !showOwner && filtered.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>
          {search.trim() || active.size
            ? "Nenhum cargo encontrado."
            : "Nenhum cargo criado ainda. Use “+ Novo cargo”."}
        </p>
      ) : viewMode === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {showOwner && (
            <button
              onClick={() => setDetail(OWNER_ROLE)}
              className="orbita-card p-4 space-y-3 text-left"
              style={{ borderColor: "var(--accent)" }}
            >
              <div className="flex items-center justify-between">
                <div className="font-medium">{OWNER_ROLE.name}</div>
                <span
                  className="text-[10px] px-2 py-0.5 rounded"
                  style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                >
                  Sistema
                </span>
              </div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                {OWNER_ROLE.description}
              </div>
              <span
                className="inline-block text-[10px] px-2 py-0.5 rounded"
                style={{ background: "var(--brand-soft)", color: "var(--brand-text)" }}
              >
                Todas as permissões
              </span>
            </button>
          )}

          {filtered.map((role) => (
            <div
              key={role.id}
              onClick={() => setDetail(role)}
              className="orbita-card p-4 space-y-3 cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">{role.name}</div>
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {role.permissions.length} perm.
                </span>
              </div>
              {role.description && (
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {role.description}
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {role.permissions.length === 0 ? (
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    Sem permissões
                  </span>
                ) : (
                  role.permissions.slice(0, 4).map((p) => (
                    <span
                      key={p}
                      className="text-[10px] px-2 py-0.5 rounded"
                      style={{ background: "var(--brand-soft)", color: "var(--brand-text)" }}
                    >
                      {PERMISSION_LABELS[p] ?? p}
                    </span>
                  ))
                )}
                {role.permissions.length > 4 && (
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    +{role.permissions.length - 4}
                  </span>
                )}
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(role);
                  }}
                  className="flex-1 rounded-lg border px-3 py-1.5 text-xs hover:bg-white/5"
                  style={{ borderColor: "var(--border-strong)" }}
                >
                  Editar
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(role);
                  }}
                  disabled={deletingId === role.id}
                  className="rounded-lg border px-3 py-1.5 text-xs hover:bg-white/5 disabled:opacity-50"
                  style={{ borderColor: "var(--border-strong)", color: "var(--danger)" }}
                >
                  {deletingId === role.id ? "..." : "Excluir"}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <DataTable>
          <thead>
            <tr>
              <Th>Cargo</Th>
              <Th>Descrição</Th>
              <Th>Permissões</Th>
              <Th>Ações</Th>
            </tr>
          </thead>
          <tbody>
            {showOwner && (
              <tr
                onClick={() => setDetail(OWNER_ROLE)}
                className="cursor-pointer border-b hover:bg-white/5"
                style={{ borderColor: "var(--border)" }}
              >
                <td className="px-4 py-2.5 font-medium">
                  {OWNER_ROLE.name}{" "}
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded align-middle"
                    style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                  >
                    Sistema
                  </span>
                </td>
                <td className="px-4 py-2.5" style={{ color: "var(--text-muted)" }}>
                  {OWNER_ROLE.description}
                </td>
                <td className="px-4 py-2.5">Todas</td>
                <td className="px-4 py-2.5" style={{ color: "var(--text-muted)" }}>
                  —
                </td>
              </tr>
            )}
            {filtered.map((role) => (
              <tr
                key={role.id}
                onClick={() => setDetail(role)}
                className="cursor-pointer border-b hover:bg-white/5"
                style={{ borderColor: "var(--border)" }}
              >
                <td className="px-4 py-2.5 font-medium">{role.name}</td>
                <td className="px-4 py-2.5" style={{ color: "var(--text-muted)" }}>
                  {role.description ?? "—"}
                </td>
                <td className="px-4 py-2.5">{role.permissions.length}</td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(role);
                      }}
                      className="rounded-lg border px-2.5 py-1 text-xs hover:bg-white/5"
                      style={{ borderColor: "var(--border-strong)" }}
                    >
                      Editar
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(role);
                      }}
                      disabled={deletingId === role.id}
                      className="rounded-lg border px-2.5 py-1 text-xs hover:bg-white/5 disabled:opacity-50"
                      style={{ borderColor: "var(--border-strong)", color: "var(--danger)" }}
                    >
                      {deletingId === role.id ? "..." : "Excluir"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}

      {/* Modal: criar / editar cargo */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Editar cargo" : "Novo cargo"}
        maxWidth="max-w-2xl"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Nome do cargo
            </span>
            <input
              className="orbita-input w-full px-3 py-2.5"
              placeholder="Ex.: Gerente, Caixa, Estoquista"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Descrição (opcional)
            </span>
            <input
              className="orbita-input w-full px-3 py-2.5"
              placeholder="Breve descrição do cargo"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </label>
        </div>

        <div className="space-y-3">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Permissões (opcional)
          </span>
          <div className="grid gap-4 sm:grid-cols-2">
            {PERMISSION_GROUPS.map((group) => {
              const keys = group.permissions.map((p) => p.key);
              const allOn = keys.every((k) => form.permissions.has(k));
              return (
                <div
                  key={group.label}
                  className="rounded-lg border p-3 space-y-2"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{group.label}</span>
                    <button
                      type="button"
                      onClick={() => toggleGroup(keys, allOn)}
                      className="text-[11px] hover:underline"
                      style={{ color: "var(--brand-text)" }}
                    >
                      {allOn ? "Limpar" : "Selecionar tudo"}
                    </button>
                  </div>
                  {group.permissions.map((perm) => (
                    <label
                      key={perm.key}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={form.permissions.has(perm.key)}
                        onChange={() => togglePermission(perm.key)}
                      />
                      {perm.label}
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {formError && (
          <div
            className="rounded-lg px-3 py-2 text-sm"
            style={{ background: "rgba(248,113,113,0.12)", color: "var(--danger)" }}
          >
            {formError}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={submit}
            disabled={!valid || saving}
            className="orbita-btn px-4 py-2.5"
          >
            {saving ? "Salvando..." : editing ? "Salvar alterações" : "Criar cargo"}
          </button>
          <button
            type="button"
            onClick={() => setFormOpen(false)}
            className="orbita-btn-secondary px-4 py-2.5"
          >
            Cancelar
          </button>
        </div>
      </Modal>

      {/* Modal: detalhes do cargo (somente leitura) */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.name ?? "Cargo"}
        maxWidth="max-w-lg"
      >
        {detail && (
          <div className="space-y-4">
            {detail.description && (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {detail.description}
              </p>
            )}
            {isOwnerDetail ? (
              <p className="text-sm" style={{ color: "var(--brand-text)" }}>
                Este cargo possui <strong>todas as permissões</strong> do sistema de forma
                implícita.
              </p>
            ) : (
              <div className="space-y-3">
                {PERMISSION_GROUPS.map((group) => (
                  <div key={group.label} className="space-y-1">
                    <div className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                      {group.label}
                    </div>
                    <div className="grid gap-1">
                      {group.permissions.map((perm) => {
                        const has = detail.permissions.includes(perm.key);
                        return (
                          <div
                            key={perm.key}
                            className="flex items-center gap-2 text-sm"
                            style={{ color: has ? "var(--text)" : "var(--text-muted)" }}
                          >
                            <span aria-hidden style={{ color: has ? "var(--accent)" : "inherit" }}>
                              {has ? "✔" : "—"}
                            </span>
                            {perm.label}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!isOwnerDetail && (
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    const r = detail;
                    setDetail(null);
                    if (r) openEdit(r);
                  }}
                  className="orbita-btn px-4 py-2"
                >
                  Editar
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
