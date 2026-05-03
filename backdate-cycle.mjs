import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// ── Load .env ──────────────────────────────────────────────────────────────
const env = fs.readFileSync('.env', 'utf-8');
const envVars = {};
env.split('\n').filter(Boolean).forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/['"]/g, '');
    envVars[key] = val;
  }
});

const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
  global: {
    fetch: (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(30000) })
  }
});

// ── Config ─────────────────────────────────────────────────────────────────
// Cycle number to backdate (last 4 digits shown in the table)
const CYCLE_NUMBER_SUFFIX = '0316';

// Target date: April 23, 2026 — keep the same time as the original closed_at
// but move the date to day 23. We'll read the original first.
const TARGET_DATE = '2026-04-29';

async function main() {
  console.log('🔍 Buscando ciclo #' + CYCLE_NUMBER_SUFFIX + '...');

  // Fetch the cycle — cycle_number may be stored as integer or string
  const { data: cycles, error: fetchErr } = await supabase
    .from('cycles')
    .select('id, cycle_number, opened_at, closed_at, status')
    .eq('cycle_number', Number(CYCLE_NUMBER_SUFFIX))
    .limit(5);

  if (fetchErr) {
    // Fallback: fetch all recently closed and filter manually
    console.warn('ilike cast failed, trying manual fetch...', fetchErr.message);
    const { data: all, error: allErr } = await supabase
      .from('cycles')
      .select('id, cycle_number, opened_at, closed_at, status')
      .order('closed_at', { ascending: false })
      .limit(20);

    if (allErr) { console.error('Error fetching cycles:', allErr); process.exit(1); }

    const match = all?.find(c => String(c.cycle_number).endsWith(CYCLE_NUMBER_SUFFIX));
    if (!match) { console.error('❌ No se encontró el ciclo #' + CYCLE_NUMBER_SUFFIX); process.exit(1); }
    return updateCycle(match);
  }

  if (!cycles || cycles.length === 0) {
    console.error('❌ No se encontró el ciclo #' + CYCLE_NUMBER_SUFFIX);
    process.exit(1);
  }

  const cycle = cycles[0];
  return updateCycle(cycle);
}

async function updateCycle(cycle) {
  console.log('\n📋 Ciclo encontrado:');
  console.log('   ID         :', cycle.id);
  console.log('   Número     :', cycle.cycle_number);
  console.log('   Abierto    :', cycle.opened_at);
  console.log('   Cerrado    :', cycle.closed_at);
  console.log('   Estado     :', cycle.status);

  if (!cycle.closed_at) {
    console.error('❌ Este ciclo no tiene fecha de cierre (está En curso?)');
    process.exit(1);
  }

  // Build new closed_at: replace only the date part, keep the original time
  const originalClose = new Date(cycle.closed_at);
  const originalTime = originalClose.toISOString().substring(11); // "HH:MM:SS.mmmZ"
  const newClosedAt = `${TARGET_DATE}T${originalTime}`;

  console.log('\n🗓️  Cambiando closed_at:');
  console.log('   Original   :', cycle.closed_at);
  console.log('   Nuevo      :', newClosedAt);

  const { error: updateErr } = await supabase
    .from('cycles')
    .update({ closed_at: newClosedAt })
    .eq('id', cycle.id);

  if (updateErr) {
    console.error('❌ Error al actualizar:', updateErr.message);
    process.exit(1);
  }

  console.log('\n✅ ¡Ciclo actualizado con éxito!');
  console.log('   El ciclo #' + cycle.cycle_number + ' ahora aparece cerrado el ' + TARGET_DATE);

  // Verify
  const { data: verify } = await supabase
    .from('cycles')
    .select('id, cycle_number, opened_at, closed_at, status')
    .eq('id', cycle.id)
    .single();

  console.log('\n🔎 Verificación:');
  console.log('   Abierto    :', verify?.opened_at);
  console.log('   Cerrado    :', verify?.closed_at);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
