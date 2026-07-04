// Navegação interna orientada a ação (ex.: clicar numa notificação abre a aba de
// usuários já filtrada). Comunicação leve via CustomEvent, capturada pelo AppShell.

export type NavigateDetail = { view: string; userId?: string };

const EVENT = "orbita:navigate";

export function navigateToView(detail: NavigateDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<NavigateDetail>(EVENT, { detail }));
}

export function onNavigate(handler: (detail: NavigateDetail) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<NavigateDetail>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
