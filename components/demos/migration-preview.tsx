"use client"

import { MigrationPreview } from "@/registry/default/migration-preview/migration-preview"

const migration = `-- 20261014_add_order_region
ALTER TABLE orders ADD COLUMN region text NOT NULL;
CREATE INDEX orders_region_idx ON orders (region);
ALTER TABLE customers RENAME COLUMN name TO full_name;
ALTER TABLE orders DROP COLUMN legacy_status;`

export function Demo() {
  return <MigrationPreview label="20261014_add_order_region.sql" defaultValue={migration} tableSizes={{ orders: 12_400_000, customers: 86_000 }} />
}
