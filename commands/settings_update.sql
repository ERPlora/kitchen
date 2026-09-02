-- Upsert de la configuración de cocina (singleton por hub): display (KDS) + comportamiento de
-- comandas (fusión ADR-0014). Runtime inyecta :new_id, :hub_id, :current_user_id, :now.
-- El parcheo por-campo lo resuelve la UI enviando el conjunto completo; aquí persistimos el estado
-- entero. ON CONFLICT(hub_id) actualiza la fila existente.
--
-- kitchen#48 · las columnas de los diez ajustes RETIRADOS (`auto_accept_orders`, `items_per_page`,
-- `auto_refresh_seconds`, `sound_on_new_order`, `sound_on_rush`, `auto_bump_enabled`,
-- `auto_bump_delay_seconds`, `auto_print_tickets`, `use_rounds`, `auto_fire_on_round`) siguen en la
-- tabla y NO se nombran aquí: en un INSERT toman su `DEFAULT` (todas son `NOT NULL DEFAULT …`) y en
-- el UPDATE se quedan como estaban, así que un hub que las tenía guardadas conserva su valor. Un
-- `:param` que el schema ya no ofrece dejaría el command sin ligar, y un command con un parámetro
-- sin ligar NO EXISTE en ningún hub: la pantalla de Ajustes dejaría de guardar entera.
INSERT INTO kitchen_settings
  (id, hub_id, show_timer, warning_time_minutes, critical_time_minutes,
   color_coding_enabled, sound_enabled, default_order_type,
   is_deleted, created_by, updated_by, created_at, updated_at)
VALUES
  (:new_id, :hub_id, :show_timer, :warning_time_minutes, :critical_time_minutes,
   :color_coding_enabled, :sound_enabled, :default_order_type,
   0, :current_user_id, :current_user_id, :now, :now)
ON CONFLICT(hub_id) DO UPDATE SET
  show_timer              = excluded.show_timer,
  warning_time_minutes    = excluded.warning_time_minutes,
  critical_time_minutes   = excluded.critical_time_minutes,
  color_coding_enabled    = excluded.color_coding_enabled,
  sound_enabled           = excluded.sound_enabled,
  default_order_type      = excluded.default_order_type,
  updated_by              = :current_user_id,
  updated_at              = :now;
