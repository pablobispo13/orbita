import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { requireAuth, jsonError } from "@/lib/auth";

// Reset de senha de um usuário pelo SUPER_ADMIN.
// Gera uma senha aleatória, marca mustChangePassword=true e retorna a senha
// UMA vez para o super admin repassar ao usuário (que será obrigado a trocá-la).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response } = requireAuth(req);
  if (response) return response;
  if (user.role !== "SUPER_ADMIN") return jsonError("Acesso restrito", 403);

  const { id } = await params;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return jsonError("Usuário não encontrado", 404);

  // Senha temporária legível (~11 chars, sem ambiguidade de base64url).
  const generated = randomBytes(8).toString("base64url");
  const hashed = await bcrypt.hash(generated, 10);

  await prisma.user.update({
    where: { id },
    data: { password: hashed, mustChangePassword: true },
  });

  return NextResponse.json({
    message: "Senha resetada",
    email: target.email,
    generatedPassword: generated,
  });
}
