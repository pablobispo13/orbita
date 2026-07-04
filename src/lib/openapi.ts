// =============================================================================
// Especificação OpenAPI 3.0 da API.
// Fonte única para a documentação Swagger (servida em /api/docs, UI em /docs).
// Ao criar/alterar uma rota em src/app/api, atualize o path correspondente aqui.
// =============================================================================

import { APP_NAME } from "@/lib/brand";

// Cabeçalhos comuns às rotas com escopo de empresa (multi-tenant).
const establishmentHeader = {
  name: "x-establishment-id",
  in: "header",
  required: true,
  schema: { type: "string" },
  description: "ID da empresa (tenant) ativa. Define o escopo dos dados.",
};

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: `${APP_NAME} — API`,
    version: "0.1.0",
    description:
      "API multi-tenant de gestão financeira e estoque. Autenticação via JWT " +
      "(`Authorization: Bearer <token>`). Rotas de empresa exigem o header " +
      "`x-establishment-id` com o tenant ativo.",
  },
  servers: [{ url: "/api", description: "Base da API" }],
  tags: [
    { name: "Auth", description: "Autenticação e sessão do usuário" },
    { name: "Plataforma", description: "Gestão da plataforma (SUPER_ADMIN)" },
    { name: "Empresa", description: "Operação dentro de uma empresa (tenant)" },
    { name: "Cargos", description: "Cargos (Roles) e permissões por empresa" },
    { name: "Estoque", description: "Insumos e estoque" },
    { name: "Notificações", description: "Notificações e Web Push" },
    { name: "Público", description: "Endpoints públicos (sem autenticação)" },
    { name: "Sistema", description: "Saúde e utilidades" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: { message: { type: "string" } },
      },
      Role: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string", nullable: true },
          permissions: { type: "array", items: { type: "string" } },
        },
      },
      RoleInput: {
        type: "object",
        required: ["name", "permissions"],
        properties: {
          name: { type: "string", minLength: 2, example: "Gerente" },
          description: { type: "string", nullable: true },
          permissions: {
            type: "array",
            items: { type: "string" },
            example: ["role:manage", "stock:read"],
          },
        },
      },
    },
  },
  // Segurança padrão: JWT. Rotas públicas sobrescrevem com `security: []`.
  security: [{ bearerAuth: [] }],
  paths: {
    // -------------------------------------------------------------- Auth
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Autentica e retorna um token JWT",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Login bem-sucedido (token + usuário + vínculos)" },
          401: {
            description: "Credenciais inválidas",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Onboarding do dono: cria usuário + empresa + vínculo ADMIN",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email", "password", "establishmentName"],
                properties: {
                  name: { type: "string", minLength: 2 },
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 6 },
                  establishmentName: { type: "string", minLength: 2 },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Empresa e usuário criados (retorna token)" },
          400: { description: "Dados inválidos ou e-mail já cadastrado" },
        },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Dados do usuário autenticado (com vínculos e cargos)",
        responses: {
          200: { description: "Usuário atual" },
          401: { description: "Não autorizado" },
        },
      },
    },
    "/auth/change-password": {
      post: {
        tags: ["Auth"],
        summary: "Troca a senha do próprio usuário",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["currentPassword", "newPassword"],
                properties: {
                  currentPassword: { type: "string" },
                  newPassword: { type: "string", minLength: 6 },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Senha alterada" },
          400: { description: "Senha atual incorreta ou nova senha inválida" },
          401: { description: "Não autorizado" },
        },
      },
    },
    // -------------------------------------------------------- Plataforma
    "/admin/establishments": {
      get: {
        tags: ["Plataforma"],
        summary: "Lista todas as empresas da plataforma (SUPER_ADMIN)",
        responses: {
          200: { description: "Lista de empresas" },
          403: { description: "Acesso restrito ao SUPER_ADMIN" },
        },
      },
    },
    "/admin/users": {
      get: {
        tags: ["Plataforma"],
        summary: "Lista todos os usuários da plataforma (SUPER_ADMIN)",
        responses: {
          200: { description: "Lista de usuários" },
          403: { description: "Acesso restrito ao SUPER_ADMIN" },
        },
      },
    },
    "/admin/users/{id}/reset-password": {
      post: {
        tags: ["Plataforma"],
        summary: "Reseta a senha de um usuário (gera senha temporária)",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Senha temporária gerada" },
          403: { description: "Acesso restrito ao SUPER_ADMIN" },
        },
      },
    },
    // ------------------------------------------------------------ Empresa
    "/company/users": {
      get: {
        tags: ["Empresa"],
        summary: "Lista os membros (equipe) da empresa ativa",
        parameters: [establishmentHeader],
        responses: {
          200: { description: "Equipe da empresa" },
          400: { description: "establishmentId obrigatório" },
          403: { description: "Sem acesso a esta empresa" },
        },
      },
      post: {
        tags: ["Empresa"],
        summary: "Adiciona um membro à empresa (cria/vincula usuário + cargo)",
        description:
          "Exige member:manage. Se o e-mail já existir, apenas vincula; senão " +
          "cria o usuário com senha temporária (retornada uma vez).",
        parameters: [establishmentHeader],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email"],
                properties: {
                  name: { type: "string", minLength: 2 },
                  email: { type: "string", format: "email" },
                  customRoleId: {
                    type: "string",
                    nullable: true,
                    description: "Cargo (Role) atribuído ao membro",
                  },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Membro criado ou vinculado" },
          400: { description: "Dados inválidos / cargo inválido" },
          403: { description: "Permissão insuficiente (member:manage)" },
          409: { description: "Usuário já é membro da empresa" },
        },
      },
    },
    "/company/users/{id}": {
      patch: {
        tags: ["Empresa"],
        summary: "Reatribui o cargo de um membro (member:manage)",
        parameters: [
          establishmentHeader,
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "userId do membro",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["customRoleId"],
                properties: {
                  customRoleId: { type: "string", nullable: true },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Cargo atualizado" },
          404: { description: "Membro não encontrado" },
          409: { description: "Dono não recebe cargo" },
        },
      },
      delete: {
        tags: ["Empresa"],
        summary: "Remove (desvincula) um membro da empresa (member:manage)",
        parameters: [
          establishmentHeader,
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "userId do membro",
          },
        ],
        responses: {
          200: { description: "Membro removido" },
          404: { description: "Membro não encontrado" },
          409: { description: "Dono não pode ser removido" },
        },
      },
    },
    "/company/users/{id}/reset-password": {
      post: {
        tags: ["Empresa"],
        summary: "Reseta a senha de um funcionário (member:manage)",
        description:
          "Gera uma senha temporária e marca mustChangePassword. Não se aplica ao Dono.",
        parameters: [
          establishmentHeader,
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "userId do membro",
          },
        ],
        responses: {
          200: { description: "Senha temporária gerada (retornada uma vez)" },
          404: { description: "Membro não encontrado" },
          409: { description: "Não se aplica ao Dono" },
        },
      },
    },
    // ------------------------------------------------------------- Cargos
    "/roles": {
      get: {
        tags: ["Cargos"],
        summary: "Lista os cargos da empresa ativa",
        parameters: [establishmentHeader],
        responses: {
          200: {
            description: "Lista de cargos",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    roles: { type: "array", items: { $ref: "#/components/schemas/Role" } },
                  },
                },
              },
            },
          },
          403: { description: "Permissão insuficiente (role:manage)" },
        },
      },
      post: {
        tags: ["Cargos"],
        summary: "Cria um cargo na empresa ativa",
        parameters: [establishmentHeader],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/RoleInput" } },
          },
        },
        responses: {
          201: { description: "Cargo criado" },
          400: { description: "Dados inválidos" },
          403: { description: "Permissão insuficiente (role:manage)" },
        },
      },
    },
    "/roles/{id}": {
      put: {
        tags: ["Cargos"],
        summary: "Atualiza um cargo da empresa ativa",
        parameters: [
          establishmentHeader,
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/RoleInput" } },
          },
        },
        responses: {
          200: { description: "Cargo atualizado" },
          404: { description: "Cargo não encontrado" },
          409: { description: "Nome de cargo já em uso" },
        },
      },
      delete: {
        tags: ["Cargos"],
        summary: "Remove um cargo (bloqueia se houver funcionários vinculados)",
        parameters: [
          establishmentHeader,
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Cargo removido" },
          404: { description: "Cargo não encontrado" },
          409: { description: "Cargo em uso por funcionários" },
        },
      },
    },
    // ------------------------------------------------------------ Estoque
    "/stock": {
      get: {
        tags: ["Estoque"],
        summary: "Lista itens de estoque da empresa ativa (stock:read)",
        parameters: [establishmentHeader],
        responses: {
          200: { description: "Itens de estoque" },
          403: { description: "Permissão insuficiente (stock:read)" },
        },
      },
      post: {
        tags: ["Estoque"],
        summary: "Cadastra um insumo no estoque (stock:write)",
        parameters: [establishmentHeader],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "unit"],
                properties: {
                  name: { type: "string" },
                  unit: { type: "string", example: "kg" },
                  quantity: { type: "number", default: 0 },
                  minLevel: { type: "number", default: 0 },
                  costPrice: { type: "number", default: 0 },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Insumo cadastrado" },
          400: { description: "Dados inválidos" },
          403: { description: "Permissão insuficiente (stock:write)" },
        },
      },
    },
    // ------------------------------------------------------------ Público
    "/public/establishment/{slug}": {
      get: {
        tags: ["Público"],
        summary: "Resolve o slug de uma empresa para exibição no login da marca",
        security: [],
        parameters: [
          { name: "slug", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Empresa encontrada" },
          404: { description: "Empresa não encontrada" },
        },
      },
    },
    // ------------------------------------------------------ Notificações
    "/notifications": {
      get: {
        tags: ["Notificações"],
        summary: "Lista notificações (empresa ativa + pessoais de plataforma)",
        description:
          "Sem x-establishment-id retorna só as notificações pessoais do usuário. " +
          "Pedidos de senha (sensíveis) só aparecem para member:manage.",
        parameters: [{ ...establishmentHeader, required: false }],
        responses: { 200: { description: "Lista + contagem de não lidas" } },
      },
      post: {
        tags: ["Notificações"],
        summary: "Cria um aviso da empresa (member:manage) + push aos membros",
        parameters: [establishmentHeader],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title", "message"],
                properties: {
                  title: { type: "string", minLength: 2 },
                  message: { type: "string" },
                },
              },
            },
          },
        },
        responses: { 201: { description: "Notificação criada" } },
      },
    },
    "/notifications/{id}": {
      patch: {
        tags: ["Notificações"],
        summary: "Marca como lida/não-lida",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["read"], properties: { read: { type: "boolean" } } },
            },
          },
        },
        responses: { 200: { description: "Atualizada" }, 404: { description: "Não encontrada" } },
      },
      delete: {
        tags: ["Notificações"],
        summary: "Remove a notificação",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Removida" }, 404: { description: "Não encontrada" } },
      },
    },
    "/notifications/{id}/resolve-password": {
      post: {
        tags: ["Notificações"],
        summary: "Processa um pedido de recuperação: gera senha (member:manage)",
        parameters: [
          establishmentHeader,
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Senha temporária gerada (retornada uma vez)" },
          400: { description: "Notificação não é um pedido de senha" },
          404: { description: "Não encontrada" },
        },
      },
    },
    "/admin/notifications": {
      post: {
        tags: ["Notificações"],
        summary: "SUPER_ADMIN dispara uma notificação a qualquer usuário (+ push)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["userId", "title", "message"],
                properties: {
                  userId: { type: "string" },
                  title: { type: "string", minLength: 2 },
                  message: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Enviada" },
          403: { description: "Acesso restrito ao SUPER_ADMIN" },
          404: { description: "Usuário não encontrado" },
        },
      },
    },
    "/push/subscribe": {
      post: {
        tags: ["Notificações"],
        summary: "Registra uma assinatura Web Push do dispositivo",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["endpoint", "keys"],
                properties: {
                  endpoint: { type: "string", format: "uri" },
                  keys: {
                    type: "object",
                    properties: { p256dh: { type: "string" }, auth: { type: "string" } },
                  },
                },
              },
            },
          },
        },
        responses: { 201: { description: "Assinatura registrada" } },
      },
      delete: {
        tags: ["Notificações"],
        summary: "Remove a assinatura Web Push do dispositivo",
        responses: { 200: { description: "Removida" } },
      },
    },
    "/public/establishment/{slug}/password-reset-request": {
      post: {
        tags: ["Público"],
        summary: "Funcionário pede recuperação de senha (gera pedido ao gestor)",
        security: [],
        parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: { email: { type: "string", format: "email" } },
              },
            },
          },
        },
        responses: { 200: { description: "Resposta genérica (não revela existência)" } },
      },
    },
    // ------------------------------------------------------------ Sistema
    "/health": {
      get: {
        tags: ["Sistema"],
        summary: "Healthcheck da API",
        security: [],
        responses: { 200: { description: "OK" } },
      },
    },
  },
} as const;

export type OpenApiSpec = typeof openApiSpec;
