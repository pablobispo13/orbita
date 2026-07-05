import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/jwt";
import { rotateRefreshToken } from "@/lib/refreshTokens";
import { jsonError } from "@/lib/auth";
import { withRoute } from "@/lib/http";

const schema = z.object({ refreshToken: z.string().min(1) });

// Troca um refresh token válido por um novo access token (JWT) e rotaciona o
// refresh token. Falha => o cliente faz logout.
export const POST = withRoute(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Refresh token ausente", 400);

  const rotated = await rotateRefreshToken(parsed.data.refreshToken);
  if (!rotated) return jsonError("Sessão expirada", 401);

  const user = await prisma.user.findUnique({
    where: { id: rotated.userId },
    select: { id: true, name: true, role: true, active: true },
  });
  if (!user || !user.active) return jsonError("Sessão inválida", 401);

  const token = signToken({ userId: user.id, role: user.role, name: user.name });
  return NextResponse.json({ token, refreshToken: rotated.refreshToken });
});
