import { NextRequest, NextResponse } from "next/server";
import { verifyToken, type JwtPayload } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import { ALL_PERMISSIONS, type Permission } from "@/lib/permissions";

// -----------------------------------------------------------------------------
// Helpers de resposta
// -----------------------------------------------------------------------------

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ message }, { status });
}

// -----------------------------------------------------------------------------
// Autenticação simples (só exige token válido)
// -----------------------------------------------------------------------------

export function getBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

/// Retorna o payload do usuário autenticado ou null.
export function getAuthUser(req: NextRequest): JwtPayload | null {
  const token = getBearerToken(req);
  if (!token) return null;
  return verifyToken(token);
}

/// Exige autenticação. Retorna { user } ou { response } (erro pronto).
export function requireAuth(
  req: NextRequest
): { user: JwtPayload; response?: never } | { user?: never; response: NextResponse } {
  const user = getAuthUser(req);
  if (!user) return { response: jsonError("Não autorizado", 401) };
  return { user };
}

// -----------------------------------------------------------------------------
// Contexto de empresa (multi-tenant) + permissões efetivas
// -----------------------------------------------------------------------------

export type EstablishmentContext = {
  user: JwtPayload;
  establishmentId: string;
  isSuperAdmin: boolean;
  isEstablishmentAdmin: boolean;
  permissions: Permission[];
};

/// Resolve a empresa ativa (header `x-establishment-id` ou query `establishmentId`),
/// valida o acesso do usuário e calcula as permissões efetivas.
///   - SUPER_ADMIN: acesso total a qualquer empresa.
///   - ADMIN (dono): todas as permissões da própria empresa.
///   - STAFF: permissões vindas do cargo (customRole) atribuído.
export async function requireEstablishment(
  req: NextRequest
): Promise<
  | { ctx: EstablishmentContext; response?: never }
  | { ctx?: never; response: NextResponse }
> {
  const auth = requireAuth(req);
  if (auth.response) return { response: auth.response };
  const user = auth.user;

  const establishmentId =
    req.headers.get("x-establishment-id") ||
    req.nextUrl.searchParams.get("establishmentId");

  if (!establishmentId) {
    return { response: jsonError("establishmentId obrigatório", 400) };
  }

  // SUPER_ADMIN passa direto, com todas as permissões.
  if (user.role === "SUPER_ADMIN") {
    return {
      ctx: {
        user,
        establishmentId,
        isSuperAdmin: true,
        isEstablishmentAdmin: true,
        permissions: ALL_PERMISSIONS,
      },
    };
  }

  const membership = await prisma.membership.findUnique({
    where: {
      userId_establishmentId: { userId: user.userId, establishmentId },
    },
    include: { customRole: true },
  });

  if (!membership) {
    return { response: jsonError("Sem acesso a esta empresa", 403) };
  }

  const isEstablishmentAdmin = membership.role === "ADMIN";
  const permissions: Permission[] = isEstablishmentAdmin
    ? ALL_PERMISSIONS
    : ((membership.customRole?.permissions ?? []) as Permission[]);

  return {
    ctx: {
      user,
      establishmentId,
      isSuperAdmin: false,
      isEstablishmentAdmin,
      permissions,
    },
  };
}

/// Igual a requireEstablishment, mas também exige uma permissão específica.
export async function requirePermission(
  req: NextRequest,
  permission: Permission
): Promise<
  | { ctx: EstablishmentContext; response?: never }
  | { ctx?: never; response: NextResponse }
> {
  const result = await requireEstablishment(req);
  if (result.response) return result;
  if (!result.ctx.permissions.includes(permission)) {
    return { response: jsonError("Permissão insuficiente", 403) };
  }
  return result;
}
