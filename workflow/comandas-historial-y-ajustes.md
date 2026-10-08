# WORKFLOW — Cocina · Comandas, historial y ajustes

Prefijo: KITCHEN

La parte de oficina de Cocina: la lista de todas las comandas para moverlas, cancelarlas o crear una
a mano, el historial de lo que pasó y los ajustes de la pantalla.

## Flujos

### KITCHEN-F21 Mover una comanda desde la lista de Comandas
Estado: parcial — «Lista» desde la lista cambia la comanda pero no sus platos: en la pantalla de cocina sale en «Listas» con los platos sin tachar, siguen contando en «En curso» de su estación y, si después se entrega o se cobra, esos platos se quedan por hacer para siempre e impiden eliminar la estación (leído en el código, sin ejecutar)
Actor: empleado, responsable
Pantalla: Comandas
Pasos:
1. En **Cocina → Comandas**, busca la comanda por número o destino, o filtra por estado.
2. Usa la acción de su fila: «Lanzar» (Por preparar → En preparación, con sus platos), «Lista» (→ Lista), «Recuperar» (Lista → En preparación; sus platos listos vuelven a por hacer) o «Servida» (Lista → Servida). Solo se encienden las que el estado admite.
3. La fila cambia de estado; la pantalla de cocina y el TPV se actualizan solos.
Entra: la comanda elegida.
Sale: el nuevo estado (avisa: kitchen.order.fired, kitchen.order.ready, kitchen.order.recalled o kitchen.order.served) y su entrada en el Historial («Lanzadas», «Listas (bump)», «Recuperadas», «Servidas»). «Lanzar» pone el reloj de la tarjeta a cero (KITCHEN-F10). Con el pase encendido, «Lista» lo imprime (KITCHEN-F17).
Si falla: si la comanda cambió en otra pantalla, «Esa comanda ya no está en el estado que requiere esta acción. Actualiza e inténtalo de nuevo.» encima de la tabla y la fila se recarga. Cada acción solo sale a quien tiene su permiso: el cajero no ve ninguna.
Implicados: ninguno
QA: R-05

