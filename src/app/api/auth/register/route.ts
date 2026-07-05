import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/jwt";
import { issueRefreshToken } from "@/lib/refreshTokens";
import { jsonError, zodError } from "@/lib/auth";
import { withRoute } from "@/lib/http";
import { uniqueEstablishmentSlug } from "@/lib/slug";

// Onboarding do DONO: cria o usuário, a empresa (tenant) e o vínculo ADMIN.
const schema = z.object({
  name: z.string().min(2, "O nome deve ter ao menos 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "A senha deve ter ao menos 6 caracteres"),
  establishmentName: z.string().min(2, "O nome da empresa deve ter ao menos 2 caracteres"),
});

export const POST = withRoute(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const { name, email, password, establishmentName } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return jsonError("E-mail já cadastrado", 400);

  const hashed = await bcrypt.hash(password, 10);

  // Slug único para a empresa.
  const slug = await uniqueEstablishmentSlug(establishmentName);

  const user = await prisma.user.create({
    data: { name, email, password: hashed, role: "USER" },
  });

  const establishment = await prisma.establishment.create({
    data: { name: establishmentName, slug, ownerId: user.id },
  });

  await prisma.membership.create({
    data: {
      userId: user.id,
      establishmentId: establishment.id,
      role: "ADMIN",
    },
  });

  const token = signToken({ userId: user.id, role: user.role, name: user.name });
  const refreshToken = await issueRefreshToken(user.id);

  return NextResponse.json({
    token,
    refreshToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    establishment: { id: establishment.id, name: establishment.name, slug: establishment.slug },
  });
});
