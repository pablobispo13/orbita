// Constantes de notificação seguras para o cliente (sem prisma).
// Compartilhadas entre a API (server) e a UI (client).

export const NOTIFICATION_TYPES = {
  PASSWORD_RESET_REQUEST: "PASSWORD_RESET_REQUEST",
  PRODUCT_EXPIRY: "PRODUCT_EXPIRY",
  PROFIT_REPORT: "PROFIT_REPORT",
  GENERIC: "GENERIC",
} as const;

export type NotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export const NOTIFICATION_STATUS = {
  PENDING: "PENDING",
  RESOLVED: "RESOLVED",
  INFO: "INFO",
} as const;

export type NotificationStatus =
  (typeof NOTIFICATION_STATUS)[keyof typeof NOTIFICATION_STATUS];

/// Rótulos/ícones para exibição na UI (bell e filtros).
export const NOTIFICATION_META: Record<
  NotificationType,
  { label: string; icon: string }
> = {
  PASSWORD_RESET_REQUEST: { label: "Recuperação de senha", icon: "🔑" },
  PRODUCT_EXPIRY: { label: "Vencimento de produto", icon: "⏰" },
  PROFIT_REPORT: { label: "Relatório de lucro", icon: "📈" },
  GENERIC: { label: "Aviso", icon: "🔔" },
};
