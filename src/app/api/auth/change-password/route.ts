import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, jsonError } from "@/lib/auth";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

// Troca de senha do PRÓPRIO usuário autenticado.
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Nova senha deve ter ao menos 6 caracteres", 400);
  }

  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: auth.user.userId } });
  if (!user) return jsonError("Usuário não encontrado", 404);

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) return jsonError("Senha atual incorreta", 400);

  if (currentPassword === newPassword) {
    return jsonError("A nova senha deve ser diferente da atual", 400);
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed, mustChangePassword: false },
  });

  return NextResponse.json({ message: "Senha alterada com sucesso" });
}
