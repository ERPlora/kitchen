-- Upsert de la configuración de cocina (singleton por hub): display (KDS) + comportamiento de
-- comandas (fusión ADR-0014). Runtime inyecta :new_id, :hub_id, :current_user_id, :now.
-- El parcheo por-campo lo resuelve la UI enviando el conjunto completo; aquí persistimos el estado
-- entero. ON CONFLICT(hub_id) actualiza la fila existente.
--
-- kitchen#48 · las columnas de los NUEVE ajustes que siguen retirados (`auto_accept_orders`,
-- `items_per_page`, `auto_refresh_seconds`, `sound_on_new_order`, `sound_on_rush`,
-- `auto_bump_enabled`, `auto_bump_delay_seconds`, `use_rounds`, `auto_fire_on_round`) siguen en la
-- tabla y NO se nombran aquí: en un INSERT toman su `DEFAULT` (todas son `NOT NULL DEFAULT …`) y en
-- el UPDATE se quedan como estaban, así que un hub que las tenía guardadas conserva su valor. Un
-- `:param` que el schema ya no ofrece dejaría el command sin ligar, y un command con un parámetro
-- sin ligar NO EXISTE en ningún hub: la pantalla de Ajustes dejaría de guardar entera.
--
-- kitchen#70 · `auto_print_tickets` vuelve a ligarse (imprimir el PASE al marcar listo, lo lee el
-- KDS) y kitchen#72 añade `sound_volume` y `sound_tone`. Las tres columnas existen desde la
-- migración 009 con el `DEFAULT` que reproduce el comportamiento de hoy.
--
-- kitchen#153 · `works_from_screen` (migration 013): off, the charge serves every round of the
-- check, because a kitchen that works from the printed order never marks anything on the screen.
INSERT INTO kitchen_settings
  (id, hub_id, show_timer, warning_time_minutes, critical_time_minutes,
   color_coding_enabled, sound_enabled, sound_volume, sound_tone,
   auto_print_tickets, default_order_type, works_from_screen,
   is_deleted, created_by, updated_by, created_at, updated_at)
VALUES
  (:new_id, :hub_id, :show_timer, :warning_time_minutes, :critical_time_minutes,
   :color_coding_enabled, :sound_enabled, :sound_volume, :sound_tone,
   :auto_print_tickets, :default_order_type, :works_from_screen,
   0, :current_user_id, :current_user_id, :now, :now)
ON CONFLICT(hub_id) DO UPDATE SET
  show_timer              = excluded.show_timer,
  warning_time_minutes    = excluded.warning_time_minutes,
  critical_time_minutes   = excluded.critical_time_minutes,
  color_coding_enabled    = excluded.color_coding_enabled,
  sound_enabled           = excluded.sound_enabled,
  sound_volume            = excluded.sound_volume,
  sound_tone              = excluded.sound_tone,
  auto_print_tickets      = excluded.auto_print_tickets,
  default_order_type      = excluded.default_order_type,
  works_from_screen       = excluded.works_from_screen,
  updated_by              = :current_user_id,
  updated_at              = :now;
