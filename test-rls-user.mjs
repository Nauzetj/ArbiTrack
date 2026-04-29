#!/usr/bin/env node
const PROJECT_REF = 'gyozrlgyzjishmpwjpce';
const PAT         = 'sbp_7e62b469dfdae29c8563f9365e47428f00792ce7';
const USER_ID     = '480be850-ea85-4a8c-acf6-72947bfc3eb7';

async function queryMgmt(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${PAT}` },
    body: JSON.stringify({ query: sql }),
  });
  return res.json();
}

const SQL = `
BEGIN;
  -- Simulate authenticated user
  SET LOCAL role = authenticated;
  SET LOCAL request.jwt.claim.sub = '${USER_ID}';
  SET LOCAL request.jwt.claim.role = 'authenticated';

  -- Check if user can select their cycles
  SELECT id, cycle_number, status FROM cycles;
COMMIT;
`;

async function main() {
  const result = await queryMgmt(SQL);
  console.log(JSON.stringify(result, null, 2));
}

main().catch(err => console.error(err));
