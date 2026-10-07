# Navegación UX — primera etapa

Fecha: 2026-10-07 (America/Panama). Incremento sobre `03920b9`, PR #62.
Alcance: F1/F2 de la revisión de recorridos. No incluye Mis tareas, creación/asignación
unificada ni validaciones en contexto; esas mejoras quedan pendientes.

## Cambios

- Notificaciones de tareas incluyen PH y taskId. Los enlaces antiguos sin contexto
  se resuelven mediante el repositorio autorizado hacia el módulo, proyecto y tablero
  de la tarea. No se presupone el primer tablero operativo.
- El detalle abre por URL, incluso si un filtro oculta su tarjeta; recargar conserva
  la selección. Abrir una tarjeta añade una entrada de historial; cerrar quita taskId
  sin borrar los filtros. El encabezado recibe foco y el cierre intenta devolverlo
  al control de origen o al encabezado del tablero.
- Un enlace de otra PH no cambia la sesión automáticamente. Los destinos inexistentes,
  inaccesibles o con fallo de conexión ofrecen error y recuperación. Un board inválido
  ya no abre silenciosamente el primer tablero.
- Lista, Tablero, Calendario y Cronograma comparten q y assignee. Conservan projectId,
  phId y la selección board para regresar; las vistas agregadas no filtran por board
  de forma invisible. Cada destino recibe solo filtros que expone. Las fechas de
  inicio de Lista no se convierten en fechas de vencimiento de Tablero.
- La pestaña Resumen ficticia se retiró. Hay un enlace explícito Volver a proyectos.
  Cambiar PH/actor limpia IDs y filtros del contexto anterior.
- Borradores de título, descripción, prioridad y bloqueo se conservan únicamente en
  memoria de esta pestaña/sesión SPA, separados por PH/usuario/rol/tarea. Atrás/Adelante
  permite navegar y recuperarlos al reabrir, con aviso visible. Guardar conserva la
  versión original para detectar conflictos. Descartar expresamente elimina el borrador.
  No sobreviven a recarga/cierre de pestaña; beforeunload advierte si el editor está sucio.
- Las respuestas tardías de guardar, eliminar o crear subtareas no pueden reemplazar
  otra tarea abierta. Los resultados de cargas antiguas de otra PH se descartan.
- Tablero y vistas sincronizadas consumen todas las páginas del contrato actual;
  cursores cíclicos fallan de manera recuperable en vez de iterar indefinidamente.

## Verificación automática

- `pnpm lint`: aprobado.
- `pnpm typecheck`: aprobado.
- `pnpm test`: 93 pruebas aprobadas (60 web, 20 data, 11 domain y 2 shared).
  Son 25 pruebas web adicionales respecto a 03920b9. UI/config no tienen tests propios.
  Turbo reutilizó resultados de paquetes sin cambios.
- `pnpm build`: aprobado, Next.js 16.3.5.
- `git diff --check`: aprobado.

Cobertura añadida: resolución de otro módulo/tablero, acceso rechazado, enlace de otra
PH, tarea ausente, carga paginada, apertura con tarjeta filtrada, recarga de selección
simulada, filtros entre vistas, cambio PH/actor, restauración de borradores y conflicto,
guardado/eliminación/subtarea con respuesta tardía. Revisión independiente detectó los
casos de historial, respuestas tardías y paginación, incorporados antes del cierre.

## Recorridos manuales en demo local

Sin crear, guardar, aprobar ni eliminar datos del usuario:

1. Notificaciones -> Abrir recurso: OPS-1 abierto en una activación y con URL completa.
2. Recargar: OPS-1 sigue abierto. Foco en encabezado; Tab llega a Cerrar y Enter cierra.
3. Filtrar Carlos; Lista; escribir rápidamente `bombas`; Calendario; Cronograma;
   regresar a Tablero: mismo texto, responsable y selección de tablero en URL.
4. Abrir OPS-2, editar título sin guardar, Atrás, Adelante: borrador recuperado.
   Se restauró el texto original y se cerró sin guardar.
5. Cambiar PH: regreso a /operaciones sin query de la propiedad anterior. Se restauró
   PH Vista Marina. La cobertura de acceso fuera de PH y otro módulo es automatizada.
6. Inspección visual de 1440, 760 y 390 px. No es auditoría WCAG ni test con usuarios.

Evidencia:

- [Detalle escritorio](evidence/ux-navigation-stage-1/detalle-1440.jpg)
- [Filtros tableta](evidence/ux-navigation-stage-1/filtros-760.jpg)
- [Filtros móvil](evidence/ux-navigation-stage-1/filtros-390.jpg)
- [Detalle móvil](evidence/ux-navigation-stage-1/detalle-390.jpg)

## Límites

No cambia contratos de backend ni añade un endpoint individual de tarea. La resolución
usa listWorkItems paginado; un backend grande debería ofrecer consulta individual
autorizada para reducir lecturas. No cambia los enlaces de documentos/formularios ni
la navegación completa de todos los módulos. Los filtros exclusivos se descartan al
salir de su vista, no se guardan perfiles de búsqueda. El foco se probó en el recorrido
descrito, no con lector de pantalla. No hay fusión ni despliegue automático.
