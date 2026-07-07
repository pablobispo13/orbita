// =============================================================================
// Seed reutilizável — dados de exemplo de uma PIZZARIA (produtos, insumos e
// lançamentos financeiros) numa empresa (Establishment).
//
// COMO USAR:
//   npm run db:seed:pizzaria                 # empresa padrão "nonobargette"
//   SEED_SLUG="outra-empresa" npm run db:seed:pizzaria
//   SEED_RESET=1 npm run db:seed:pizzaria    # limpa e recria (produtos/insumos/finance)
//   SEED_FINANCE_DAYS=45 npm run db:seed:pizzaria
//
// COMO ADAPTAR: edite os blocos PRODUCTS / STOCK_ITEMS / FINANCE_* abaixo. Os
// preços seguem o modelo do documento de proposta (custo + margem — Pleno 25%).
// Idempotente por padrão: produtos/insumos já existentes são pulados e os
// lançamentos só são gerados se a empresa ainda não tiver nenhum (use SEED_RESET
// para recriar do zero). Serve de base para outras empresas/sistemas.
// =============================================================================
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Chaves de módulo (espelham src/lib/modules.ts). Locais para o script não
// depender do alias "@/" (que o tsx não resolve fora do Next).
const MODULES = {
  PRODUCTS: "products",
  STOCK: "stock",
  FINANCE: "finance",
  COMANDA: "comanda",
} as const;

// --- Parâmetros (via env) ----------------------------------------------------
const SLUG = process.env.SEED_SLUG || "nonobargette";
const RESET = process.env.SEED_RESET === "1";
const FINANCE_DAYS = Number(process.env.SEED_FINANCE_DAYS || 30);

// --- Dados editáveis ---------------------------------------------------------

// Produtos (sabores + itens). cost = custo total; price = preço de venda.
// Os 4 primeiros vêm do documento de proposta (preço = Pleno 25%).
const PRODUCTS: { name: string; description?: string; cost: number; price: number }[] = [
  { name: "Pizza Pepperoni", description: "Pré-assada congelada", cost: 19.42, price: 24.27 },
  { name: "Pizza Frango c/ Catupiry", description: "Pré-assada congelada", cost: 12.23, price: 15.29 },
  { name: "Pizza 4 Queijos", description: "Pré-assada congelada", cost: 19.71, price: 24.64 },
  { name: "Pizza Calabresa", description: "Pré-assada congelada", cost: 15.26, price: 19.07 },
  { name: "Pizza Margherita", description: "Molho, mussarela e manjericão", cost: 13.5, price: 16.9 },
  { name: "Pizza Portuguesa", description: "Presunto, ovo, cebola e ervilha", cost: 16.8, price: 21.9 },
  { name: "Refrigerante Lata 350ml", cost: 2.5, price: 6.0 },
  { name: "Refrigerante 2L", cost: 6.0, price: 12.0 },
  { name: "Água Mineral 500ml", cost: 1.2, price: 4.0 },
  { name: "Borda Recheada (adicional)", cost: 2.0, price: 6.0 },
];

// Categorias de produtos + regra de atrelamento (por trecho do nome, minúsculo).
// A primeira regra que casar define a categoria do produto.
const CATEGORY_RULES: { category: string; match: string[] }[] = [
  { category: "Pizzas", match: ["pizza"] },
  { category: "Bebidas", match: ["refrigerante", "água", "agua", "suco", "cerveja"] },
  { category: "Adicionais", match: ["borda", "adicional"] },
];

function categoryForProduct(name: string): string | null {
  const n = name.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.match.some((m) => n.includes(m))) return rule.category;
  }
  return null;
}

// Insumos do estoque.
const STOCK_ITEMS: {
  name: string;
  unit: string;
  quantity: number;
  minLevel: number;
  costPrice: number;
}[] = [
  { name: "Farinha de trigo", unit: "kg", quantity: 50, minLevel: 15, costPrice: 4.5 },
  { name: "Queijo mussarela", unit: "kg", quantity: 20, minLevel: 8, costPrice: 34.9 },
  { name: "Molho de tomate", unit: "L", quantity: 18, minLevel: 6, costPrice: 9.9 },
  { name: "Calabresa", unit: "kg", quantity: 6, minLevel: 5, costPrice: 24.9 },
  { name: "Pepperoni", unit: "kg", quantity: 4, minLevel: 5, costPrice: 39.9 },
  { name: "Catupiry", unit: "kg", quantity: 7, minLevel: 4, costPrice: 28.5 },
  { name: "Massa de borda", unit: "kg", quantity: 12, minLevel: 5, costPrice: 7.5 },
];

