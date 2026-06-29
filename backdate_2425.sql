-- Script para retroceder el ciclo 2425 al día 22 de mayo de 2026.
-- Esto hará que aparezca como ganancia de ese día en el Dashboard.

UPDATE cycles
SET closed_at = '2026-05-22' || substr(closed_at::text, 11)
WHERE cycle_number::text LIKE '%2425'
  AND status ILIKE 'completado';
