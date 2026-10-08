# WORKFLOW — Cocina · La pantalla de cocina

Prefijo: KITCHEN

El tablero que cuelga en la pared de la cocina o de la barra: qué se ve, cómo se marca lo que está
hecho, cómo se deshace un error y cómo se entrega. Ninguna acción de esta pantalla pide
confirmación: recuperar es el deshacer.

## Flujos

### KITCHEN-F10 Ver el tablero de cocina
Estado: parcial — el reloj de cada comanda cuenta desde que llega, pero vuelve a cero la primera vez que cocina la toca (marca un plato o «Lanzar»), así que el semáforo deja de medir la espera real (leído en el código, sin ejecutar); y mientras carga no se ve ningún indicador
Actor: empleado, responsable
Pantalla: Pantalla
Pasos:
1. Abre **Cocina → Pantalla**. En una tableta, pulsa «Pantalla completa»: el hub esconde su menú y sus barras («Salir de pantalla completa» las devuelve).
2. En la vista «Comandas» están las que se cocinan: primero las urgentes, después las VIP y después el resto, la más antigua primero dentro de cada grupo.
3. Si hay platos de más de una estación, elige la tuya: «Todas» enseña todos los platos (el pase); una estación enseña solo sus platos y solo las comandas que tienen algo suyo; «Sin estación», los platos sin enrutar.
4. Un plato que el TPV anuló después de enviarlo sale tachado con «Anulado» y el motivo, y no se toca (KITCHEN-F29).
5. Lee cada tarjeta: el borde verde pasa a ámbar al llegar a «Aviso ámbar (minutos)» y a rojo al llegar a «Aviso rojo (minutos)»; el reloj sigue contando en rojo. Sin «Semáforo de color» el borde queda gris; sin «Mostrar cronómetro» no hay reloj.
6. La pantalla se actualiza sola con cada cambio de cocina, sin recargar; los contadores de «Comandas» y «Listas» dicen cuántas hay en cada vista.
Entra: las comandas Por preparar, En preparación y Listas con sus platos; los ajustes de la pantalla; los nombres vivos de las estaciones; los nombres de las personas del hub y, si está instalado, del Equipo.
Sale: nada; la pantalla solo enseña.
Si falla: «No se pudo cargar la pantalla de cocina» (o el motivo) encima del tablero. Si no cargan las personas, la tarjeta no pone camarero (nunca un código). Si no cargan las estaciones, sale el nombre con que se envió cada plato. Sin el permiso de cambiar comandas (cajero) la pantalla es de solo mirar: sin botones y los platos no responden. La estación elegida no se recuerda: al volver a abrir la pantalla sale «Todas».
Implicados: STAFF-F09, REC_RESTAURANTE-F07, HUB-F158, HUB_SHELL-F18, HUB_SHELL-F80
QA: R-05, BD-08 (discrepa), qa-hub-restaurant §7.08, qa-hub-restaurant §7.17

### KITCHEN-F11 Marcar platos listos
Estado: hecho
Actor: empleado, responsable
Pantalla: Pantalla
Pasos:
1. Toca un plato cuando esté hecho: se tacha con ✓.
2. O toca la cabecera de la tarjeta, o «Listo»: se marcan todos los platos de esa tarjeta que se ven en tu pantalla y siguen por hacer (en una estación, solo los suyos; nunca los de otra).
3. En un menú, tocar su cabecera marca sus platos de tu pantalla y nada más.
4. El primer plato marcado pasa la comanda a «En preparación». Cuando ya no queda ningún plato por hacer, de ninguna estación, la comanda pasa a «Lista»: sale de «Comandas» y aparece en «Listas». Mientras falten platos de otra estación, la tarjeta se queda en tu pantalla con lo tuyo tachado.
Entra: los platos de la tarjeta que se ven en la pantalla.
Sale: cada plato queda listo (avisa: kitchen.item.bumped), la comanda empieza (kitchen.order.fired) o queda lista (kitchen.order.ready); el Historial apunta «Línea lista», «Lanzadas» y «Listas (bump)»; el TPV ve la ronda como «Lista»; con el pase encendido sale en papel (KITCHEN-F17).
Si falla: si la comanda cambió en otra pantalla, sale «Esa comanda ya no está en el estado que requiere esta acción. Actualiza e inténtalo de nuevo.» y el tablero se recarga. Un plato de una comanda Servida o Cancelada no se mueve.
Implicados: FLOWS-F13, REC_RESTAURANTE-F07
QA: R-05, BD-08, qa-hub-restaurant §7.08

### KITCHEN-F12 Recuperar lo marcado por error
Estado: hecho
Actor: empleado, responsable
Pantalla: Pantalla
Pasos:
1. Toca un plato tachado: vuelve a estar por hacer.
2. O pulsa «Recuperar» en la tarjeta: vuelven todos los platos tachados que se ven en tu pantalla.
3. Una comanda que ya estaba en «Listas» se recupera desde esa vista con «Recuperar»: vuelve a «En preparación» y a la vista «Comandas».
Entra: los platos tachados de la tarjeta.
Sale: cada plato vuelve a por hacer (avisa: kitchen.item.recalled) y, si la comanda estaba Lista, vuelve a En preparación (kitchen.order.recalled); el Historial apunta «Línea recuperada» y «Recuperadas».
Si falla: una comanda Servida o Cancelada no se recupera; el error y la recarga, como en KITCHEN-F11.
Implicados: ninguno
QA: R-05, BD-08, qa-hub-restaurant §7.08

