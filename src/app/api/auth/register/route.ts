import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/jwt";
import { jsonError } from "@/lib/auth";

// Onboarding do DONO: cria o usuário, a empresa (tenant) e o vínculo ADMIN.
const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  establishmentName: z.string().min(2),
});

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Dados inválidos", 400);

  const { name, email, password, establishmentName } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return jsonError("E-mail já cadastrado", 400);

  const hashed = await bcrypt.hash(password, 10);

  // Slug único para a empresa.
  const base = slugify(establishmentName) || "empresa";
  let slug = base;
  let n = 1;
  while (await prisma.establishment.findUnique({ where: { slug } })) {
    slug = `${base}-${++n}`;
  }

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

  return NextResponse.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    establishment: { id: establishment.id, name: establishment.name, slug: establishment.slug },
  });
}
