"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import api from "@/lib/api";
import { Modal } from "@/components/Modal";
import { NOTIFICATION_META, NOTIFICATION_STATUS } from "@/lib/notificationTypes";
import { disablePush, enablePush, isPushEnabled, pushSupported } from "@/lib/pushClient";
import { navigateToView } from "@/lib/navigation";

type Notification = {
  id: string;
  type: keyof typeof NOTIFICATION_META;
  status: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  targetUserId: string | null;
};

type Credentials = { name: string; email: string; password: string };

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ notifications: Notification[]; unread: number }>(
        "/notifications",
        { silent: true }
      );
      setItems(data.notifications);
      setUnread(data.unread);
    } catch {
      /* silencioso — não atrapalha o resto do app */
    } finally {
      setLoading(false);
    }
  }, []);

  // Carrega ao montar e faz polling leve a cada 60s.
  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  // Estado do push neste dispositivo.
  useEffect(() => {
    if (pushSupported()) isPushEnabled().then(setPushOn).catch(() => {});
  }, []);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function markRead(n: Notification) {
    if (n.read) return;
    setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, read: true } : i)));
    setUnread((u) => Math.max(0, u - 1));
    await api.patch(`/notifications/${n.id}`, { read: true }, { silent: true }).catch(() => {});
  }

  async function markAllRead() {
    const unreadItems = items.filter((i) => !i.read);
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    setUnread(0);
    await Promise.all(
      unreadItems.map((n) =>
        api.patch(`/notifications/${n.id}`, { read: true }, { silent: true }).catch(() => {})
      )
    );
  }

  async function resolvePassword(n: Notification) {
    setBusyId(n.id);
    try {
      const { data } = await api.post<Credentials>(`/notifications/${n.id}/resolve-password`);
      setCredentials(data);
      toast.success("Senha gerada. Repasse ao funcionário.");
      await load();
    } catch {
      /* toast global cuida do erro */
    } finally {
      setBusyId(null);
    }
  }

  async function remove(n: Notification) {
    setBusyId(n.id);
    try {
      await api.delete(`/notifications/${n.id}`, { silent: true });
      setItems((prev) => prev.filter((i) => i.id !== n.id));
      if (!n.read) setUnread((u) => Math.max(0, u - 1));
    } catch {
      /* silencioso */
    } finally {
      setBusyId(null);
    }
  }

  async function togglePush() {
    setPushBusy(true);
    try {
      if (pushOn) {
        await disablePush();
        setPushOn(false);
        toast.info("Notificações do dispositivo desativadas.");
      } else {
        const ok = await enablePush();
        setPushOn(ok);
        if (ok) toast.success("Notificações do dispositivo ativadas.");
        else toast.warn("Permissão de notificação negada.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao configurar push.");
    } finally {
      setPushBusy(false);
    }
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).then(() => toast.success("Copiado."), () => {});
  }

  // Notificações com ação: um pedido de senha leva à aba de usuários já filtrada.
  function actionOf(n: Notification): (() => void) | null {
    if (n.type === "PASSWORD_RESET_REQUEST" && n.targetUserId) {
      const uid = n.targetUserId;
      return () => {
        navigateToView({ view: "usuarios", userId: uid });
        setOpen(false);
      };
    }
    return null;
  }

  function handleItemClick(n: Notification) {
    markRead(n);
    actionOf(n)?.();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notificações"
        title="Notificações"
        className="relative rounded-lg border w-9 h-9 flex items-center justify-center hover:bg-white/5"
        style={{ borderColor: "var(--border-strong)" }}
      >
        <span aria-hidden>🔔</span>
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
            style={{ background: "var(--danger)", color: "#fff" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-xl border shadow-lg overflow-hidden z-50"
          style={{ borderColor: "var(--border-strong)", background: "var(--bg-elevated)" }}
        >
          <div
            className="flex items-center justify-between px-3 py-2 border-b"
            style={{ borderColor: "var(--border)" }}
          >
            <span className="text-sm font-semibold">Notificações</span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-[11px] hover:underline"
                style={{ color: "var(--brand-text)" }}
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          {/* Toggle de push do dispositivo */}
          {pushSupported() && (
            <button
              onClick={togglePush}
              disabled={pushBusy}
              className="w-full flex items-center justify-between px-3 py-2 text-xs border-b hover:bg-white/5 disabled:opacity-60"
              style={{ borderColor: "var(--border)" }}
            >
              <span>{pushOn ? "🔕 Desativar" : "📲 Ativar"} notificações no dispositivo</span>
              <span
                className="px-2 py-0.5 rounded"
                style={{
                  background: pushOn ? "var(--accent-soft)" : "var(--brand-soft)",
                  color: pushOn ? "var(--accent)" : "var(--brand-text)",
                }}
              >
                {pushBusy ? "..." : pushOn ? "ON" : "OFF"}
              </span>
            </button>
          )}

          <div className="max-h-96 overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="flex justify-center py-8">
                <div className="orbita-spinner" />
              </div>
            ) : items.length === 0 ? (
              <p className="px-3 py-6 text-sm text-center" style={{ color: "var(--text-muted)" }}>
                Nenhuma notificação.
              </p>
            ) : (
              items.map((n) => {
                const meta = NOTIFICATION_META[n.type] ?? NOTIFICATION_META.GENERIC;
                const isPending =
                  n.type === "PASSWORD_RESET_REQUEST" && n.status === NOTIFICATION_STATUS.PENDING;
                const hasAction = !!actionOf(n);
                return (
                  <div
                    key={n.id}
                    onClick={() => handleItemClick(n)}
                    className="px-3 py-2.5 border-b text-sm space-y-1 cursor-pointer"
                    style={{
                      borderColor: "var(--border)",
                      background: n.read ? "transparent" : "var(--brand-soft)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 font-medium">
                        <span aria-hidden>{meta.icon}</span>
                        {n.title}
                      </div>
                      <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {n.message}
                    </div>
                    {hasAction && (
                      <div className="text-[11px]" style={{ color: "var(--brand-text)" }}>
                        Abrir usuário →
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      {isPending && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            resolvePassword(n);
                          }}
                          disabled={busyId === n.id}
                          className="rounded-lg px-2.5 py-1 text-[11px] font-medium disabled:opacity-50"
                          style={{ background: "var(--brand-soft)", color: "var(--brand-text)" }}
                        >
                          {busyId === n.id ? "Gerando..." : "Gerar senha"}
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(n);
                        }}
                        disabled={busyId === n.id}
                        className="rounded-lg px-2.5 py-1 text-[11px] hover:underline disabled:opacity-50"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Descartar
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Modal: credenciais geradas ao processar recuperação de senha */}
      <Modal
        open={!!credentials}
        onClose={() => setCredentials(null)}
        title="Nova senha gerada"
      >
        {credentials && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Repasse a <strong>{credentials.name}</strong>. Troca obrigatória no próximo login.
            </p>
            <div className="space-y-1">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                E-mail
              </span>
              <div
                className="rounded-lg border px-3 py-2 text-sm select-all break-all"
                style={{ borderColor: "var(--border-strong)" }}
              >
                {credentials.email}
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Senha temporária
              </span>
              <div
                className="rounded-lg border px-3 py-2 text-sm font-mono select-all break-all"
                style={{ borderColor: "var(--border-strong)", color: "var(--accent)" }}
              >
                {credentials.password}
              </div>
            </div>
            <button
              onClick={() => copy(`E-mail: ${credentials.email}\nSenha: ${credentials.password}`)}
              className="orbita-btn px-4 py-2.5 w-full"
            >
              Copiar e-mail e senha
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
