-- Actualizar el ciclo #2565 para que su fecha de cierre sea el 4 de mayo de 2026 (ayer)
-- y mantenga la misma hora en la que se cerró.

UPDATE cycles
SET closed_at = '2026-05-04' || substr(closed_at::text, 11)
WHERE cycle_number = 2565;
