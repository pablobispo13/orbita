import axios, { AxiosHeaders, InternalAxiosRequestConfig } from "axios";
import { toast } from "react-toastify";

declare module "axios" {
  interface AxiosRequestConfig {
    silent?: boolean;
    _retry?: boolean;
  }
}

export type LogoutReason = "expired" | "manual" | "password_changed";

export function handleLogout(reason?: LogoutReason, redirectTo = "/login") {
  if (typeof window === "undefined") return;
  const refreshToken = localStorage.getItem("refreshToken");
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("activeEstablishmentId");
  if (reason) localStorage.setItem("logout_reason", reason);
  // Revoga o refresh token no servidor (best-effort; sobrevive à navegação).
  if (refreshToken) {
    try {
      fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
        keepalive: true,
      });
    } catch {
      /* ignora */
    }
  }
  window.location.href = redirectTo;
}

// Extrai a mensagem de erro (motivo) de uma resposta da API, para exibir inline
// em formulários/modais. Casa com o formato padronizado { message, errors? }.
export function apiErrorMessage(err: unknown, fallback = "Não foi possível concluir."): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string } | undefined;
    if (data?.message) return data.message;
    if (!err.response) return "Sem resposta do servidor.";
  }
  return fallback;
}

const api = axios.create({ baseURL: "/api" });

// Adiciona automaticamente o token e a empresa ativa em cada request.
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window === "undefined") return config;

  if (!config.headers) {
    config.headers = new AxiosHeaders();
  } else if (!(config.headers instanceof AxiosHeaders)) {
    config.headers = AxiosHeaders.from(config.headers);
  }

  const token = localStorage.getItem("token");
  if (token) config.headers.set("Authorization", `Bearer ${token}`);

  const establishmentId = localStorage.getItem("activeEstablishmentId");
  if (establishmentId) config.headers.set("x-establishment-id", establishmentId);

  return config;
});

// --- Refresh token: troca o access expirado por um novo, com deduplicação ---
let refreshing: Promise<string | null> | null = null;

function refreshAccess(): Promise<string | null> {
  if (!refreshing) {
    refreshing = (async () => {
      const refreshToken = localStorage.getItem("refreshToken");
      if (!refreshToken) return null;
      try {
        // axios "cru" (sem interceptors) evita loop de refresh.
        const { data } = await axios.post("/api/auth/refresh", { refreshToken });
        localStorage.setItem("token", data.token);
        if (data.refreshToken) localStorage.setItem("refreshToken", data.refreshToken);
        return data.token as string;
      } catch {
        return null;
      }
    })();
    refreshing.finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

function isAuthCall(url?: string): boolean {
  return (
    !!url &&
    (url.includes("/auth/login") ||
      url.includes("/auth/refresh") ||
      url.includes("/auth/register"))
  );
}

// Trata erros globais: 401 tenta refresh (1x) e repete; falhou => logout.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = (error.config ?? {}) as InternalAxiosRequestConfig;
    const silent = original.silent === true;
    const status = error.response?.status;

    if (status === 401 && !original._retry && !isAuthCall(original.url)) {
      original._retry = true;
      const newToken = await refreshAccess();
      if (newToken) {
        if (!(original.headers instanceof AxiosHeaders)) {
          original.headers = AxiosHeaders.from(original.headers || {});
        }
        original.headers.set("Authorization", `Bearer ${newToken}`);
        return api(original);
      }
      handleLogout("expired");
      return Promise.reject(error);
    }

    if (!silent) {
      if (error.response) {
        toast.error(error.response.data?.message || `Erro: ${status}`);
      } else {
        toast.error("Sem resposta do servidor.");
      }
    }
    return Promise.reject(error);
  }
);

export default api;
