"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import api, { apiErrorMessage } from "@/lib/api";
import { useAuthContext } from "@/context/AuthContext";

// Estado de um módulo vindo da API (catálogo + se está ativo na empresa).
type ModuleState = {
  key: string;
  label: string;
  description: string;
  icon: string;
  removable: boolean;
  enabled: boolean;
};

// Configuração de MÓDULOS por empresa (super admin). Liga/desliga as ferramentas
// (Estoque, Financeiro...) que a empresa enxerga. Um módulo desligado some do
// menu da empresa e tem suas rotas de API bloqueadas.
export function ModulosView({ companyName }: { companyName?: string | null }) {
  const { activeEstablishmentId } = useAuthContext();
  const [modules, setModules] = useState<ModuleState[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!activeEstablishmentId) return;
    load(activeEstablishmentId);
  }, [activeEstablishmentId]);

  async function load(estId: string) {
    setLoading(true);
    try {
      const { data } = await api.get<{ modules: ModuleState[] }>(
        `/admin/establishments/${estId}/modules`
      );
      setModules(data.modules);
    } catch {
      /* toast global cuida do erro */
    } finally {
      setLoading(false);
    }
  }

  async function toggle(mod: ModuleState) {
    if (!activeEstablishmentId) return;
    const next = !mod.enabled;
    setSavingKey(mod.key);
    // Otimista: reflete na hora, reverte se falhar.
    setModules((prev) =>
      prev.map((m) => (m.key === mod.key ? { ...m, enabled: next } : m))
    );
    try {
      const { data } = await api.patch<{ modules: ModuleState[] }>(
        `/admin/establishments/${activeEstablishmentId}/modules`,
        { modules: [{ key: mod.key, enabled: next }] },
        { silent: true }
      );
      setModules(data.modules);
      toast.success(
        next ? `Módulo "${mod.label}" ativado.` : `Módulo "${mod.label}" desativado.`
      );
    } catch (err) {
      setModules((prev) =>
        prev.map((m) => (m.key === mod.key ? { ...m, enabled: mod.enabled } : m))
      );
      toast.error(apiErrorMessage(err, "Não foi possível alterar o módulo."));
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="p-6 md:p-10 w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Módulos {companyName ? `· ${companyName}` : ""}
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Escolha quais ferramentas esta empresa utiliza. Módulos desativados
          somem do menu da empresa e ficam indisponíveis para os funcionários.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="orbita-spinner" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((mod) => {
            const busy = savingKey === mod.key;
            return (
              <div key={mod.key} className="orbita-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span aria-hidden className="text-xl">
                      {mod.icon}
                    </span>
                    <div className="font-medium">{mod.label}</div>
                  </div>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded shrink-0"
                    style={{
                      background: mod.enabled ? "var(--brand-soft)" : "var(--bg-elevated)",
                      color: mod.enabled ? "var(--brand-text)" : "var(--text-muted)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {mod.enabled ? "Ativo" : "Inativo"}
                  </span>
                </div>

                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {mod.description}
                </p>

                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() => toggle(mod)}
                    disabled={busy || (!mod.removable && mod.enabled)}
                    className="rounded-lg border px-3 py-1.5 text-xs hover:bg-white/5 disabled:opacity-50"
                    style={{ borderColor: "var(--border-strong)" }}
                  >
                    {busy ? "..." : mod.enabled ? "Desativar" : "Ativar"}
                  </button>
                  {!mod.removable && (
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      Módulo essencial
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
