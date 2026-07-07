# Órbita — Funcionalidades do sistema

Plataforma SaaS **multi-empresa** de gestão para pizzarias e negócios de alimentação: cada empresa
(tenant) opera isolada, com seus próprios usuários, cargos, produtos, estoque e finanças. O
super admin administra a plataforma e habilita **módulos** (ferramentas) por empresa; o dono
gerencia a operação do dia a dia.

---

## 💰 Gestão Financeira

O coração do sistema: tudo que movimenta dinheiro converge para o Financeiro — manualmente ou
por integrações automáticas dos demais módulos.

### Lançamentos
- **Receitas e despesas** com descrição, valor, data de pagamento (`pago em`), vencimento e
  categoria/centro de custo; edição e exclusão completas.
- **Categorias compartilhadas** entre produtos e lançamentos — a mesma taxonomia organiza o
  catálogo e agrupa a DRE.

### Visão de resultados
- **Ganhos por período**: cartões de *hoje / esta semana / este mês* (lucro = receitas − despesas)
  calculados em tempo real.
- **Gráfico de lucro diário** dos últimos 14 dias.
- **Relatórios / DRE simplificada**: receitas e despesas por categoria, resultado e margem, mês a mês.

### Gastos fixos
- Cadastro dos **custos operacionais mensais recorrentes**: forno, funcionário, aluguel do salão,
  energia... com valor mensal, observação e ativação/inativação.
- **Total mensal** consolidado, usado no rateio da simulação de vendas.

### Fechamento de período
- **Fechamento formal do mês** com snapshot dos totais (receita/despesa/lucro).
- Mês fechado **bloqueia** lançar, editar e excluir naquele período (inclusive lançamentos sem
  data de pagamento, pela data de criação) — reabertura disponível.

### Integrações automáticas (dinheiro entra sozinho no lugar certo)
- **Venda avulsa** de produto → gera receita na hora (herdando a categoria do produto).
- **Fechamento de comanda** → gera a receita pelo valor final (com taxa de serviço e desconto),
  de forma **atômica** — sem risco de receita duplicada ou órfã.
- **Entrada de estoque** → opcionalmente gera a **despesa de compra** (quantidade × custo do
  insumo), configurável por empresa.

### Simulação de vendas futuras
- Escolha um produto e a quantidade (ex.: **10 pizzas**) e veja:
  - os **insumos necessários vs. o estoque atual** (destacando o que falta);
  - o **custo de produção**, a **receita** e o **lucro bruto** com margem;
  - o **lucro líquido estimado** com rateio dos gastos fixos (informando as unidades vendidas/mês).

### Alertas financeiros programáveis
- **A cada nova venda**: aviso imediato com o valor.
- **Resumo de vendas por intervalo** (ex.: a cada 1h): quantidade e total do período.
- **Lucro do dia abaixo da meta**: verificação diária num horário — só alerta se a meta não foi atingida.
- Mensagens **personalizáveis por template** com variáveis (`{valor}`, `{total}`, `{lucro}`, `{meta}`...),
  entregues no sino do sistema **e por push** no celular/desktop, para gestores ou toda a equipe.

### Precificação por custo + margem
- Cada produto tem **custo** (manual ou derivado da ficha técnica) e **margem-alvo** própria.
- Digitar a margem **recalcula o preço na hora** (ex.: borda de catupiry com 200%); atalhos de
  patamar (Lançamento 15% / Pleno 25%) e indicador da **margem real** embutida no preço praticado.

---

## 📦 Gestão de Estoque

Controle de insumos ponta a ponta, do cadastro à baixa automática pela venda.

### Insumos
- Cadastro com **unidade** (kg, un, L...), **custo**, quantidade e **estoque mínimo**;
  edição e exclusão; visualização em cards ou tabela.

### Movimentações
- **Entradas e saídas** com histórico completo (quem, quando, quanto, observação).
- Escrita **atômica e segura sob concorrência**: duas baixas simultâneas nunca se perdem;
  saída maior que o saldo é rejeitada.
