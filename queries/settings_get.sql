-- Configuración de cocina del hub (singleton): display (KDS) + comportamiento de comandas.
-- Runtime inyecta :hub_id. Si no existe fila aún, la UI usa los defaults del esquema.
--
-- Devuelve EXACTAMENTE lo que `schemas/settings_update.json` publica: las columnas de los diez
-- ajustes retirados en kitchen#48 siguen en la tabla, pero nadie las lee, y devolverlas aquí las
-- volvería a ofrecer al formulario. Las tres puertas —schema, command y esta query— dicen lo
-- mismo, y `tests/every_setting_moves_something.contract.test.py` falla si dejan de hacerlo.
SELECT id,
       show_timer, warning_time_minutes, critical_time_minutes,
       color_coding_enabled, sound_enabled, default_order_type
FROM kitchen_settings
WHERE hub_id = :hub_id AND is_deleted = 0
LIMIT 1;
