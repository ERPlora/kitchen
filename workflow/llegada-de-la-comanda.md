# WORKFLOW — Cocina · La comanda llega

Prefijo: KITCHEN

Cómo nace una comanda cuando el TPV envía una ronda, qué lleva cada plato y cómo sale en papel. La
comanda nace al **enviar**, no al cobrar.

## Flujos

### KITCHEN-F05 Recibir la ronda que envía el TPV
Estado: parcial — una ronda que solo trae servicios se da por enviada en el TPV («Enviado a cocina») pero Cocina la rechaza y acaba entre los eventos caídos del hub, sin que nadie en sala ni en cocina se entere (leído en el código, sin ejecutar)
Actor: sistema
Pantalla: ninguna
Pasos:
1. El camarero pulsa «Enviar comanda» en el TPV (KITCHEN-F18); también lo hace el TPV solo, antes de cobrar una cuenta con platos sin enviar.
2. Cocina abre una comanda nueva con el número del día (`AAAAMMDD-NNNN`, con el día en hora UTC: entre medianoche y la 1 o las 2 en España lleva la fecha del día anterior y sigue su contador), la ronda de ese pedido (la primera es la 1 y cada envío suma una), la etiqueta que manda el TPV («Mesa 4»; sin mesa, el TPV la manda vacía con el canal «para llevar», y la tarjeta sale «Para llevar»; si llega vacía, la de la ronda anterior del mismo pedido), el camarero y la prioridad.
3. Cada línea cocinable es un plato de la comanda, en el orden en que se eligió, mandado a su estación (KITCHEN-F04). Las líneas de servicio no se cocinan.
4. La comanda aparece en la pantalla de cocina «Por preparar» (KITCHEN-F10), suena (KITCHEN-F16), sale en papel (KITCHEN-F08) y en el TPV el botón «Comandas · N» cuenta una más (KITCHEN-F19).
Entra: de Ventas, la ronda enviada (avisa: order.fired): el pedido, la etiqueta, el canal, el camarero, la prioridad y los platos con su nombre, cantidad, precio, categoría, nota y suplementos.
Sale: la comanda «Por preparar» con sus platos (avisa: kitchen.order.created, que oyen el hub para imprimirla y, en la app instalada, para el aviso del sistema «Nueva comanda · Mesa 4» —que solo sale si los avisos del dispositivo no están denegados; en Android con la pantalla apagada, solo si la app está a la escucha; sale en todos los dispositivos con el hub abierto cuya persona puede leer Cocina, también en el que envió la ronda; y llega por el canal en vivo del hub, que no guarda nada, solo lo entrega a quien puede leer Cocina y admite 16 conexiones por persona, así que la 17.ª pantalla de una misma persona no lo recibe (HUB-F60, hub#2501)—, y Flujos como disparador) y su primera entrada «Recibidas» en el Historial. El tipo sale del canal («En sala», «Para llevar», «A domicilio»; uno desconocido, «En sala»); una prioridad desconocida queda en normal; sin camarero nombrado, el camarero es quien envió.
Si falla: una ronda vacía no la envía Ventas (SALES-F20). Una ronda que solo trae servicios sí la envía Ventas, y el TPV dice «Enviado a cocina»; Cocina quita los servicios, se queda sin nada que cocinar y la rechaza, el aviso se reintenta (hasta 8 veces) y acaba entre los eventos caídos del hub sin que el TPV lo sepa (leído en el código, sin ejecutar). Una ronda de más de 255 platos se rechaza entera, con el mismo final. Ningún rechazo de aquí se ve en el TPV. Si Cocina estaba desactivada al enviar, no nace ninguna comanda y nadie avisa.
Implicados: FLOWS-F13, SALES-F20, REC_RESTAURANTE-F07, REC_RESTAURANTE-F17, HUB_APP-F24, HUB_APP-F25, HUB_SHELL-F65, HUB_SHELL-F67, HUB-F52, HUB-F60
QA: R-04, R-05, BD-08, qa-hub-restaurant §7.08

### KITCHEN-F06 Un menú del día en la comanda
Estado: parcial — un menú todavía sin nada elegido llega como una sola línea con el nombre del menú, en «Sin estación» salvo que el propio menú esté enrutado como producto, y uno a medias llega solo con lo elegido, sin aviso de lo que falta (sales#535)
Actor: empleado
Pantalla: Pantalla
Pasos:
1. El camarero añade un menú con sus elecciones en el TPV (SALES-F12) y envía la ronda.
2. Ventas manda en la ronda los platos elegidos de cada menú (SALES-F20), y cada plato va a la estación de su propio producto, con la cantidad multiplicada por la de menús; en cada estación sale la cabecera del menú (su nombre de cocina, o «Menú») con «N platos» y sus platos sangrados debajo.
3. Tocar la cabecera del menú marca listos los platos de ese menú que hay en pantalla, y nada más; el menú se tacha cuando se marcan todos.
Entra: de Ventas, la línea del menú con sus platos elegidos: qué producto es cada plato (congelado al añadir el menú a la cuenta), su cantidad y la nota del menú, que sale en cada plato. Un plato que es un servicio no llega.
Sale: los platos de la comanda; cuando el menú viene desglosado, sus platos van a 0 € y el precio del menú se cuenta una sola vez en el total de la comanda. El papel imprime la cabecera del menú encima de sus platos (KITCHEN-F08).
Si falla: un menú que llega desglosado pero sin ningún plato elegido se rechaza entero (no se abre una tarjeta en blanco).
Implicados: COMBOS-F11, SALES-F12, SALES-F20, REC_RESTAURANTE-F07
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
Implicados: MODIFIERS-F08, SALES-F13, REC_RESTAURANTE-F07
QA: R-04, qa-hub-restaurant §7.07, qa-hub-restaurant §7.08

### KITCHEN-F08 La comanda sale en papel en cada estación
Estado: parcial — con la impresora de red del dispositivo apagada, el TPV que la envió avisa y deja reintentar esa estación (hub#2494), pero una comanda que iba por la cola del hub vuelve «fallida» sin aviso y una impresora encendida sin papel se da por impresa (PRINTING-F10); y una bebida o un plato sin estación, o en una estación creada en pantalla, sale por «Cocina», nunca por «Barra» (KITCHEN-F01)
Actor: sistema
Pantalla: ninguna
Pasos:
1. Al nacer la comanda (KITCHEN-F05), el hub del dispositivo que la envió reparte sus platos por la función de impresora de su estación («Cocina», «Barra»); lo que va a una estación solo de pantalla no se imprime, y un plato sin estación sale por «Cocina».
2. Sale una hoja por función con la etiqueta, el número, la ronda (desde la segunda), el camarero, la hora, cada plato con su cantidad, suplementos y nota, y la cabecera del menú si la hay.
3. Si la ronda va urgente, la hoja termina con `!! URGENTE !!`, debajo de los platos.
Entra: los platos de la comanda con el destino y la función de impresora congelados al enviar, y su cabecera.
Sale: una hoja por función, una sola vez aunque haya varios TPV abiertos; si la comanda no la envió ningún TPV (API, flujo), va a la cola del hub y la saca el dispositivo que tenga esa función, solo si hay al menos una pantalla del hub abierta y conectada cuando nace (es ella la que la encola); si no hay ninguna, no sale ni se avisa (hub#2501).
Si falla: nunca bloquea al camarero. Si el envío a la impresora falla en el propio navegador, el TPV que la envió enseña, por ejemplo, «No se imprimió la comanda de cocina de Mesa 4. Revisa la impresora y avisa en cocina: la comanda está en la pantalla de cocina.»; con la impresora de red del dispositivo apagada o fuera de la red, a los ~13 s sale ese mismo aviso, fijo y con «Reintentar», que vuelve a mandar solo esa estación (HUB_SHELL-F72, hub#2494); si iba por la cola del hub, vuelve «fallida» sin aviso, y una impresora encendida sin papel se da por impresa (PRINTING-F10); si nadie tiene esa función dada de alta, «La comanda de cocina de Mesa 4 está en espera: aún no hay ninguna impresora dada de alta para esa estación. Da una de alta y saldrá sola.». No hay reimpresión (KITCHEN-F09).
Implicados: PRINTING-F04, PRINTING-F10, REC_RESTAURANTE-F02, REC_RESTAURANTE-F07, REC_RESTAURANTE-F17, HUB-F190, HUB_APP-F19, HUB_PERIPHERALS-F10, HUB_SHELL-F72
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
Implicados: PRINTING-F11
QA: qa-hub-restaurant §7.16
