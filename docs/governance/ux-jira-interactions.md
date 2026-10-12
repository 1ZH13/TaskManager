# Interacciones de trabajo inspiradas en Jira

Fecha: 2026-10-08 (America/Panama). Base: a4ebed2, PR62.

## Objetivo y referencia fijada antes de implementar

Producto web para equipos de propiedades horizontales. Objetivo: organizar tareas
desde su contexto, con arrastre opcional y alternativas de teclado, sin recargas.
Se conserva la interfaz de TaskManager: no es una reproducción de Jira ni un
rediseño de marca. Alcance inicial: tablero, tabla y enlaces de calendario/agenda.

Refero MCP está registrado, pero las cuatro lecturas (estilo, búsqueda de estilos,
pantallas y flujos) respondieron `NO_SUBSCRIPTION`. No se consultaron pantallas ni
flujos privados. La página pública aportada sí fue accesible:
[Atlassian en Refero](https://styles.refero.design/style/c08ebca5-87d4-4c19-a5d7-ae5e670dae11).
Es una referencia de marketing de atlassian.com, no un manual del producto Jira.
Se adapta su separación entre superficies funcionales claras y acento de acción;
se excluyen confeti, héroes, fuentes propietarias y proporciones de marketing.

Dirección dominante: UI existente de TaskManager, compacta, blanca, columnas grises,
texto oscuro, azul para acciones/foco. Se mantienen tokens tipográficos y de color
existentes; nuevos controles con espacio 8/12 px, bordes finos y radio 6 px.
Estados semánticos mantienen sus colores existentes. Sin imágenes generadas:
tablas, selectores e iconos son componentes nativos del código.

## Decisiones y evidencia

| Decisión | Fuente y papel | Motivo |
| --- | --- | --- |
| Acciones de columna junto al encabezado, movimiento con alternativa explícita | [Configurar columnas de Jira](https://support.atlassian.com/jira-software-cloud/docs/configure-columns/), patrón funcional | Trabajar sin salir del tablero; administración separada de lectura |
| Mover tareas entre estados conservando reglas de validación | [Trabajar con tableros](https://support.atlassian.com/jira-software-cloud/docs/work-with-boards-in-business-projects/), recorrido | Arrastre como atajo, no como único mecanismo |
| Campos visibles y orden de columnas configurables; ordenar filas desde encabezado | [Configurar vista Lista](https://support.atlassian.com/jira-cloud-administration/docs/configure-the-default-issue-navigator/), estructura | Adaptar densidad al trabajo; no confundir orden visual con prioridad del dominio |
| Título como enlace al detalle desde tabla y agenda | Pedido del usuario y enlace profundo existente | Inspeccionar sin buscar de nuevo en otra vista |
| Carga, error, foco y controles etiquetados | Refero `craft-details`, metodología de ejecución | Acciones comprensibles con teclado y pantalla pequeña |

Preferencias de tabla en URL: compartibles, sin almacenar datos privados adicionales.
Solo destinos del mismo tablero; capacidades por tarea derivadas del dominio.
No se añaden cambios masivos, sprints, dependencias, backend ni semántica de ranking
nueva. No se elimina evidencia/validación para agilizar movimientos.

## Entrega y verificación

- Tablero: selección disponible al colaborador; crear/asignar/renombrar/límites sin
  recarga, bloqueo de doble envío, mensajes y recuperación de lectura sin repetir
  la escritura. Movimiento por selector y arrastre con las mismas reglas de dominio.
- La tarjeta cuyo detalle está abierto bloquea asignar/mover con explicación; evita
  invalidar la versión del borrador. En el ajuste posterior el detalle es modal y
  todo el fondo queda inerte hasta cerrarlo.
- Tabla semántica: campos opcionales, orden por arrastre o botones, ordenación de
  filas, enlaces al detalle, destinos restringidos al tablero de cada tarea.
  Ordenar visualmente no modifica el ranking persistido del dominio.
- Agenda/calendario: enlaces al detalle; fechas editables según permiso, sin editar
  ocurrencias recurrentes individuales; modo/período en URL para recuperar Atrás.
- Permisos de creación en calendario conservan la política del repositorio demo
  (`projectAllowsCollaboratorCreate: true`); no se cambió la autorización de datos.

`pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build`: aprobados. 117 pruebas
totales: 84 web, 20 data, 11 domain, 2 shared; 24 regresiones añadidas respecto de
a4ebed2. Los cinco paquetes no modificados reutilizaron caché Turbo. El aviso de
Turbo de ausencia de archivos de salida para tests no es un fallo de pruebas.
La revisión independiente encontró dos problemas de contexto/permisos de calendario
y un conflicto de versión de tarjeta/detalle; corregidos y cubiertos por regresiones.

Navegador: tabla 1440/760/390, panel móvil con Escape/restauración de foco;
arrastre físico de encabezado de tabla; movimiento de tarea por selector y arrastre;
columna por menú y arrastre sobre tarjeta; renombrar/crear y persistir tras recarga;
detalle abierto bloquea su acción rápida. Agenda octubre → detalle OPS-2 → Atrás
mantiene octubre/Agenda. Agenda y tablero móviles sin desbordamiento horizontal de
la página (scroll interno de tablas/tableros). Pruebas de escritura en origen
`localhost:3011`, separado de los datos demo de `127.0.0.1:3011` del usuario.

Capturas:

- [Tabla escritorio](evidence/ux-jira-interactions/lista-1440.jpg)
- [Tabla tableta](evidence/ux-jira-interactions/lista-760.jpg)
- [Configurar columnas móvil](evidence/ux-jira-interactions/columnas-390.jpg)
- [Agenda móvil](evidence/ux-jira-interactions/agenda-390.jpg)
- [Tablero móvil](evidence/ux-jira-interactions/tablero-390.jpg)

QA visual: conforme a la UI existente y al lock, corregidas etiquetas de columna y
panel móvil. No es certificación de accesibilidad, prueba de carga ni paridad Jira.
Datos de prueba locales; sin backend productivo ni despliegue.

## Límites y siguiente incremento

Cambios guardados localmente sobre `fix/ux-ui-review`; todavía sin nuevo commit ni
publicación. PR62 sigue abierta en a4ebed2. Creación inline del tablero aún solo para
administración. El calendario conserva creación inmediata con título genérico y
sin selector de tablero: mejorar ese flujo y el caso de primer tablero sin columnas
en otro incremento. La tabla fija ID/nombre/acciones; no hay redimensionado, selección
múltiple ni cambios masivos. Preferencias de tabla y calendario se conservan en su URL
y al volver por historial, no como preferencias globales entre todas las vistas.
Quedan filtros móviles del tablero extensos, priorización de Mis tareas y validaciones
contextuales de la auditoría anterior. No se alteraron sprints ni reglas de negocio.

## Ajuste: arrastre y detalle flotante — 2026-10-08

Pedido: seguimiento inmediato de tareas/columnas, detalle en ventana flotante y
estilo del regreso a proyectos. Referencia dominante: interfaz y captura del usuario;
se conserva el lock anterior. Refero `motion` orienta feedback/continuidad: el elemento
arrastrado sigue directamente el cursor, sin transición de transform; el modal entra
en 180 ms y desactiva esa animación con `prefers-reduced-motion`. Sin nueva librería.
[DragOverlay de dnd-kit](https://dndkit.com/legacy/api-documentation/draggable/drag-overlay/)
fundamenta una vista previa fuera del flujo, sin controles duplicados ni drop animation
que pudiera regresar al origen durante la escritura asíncrona.

- Vista previa flotante de columnas y tareas; origen atenuado, línea de inserción
  lateral para columnas/superior para tarjetas y resaltado de columna destino.
- Colisiones de columnas restringidas a columnas, tarjetas priorizadas bajo puntero.
  Orden interno calcula posición después de retirar el origen; fondo permite ir al
  final de la misma columna. Cancelar no escribe y las reglas de dominio se conservan.
- Detalle en diálogo nativo: fondo inerte, foco contenido y retorno a tarjeta o h1
  para enlaces directos. Cabecera/pie fijos, contenido desplazable, botones agrupados,
  errores dentro del modal. Borradores y guardado conservan su control de versión;
  eliminar después de guardar utiliza la versión actualizada.
- Regreso a proyectos: flecha, azul también después de visitar, foco/hover, contexto
  adaptable a móvil mediante módulo CSS, sin cambiar rutas.

Revisión independiente detectó y se corrigieron la posición de inserción interna y
el foco de retorno al entrar por URL. `pnpm lint`, `pnpm typecheck`, `pnpm test` y
`pnpm build` aprobados: 124 tests (91 web + 20 data + 11 domain + 2 shared).
Se añadieron 7 pruebas en este ajuste. Los paquetes no modificados reutilizan caché.
La suite emitió un aviso de React act en una prueba de historial y el aviso habitual
de salidas de Turbo, sin fallos.

Navegador: arrastre físico de tarea y columna, preview con teclado y cancelación,
marcador de destino, modal escritorio/390 px sin overflow horizontal, ciclo Tab y
Shift+Tab, cierre y retorno al disparador, enlace directo y retorno al h1. Protección
del borrador ante cancelar cierre verificada en unit tests; la confirmación JS anidada
no pudo verificarse de forma concluyente con la automatización del navegador.
Pruebas en `localhost:3011`, sin resetear datos de `127.0.0.1:3011` del usuario.

Evidencias: [Arrastre de columna](evidence/ux-jira-interactions/arrastre-columna.jpg),
[Modal escritorio](evidence/ux-jira-interactions/detalle-modal.jpg),
[Modal móvil](evidence/ux-jira-interactions/detalle-modal-390.jpg),
[Regreso móvil](evidence/ux-jira-interactions/regreso-proyectos-390.jpg).
Servidor local sigue activo. Cambios del incremento anterior y este siguen locales,
sin nuevo commit, push, fusión ni despliegue.

## Entrega para respaldo y continuidad — 2026-10-12

El usuario autorizó publicar esta entrega en GitHub antes de continuar ampliando
el producto. Se conserva `fix/ux-ui-review` y la PR62; no se solicita fusión con
`main` ni despliegue. El estado «solo local» de las secciones anteriores describe
su cierre histórico del 8 de octubre, no una restricción de esta entrega.

Verificación repetida sin caché el 12 de octubre:
`pnpm exec turbo lint typecheck test --force` y `pnpm exec turbo build --force`
aprobados, con 124 pruebas. Persisten los avisos de React act y salidas de Turbo
documentados arriba; no son pruebas fallidas. Se incluyen código, pruebas,
documentación y nueve capturas de la demo. No se incluyen dependencias instaladas,
archivos de entorno ni datos privados del navegador.

Orden acordado para retomar (pendiente, no implementado en este respaldo):

1. Validación manual del detalle: editar sin guardar, cerrar por botón/Escape,
   cancelar y conservar el borrador, confirmar descarte, volver por historial y
   comprobar foco/teclado. Resolver cualquier fallo reproducible antes de ampliar.
2. Creación desde calendario: pedir título y destino antes de guardar; conservar
   día seleccionado, permisos y datos del formulario ante errores. Incluir el caso
   de un tablero nuevo sin columnas y aclarar tareas recurrentes.
3. Filtros móviles: reducir el espacio ocupado sin ocultar qué filtros están
   activos; mantener valores al cambiar de vista y permitir limpiar filtros.
4. Mis tareas: facilitar acceso al trabajo asignado al usuario dentro de su PH y
   permisos, con entrada directa al detalle y estados vacíos comprensibles.

Otras ampliaciones se priorizarán con el usuario; no se da por aprobada paridad
completa con Jira ni una reestructuración del backend.
