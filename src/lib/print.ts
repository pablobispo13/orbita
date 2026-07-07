// =============================================================================
// Impressão via janela do navegador (cupom/recibo e comanda da cozinha).
// Sem dependência externa: abre uma janela estreita estilo bobina térmica e
// dispara a impressão (o usuário imprime na térmica ou salva como PDF).
// =============================================================================

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string)
  );
}

/// Abre a janela de impressão com o HTML interno. Retorna false se bloqueada.
export function openPrintWindow(title: string, inner: string, width = 300): boolean {
  const w = window.open("", "_blank", `width=${width},height=640`);
  if (!w) return false;
  w.document.write(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    * { box-sizing: border-box; }
    body { font-family: ui-monospace, Menlo, Consolas, monospace; color:#000; margin:0; padding:12px; width:${width}px; font-size:12px; }
    h1 { font-size:15px; margin:0 0 2px; text-align:center; }
    .muted { color:#555; }
    .row { display:flex; justify-content:space-between; gap:8px; }
    .hr { border-top:1px dashed #000; margin:6px 0; }
    .center { text-align:center; }
    .b { font-weight:700; }
    .big { font-size:14px; }
    ul { list-style:none; margin:0; padding:0; }
    li { margin:2px 0; }
    @media print { body { width:auto; } }
  </style></head><body>${inner}<script>window.onload=function(){window.print()}</script></body></html>`
  );
  w.document.close();
  return true;
}
