import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/jwt";
import { jsonError } from "@/lib/auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Dados inválidos", 400);

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

  return NextResponse.json({
    token,
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
}
