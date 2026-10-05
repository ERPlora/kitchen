# WORKFLOW — Cocina · Estaciones y enrutado

Prefijo: KITCHEN

Las estaciones son los puntos de trabajo (Plancha, Barra, Postres) y el enrutado decide a cuál va
cada plato. Todo esto es del administrador; la pantalla enseña los botones a cualquiera, pero el
servidor rechaza a los demás perfiles.

## Flujos

### KITCHEN-F01 Crear una estación
Estado: parcial — la pantalla solo pide nombre e «Impresora», y ese campo no cambia nada; el destino (pantalla, papel o ambos) y la función de impresora («Cocina», «Barra») solo se eligen por el asistente o la API, así que toda estación creada en pantalla sale por pantalla y por la impresora de cocina
Actor: administrador
Pantalla: Estaciones
Pasos:
1. En **Cocina → Estaciones**, pulsa «Añadir estación»: se abre el panel lateral.
2. Escribe el nombre («p. ej. Plancha») y, si quieres, la impresora «(opcional)».
3. Pulsa «Crear estación».
4. El panel se cierra y la estación sale en la tabla, «Activa: Sí», con «En curso» a 0.
Entra: el nombre que escribe el administrador.
Sale: la estación, activa, con destino pantalla y papel y función de impresora «Cocina» (avisa: kitchen.station.created). El texto de «Impresora» se guarda y se enseña en la tabla, pero nadie lo lee al imprimir. Por el asistente o la API se pueden dar además el nombre en español, el destino y la función de impresora.
Si falla: el rechazo sale dentro del panel, encima de su botón. Si ya hay una estación viva con ese nombre, se rechaza (el nombre de una estación eliminada vuelve a quedar libre). Un perfil que no es administrador ve el formulario y recibe el rechazo de permiso al guardar.
Implicados: PRINTING-F04, REC_RESTAURANTE-F02
QA: R-05, qa-hub-restaurant §7.08, qa-hub-restaurant §7.16

### KITCHEN-F02 Editar, renombrar o desactivar una estación
Estado: parcial — «Color» e «Impresora» se guardan sin cambiar nada (la pantalla de cocina no usa el color y nadie lee la impresora); el destino y la función de impresora no se cambian aquí; y una estación creada por la API con nombre en español no cambia el nombre que se ve al renombrarla aquí
Actor: administrador
Pantalla: Estaciones
Pasos:
1. Toca la fila de la estación (o «Editar»): arriba se abre «Editar estación · <nombre>».
2. Cambia el nombre, el color, la impresora o el interruptor «Activa».
3. Pulsa «Guardar» («Cancelar» cierra sin guardar).
4. Sale «Estación actualizada» y la tabla se refresca.
Entra: la estación elegida y lo que cambie el administrador.
Sale: la estación cambiada (avisa: kitchen.station.updated). Desactivarla hace que los platos nuevos que iban a ella busquen la estación de su categoría y, si no hay, salgan «Sin estación»; las rondas ya enviadas no cambian de estación. Renombrar cambia el nombre que ven las tarjetas de la pantalla de cocina también en las rondas ya enviadas (las pinta con el nombre vivo de la estación); en «Resumen», las rondas ya enviadas siguen con el nombre antiguo.
Si falla: el rechazo sale dentro del formulario. Un nombre repetido entre estaciones vivas se rechaza. Guardar una estación que otro dispositivo acaba de eliminar contesta bien y no cambia nada.
Implicados: ninguno
QA: R-05, qa-hub-restaurant §7.08

### KITCHEN-F03 Eliminar una estación
Estado: hecho
Actor: administrador
Pantalla: Estaciones
Pasos:
1. En la fila, pulsa «Eliminar».
2. Sale «¿Eliminar «<nombre>»?» con «La estación sale de la lista y deja de recibir comandas. Las comandas ya enviadas la conservan en su historial.».
3. Pulsa «Eliminar» («Cancelar» o tocar fuera no borra nada).
4. La estación desaparece de la tabla.
Entra: la estación elegida.
Sale: la estación se retira (no se borra) y su nombre queda libre (avisa: kitchen.station.deleted). Las rondas ya enviadas conservan el nombre con que salieron.
Si falla: con productos o categorías enrutados a ella, o con platos suyos por hacer, se rechaza y el motivo sale encima de la tabla. Si otro dispositivo ya la eliminó, se dice que no existe y la tabla se refresca. Como un enrutado no se puede quitar (KITCHEN-F04), para eliminarla hay que mandar antes sus productos y categorías a otra estación.
Implicados: ninguno
QA: ninguno

### KITCHEN-F04 Mandar productos y categorías a una estación
Estado: parcial — la pantalla no enseña qué está enrutado a cada estación, un enrutado no se puede quitar (solo mandarlo a otra), y enrutar a una estación inactiva dice «Enrutado guardado» sin guardar nada
Actor: administrador
Pantalla: Estaciones
Pasos:
1. En el panel «Enrutado producto/categoría → estación», elige la estación (o pulsa «Enrutar» en su fila, que la deja elegida).
2. Elige un producto, una categoría o los dos (se eligen por nombre de las listas de Inventario).
3. Pulsa «Guardar enrutado» (apagado hasta que hay estación y producto o categoría).
4. Sale «Enrutado guardado»; el producto y la categoría se vacían para el siguiente.
Entra: la estación y los productos y categorías de Inventario.
Sale: el producto o la categoría quedan mandados a esa estación, sustituyendo el enrutado anterior (avisa: kitchen.routing.changed). Solo afecta a las rondas que se envíen después. Al enviar, cada plato va a: la estación de su producto; si no tiene, la de su categoría principal (la que manda el TPV); si no, «Sin estación», que se ve en la pantalla y sale por la impresora de cocina.
Si falla: un rechazo sale dentro del formulario. Si Inventario no responde, los desplegables salen vacíos y el panel no sirve, pero la pantalla sigue. Si la estación elegida está inactiva, no se guarda nada y aun así sale «Enrutado guardado».
Implicados: INVENTORY-F06, INVENTORY-F07, INVENTORY-F08, INVENTORY-F27, SALES-F20, REC_RESTAURANTE-F02
QA: R-05, qa-hub-restaurant §7.08
