"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import api, { apiErrorMessage } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { TablesModal } from "@/components/TablesModal";
import { useConfirm } from "@/components/ConfirmProvider";
import { openPrintWindow, escapeHtml } from "@/lib/print";

type OrderType = "TABLE" | "COUNTER" | "DELIVERY";

type TableItem = {
  id: string;
  name: string;
  seats: number | null;
  active: boolean;
  orders: { id: string; number: number; total: number; openedAt: string }[];
};

type OrderListItem = {
  id: string;
  number: number;
  type: OrderType;
  customerName: string | null;
  total: number;
  openedAt: string;
  table: { id: string; name: string } | null;
  _count: { items: number };
};

type OrderItemT = {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
  note: string | null;
};

type OrderDetail = {
  id: string;
  number: number;
  type: OrderType;
  customerName: string | null;
  note: string | null;
  total: number;
  openedAt: string;
  table: { id: string; name: string } | null;
  items: OrderItemT[];
};

type ProductItem = { id: string; name: string; price: number; active: boolean };

const currency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const TYPE_LABEL: Record<OrderType, string> = {
  TABLE: "Mesa",
  COUNTER: "Balcão",
  DELIVERY: "Delivery",
};

export function ComandaView({ companyName }: { companyName?: string | null }) {
  const confirm = useConfirm();
  const [tables, setTables] = useState<TableItem[]>([]);
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [tablesOpen, setTablesOpen] = useState(false);

  // Abrir nova comanda.
  const [newForm, setNewForm] = useState<{
    open: boolean;
    type: OrderType;
    tableId: string;
    customerName: string;
    note: string;
  } | null>(null);
  const [opening, setOpening] = useState(false);
  const [newError, setNewError] = useState<string | null>(null);

  // Detalhe/edição da comanda.
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [addForm, setAddForm] = useState({ productId: "", quantity: "1", note: "" });
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  // Fechamento (taxa de serviço, desconto, pagamento, divisão).
  const [closeForm, setCloseForm] = useState<{
    serviceFeePct: string;
    discount: string;
    people: string;
    paymentMethod: string;
  } | null>(null);

  // `silent` = refresh em segundo plano (sem spinner): usado no polling/foco.
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [t, o, p] = await Promise.all([
        api.get<{ tables: TableItem[] }>("/tables", { silent: true }),
        api.get<{ orders: OrderListItem[] }>("/orders?status=OPEN", { silent: true }),
        api.get<{ products: ProductItem[] }>("/products", { silent: true }),
      ]);
      setTables(t.data.tables);
      setOrders(o.data.orders);
      setProducts(p.data.products.filter((pr) => pr.active));
    } catch {
      /* silencioso — mantém o estado anterior */
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Carrega + mantém o salão atualizado (polling 15s e ao focar a aba).
  useEffect(() => {
    load();
    const poll = setInterval(() => load(true), 15000);
    const onFocus = () => load(true);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(poll);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [load]);

  function openNew(prefill?: { type?: OrderType; tableId?: string }) {
    setNewForm({
      open: true,
      type: prefill?.type ?? "TABLE",
      tableId: prefill?.tableId ?? "",
      customerName: "",
      note: "",
    });
    setNewError(null);
  }

  async function submitNew() {
    if (!newForm) return;
    if (newForm.type === "TABLE" && !newForm.tableId) {
      setNewError("Selecione a mesa.");
      return;
    }
    setOpening(true);
    setNewError(null);
    try {
      const { data } = await api.post<{ order: { id: string } }>(
        "/orders",
        {
          type: newForm.type,
          tableId: newForm.type === "TABLE" ? newForm.tableId : null,
          customerName: newForm.customerName.trim() || undefined,
          note: newForm.note.trim() || undefined,
        },
        { silent: true }
      );
      setNewForm(null);
      await load();
      await openDetail(data.order.id);
    } catch (err) {
      setNewError(apiErrorMessage(err, "Não foi possível abrir a comanda."));
    } finally {
      setOpening(false);
    }
  }

  async function openDetail(orderId: string) {
    setDetailLoading(true);
    setDetail(null);
    setAddForm({ productId: "", quantity: "1", note: "" });
    try {
      const { data } = await api.get<{ order: OrderDetail }>(`/orders/${orderId}`, {
        silent: true,
      });
      setDetail(data.order);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Não foi possível abrir a comanda."));
    } finally {
      setDetailLoading(false);
    }
  }

  async function addItem() {
    if (!detail || !addForm.productId) return;
    const qty = Math.floor(Number(addForm.quantity));
    if (!(qty > 0)) return;
    setAdding(true);
    try {
      const { data } = await api.post<{ items: OrderItemT[]; total: number }>(
        `/orders/${detail.id}/items`,
        { productId: addForm.productId, quantity: qty, note: addForm.note.trim() || undefined },
        { silent: true }
      );
      setDetail((d) => (d ? { ...d, items: data.items, total: data.total } : d));
      setAddForm({ productId: "", quantity: "1", note: "" });
    } catch (err) {
      toast.error(apiErrorMessage(err, "Não foi possível lançar o item."));
    } finally {
      setAdding(false);
    }
  }

  async function removeItem(itemId: string) {
    if (!detail) return;
    try {
      const { data } = await api.delete<{ items: OrderItemT[]; total: number }>(
        `/orders/${detail.id}/items/${itemId}`,
        { silent: true }
      );
      setDetail((d) => (d ? { ...d, items: data.items, total: data.total } : d));
    } catch (err) {
      toast.error(apiErrorMessage(err, "Não foi possível remover o item."));
    }
  }

  function openClose() {
    setCloseForm({ serviceFeePct: "10", discount: "0", people: "", paymentMethod: "" });
  }

  // Cupom de conferência (itens + subtotal) para o cliente/caixa.
  function printReceipt() {
    if (!detail) return;
    const where = detail.table ? detail.table.name : TYPE_LABEL[detail.type];
    const rows = detail.items
      .map(
        (it) =>
          `<li><div class="row"><span>${it.quantity}x ${escapeHtml(it.name)}</span><span>${currency(it.unitPrice * it.quantity)}</span></div>${it.note ? `<div class="muted">&nbsp;&nbsp;${escapeHtml(it.note)}</div>` : ""}</li>`
      )
      .join("");
    const inner = `
      <h1>${escapeHtml(companyName ?? "Comanda")}</h1>
      <div class="center muted">Comanda #${detail.number} · ${escapeHtml(where)}</div>
      <div class="center muted">${new Date().toLocaleString("pt-BR")}</div>
      <div class="hr"></div>
      <ul>${rows || '<li class="muted">Sem itens.</li>'}</ul>
      <div class="hr"></div>
      <div class="row b big"><span>Subtotal</span><span>${currency(detail.total)}</span></div>
      <div class="hr"></div>
      <div class="center muted">Cupom de conferência — não fiscal</div>`;
    if (!openPrintWindow(`Cupom #${detail.number}`, inner)) {
      toast.error("Permita pop-ups para imprimir.");
    }
  }

  async function submitClose() {
    if (!detail || !closeForm) return;
    const serviceFee = Math.round(detail.total * (Number(closeForm.serviceFeePct) || 0)) / 100;
    const discount = Number(closeForm.discount) || 0;
    setBusy(true);
    try {
      const { data } = await api.post<{ finalAmount: number; financeGenerated: boolean }>(
        `/orders/${detail.id}/close`,
        {
          serviceFee,
          discount,
          people: closeForm.people ? Number(closeForm.people) : null,
          paymentMethod: closeForm.paymentMethod || null,
        },
        { silent: true }
      );
      toast.success(
        data.financeGenerated
          ? `Comanda fechada — ${currency(data.finalAmount)} no Financeiro.`
          : `Comanda fechada — ${currency(data.finalAmount)}.`
      );
      setCloseForm(null);
      setDetail(null);
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Não foi possível fechar a comanda."));
    } finally {
      setBusy(false);
    }
  }

  async function cancelOrder() {
    if (!detail) return;
    const ok = await confirm({
      title: "Cancelar comanda",
      message: `Cancelar a comanda #${detail.number}? Ela não gera receita.`,
      confirmLabel: "Cancelar comanda",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.post(`/orders/${detail.id}/cancel`, {}, { silent: true });
      toast.success("Comanda cancelada.");
      setDetail(null);
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Não foi possível cancelar."));
    } finally {
      setBusy(false);
    }
  }

  const addQty = Math.floor(Number(addForm.quantity)) || 0;
  const addProduct = products.find((p) => p.id === addForm.productId);

  return (
    <div className="p-6 md:p-10 w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            Comanda & Mesas {companyName ? `· ${companyName}` : ""}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Abra comandas por mesa, balcão ou delivery, lance itens do catálogo e feche
            gerando receita no Financeiro.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => setTablesOpen(true)} className="orbita-btn-secondary px-4 py-2.5">
            Mesas
          </button>
          <button onClick={() => openNew({ type: "COUNTER" })} className="orbita-btn px-4 py-2.5">
            + Nova comanda
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="orbita-spinner" />
        </div>
      ) : (
        <>
          {/* Salão: mesas */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Salão
            </h2>
            {tables.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Nenhuma mesa cadastrada. Use “Mesas” para adicionar.
              </p>
            ) : (
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {tables
                  .filter((t) => t.active || t.orders.length > 0)
                  .map((t) => {
                  const openOrder = t.orders[0];
                  const occupied = !!openOrder;
                  return (
                    <button
                      key={t.id}
                      onClick={() =>
                        occupied ? openDetail(openOrder.id) : openNew({ type: "TABLE", tableId: t.id })
                      }
                      className="orbita-card p-4 text-left transition hover:border-[var(--accent)]"
                      style={occupied ? { borderColor: "var(--accent)" } : undefined}
                    >
                      <div className="font-medium">{t.name}</div>
                      <div
                        className="text-[11px] mt-1"
                        style={{ color: occupied ? "var(--accent)" : "var(--text-muted)" }}
                      >
                        {occupied ? `Ocupada · ${currency(openOrder.total)}` : "Livre"}
                      </div>
                      {occupied && (
                        <div className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                          #{openOrder.number} · {time(openOrder.openedAt)}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Comandas abertas */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Comandas abertas ({orders.length})
            </h2>
            {orders.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Nenhuma comanda aberta.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {orders.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => openDetail(o.id)}
                    className="orbita-card p-4 text-left transition hover:border-[var(--accent)]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">#{o.number}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded"
                        style={{ background: "var(--brand-soft)", color: "var(--brand-text)" }}>
                        {o.table ? o.table.name : TYPE_LABEL[o.type]}
                      </span>
                    </div>
                    <div className="text-lg font-bold mt-1">{currency(o.total)}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {o._count.items} {o._count.items === 1 ? "item" : "itens"} · aberta {time(o.openedAt)}
                      {o.customerName ? ` · ${o.customerName}` : ""}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Modal: nova comanda */}
      <Modal
        open={!!newForm}
        onClose={() => setNewForm(null)}
        title="Nova comanda"
        maxWidth="max-w-md"
      >
        {newForm && (
          <div className="space-y-4">
            <label className="space-y-1 block">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Tipo
              </span>
              <select
                className="orbita-input w-full px-3 py-2.5"
                value={newForm.type}
                onChange={(e) =>
                  setNewForm((f) => (f ? { ...f, type: e.target.value as OrderType } : f))
                }
              >
                <option value="TABLE">Mesa</option>
                <option value="COUNTER">Balcão</option>
                <option value="DELIVERY">Delivery</option>
              </select>
            </label>

            {newForm.type === "TABLE" && (
              <label className="space-y-1 block">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Mesa
                </span>
                <select
                  className="orbita-input w-full px-3 py-2.5"
                  value={newForm.tableId}
                  onChange={(e) =>
                    setNewForm((f) => (f ? { ...f, tableId: e.target.value } : f))
                  }
                >
                  <option value="">Selecione a mesa</option>
                  {tables
                    .filter((t) => t.active && t.orders.length === 0)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </label>
            )}

            <label className="space-y-1 block">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Cliente (opcional)
              </span>
              <input
                className="orbita-input w-full px-3 py-2.5"
                placeholder="Nome do cliente"
                value={newForm.customerName}
                onChange={(e) =>
                  setNewForm((f) => (f ? { ...f, customerName: e.target.value } : f))
                }
              />
            </label>

            {newError && (
              <div
                className="rounded-lg px-3 py-2 text-sm"
                style={{ background: "rgba(248,113,113,0.12)", color: "var(--danger)" }}
              >
                {newError}
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button onClick={submitNew} disabled={opening} className="orbita-btn px-4 py-2.5">
                {opening ? "Abrindo..." : "Abrir comanda"}
              </button>
              <button
                type="button"
                onClick={() => setNewForm(null)}
                className="orbita-btn-secondary px-4 py-2.5"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: detalhe da comanda */}
      <Modal
        open={!!detail || detailLoading}
        onClose={() => setDetail(null)}
        title={detail ? `Comanda #${detail.number}` : "Comanda"}
        maxWidth="max-w-lg"
      >
        {detailLoading ? (
          <div className="flex justify-center py-10">
            <div className="orbita-spinner" />
          </div>
        ) : detail ? (
          <div className="space-y-4">
            <div className="text-sm" style={{ color: "var(--text-muted)" }}>
              {detail.table ? detail.table.name : TYPE_LABEL[detail.type]}
              {detail.customerName ? ` · ${detail.customerName}` : ""} · aberta {time(detail.openedAt)}
            </div>

            {/* Itens */}
            {detail.items.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Nenhum item lançado ainda.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {detail.items.map((it) => (
                  <li
                    key={it.id}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <span className="text-sm shrink-0" style={{ color: "var(--text-muted)" }}>
                      {it.quantity}×
                    </span>
                    <span className="flex-1 text-sm min-w-0">
                      <span className="truncate">{it.name}</span>
                      {it.note ? (
                        <span className="block text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {it.note}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-sm">{currency(it.unitPrice * it.quantity)}</span>
                    <button
                      onClick={() => removeItem(it.id)}
                      className="text-xs px-2 py-0.5 rounded hover:bg-white/5"
                      style={{ color: "var(--danger)" }}
                      aria-label="Remover item"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Lançar item */}
            <div
              className="rounded-lg border p-3 space-y-2"
              style={{ borderColor: "var(--border)" }}
            >
              <span className="text-xs font-medium">Lançar item</span>
              <div className="flex gap-2">
                <select
                  className="orbita-input flex-1 px-3 py-2"
                  value={addForm.productId}
                  onChange={(e) => setAddForm((f) => ({ ...f, productId: e.target.value }))}
                >
                  <option value="">Selecione o produto</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {currency(p.price)}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  className="orbita-input w-16 px-2 py-2"
                  value={addForm.quantity}
                  onChange={(e) => setAddForm((f) => ({ ...f, quantity: e.target.value }))}
                />
              </div>
              <input
                className="orbita-input w-full px-3 py-2 text-sm"
                placeholder="Observação (ex.: sem cebola)"
                value={addForm.note}
                onChange={(e) => setAddForm((f) => ({ ...f, note: e.target.value }))}
              />
              <button
                onClick={addItem}
                disabled={adding || !addForm.productId || addQty <= 0}
                className="orbita-btn-secondary w-full px-3 py-2 text-sm disabled:opacity-50"
              >
                {adding
                  ? "Lançando..."
                  : addProduct
                    ? `+ Adicionar (${currency(addProduct.price * addQty)})`
                    : "+ Adicionar"}
              </button>
            </div>

            {/* Total + ações */}
            <div
              className="flex items-center justify-between border-t pt-3"
              style={{ borderColor: "var(--border)" }}
            >
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                Total
              </span>
              <span className="text-xl font-bold">{currency(detail.total)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={openClose}
                disabled={busy || detail.items.length === 0}
                className="orbita-btn px-4 py-2.5 disabled:opacity-50"
              >
                Fechar e cobrar
              </button>
              <button
                onClick={printReceipt}
                disabled={detail.items.length === 0}
                className="orbita-btn-secondary px-4 py-2.5 disabled:opacity-50"
              >
                🖨️ Cupom
              </button>
              <button
                onClick={cancelOrder}
                disabled={busy}
                className="orbita-btn-danger px-4 py-2.5"
              >
                Cancelar comanda
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Modal: fechamento (taxa de serviço, desconto, pagamento, divisão) */}
      <Modal
        open={!!closeForm}
        onClose={() => setCloseForm(null)}
        title="Fechar comanda"
        maxWidth="max-w-md"
      >
        {closeForm && detail && (() => {
          const subtotal = detail.total;
          const serviceFee = Math.round(subtotal * (Number(closeForm.serviceFeePct) || 0)) / 100;
          const discount = Number(closeForm.discount) || 0;
          const final = Math.max(0, Math.round((subtotal + serviceFee - discount) * 100) / 100);
          const people = Number(closeForm.people) || 0;
          return (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Taxa de serviço (%)
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    className="orbita-input w-full px-3 py-2.5"
                    value={closeForm.serviceFeePct}
                    onChange={(e) => setCloseForm((f) => (f ? { ...f, serviceFeePct: e.target.value } : f))}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Desconto (R$)
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    className="orbita-input w-full px-3 py-2.5"
                    value={closeForm.discount}
                    onChange={(e) => setCloseForm((f) => (f ? { ...f, discount: e.target.value } : f))}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Forma de pagamento
                  </span>
                  <select
                    className="orbita-input w-full px-3 py-2.5"
                    value={closeForm.paymentMethod}
                    onChange={(e) => setCloseForm((f) => (f ? { ...f, paymentMethod: e.target.value } : f))}
                  >
                    <option value="">Não informar</option>
                    <option value="CASH">Dinheiro</option>
                    <option value="CARD">Cartão</option>
                    <option value="PIX">PIX</option>
                    <option value="OTHER">Outro</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Dividir por (pessoas)
                  </span>
                  <input
                    type="number"
                    min={1}
                    className="orbita-input w-full px-3 py-2.5"
                    placeholder="—"
                    value={closeForm.people}
                    onChange={(e) => setCloseForm((f) => (f ? { ...f, people: e.target.value } : f))}
                  />
                </label>
              </div>

              <div
                className="rounded-lg border p-3 space-y-1 text-sm"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex justify-between" style={{ color: "var(--text-muted)" }}>
                  <span>Subtotal</span>
                  <span>{currency(subtotal)}</span>
                </div>
                <div className="flex justify-between" style={{ color: "var(--text-muted)" }}>
                  <span>Taxa de serviço</span>
                  <span>{currency(serviceFee)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between" style={{ color: "var(--danger)" }}>
                    <span>Desconto</span>
                    <span>− {currency(discount)}</span>
                  </div>
                )}
                <div
                  className="flex justify-between font-bold border-t pt-1 text-base"
                  style={{ borderColor: "var(--border)" }}
                >
                  <span>Total</span>
                  <span>{currency(final)}</span>
                </div>
                {people > 1 && (
                  <div className="flex justify-between text-[11px]" style={{ color: "var(--text-muted)" }}>
                    <span>Por pessoa ({people})</span>
                    <span>{currency(Math.ceil((final / people) * 100) / 100)}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button onClick={submitClose} disabled={busy} className="orbita-btn px-4 py-2.5">
                  {busy ? "Fechando..." : "Confirmar fechamento"}
                </button>
                <button
                  type="button"
                  onClick={() => setCloseForm(null)}
                  className="orbita-btn-secondary px-4 py-2.5"
                >
                  Cancelar
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      <TablesModal open={tablesOpen} onClose={() => setTablesOpen(false)} onChange={load} />
    </div>
  );
}
