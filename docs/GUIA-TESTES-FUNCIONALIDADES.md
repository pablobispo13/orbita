# Roteiro de homologação — Funcionalidades do sistema (Fases 0–5)

Passo a passo para validar **tudo que já foi construído**, na ordem natural de teste ponta a ponta.
Cada item é um checkbox com _pré-requisito_, _passos_ e _resultado esperado_. Marque `[x]` conforme valida.

> Contextos de tela: **Plataforma** (`/dashboard`, super admin) e **Empresa** (`/{slug}/dashboard`).
> Papéis: **SUPER_ADMIN** (plataforma), **ADMIN/Dono** e **STAFF/Funcionário** (dentro da empresa).

---

## 0. Preparação do ambiente

- [ ] **0.1** `.env` com `DATABASE_URL`, `JWT_SECRET`, chaves VAPID (`.env.example` de referência).
- [ ] **0.2** Criar o super admin:
  `SUPERADMIN_EMAIL="voce@x.com" SUPERADMIN_PASSWORD="..." npm run db:seed` → "✅ Super admin criado".
- [ ] **0.3** `npm run dev` sobe sem erro em `http://localhost:3000`.
- [ ] **0.4** (Opcional) Dados de exemplo: `npm run db:seed:pizzaria` popula produtos, insumos e lançamentos.
- [ ] **0.5** `GET /api/health` responde `ok`. `/docs` abre o Swagger.

---

## 1. Fundação (Fase 0)

- [ ] **1.1 Tema claro/escuro** — o `ThemeToggle` alterna e **persiste** ao recarregar (sem "flash").
- [ ] **1.2 Identidade visual** — logo Órbita, fontes e paleta índigo/violeta carregam corretamente.
- [ ] **1.3 PWA** — `/manifest.webmanifest` acessível; o navegador oferece "instalar app".
- [ ] **1.4 Responsivo** — no mobile a sidebar vira drawer (overlay) e fecha ao tocar fora.

---

## 2. Autenticação & sessão (Fase 1 / CP2)

- [ ] **2.1 Login geral** — `/login` com as credenciais do super admin → cai em `/dashboard`.
- [ ] **2.2 Credencial inválida** — senha errada mostra erro claro (toast), sem vazar detalhe.
- [ ] **2.3 Troca de senha obrigatória** — usuário com `mustChangePassword` é levado a `/trocar-senha`
  no 1º login e só prossegue após trocar.
- [ ] **2.4 Renovação automática** — com o access token expirado, a próxima ação renova sozinha
  (sem deslogar). _Dica:_ reduza `ACCESS_TOKEN_TTL` no `.env` para testar rápido.
- [ ] **2.5 Logout revoga** — após "Sair", o `refreshToken` antigo não renova mais (401).
- [ ] **2.6 Troca de senha derruba sessões** — trocar a senha invalida as demais sessões abertas.
- [ ] **2.7 Segurança da conta** — item **🔒 Segurança** (rodapé da sidebar) abre a troca de senha própria.

---

## 3. Plataforma — Super Admin (Fase 2)

- [ ] **3.1 Dashboard** — `/dashboard` lista as empresas com contagens; busca e filtro ativa/inativa funcionam.
- [ ] **3.2 Criar empresa + dono** — menu **Plataforma → Empresas** → nova empresa: gera o 1º ADMIN com
  **senha temporária exibida uma única vez**. Copie-a.
- [ ] **3.3 Editar empresa** — alterar nome/documento/telefone/slug salva e reflete na lista.
- [ ] **3.4 Inativar empresa** — "excluir" faz **inativação** (`active=false`), não apaga; some do filtro "ativas".
- [ ] **3.5 Usuários da plataforma** — **Plataforma → Usuários**: lista; reset de senha de usuário gera senha temp.
- [ ] **3.6 Notificação da plataforma** — super admin envia aviso a um usuário; ele recebe no sino.
- [ ] **3.7 Árvore de empresas** — na sidebar, expandir uma empresa abre suas configs base
  (Dashboard/Módulos/Empresa/Cargos/Usuários) **no contexto daquela empresa**.

---

## 4. Módulos por empresa (Fase 6 — fundação)

- [ ] **4.1 Ligar/desligar** — **Administração → Módulos** (super admin): desative "Estoque" para uma empresa.
- [ ] **4.2 Some do menu** — no contexto dessa empresa, o item **Estoque** desaparece da sidebar.
- [ ] **4.3 Rota bloqueada** — chamar `GET /api/stock` dessa empresa → **403 "Módulo não habilitado"**
  (vale até para super admin).
