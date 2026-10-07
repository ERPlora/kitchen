# WORKFLOW — Cocina

Prefijo: KITCHEN
Alcance MVP: restaurante

> Contrato de comportamiento del módulo (pm#620, pm#621). Se lee antes de tocar el código y se
> actualiza en la misma PR que cambie un comportamiento. El detalle técnico vive en
> `architecture/modules/kitchen.md`; aquí se escribe lo que ve y hace la persona. Lo marcado «leído
> en el código, sin ejecutar» está comprobado en `origin` pero no reproducido en un hub.

## Para qué sirve y para quién

Cocina recibe cada ronda que el camarero envía desde el TPV, antes de cobrar, y la convierte en una
comanda: la enseña en una pantalla de cocina legible a un metro (la «Pantalla»), reparte sus platos
entre estaciones (cocina, barra, postres…), deja que cada estación los marque listos y que el pase
los entregue, y guarda un historial de lo que se hizo. Desde el TPV, el camarero ve en qué va cada
ronda y puede meterle prisa. Lo usan el **empleado** de cocina o de sala (marca listo, recupera,
entrega, marca urgente), el **cajero** (envía rondas desde el TPV y ve su estado), el
**responsable** (además cancela comandas) y el **administrador** (crea estaciones, decide qué
producto va a cada una y guarda los ajustes). No sabe qué es una mesa ni un cliente: solo recibe
una etiqueta («Mesa 4»; sin mesa, la tarjeta sale «Para llevar») que pinta e imprime tal cual.

## Referencia adoptada

Contrastada en `.claude/agents/qa-hub-restaurant.md` §2 (10/08/2026) y en
`architecture/modules/kitchen.md` (decisiones por mercado del 15/08, 24/08 y 02/09/2026); se adopta
esto, no más:

- [Toast — flujo KDS](https://doc.toasttab.com/doc/platformguide/platformKDSWorkflowUsingCourses.html):
  estaciones de preparación, vista de pase (expo), marcar listo por plato y por comanda, «Rush».
  Los cursos con retener y lanzar no se adoptan (kitchen#71, fuera del MVP).
- [Toast — anulaciones](https://doc.toasttab.com/doc/platformguide/adminVoidingOrders.html): anular
  un plato ya enviado se ve en cocina. Adoptado como objetivo; el TPV ya lo anula con motivo, pero cocina aún no lo ve (KITCHEN-F29, kitchen#161).
- [Square KDS](https://squareup.com/help/us/en/article/8171-complete-orders-with-square-kds):
  completar un plato suelto o la comanda entera, y la pestaña de completadas.
- [Lightspeed K-Series KDS 2.0](https://k-series-support.lightspeedhq.com/hc/en-us/articles/22708154090267-Using-the-Kitchen-Display-System-2-0):
  cada toque hace avanzar el plato; semáforo de dos tiempos.
- [Odoo — pantalla de preparación](https://www.odoo.com/documentation/18.0/applications/sales/point_of_sale/preparation.html):
  la comanda pasa sola a la siguiente etapa cuando se tacha el último plato.
- De Toast, Fresh KDS y MobiPOS: imprimir el pase al marcar listo, apagado de fábrica; de siete
  KDS que suenan, un solo interruptor de sonido con volumen y tono de una lista cerrada.
- [Toast — estaciones de preparación](https://support.toasttab.com/en/article/Prep-Stations-Basics),
  [Lightspeed K — centros de producción](https://k-series-support.lightspeedhq.com/hc/articles/1260804658689)
  y la [pantalla de preparación de Odoo](https://www.odoo.com/documentation/19.0/applications/sales/point_of_sale/extra/preparation.html):
  lo que va solo a impresora no espera a que nadie lo marque en el KDS. Ningún TPV grande cierra al
  cobrar lo que se está cocinando en pantalla (LS Central y Simphony usan el pago como condición, no
  como disparador). Se adopta así: al cobrar sale lo que nadie va a marcar — la ronda que fue entera a
  estaciones solo de impresora y, en una cocina que trabaja en papel, todo (kitchen#153).

## Antes de empezar

- Al instalar Cocina se instalan con él **Ventas** e **Inventario**. **Mesas** y **Clientes** no
  hacen falta: sin Mesas, la comanda lleva la etiqueta que mande el TPV o el tipo de pedido.
- Cocina tiene que estar **activa** antes de enviar nada: si se envía con Cocina desactivada, Ventas
  marca los platos como enviados y no nace ninguna comanda (ver «Lo que NO hace»).
- Para que salga papel hace falta una impresora con la función «Cocina» dada de alta en un
  dispositivo (Impresión, PRINTING-F04). Toda estación imprime por la función «Cocina» salvo que se
  cambie por el asistente o la API (KITCHEN-F01).
- Los ajustes de la pantalla (tiempos, colores, sonido, pase en papel) solo los guarda un
  administrador (KITCHEN-F26).

Configuración inicial, paso a paso:

1. Abre **Cocina → Estaciones** y crea las estaciones reales (Plancha, Barra, Postres) (KITCHEN-F01).
2. En el panel «Enrutado producto/categoría → estación», manda cada categoría a su estación y los
   productos sueltos que deban ir a otra (KITCHEN-F04). Lo que no tenga estación sale en la pantalla
   bajo «Sin estación» y por la impresora de cocina.
3. En **Cocina → Ajustes**, ajusta los avisos ámbar y rojo, el sonido y, si se quiere, el pase en
   papel (KITCHEN-F26). Si en la cocina nadie va a marcar nada en la pantalla (se cocina solo con la
   comanda en papel), apaga «La cocina trabaja con la pantalla»: al cobrar, lo de la cuenta sale de la
   pantalla y de «Comandas sin servir» del cierre de caja (KITCHEN-F27).
4. En la tableta de la cocina abre **Cocina → Pantalla**, pulsa «Pantalla completa» y toca la
   pantalla una vez para que el navegador deje sonar el aviso (KITCHEN-F16).
5. Desde el TPV, envía una ronda de prueba y comprueba que cada plato sale en su estación
   (KITCHEN-F05, KITCHEN-F10).

## Pantallas

### Pantalla
Menú **Cocina → Pantalla**. El tablero de cocina (KDS). Una sola barra arriba, fija al desplazar: las
tres vistas con su contador («Comandas» y «Listas»; «Resumen» sin contador), el botón «Pantalla
completa» (solo si el hub lo ofrece) y, si en las comandas en marcha hay platos de más de una
estación, los botones de estación («Todas», cada estación por su nombre y «Sin estación»). Debajo, una
rejilla de tarjetas de columnas iguales (una sola en el móvil). Cada tarjeta: la etiqueta («Mesa 4»;
sin etiqueta, el tipo: «En sala», «Para llevar», «A domicilio»), «Camarero: <nombre>», las marcas
«Urgente», «VIP», «Ronda N» (desde la segunda) y «Lista», el reloj y el número corto «#0012»; los
platos con la cantidad grande, el nombre, los suplementos, la nota en cursiva y, en la vista
«Todas», la estación; un icono de impresora si la estación es solo de papel. Un menú sale con su
nombre en una cabecera discreta y sus platos sangrados debajo («N platos»). Al pie, según el
permiso y el estado: «Listo», «Marcar urgente» / «Quitar urgente», «Recuperar» y «Servida». El
borde superior de la tarjeta va en verde, ámbar o rojo según el tiempo. Vacía: «No hay comandas en
marcha.» (vista Comandas), «No hay nada esperando a recoger.» (Listas), «No queda nada por cocinar.»
(Resumen). Cargando: no hay indicador; hasta que llega la primera carga se ve el vacío. Error: «No se
pudo cargar la pantalla de cocina» (o el motivo del servidor) encima del tablero; un fallo de
impresión deja «No se ha podido imprimir el pase. Revisa la impresora de la estación.» o «No se ha
podido imprimir el aviso de urgencia. Avisa a cocina de viva voz y revisa su impresora.» hasta que
una impresión posterior salga bien. Se actualiza sola con cada cambio de cocina, sin recargar.

### Comandas
Menú **Cocina → Comandas**. Tabla de todas las comandas, la más nueva primero, 50 por página:
Comanda (número completo `AAAAMMDD-NNNN`), Destino (la etiqueta), Tipo, Prioridad, Estado y Total;
buscador «Buscar comanda o destino…» (busca por número y etiqueta), filtros por columna y vista
tabla o tarjetas. Acciones por fila, solo icono: «Lanzar», «Lista», «Servida», «Recuperar» y
«Cancelar»; solo salen las que el perfil puede hacer y se apagan las que el estado no admite. «Nueva
comanda» abre el panel lateral (a pantalla completa en el móvil) con Tipo, Notas y «Crear comanda».
Vacía: «Sin comandas.». Cargando: «Cargando…». Error de carga: el de la tabla con reintento; un
rechazo de una acción sale encima de la tabla y uno del alta, dentro del panel. No hay ficha de
detalle: tocar una fila no abre nada.

### Estaciones
Menú **Cocina → Estaciones**. Arriba, el panel «Enrutado producto/categoría → estación» (Estación,
Producto, Categoría, «Guardar enrutado») y, cuando se edita una, el panel «Editar estación · <nombre>»
(Nombre, Color, Impresora, «Activa», «Guardar», «Cancelar»). Debajo, la tabla: Estación, Impresora,
En curso (platos por hacer de esa estación) y Activa («Sí»/«No»); buscador «Buscar estación…»;
«Añadir estación» abre el panel lateral (Nombre con «p. ej. Plancha», Impresora «(opcional)», «Crear
estación»). Por fila: «Editar» (también tocando la fila), «Enrutar» (elige esa estación en el panel
de enrutado) y «Eliminar», que pregunta «¿Eliminar «<nombre>»?». Vacía: «Sin estaciones.». Cargando:
«Cargando…». Error: el de la tabla con reintento; cada rechazo sale dentro de su formulario, el de
«Eliminar» encima de la tabla. Todas las acciones se ven con cualquier perfil; el servidor solo deja
hacerlas al administrador.

### Historial
Menú **Cocina → Historial**, título «Historial de cocina». Tabla de lo que pasó en cocina, lo último
primero: Acción, Comanda (el número), Notas y Cuándo (fecha y hora locales). Buscador «Buscar comanda
o notas…»; filtro de acción con «Recibidas», «Lanzadas», «Listas (bump)», «Línea lista», «Línea
recuperada», «Servidas», «Recuperadas» y «Canceladas». Vacía: «Sin actividad reciente en cocina.».
Cargando: «Cargando…». Error: el de la tabla con reintento.

### Ajustes
Pestaña **Cocina → Ajustes**, la pone el hub con su formulario genérico:
«Mostrar cronómetro», «Aviso ámbar (minutos)», «Aviso rojo (minutos)», «Semáforo de color», «Sonar al
entrar una comanda», «Volumen del sonido (0-100)», «Tono del sonido», «Imprimir el pase al marcar
listo», «La cocina trabaja con la pantalla» y «Tipo de comanda por defecto», con «Guardar». Quien no es administrador la ve de solo
lectura con «Solo un administrador puede cambiar estos ajustes.». Cargando: «Cargando ajustes…».
Error: «No se pudieron cargar los ajustes.».

### Comandas de la cuenta
En el TPV (**Ventas → Vender**), con una cuenta que ya envió algo a cocina, Cocina pone el botón
«Comandas · N» en la cabecera de lo enviado. Al tocarlo se abre la hoja «Comandas de la cuenta»: una
tarjeta por ronda, la más reciente primero, con «Comanda N», una hora (la de llegada a cocina o,
desde que cocina la empieza, la de inicio; en UTC, 1 o 2 horas por detrás en España), el estado («Por
preparar», «En preparación», «Lista», «Servida», «Cancelada»), la marca «Urgente» si la tiene, sus
platos («2× Croquetas») y, mientras se cocina, «Marcar urgente» / «Quitar urgente». Se cierra con ✕
o tocando fuera. Sin rondas enviadas, el botón no aparece. Un rechazo sale arriba de la hoja; si el
aviso de urgencia no se imprime, «No se ha podido imprimir el aviso de urgencia. Avisa a cocina de
viva voz y revisa su impresora.».

En la pestaña «Comanda actual» del TPV, Cocina pone además el botón «Enviar comanda» con la llama de
urgencia al lado (KITCHEN-F18); la pantalla es de Ventas (SALES-F20).

## Flujos

El detalle de cada flujo (pasos, datos, fallos, implicados y QA) vive en `workflow/`, con la misma
gramática y el mismo prefijo. Huecos (`parcial`, `no hecho`): el porqué está en la línea `Estado:`.

| ID | Flujo | Estado | Fichero |
|---|---|---|---|
| KITCHEN-F01 | Crear una estación | parcial | [workflow/estaciones.md](workflow/estaciones.md) |
| KITCHEN-F02 | Editar, renombrar o desactivar una estación | parcial | [workflow/estaciones.md](workflow/estaciones.md) |
| KITCHEN-F03 | Eliminar una estación | hecho | [workflow/estaciones.md](workflow/estaciones.md) |
| KITCHEN-F04 | Mandar productos y categorías a una estación | parcial | [workflow/estaciones.md](workflow/estaciones.md) |
| KITCHEN-F05 | Recibir la ronda que envía el TPV | parcial | [workflow/llegada-de-la-comanda.md](workflow/llegada-de-la-comanda.md) |
| KITCHEN-F06 | Un menú del día en la comanda | parcial | [workflow/llegada-de-la-comanda.md](workflow/llegada-de-la-comanda.md) |
| KITCHEN-F07 | Suplementos y notas de cada plato | hecho | [workflow/llegada-de-la-comanda.md](workflow/llegada-de-la-comanda.md) |
| KITCHEN-F08 | La comanda sale en papel en cada estación | parcial | [workflow/llegada-de-la-comanda.md](workflow/llegada-de-la-comanda.md) |
| KITCHEN-F09 | Reimprimir una comanda | no hecho | [workflow/llegada-de-la-comanda.md](workflow/llegada-de-la-comanda.md) |
| KITCHEN-F10 | Ver el tablero de cocina | parcial | [workflow/pantalla-de-cocina.md](workflow/pantalla-de-cocina.md) |
| KITCHEN-F11 | Marcar platos listos | hecho | [workflow/pantalla-de-cocina.md](workflow/pantalla-de-cocina.md) |
| KITCHEN-F12 | Recuperar lo marcado por error | hecho | [workflow/pantalla-de-cocina.md](workflow/pantalla-de-cocina.md) |
| KITCHEN-F13 | Entregar lo que está listo | hecho | [workflow/pantalla-de-cocina.md](workflow/pantalla-de-cocina.md) |
| KITCHEN-F14 | Marcar urgente una ronda desde la pantalla de cocina | hecho | [workflow/pantalla-de-cocina.md](workflow/pantalla-de-cocina.md) |
| KITCHEN-F15 | Ver cuánto queda por cocinar | hecho | [workflow/pantalla-de-cocina.md](workflow/pantalla-de-cocina.md) |
| KITCHEN-F16 | Sonar al entrar una comanda | hecho | [workflow/pantalla-de-cocina.md](workflow/pantalla-de-cocina.md) |
| KITCHEN-F17 | Imprimir el pase al marcar lista | hecho | [workflow/pantalla-de-cocina.md](workflow/pantalla-de-cocina.md) |
| KITCHEN-F18 | Enviar la ronda desde el TPV, normal o urgente | hecho | [workflow/tpv.md](workflow/tpv.md) |
| KITCHEN-F19 | Seguir las comandas de la cuenta desde el TPV | parcial | [workflow/tpv.md](workflow/tpv.md) |
| KITCHEN-F20 | Marcar urgente una ronda desde el TPV | hecho | [workflow/tpv.md](workflow/tpv.md) |
| KITCHEN-F21 | Mover una comanda desde la lista de Comandas | parcial | [workflow/comandas-historial-y-ajustes.md](workflow/comandas-historial-y-ajustes.md) |
| KITCHEN-F22 | Cancelar una comanda | parcial | [workflow/comandas-historial-y-ajustes.md](workflow/comandas-historial-y-ajustes.md) |
| KITCHEN-F23 | Crear una comanda a mano | parcial | [workflow/comandas-historial-y-ajustes.md](workflow/comandas-historial-y-ajustes.md) |
| KITCHEN-F24 | Borrar una comanda | parcial | [workflow/comandas-historial-y-ajustes.md](workflow/comandas-historial-y-ajustes.md) |
| KITCHEN-F25 | Consultar el historial de cocina | parcial | [workflow/comandas-historial-y-ajustes.md](workflow/comandas-historial-y-ajustes.md) |
| KITCHEN-F26 | Ajustar la pantalla de cocina | parcial | [workflow/comandas-historial-y-ajustes.md](workflow/comandas-historial-y-ajustes.md) |
| KITCHEN-F27 | Cerrar las rondas al cobrar la cuenta entera | hecho | [workflow/cierre-y-otros-modulos.md](workflow/cierre-y-otros-modulos.md) |
| KITCHEN-F28 | Retirar las rondas de una cuenta eliminada o unida a otra | hecho | [workflow/cierre-y-otros-modulos.md](workflow/cierre-y-otros-modulos.md) |
| KITCHEN-F29 | Anular un plato ya enviado con aviso a cocina | parcial | [workflow/cierre-y-otros-modulos.md](workflow/cierre-y-otros-modulos.md) |
| KITCHEN-F30 | Pasar las comandas de un cliente unido a otro | hecho | [workflow/cierre-y-otros-modulos.md](workflow/cierre-y-otros-modulos.md) |
| KITCHEN-F31 | Dar a Caja las comandas que siguen en marcha | hecho | [workflow/cierre-y-otros-modulos.md](workflow/cierre-y-otros-modulos.md) |

## Cobertura contra la referencia

| Elemento | Estado | Flujo |
|---|---|---|
| La comanda nace al enviar, antes de cobrar; cada envío es una ronda numerada | parcial: una ronda de solo servicios se da por enviada y Cocina la rechaza sin aviso | F05, F18 |
| Tarjeta por comanda con mesa, camarero, ronda, número y reloj | hecho | F10 |
| Estaciones con filtro y vista de pase (todas) | hecho | F10 |
| Reloj y semáforo de dos tiempos desde que llega la comanda | parcial: el reloj vuelve a cero cuando cocina toca la comanda por primera vez | F10 |
| Marcar listo por plato, por menú y por comanda, acotado a la estación | hecho | F11 |
| Recuperar sin diálogo | hecho | F12 |
| Vista de listas para recoger y marcar entregada | hecho | F13 |
| Urgente después de enviar, con aviso en papel | hecho | F14, F20 |
| Urgente al enviar | hecho (con Ventas) | F18 |
| Resumen de lo que queda por cocinar | hecho | F15 |
| Sonido al entrar, con volumen y tono | hecho | F16, F26 |
| Pase en papel al marcar listo | hecho | F17 |
| Comanda en papel por estación al enviar | parcial: la imprime el hub; con la impresora de red apagada se pierde sin aviso | F08 |
| Reimprimir una comanda | no hecho | F09 |
| Menú agrupado, cada plato a su estación | parcial: hecho con los platos elegidos; un menú sin nada elegido llega como una línea (sales#535) | F06 |
| Suplementos y notas en pantalla y en papel | hecho | F07 |
| Alérgenos resaltados | no hecho: solo como nota libre (ver «Dudas abiertas») | F07 |
| Estación con destino pantalla, papel o ambos y su impresora | parcial: solo por el asistente o la API | F01, F02 |
| Enrutado por producto y por categoría | parcial: no se ve ni se quita | F04 |
| Estado de cada ronda visible en el TPV | parcial: la hora no es la de envío y sale en UTC | F19 |
| Cerrar en cocina lo de una cuenta cobrada, sin parar lo que se cocina | hecho (kitchen#145) | F27 |
| Lo que solo va a papel no se queda en la pantalla | hecho: sale al cobrar (la ronda entera a estaciones solo de impresora, o todo si la cocina trabaja en papel, kitchen#153); la tarjeta sí se pinta mientras la cuenta sigue abierta | F27, F26 |
| Anular un plato enviado con aviso a cocina | parcial: el TPV lo anula, cocina no lo tacha (kitchen#161) | F29 |
| Cuenta anulada o unida: cocina se entera | hecho: eliminarla cancela sus rondas en marcha y juntarla las pasa a la cuenta que queda (kitchen#162) | F28 |
| Cancelar una comanda con motivo | parcial: sin motivo ni confirmación en pantalla | F22 |
| Historial con quién hizo cada cosa | parcial: no enseña quién | F25 |
| Pantalla completa en la tableta | hecho | F10 |
| Cursos con retener y lanzar | fuera del MVP (kitchen#71) | — |
| Asiento (comensal) por plato | fuera del MVP | — |

## Datos: de quién es cada dato

**De Cocina** (sus tablas): las comandas (`kitchen_order`: número, etiqueta, tipo, prioridad, estado,
ronda, notas, tiempos, total informativo, pedido de origen, camarero), sus platos (`kitchen_order_item`:
nombre, cantidad, suplementos, nota, estado, estación y destino congelados al enviar, menú al que
pertenecen), el historial (`kitchen_order_log`), las estaciones (`kitchen_station`), el enrutado
(`kitchen_product_station`, `kitchen_category_station`), los ajustes (`kitchen_settings`, una fila por
hub que nace al primer guardado) y el contador del número del día. La tabla retirada de suplementos
quedó apartada como `_deprecated_kitchen_order_modifier`, sin filas.

**Lo que lee de otros, y por qué puerta:**
- De Ventas, el aviso de ronda enviada (`order.fired`: pedido, etiqueta, canal, camarero, prioridad y
  los platos con su nota y suplementos), el de cuenta cerrada (`order.completed`), el de cuenta
  eliminada (`sales.order.voided`) y el de cuentas unidas (`sales.order.merged`); con los dos últimos
  lee la cabecera de la cuenta (`sales.order.get`) para comprobar que está anulada (KITCHEN-F28).
- De Clientes, el aviso de fichas unidas (`customer.merged`).
- De Inventario, las listas públicas de productos y categorías, solo para el desplegable del enrutado.
- Del hub, la lista de personas (`hub.users.list`) y, si está instalado Equipo, su lista
  (`staff.members.list`), solo para poner nombre al camarero en la tarjeta y en el pase.

**Lo que da a otros:** a Caja, las comandas en marcha (`kitchen.orders.display`, KITCHEN-F31); al hub,
los platos y la cabecera de cada comanda para imprimirla (KITCHEN-F08); a Flujos, sus avisos
(`kitchen.order.*`, `kitchen.item.*`) como disparadores; al TPV de Ventas, sus dos piezas de pantalla.

**Datos personales (inventario para el borrado RGPD):**
- `kitchen_order.label`: texto libre que manda el TPV; puede llevar el nombre de un cliente
  («Recogida Ana»). Se imprime en la comanda y en el pase.
- `kitchen_order.customer_id` y `table_id`: referencias opacas de comandas antiguas o creadas por la
  API; el flujo del TPV ya no las escribe. `customer_id` se re-apunta al unir fichas (KITCHEN-F30).
- `kitchen_order.waiter_id` (quién envió la ronda), `kitchen_order_log.performed_by_id` y las columnas
  `created_by` / `updated_by` de todas las tablas: identificadores de personas del hub o del equipo.
- `kitchen_order.notes` (incluye el motivo de una cancelación, guardado con el prefijo fijo en
  inglés `Cancelled: `) y `kitchen_order_item.notes`: texto libre del camarero; puede contener
  alergias, que son datos de salud. `kitchen_order_log.notes`: motivo de cancelación.
- Viajan en avisos: todos los avisos de cocina (`kitchen.order.*`, `kitchen.item.*`) llevan quién hizo
  la acción; `kitchen.order.created` lleva además la etiqueta y el camarero, y
  `kitchen.order.cancelled` el motivo. El papel lleva la etiqueta y el nombre del camarero.
- Cocina no escucha el borrado ni la anonimización de un cliente (`customer.deleted`,
  `customer.anonymized`): la etiqueta y las notas de sus comandas se quedan como estaban.

## Reglas que no se rompen

- **Aislamiento por hub.** Toda lectura y escritura va acotada al hub; una entrada de historial solo
  se apunta contra una comanda del mismo hub, y la unión de clientes solo re-apunta comandas de ese
  hub.
- **El estado de la comanda sigue su camino**: Por preparar → En preparación → Lista → Servida;
  «Lista» se puede marcar también directamente desde Por preparar («Lista» en la lista de Comandas, o
  marcar de golpe todos sus platos); Recuperar devuelve una lista a En preparación; Cancelar vale
  desde las tres primeras; Servida y
  Cancelada no se mueven más. Lo que se sale del camino se rechaza sin escribir nada ni avisar a
  nadie, y si la comanda cambió entre que se leyó y se escribió, también se rechaza.
- **Los platos solo se mueven mientras la comanda está en marcha**; un plato de otra comanda se
  rechaza, y una orden que no movería ningún plato también.
- **Permisos por acción**: ver (todos los perfiles), enviar y crear (cajero, empleado, responsable),
  marcar listo, recuperar, lanzar y marcar urgente (empleado, responsable), entregar (empleado,
  responsable), cancelar y borrar (responsable), ajustes (responsable), estaciones y enrutado
  (administrador). El administrador lo tiene todo.
- **Una ronda sin nada que cocinar no abre comanda**, y un menú enviado sin platos elegidos tampoco;
  las líneas de servicio no se cocinan. El rechazo no vuelve al TPV: una ronda de solo servicios
  acaba entre los eventos caídos del hub (KITCHEN-F05).
- **Una prioridad o un canal desconocidos en la ronda caen a normal y a «En sala»**: nunca se pierde
  una ronda por una palabra.
- **Lo que se envió, se queda como se envió**: la estación, su destino, su función de impresora, el
  nombre del menú y los suplementos se congelan en cada plato; cambiar el destino o el enrutado de
  una estación hoy no cambia a dónde fueron ni por dónde salen las rondas de ayer (el nombre que
  pinta la pantalla sí es el vivo de la estación).
- **Cobrar una cuenta solo toca las rondas de esa cuenta, y nunca cancela nada**: da por servidas
  sus rondas Listas (kitchen#145) y, además, lo que nadie va a marcar en una pantalla — la ronda que
  fue entera a estaciones solo de impresora y, si «La cocina trabaja con la pantalla» está apagado,
  todas (kitchen#153). Lo demás sigue cocinando.
- **Eliminar una cuenta cancela sus rondas en marcha y juntarla las pasa a la que queda**, solo si
  Ventas la tiene de verdad anulada (KITCHEN-F28, kitchen#162).
- **Estaciones**: el nombre no se repite entre las estaciones vivas del hub; no se borra una estación
  con productos o categorías enrutados ni con platos por hacer.
- **Una comanda solo se borra si está Por preparar o Cancelada y no va ligada a una venta** (si no,
  la orden contesta bien y no borra nada, KITCHEN-F24).
- **Ajustes**: «La cocina trabaja con la pantalla» viene encendido: un hub que se actualiza sigue
  igual hasta que alguien lo apaga. Minutos entre 1 y 120, el ámbar por debajo del rojo al guardar (las filas guardadas
  antes de la regla no se revisan), volumen entre 0 y 100, tono de una lista de tres.
- **Dinero**: Cocina no cobra. El total de una comanda es informativo, en céntimos; los platos de un
  menú van a 0 y el precio del menú se cuenta una vez.

## Lo que NO hace, a propósito

- No sabe de mesas ni de clientes: pinta e imprime la etiqueta que le llega. Desactivar Mesas no
  apaga Cocina.
- No cobra, no descuenta stock (lo hace Inventario con la venta) y no lleva recetas ni ingredientes.
- No hace cursos con retener y lanzar (kitchen#71, fuera del MVP): cada envío es una ronda.
- No reparte por asiento: la tarjeta sabe pintar «Comensal N», pero Ventas no manda asiento por plato.
- No marca listo ni acepta comandas por reloj (retirado en kitchen#48: ningún KDS del mercado lo
  hace por defecto).
- No imprime la comanda del envío: la imprime el hub (KITCHEN-F08). Sí imprime el pase y el aviso de
  urgencia.
- No crea comandas al cobrar: la orden antigua que lo hacía sigue publicada pero nada la dispara.
- No vacía de golpe lo que quedó colgado: al apagar «La cocina trabaja con la pantalla», lo cobrado
  antes se sirve comanda a comanda (kitchen#158).
- No avisa ni guarda nada si se envía con Cocina desactivada: Ventas marca los platos como enviados y
  la comanda no existe nunca (`architecture/modules/kitchen.md`, «Entrega segura pendiente»).
- No enseña precios en la pantalla de cocina.
- No recuerda la estación elegida en una tableta: se elige cada vez que se abre la pantalla.

## Dudas abiertas

Se resuelven con `market-decision`; no las decide el worker.

- **Una estación que ya terminó su parte**: hoy su tarjeta se queda en su pantalla, tachada, hasta
  que las demás estaciones terminan. ¿Debe salir de esa estación al terminar su parte?
- **Alérgenos**: hoy son una nota libre en cursiva. ¿Se resaltan como en Fresh KDS?
- **Cancelar desde la pantalla de cocina** y con motivo obligatorio (KITCHEN-F22).
- **Fijar una tableta a una estación** para que no haya que elegirla cada vez.
- **Los campos «Color» e «Impresora» de una estación** no cambian nada (KITCHEN-F02): ¿se quitan o se
  sustituyen por el destino y la función de impresora, que hoy solo se cambian por la API?
- **«Nueva comanda» a mano** nace sin platos (KITCHEN-F23): ¿se completa o se retira?

## Fuentes contrastadas

- `docs/overview.md`, `docs/concepts.md`, `docs/limits.md` y `hand-book/modulos/kitchen.md` dicen que la
  aceptación y la retirada automáticas «existen como ajustes»: se retiraron en kitchen#48 y no están
  en el formulario.
- `docs/overview.md`, `docs/limits.md` y `architecture/modules/kitchen.md` dicen que Cocina lee
  Inventario para poner nombre, precio y estación a cada plato: el plato llega ya con su nombre,
  precio y categoría en la ronda; Inventario solo se lee para el desplegable del enrutado.
- `docs/concepts.md`, `docs/limits.md`, `architecture/modules/kitchen.md` y el comentario de
  `print-comanda.ts` del hub dicen que una comanda que no salió «se puede reimprimir»: no hay botón ni
  orden para hacerlo; el aviso del hub dice que la comanda está en la pantalla de cocina (KITCHEN-F09).
- `docs/limits.md` dice que borrar una comanda que no se puede borrar «se rechaza»: contesta bien y
  no borra (KITCHEN-F24). Y que enrutar a una estación inactiva «se rechaza»: sale «Enrutado
  guardado» y no se guarda nada (KITCHEN-F04).
- `docs/screens.md` dice que el buscador de Comandas busca por cliente y ronda, que una comanda se
  abre para ver sus líneas y que el alta a mano añade platos: busca por número y etiqueta, no hay
  ficha de detalle y el alta solo pide tipo y notas.
- `docs/screens.md` y `hand-book/modulos/kitchen.md` describen el destino (pantalla, impresora o
  ambos) y la función de impresora como campos de la estación en pantalla: solo se cambian por el
  asistente o la API.
- `docs/screens.md` y el manual dicen que el Historial enseña quién hizo cada acción: la pantalla
  enseña Acción, Comanda, Notas y Cuándo.
- `hand-book/modulos/kitchen.md` llama a las pantallas «Display», «Tickets», «Listos», «Todo el día» y
  al botón «Bump»: en pantalla son «Pantalla», «Comandas», «Listas», «Resumen» y «Listo». Y habla de un
  ajuste de «comportamiento de las rondas» que ya no existe.
- `architecture/modules/kitchen.md` dice que el papel no lleva la cabecera del menú, ni los
  suplementos, ni la etiqueta: el renderizador del hub (`crates/peripherals/src/escpos.rs`) ya los
  imprime. También dice que una línea solo de impresora no se marca desde pantalla: sale en la
  tarjeta con el icono de impresora y se marca como cualquier otra.
- `docs/screens.md` dice que la tarjeta envejece desde que la comanda se envió: cuenta desde que llega y vuelve a cero cuando cocina la toca por primera vez
  (KITCHEN-F10, leído en el código, sin ejecutar). BD-08 espera «el semáforo refleja el tiempo
  real», por eso va marcado `(discrepa)`.
- Un rechazo `kitchen.item_unavailable` en la pantalla de cocina sale con el mensaje del servidor en
  inglés: `locales/es.json` no lo traduce.
- La hoja «Comandas de la cuenta» no enseña la hora de envío sino la de llegada a cocina o la de
  inicio, cortada del texto guardado en UTC: en España sale 1 o 2 horas por detrás (KITCHEN-F19).
- La orden pública de crear una comanda desde una venta cobrada se describe al asistente como
  «automática»: no la dispara ningún aviso.
