"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

type CompanyUser = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  establishmentRole: "ADMIN" | "STAFF";
  roleName: string | null;
};

// Usuários (equipe) da empresa ativa. Escopo garantido pelo x-establishment-id.
export function CompanyUsersView({ companyName }: { companyName?: string | null }) {
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ users: CompanyUser[] }>("/company/users")
      .then(({ data }) => setUsers(data.users))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 md:p-10 w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Usuários {companyName ? `· ${companyName}` : ""}</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Equipe desta empresa.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="orbita-spinner" />
        </div>
      ) : users.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>Nenhum usuário nesta empresa.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {users.map((u) => (
            <div key={u.id} className="orbita-card p-4 space-y-1">
              <div className="font-medium">{u.name}</div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                {u.email}
              </div>
              <div className="text-xs mt-1" style={{ color: "var(--brand-text)" }}>
                {u.establishmentRole === "ADMIN"
                  ? "Dono (ADMIN)"
                  : u.roleName ?? "Funcionário"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
