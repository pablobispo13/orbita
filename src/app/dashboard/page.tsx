"use client";

import { AuthProvider } from "@/context/AuthContext";
import { AppShell } from "@/components/AppShell";

// Área da PLATAFORMA (super admin). Empresas viram /{slug}/dashboard.
export default function PlatformDashboardPage() {
  return (
    <AuthProvider>
      <AppShell mode="platform" />
    </AuthProvider>
  );
}
