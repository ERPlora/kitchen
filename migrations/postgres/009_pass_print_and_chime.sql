-- kitchen#70 + kitchen#72 — los tres ajustes que vuelven a la pantalla de Cocina, ya con lector.
--
-- `auto_print_tickets` NO es una columna nueva: existe desde 001 con `DEFAULT 1` y kitchen#48 la
-- retiró del formulario porque no la leía nadie. Vuelve con OTRO significado —imprimir el PASE al
-- marcar listo, que es donde imprimen 5 de los 10 KDS del mercado— y por eso su `DEFAULT` baja a 0:
--
--   · lo que promete ahora es papel NUEVO, en un momento en el que hoy no sale ninguno. Publicarla
--     encendida haría que cada cocina que actualice empiece a sacar una hoja en cada bump sin
--     haberlo pedido, que es exactamente la regresión que no se entrega;
--   · el mercado la trae apagada: en Toast, Fresh KDS y MobiPOS es una opción que se ENCIENDE.
--
-- Las filas que ya existen se normalizan en la 010, que es un `backfill` y va aparte a propósito.
--
-- `sound_volume` y `sound_tone` son de kitchen#72: el volumen y el tono que los foros de cocina
-- piden («all I got is a small ding that is really hard to hear in the kitchen»). Sus `DEFAULT`
-- reproducen EXACTAMENTE el pitido de hoy — 70 × 0,5 / 100 = 0,35, el `PEAK_GAIN` fijo que sonaba
-- antes, y `chime` son las dos notas de siempre—, así que un hub que no toque nada suena igual.
-- Los tonos se SINTETIZAN (`ui/lib/chime.ts`): un fichero de audio en un bundle de módulo bajo
-- `script-src 'self'` sería un data: URI dentro del ESM o un fetch que la CSP bloquea.
--
-- Los tres son NOT NULL con `DEFAULT`: `commands/settings_update.sql` los liga siempre, y un hub
-- que aún no tenga fila la crea con estos valores.
ALTER TABLE kitchen_settings ALTER COLUMN auto_print_tickets SET DEFAULT 0;
ALTER TABLE kitchen_settings ADD COLUMN IF NOT EXISTS sound_volume INTEGER NOT NULL DEFAULT 70;
ALTER TABLE kitchen_settings ADD COLUMN IF NOT EXISTS sound_tone TEXT NOT NULL DEFAULT 'chime';
