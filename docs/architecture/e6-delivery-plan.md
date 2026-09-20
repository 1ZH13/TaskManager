# Epic E6 — plan de entrega

Este documento convierte el épico 7 en entregables verificables. Ninguna vista
accede a `localStorage`, `fetch` ni a una integración de terceros: consume el
repositorio inyectado por el contexto de demostración.

## Orden y dependencias

1. **Contratos y datos**: ampliar los esquemas Zod, la semilla y el repositorio
   local para documentos, formularios, proveedores, actividad y notificaciones.
   Cada recurso lleva `phId`, fechas ISO y `version`.
2. **Recursos simulados**: crear las pantallas de documentos, proveedores y
   actividad. Las relaciones se resuelven contra proyecto, tarea, proveedor o
   equipo; las consultas siempre filtran por `phId`.
3. **Formularios**: entregar un motor declarativo con cinco plantillas y una
   creación opcional de tarea. Las rutas de cita y factura reutilizan el motor,
   pero conservan un URL propio y compartible.
4. **Frontera HTTP**: definir OpenAPI y un adaptador HTTP que preserve la
   interfaz de repositorio, cursores, `If-Match`/ETag, `Idempotency-Key` y el
   error uniforme.
5. **Evidencia**: pruebas unitarias del repositorio y validadores, pruebas de
   componentes para estados de carga, error y éxito, y `lint`, `typecheck`,
   `test` y `build` del workspace.

## Criterio de cierre por subissue

| Issue | Evidencia mínima |
| --- | --- |
| 38 | Carga, búsqueda, filtros, vista previa, descarga y borrado confirmado; relaciones y metadatos. |
| 39 | Cinco plantillas, constructor, publicación, validación y creación de tarea opcional. |
| 40 | Catálogo filtrado por PH con referencias, trabajo abierto, actividad y sincronización. |
| 41 | Actividad derivada de mutaciones y notificaciones leídas con vínculo contextual. |
| 42 | OpenAPI, esquemas Zod, adaptador intercambiable, cursor, ETag y errores documentados. |
| 50 | Ruta de cita, RUC/DV, asistente, fecha/hora accesible, Zod y estados recuperables. |
| 51 | Ruta de factura, adjunto simulado, precio/ITBMS configurables, Zod y estados recuperables. |

## Decisiones acotadas hasta el backend

- La tasa ITBMS se configura en el formulario (por defecto 7 %); no se codifica
  como una regla fiscal definitiva.
- RUC, DV y disponibilidad validan presencia y formato básico. Las reglas de
  negocio definitivas serán políticas del backend.
- Los adjuntos son metadatos y URL de demostración; la carga binaria se delegará
  a un servicio de archivos.
- La sincronización de proveedores es solo lectura desde `PH_PLATFORM`; no se
  incluyen pagos ni gestión financiera.
