"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import api, { apiErrorMessage } from "@/lib/api";
import { slugify } from "@/lib/slugify";
import { useAuthContext } from "@/context/AuthContext";
import { PERMISSIONS } from "@/lib/permissions";
import {
  type CompanySettings,
  type CompanyMenuKey,
  COMPANY_MENU_KEYS,
  DEFAULT_SETTINGS,
  settingsToCssVars,
} from "@/lib/settings";
import { applyCompanyTheme } from "@/lib/theme";

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

  // Dados cadastrais e aparência: EXCLUSIVOS do super admin.
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  // Gestão da empresa (operações, notificações): dono/ADMIN ou cargo com a permissão.
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
    if (!isSuperAdmin || form.name.trim().length < 2) return;
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
    <div className="p-6 md:p-10 w-full max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Empresa {companyName ? `· ${companyName}` : ""}</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Configurações desta empresa.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="orbita-spinner" />
        </div>
      ) : !data ? (
        <p style={{ color: "var(--text-muted)" }}>Não foi possível carregar a empresa.</p>
      ) : (
        // Cards lado a lado em telas largas; empilham no mobile. Dados e
        // Aparência são assunto do SUPER_ADMIN — o dono nem os vê.
        <div className="grid gap-6 items-start xl:grid-cols-2">
          {isSuperAdmin && (
            <div className="orbita-card p-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Dados cadastrais</h2>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              {isSuperAdmin
                ? "Edite e salve as alterações."
                : "Somente o super admin pode alterar os dados da empresa."}
            </p>
          </div>
          <form onSubmit={save} className="space-y-4">
            <Field label="Nome" value={form.name} disabled={!isSuperAdmin} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
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
                  disabled={!isSuperAdmin}
                  onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
                  placeholder="minha-empresa"
                />
              </div>
              {isSuperAdmin && (
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  Endereço de acesso da empresa. Trocar invalida o link antigo.
                </span>
              )}
            </label>
            <Field label="Documento (CNPJ/CPF)" value={form.document} disabled={!isSuperAdmin} onChange={(v) => setForm((f) => ({ ...f, document: v }))} />
            <Field label="Telefone" value={form.phone} disabled={!isSuperAdmin} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
            <Field label="Endereço" value={form.address} disabled={!isSuperAdmin} onChange={(v) => setForm((f) => ({ ...f, address: v }))} />
            {error && (
              <div className="rounded-lg px-3 py-2 text-sm" style={{ background: "rgba(248,113,113,0.12)", color: "var(--danger)" }}>
                {error}
              </div>
            )}
            {isSuperAdmin && (
              <button type="submit" disabled={saving || form.name.trim().length < 2} className="orbita-btn px-4 py-2.5">
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>
            )}
          </form>
            </div>
          )}

          {isSuperAdmin && <AparenciaCard canManage={isSuperAdmin} />}
          <MenuCard canManage={canManage} />
          <OperacoesCard canManage={canManage} />
          <NotificacoesCard canManage={canManage} />
        </div>
      )}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  disabled?: boolean;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <select
        className="orbita-input w-full px-3 py-2.5 disabled:opacity-60"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

// Estrutura de tela (Fase 6): o dono oculta e reordena os itens de menu da
// operação. Itens de núcleo (Dashboard, Empresa, Cargos, Usuários) são fixos.
const MENU_LABELS: Record<CompanyMenuKey, string> = {
  comanda: "🧾 Comanda & Mesas",
  cozinha: "👨‍🍳 Cozinha",
  produtos: "🍕 Produtos",
  categorias: "🏷️ Categorias",
  estoque: "📦 Estoque",
  financeiro: "💰 Lançamentos",
  "gastos-fixos": "🏭 Gastos fixos",
  simulacao: "🧮 Simulação",
  relatorios: "📊 Relatórios",
};