// Fichas técnicas: insumos consumidos por unidade de cada produto (nomes casam
// com PRODUCTS e STOCK_ITEMS). Ao vender/lançar, o estoque baixa por aqui.
const RECIPES: { product: string; items: { stock: string; quantity: number }[] }[] = [
  { product: "Pizza Pepperoni", items: [
    { stock: "Farinha de trigo", quantity: 0.3 }, { stock: "Molho de tomate", quantity: 0.1 },
    { stock: "Queijo mussarela", quantity: 0.15 }, { stock: "Pepperoni", quantity: 0.08 },
  ] },
  { product: "Pizza Frango c/ Catupiry", items: [
    { stock: "Farinha de trigo", quantity: 0.3 }, { stock: "Molho de tomate", quantity: 0.1 },
    { stock: "Queijo mussarela", quantity: 0.12 }, { stock: "Catupiry", quantity: 0.1 },
  ] },
  { product: "Pizza 4 Queijos", items: [
    { stock: "Farinha de trigo", quantity: 0.3 }, { stock: "Molho de tomate", quantity: 0.1 },
    { stock: "Queijo mussarela", quantity: 0.2 }, { stock: "Catupiry", quantity: 0.08 },
  ] },
  { product: "Pizza Calabresa", items: [
    { stock: "Farinha de trigo", quantity: 0.3 }, { stock: "Molho de tomate", quantity: 0.1 },
    { stock: "Queijo mussarela", quantity: 0.12 }, { stock: "Calabresa", quantity: 0.1 },
  ] },
  { product: "Pizza Margherita", items: [
    { stock: "Farinha de trigo", quantity: 0.3 }, { stock: "Molho de tomate", quantity: 0.12 },
    { stock: "Queijo mussarela", quantity: 0.15 },
  ] },
  { product: "Pizza Portuguesa", items: [
    { stock: "Farinha de trigo", quantity: 0.3 }, { stock: "Molho de tomate", quantity: 0.1 },
    { stock: "Queijo mussarela", quantity: 0.15 }, { stock: "Calabresa", quantity: 0.05 },
  ] },
  { product: "Borda Recheada (adicional)", items: [
    { stock: "Massa de borda", quantity: 0.1 }, { stock: "Catupiry", quantity: 0.05 },
  ] },
];

// Mesas do salão (módulo Comanda).
const TABLES: { name: string; seats: number }[] = [
  { name: "Mesa 1", seats: 4 },
  { name: "Mesa 2", seats: 4 },
  { name: "Mesa 3", seats: 2 },
  { name: "Mesa 4", seats: 6 },
  { name: "Mesa 5", seats: 4 },
  { name: "Balcão", seats: 2 },
];

// Geração de lançamentos financeiros de exemplo (para o dashboard de ganhos).
const FINANCE = {
  minSalesPerDay: 6,
  maxSalesPerDay: 22,
  ticket: { min: 28, max: 120 }, // valor por venda (R$)
  expenseEveryDays: 5, // a cada N dias, uma despesa de insumos
  expense: { min: 180, max: 520 },
};

// --- RNG determinístico (LCG) — resultados estáveis entre execuções ----------
let _seed = 42;
function rand(): number {
  _seed = (_seed * 1664525 + 1013904223) % 4294967296;
  return _seed / 4294967296;
}
function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function money(min: number, max: number): number {
  return Math.round((rand() * (max - min) + min) * 100) / 100;
}

