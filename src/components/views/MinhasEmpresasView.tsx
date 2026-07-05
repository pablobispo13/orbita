"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import api, { apiErrorMessage } from "@/lib/api";
import { useAuthContext } from "@/context/AuthContext";
import { Modal } from "@/components/Modal";
import type { Membership } from "@/context/AuthContext";

type CompanyForm = { name: string; document: string; phone: string; address: string };

// Hub do usuário: todas as empresas às quais ele pertence, agrupadas por papel
// (Dono × Membro). Entrar abre a empresa; o dono pode editar os dados dela.
export function MinhasEmpresasView() {
  const { user, activeEstablishmentId, setActiveEstablishment } = useAuthContext();
  const memberships = user?.memberships ?? [];

  const owner = memberships.filter((m) => m.role === "ADMIN");
  const member = memberships.filter((m) => m.role === "STAFF");

  // Edição da empresa (dono): carrega dados atuais e faz PATCH /company/establishment.
  const [editing, setEditing] = useState<Membership | null>(null);
  const [form, setForm] = useState<CompanyForm>({ name: "", document: "", phone: "", address: "" });
  const [loadingForm, setLoadingForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function enter(m: Membership) {
    setActiveEstablishment(m.establishment.id);
    window.location.href = `/${m.establishment.slug}/dashboard`;
  }

  async function openEdit(m: Membership) {
    setEditing(m);
    setError(null);
    setForm({ name: m.establishment.name, document: "", phone: "", address: "" });
    setLoadingForm(true);
    // Ativa a empresa para que o x-establishment-id acompanhe a requisição.
    setActiveEstablishment(m.establishment.id);
    try {
      const { data } = await api.get<{
        establishment: { name: string; document: string | null; phone: string | null; address: string | null };
      }>("/company/establishment", { silent: true });
      const e = data.establishment;
      setForm({
        name: e.name ?? m.establishment.name,
        document: e.document ?? "",
        phone: e.phone ?? "",
        address: e.address ?? "",
      });
    } catch {
      /* mantém o que já temos */
    } finally {
      setLoadingForm(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || form.name.trim().length < 2) return;
    setSaving(true);
    setError(null);
    // Garante o escopo correto mesmo se a empresa ativa mudou entre abrir e salvar.
    setActiveEstablishment(editing.establishment.id);
    try {
      await api.patch(
        "/company/establishment",
        {
          name: form.name.trim(),
          document: form.document.trim() || null,
          phone: form.phone.trim() || null,
          address: form.address.trim() || null,
        },
        { silent: true }
      );
      toast.success("Empresa atualizada. Recarregue para ver o novo nome no menu.");
      setEditing(null);
    } catch (err) {
      setError(apiErrorMessage(err, "Não foi possível salvar."));
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  const section = (label: string, items: Membership[], canEdit: boolean) =>
    items.length > 0 && (
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          {label}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((m) => {
            const isActive = m.establishment.id === activeEstablishmentId;
            return (
              <div
                key={m.establishment.id}
                className="orbita-card p-4 space-y-3 flex flex-col h-full"
                style={{ borderColor: isActive ? "var(--accent)" : "var(--border)" }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{m.establishment.name}</span>
                  <span className="text-xs font-mono text-[var(--accent)]">/{m.establishment.slug}</span>
                </div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {m.role === "ADMIN" ? "Você é o dono" : `Cargo: ${m.customRole?.name ?? "Sem cargo"}`}
                </div>
                <div className="flex gap-2 mt-auto pt-1">
                  <button
                    onClick={() => enter(m)}
                    className="flex-1 rounded-lg px-3 py-2 text-xs font-medium"
                    style={{ background: "var(--brand-soft)", color: "var(--brand-text)" }}
                  >
                    Entrar
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => openEdit(m)}
                      className="rounded-lg border px-3 py-2 text-xs hover:bg-white/5"
                      style={{ borderColor: "var(--border-strong)" }}
                    >
                      Editar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );

  return (
    <div className="p-6 md:p-10 w-full space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Minhas Empresas</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Todas as empresas às quais você pertence. Entre em uma para operá-la ou use o seletor
          no topo para trocar rapidamente.
        </p>
      </div>

      {memberships.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>Você ainda não está vinculado a nenhuma empresa.</p>
      ) : (
        <>
          {section("Onde sou dono", owner, true)}
          {section("Onde sou membro", member, false)}
        </>
      )}

      {/* Modal: editar dados da própria empresa (dono) */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar empresa">
        <form onSubmit={save} className="space-y-4">
          {loadingForm ? (
            <div className="flex justify-center py-6">
              <div className="orbita-spinner" />
            </div>
          ) : (
            <>
              <Field label="Nome" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Nome da empresa" />
              <Field label="Documento (CNPJ/CPF)" value={form.document} onChange={(v) => setForm((f) => ({ ...f, document: v }))} placeholder="00.000.000/0000-00" />
              <Field label="Telefone" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} placeholder="(00) 00000-0000" />
              <Field label="Endereço" value={form.address} onChange={(v) => setForm((f) => ({ ...f, address: v }))} placeholder="Rua, número, bairro" />
              {error && (
                <div className="rounded-lg px-3 py-2 text-sm" style={{ background: "rgba(248,113,113,0.12)", color: "var(--danger)" }}>
                  {error}
                </div>
              )}
              <div className="flex items-center gap-3 pt-1">
                <button type="button" onClick={() => setEditing(null)} className="orbita-btn-secondary px-4 py-2.5">
                  Cancelar
                </button>
                <button type="submit" disabled={saving || form.name.trim().length < 2} className="orbita-btn px-4 py-2.5">
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </>
          )}
        </form>
      </Modal>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <input
        className="orbita-input w-full px-3 py-2.5"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
