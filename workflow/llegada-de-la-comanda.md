# WORKFLOW — Cocina · La comanda llega

Prefijo: KITCHEN

Cómo nace una comanda cuando el TPV envía una ronda, qué lleva cada plato y cómo sale en papel. La
comanda nace al **enviar**, no al cobrar.

## Flujos

### KITCHEN-F05 Recibir la ronda que envía el TPV
Estado: hecho
Actor: sistema
Pantalla: ninguna
Pasos:
1. El camarero pulsa «Enviar comanda» en el TPV (KITCHEN-F18); también lo hace el TPV solo, antes de cobrar una cuenta con platos sin enviar.
2. Cocina abre una comanda nueva con el número del día (`AAAAMMDD-NNNN`), la ronda de ese pedido (la primera es la 1 y cada envío suma una), la etiqueta que manda el TPV («Mesa 4», «Barra»; si llega vacía, la de la ronda anterior del mismo pedido), el camarero y la prioridad.
3. Cada línea cocinable es un plato de la comanda, en el orden en que se eligió, mandado a su estación (KITCHEN-F04). Las líneas de servicio no se cocinan.
4. La comanda aparece en la pantalla de cocina «Por preparar» (KITCHEN-F10), suena (KITCHEN-F16), sale en papel (KITCHEN-F08) y en el TPV el botón «Comandas · N» cuenta una más (KITCHEN-F19).
Entra: de Ventas, la ronda enviada (avisa: order.fired): el pedido, la etiqueta, el canal, el camarero, la prioridad y los platos con su nombre, cantidad, precio, categoría, nota y suplementos.
Sale: la comanda «Por preparar» con sus platos (avisa: kitchen.order.created, que oyen el hub para imprimirla y, en la app instalada, para el aviso del sistema «Nueva comanda · Mesa 4», y Flujos como disparador) y su primera entrada «Recibidas» en el Historial. El tipo sale del canal («En sala», «Para llevar», «A domicilio»; uno desconocido, «En sala»); una prioridad desconocida queda en normal; sin camarero nombrado, el camarero es quien envió.
Si falla: una ronda sin nada que cocinar (vacía, o solo servicios) no abre comanda; Ventas ya no la envía (SALES-F20). Una ronda de más de 255 platos se rechaza entera. Un rechazo aquí no se ve en el TPV: el aviso se reintenta y, si sigue fallando, queda entre los eventos caídos del hub. Si Cocina estaba desactivada al enviar, no nace ninguna comanda y nadie avisa.
Implicados: pendiente
Pendiente de enlazar: sales — SALES-F20 envía la ronda a cocina y deja los platos marcados como enviados
Pendiente de enlazar: tables — el nombre de la mesa que llega como etiqueta de la comanda
Pendiente de enlazar: hub — el aviso del sistema «Nueva comanda» al llegar una comanda, que abre Cocina al tocarlo
Pendiente de enlazar: flows — una comanda nueva puede disparar un flujo
Pendiente de enlazar: REC_RESTAURANTE — tomar nota y mandar la ronda a cocina en el día del restaurante
QA: R-04, R-05, BD-08, qa-hub-restaurant §7.08

### KITCHEN-F06 Un menú del día en la comanda
Estado: parcial — desde el TPV un menú llega a cocina como una sola línea con el nombre del menú, sin los platos elegidos, y va a una sola estación: Venta no manda los platos del menú (leído en el código de los dos módulos, sin ejecutar). Cocina ya sabe repartirlos y agruparlos si se los mandan
Actor: empleado
Pantalla: Pantalla
Pasos:
1. El camarero añade un menú con sus elecciones en el TPV (SALES-F12) y envía la ronda.
2. Hoy, en la pantalla de cocina sale una línea con el nombre del menú y su cantidad, en la estación de ese producto o de su categoría, o en «Sin estación».
3. Cuando una ronda trae los platos del menú, cada plato va a la estación de su propio producto, con la cantidad multiplicada por la de menús; en cada estación sale la cabecera del menú (su nombre de cocina, o «Menú») con «N platos» y sus platos sangrados debajo.
4. Tocar la cabecera del menú marca listos los platos de ese menú que hay en pantalla, y nada más; el menú se tacha cuando se marcan todos.
Entra: de Ventas, la línea del menú.
Sale: los platos de la comanda; cuando el menú viene desglosado, sus platos van a 0 € y el precio del menú se cuenta una sola vez en el total de la comanda. El papel imprime la cabecera del menú encima de sus platos (KITCHEN-F08).
Si falla: un menú que llega desglosado pero sin ningún plato elegido se rechaza entero (no se abre una tarjeta en blanco).
Implicados: pendiente
Pendiente de enlazar: sales — SALES-F12 vende el menú con sus elecciones y hoy no las manda a cocina al enviar
Pendiente de enlazar: combos — los menús y el nombre de cocina de cada uno
QA: R-04, qa-hub-restaurant §7.08

