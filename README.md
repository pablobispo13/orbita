# 🛰️ Órbita

**Console central de gestão multi-empresa** — financeiro e estoque para múltiplas
empresas (ex.: pizzarias). Next.js (App Router) + Prisma + MongoDB, com API e front
na mesma aplicação, pronto para deploy na Vercel.

> **Órbita** é a plataforma (o produto). Cada empresa é um *tenant* isolado,
> identificado por um `slug` — ex.: `nonobargette` é uma empresa dentro da Órbita.

## Acesso

| URL              | Quem                                                          |
| ---------------- | ------------------------------------------------------------ |
| `/login`         | Acesso geral. SUPER_ADMIN vê **todas** as empresas.          |
| `/[slug]`        | Login **da empresa** (ex.: `/nonobargette`), com a marca dela. |

O login por `slug` valida se o usuário pertence àquela empresa e já define a
empresa ativa após o acesso.

## Arquitetura de acesso (RBAC multi-tenant)

```
SUPER_ADMIN  ── gerencia a plataforma inteira (todas as empresas)
  └─ Establishment (empresa / pizzaria — tenant isolado)
       ├─ ADMIN (dono)  ── cria cargos e gerencia sua empresa
       │     └─ Role "Caixa"   → [sales..., finance:read]
       │     └─ Role "Estoque" → [stock:read, stock:write]
       └─ STAFF (funcionário) → permissões vindas do Role atribuído
```

- **Multi-empresa:** cada `Establishment` é isolado; todo dado (estoque, financeiro,
  produtos, cargos) é scopado por `establishmentId`. Um usuário pode pertencer a
  várias empresas (via `Membership`).
- **Permissões:** catálogo em [`src/lib/permissions.ts`](src/lib/permissions.ts),
  armazenadas como `String[]` em `Role.permissions`.

## Stack

| Camada    | Tecnologia                                  |
| --------- | ------------------------------------------- |
| Framework | Next.js 15 (App Router, route handlers)     |
| ORM       | Prisma 6                                     |
| Banco     | MongoDB (atual) → PostgreSQL (portável)      |
| Auth      | JWT (`jsonwebtoken`) + `bcrypt`             |
| Validação | Zod                                          |

## Setup

```bash
npm install
cp .env.example .env        # preencha DATABASE_URL e JWT_SECRET
npm run db:generate         # gera o Prisma Client
npm run db:push             # cria as coleções no MongoDB
npm run db:seed             # cria o SUPER_ADMIN
npm run dev
```

## Banco de dados & migrations

- **MongoDB (agora):** use `npm run db:push`. O Prisma **não** suporta
  `migrate` no MongoDB — apenas `db push`.
- **PostgreSQL (futuro):** o schema é **relacional-portável**. Para migrar:
  1. `provider = "postgresql"` no [`prisma/schema.prisma`](prisma/schema.prisma).
  2. Troque os `@id` de `@default(auto()) @map("_id") @db.ObjectId` para
     `@default(cuid())` e remova os `@db.ObjectId`.
  3. `npx prisma migrate dev --name init` — migrations passam a funcionar.

## Endpoints principais

| Método | Rota                          | Proteção                        |
| ------ | ----------------------------- | ------------------------------- |
| POST   | `/api/auth/register`          | público (onboarding do dono)    |
| POST   | `/api/auth/login`             | público                         |
| GET    | `/api/auth/me`                | autenticado                     |
| GET    | `/api/health`                 | público                         |
| GET    | `/api/public/establishment/[slug]` | público (marca do login por empresa) |
| GET/POST | `/api/roles`                | permissão `role:manage`         |
| GET/POST | `/api/stock`                | `stock:read` / `stock:write`    |
| GET    | `/api/admin/establishments`   | SUPER_ADMIN                     |

Requests autenticados enviam `Authorization: Bearer <token>` e, para escopo de
empresa, o header `x-establishment-id`.

## Deploy na Vercel

1. Importe o repositório na Vercel.
2. Configure as env vars `DATABASE_URL` e `JWT_SECRET`.
3. O build já roda `prisma generate` (ver `package.json`).
