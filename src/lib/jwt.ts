import jwt, { type SignOptions } from "jsonwebtoken";
import type { SystemRole } from "@prisma/client";

export type JwtPayload = {
  userId: string;
  role: SystemRole;
  name: string;
};

// Access token curto — a sessão longa vem do refresh token (ver src/lib/refreshTokens.ts).
const EXPIRES_IN = (process.env.ACCESS_TOKEN_TTL ||
  "1h") as SignOptions["expiresIn"];

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    if (!decoded.userId || !decoded.role) return null;
    return decoded;
  } catch {
    return null;
  }
}
