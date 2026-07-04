// =============================================================================
// Sistema de notificações por empresa (multi-tenant).
// Ponto único de criação (`notify`) para todos os módulos: recuperação de senha,
// vencimento de produtos (Fase 3), relatórios de lucro (Fase 4) e avisos gerais.
// =============================================================================

import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_STATUS,
  type NotificationType,
  type NotificationStatus,
} from "@/lib/notificationTypes";

export {
  NOTIFICATION_TYPES,
  NOTIFICATION_STATUS,
  NOTIFICATION_META,
} from "@/lib/notificationTypes";
export type { NotificationType, NotificationStatus } from "@/lib/notificationTypes";

/// IDs dos usuários que podem GERIR membros na empresa (dono + cargos com
/// member:manage). Usado para direcionar pushes de recuperação de senha.
export async function establishmentManagerIds(establishmentId: string): Promise<string[]> {
  const memberships = await prisma.membership.findMany({
    where: { establishmentId },
    include: { customRole: { select: { permissions: true } } },
  });
  return memberships
    .filter(
      (m) =>
        m.role === "ADMIN" ||
        (m.customRole?.permissions ?? []).includes(PERMISSIONS.MEMBER_MANAGE)
    )
    .map((m) => m.userId);
}

/// IDs de todos os membros da empresa (para avisos gerais).
export async function establishmentMemberIds(establishmentId: string): Promise<string[]> {
  const memberships = await prisma.membership.findMany({
    where: { establishmentId },
    select: { userId: true },
  });
  return memberships.map((m) => m.userId);
}

/// Cria uma notificação. `establishmentId` nulo => notificação de plataforma
/// (super admin -> usuário). `status` PENDING = requer ação do gestor.
export async function notify(params: {
  establishmentId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  status?: NotificationStatus;
  targetUserId?: string | null;
}) {
  return prisma.notification.create({
    data: {
      establishmentId: params.establishmentId ?? null,
      type: params.type,
      title: params.title,
      message: params.message,
      status: params.status ?? NOTIFICATION_STATUS.INFO,
      targetUserId: params.targetUserId ?? null,
    },
  });
}