async function main() {
  const est = await prisma.establishment.findUnique({ where: { slug: SLUG } });
  if (!est) {
    console.error(`❌ Empresa com slug "${SLUG}" não encontrada.`);
    process.exit(1);
  }
  console.log(`Empresa: ${est.name} (${est.slug})  reset=${RESET}  financeDays=${FINANCE_DAYS}`);

  // Garante os módulos usados por este seed habilitados.
  for (const key of [MODULES.PRODUCTS, MODULES.STOCK, MODULES.FINANCE, MODULES.COMANDA]) {
    await prisma.establishmentModule.upsert({
      where: { establishmentId_moduleKey: { establishmentId: est.id, moduleKey: key } },
      create: { establishmentId: est.id, moduleKey: key, enabled: true },
      update: { enabled: true },
    });
  }

  if (RESET) {
    await prisma.stockMovement.deleteMany({ where: { establishmentId: est.id } });
    await prisma.stockItem.deleteMany({ where: { establishmentId: est.id } });
    await prisma.product.deleteMany({ where: { establishmentId: est.id } });
    await prisma.transaction.deleteMany({ where: { establishmentId: est.id } });
    console.log("🧹 Dados anteriores (produtos/insumos/finance) removidos.");
  }

  // --- Produtos (pula os que já existem por nome) ---
  let createdProducts = 0;
  for (const p of PRODUCTS) {
    const exists = await prisma.product.findFirst({
      where: { establishmentId: est.id, name: p.name },
    });
    if (exists) continue;
    await prisma.product.create({
      data: {
        name: p.name,
        description: p.description ?? null,
        cost: p.cost,
        price: p.price,
        establishmentId: est.id,
      },
    });
    createdProducts++;
  }
  console.log(`🍕 Produtos criados: ${createdProducts} (de ${PRODUCTS.length})`);

  // --- Categorias + atrelamento aos produtos (por regra de nome) ---
  const catNames = [...new Set(CATEGORY_RULES.map((r) => r.category))];
  const catByName = new Map<string, string>(); // nome -> id
  for (const name of catNames) {
    const cat = await prisma.category.upsert({
      where: { establishmentId_name: { establishmentId: est.id, name } },
      create: { name, establishmentId: est.id },
      update: {},
    });
    catByName.set(name, cat.id);
  }
  const allProducts = await prisma.product.findMany({
    where: { establishmentId: est.id },
    select: { id: true, name: true },
  });
  let linked = 0;
  for (const prod of allProducts) {
    const catName = categoryForProduct(prod.name);
    const catId = catName ? catByName.get(catName) : null;
    if (!catId) continue;
    await prisma.product.update({ where: { id: prod.id }, data: { categoryId: catId } });
    linked++;
  }
  console.log(`🏷️  Categorias: ${catNames.length} (${catNames.join(", ")}) · produtos atrelados: ${linked}`);

  // --- Insumos (unique por [establishmentId, name] no schema) ---
  let createdStock = 0;
  for (const s of STOCK_ITEMS) {
    const exists = await prisma.stockItem.findFirst({
      where: { establishmentId: est.id, name: s.name },
    });
    if (exists) continue;
    await prisma.stockItem.create({ data: { ...s, establishmentId: est.id } });
    createdStock++;
  }
  console.log(`📦 Insumos criados: ${createdStock} (de ${STOCK_ITEMS.length})`);

  // --- Mesas (unique por [establishmentId, name] no schema) ---
  let createdTables = 0;
  for (const t of TABLES) {
    const exists = await prisma.table.findFirst({
      where: { establishmentId: est.id, name: t.name },
    });
    if (exists) continue;
    await prisma.table.create({ data: { ...t, establishmentId: est.id } });
    createdTables++;
  }
  console.log(`🍽️  Mesas criadas: ${createdTables} (de ${TABLES.length})`);

  // --- Fichas técnicas (upsert por [produto, insumo]) ---
  const prodByName = new Map(allProducts.map((p) => [p.name, p.id]));
  const stockRows = await prisma.stockItem.findMany({
    where: { establishmentId: est.id },
    select: { id: true, name: true },
  });
  const stockByName = new Map(stockRows.map((s) => [s.name, s.id]));
  let recipeLinks = 0;
  for (const r of RECIPES) {
    const productId = prodByName.get(r.product);
    if (!productId) continue;
    for (const it of r.items) {
      const stockItemId = stockByName.get(it.stock);
      if (!stockItemId) continue;
      await prisma.recipeItem.upsert({
        where: { productId_stockItemId: { productId, stockItemId } },
        create: { productId, stockItemId, quantity: it.quantity, establishmentId: est.id },
        update: { quantity: it.quantity },
      });
      recipeLinks++;
    }
  }
  console.log(`📋 Fichas técnicas: ${RECIPES.length} produtos · ${recipeLinks} insumos vinculados`);

  // --- Lançamentos financeiros (só se ainda não houver nenhum) ---
  const existingTx = await prisma.transaction.count({ where: { establishmentId: est.id } });
  if (existingTx > 0) {
    console.log(`💰 Já existem ${existingTx} lançamentos — pulando geração (use SEED_RESET=1).`);
  } else {
    const rows: {
      type: "INCOME" | "EXPENSE";
      description: string;
      amount: number;
      paidAt: Date;
      establishmentId: string;
    }[] = [];
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    for (let d = FINANCE_DAYS - 1; d >= 0; d--) {
      const day = new Date(today);
      day.setDate(day.getDate() - d);
      const sales = randInt(FINANCE.minSalesPerDay, FINANCE.maxSalesPerDay);
      let dayTotal = 0;
      for (let s = 0; s < sales; s++) {
        dayTotal += money(FINANCE.ticket.min, FINANCE.ticket.max);
      }
      dayTotal = Math.round(dayTotal * 100) / 100;
      rows.push({
        type: "INCOME",
        description: `Vendas do dia (${sales} pedidos)`,
        amount: dayTotal,
        paidAt: new Date(day),
        establishmentId: est.id,
      });
      if (d % FINANCE.expenseEveryDays === 0) {
        rows.push({
          type: "EXPENSE",
          description: "Compra de insumos",
          amount: money(FINANCE.expense.min, FINANCE.expense.max),
          paidAt: new Date(day),
          establishmentId: est.id,
        });
      }
    }
    await prisma.transaction.createMany({ data: rows });
    console.log(`💰 Lançamentos criados: ${rows.length} (${FINANCE_DAYS} dias).`);
  }

  console.log(`✅ Seed concluído para ${est.slug}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