### KITCHEN-F13 Entregar lo que está listo
Estado: hecho
Actor: empleado, responsable
Pantalla: Pantalla
Pasos:
1. Abre la vista «Listas»: las comandas terminadas que esperan a que alguien las recoja, la más antigua primero.
2. Cuando sale el plato, pulsa «Servida» en su tarjeta.
3. La tarjeta desaparece de la pantalla y en el TPV la ronda pasa a «Servida».
Entra: la comanda Lista.
Sale: la comanda Servida (avisa: kitchen.order.served) y «Servidas» en el Historial. Marcarla no es obligatorio: al cobrar la cuenta entera, las Listas pasan solas a Servidas (KITCHEN-F27).
Si falla: solo una comanda Lista se puede entregar; el cajero no tiene el botón.
Implicados: REC_RESTAURANTE-F08
QA: R-06, qa-hub-restaurant §7.09

### KITCHEN-F14 Marcar urgente una ronda desde la pantalla de cocina
Estado: hecho
Actor: empleado, responsable
Pantalla: Pantalla
Pasos:
1. En una tarjeta que se está cocinando, pulsa «Marcar urgente».
2. La tarjeta lleva «Urgente» y salta al principio del tablero en todas las pantallas; las que ya la tenían suenan una vez (con el sonido encendido).
3. Las estaciones que imprimen y aún tienen platos de esa ronda por hacer reciben un aviso corto en papel: la cabecera de la comanda con `!! URGENTE !!` y sin platos, para no cocinar dos veces.
4. «Quitar urgente» lo deshace y no imprime nada. Una ronda VIP no ofrece el botón.
Entra: la comanda que se cocina.
Sale: la ronda urgente (avisa: kitchen.order.updated). Cada paso a urgente da un aviso nuevo (marcar, quitar y volver a marcar imprime otra vez); con varias pantallas abiertas sale un solo aviso por impresora cuando imprimen a través de la cola del hub; si varias pantallas tienen su propia impresora con esa función, cada una puede sacar el suyo (sin confirmar en un hub). El cambio no queda en el Historial.
Si falla: un rechazo sale encima del tablero. Que solo se ofrezca en rondas que se cocinan, normales o urgentes, lo pone la pantalla: el servidor no mira el estado, y por el asistente o la API se puede marcar urgente una ronda servida o cancelada. Si el aviso no se imprime, «No se ha podido imprimir el aviso de urgencia. Avisa a cocina de viva voz y revisa su impresora.» se queda hasta que otro aviso salga bien.
Implicados: HUB-F190, HUB-F192, HUB-F193, HUB_SHELL-F77
QA: qa-hub-restaurant §7.08

### KITCHEN-F15 Ver cuánto queda por cocinar
Estado: hecho
Actor: empleado, responsable
Pantalla: Pantalla
Pasos:
1. Pulsa la vista «Resumen».
2. Sale una tabla con cada producto y la cantidad que falta por hacer sumando todas las comandas que se cocinan, de más a menos; en «Todas», con su estación al lado.
3. Con una estación elegida, solo lo suyo.
4. Un plato marcado listo deja de contar en cuanto se marca.
Entra: los platos por hacer de las comandas Por preparar y En preparación.
Sale: nada; solo enseña.
Si falla: sin nada por hacer, «No queda nada por cocinar.».
Implicados: ninguno
QA: qa-hub-restaurant §7.08

### KITCHEN-F16 Sonar al entrar una comanda
Estado: hecho
Actor: sistema
Pantalla: Pantalla
Pasos:
1. Con «Sonar al entrar una comanda» encendido, la pantalla suena cuando llega una comanda que no tenía o cuando una que ya tenía pasa a urgente.
2. Suena con el «Tono del sonido» y el «Volumen del sonido (0-100)» de Ajustes; si llegan varias a la vez, suena una vez.
3. Al abrir la pantalla no suena por lo que ya estaba; quitar la urgencia tampoco suena.
Entra: las comandas que trae cada recarga y los ajustes de sonido.
Sale: el sonido en el dispositivo; nada se guarda.
Si falla: si el navegador no deja sonar hasta que alguien toca la pantalla, ese aviso se pierde y la pantalla suena a partir del primer toque. Con el volumen a 0 no suena.
Implicados: ninguno
QA: qa-hub-restaurant §7.08

### KITCHEN-F17 Imprimir el pase al marcar lista
Estado: hecho
Actor: sistema
Pantalla: ninguna
Pasos:
1. Con «Imprimir el pase al marcar listo» encendido (apagado de fábrica), cada vez que una comanda pasa a Lista desde cualquier pantalla, sale el pase: la hoja que acompaña a la comida.
2. Sale una hoja por función de impresora con los platos de la comanda (los de estaciones solo de pantalla, no), con la etiqueta, el número, la ronda y el camarero.
Entra: la comanda que pasa a Lista, sus platos con su destino y su función de impresora.
Sale: una hoja por función; con varias pantallas de cocina abiertas, una sola cuando imprimen a través de la cola del hub; si varias pantallas tienen su propia impresora con esa función, cada una puede sacar la suya (sin confirmar en un hub).
Si falla: lo imprime la pantalla de cocina: si no hay ninguna abierta en ningún dispositivo, no sale. Si no sale, la pantalla enseña «No se ha podido imprimir el pase. Revisa la impresora de la estación.» hasta que otro pase salga bien. Una comanda recuperada y vuelta a marcar lista repite la clave del primer pase y la cola del hub lo descarta como repetido; por la impresora propia del dispositivo sale igual (leído en el código, sin ejecutar).
Implicados: HUB-F190, HUB-F192, HUB-F193, HUB_PERIPHERALS-F10, HUB_SHELL-F77
QA: qa-hub-restaurant §7.08
