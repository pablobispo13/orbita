"use client";

import { Modal } from "@/components/Modal";

// Diálogo de confirmação em modal (substitui window.confirm). Dois botões de
// ação de verdade: confirmar (primário ou perigo) e cancelar (secundário).
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "default",
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title} maxWidth="max-w-md">
      <div className="space-y-5">
        <div className="text-sm" style={{ color: "var(--text-muted)" }}>
          {message}
        </div>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="orbita-btn-secondary px-4 py-2.5"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={tone === "danger" ? "orbita-btn-danger px-4 py-2.5" : "orbita-btn px-4 py-2.5"}
          >
            {loading ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
