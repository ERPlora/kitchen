-- ADR-0147 §2.1 — `kitchen_order_item.quantity` pasa a punto fijo ENTERO de escala GLOBAL 10⁶
-- («500000» = 0,5 raciones). La frontera del cable ya hablaba µ (v2.2.12); esta migración
-- elimina el residuo transitorio: el handler persistía el LÓGICO en f64 («0.5») porque la
-- columna seguía fraccionaria. EL DINERO NO SE TOCA (unit_price/total en céntimos, ADR-0123).
--
-- Sin ventana mixta: el handler siempre guardó lógico (entero o fraccional), nunca µ →
-- reescalado ciego ×10⁶. La afinidad de la columna es INTEGER (001), así que basta el UPDATE;
-- los valores fraccionales (0.5) que la afinidad dejó pasar quedan enteros al redondear.
UPDATE kitchen_order_item SET quantity = CAST(ROUND(quantity * 1000000) AS INTEGER);