### KITCHEN-F07 Suplementos y notas de cada plato
Estado: hecho
Actor: empleado
Pantalla: Pantalla
Pasos:
1. El camarero elige suplementos («sin cebolla», el punto) y escribe una nota en la línea antes de enviar (SALES-F13).
2. En la tarjeta, debajo del nombre del plato salen los suplementos separados por comas y, en cursiva, la nota.
3. En el papel salen igual, debajo de cada plato (KITCHEN-F08).
Entra: de Ventas, los suplementos de cada línea con su nombre de cocina (si no tiene, el nombre normal) y la nota del camarero, a la que Ventas suma el motivo de la invitación si la línea va invitada.
Sale: los suplementos y la nota quedan congelados en el plato: cambiar el catálogo después no cambia esta comanda.
Si falla: una alergia solo existe como texto de la nota: no se resalta ni se distingue de otra nota. Una nota de la comanda entera no llega desde el TPV (solo existe en las comandas creadas a mano). Después de enviar, la nota ya no se puede cambiar en el TPV.
Implicados: pendiente
Pendiente de enlazar: sales — SALES-F13 pone la nota en la línea, que viaja a la comanda
Pendiente de enlazar: modifiers — el nombre de cocina de cada suplemento
QA: R-04, qa-hub-restaurant §7.07, qa-hub-restaurant §7.08

### KITCHEN-F08 La comanda sale en papel en cada estación
Estado: hecho
Actor: sistema
Pantalla: ninguna
Pasos:
1. Al nacer la comanda (KITCHEN-F05), el hub del dispositivo que la envió reparte sus platos por la función de impresora de su estación («Cocina», «Barra»); lo que va a una estación solo de pantalla no se imprime, y un plato sin estación sale por «Cocina».
2. Sale una hoja por función con la etiqueta, el número, la ronda (desde la segunda), el camarero, la hora, cada plato con su cantidad, suplementos y nota, y la cabecera del menú si la hay.
3. Si la ronda va urgente, la hoja lleva el aviso `!! URGENTE !!` bajo la cabecera.
Entra: los platos de la comanda con el destino y la función de impresora congelados al enviar, y su cabecera.
Sale: una hoja por función, una sola vez aunque haya varios TPV abiertos; si la comanda no la envió ningún TPV (API, flujo), va a la cola del hub y la saca el dispositivo que tenga esa función.
Si falla: nunca bloquea al camarero. Si la impresora no la toma, el TPV que la envió enseña, por ejemplo, «No se imprimió la comanda de cocina de Mesa 4. Revisa la impresora y avisa en cocina: la comanda está en la pantalla de cocina.»; si nadie tiene esa función dada de alta, «La comanda de cocina de Mesa 4 está en espera: aún no hay ninguna impresora dada de alta para esa estación. Da una de alta y saldrá sola.». No hay reimpresión (KITCHEN-F09).
Implicados: pendiente
Pendiente de enlazar: printing — PRINTING-F10 imprime la comanda en cocina y barra
Pendiente de enlazar: printing — PRINTING-F04 da a cada impresora su función
Pendiente de enlazar: hub — el shell imprime la comanda al nacer, solo en el TPV que la envió
QA: R-05, qa-hub-restaurant §7.08, qa-hub-restaurant §7.16

### KITCHEN-F09 Reimprimir una comanda
Estado: no hecho — no hay botón ni orden para volver a sacar una comanda que no salió o se estropeó; el aviso de fallo solo dice que la comanda está en la pantalla de cocina, y repetir el mismo trabajo de impresión lo descarta la cola como repetido
Actor: empleado, responsable
Pantalla: Pantalla
Pasos:
1. En la tarjeta de la comanda, pulsa reimprimir (no existe).
2. La hoja vuelve a salir por la función de su estación, marcada como copia.
Entra: la comanda ya enviada.
Sale: una hoja nueva por función, sin crear ronda ni comanda.
Si falla: igual que KITCHEN-F08.
Implicados: pendiente
Pendiente de enlazar: printing — PRINTING-F11 reimprimir una comanda
QA: qa-hub-restaurant §7.16
