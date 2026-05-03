-- Actualizar el ciclo terminado en 7553 para que su fecha de cierre sea el 28 de abril de 2026
-- manteniendo la misma hora en la que se cerró.

UPDATE cycles
SET closed_at = '2026-04-28'::date + closed_at::time
WHERE cycle_number::text LIKE '%7553'
  AND status = 'COMPLETADO';
