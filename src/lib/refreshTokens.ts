// =============================================================================
// Refresh tokens (CP2.2) — sessão longa com rotação e revogação.
// Token opaco (não JWT), persistido para poder ser revogado. A cada uso é
// rotacionado (o antigo é apagado e um novo é emitido).
// =============================================================================

import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

// Duração do refresh token (padrão 30 dias).
const TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);

function newToken(): string {
  return randomBytes(48).toString("base64url");
}

function expiry(): Date {
  return new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000);
}

/// Emite e persiste um novo refresh token para o usuário.
export async function issueRefreshToken(userId: string): Promise<string> {
  const token = newToken();
  await prisma.refreshToken.create({
    data: { token, userId, expiresAt: expiry() },
  });
  return token;
}

/// Valida e ROTACIONA um refresh token: apaga o atual e emite um novo.
/// Retorna { userId, refreshToken } ou null se inválido/expirado.
export async function rotateRefreshToken(
  token: string
): Promise<{ userId: string; refreshToken: string } | null> {
  const existing = await prisma.refreshToken.findUnique({ where: { token } });
  if (!existing) return null;

  // Expirado: limpa e recusa.
  if (existing.expiresAt.getTime() < Date.now()) {
    await prisma.refreshToken.delete({ where: { token } }).catch(() => {});
    return null;
  }

  const refreshToken = newToken();
  await prisma.$transaction([
    prisma.refreshToken.delete({ where: { token } }),
    prisma.refreshToken.create({
      data: { token: refreshToken, userId: existing.userId, expiresAt: expiry() },
    }),
  ]);
  return { userId: existing.userId, refreshToken };
}

/// Revoga (apaga) um refresh token específico — usado no logout.
export async function revokeRefreshToken(token: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { token } });
}