function MenuCard({ canManage }: { canManage: boolean }) {
  const { activeEstablishmentId } = useAuthContext();
  const [items, setItems] = useState<CompanyMenuKey[]>([...COMPANY_MENU_KEYS]);
  const [hidden, setHidden] = useState<CompanyMenuKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<{ settings: CompanySettings }>("/company/settings", { silent: true })
      .then(({ data }) => {
        if (cancelled) return;
        const { order, hidden: h } = data.settings.navigation;
        // Ordem salva primeiro; itens novos (fora da lista) mantêm a posição padrão.
        const rest = COMPANY_MENU_KEYS.filter((k) => !order.includes(k));
        setItems([...order, ...rest]);
        setHidden(h);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [activeEstablishmentId]);

  function move(key: CompanyMenuKey, dir: -1 | 1) {
    setItems((list) => {
      const i = list.indexOf(key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function toggleHidden(key: CompanyMenuKey) {
    setHidden((h) => (h.includes(key) ? h.filter((k) => k !== key) : [...h, key]));
  }

  async function save() {
    if (!canManage) return;
    setSaving(true);
    try {
      await api.patch(
        "/company/settings",
        { navigation: { order: items, hidden } },
        { silent: true }
      );
      // Avisa o AppShell para recarregar as configurações (menu atualiza na hora).
      window.dispatchEvent(new Event("orbita:settings"));
      toast.success("Menu atualizado.");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Não foi possível salvar o menu."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="orbita-card p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Menu</h2>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          Ordene e oculte os itens do menu da operação. Itens de módulos
          desligados já não aparecem.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <div className="orbita-spinner" />
        </div>
      ) : (
        <>
          <ul className="space-y-1.5">
            {items.map((key, idx) => {
              const isHidden = hidden.includes(key);
              return (
                <li
                  key={key}
                  className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                  style={{ borderColor: "var(--border)", opacity: isHidden ? 0.5 : 1 }}
                >
                  <span className="text-sm">{MENU_LABELS[key]}</span>
                  {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => move(key, -1)}
                        disabled={idx === 0}
                        className="w-7 h-7 rounded border hover:bg-white/5 disabled:opacity-30 text-xs"
                        style={{ borderColor: "var(--border-strong)" }}
                        title="Mover para cima"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => move(key, 1)}
                        disabled={idx === items.length - 1}
                        className="w-7 h-7 rounded border hover:bg-white/5 disabled:opacity-30 text-xs"
                        style={{ borderColor: "var(--border-strong)" }}
                        title="Mover para baixo"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => toggleHidden(key)}
                        className="px-2 h-7 rounded border hover:bg-white/5 text-xs"
                        style={{ borderColor: "var(--border-strong)" }}
                        title={isHidden ? "Mostrar no menu" : "Ocultar do menu"}
                      >
                        {isHidden ? "Mostrar" : "Ocultar"}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {canManage && (
            <button onClick={save} disabled={saving} className="orbita-btn px-4 py-2.5">
              {saving ? "Salvando..." : "Salvar menu"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// Operações (Fase 6): regras de negócio configuráveis pelo dono. Hoje: entrada
// de estoque gerar despesa de compra no Financeiro automaticamente.
function OperacoesCard({ canManage }: { canManage: boolean }) {
  const { activeEstablishmentId } = useAuthContext();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<{ settings: CompanySettings }>("/company/settings", { silent: true })
      .then(({ data }) => {
        if (!cancelled) setEnabled(data.settings.operations.stockEntryCreatesExpense);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [activeEstablishmentId]);

  async function toggle(next: boolean) {
    if (!canManage) return;
    setSaving(true);
    setEnabled(next); // otimista
    try {
      await api.patch(
        "/company/settings",
        { operations: { stockEntryCreatesExpense: next } },
        { silent: true }
      );
      toast.success(next ? "Entradas de estoque agora geram despesa." : "Integração desligada.");
    } catch (err) {
      setEnabled(!next); // desfaz
      toast.error(apiErrorMessage(err, "Não foi possível salvar."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="orbita-card p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Operações</h2>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          Regras de funcionamento da empresa.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <div className="orbita-spinner" />
        </div>
      ) : (
        <label className="flex items-start gap-3 text-sm cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={enabled}
            disabled={!canManage || saving}
            onChange={(e) => toggle(e.target.checked)}
          />
          <span>
            <span className="font-medium">Entrada de estoque lança despesa no Financeiro</span>
            <span className="block text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Ao registrar uma entrada de insumo, cria uma despesa de compra
              (quantidade × custo do insumo). Requer o módulo Financeiro ativo.
            </span>
          </span>
        </label>
      )}
    </div>
  );
}

// Notificações programadas (Fase 6): o dono cria regras de envio por evento
// (a cada venda) ou agendadas (resumo por intervalo, estoque baixo diário).
type Rule = {
  id: string;
  kind: "SALE_EVENT" | "SALES_SUMMARY" | "LOW_STOCK";
  trigger: "EVENT_SALE" | "INTERVAL" | "DAILY";
  enabled: boolean;
  intervalMinutes: number | null;
  dailyMinutes: number | null;
  audience: "MANAGERS" | "ALL_MEMBERS";
  titleTemplate: string | null;
  bodyTemplate: string | null;
  label: string;
};

type Preset = "SALE_EVENT" | "SALES_SUMMARY" | "LOW_STOCK" | "LOW_PROFIT";

// Variáveis de template disponíveis por tipo de regra (dica na UI).
const RULE_VARS: Record<Preset, string[]> = {
  SALE_EVENT: ["valor", "item"],
  SALES_SUMMARY: ["qtd", "total", "desde"],
  LOW_STOCK: ["qtd", "itens"],
  LOW_PROFIT: ["lucro", "meta"],
};

function NotificacoesCard({ canManage }: { canManage: boolean }) {
  const { activeEstablishmentId } = useAuthContext();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Formulário de nova regra.
  const [preset, setPreset] = useState<Preset>("SALE_EVENT");
  const [everyHours, setEveryHours] = useState(1);
  const [dailyTime, setDailyTime] = useState("15:00");
  const [threshold, setThreshold] = useState("");
  const [audience, setAudience] = useState<"MANAGERS" | "ALL_MEMBERS">("MANAGERS");
  const [titleTpl, setTitleTpl] = useState("");
  const [bodyTpl, setBodyTpl] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<{ rules: Rule[] }>("/company/notification-rules", { silent: true })
      .then(({ data }) => !cancelled && setRules(data.rules))
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [activeEstablishmentId]);

  async function addRule() {
    if (!canManage) return;
    setSaving(true);
    setError(null);
    try {
      const payload =
        preset === "SALE_EVENT"
          ? { kind: "SALE_EVENT", trigger: "EVENT_SALE", audience }
          : preset === "SALES_SUMMARY"
            ? { kind: "SALES_SUMMARY", trigger: "INTERVAL", intervalMinutes: Math.max(1, everyHours) * 60, audience }
            : preset === "LOW_PROFIT"
              ? {
                  kind: "LOW_PROFIT",
                  trigger: "DAILY",
                  dailyMinutes: toMinutes(dailyTime),
                  threshold: Number(threshold) || 0,
                  audience,
                }
              : {
                  kind: "LOW_STOCK",
                  trigger: "DAILY",
                  dailyMinutes: toMinutes(dailyTime),
                  audience,
                };
      const full = {
        ...payload,
        titleTemplate: titleTpl.trim() || null,
        bodyTemplate: bodyTpl.trim() || null,
      };
      const { data } = await api.post<{ rule: Rule }>("/company/notification-rules", full, { silent: true });
      setRules((rs) => [...rs, data.rule]);
      setTitleTpl("");
      setBodyTpl("");
      toast.success("Regra criada.");
    } catch (err) {
      setError(apiErrorMessage(err, "Não foi possível criar a regra."));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(rule: Rule) {
    if (!canManage) return;
    try {
      const { data } = await api.patch<{ rule: Rule }>(
        `/company/notification-rules/${rule.id}`,
        { enabled: !rule.enabled },
        { silent: true }
      );
      setRules((rs) => rs.map((r) => (r.id === rule.id ? data.rule : r)));
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function remove(rule: Rule) {
    if (!canManage) return;
    try {
      await api.delete(`/company/notification-rules/${rule.id}`, { silent: true });
      setRules((rs) => rs.filter((r) => r.id !== rule.id));
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <div className="orbita-card p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Notificações programadas</h2>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          Envie avisos automáticos por evento ou horário (sino + push). Ex.: a cada venda, resumo a
          cada hora, estoque baixo todo dia às 15h.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <div className="orbita-spinner" />
        </div>
      ) : (
        <>
          {/* Lista de regras */}
          {rules.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Nenhuma regra ainda.
            </p>
          ) : (
            <ul className="space-y-2">
              {rules.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                  style={{ borderColor: "var(--border)", opacity: r.enabled ? 1 : 0.55 }}
                >
                  <div className="min-w-0">
                    <div className="text-sm truncate">{r.label}</div>
                    <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {r.audience === "ALL_MEMBERS" ? "Todos os membros" : "Gestores"}
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => toggle(r)}
                        className="text-xs px-2 py-1 rounded border hover:bg-white/5"
                        style={{ borderColor: "var(--border-strong)" }}
                      >
                        {r.enabled ? "Desativar" : "Ativar"}
                      </button>
                      <button
                        onClick={() => remove(r)}
                        className="text-xs px-2 py-1 rounded hover:bg-white/5"
                        style={{ color: "var(--danger)" }}
                      >
                        Excluir
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Nova regra */}
          {canManage && (
            <div className="rounded-lg border p-3 space-y-3" style={{ borderColor: "var(--border)" }}>
              <div className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                Nova regra
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>Quando</span>
                  <select
                    className="orbita-input w-full px-3 py-2.5"
                    value={preset}
                    onChange={(e) => setPreset(e.target.value as Preset)}
                  >
                    <option value="SALE_EVENT">A cada nova venda</option>
                    <option value="SALES_SUMMARY">Resumo de vendas por intervalo</option>
                    <option value="LOW_STOCK">Estoque baixo (diário)</option>
                    <option value="LOW_PROFIT">Lucro do dia abaixo da meta (diário)</option>
                  </select>
                </label>

                {preset === "SALES_SUMMARY" && (
                  <label className="block space-y-1">
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>A cada (horas)</span>
                    <input
                      type="number"
                      min={1}
                      className="orbita-input w-full px-3 py-2.5"
                      value={everyHours}
                      onChange={(e) => setEveryHours(Math.max(1, Number(e.target.value) || 1))}
                    />
                  </label>
                )}
                {(preset === "LOW_STOCK" || preset === "LOW_PROFIT") && (
                  <label className="block space-y-1">
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>Horário</span>
                    <input
                      type="time"
                      className="orbita-input w-full px-3 py-2.5"
                      value={dailyTime}
                      onChange={(e) => setDailyTime(e.target.value)}
                    />
                  </label>
                )}
                {preset === "LOW_PROFIT" && (
                  <label className="block space-y-1">
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>Meta de lucro do dia (R$)</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      className="orbita-input w-full px-3 py-2.5"
                      placeholder="ex.: 500"
                      value={threshold}
                      onChange={(e) => setThreshold(e.target.value)}
                    />
                  </label>
                )}

                <label className="block space-y-1">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>Enviar para</span>
                  <select
                    className="orbita-input w-full px-3 py-2.5"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value as "MANAGERS" | "ALL_MEMBERS")}
                  >
                    <option value="MANAGERS">Gestores</option>
                    <option value="ALL_MEMBERS">Todos os membros</option>
                  </select>
                </label>
              </div>

              {/* Mensagem personalizada (opcional). Deixe em branco para o texto padrão. */}
              <div className="space-y-2">
                <input
                  className="orbita-input w-full px-3 py-2 text-sm"
                  value={titleTpl}
                  onChange={(e) => setTitleTpl(e.target.value)}
                  placeholder="Título (opcional)"
                  maxLength={200}
                />
                <input
                  className="orbita-input w-full px-3 py-2 text-sm"
                  value={bodyTpl}
                  onChange={(e) => setBodyTpl(e.target.value)}
                  placeholder="Mensagem (opcional)"
                  maxLength={500}
                />
                <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  Variáveis: {RULE_VARS[preset].map((v) => `{${v}}`).join(", ")}
                </div>
              </div>

              {error && (
                <div className="rounded-lg px-3 py-2 text-sm" style={{ background: "rgba(248,113,113,0.12)", color: "var(--danger)" }}>
                  {error}
                </div>
              )}

              <button onClick={addRule} disabled={saving} className="orbita-btn px-4 py-2.5">
                {saving ? "Adicionando..." : "Adicionar regra"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10) || 0);
  return Math.min(1439, Math.max(0, h * 60 + m));
}

// Aparência (Fase 6): o dono personaliza as cores da marca da empresa. As cores
// são aplicadas em runtime sobre os design tokens (ver src/lib/theme.ts).
function AparenciaCard({ canManage }: { canManage: boolean }) {
  const { activeEstablishmentId } = useAuthContext();
  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Cores diferentes no tema claro? (deriva do que veio salvo).
  const [perTheme, setPerTheme] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<{ settings: CompanySettings }>("/company/settings", { silent: true })
      .then(({ data }) => {
        if (cancelled) return;
        setSettings(data.settings);
        setPerTheme(!!(data.settings.appearance.lightBrand || data.settings.appearance.lightAccent));
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [activeEstablishmentId]);

  function setColor(
    key:
      | "brand"
      | "accent"
      | "lightBrand"
      | "lightAccent"
      | "bg"
      | "lightBg"
      | "text"
      | "lightText"
      | "success"
      | "warning"
      | "danger",
    value: string | null
  ) {
    setSettings((s) => ({ ...s, appearance: { ...s.appearance, [key]: value } }));
  }

  // Liga/desliga cores por tema; ao desligar, limpa os overrides do claro.
  function togglePerTheme(on: boolean) {
    setPerTheme(on);
    if (!on) {
      setSettings((s) => ({ ...s, appearance: { ...s.appearance, lightBrand: null, lightAccent: null } }));
    }
  }

  function setChoice(key: "radius" | "density" | "font", value: string) {
    setSettings((s) => ({ ...s, appearance: { ...s.appearance, [key]: value || null } }));
  }

  async function save() {
    if (!canManage) return;
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.patch<{ settings: CompanySettings }>(
        "/company/settings",
        { appearance: settings.appearance },
        { silent: true }
      );
      setSettings(data.settings);
      applyCompanyTheme(data.settings); // aplica na hora, sem recarregar
      toast.success("Aparência atualizada.");
    } catch (err) {
      setError(apiErrorMessage(err, "Não foi possível salvar a aparência."));
    } finally {
      setSaving(false);
    }
  }

  // Prévia AO VIVO (antes de salvar): escopa as CSS vars derivadas das cores
  // escolhidas ao container da prévia, respeitando o tema atual (claro/escuro).
  const previewStyle = useMemo(() => {
    const dark =
      typeof document !== "undefined"
        ? document.documentElement.getAttribute("data-theme") !== "light"
        : true;
    return settingsToCssVars(settings, { dark }) as unknown as React.CSSProperties;
  }, [settings]);

  return (
    <div className="orbita-card p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Aparência</h2>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          {canManage
            ? "Personalize as cores da empresa. Em branco = padrão Órbita."
            : "Somente o super admin pode alterar a aparência."}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <div className="orbita-spinner" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ColorField
              label={perTheme ? "Marca (tema escuro)" : "Cor da marca"}
              value={settings.appearance.brand}
              disabled={!canManage}
              onChange={(v) => setColor("brand", v)}
            />
            <ColorField
              label={perTheme ? "Destaque (tema escuro)" : "Cor de destaque"}
              value={settings.appearance.accent}
              disabled={!canManage}
              onChange={(v) => setColor("accent", v)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
            <input
              type="checkbox"
              checked={perTheme}
              disabled={!canManage}
              onChange={(e) => togglePerTheme(e.target.checked)}
            />
            Usar cores diferentes no tema claro
          </label>

          {perTheme && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ColorField
                label="Marca (tema claro)"
                value={settings.appearance.lightBrand}
                disabled={!canManage}
                onChange={(v) => setColor("lightBrand", v)}
              />
              <ColorField
                label="Destaque (tema claro)"
                value={settings.appearance.lightAccent}
                disabled={!canManage}
                onChange={(v) => setColor("lightAccent", v)}
              />
            </div>
          )}

          {/* Fundo do sistema: troca o roxo-preto por outra cor; painéis, cards
              e bordas são derivados automaticamente da cor escolhida. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ColorField
              label="Fundo do sistema (tema escuro)"
              value={settings.appearance.bg}
              disabled={!canManage}
              onChange={(v) => setColor("bg", v)}
            />
            <ColorField
              label="Fundo do sistema (tema claro)"
              value={settings.appearance.lightBg}
              disabled={!canManage}
              onChange={(v) => setColor("lightBg", v)}
            />
          </div>

          {/* Texto: o secundário (cinza) é derivado automaticamente. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ColorField
              label="Texto (tema escuro)"
              value={settings.appearance.text}
              disabled={!canManage}
              onChange={(v) => setColor("text", v)}
            />
            <ColorField
              label="Texto (tema claro)"
              value={settings.appearance.lightText}
              disabled={!canManage}
              onChange={(v) => setColor("lightText", v)}
            />
          </div>

          {/* Semânticas: valem para os dois temas. */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ColorField
              label="Sucesso"
              value={settings.appearance.success}
              disabled={!canManage}
              onChange={(v) => setColor("success", v)}
            />
            <ColorField
              label="Alerta"
              value={settings.appearance.warning}
              disabled={!canManage}
              onChange={(v) => setColor("warning", v)}
            />
            <ColorField
              label="Perigo"
              value={settings.appearance.danger}
              disabled={!canManage}
              onChange={(v) => setColor("danger", v)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField
              label="Cantos"
              value={settings.appearance.radius ?? ""}
              disabled={!canManage}
              onChange={(v) => setChoice("radius", v)}
              options={[
                ["", "Padrão"],
                ["sharp", "Retos"],
                ["rounded", "Arredondados"],
              ]}
            />
            <SelectField
              label="Tamanho do texto"
              value={settings.appearance.density ?? ""}
              disabled={!canManage}
              onChange={(v) => setChoice("density", v)}
              options={[
                ["", "Padrão"],
                ["compact", "Compacto"],
                ["comfortable", "Confortável"],
              ]}
            />
            <SelectField
              label="Fonte"
              value={settings.appearance.font ?? ""}
              disabled={!canManage}
              onChange={(v) => setChoice("font", v)}
              options={[
                ["", "Padrão"],
                ["system", "Sistema"],
                ["serif", "Serifada"],
                ["mono", "Monoespaçada"],
              ]}
            />
          </div>

          {/* Prévia AO VIVO: o container aplica as vars derivadas das cores atuais. */}
          <div>
            <div className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
              Prévia
            </div>
            <div
              className="rounded-xl border p-4 space-y-3"
              style={{
                ...previewStyle,
                borderColor: "var(--border)",
                background: "var(--bg-elevated)",
                fontFamily: "var(--font-body)",
              }}
            >
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="orbita-btn px-3 py-1.5 text-sm">
                  Botão
                </button>
                <span
                  className="px-3 py-1.5 text-sm rounded-lg"
                  style={{ background: "var(--brand-hover)", color: "#fff" }}
                >
                  Hover
                </span>
                <span
                  className="px-3 py-1.5 text-sm rounded-lg font-medium"
                  style={{ background: "var(--brand-soft)", color: "var(--brand-text)" }}
                >
                  Item ativo
                </span>
                <span className="text-sm font-medium" style={{ color: "var(--accent)" }}>
                  Link de destaque
                </span>
              </div>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Texto de exemplo — Aa Bb Cc 0123
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-lg px-3 py-2 text-sm" style={{ background: "rgba(248,113,113,0.12)", color: "var(--danger)" }}>
              {error}
            </div>
          )}

          {canManage && (
            <button onClick={save} disabled={saving} className="orbita-btn px-4 py-2.5">
              {saving ? "Salvando..." : "Salvar aparência"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      {/* min-w-0 no input de texto permite encolher dentro de grids estreitos
          (sem estourar o card); swatch e botão não encolhem. */}
      <div className="flex items-center gap-2 min-w-0">
        <input
          type="color"
          className="h-10 w-12 shrink-0 rounded-lg border bg-transparent disabled:opacity-60"
          style={{ borderColor: "var(--border-strong)" }}
          value={value ?? "#7c3aed"}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          className="orbita-input flex-1 min-w-0 px-3 py-2.5 disabled:opacity-60"
          value={value ?? ""}
          disabled={disabled}
          placeholder="#7c3aed"
          onChange={(e) => onChange(e.target.value.trim() || null)}
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="shrink-0 text-xs px-2 py-1 rounded hover:bg-white/5"
            style={{ color: "var(--text-muted)" }}
            title="Usar padrão"
          >
            padrão
          </button>
        )}
      </div>
    </label>
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
