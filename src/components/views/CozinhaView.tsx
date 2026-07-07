"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import api, { apiErrorMessage } from "@/lib/api";
import { openPrintWindow, escapeHtml } from "@/lib/print";

type OrderType = "TABLE" | "COUNTER" | "DELIVERY";

type KitchenItem = {
  id: string;
  name: string;
  quantity: number;
  note: string | null;
  prepared: boolean;
};

type KitchenOrder = {
  id: string;
  number: number;
  type: OrderType;
  customerName: string | null;
  openedAt: string;
  table: { id: string; name: string } | null;
  items: KitchenItem[];
};

const TYPE_LABEL: Record<OrderType, string> = {
  TABLE: "Mesa",
  COUNTER: "Balcão",
  DELIVERY: "Delivery",
};

// Minutos decorridos desde a abertura.
function elapsedMin(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

// Tela da COZINHA (KDS) — foco no pizzaiolo: fila de comandas abertas (mais
// antigas primeiro) e o que preparar, com marcação de item pronto. Sem preços
// nem ações de caixa. Atualiza sozinha a cada 15s.
export function CozinhaView({ companyName }: { companyName?: string | null }) {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0); // força recálculo do tempo decorrido
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<{ orders: KitchenOrder[] }>(
        "/orders?status=OPEN&items=1",
        { silent: true }
      );
      setOrders(data.orders);
    } catch {
      /* silencioso — mantém o quadro anterior */
    } finally {
      if (firstLoad.current) {
        firstLoad.current = false;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    load();
    const poll = setInterval(load, 15000); // novas comandas/itens
    const clock = setInterval(() => setTick((t) => t + 1), 30000); // tempo decorrido
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [load]);

  async function togglePrepared(orderId: string, item: KitchenItem) {
    const next = !item.prepared;
    // Otimista.
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, items: o.items.map((i) => (i.id === item.id ? { ...i, prepared: next } : i)) }
          : o
      )
    );
    try {
      await api.patch(
        `/orders/${orderId}/items/${item.id}`,
        { prepared: next },
        { silent: true }
      );
    } catch (err) {
      // Reverte.
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, items: o.items.map((i) => (i.id === item.id ? { ...i, prepared: item.prepared } : i)) }
            : o
        )
      );
      toast.error(apiErrorMessage(err, "Não foi possível atualizar o item."));
    }
  }

  // Imprime o ticket da cozinha (itens a preparar, sem preços).
  function printTicket(o: KitchenOrder) {
    const where = o.table ? o.table.name : TYPE_LABEL[o.type];
    const rows = o.items
      .map(
        (it) =>
          `<li class="big b">${it.quantity}x ${escapeHtml(it.name)}${it.note ? `<div class="muted" style="font-weight:400">&nbsp;&nbsp;${escapeHtml(it.note)}</div>` : ""}</li>`
      )
      .join("");
    const inner = `
      <h1>COZINHA</h1>
      <div class="center b big">${escapeHtml(where)} · #${o.number}</div>
      <div class="center muted">${new Date(o.openedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}${o.customerName ? " · " + escapeHtml(o.customerName) : ""}</div>
      <div class="hr"></div>
      <ul>${rows || '<li class="muted">Sem itens.</li>'}</ul>`;
    if (!openPrintWindow(`Cozinha #${o.number}`, inner)) {
      toast.error("Permita pop-ups para imprimir.");
    }
  }

  // `tick` participa do render para reavaliar o tempo decorrido.
  void tick;

  const pendingOrders = orders.filter((o) => o.items.some((i) => !i.prepared));
  const readyOrders = orders.filter(
    (o) => o.items.length > 0 && o.items.every((i) => i.prepared)
  );

  return (
    <div className="p-6 md:p-10 w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            Cozinha {companyName ? `· ${companyName}` : ""}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Fila de preparo — comandas abertas em ordem de chegada. Marque cada item ao ficar pronto.
          </p>
        </div>
        <button onClick={load} className="orbita-btn-secondary px-4 py-2.5 shrink-0">
          ↻ Atualizar
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="orbita-spinner" />
        </div>
      ) : orders.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>Nenhuma comanda aberta no momento.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 items-start">
          {[...pendingOrders, ...readyOrders].map((o) => {
            const mins = elapsedMin(o.openedAt);
            const late = mins >= 20;
            const allReady = o.items.length > 0 && o.items.every((i) => i.prepared);
            return (
              <div
                key={o.id}
                className="orbita-card p-4 space-y-3"
                style={allReady ? { borderColor: "var(--accent)" } : late ? { borderColor: "var(--danger)" } : undefined}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-bold text-lg">
                    {o.table ? o.table.name : TYPE_LABEL[o.type]}
                    <span className="ml-2 text-xs font-normal" style={{ color: "var(--text-muted)" }}>
                      #{o.number}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => printTicket(o)}
                      title="Imprimir para a cozinha"
                      className="text-xs px-1.5 py-0.5 rounded border hover:bg-white/5"
                      style={{ borderColor: "var(--border-strong)" }}
                    >
                      🖨️
                    </button>
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{
                        background: allReady ? "var(--accent-soft)" : "var(--bg-elevated)",
                        color: allReady ? "var(--accent)" : late ? "var(--danger)" : "var(--text-muted)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      {allReady ? "Pronto" : `${mins} min`}
                    </span>
                  </div>
                </div>
                {o.customerName && (
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Cliente: {o.customerName}
                  </div>
                )}

                {o.items.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    Sem itens ainda.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {o.items.map((it) => (
                      <li key={it.id}>
                        <button
                          onClick={() => togglePrepared(o.id, it)}
                          className="w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-left hover:bg-white/5"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <span
                            className="w-5 h-5 rounded flex items-center justify-center text-xs shrink-0"
                            style={{
                              background: it.prepared ? "var(--accent)" : "transparent",
                              border: it.prepared ? "none" : "1px solid var(--border-strong)",
                              color: "#fff",
                            }}
                            aria-hidden
                          >
                            {it.prepared ? "✓" : ""}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span
                              className="text-sm font-medium"
                              style={{
                                textDecoration: it.prepared ? "line-through" : "none",
                                color: it.prepared ? "var(--text-muted)" : "var(--text)",
                              }}
                            >
                              {it.quantity}× {it.name}
                            </span>
                            {it.note && (
                              <span className="block text-[11px]" style={{ color: "var(--text-muted)" }}>
                                {it.note}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
