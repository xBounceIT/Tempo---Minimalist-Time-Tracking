import { query } from './index.ts';

export async function migrate() {
  console.log('Running currency precision update migration...');

  const tables = [
    { name: 'products', columns: ['costo'] },
    { name: 'quote_items', columns: ['unit_price', 'product_cost', 'special_bid_unit_price'] },
    { name: 'sale_items', columns: ['unit_price', 'product_cost', 'special_bid_unit_price'] },
    { name: 'special_bids', columns: ['unit_price'] },
    { name: 'supplier_quote_items', columns: ['unit_price'] },
    { name: 'invoice_items', columns: ['unit_price'] },
  ];

  try {
    for (const table of tables) {
      for (const column of table.columns) {
        // Check if column exists first to avoid errors
        const checkResult = await query(
          `SELECT column_name 
           FROM information_schema.columns 
           WHERE table_name=$1 AND column_name=$2`,
          [table.name, column],
        );

        if (checkResult.rows.length > 0) {
          await query(`ALTER TABLE ${table.name} ALTER COLUMN ${column} TYPE DECIMAL(15, 6);`);
        }
      }
    }
    console.log('Currency precision update completed.');
  } catch (err) {
    console.error('Error running currency precision update migration:', err);
    throw err;
  }
}
