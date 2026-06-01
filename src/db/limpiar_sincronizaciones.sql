-- ============================================
-- LIMPIEZA DE SINCRONIZACIONES
-- ============================================
-- Este script limpia TODAS las sincronizaciones
-- realizadas, dejando edificios y usuarios intactos.
-- NO borra usuarios ni edificios.
-- ============================================

BEGIN;

-- 1. Eliminar todas las coordenadas capturadas
DELETE FROM coordenadas;

-- 2. Eliminar todos los logs de sincronización
DELETE FROM sync_logs;

-- 3. Resetear edificios a estado "pendiente"
UPDATE edificios 
SET 
    estado = 'pendiente',
    lat = NULL,
    lng = NULL,
    accuracy = NULL,
    captura_timestamp = NULL,
    sync_timestamp = NULL,
    tecnico_id = NULL,
    updated_at = NOW();

-- 4. Resetear secuencias (para que los IDs vuelvan a 1)
ALTER SEQUENCE coordenadas_id_seq RESTART WITH 1;
ALTER SEQUENCE sync_logs_id_seq RESTART WITH 1;

COMMIT;

-- ============================================
-- VERIFICACIÓN
-- ============================================
SELECT 
    'usuarios' as tabla, COUNT(*) as registros FROM usuarios
UNION ALL
SELECT 
    'edificios', COUNT(*) FROM edificios
UNION ALL
SELECT 
    'coordenadas', COUNT(*) FROM coordenadas
UNION ALL
SELECT 
    'sync_logs', COUNT(*) FROM sync_logs;