### KITCHEN-F22 Cancelar una comanda
Estado: parcial — solo se cancela desde la lista de Comandas, sin confirmación y sin pedir motivo (el motivo solo se puede dar por el asistente o la API); la pantalla de cocina no ofrece cancelar, y cancelar en cocina no cambia nada en la cuenta del TPV
Actor: responsable
Pantalla: Comandas
Pasos:
1. En la fila de la comanda, pulsa «Cancelar» (en rojo).
2. Sin pregunta previa, la comanda y todos sus platos pasan a «Cancelada» (un plato que el TPV ya anuló sigue diciendo «Anulado», KITCHEN-F29).
3. Desaparece de la pantalla de cocina y del «Resumen»; en el TPV la ronda sale «Cancelada».
4. Si la ronda salió en papel, la pantalla que la canceló saca en la misma impresora de cada estación un vale de anulación («ANULADA · Mesa 4», los platos en negativo); si no sale, avisa de que hay que decirlo de viva voz (HUB_SHELL-F78, kitchen#168).
Entra: la comanda Por preparar, En preparación o Lista.
Sale: la comanda cancelada (avisa: kitchen.order.cancelled) y «Canceladas» en el Historial, con el motivo en Notas si se dio (en la comanda se guarda con el prefijo fijo en inglés `Cancelled: `). Con ese aviso el hub imprime el vale de anulación (HUB_SHELL-F78). Ventas no se entera: la cuenta sigue con esos platos enviados y se cobran.
Si falla: una comanda Servida o ya Cancelada no se cancela (botón apagado; si la fila estaba vieja, el mensaje de estado y la recarga). Empleado y cajero no tienen el botón.
Implicados: REC_RESTAURANTE-F14, HUB_SHELL-F78
QA: qa-hub-restaurant §7.13

### KITCHEN-F23 Crear una comanda a mano
Estado: parcial — el panel solo pide tipo y notas: la comanda nace sin platos, en la pantalla de cocina sale como una tarjeta vacía (solo en «Todas») que no se puede marcar lista desde allí, y no hay forma de añadirle platos en pantalla (solo por el asistente o la API)
Actor: cajero, empleado, responsable
Pantalla: Comandas
Pasos:
1. En **Cocina → Comandas**, pulsa «Nueva comanda»: se abre el panel (a pantalla completa en el móvil).
2. Elige el Tipo (empieza en el «Tipo de comanda por defecto» de Ajustes; si no se puede leer, «En sala») y, si quieres, escribe unas Notas «(opcional)».
3. Pulsa «Crear comanda» («Creando…» mientras guarda).
4. El panel se cierra y la lista vuelve a la primera página, con la comanda nueva arriba; la búsqueda y los filtros se mantienen.
Entra: el tipo y las notas.
Sale: una comanda Por preparar con número del día y ronda 1, sin pedido ni etiqueta (avisa: kitchen.order.created; no sale papel porque no tiene platos) y «Recibidas» en el Historial. Como no cuelga de ninguna cuenta, cobrar no la cierra: se mueve desde la lista (KITCHEN-F21) o se cancela (KITCHEN-F22).
Si falla: el rechazo sale dentro del panel, encima de su botón («No se pudo crear la comanda» si el servidor no da motivo); la lista no se mueve.
Implicados: ninguno
QA: ninguno

### KITCHEN-F24 Borrar una comanda
Estado: parcial — solo por el asistente o la API (no hay botón), y cuando la comanda no se puede borrar la orden contesta bien, no borra nada y avisa igual de que se borró
Actor: responsable
Pantalla: asistente
Pasos:
1. Pide al asistente que borre la comanda.
2. Si está Por preparar o Cancelada y no va ligada a una venta, se retira (no se borra de verdad) y desaparece de las pantallas.
3. Si no cumple eso, no cambia nada, pero la respuesta es la misma.
Entra: la comanda.
Sale: la comanda retirada (avisa: kitchen.order.deleted, siempre). El borrado no se apunta en el Historial; las entradas anteriores de esa comanda conservan su número. Las rondas que llegan del TPV no van ligadas a una venta, así que una ronda Por preparar se puede borrar mientras la cuenta del TPV la sigue dando por enviada.
Si falla: no se distingue un borrado de un no-borrado.
Implicados: ninguno
QA: ninguno

### KITCHEN-F25 Consultar el historial de cocina
Estado: parcial — no enseña quién hizo cada acción, ni la estación ni el plato de una «Línea lista»; los cambios de urgencia y los borrados no se apuntan; y el cajero ve la pestaña pero no puede abrir la lista
Actor: empleado, responsable, administrador
Pantalla: Historial
Pasos:
1. Abre **Cocina → Historial**.
2. Cada fila dice qué pasó (Acción), en qué comanda (su número), sus Notas y Cuándo, lo último primero.
3. Busca por número de comanda o por notas; filtra por acción o por fechas.
4. La lista se recarga sola con cada cambio de cocina; como la entrada la apunta Cocina justo después, la última acción puede no salir hasta la siguiente recarga (sin confirmar).
Entra: las entradas que Cocina apunta sola tras cada cambio: llegada, empezar, plato listo, recuperado o anulado en el TPV (KITCHEN-F29, con el motivo en Notas), lista, recuperada, servida y cancelada (también las «Servidas» que apunta el cobro, KITCHEN-F27).
Sale: nada; solo enseña. Apuntar algo a mano solo se puede por la API, con el permiso del responsable.
Si falla: el error de la tabla con reintento; sin entradas, «Sin actividad reciente en cocina.».
Implicados: ninguno
QA: ninguno

### KITCHEN-F26 Ajustar la pantalla de cocina
Estado: hecho
Actor: responsable, administrador
Pantalla: Ajustes
Pasos:
1. Abre **Cocina → Ajustes** (la pestaña solo sale a quien tiene el permiso de ajustes; al empleado no, HUB_SHELL-F43, hub#2588). Quien la ve, la guarda: de fábrica, el administrador y el responsable, igual desde la pestaña que por el asistente (HUB_SHELL-F44, ERPlora/hub#2621).
2. Cambia lo que haga falta: «Mostrar cronómetro», «Aviso ámbar (minutos)» (15 de fábrica), «Aviso rojo (minutos)» (30), «Semáforo de color», «Sonar al entrar una comanda», «Volumen del sonido (0-100)» (70), «Tono del sonido» («Campanilla» de fábrica, «Timbre» o «Zumbador»), «Imprimir el pase al marcar listo» (apagado), «La cocina trabaja con la pantalla» (encendido; se apaga si en la cocina nadie marca nada en la pantalla y se cocina solo con la comanda en papel) y «Tipo de comanda por defecto» («En sala» de fábrica, «Para llevar» o «A domicilio»). Cada opción sale con su nombre en el idioma de la persona, el mismo que usan la pantalla y la lista de Comandas (kitchen#159); lo que se guarda es su valor interno (`chime`, `dine_in`…).
3. Pulsa «Guardar»: sale «Ajustes guardados.».
4. Las pantallas de cocina abiertas toman los ajustes nuevos al momento.
Entra: los valores del formulario.
Sale: los ajustes del hub (el primer guardado crea la fila) (avisa: kitchen.settings.updated). Mueven el reloj y el semáforo (KITCHEN-F10), el sonido (KITCHEN-F16), el pase (KITCHEN-F17) y qué rondas cierra el cobro (KITCHEN-F27, desde el siguiente cobro: lo ya cobrado no cambia); el tipo por defecto solo abre «Nueva comanda» (KITCHEN-F23), no cambia las rondas del TPV.
Si falla: «No se pudieron guardar los ajustes.» y el motivo bajo el formulario. Si con la pestaña abierta entra otra persona sin el permiso (relevo de turno), los campos se bloquean, desaparece «Guardar» y sale «No tienes permiso para cambiar estos ajustes. Pídeselo a un administrador si lo necesitas.» (HUB_SHELL-F44). Minutos fuera de 1–120 o volumen fuera de 0–100 se rechazan; un aviso ámbar igual o mayor que el rojo también (texto exacto sin confirmar). Si una pantalla de cocina no puede leer los ajustes, usa los de fábrica.
Implicados: HUB-F33, HUB_SHELL-F43, HUB_SHELL-F44
QA: qa-hub-restaurant §7.08
