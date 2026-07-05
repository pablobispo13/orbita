import { NextRequest, NextResponse } from "next/server";
import { revokeRefreshToken } from "@/lib/refreshTokens";
import { withRoute } from "@/lib/http";

// Revoga o refresh token do dispositivo (best-effort) ao sair. Não exige auth:
// o próprio token já é a credencial e pode estar expirado no access.
export const POST = withRoute(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  const refreshToken = body?.refreshToken;
  if (typeof refreshToken === "string" && refreshToken) {
    await revokeRefreshToken(refreshToken);
  }
  return NextResponse.json({ ok: true });
});
