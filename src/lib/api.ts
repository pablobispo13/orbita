import axios, { AxiosHeaders, InternalAxiosRequestConfig } from "axios";
import { toast } from "react-toastify";

declare module "axios" {
  interface AxiosRequestConfig {
    silent?: boolean;
  }
}

export type LogoutReason = "expired" | "manual" | "password_changed";

export function handleLogout(reason?: LogoutReason, redirectTo = "/login") {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
  localStorage.removeItem("activeEstablishmentId");
  if (reason) localStorage.setItem("logout_reason", reason);
  window.location.href = redirectTo;
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

// Trata erros globais (401 => logout; demais => toast).
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const silent = error.config?.silent === true;
    if (!silent) {
      if (error.response) {
        const { status, data } = error.response;
        if (status === 401) handleLogout("expired");
        else toast.error(data?.message || `Erro: ${status}`);
      } else {
        toast.error("Sem resposta do servidor.");
      }
    }
    return Promise.reject(error);
  }
);

export default api;
