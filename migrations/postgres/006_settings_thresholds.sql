-- kitchen#41 — el semáforo del KDS necesita que sus dos umbrales estén ORDENADOS.
--
-- `warning_time_minutes` y `critical_time_minutes` son los dos escalones del color de la comanda:
-- ámbar al pasar el primero, rojo al pasar el segundo. Con `critical <= warning` el escalón ámbar
-- no existe —la comanda salta de normal a roja, o nace roja— y el cocinero pierde justo la señal
-- que le pedía darse prisa ANTES de que sea tarde. Los dos valores pasan por su `minimum`/`maximum`
-- del JSON Schema y ninguno de los dos es inválido por su cuenta: lo inválido es la PAREJA, y una
-- relación entre dos campos es exactamente lo que JSON Schema no sabe expresar. Por eso baja aquí,
-- que es la segunda puerta (mismo reparto que `min_price <= max_price` en `services`, services#9).
--
-- `NOT VALID`: no se revalidan las filas que ya existen. Un hub con los umbrales cruzados sigue
-- arrancando y solo se le exige la regla cuando VUELVA a guardar sus ajustes — una migración no es
-- sitio para tumbar el arranque de un hub por un dato viejo.
ALTER TABLE kitchen_settings
  ADD CONSTRAINT ck_kitchen_settings_thresholds
  CHECK (warning_time_minutes < critical_time_minutes) NOT VALID;
