"use client";

import { useParams } from "next/navigation";
import { AuthProvider } from "@/context/AuthContext";
import { AppShell } from "@/components/AppShell";

// Área operacional de uma EMPRESA específica (contexto empresa).
export default function CompanyDashboardPage() {
  const { slug } = useParams<{ slug: string }>();
  return (
    <AuthProvider>
      <AppShell mode="company" slug={slug} />
    </AuthProvider>
  );
}
