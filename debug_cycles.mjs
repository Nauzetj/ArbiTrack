#!/usr/bin/env node
/**
 * debug_cycles.mjs
 * Diagnóstico: consulta ciclos con anon key + login de usuario para ver todos los ciclos
 * disponibles en la base de datos y detectar por qué no aparecen en los reportes.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = 'https://gyozrlgyzjishmpwjpce.supabase.co';
const ANON_KEY      = 'sb_publishable_-FdpQLX1dD3VVnZkXJ0lzQ_S2x5zVbW';

const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false }
});

// Credenciales del usuario administrador (usa las mismas que usa el login del app)
const EMAIL    = process.argv[2] || 'nauzetjcortez@yopmail.com';
const PASSWORD = process.argv[3] || '';

async function main() {
  if (!PASSWORD) {
    console.log('Uso: node debug_cycles.mjs <email> <password>');
    console.log('Intentando consulta sin autenticación...\n');
    
    // Sin auth - RLS bloqueará pero podemos ver el error
    const { data, error } = await supabase
      .from('cycles')
      .select('id, cycle_number, status, opened_at, closed_at')
      .order('opened_at', { ascending: false })
      .limit(30);
    
    if (error) {
      console.error('Error (esperado con RLS sin auth):', error.message);
      console.log('\n⚠️  Para diagnóstico completo, ejecuta:');
      console.log('   node debug_cycles.mjs nauzetjcortez@yopmail.com <tu_password>');
      return;
    }
    
    console.log('Ciclos (sin auth):', JSON.stringify(data, null, 2));
    return;
  }

  // Autenticar al usuario
  console.log(`Autenticando como ${EMAIL}...`);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });

  if (authError) {
    console.error('Error de autenticación:', authError.message);
    return;
  }

  console.log(`✅ Autenticado como: ${authData.user?.email} (ID: ${authData.user?.id})\n`);

  // Consultar todos los ciclos
  const { data: cycles, error: cyclesError } = await supabase
    .from('cycles')
    .select('id, cycle_number, status, opened_at, closed_at, ganancia_usdt, ganancia_ves')
    .order('opened_at', { ascending: false });

  if (cyclesError) {
    console.error('Error consultando ciclos:', cyclesError.message);
    return;
  }

  console.log(`Total ciclos encontrados: ${cycles.length}\n`);

  // Análisis de status
  const statusMap = {};
  cycles.forEach(c => {
    statusMap[c.status] = (statusMap[c.status] || 0) + 1;
  });
  console.log('📊 Distribución por status:', statusMap);

  // Análisis por mes de cierre
  const closedByMonth = {};
  const cyclesWithClosedAt = [];
  const cyclesWithoutClosedAt = [];
  
  cycles.forEach(c => {
    if (c.closed_at) {
      cyclesWithClosedAt.push(c);
      const month = c.closed_at.slice(0, 7);
      closedByMonth[month] = (closedByMonth[month] || 0) + 1;
    } else {
      cyclesWithoutClosedAt.push(c);
    }
  });

  console.log('\n📅 Ciclos cerrados por mes (closed_at):');
  Object.entries(closedByMonth)
    .sort(([a], [b]) => b.localeCompare(a))
    .forEach(([month, count]) => console.log(`   ${month}: ${count} ciclos`));
  
  console.log(`\n❌ Ciclos SIN closed_at: ${cyclesWithoutClosedAt.length}`);
  if (cyclesWithoutClosedAt.length > 0) {
    console.log('   Detalles:');
    cyclesWithoutClosedAt.forEach(c => 
      console.log(`   - Ciclo #${c.cycle_number} | status: "${c.status}" | opened_at: ${c.opened_at}`)
    );
  }

  // Revisar formato de closed_at para detectar problemas de parsing
  console.log('\n🔍 Muestra de closed_at (últimos 10 ciclos cerrados):');
  cyclesWithClosedAt.slice(0, 10).forEach(c => {
    const raw = c.closed_at;
    const hasT = raw.includes('T');
    const hasPlus = raw.includes('+');
    const length = raw.length;
    
    // Simular el parse actual del código de Reports.tsx
    let parsedOk = false;
    let parsedDate = '?';
    try {
      let isoStr = raw.trim();
      if (isoStr.length <= 10) {
        parsedDate = isoStr;
        parsedOk = true;
      } else {
        if (!isoStr.includes('T') && isoStr.includes(' ')) {
          isoStr = isoStr.replace(' ', 'T');
        }
        const utcDate = new Date(isoStr);
        if (!isNaN(utcDate.getTime())) {
          const venTime = new Date(utcDate.getTime() - (4 * 60 * 60 * 1000));
          parsedDate = venTime.toISOString().split('T')[0];
          parsedOk = true;
        }
      }
    } catch {}
    
    const icon = parsedOk ? '✅' : '❌';
    console.log(`   ${icon} Ciclo #${c.cycle_number} | status: "${c.status}" | closed_at: "${raw}" (len=${length}, hasT=${hasT}, hasPlus=${hasPlus}) → parsedDate: ${parsedDate}`);
  });

  // Verificar ciclos de Mayo y Abril 2026
  console.log('\n📌 Ciclos de Mayo 2026:');
  const mayCycles = cycles.filter(c => c.closed_at && c.closed_at.startsWith('2026-05'));
  if (mayCycles.length === 0) {
    console.log('   ⚠️  No hay ciclos cerrados en Mayo 2026');
    // Buscar ciclos abiertos en mayo
    const mayOpen = cycles.filter(c => c.opened_at && c.opened_at.startsWith('2026-05'));
    if (mayOpen.length > 0) {
      console.log('   Ciclos ABIERTOS en Mayo 2026:');
      mayOpen.forEach(c => console.log(`   - Ciclo #${c.cycle_number} | status: "${c.status}" | closed_at: ${c.closed_at || 'NULL'}`));
    }
  } else {
    mayCycles.forEach(c => console.log(`   - Ciclo #${c.cycle_number} | status: "${c.status}" | closed_at: ${c.closed_at}`));
  }

  console.log('\n📌 Ciclos de Abril 2026:');
  const aprCycles = cycles.filter(c => c.closed_at && c.closed_at.startsWith('2026-04'));
  if (aprCycles.length === 0) {
    console.log('   ⚠️  No hay ciclos cerrados en Abril 2026');
  } else {
    aprCycles.forEach(c => console.log(`   - Ciclo #${c.cycle_number} | status: "${c.status}" | closed_at: ${c.closed_at}`));
  }

  // Simular el filtro que usa Reports.tsx
  console.log('\n🔬 Simulando filtro de Reports.tsx (completedCycles):');
  const completedCycles = cycles.filter(c => 
    c.status && c.status.toLowerCase() !== 'en curso' && c.closed_at
  );
  console.log(`   Ciclos que PASAN el filtro: ${completedCycles.length} de ${cycles.length}`);
  
  const filteredByMonth = {};
  completedCycles.forEach(c => {
    if (c.closed_at) {
      const month = c.closed_at.slice(0, 7);
      filteredByMonth[month] = (filteredByMonth[month] || 0) + 1;
    }
  });
  console.log('   Por mes:', filteredByMonth);

  await supabase.auth.signOut();
}

main().catch(console.error);
