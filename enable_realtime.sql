-- ═══════════════════════════════════════════════════════════
--  PASO REQUERIDO: Habilitar Supabase Realtime en ArbiTrack
--  Ejecutar UNA SOLA VEZ en el SQL Editor de Supabase
-- ═══════════════════════════════════════════════════════════

-- 1. Asegurarse que las tablas tengan REPLICA IDENTITY FULL
--    (necesario para que Realtime envíe los datos del row completo)
ALTER TABLE orders REPLICA IDENTITY FULL;
ALTER TABLE cycles REPLICA IDENTITY FULL;

-- 2. Añadir las tablas a la publicación de Supabase Realtime
--    (si ya están añadidas, puede ignorarse el error)
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE cycles;

-- Verificar que quedaron registradas:
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
