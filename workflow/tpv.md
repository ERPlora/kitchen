# WORKFLOW — Cocina · En el TPV

Prefijo: KITCHEN

Las dos piezas que Cocina pone en la pantalla de venta (solo si Cocina está instalada y activa): el
botón de enviar la ronda y la hoja con las comandas de la cuenta. La pantalla, la cuenta y el envío
son de Ventas; el botón, su urgencia y la hoja son de Cocina.

## Flujos

### KITCHEN-F18 Enviar la ronda desde el TPV, normal o urgente
Estado: hecho
Actor: cajero, empleado, responsable
Pantalla: Ventas: Vender
Pasos:
1. En la pestaña «Comanda actual» del TPV, el botón «Enviar comanda» lleva un globo con cuántos artículos faltan por enviar; sin nada pendiente está apagado.
2. Si la ronda tiene prisa, toca antes la llama de al lado («Ronda urgente»): se pone roja y el botón pasa a «Enviar URGENTE».
3. Pulsa el botón: Ventas envía lo pendiente (SALES-F20) y Cocina abre la comanda (KITCHEN-F05), urgente si estaba armada.
4. La urgencia se apaga sola al enviar y al cambiar de cuenta: vale para una sola ronda.
Entra: lo que cuenta Ventas de la cuenta abierta: cuántos artículos faltan por enviar.
Sale: la petición de envío a Ventas, con la prioridad urgente si se armó; el botón no envía platos por su cuenta. Una ronda que nace urgente lleva `!! URGENTE !!` en su papel y no recibe aviso aparte.
Si falla: lo dice Ventas («No se pudo enviar a cocina») y los artículos siguen pendientes; la urgencia armada se apaga igual al pulsar, así que hay que volver a armarla. Sin Cocina activa, el botón no aparece en el TPV, y el TPV solo descubre Cocina al abrirse: tras activarla o desactivarla hay que salir y volver a entrar (leído en el código de Ventas).
Implicados: SALES-F20, REC_RESTAURANTE-F07
QA: R-05, R-06, qa-hub-restaurant §7.08

### KITCHEN-F19 Seguir las comandas de la cuenta desde el TPV
Estado: parcial — la hora de cada ronda no es la de envío sino la de llegada a cocina o, desde que cocina la toca, la de inicio, y sale en hora UTC: en España, 1 o 2 horas por detrás (leído en el código, sin ejecutar)
Actor: cajero, empleado, responsable
Pantalla: Comandas de la cuenta
Pasos:
1. En el TPV, con una cuenta que ya envió algo, toca «Comandas · N» en la cabecera de lo enviado.
2. Se abre «Comandas de la cuenta»: una tarjeta por ronda, la más reciente primero, con «Comanda N», una hora (la de llegada a cocina; desde que cocina la empieza, la de inicio; en UTC), su estado y sus platos.
3. El estado cambia solo cuando cocina mueve la ronda («Por preparar», «En preparación», «Lista», «Servida», «Cancelada»), sin tocar nada.
4. Cierra con ✕ o tocando fuera.
Entra: las comandas de Cocina de esa cuenta y sus platos.
Sale: nada; solo enseña.
Si falla: si la lista no carga, el botón no aparece; si los platos de una ronda no cargan, la tarjeta sale sin platos. La hora se corta del texto guardado, que está en UTC, sin pasarla a la hora local: en España sale 1 o 2 horas por detrás.
Implicados: SALES-F20, REC_RESTAURANTE-F08
QA: qa-hub-restaurant §7.08

### KITCHEN-F20 Marcar urgente una ronda desde el TPV
Estado: hecho
Actor: empleado, responsable
Pantalla: Comandas de la cuenta
Pasos:
1. Cuando la mesa pide prisa, abre «Comandas de la cuenta» (KITCHEN-F19).
2. En una ronda que aún se cocina, pulsa «Marcar urgente»: la ronda lleva «Urgente».
3. En la pantalla de cocina salta al principio y suena (KITCHEN-F14); las estaciones que imprimen y aún tienen platos de esa ronda reciben el aviso corto `!! URGENTE !!` sin platos.
4. «Quitar urgente» lo deshace y no imprime nada. El botón solo sale en rondas Por preparar o En preparación, normales o urgentes; las Listas, Servidas, Canceladas o VIP no lo ofrecen. Esa restricción la pone la pantalla, no el servidor.
Entra: la ronda elegida.
Sale: la ronda urgente (avisa: kitchen.order.updated) y el aviso en papel; con una pantalla de cocina abierta también, sale un solo aviso por impresora cuando imprimen a través de la cola del hub (con impresora propia en cada dispositivo, sin confirmar en un hub).
Si falla: el rechazo sale arriba de la hoja («No se pudo actualizar el estado», o el motivo traducido si lo hay) y la ronda se recarga. El servidor no comprueba el estado de la ronda: una ronda que cocina acaba de marcar lista o servida en otra pantalla se marca urgente igual. Si el aviso no se imprime, «No se ha podido imprimir el aviso de urgencia. Avisa a cocina de viva voz y revisa su impresora.». El cajero no tiene el botón.
Implicados: REC_RESTAURANTE-F08, HUB-F190, HUB-F192, HUB-F193, HUB_SHELL-F77
QA: qa-hub-restaurant §7.08
