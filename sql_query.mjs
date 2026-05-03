#!/usr/bin/env node
const PROJECT_REF = 'gyozrlgyzjishmpwjpce';
const PAT         = 'sbp_7e62b469dfdae29c8563f9365e47428f00792ce7';

async function queryMgmt(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${PAT}` },
    body: JSON.stringify({ query: sql }),
  });
  return res.json();
}

const SQL = `
SELECT id, cycle_number, opened_at, closed_at, status 
FROM cycles 
WHERE cycle_number::text LIKE '%0316%' OR id::text LIKE '%0316%'
ORDER BY closed_at DESC NULLS LAST
LIMIT 10;
`;

async function main() {
  const result = await queryMgmt(SQL);
  console.log(JSON.stringify(result, null, 2));
}

main().catch(err => console.error(err));
