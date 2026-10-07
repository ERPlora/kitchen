# WORKFLOW — Cocina · El cierre de la cuenta y los otros módulos

Prefijo: KITCHEN

Lo que Cocina hace cuando otro módulo le avisa (una cuenta cobrada, dos clientes unidos) y lo que
no hace porque nadie le avisa (una cuenta eliminada o unida, un plato anulado). Cocina solo escucha
tres avisos de fuera: ronda enviada, cuenta cerrada y fichas de cliente unidas.

## Flujos

### KITCHEN-F27 Cerrar las rondas al cobrar la cuenta entera
Estado: hecho
Actor: sistema
Pantalla: ninguna
Pasos:
1. El cajero cobra la cuenta entera en el TPV; un cobro parcial no cuenta. Si había artículos sin enviar, el TPV los envía antes de cobrar, como una ronda más.
2. Ventas avisa de que la cuenta se cerró.
3. Cocina toma las rondas de esa cuenta: las Listas pasan a Servidas y salen de la pantalla de cocina. Las Por preparar y En preparación **no se tocan**: cobrar no para la cocina (como Toast, Square y Lightspeed); siguen en la pantalla y en el «Resumen» hasta que el pase las marca Servidas (KITCHEN-F13). Las Servidas y las Canceladas no se tocan.
4. Salvo lo que nadie va a marcar en una pantalla, que al cobrar pasa a Servida con sus platos tachados como Listos, y sale de la pantalla, del «Resumen», del «En curso» de su estación y de «Comandas sin servir» del cierre de caja (kitchen#153):
   - en un local que cocina solo con la comanda en papel («La cocina trabaja con la pantalla» apagado en Cocina → Ajustes, KITCHEN-F26), todas las rondas Por preparar y En preparación de la cuenta;
   - con el ajuste encendido, la ronda cuyos platos fueron todos a estaciones solo de impresora (la barra en papel). Una ronda con algún plato en una estación con pantalla sigue cocinando como en el paso 3.
   Nunca se cancela nada al cobrar. Apagar el ajuste vale desde el siguiente cobro: lo cobrado antes se sirve a mano, comanda a comanda (KITCHEN-F13, KITCHEN-F21); vaciarlo de golpe no existe (kitchen#158).
5. En «pide y paga» (barra, mostrador), la ronda que el TPV envía en el mismo gesto del cobro llega a cocina «Por preparar» y se cocina (si fue entera a la barra en papel, o el local cocina en papel, sale servida en cuanto llegan los dos avisos); da igual en qué orden lleguen los dos avisos: si el cierre llega antes que la ronda, no encuentra nada que cerrar y la ronda nace después igual que siempre.
6. Si una mesa paga antes de terminar, lo que se está cocinando sigue en la pantalla. Si esa comida ya no se debe hacer (el cliente se fue), un responsable la cancela a mano (KITCHEN-F22).
7. En una cuenta dividida, cobrar la original no toca lo que se cocina, tampoco las rondas de los platos que pasaron a la cuenta nueva; sus rondas Listas sí pasan a Servidas.
Entra: de Ventas, la cuenta cerrada (avisa: order.completed), que sale una sola vez, con el cobro final.
Sale: cada ronda Lista, y cada una de las del paso 4, pasa a Servida (avisa: kitchen.order.served) con su entrada en el Historial; los platos de las del paso 4 quedan Listos. Nada vuelve al TPV. Solo se tocan las rondas de la cuenta cobrada; las comandas creadas a mano no se cierran nunca al cobrar. Lo que sigue en marcha sale en la revisión del cierre de caja (KITCHEN-F31).
Si falla: si una ronda cambia de estado justo entre que se lee y se escribe (una Lista que se recupera, una Por preparar que se marca), el cierre se rechaza entero y el aviso se reintenta con el estado nuevo; un aviso repetido de la misma cuenta no cambia nada. Si no se pueden leer los ajustes, Cocina trabaja como con la pantalla encendida: de lo que se está cocinando solo se sirve la ronda que fue entera a estaciones solo de impresora.
Implicados: SALES-F01, SALES-F20, SALES-F22, SALES-F23, REC_RESTAURANTE-F10, REC_RESTAURANTE-F11, REC_RESTAURANTE-F17
QA: R-09, R-10, qa-hub-restaurant §7.10

### KITCHEN-F28 Retirar las rondas de una cuenta eliminada o unida a otra
Estado: no hecho — Cocina no se entera de que una cuenta se elimina ni de que se une a otra: las rondas enviadas desde ella siguen en la pantalla de cocina, y como el cobro solo cierra las rondas de la cuenta cobrada, las de la cuenta eliminada o absorbida no se cierran nunca solas
Actor: sistema
Pantalla: ninguna
Pasos:
1. Un responsable elimina una cuenta abierta que ya envió rondas (SALES-F18), o se juntan dos mesas y una cuenta absorbe a la otra (SALES-F24).
2. Hoy, las rondas de esa cuenta siguen en la pantalla de cocina con su reloj y en el TPV ya no hay cuenta desde la que verlas; al cobrar la cuenta que queda tampoco se cierran.
3. Hoy se quitan a mano desde Cocina: «Servida» o «Cancelar» (KITCHEN-F13, KITCHEN-F22). Lo que falta es que Cocina reciba el aviso y las retire o las pase a la cuenta que queda (ver «Dudas abiertas»).
Entra: nada. Ventas avisa de la cuenta eliminada (sales.order.voided) y Cocina no escucha ese aviso; al juntar cuentas no avisa a nadie.
Sale: nada; las rondas quedan vivas y salen en la revisión del cierre de caja como sin servir (KITCHEN-F31).
Si falla: nadie lo dice; se ve en la pantalla de cocina y en el cierre de caja.
Implicados: SALES-F18, SALES-F24, REC_RESTAURANTE-F10, REC_RESTAURANTE-F14
QA: R-07, qa-hub-restaurant §7.09, qa-hub-restaurant §7.13

### KITCHEN-F29 Anular un plato ya enviado con aviso a cocina
Estado: no hecho — en el TPV una línea enviada no se puede quitar ni cambiar (pedir que se quite, por el asistente o la API, contesta bien sin quitar nada), y Cocina no tiene orden para anular un solo plato ni escucha la retirada de una línea: el plato se sigue cocinando y se cobra
Actor: responsable
Pantalla: Ventas: Vender
Pasos:
1. En el TPV, sobre una línea ya enviada, el responsable la anula con un motivo (no existe).
2. En la pantalla de cocina, ese plato sale tachado como anulado y su estación recibe un vale de anulación en papel (no existe).
3. Hoy solo se puede cancelar la ronda entera desde Cocina (KITCHEN-F22), que no cambia la cuenta, o avisar de palabra.
Entra: la línea anulada y su motivo, de Ventas.
Sale: el plato anulado en cocina y el vale en papel por la función de su estación.
Si falla: igual que la comanda en papel (KITCHEN-F08).
Implicados: SALES-F20, REC_RESTAURANTE-F14
QA: R-11, qa-hub-restaurant §7.08, qa-hub-restaurant §7.13

### KITCHEN-F30 Pasar las comandas de un cliente unido a otro
Estado: hecho
Actor: sistema
Pantalla: ninguna
Pasos:
1. En Clientes se unen dos fichas de la misma persona (CUSTOMERS-F13).
2. Cocina pasa a la ficha que queda todas las comandas de la ficha absorbida, en cualquier estado y también las retiradas, solo en este hub.
3. Nada más cambia en la comanda.
Entra: de Clientes, las fichas unidas (avisa: customer.merged): la que queda y la absorbida.
Sale: nada visible: ninguna pantalla de Cocina enseña el cliente, y las rondas del TPV no lo llevan (solo las comandas antiguas o creadas por la API). No avisa a nadie.
Si falla: un aviso repetido no cambia nada; sin comandas de ese cliente no hace nada. Sin Clientes instalado el aviso no llega nunca.
Implicados: CUSTOMERS-F13
QA: ninguno

### KITCHEN-F31 Dar a Caja las comandas que siguen en marcha
Estado: hecho
Actor: sistema
Pantalla: ninguna
Pasos:
1. Al abrir el cierre de caja, Caja pregunta a Cocina qué comandas siguen en marcha.
2. Cocina devuelve las comandas Por preparar, En preparación y Listas con su etiqueta, su número y sus platos, las mismas que pinta la pantalla de cocina.
3. Caja avisa de las comandas sin servir antes de cerrar (CASH_REGISTER-F08).
Entra: la consulta de Caja, con el permiso de ver comandas de quien cierra.
Sale: la lista; no cambia nada.
Si falla: si Cocina no está o no responde, Caja dice que la revisión puede estar incompleta.
Implicados: CASH_REGISTER-F08, REC_RESTAURANTE-F16
QA: R-10, qa-hub-restaurant §7.14
