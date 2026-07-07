"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import api, { apiErrorMessage } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { useConfirm } from "@/components/ConfirmProvider";

export type TableRef = {
  id: string;
  name: string;
  seats: number | null;
  active: boolean;
};

// Gestão de mesas da empresa (módulo Comanda). `onChange` avisa o pai para
// recarregar a lista de mesas do salão.
export function TablesModal({
  open,
  onClose,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  onChange?: () => void;
}) {
  const confirm = useConfirm();
  const [tables, setTables] = useState<TableRef[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [seats, setSeats] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Edição inline.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSeats, setEditSeats] = useState("");

  useEffect(() => {
    if (open) load();
  }, [open]);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get<{ tables: TableRef[] }>("/tables", { silent: true });
      setTables(data.tables);
    } catch {
      /* silencioso */
    } finally {
      setLoading(false);
    }
  }

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      await api.post(
        "/tables",
        { name: trimmed, seats: seats ? Number(seats) : null },
        { silent: true }
      );
      setName("");
      setSeats("");
      await load();
      onChange?.();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Não foi possível criar a mesa."));
    } finally {
      setCreating(false);
    }
  }

  function startEdit(t: TableRef) {
    setEditingId(t.id);
    setEditName(t.name);
    setEditSeats(t.seats ? String(t.seats) : "");
  }

  async function saveEdit(id: string) {
    const trimmed = editName.trim();
    if (!trimmed) return;
    setBusyId(id);
    try {
      await api.patch(
        `/tables/${id}`,
        { name: trimmed, seats: editSeats ? Number(editSeats) : null },
        { silent: true }
      );
      setEditingId(null);
      await load();
      onChange?.();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Não foi possível salvar a mesa."));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(t: TableRef) {
    setBusyId(t.id);
    try {
      await api.patch(`/tables/${t.id}`, { active: !t.active }, { silent: true });
      await load();
      onChange?.();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Não foi possível alterar a mesa."));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(t: TableRef) {
    const ok = await confirm({
      title: "Excluir mesa",
      message: `Excluir a mesa "${t.name}"?`,
      confirmLabel: "Excluir",
      tone: "danger",
    });
    if (!ok) return;
    setBusyId(t.id);
    try {
      await api.delete(`/tables/${t.id}`, { silent: true });
      await load();
      onChange?.();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Não foi possível excluir."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Mesas" maxWidth="max-w-md">
      <div className="space-y-5">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Cadastre as mesas do salão. A comanda pode ser de mesa, balcão ou delivery.
        </p>

        <div className="space-y-1.5">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Nova mesa
          </span>
          <div className="flex gap-2">
            <input
              className="orbita-input flex-1 px-3 py-2.5"
              placeholder="Nome/número (ex.: Mesa 1)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
            />
            <input
              type="number"
              min={1}
              className="orbita-input w-20 px-3 py-2.5"
              placeholder="Lug."
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
            />
            <button
              onClick={create}
              disabled={creating || !name.trim()}
              className="orbita-btn px-4 py-2.5 shrink-0"
            >
              {creating ? "..." : "Adicionar"}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div
            className="flex items-center justify-between border-t pt-3"
            style={{ borderColor: "var(--border)" }}
          >
            <span
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--text-muted)" }}
            >
              Mesas cadastradas
            </span>
            {tables.length > 0 && (
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {tables.length}
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="orbita-spinner" />
            </div>
          ) : tables.length === 0 ? (
            <p className="text-sm py-2" style={{ color: "var(--text-muted)" }}>
              Nenhuma mesa ainda. Cadastre a primeira acima.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {tables.map((t) => {
                const isEditing = editingId === t.id;
                return (
                  <li
                    key={t.id}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2"
                    style={{ borderColor: "var(--border)", opacity: !t.active && !isEditing ? 0.6 : 1 }}
                  >
                    {isEditing ? (
                      <>
                        <input
                          autoFocus
                          className="orbita-input flex-1 px-2 py-1 text-sm"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && saveEdit(t.id)}
                        />
                        <input
                          type="number"
                          min={1}
                          className="orbita-input w-16 px-2 py-1 text-sm"
                          placeholder="Lug."
                          value={editSeats}
                          onChange={(e) => setEditSeats(e.target.value)}
                        />
                        <button
                          onClick={() => saveEdit(t.id)}
                          disabled={busyId === t.id}
                          className="text-xs px-2 py-1 rounded-lg border hover:bg-white/5"
                          style={{ borderColor: "var(--border-strong)" }}
                        >
                          Salvar
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs px-2 py-1"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm">
                          {t.name}
                          {t.seats ? (
                            <span className="ml-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                              · {t.seats} lugares
                            </span>
                          ) : null}
                          {!t.active && (
                            <span
                              className="ml-2 text-[10px] px-1.5 py-0.5 rounded align-middle"
                              style={{ background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                            >
                              inativa
                            </span>
                          )}
                        </span>
                        <button
                          onClick={() => startEdit(t)}
                          className="text-xs px-2 py-1 rounded-lg border hover:bg-white/5"
                          style={{ borderColor: "var(--border-strong)" }}
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => toggleActive(t)}
                          disabled={busyId === t.id}
                          className="text-xs px-2 py-1 rounded-lg border hover:bg-white/5 disabled:opacity-50"
                          style={{ borderColor: "var(--border-strong)" }}
                        >
                          {t.active ? "Inativar" : "Ativar"}
                        </button>
                        <button
                          onClick={() => remove(t)}
                          disabled={busyId === t.id}
                          className="text-xs px-2 py-1 rounded-lg border hover:bg-white/5 disabled:opacity-50"
                          style={{ borderColor: "var(--border-strong)", color: "var(--danger)" }}
                        >
                          {busyId === t.id ? "..." : "Excluir"}
                        </button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
