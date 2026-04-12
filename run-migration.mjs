#!/usr/bin/env node
/**
 * ArbiTrack – Migracion automatica: Modulo Unificado de Ciclos
 *
 * Agrega las columnas nuevas a la tabla `orders` directamente
 * via la REST API de Supabase con la Service Role Key.
 *
 * USO:
 *   1. Obtén la Service Role Key en:
 *      Supabase Studio → Settings → API → service_role (secret)
 *   2. Ejecuta:
 *      SUPABASE_SERVICE_KEY=tu_service_key node run-migration.mjs
 *
 * La anon key NO funciona para DDL — se necesita la service role.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL     = 'https://gyozrlgyzjishmpwjpce.supabase.co';
const SERVICE_KEY      = process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_KEY) {
  console.error('\n❌  Falta la Service Role Key.\n');
  console.error('   Ejecúta con:');
  console.error('   SUPABASE_SERVICE_KEY=tu_clave_aqui node run-migration.mjs\n');
  console.error('   Encuéntrala en: Supabase Studio → Settings → API → service_role\n');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ─── Sentencias DDL idempotentes ──────────────────────────────────────────────

const migrations = [
  {
    name: 'operation_type column',
    sql: `
      ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS operation_type TEXT DEFAULT NULL
          CHECK (
            operation_type IS NULL OR
            operation_type IN (
              'VENTA_USDT','COMPRA_USDT','RECOMPRA','COMPRA_USD','TRANSFERENCIA'
            )
          );
    `,
  },
  {
    name: 'cycle_type column',
    sql: `
      ALTER TABLE cycles
        ADD COLUMN IF NOT EXISTS cycle_type TEXT NOT NULL DEFAULT 'p2p'
          CHECK (cycle_type IN ('p2p','manual'));
    `,
  },
  {
    name: 'commission_type column',
    sql: `
      ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS commission_type TEXT DEFAULT NULL
          CHECK (commission_type IS NULL OR commission_type IN ('fixed','percent'));
    `,
  },
  {
    name: 'origin_mode column',
    sql: `
      ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS origin_mode TEXT DEFAULT NULL
          CHECK (origin_mode IS NULL OR origin_mode IN ('auto','manual'));
    `,
  },
  {
    name: 'exchange column',
    sql: `
      ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS exchange TEXT DEFAULT NULL;
    `,
  },
  {
    name: 'notas column',
    sql: `
      ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS notas TEXT DEFAULT NULL;
    `,
  },
  {
    name: 'index idx_orders_exchange',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_orders_exchange
        ON orders(exchange)
        WHERE exchange IS NOT NULL;
    `,
  },
  {
    name: 'index idx_orders_operation_type',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_orders_operation_type
        ON orders(operation_type)
        WHERE operation_type IS NOT NULL;
    `,
  },
  {
    name: 'index idx_orders_origin_mode',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_orders_origin_mode
        ON orders(origin_mode)
        WHERE origin_mode IS NOT NULL;
    `,
  },
];

// ─── Ejecutar ──────────────────────────────────────────────────────────────────

async function runMigrations() {
  console.log('\n🚀  ArbiTrack — Aplicando migración: Módulo Unificado de Ciclos\n');
  console.log(`📡  Proyecto: ${SUPABASE_URL}\n`);

  let ok = 0;
  let failed = 0;

  for (const m of migrations) {
    process.stdout.write(`   ⏳  ${m.name.padEnd(36)} `);
    const { error } = await supabase.rpc('exec_sql', { sql: m.sql }).catch(() => ({ error: { message: 'rpc not available' } }));

    // Si exec_sql no está disponible, usar el endpoint de query directo
    if (error && error.message?.includes('not available')) {
      // Intentar via REST /rest/v1/rpc alternativo
      const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ query: m.sql }),
      });

      if (!res.ok) {
        console.log(`❌  (HTTP ${res.status})`);
        failed++;
        continue;
      }
    } else if (error) {
      // Puede ser que la columna ya exista — eso es ok
      if (
        error.message?.includes('already exists') ||
        error.message?.includes('duplicate column')
      ) {
        console.log('✅  (ya existe, sin cambios)');
        ok++;
      } else {
        console.log(`❌  ${error.message}`);
        failed++;
      }
      continue;
    }

    console.log('✅');
    ok++;
  }

  // ── Verificación ──────────────────────────────────────────────────────────
  console.log('\n🔍  Verificando columnas en la tabla orders…\n');

  const { data, error: verifyErr } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type, is_nullable')
    .eq('table_name', 'orders')
    .in('column_name', ['operation_type','commission_type','origin_mode','exchange','notas'])
    .order('column_name');

  if (verifyErr) {
    // fallback: information_schema no siempre está expuesto via REST
    console.log('   ⚠️  No se pudo verificar via REST. Comprueba manualmente en Supabase Studio.\n');
  } else if (data && data.length > 0) {
    console.log('   Columnas encontradas:\n');
    data.forEach(col => {
      console.log(`   ✅  ${col.column_name.padEnd(20)} ${col.data_type.padEnd(16)} nullable: ${col.is_nullable}`);
    });
    const missing = ['operation_type','commission_type','origin_mode','exchange','notas']
      .filter(c => !data.find(d => d.column_name === c));
    if (missing.length) {
      console.log(`\n   ❌  Columnas no encontradas: ${missing.join(', ')}`);
      console.log('   → Ejecuta migration_unified_cycles.sql en Supabase Studio manualmente.\n');
    }
  }

  console.log(`\n📊  Resultado: ${ok} OK · ${failed} fallidos\n`);

  if (failed > 0) {
    console.log('ℹ️  Si hay errores DDL, ejecuta migration_unified_cycles.sql directamente');
    console.log('   en Supabase Studio → SQL Editor para aplicar la migración manualmente.\n');
    process.exit(1);
  } else {
    console.log('🎉  Migración completada. La app ya puede persistir los nuevos campos.\n');
  }
}

runMigrations().catch(err => {
  console.error('\n💥  Error inesperado:', err.message);
  process.exit(1);
});
