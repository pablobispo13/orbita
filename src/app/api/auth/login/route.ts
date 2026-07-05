import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/jwt";
import { issueRefreshToken } from "@/lib/refreshTokens";
import { jsonError, zodError } from "@/lib/auth";
import { withRoute } from "@/lib/http";

const schema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});

export const POST = withRoute(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      memberships: {
        include: { establishment: { select: { id: true, name: true, slug: true } } },
      },
    },
  });
  if (!user || !user.active) return jsonError("Credenciais inválidas", 401);

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return jsonError("Credenciais inválidas", 401);

  const token = signToken({ userId: user.id, role: user.role, name: user.name });
  const refreshToken = await issueRefreshToken(user.id);

  return NextResponse.json({
    token,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    },
    memberships: user.memberships.map((m) => ({
      role: m.role,
      establishment: m.establishment,
    })),
  });
});
