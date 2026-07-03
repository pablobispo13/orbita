// Seed: cria o SUPER_ADMIN da plataforma (idempotente).
// As credenciais NÃO ficam no código — passe-as no momento da execução:
//
//   SUPERADMIN_EMAIL="voce@dominio.com" \
//   SUPERADMIN_PASSWORD="senha-forte" \
//   SUPERADMIN_NAME="Seu Nome" \
//   npm run db:seed
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPERADMIN_EMAIL;
  const password = process.env.SUPERADMIN_PASSWORD;
  const name = process.env.SUPERADMIN_NAME ?? "Super Admin";

  if (!email || !password) {
    console.error(
      "Defina SUPERADMIN_EMAIL e SUPERADMIN_PASSWORD ao rodar o seed.\n" +
        'Ex.: SUPERADMIN_EMAIL="voce@dominio.com" SUPERADMIN_PASSWORD="..." npm run db:seed'
    );
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Super admin já existe. Nada a fazer.");
    return;
  }

  const hashed = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { name, email, password: hashed, role: "SUPER_ADMIN" },
  });

  console.log("✅ Super admin criado. Use as credenciais informadas para entrar.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
