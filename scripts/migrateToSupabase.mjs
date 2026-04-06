import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Error: Falta VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en tu archivo .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function migrate() {
  console.log('🚀 Iniciando script de migración a Supabase...\n');

  // Busca el archivo backup.json
  const backupFile = process.argv[2] || 'arbitrack_backup.json';
  if (!fs.existsSync(backupFile)) {
    console.error(`❌ Error: No se encontró el archivo ${backupFile}.`);
    console.error('Uso: node scripts/migrateToSupabase.mjs <ruta-a-tu-backup.json>');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(backupFile, 'utf8'));

  // Asegúrate de requerir el ID de usuario a quién asignar estos datos antiguos.
  // Tu backup probablemente no tiene userID.
  const userEmail = process.argv[3];
  
  // Usamos el ID directamente sacado de la captura de pantalla de Supabase Auth
  const userId = '8207685d-5e5c-41f1-a997-61b18b5ee2e7';
  console.log(`✅ Inyectando directamente al Usuario con ID: ${userId}`);

  try {
    if (data.cycles && data.cycles.length > 0) {
      console.log(`\n📦 Migrando ${data.cycles.length} ciclos...`);
      const mappedCycles = data.cycles.map((c) => ({
        ...c,
        user_id: userId,
        opened_at: c.openedAt,
        closed_at: c.closedAt
      }));

      // Delete id so supabase auto-generates if we are inserting fresh, or just let them sync.
      // Actually in ArbiTrack we use random UUIDs for cycles anyway.
      
      const { error: errCycles } = await supabase.from('cycles').upsert(
        mappedCycles.map(({ openedAt, closedAt, ...rest }) => rest)
        , { onConflict: 'id' }
      );
      if (errCycles) throw new Error('Error migrando ciclos: ' + errCycles.message);
      console.log('✅ Ciclos migrados.');
    }

    if (data.orders && data.orders.length > 0) {
      console.log(`\n📦 Migrando ${data.orders.length} órdenes financieras...`);
      const mappedOrders = data.orders.map((o) => ({
        ...o,
        user_id: userId,
      }));
      const { error: errOrders } = await supabase.from('orders').upsert(
        mappedOrders
        , { onConflict: 'orderNumber' }
      );
      if (errOrders) throw new Error('Error migrando órdenes: ' + errOrders.message);
      console.log('✅ Órdenes migradas.');
    }

    console.log('\n🎉 Migración de datos completada con éxito.');

  } catch (err) {
    console.error('❌ Falló la migración:', err);
  }
}

migrate();