- [ ] **4.4 Reativar** — religar o módulo faz o item e as rotas voltarem.
- [ ] **4.5 Empresa sem override** — empresa nunca configurada segue com os módulos padrão ligados.

---

## 5. Empresa — Dono/ADMIN (Fase 1 · RBAC)

- [ ] **5.1 Config da empresa** — **Configurações → Empresa**: editar dados/marca/slug salva (`ESTABLISHMENT_MANAGE`).
- [ ] **5.2 Criar cargo** — **Configurações → Cargos** → novo cargo escolhendo permissões por grupo
  (ex.: só "Ver estoque"). Salvar.
- [ ] **5.3 Editar/excluir cargo** — alterar permissões e excluir um cargo funciona.
- [ ] **5.4 Cargo "Dono"** — o cargo de sistema aparece com todas as permissões e é **read-only**.
- [ ] **5.5 Adicionar funcionário** — **Configurações → Usuários** → novo membro com cargo atribuído:
  cria User+Membership e mostra **senha temporária uma vez**.
- [ ] **5.6 Proteção do Dono** — não é possível remover/rebaixar o Dono da empresa.
- [ ] **5.7 Reset direto** — o Dono reseta a senha de um funcionário direto (gera temp + `mustChangePassword`).
- [ ] **5.8 Validação inline** — nome duplicado de cargo/e-mail duplicado mostra o motivo **na modal** (não só toast).

---

## 6. RBAC efetivo — Funcionário/STAFF

- [ ] **6.1 Login pela marca** — `/{slug}` mostra o nome da empresa; funcionário loga e cai no dashboard dela.
- [ ] **6.2 Menu restrito** — vê **apenas** as telas do seu cargo + módulos ativos.
- [ ] **6.3 API restrita** — com cargo só de `stock:read`:
  `GET /stock` → **200**; `GET /roles`, `POST /stock`, `POST /company/users` → **403**.
- [ ] **6.4 Sem acesso a outra empresa** — `x-establishment-id` de empresa onde não é membro → **403**.

---

## 7. Recuperação de senha (Fase 1 / CP2.1)

- [ ] **7.1 Solicitar** — na tela `/{slug}`, "esqueci a senha" gera uma **notificação PENDENTE** ao gestor.
- [ ] **7.2 Gestor resolve** — no sino, o gestor abre a solicitação, **gera a senha temporária** e a repassa.
- [ ] **7.3 Funcionário entra** — usa a senha temp, é forçado a trocar, e a notificação vira **RESOLVED**.

---

## 8. Notificações & Web Push (Fase 1)

- [ ] **8.1 Sino** — contador e lista de notificações da empresa + plataforma.
- [ ] **8.2 Ação direcionada** — clicar numa notificação de usuário abre a aba **Usuários já filtrada**.
- [ ] **8.3 Marcar lida** — some do contador.
- [ ] **8.4 Assinar push** — conceder permissão cria a `PushSubscription` (`POST /api/push/subscribe`).
- [ ] **8.5 Push fora do app** — com o app fechado, uma notificação chega ao SO (Windows/PWA).
  _iOS: só após instalar como PWA (16.4+)._

---

## 9. Produtos (Fase 6 — módulo)

- [ ] **9.1 CRUD** — **Operação → Produtos**: criar/editar/excluir com nome, categoria, custo, preço.
- [ ] **9.2 Precificação custo+margem** — informar custo mostra **preços sugeridos** (Lançamento 15% / Pleno 25%).
- [ ] **9.3 Margem personalizada** — ajustar a margem-alvo do produto (ex.: 50%) recalcula e mostra a margem real.
- [ ] **9.4 Cards/Tabela** — alternância de visualização; padrão **cards** (melhor no mobile).
- [ ] **9.5 Venda avulsa** — botão **"Vender"** gera uma receita no Financeiro (requer módulo Financeiro ativo).

---

## 10. Estoque (Fase 3 — módulo)

- [ ] **10.1 CRUD insumos** — **Operação → Estoque**: criar/editar/excluir (unidade, custo, estoque mínimo).
- [ ] **10.2 Entrada** — movimentação **IN** soma à quantidade e grava histórico.
- [ ] **10.3 Saída** — movimentação **OUT** subtrai; **saída maior que o saldo é rejeitada (400)**.
- [ ] **10.4 Alerta de mínimo** — quando uma saída **cruza** o nível mínimo, dispara notificação e destaque visual.
- [ ] **10.5 Histórico** — a tela lista as últimas movimentações do insumo.
- [ ] **10.6 Cards/Tabela** — alternância de visualização.

