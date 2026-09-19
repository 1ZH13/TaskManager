# Decisiones de arquitectura y producto

**Estado:** aceptadas para el frontend de demostración
**Alcance:** E0-I1
**Referencias:** [PRD, secciones 8–10 y 20](../../PRD.md), [plan](../../IMPLEMENTATION_PLAN.md)

## ADR-001 — Asociaciones explícitas para relaciones muchos-a-muchos

**Decisión.** `ProjectTeam`, `ProjectMember`, `BoardTeam` y `TeamMembership` serán entidades de asociación; las entidades principales no duplicarán esas relaciones como arreglos mutables.

**Motivo.** Una persona o equipo puede participar en varios proyectos y tableros, y cada relación puede requerir función, acceso, vigencia o condición de equipo principal.

**Consecuencias.** Los repositorios y esquemas Zod deben validar tanto la entidad relacionada como su `phId`. Las vistas consultarán asociaciones mediante selectores, no mediante estado duplicado.

## ADR-002 — El flujo de trabajo usa categorías semánticas

**Decisión.** Las columnas mantendrán nombre, color y posición configurables, mientras que `TODO`, `IN_PROGRESS`, `BLOCKED` y `DONE` expresan su categoría semántica. Varias columnas pueden compartir categoría.

**Motivo.** Los informes y reglas no pueden depender de textos editables como “Terminada”.

**Consecuencias.** Un tablero no puede quedar sin columnas. Las políticas y los selectores referencian `columnId` y categoría, no el nombre visible.

## ADR-003 — Validación configurable por proyecto

**Decisión.** La política del proyecto contiene `requiresValidation`, `validationColumnId`, `approvedColumnId` y `rejectedColumnId`. La aprobación corresponde a administradores autorizados del mismo PH.

**Motivo.** La aprobación de limpieza, mantenimiento y contabilidad no sigue necesariamente el mismo flujo, pero la autorización queda centralizada en administración.

**Consecuencias.** Eliminar una columna usada por una política exige seleccionar un reemplazo y reconfigurar la política en la misma operación. Un rechazo requiere comentario; una transición a bloqueo requiere motivo. No se persisten validadores individuales ni roles supervisores.

## ADR-004 — Zod como fuente de verdad de contratos

**Decisión.** Los modelos de intercambio se declararán con Zod 4 y TypeScript se derivará con `z.infer`.

**Motivo.** Evita divergencia entre validación en ejecución, tipos de frontend y el futuro contrato HTTP.

**Consecuencias.** Las validaciones se ejecutan en límites de entrada y repositorio. Las reglas de dominio puras se mantienen fuera de componentes y adaptadores.

## ADR-005 — Dependencia invertida para persistencia

**Decisión.** Las vistas dependen de interfaces de repositorio inyectadas; el adaptador local y el futuro adaptador HTTP las implementan. Ninguna vista usa directamente `localStorage`, IndexedDB o `fetch`.

**Motivo.** El frontend de demostración debe poder conectarse a backend sin reescribir presentación ni flujos.

**Consecuencias.** Errores, conflictos de versión e identidad del actor tienen contratos uniformes. La persistencia local será versionada, con semillas deterministas y recuperación frente a datos corruptos.

## ADR-006 — Aislamiento obligatorio por propiedad horizontal

**Decisión.** Toda entidad de negocio incluye `phId`; cada lectura, mutación y decisión de permiso exige coincidencia entre actor, recurso y contexto activo.

**Motivo.** Un cruce de datos entre PH es un error funcional y de privacidad.

**Consecuencias.** Las rutas incorporan contexto PH, los repositorios rechazan IDs de otro PH y las pruebas incluyen intentos explícitos de cruce. El filtrado visual nunca sustituye esta validación.

## ADR-007 — Identidad provisional, accesible y reemplazable

**Decisión.** El frontend usa Inter, tokens del PRD y un logotipo genérico centralizado en un único recurso reemplazable.

**Motivo.** Permite construir una interfaz coherente sin bloquearse por la identidad final ni reutilizar recursos de terceros.

**Consecuencias.** Componentes usan variables CSS y estados con texto e icono además de color. La sustitución de marca no debe exigir cambios de componentes.

## Pendientes de producto

### No bloqueantes para el frontend

- Nombre comercial, logotipo y activos finales.
- Claves visibles definitivas de módulos y textos finales de columnas.
- Exportación CSV e importaciones.
- Zona horaria por PH, días hábiles y feriados.
- Semántica definitiva de porcentaje de avance y edición de series recurrentes.

### Bloqueantes antes del backend o integración real

- Matriz definitiva de permisos, herencia, excepciones y precedencia.
- Contrato, campos y frecuencia de sincronización del maestro de proveedores de PH Platform.
- Política de retención, tipos permitidos, límites y análisis de archivos.
- Modelo de autenticación, identidad de usuario y reglas RLS por PH.
- Volúmenes esperados, paginación, límites de API e idempotencia final.
