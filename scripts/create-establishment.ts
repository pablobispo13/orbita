// Cria uma empresa (Establishment) + seu dono (User ADMIN) — idempotente.
// As credenciais NÃO ficam no código — passe-as no momento da execução:
//
//   ESTAB_NAME="Minha Empresa" ESTAB_SLUG="minha-empresa" \
//   OWNER_NAME="Nome do Dono" OWNER_EMAIL="dono@dominio.com" \
//   OWNER_PASSWORD="senha-forte" \
//   npx tsx scripts/create-establishment.ts
//
// ESTAB_SLUG é opcional (derivado do nome). Sem OWNER_PASSWORD, gera uma
// senha aleatória e a imprime UMA vez no final.
import { randomBytes } from "crypto";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  const name = process.env.ESTAB_NAME;
  const ownerName = process.env.OWNER_NAME;
  const ownerEmail = process.env.OWNER_EMAIL;

  if (!name || !ownerName || !ownerEmail) {
    console.error(
      "Defina ESTAB_NAME, OWNER_NAME e OWNER_EMAIL.\n" +
        'Ex.: ESTAB_NAME="Minha Empresa" OWNER_NAME="Dono" OWNER_EMAIL="dono@dominio.com" ' +
        "npx tsx scripts/create-establishment.ts"
    );
    process.exit(1);
  }

  const slug = process.env.ESTAB_SLUG || slugify(name);
  const ownerPassword =
    process.env.OWNER_PASSWORD ?? randomBytes(6).toString("base64url");

  const existing = await prisma.establishment.findUnique({ where: { slug } });
  if (existing) {
    console.log(`⚠️  Empresa "${slug}" já existe. Nada a fazer.`);
    return;
  }

  // Reaproveita o usuário se o e-mail já existir; senão cria.
  let owner = await prisma.user.findUnique({ where: { email: ownerEmail } });
  let createdOwner = false;
  if (!owner) {
    const hashed = await bcrypt.hash(ownerPassword, 10);
    owner = await prisma.user.create({
      data: { name: ownerName, email: ownerEmail, password: hashed, role: "USER" },
    });
    createdOwner = true;
  }

  const establishment = await prisma.establishment.create({
    data: { name, slug, ownerId: owner.id },
  });

  await prisma.membership.create({
    data: { userId: owner.id, establishmentId: establishment.id, role: "ADMIN" },
  });

  console.log(`✅ Empresa "${establishment.name}" criada — acesso: /${establishment.slug}`);
  if (createdOwner && !process.env.OWNER_PASSWORD) {
    console.log(`   Senha gerada para o dono (anote agora): ${ownerPassword}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
