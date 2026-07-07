"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import api, { apiErrorMessage } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { DataTable, Th, ViewToggle, useViewMode } from "@/components/ListControls";
import { useConfirm } from "@/components/ConfirmProvider";

type StockItem = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  minLevel: number;
  costPrice: number;
};

type FormState = {
  id: string | null; // null => criando
  name: string;
  unit: string;
  quantity: string;
  minLevel: string;
  costPrice: string;
};

const emptyForm: FormState = {
  id: null,
  name: "",
  unit: "",
  quantity: "0",
  minLevel: "0",
  costPrice: "0",
};

type MoveState = {
  item: StockItem;
  type: "IN" | "OUT";
  quantity: string;
  note: string;
};

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Módulo Estoque — insumos da empresa ativa, com movimentações (entrada/saída) e
// alerta de estoque baixo. Só acessível com o módulo "Estoque" habilitado.
export function EstoqueView({ companyName }: { companyName?: string | null }) {
  const confirm = useConfirm();
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useViewMode("view_estoque");

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Movimentação (entrada/saída).
  const [move, setMove] = useState<MoveState | null>(null);
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  const editing = form.id !== null;
  const valid = form.name.trim().length >= 1 && form.unit.trim().length >= 1;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, search]);

  const lowCount = useMemo(
    () => items.filter((i) => i.quantity <= i.minLevel).length,
    [items]
  );

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get<{ items: StockItem[] }>("/stock");
      setItems(data.items);
    } catch {
      /* toast global cuida do erro */
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setForm(emptyForm);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(item: StockItem) {
    setForm({
      id: item.id,
      name: item.name,
      unit: item.unit,
      quantity: String(item.quantity),
      minLevel: String(item.minLevel),
      costPrice: String(item.costPrice),
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function submit() {
    if (!valid) return;
    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        // Quantidade não é editada aqui — só por movimentação.
        await api.patch(
          `/stock/${form.id}`,
          {
            name: form.name.trim(),
            unit: form.unit.trim(),
            minLevel: Number(form.minLevel) || 0,
            costPrice: Number(form.costPrice) || 0,
          },
          { silent: true }
        );
        toast.success("Insumo atualizado.");
      } else {
        await api.post(
          "/stock",
          {
            name: form.name.trim(),
            unit: form.unit.trim(),
            quantity: Number(form.quantity) || 0,
            minLevel: Number(form.minLevel) || 0,
            costPrice: Number(form.costPrice) || 0,
          },
          { silent: true }
        );
        toast.success("Insumo cadastrado.");
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      setFormError(apiErrorMessage(err, "Não foi possível salvar o insumo."));
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: StockItem) {
    const ok = await confirm({
      title: "Excluir insumo",
      message: `Excluir o insumo "${item.name}" e seu histórico de movimentações?`,
      confirmLabel: "Excluir",
      tone: "danger",
    });
    if (!ok) return;
    setDeletingId(item.id);
    try {
      await api.delete(`/stock/${item.id}`);
      toast.success("Insumo excluído.");
      await load();
    } catch {
      /* toast global cuida do erro */
    } finally {
      setDeletingId(null);
    }
  }

  function openMove(item: StockItem, type: "IN" | "OUT") {
    setMove({ item, type, quantity: "", note: "" });
    setMoveError(null);
  }

  async function submitMove() {
    if (!move) return;
    const qty = Number(move.quantity);
    if (!(qty > 0)) {
      setMoveError("Informe uma quantidade maior que zero.");
      return;
    }
    setMoving(true);
    setMoveError(null);
    try {
      await api.post(
        `/stock/${move.item.id}/movements`,
        { type: move.type, quantity: qty, note: move.note.trim() || undefined },
        { silent: true }
      );
      toast.success(move.type === "IN" ? "Entrada registrada." : "Saída registrada.");
      setMove(null);
      await load();
    } catch (err) {
      setMoveError(apiErrorMessage(err, "Não foi possível registrar a movimentação."));
    } finally {
      setMoving(false);
    }
  }

  return (
    <div className="p-6 md:p-10 w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            Estoque {companyName ? `· ${companyName}` : ""}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Insumos da empresa: quantidade, custo e estoque mínimo.
            {lowCount > 0 && (
              <span style={{ color: "var(--danger)" }}>
                {" "}
                {lowCount} {lowCount === 1 ? "item" : "itens"} no mínimo.
              </span>
            )}
          </p>
        </div>
        <button onClick={openCreate} className="orbita-btn px-4 py-2.5 shrink-0">
          + Novo insumo
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          className="orbita-input flex-1 min-w-56 px-3 py-2.5"
          placeholder="Buscar insumo por nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <ViewToggle mode={viewMode} onChange={setViewMode} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="orbita-spinner" />
        </div>
      ) : filtered.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>
          {search.trim()
            ? "Nenhum insumo encontrado."
            : "Nenhum insumo cadastrado ainda. Use “+ Novo insumo”."}
        </p>
      ) : viewMode === "cards" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((item) => {
            const low = item.quantity <= item.minLevel;
            return (
              <div key={item.id} className="orbita-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium truncate">{item.name}</div>
                  {low && (
                    <span
                      className="text-[10px] px-2 py-0.5 rounded shrink-0"
                      style={{ background: "rgba(248,113,113,0.12)", color: "var(--danger)" }}
                    >
                      baixo
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      Quantidade
                    </div>
                    <div style={{ color: low ? "var(--danger)" : "var(--text)" }}>
                      {item.quantity} {item.unit}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      Mínimo
                    </div>
                    <div>{item.minLevel}</div>
                  </div>
                  <div>
                    <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      Custo
                    </div>
                    <div>{currency(item.costPrice)}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => openMove(item, "IN")}
                    className="w-full rounded-lg border px-2.5 py-1.5 text-xs hover:bg-white/5"
                    style={{ borderColor: "var(--border-strong)", color: "var(--accent)" }}
                  >
                    + Entrada
                  </button>
                  <button
                    onClick={() => openMove(item, "OUT")}
                    className="w-full rounded-lg border px-2.5 py-1.5 text-xs hover:bg-white/5"
                    style={{ borderColor: "var(--border-strong)" }}
                  >
                    − Saída
                  </button>
                  <button
                    onClick={() => openEdit(item)}
                    className="w-full rounded-lg border px-2.5 py-1.5 text-xs hover:bg-white/5"
                    style={{ borderColor: "var(--border-strong)" }}
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => remove(item)}
                    disabled={deletingId === item.id}
                    className="w-full rounded-lg border px-2.5 py-1.5 text-xs hover:bg-white/5 disabled:opacity-50"
                    style={{ borderColor: "var(--border-strong)", color: "var(--danger)" }}
                  >
                    {deletingId === item.id ? "..." : "Excluir"}
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
              <Th>Insumo</Th>
              <Th>Unidade</Th>
              <Th>Quantidade</Th>
              <Th>Mínimo</Th>
              <Th>Custo</Th>
              <Th>Ações</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => {
              const low = item.quantity <= item.minLevel;
              return (
                <tr
                  key={item.id}
                  className="border-b"
                  style={{ borderColor: "var(--border)" }}
                >
                  <td className="px-4 py-2.5 font-medium">{item.name}</td>
                  <td className="px-4 py-2.5" style={{ color: "var(--text-muted)" }}>
                    {item.unit}
                  </td>
                  <td
                    className="px-4 py-2.5"
                    style={{ color: low ? "var(--danger)" : "var(--text)" }}
                  >
                    {item.quantity}
                    {low && (
                      <span
                        className="ml-2 text-[10px] px-1.5 py-0.5 rounded align-middle"
                        style={{ background: "rgba(248,113,113,0.12)", color: "var(--danger)" }}
                      >
                        baixo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--text-muted)" }}>
                    {item.minLevel}
                  </td>
                  <td className="px-4 py-2.5">{currency(item.costPrice)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => openMove(item, "IN")}
                        className="rounded-lg border px-2.5 py-1 text-xs hover:bg-white/5"
                        style={{ borderColor: "var(--border-strong)", color: "var(--accent)" }}
                      >
                        + Entrada
                      </button>
                      <button
                        onClick={() => openMove(item, "OUT")}
                        className="rounded-lg border px-2.5 py-1 text-xs hover:bg-white/5"
                        style={{ borderColor: "var(--border-strong)" }}
                      >
                        − Saída
                      </button>
                      <button
                        onClick={() => openEdit(item)}
                        className="rounded-lg border px-2.5 py-1 text-xs hover:bg-white/5"
                        style={{ borderColor: "var(--border-strong)" }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => remove(item)}
                        disabled={deletingId === item.id}
                        className="rounded-lg border px-2.5 py-1 text-xs hover:bg-white/5 disabled:opacity-50"
                        style={{ borderColor: "var(--border-strong)", color: "var(--danger)" }}
                      >
                        {deletingId === item.id ? "..." : "Excluir"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      )}

      {/* Modal: criar / editar insumo */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Editar insumo" : "Novo insumo"}
        maxWidth="max-w-lg"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Nome do insumo
            </span>
            <input
              className="orbita-input w-full px-3 py-2.5"
              placeholder="Ex.: Farinha, Queijo mussarela"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Unidade
            </span>
            <input
              className="orbita-input w-full px-3 py-2.5"
              placeholder="kg, un, L"
              value={form.unit}
              onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
            />
          </label>
          {!editing && (
            <label className="space-y-1">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Quantidade inicial
              </span>
              <input
                type="number"
                min={0}
                step="any"
                className="orbita-input w-full px-3 py-2.5"
                value={form.quantity}
                onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
              />
            </label>
          )}
          <label className="space-y-1">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Estoque mínimo
            </span>
            <input
              type="number"
              min={0}
              step="any"
              className="orbita-input w-full px-3 py-2.5"
              value={form.minLevel}
              onChange={(e) => setForm((p) => ({ ...p, minLevel: e.target.value }))}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Custo unitário (R$)
            </span>
            <input
              type="number"
              min={0}
              step="any"
              className="orbita-input w-full px-3 py-2.5"
              value={form.costPrice}
              onChange={(e) => setForm((p) => ({ ...p, costPrice: e.target.value }))}
            />
          </label>
        </div>

        {editing && (
          <p className="text-[11px] mt-3" style={{ color: "var(--text-muted)" }}>
            A quantidade em estoque só muda por movimentação (Entrada/Saída).
          </p>
        )}

        {formError && (
          <div
            className="rounded-lg px-3 py-2 text-sm mt-4"
            style={{ background: "rgba(248,113,113,0.12)", color: "var(--danger)" }}
          >
            {formError}
          </div>
        )}

        <div className="flex items-center gap-3 pt-4">
          <button
            onClick={submit}
            disabled={!valid || saving}
            className="orbita-btn px-4 py-2.5"
          >
            {saving ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar insumo"}
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

      {/* Modal: movimentação (entrada/saída) */}
      <Modal
        open={!!move}
        onClose={() => setMove(null)}
        title={move?.type === "IN" ? "Registrar entrada" : "Registrar saída"}
        maxWidth="max-w-md"
      >
        {move && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {move.item.name} — estoque atual:{" "}
              <strong>
                {move.item.quantity} {move.item.unit}
              </strong>
            </p>
            <label className="space-y-1 block">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Quantidade ({move.item.unit})
              </span>
              <input
                type="number"
                min={0}
                step="any"
                autoFocus
                className="orbita-input w-full px-3 py-2.5"
                value={move.quantity}
                onChange={(e) =>
                  setMove((m) => (m ? { ...m, quantity: e.target.value } : m))
                }
              />
            </label>
            <label className="space-y-1 block">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Observação (opcional)
              </span>
              <input
                className="orbita-input w-full px-3 py-2.5"
                placeholder="Ex.: Compra, perda, ajuste"
                value={move.note}
                onChange={(e) => setMove((m) => (m ? { ...m, note: e.target.value } : m))}
              />
            </label>

            {moveError && (
              <div
                className="rounded-lg px-3 py-2 text-sm"
                style={{ background: "rgba(248,113,113,0.12)", color: "var(--danger)" }}
              >
                {moveError}
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={submitMove}
                disabled={moving}
                className="orbita-btn px-4 py-2.5"
              >
                {moving ? "Registrando..." : "Confirmar"}
              </button>
              <button
                type="button"
                onClick={() => setMove(null)}
                className="orbita-btn-secondary px-4 py-2.5"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