---

## 11. Financeiro (Fase 4 — módulo)

- [ ] **11.1 Lançamentos** — **Operação → Financeiro**: criar receita/despesa (descrição, valor, datas, categoria);
  editar e excluir.
- [ ] **11.2 Categorias** — o `CategoriesModal` cria/edita/exclui categorias; excluir **desvincula** os itens.
- [ ] **11.3 Ganhos por período** — cartões **hoje / semana / mês** (lucro = receitas − despesas) batem com os lançamentos.
- [ ] **11.4 Gráfico** — barras de lucro diário dos últimos 14 dias.
- [ ] **11.5 Relatórios/DRE** — **Operação → Relatórios**: receitas e despesas por categoria, resultado e margem por mês.
- [ ] **11.6 Fechar mês** — fechamento grava snapshot (`PeriodClosing`) dos totais.
- [ ] **11.7 Bloqueio** — lançar/editar com data no mês fechado → **409 "Período fechado…"**.
- [ ] **11.8 Reabrir** — reabrir o período volta a permitir lançamentos.

---

## 12. Comanda & Mesas (Fase 5 — módulo)

- [ ] **12.1 Mesas CRUD** — criar/editar (nome, lugares); **ativar/inativar** (mesa inativa some do salão).
- [ ] **12.2 Exclusão protegida** — não é possível excluir mesa com **comanda aberta**.
- [ ] **12.3 Abrir comanda** — por **mesa**, **balcão** e **delivery** (com nome do cliente).
- [ ] **12.4 Lançar itens** — adicionar item do catálogo com quantidade e observação; total recalcula no servidor.
- [ ] **12.5 Remover item** — remove e recalcula o total.
- [ ] **12.6 Ficha técnica** — `RecipeModal` define insumos por produto e gera o **custo derivado** do produto.
- [ ] **12.7 Baixa automática** — ao lançar item com ficha, o **estoque baixa** (movimento OUT) — só com módulo Estoque ativo.
- [ ] **12.8 Estorno** — remover item ou **cancelar** a comanda **estorna** o estoque (movimento IN).
- [ ] **12.9 Fechamento completo** — taxa de serviço, desconto, forma de pagamento (dinheiro/cartão/PIX) e
  divisão por nº de pessoas; gera **receita** pelo valor final (com módulo Financeiro ativo).
- [ ] **12.10 Período fechado** — fechar comanda em mês fechado → **409**.
- [ ] **12.11 Status do salão** — mesa fica "ocupada" com comanda aberta e "livre" ao fechar/cancelar.

---

## 13. Cozinha / KDS & Impressão (Fase 5)

- [ ] **13.1 Fila** — **Operação → Cozinha**: comandas abertas, mais antigas primeiro, com tempo decorrido.
- [ ] **13.2 Marcar feito** — marcar item como preparado (`prepared`) atualiza o painel.
- [ ] **13.3 Auto-atualização** — o painel atualiza sozinho (polling 15s) e ao **focar a aba**.
- [ ] **13.4 Ticket da cozinha** — impressão do ticket abre a janela de impressão (térmica/PDF).
- [ ] **13.5 Cupom de conferência** — impressão do cupom da comanda (itens + total).

---

## 14. Multi-empresa (Fase 2)

- [ ] **14.1 Troca de empresa** — usuário membro de **2+ empresas** vê o `CompanySwitcher` e alterna o contexto ativo.
- [ ] **14.2 Menu "Minhas Empresas"** — aparece só para usuário comum com 2+ empresas.
- [ ] **14.3 Múltiplos donos** — uma empresa pode ter mais de um ADMIN; ambos operam.
- [ ] **14.4 Isolamento** — dados (produtos, estoque, financeiro, comandas) **nunca vazam** entre empresas.

---

## Checklist final de homologação

| Área | Coberto |
|---|---|
| Fundação (tema, PWA, responsivo) | §1 |
| Auth & sessão (login, refresh, troca de senha) | §2 |
| Plataforma / empresas (CRUD, onboarding, notificação) | §3 |
| Módulos por empresa (gate de menu + rota) | §4 |
| RBAC (cargos, membros, permissões efetivas) | §5–§6 |
| Recuperação de senha | §7 |
| Notificações & Web Push | §8 |
| Produtos (precificação) | §9 |
| Estoque (movimentações, alerta) | §10 |
| Financeiro (lançamentos, DRE, fechamento) | §11 |
| Comanda & Mesas (PDV, ficha técnica) | §12 |
| Cozinha/KDS & impressão | §13 |
| Multi-empresa & isolamento | §14 |
