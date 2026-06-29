-- Actualizar el ciclo para que su fecha de cierre sea el 4 de mayo de 2026 (ayer)
-- manteniendo la misma hora en la que se cerró.

-- IMPORTANTE: Reemplaza "XXXX" por los últimos 4 dígitos de tu ciclo.

UPDATE cycles
SET closed_at = '2026-05-04' || substr(closed_at::text, 11)
WHERE cycle_number::text LIKE '%XXXX'
  AND status ILIKE 'completado';
