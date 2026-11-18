/**
 * Shopfloor demo: runs every core module against the in-memory backend.
 * No NetSuite, no network. Run with: npm run demo
 */
import {
  getProfile,
  InventoryService,
  MemoryBackend,
  ProductionService,
  RetailService,
} from '../src/core/index';

const line = (title: string): void => console.log(`\n=== ${title} ===`);

// ─── 1. Machine shop: reorder raw materials ────────────────────
line('Manufacturing: nightly reorder');
const shop = new MemoryBackend({
  stock: [
    { itemId: 'BOLT-M6', name: 'M6 bolt', available: 40, onOrder: 0, dailyDemand: 12, vendorId: 'fastenal' },
    { itemId: 'NUT-M6', name: 'M6 nut', available: 500, onOrder: 0, dailyDemand: 12, vendorId: 'fastenal' },
    { itemId: 'SHEET-AL', name: 'Aluminum sheet', available: 3, onOrder: 5, dailyDemand: 0, reorderPoint: 10, preferredStockLevel: 25, vendorId: 'alcoa' },
    { itemId: 'GLUE', name: 'Epoxy', available: 0, onOrder: 0, dailyDemand: 1 },
  ],
});
const mfg = getProfile('manufacturing');
const inventory = new InventoryService({ stock: shop, purchaseOrders: shop }, mfg);

const preview = inventory.run(); // dry run
console.log('Dry run suggestions:');
for (const s of preview.suggestions) console.log(`  ${s.name.padEnd(16)} order ${s.quantity}  (${s.reason})`);
console.log(`  Purchase orders written: ${shop.purchaseOrders.length}`);
console.log(`  No vendor set: ${preview.skippedNoVendor.map((s) => s.name).join(', ')}`);

inventory.run({ dryRun: false });
console.log('Live run purchase orders:');
for (const po of shop.purchaseOrders) {
  console.log(`  ${po.id} -> ${po.vendorId}: ${po.lines.map((l) => `${l.itemId} x${l.quantity}`).join(', ')}`);
}

// ─── 2. Machine shop: schedule a build ─────────────────────────
line('Manufacturing: schedule a build');
const production = new ProductionService({ workOrders: shop }, mfg);
const build = production.scheduleBuild({
  assemblyId: 'BRACKET-A',
  openDemand: 100,
  available: 2,
  bom: [
    { itemId: 'BOLT-M6', quantityPer: 4 },
    { itemId: 'SHEET-AL', quantityPer: 0.25 },
  ],
  componentStock: { 'BOLT-M6': 40, 'SHEET-AL': 3 },
});
console.log(`  Build quantity: ${build.buildQuantity} (98 net, 3% scrap, batches of 10)`);
console.log(`  Work order: ${build.workOrderId}`);
for (const s of build.shortages) console.log(`  Short: ${s.itemId} needs ${s.required}, have ${s.available}`);

// ─── 3. Coffee shop: close the day ─────────────────────────────
line('Retail: daily close');
const cafe = new MemoryBackend({
  sales: [
    { date: '2026-11-18', transactionId: 't1', itemId: 'LATTE', itemName: 'Latte', quantity: 2, amount: 11, paymentMethod: 'Card' },
    { date: '2026-11-18', transactionId: 't2', itemId: 'DRIP', itemName: 'Drip coffee', quantity: 3, amount: 9, paymentMethod: 'Cash' },
    { date: '2026-11-18', transactionId: 't2', itemId: 'SCONE', itemName: 'Scone', quantity: 2, amount: 7, paymentMethod: 'Cash' },
    { date: '2026-11-18', transactionId: 't3', itemId: 'LATTE', itemName: 'Latte', quantity: 1, amount: 5.5, paymentMethod: 'Cash' },
  ],
});
const retail = new RetailService({ sales: cafe }, getProfile('retail'));
const day = retail.closeDay('2026-11-18', 18.5);
console.log(`  Transactions: ${day.transactions}, gross: $${day.grossSales}`);
console.log(`  By payment: ${JSON.stringify(day.byPaymentMethod)}`);
console.log(`  Top items: ${day.topItems.map((i) => `${i.itemName} $${i.amount}`).join(', ')}`);
console.log(`  Cash expected $${day.cash.expected}, counted $${day.cash.counted}, variance $${day.cash.variance}, flagged: ${day.cash.flagged}`);
