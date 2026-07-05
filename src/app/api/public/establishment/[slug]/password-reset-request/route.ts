import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  notify,
  establishmentManagerIds,
  NOTIFICATION_TYPES,
  NOTIFICATION_STATUS,
} from "@/lib/notifications";
import { sendPushToUsers } from "@/lib/push";
import { withRoute } from "@/lib/http";

const schema = z.object({ email: z.string().email() });

// Endpoint PÚBLICO: um funcionário que esqueceu a senha pede recuperação pela
// tela de login da empresa (/[slug]). Cria uma notificação PENDENTE para o gestor
// processar (gerar e repassar a senha). Nunca revela se o e-mail existe.
export const POST = withRoute(async (
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) => {
  const { slug } = await params;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "E-mail inválido" }, { status: 400 });
  }

  const establishment = await prisma.establishment.findUnique({
    where: { slug },
    select: { id: true, active: true },
  });

  // Resposta genérica sempre (não vaza existência de empresa/usuário).
  const ok = NextResponse.json({
    message: "Se o e-mail pertencer a esta empresa, o gestor foi avisado.",
  });

  if (!establishment || !establishment.active) return ok;

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, name: true, email: true },
  });
  if (!user) return ok;

  // Só cria se o usuário for de fato membro desta empresa.
  const membership = await prisma.membership.findUnique({
    where: {
      userId_establishmentId: { userId: user.id, establishmentId: establishment.id },
    },
    select: { id: true },
  });
  if (!membership) return ok;

  // Evita empilhar pedidos: se já houver um pendente para este usuário, não duplica.
  const existing = await prisma.notification.findFirst({
    where: {
      establishmentId: establishment.id,
      type: NOTIFICATION_TYPES.PASSWORD_RESET_REQUEST,
      status: NOTIFICATION_STATUS.PENDING,
      targetUserId: user.id,
    },
    select: { id: true },
  });
  if (existing) return ok;

  await notify({
    establishmentId: establishment.id,
    type: NOTIFICATION_TYPES.PASSWORD_RESET_REQUEST,
    status: NOTIFICATION_STATUS.PENDING,
    title: "Pedido de recuperação de senha",
    message: `${user.name} (${user.email}) solicitou uma nova senha.`,
    targetUserId: user.id,
  });

  // Avisa os gestores por push (fora do sistema), se houver assinaturas.
  const managers = await establishmentManagerIds(establishment.id);
  await sendPushToUsers(managers, {
    title: "Recuperação de senha",
    body: `${user.name} pediu uma nova senha.`,
    url: `/${slug}/dashboard`,
    tag: `pwd-${user.id}`,
  });

  return ok;
});
