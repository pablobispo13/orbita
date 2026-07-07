// Purga refresh tokens expirados (higiene da tabela RefreshToken).
// Rode manualmente ou via cron/agendador: npm run tokens:purge
import { purgeExpiredRefreshTokens } from "@/lib/refreshTokens";
import { prisma } from "@/lib/prisma";

const n = await purgeExpiredRefreshTokens();
console.log(`✅ ${n} refresh token(s) expirado(s) removido(s).`);
await prisma.$disconnect();
