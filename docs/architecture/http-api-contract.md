# Contrato HTTP inicial

La API se versiona bajo `/api/v1`. Todas las rutas autenticadas exigen un
contexto PH; el servidor obtiene o compara `phId` y nunca confía solamente en
un identificador enviado por la interfaz.

## Convenciones

- Fechas: ISO 8601 con zona horaria; fechas de calendario: `YYYY-MM-DD`.
- Listas: respuesta `{ items, nextCursor? }`; `cursor` es opaco.
- Mutaciones: `Idempotency-Key` obligatorio cuando crean o envían recursos.
- Concurrencia: las actualizaciones reciben `If-Match: <version>` y devuelven
  `ETag: <version>`. Un desfase devuelve `409 CONFLICT`.
- Error uniforme: `{ error: { code, message, requestId, details? } }`, donde
  `code` es `ACCESS_DENIED`, `NOT_FOUND`, `VALIDATION`, `CONFLICT` o
  `NOT_CONFIGURED`.

## Recursos E6

| Método y ruta                                           | Operación                                                                               |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `GET /property-contexts/{phId}/documents`               | lista documentos, con `projectId`, `taskId`, `providerId`, `teamId`, `query`, `cursor`. |
| `POST /property-contexts/{phId}/documents`              | crea metadatos de un adjunto previamente cargado.                                       |
| `DELETE /property-contexts/{phId}/documents/{id}`       | elimina un documento usando `If-Match`.                                                 |
| `GET /property-contexts/{phId}/forms`                   | lista formularios publicados o borradores.                                              |
| `POST /property-contexts/{phId}/forms/{id}/submissions` | valida y registra un envío; puede devolver la tarea creada.                             |
| `GET /property-contexts/{phId}/providers`               | lista catálogo PH Platform y estado de sincronización.                                  |
| `GET /property-contexts/{phId}/activity`                | actividad derivada, filtrable por recurso.                                              |
| `GET /property-contexts/{phId}/notifications`           | notificaciones paginadas.                                                               |
| `PATCH /property-contexts/{phId}/notifications/{id}`    | marca leída/no leída usando `If-Match`.                                                 |

Los esquemas Zod del paquete compartido son la fuente de tipos tanto para este
adaptador como para el adaptador local. El archivo OpenAPI definitivo se
generará desde estas operaciones cuando exista el servicio HTTP.

## Informes E7

Durante la demo, los informes se calculan localmente con las tareas, columnas
y actividad que el repositorio ya devolvió autorizadas. No se persisten
contadores ni resultados de gráficas independientes.

Cuando el volumen requiera cálculo de servidor, el endpoint previsto será:

| Método y ruta                                      | Operación                                                                                                                                            |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /property-contexts/{phId}/reports/work-items` | devuelve indicadores y series derivadas; admite `module`, `projectId`, `boardId`, `teamId`, `assigneeId`, `providerId`, `from`, `to` y zona horaria. |

El servidor debe aplicar `report.read`, limitar el resultado a los recursos
autorizados para el actor y conservar el mismo contrato de filtros que
`ReportFilters` en `packages/domain/src/report-selectors.ts`.
