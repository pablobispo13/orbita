// =============================================================================
// Web Push (server) — envia notificações do sistema para fora (Windows/mobile),
// mesmo com o app fechado, via Service Worker + VAPID.
// Configuração ausente => vira no-op (o app segue funcionando sem push).
// =============================================================================

import webpush from "web-push";
import { prisma } from "@/lib/prisma";

const PUBLIC = process.env.VAPID_PUBLIC_KEY;
const PRIVATE = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

export const pushConfigured = Boolean(PUBLIC && PRIVATE);

if (pushConfigured) {
  webpush.setVapidDetails(SUBJECT, PUBLIC!, PRIVATE!);
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

/// Envia um push para todos os dispositivos de um usuário. Remove assinaturas
/// inválidas (410/404). Nunca lança — falha de push não quebra o fluxo.
export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!pushConfigured) return;

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return;

  const body = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Assinatura expirada/cancelada — limpa.
          await prisma.pushSubscription
            .delete({ where: { endpoint: sub.endpoint } })
            .catch(() => {});
        }
      }
    })
  );
}

/// Envia um push para vários usuários.
export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  await Promise.all(userIds.map((id) => sendPushToUser(id, payload)));
}
