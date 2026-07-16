-- PG-compat (auditoría pm#16, 07-17): los binds BOOLEANOS del schema van envueltos en
-- CASE WHEN :x THEN 1 WHEN NOT :x THEN 0 END — las columnas son INTEGER 0/1 por contrato
-- (§2.5) y Postgres NO castea boolean→bigint (SQLite sí lo toleraba). El tri-estado
-- preserva NULL para los COALESCE de opcionales.
-- Upsert de la configuración de cocina (singleton por hub): display (KDS) + comportamiento
-- de comandas (fusión ADR-0014). Runtime inyecta :new_id, :hub_id, :current_user_id, :now.
-- El parcheo por-campo lo resuelve la UI enviando el conjunto completo; aquí persistimos
-- el estado entero. ON CONFLICT(hub_id) actualiza la fila existente.
INSERT INTO kitchen_settings
  (id, hub_id, auto_accept_orders, show_timer, warning_time_minutes, critical_time_minutes,
   items_per_page, auto_refresh_seconds, sound_enabled, sound_on_new_order, sound_on_rush,
   auto_bump_enabled, auto_bump_delay_seconds, color_coding_enabled,
   auto_print_tickets, use_rounds, auto_fire_on_round, default_order_type,
   is_deleted, created_by, updated_by, created_at, updated_at)
VALUES
  (:new_id, :hub_id, CASE WHEN :auto_accept_orders THEN 1 WHEN NOT :auto_accept_orders THEN 0 END, CASE WHEN :show_timer THEN 1 WHEN NOT :show_timer THEN 0 END, :warning_time_minutes, :critical_time_minutes,
   :items_per_page, :auto_refresh_seconds, CASE WHEN :sound_enabled THEN 1 WHEN NOT :sound_enabled THEN 0 END, CASE WHEN :sound_on_new_order THEN 1 WHEN NOT :sound_on_new_order THEN 0 END, CASE WHEN :sound_on_rush THEN 1 WHEN NOT :sound_on_rush THEN 0 END,
   CASE WHEN :auto_bump_enabled THEN 1 WHEN NOT :auto_bump_enabled THEN 0 END, :auto_bump_delay_seconds, CASE WHEN :color_coding_enabled THEN 1 WHEN NOT :color_coding_enabled THEN 0 END,
   CASE WHEN :auto_print_tickets THEN 1 WHEN NOT :auto_print_tickets THEN 0 END, CASE WHEN :use_rounds THEN 1 WHEN NOT :use_rounds THEN 0 END, CASE WHEN :auto_fire_on_round THEN 1 WHEN NOT :auto_fire_on_round THEN 0 END, :default_order_type,
   0, :current_user_id, :current_user_id, :now, :now)
ON CONFLICT(hub_id) DO UPDATE SET
  auto_accept_orders      = excluded.auto_accept_orders,
  show_timer              = excluded.show_timer,
  warning_time_minutes    = excluded.warning_time_minutes,
  critical_time_minutes   = excluded.critical_time_minutes,
  items_per_page          = excluded.items_per_page,
  auto_refresh_seconds    = excluded.auto_refresh_seconds,
  sound_enabled           = excluded.sound_enabled,
  sound_on_new_order      = excluded.sound_on_new_order,
  sound_on_rush           = excluded.sound_on_rush,
  auto_bump_enabled       = excluded.auto_bump_enabled,
  auto_bump_delay_seconds = excluded.auto_bump_delay_seconds,
  color_coding_enabled    = excluded.color_coding_enabled,
  auto_print_tickets      = excluded.auto_print_tickets,
  use_rounds              = excluded.use_rounds,
  auto_fire_on_round      = excluded.auto_fire_on_round,
  default_order_type      = excluded.default_order_type,
  updated_by              = :current_user_id,
  updated_at              = :now;
