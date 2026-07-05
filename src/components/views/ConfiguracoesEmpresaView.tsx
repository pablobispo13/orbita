"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import api, { apiErrorMessage } from "@/lib/api";
import { slugify } from "@/lib/slugify";
import { useAuthContext } from "@/context/AuthContext";
import { PERMISSIONS } from "@/lib/permissions";

type Establishment = {
  id: string;
  name: string;
  slug: string;
  document: string | null;
  phone: string | null;
  address: string | null;
  active: boolean;
};

type Form = { name: string; slug: string; document: string; phone: string; address: string };

// Configurações da empresa ATIVA. Qualquer membro visualiza; apenas quem tem
// ESTABLISHMENT_MANAGE (dono/ADMIN ou cargo com a permissão) pode salvar.
export function ConfiguracoesEmpresaView({ companyName }: { companyName?: string | null }) {
  const { user, activeEstablishmentId } = useAuthContext();
  const [data, setData] = useState<Establishment | null>(null);
  const [form, setForm] = useState<Form>({ name: "", slug: "", document: "", phone: "", address: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pode gerenciar se é o dono (ADMIN) ou o cargo inclui establishment:manage.
  const canManage = useMemo(() => {
    const m = user?.memberships.find((x) => x.establishment.id === activeEstablishmentId);
    if (!m) return user?.role === "SUPER_ADMIN";
    return m.role === "ADMIN" || (m.customRole?.permissions ?? []).includes(PERMISSIONS.ESTABLISHMENT_MANAGE);
  }, [user, activeEstablishmentId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<{ establishment: Establishment }>("/company/establishment")
      .then(({ data }) => {
        if (cancelled) return;
        setData(data.establishment);
        setForm({
          name: data.establishment.name,
          slug: data.establishment.slug,
          document: data.establishment.document ?? "",
          phone: data.establishment.phone ?? "",
          address: data.establishment.address ?? "",
        });
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [activeEstablishmentId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage || form.name.trim().length < 2) return;
    setSaving(true);
    setError(null);
    try {
      const nextSlug = slugify(form.slug);
      const slugChanged = !!nextSlug && !!data && nextSlug !== data.slug;
      const { data: res } = await api.patch<{ establishment: Establishment }>(
        "/company/establishment",
        {
          name: form.name.trim(),
          document: form.document.trim() || null,
          phone: form.phone.trim() || null,
          address: form.address.trim() || null,
          ...(slugChanged ? { slug: nextSlug } : {}),
        },
        { silent: true }
      );
      setData(res.establishment);
      setForm((f) => ({ ...f, slug: res.establishment.slug }));
      if (slugChanged) {
        toast.success("URL atualizada. Você será redirecionado para o novo endereço.");
        setTimeout(() => (window.location.href = `/${res.establishment.slug}/dashboard`), 1200);
      } else {
        toast.success("Empresa atualizada. Recarregue para ver o novo nome no topo/menu.");
      }
    } catch (err) {
      setError(apiErrorMessage(err, "Não foi possível salvar."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 md:p-10 w-full max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Empresa {companyName ? `· ${companyName}` : ""}</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Dados cadastrais desta empresa.{" "}
          {canManage ? "Edite e salve as alterações." : "Somente o dono pode editar."}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="orbita-spinner" />
        </div>
      ) : !data ? (
        <p style={{ color: "var(--text-muted)" }}>Não foi possível carregar a empresa.</p>
      ) : (
        <form onSubmit={save} className="space-y-4">
          <Field label="Nome" value={form.name} disabled={!canManage} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
          <label className="block space-y-1">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              URL pública {!data.active && <span style={{ color: "var(--danger)" }}>· inativa</span>}
            </span>
            <div className="flex items-center rounded-lg border overflow-hidden" style={{ borderColor: "var(--border-strong)" }}>
              <span className="px-3 py-2.5 text-sm select-none" style={{ color: "var(--text-muted)", background: "var(--surface)" }}>
                /
              </span>
              <input
                className="orbita-input flex-1 px-3 py-2.5 border-0 rounded-none disabled:opacity-60"
                value={form.slug}
                disabled={!canManage}
                onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
                placeholder="minha-empresa"
              />
            </div>
            {canManage && (
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                Endereço de acesso da empresa. Trocar invalida o link antigo.
              </span>
            )}
          </label>
          <Field label="Documento (CNPJ/CPF)" value={form.document} disabled={!canManage} onChange={(v) => setForm((f) => ({ ...f, document: v }))} />
          <Field label="Telefone" value={form.phone} disabled={!canManage} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
          <Field label="Endereço" value={form.address} disabled={!canManage} onChange={(v) => setForm((f) => ({ ...f, address: v }))} />
          {error && (
            <div className="rounded-lg px-3 py-2 text-sm" style={{ background: "rgba(248,113,113,0.12)", color: "var(--danger)" }}>
              {error}
            </div>
          )}
          {canManage && (
            <button type="submit" disabled={saving || form.name.trim().length < 2} className="orbita-btn px-4 py-2.5">
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          )}
        </form>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <input
        className="orbita-input w-full px-3 py-2.5 disabled:opacity-60"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
