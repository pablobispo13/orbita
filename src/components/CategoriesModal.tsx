"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import api, { apiErrorMessage } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { useConfirm } from "@/components/ConfirmProvider";

export type Category = {
  id: string;
  name: string;
  _count?: { products: number; transactions: number };
};

// Gerenciador de categorias (taxonomia compartilhada por produtos e lançamentos —
// serve de centro de custo no financeiro). Reutilizado em Produtos e Financeiro.
// `onChange` avisa o pai para recarregar sua lista de categorias.
export function CategoriesModal({
  open,
  onClose,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  onChange?: () => void;
}) {
  const confirm = useConfirm();
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (open) load();
  }, [open]);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get<{ categories: Category[] }>("/categories", {
        silent: true,
      });
      setCats(data.categories);
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
      await api.post("/categories", { name: trimmed }, { silent: true });
      setName("");
      await load();
      onChange?.();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Não foi possível criar a categoria."));
    } finally {
      setCreating(false);
    }
  }

  async function rename(id: string) {
    const trimmed = editingName.trim();
    if (!trimmed) return;
    setBusyId(id);
    try {
      await api.patch(`/categories/${id}`, { name: trimmed }, { silent: true });
      setEditingId(null);
      await load();
      onChange?.();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Não foi possível renomear."));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(c: Category) {
    const used = (c._count?.products ?? 0) + (c._count?.transactions ?? 0);
    const extra = used > 0 ? ` Ela será desvinculada de ${used} item(ns).` : "";
    const ok = await confirm({
      title: "Excluir categoria",
      message: `Excluir a categoria "${c.name}"?${extra}`,
      confirmLabel: "Excluir",
      tone: "danger",
    });
    if (!ok) return;
    setBusyId(c.id);
    try {
      await api.delete(`/categories/${c.id}`, { silent: true });
      await load();
      onChange?.();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Não foi possível excluir."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Categorias" maxWidth="max-w-md">
      <div className="space-y-5">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Organize produtos e lançamentos (centros de custo) por categoria.
        </p>

        <div className="space-y-1.5">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Nova categoria
          </span>
          <div className="flex gap-2">
            <input
              className="orbita-input flex-1 px-3 py-2.5"
              placeholder="Ex.: Pizzas, Bebidas, Insumos"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
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
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Categorias criadas
            </span>
            {cats.length > 0 && (
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {cats.length}
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="orbita-spinner" />
            </div>
          ) : cats.length === 0 ? (
            <p className="text-sm py-2" style={{ color: "var(--text-muted)" }}>
              Nenhuma categoria ainda. Crie a primeira acima.
            </p>
          ) : (
            <ul className="space-y-1.5">
            {cats.map((c) => {
              const used = (c._count?.products ?? 0) + (c._count?.transactions ?? 0);
              const isEditing = editingId === c.id;
              return (
                <li
                  key={c.id}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2"
                  style={{ borderColor: "var(--border)" }}
                >
                  {isEditing ? (
                    <input
                      autoFocus
                      className="orbita-input flex-1 px-2 py-1 text-sm"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && rename(c.id)}
                    />
                  ) : (
                    <span className="flex-1 text-sm">
                      {c.name}
                      {used > 0 && (
                        <span className="ml-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                          · {used} uso(s)
                        </span>
                      )}
                    </span>
                  )}

                  {isEditing ? (
                    <>
                      <button
                        onClick={() => rename(c.id)}
                        disabled={busyId === c.id}
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
                      <button
                        onClick={() => {
                          setEditingId(c.id);
                          setEditingName(c.name);
                        }}
                        className="text-xs px-2 py-1 rounded-lg border hover:bg-white/5"
                        style={{ borderColor: "var(--border-strong)" }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => remove(c)}
                        disabled={busyId === c.id}
                        className="text-xs px-2 py-1 rounded-lg border hover:bg-white/5 disabled:opacity-50"
                        style={{ borderColor: "var(--border-strong)", color: "var(--danger)" }}
                      >
                        {busyId === c.id ? "..." : "Excluir"}
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
