-- Actualizar el ciclo terminado en 0316 para que su fecha de cierre sea el 29 de abril de 2026
-- manteniendo la misma hora en la que se cerró.

UPDATE cycles
SET closed_at = '2026-04-29' || substring(closed_at::text from 11)
WHERE cycle_number::text LIKE '%0316'
  AND status IN ('Completado', 'COMPLETADO');