- Entrada pode **lançar a despesa de compra no Financeiro** automaticamente (configurável).

### Alerta de estoque mínimo
- Ao **cruzar** o nível mínimo numa saída, dispara notificação (sino + push) e destaque visual
  na tela — sem repetir o aviso a cada movimento.
- Regra programável adicional: **relatório diário de estoque baixo** num horário (ex.: todo dia
  às 15h), listando os insumos no/abaixo do mínimo.

### Ficha técnica (receita do produto)
- Cada produto define **quanto consome de cada insumo** por unidade vendida.
- **Custo derivado**: o custo do produto é calculado da ficha (Σ consumo × custo do insumo).
- **Baixa automática**: lançar o item na comanda consome o estoque; remover o item ou cancelar
  a comanda **estorna**. Tudo com trilha de auditoria (movimentos registrados).

### Insumos padrão por categoria
- Categorias podem ter **insumos padrão** (ex.: toda *Pizza* leva molho e massa).
- Produto novo criado na categoria **nasce com a ficha técnica pré-populada** e o custo derivado —
  menos retrabalho e padronização do custo.

---

## 🧾 Funcionalidades adicionais — Operação / PDV

### Gestão de mesas
- CRUD completo: criar, editar (nome/lugares), **ativar/inativar** e excluir.
- **Status do salão em tempo quase real**: mesa livre/ocupada derivado da comanda aberta;
  mesa com comanda aberta **não pode ser excluída**; mesas inativas somem do salão.

### Comanda
- Abertura por **mesa, balcão ou delivery** (com nome do cliente e observações).
- **Lançamento de itens** do catálogo com quantidade e observação — preço e nome congelados
  no momento do lançamento (mudanças futuras de preço não afetam comandas abertas).
- Total **recalculado no servidor** a cada mudança.
- **Fechamento completo**: taxa de serviço, desconto, forma de pagamento (dinheiro/cartão/PIX)
  e **divisão de conta** por número de pessoas → vira receita no Financeiro automaticamente.
- **Cancelamento** com estorno integral do estoque consumido.
- Proteções: fechamento duplo bloqueado; período fechado respeitado; comanda de mesa exige mesa livre.

### Cozinha (KDS) — visualização da ordem de pedidos
- **Fila de preparo**: comandas abertas ordenadas da **mais antiga para a mais nova**, com
  tempo decorrido de cada uma.
- Itens marcáveis como **"preparado"** individualmente — a equipe acompanha o que falta.
- **Auto-atualização** (polling 15s + refresh ao focar a aba): salão e cozinha sempre em sincronia.

### Impressão
- **Ticket da cozinha** (itens a preparar) e **cupom de conferência** da comanda (itens + total),
  pela janela de impressão do navegador — compatível com impressora térmica ou PDF, sem
  dependência externa.

---

## 🧩 Recursos de plataforma (resumo)

| Área | O que faz |
|---|---|
| **Multi-empresa** | Várias empresas isoladas; usuário pode pertencer a 2+ (com troca de contexto); múltiplos donos por empresa |
| **Módulos plugáveis** | Super admin liga/desliga Produtos, Estoque, Financeiro e Comanda & Mesas por empresa — some do menu e as rotas são bloqueadas |
| **RBAC / Cargos** | Dono cria cargos com permissões granulares (ver/editar por área); funcionário vê e acessa só o permitido |
| **Autenticação** | JWT + refresh token com rotação/revogação; troca de senha obrigatória; recuperação de senha via gestor; logout derruba a sessão |
| **Notificações** | Sino in-app + **Web Push** (funciona com o app fechado, PWA); regras programadas por evento/intervalo/diário com templates |
| **Personalização** | Aparência completa por empresa (marca, destaque, **fundos, textos e cores semânticas**, por tema claro/escuro; cantos, densidade, fonte) — exclusiva do super admin; **menu ordenável/ocultável** pelo dono |
| **Configuração da empresa** | Dados cadastrais e URL pública (slug) geridos pelo super admin; operações (ex.: entrada de estoque → despesa) pelo dono |
