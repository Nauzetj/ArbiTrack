#!/usr/bin/env node
// Cambia opened_at del ciclo #9016 al día 12 de mayo (en lugar del 13)

const PROJECT_REF = 'gyozrlgyzjishmpwjpce';
const PAT         = 'sbp_7e62b469dfdae29c8563f9365e47428f00792ce7';

async function queryMgmt(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${PAT}` },
    body: JSON.stringify({ query: sql }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`API error ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

async function main() {
  // PASO 1: Buscar el ciclo #9016 (o el más reciente alrededor del 12-13 mayo)
  console.log('🔍 Buscando ciclos recientes...\n');
  const cycles = await queryMgmt(`
    SELECT id, cycle_number, opened_at, closed_at, status
    FROM cycles
    ORDER BY opened_at DESC
    LIMIT 15;
  `);

  console.log('📋 Últimos ciclos:');
  cycles.forEach(c => {
    console.log(`  #${c.cycle_number}  |  ${String(c.opened_at).substring(0,10)}  →  ${String(c.closed_at).substring(0,10)}  |  ${c.status}  |  ID: ${c.id}`);
  });

  // Buscar por número visible 9016 o sufijo
  const match = cycles.find(c =>
    c.cycle_number === 9016 ||
    String(c.cycle_number).endsWith('9016')
  );

  if (!match) {
    console.error('\n❌ No se encontró el ciclo #9016 en los últimos 15. Revisa la lista arriba.');
    process.exit(1);
  }

  console.log(`\n✅ Ciclo encontrado: #${match.cycle_number} — ID: ${match.id}`);
  console.log('   opened_at actual:', match.opened_at);
  console.log('   closed_at actual:', match.closed_at);

  // PASO 2: Construir nuevas fechas (día 12 para opened, día 13 para closed — misma hora)
  const openOrig  = new Date(match.opened_at);
  const openTime  = openOrig.toISOString().substring(11); // HH:MM:SS.mmmZ
  const newOpenedAt = `2026-05-12T${openTime}`;

  let setClause = `opened_at = '${newOpenedAt}'`;

  if (match.closed_at) {
    const closeOrig = new Date(match.closed_at);
    const closeTime = closeOrig.toISOString().substring(11);
    const newClosedAt = `2026-05-13T${closeTime}`;
    setClause += `, closed_at = '${newClosedAt}'`;
    console.log('\n🗓️  Cambios:');
    console.log('   opened_at →', newOpenedAt);
    console.log('   closed_at →', newClosedAt);
  } else {
    console.log('\n🗓️  Cambios:');
    console.log('   opened_at →', newOpenedAt);
  }

  // PASO 3: Ejecutar el UPDATE
  const result = await queryMgmt(`
    UPDATE cycles
    SET ${setClause}
    WHERE id = '${match.id}'
    RETURNING id, cycle_number, opened_at, closed_at, status;
  `);

  if (!result || result.length === 0) {
    console.error('❌ El UPDATE no afectó ninguna fila.');
    process.exit(1);
  }

  const updated = result[0];
  console.log('\n🎉 ¡Ciclo actualizado con éxito!');
  console.log('   Abierto  :', updated.opened_at);
  console.log('   Cerrado  :', updated.closed_at);
  console.log('   Estado   :', updated.status);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
