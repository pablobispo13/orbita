import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, jsonError, zodError } from "@/lib/auth";
import { withRoute } from "@/lib/http";

const schema = z.object({
  currentPassword: z.string().min(1, "Informe a senha atual"),
  newPassword: z.string().min(6, "A nova senha deve ter ao menos 6 caracteres"),
});

// Troca de senha do PRÓPRIO usuário autenticado.
export const POST = withRoute(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

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

  // Segurança: invalida todas as sessões antigas (refresh tokens) após a troca.
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

  return NextResponse.json({ message: "Senha alterada com sucesso" });
});
