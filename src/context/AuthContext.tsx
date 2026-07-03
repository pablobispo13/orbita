"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import api, { handleLogout } from "@/lib/api";

export type Membership = {
  role: "ADMIN" | "STAFF";
  establishment: { id: string; name: string; slug: string };
  customRole: { id: string; name: string; permissions: string[] } | null;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "USER";
  active: boolean;
  mustChangePassword: boolean;
  memberships: Membership[];
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  activeEstablishmentId: string | null;
  setActiveEstablishment: (id: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Carrega o usuário autenticado uma vez e disponibiliza para todo o shell.
 * Sem token → /login. Com troca de senha pendente → /trocar-senha.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeEstablishmentId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      handleLogout("manual");
      return;
    }

    setActiveId(localStorage.getItem("activeEstablishmentId"));

    api
      .get<{ user: AuthUser }>("/auth/me")
      .then(({ data }) => {
        if (data.user.mustChangePassword) {
          window.location.href = "/trocar-senha";
          return;
        }
        setUser(data.user);
        const stored = localStorage.getItem("activeEstablishmentId");
        const valid = data.user.memberships.some(
          (m) => m.establishment.id === stored
        );
        if (!valid && data.user.memberships[0]) {
          const first = data.user.memberships[0].establishment.id;
          localStorage.setItem("activeEstablishmentId", first);
          setActiveId(first);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const setActiveEstablishment = useCallback((id: string) => {
    if (id) localStorage.setItem("activeEstablishmentId", id);
    else localStorage.removeItem("activeEstablishmentId");
    setActiveId(id || null);
  }, []);

  const logout = useCallback(() => {
    handleLogout("manual");
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, activeEstablishmentId, setActiveEstablishment, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext deve ser usado dentro de <AuthProvider>");
  return ctx;
}
