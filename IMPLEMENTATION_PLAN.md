# Plan de implementación — TaskManager

Este plan convierte el PRD v1.0 en entregas incrementales. La primera versión pública incluye todas las fases; cada incremento debe quedar navegable, probado y demostrable antes de iniciar el siguiente.

## Decisiones de producto adoptadas

### Relaciones entre proyectos, equipos y personas

Las relaciones muchos-a-muchos se modelarán con registros de asociación en lugar de arreglos duplicados:

- `ProjectTeam`: vincula proyectos con equipos y puede indicar el equipo principal.
- `ProjectMember`: vincula personas directamente con proyectos y registra su nivel de acceso.
- `BoardTeam`: vincula tableros con equipos.
- `TeamMembership`: vincula personas con equipos y permite guardar su función dentro del equipo.

Esto significa que una persona o equipo puede participar en varios proyectos sin copiar sus datos. También permite cambiar permisos o retirar una asociación sin modificar la entidad principal.

### Flujo configurable de validación

La validación será una política configurable por proyecto:

- `requiresValidation`: activa la validación.
- `validationColumnId`: columna a la que llega el trabajo pendiente de revisión.
- `approvedColumnId`: columna de destino al aprobar, normalmente una columna `DONE`.
- `rejectedColumnId`: columna activa a la que vuelve el trabajo rechazado.
- La aprobación o el rechazo corresponde a cualquier administrador autorizado del PH.

El sistema sugerirá crear una columna “Por validar” para las plantillas que requieran aprobación, pero el usuario podrá renombrarla, moverla o reemplazarla. Si intenta borrar una columna usada por la política, deberá elegir otra antes de continuar. La categoría semántica seguirá limitada a `TODO`, `IN_PROGRESS`, `BLOCKED` y `DONE`; “Por validar” será normalmente `IN_PROGRESS`.

### Identidad inicial

Se usarán Inter, los tokens de color y la dirección visual especificados en el PRD. El logotipo inicial será un recurso genérico y reemplazable, sin incorporar marcas de terceros.

### Cambios incorporados del PRD

- Gestión administrativa ya no incluye “Contratos y renovaciones” en su alcance inicial.
- Gestión de contabilidad incluye “Seguimientos de cobro”.
- La demo mínima incluye tres proyectos —al menos uno por módulo—, dos equipos, cuatro personas y dos tableros, conservando dos PH y datos suficientes para probar aislamiento, roles, estados e informes.
- Formularios incluye dos recorridos específicos: agendar una cita con administración y enviar una factura.
- Los formularios específicos se implementarán como páginas independientes dentro de la aplicación Next.js, con rutas propias y posibilidad de compartir el enlace. No se generarán documentos `.html` desconectados del sistema de rutas y repositorios.
- Los roles de supervisor y validador se eliminan. El administrador absorbe la revisión de evidencias y la aprobación o rechazo, y `validatorId` desaparece del modelo.

## Matriz de permisos propuesta para la demo

La autorización se evaluará por acción y recurso, además de filtrar siempre por `phId`.

| Acción | Administrador | Colaborador |
|---|---:|---:|
| Ver módulos, proyectos y tableros autorizados | Sí, todo el PH | Solo asignados |
| Gestionar proyectos, tableros, columnas y políticas | Sí | No |
| Gestionar personas, equipos y membresías | Sí | No |
| Crear tareas | Sí | Solo si el proyecto lo permite |
| Editar cualquier tarea del alcance | Sí | No |
| Editar tareas propias | Sí | Campos operativos permitidos |
| Asignar o reasignar responsables | Sí | No |
| Cambiar estado, comentar y adjuntar evidencia | Sí | En tareas asignadas |
| Informar bloqueo | Sí | En tareas asignadas; exige motivo |
| Revisar evidencias y aprobar o rechazar validaciones | Sí | No |
| Ver informes | Todo el PH | Resumen personal |
| Gestionar documentos, formularios y proveedores | Sí | Uso autorizado |
| Archivar o restaurar entidades | Sí | No |

Esta matriz queda como comportamiento de demostración. Antes del backend deben definirse permisos granulares, herencia de permisos, excepciones por usuario y reglas para colaboradores que crean tareas.

## Arquitectura de entrega

- Monorepo con `apps/web` y paquetes `config`, `domain`, `shared`, `ui` y `data`.
- Esquemas Zod como fuente de tipos; reglas puras y métricas en `domain`.
- Interfaces de repositorio consumidas por las vistas; adaptadores local y HTTP separados.
- Persistencia local versionada con semillas deterministas y migraciones.
- Rutas con `phId`, módulo, proyecto y vista; filtros compartibles en la URL.
- Componentes accesibles, adaptables y sin acciones decorativas.
- Pruebas unitarias para dominio/contratos, de componentes para interacciones y recorridos de integración para los flujos críticos.

## Épicos e incrementos

### E0 — Gobierno técnico y decisiones

1. Registrar decisiones de arquitectura y pendientes de producto.
2. Definir matriz de permisos y evaluador de capacidades.
3. Definir estrategia de ramas, calidad y Definition of Done.

### E1 — Base del monorepo y sistema visual

1. Inicializar pnpm, Turborepo, Next.js, TypeScript y herramientas de calidad.
2. Crear contratos Zod y entidades de asociación.
3. Implementar tokens, componentes base y logotipo provisional.
4. Crear App Shell adaptable, navegación y rutas localizadas `es-PA`.
5. Configurar pruebas, CI y verificaciones de accesibilidad.

### E2 — Datos locales, contexto PH y permisos

1. Definir contratos de repositorio local/HTTP y proveedor inyectable.
2. Crear semillas completas para dos PH y persistencia local versionada.
3. Implementar selector de PH, aislamiento y acceso denegado.
4. Implementar permisos simulados y selector de usuario/rol de demo.
5. Añadir estados de carga, vacío, error, conflicto y restauración de demo.

### E3 — Organización

1. CRUD y plantillas de proyectos con archivado/restauración.
2. CRUD de personas con protección del identificador personal.
3. CRUD de equipos y membresías muchos-a-muchos.
4. Asociación de proyectos, tableros, equipos y personas.
5. Inicio del PH y navegación por los tres módulos.

### E4 — Trabajo principal

1. CRUD de tableros, columnas y categorías semánticas.
2. Reordenamiento accesible y eliminación de columnas con migración obligatoria.
3. CRUD de tareas y panel de detalle.
4. Tablero Kanban con movimiento/reordenamiento por arrastre y menú.
5. Subtareas, comentarios, evidencias simuladas y actividad.
6. Bloqueos, políticas de evidencia y flujo configurable de validación.
7. Búsqueda, filtros, agrupación y conservación del contexto al abrir detalles.

### E5 — Vistas sincronizadas

1. Lista configurable con edición rápida y selección múltiple simulada.
2. Calendario mensual, semanal y agenda con tareas sin programar.
3. Cronograma con fechas, hitos, fases, dependencias y zoom.
4. Reglas y ocurrencias de tareas recurrentes.
5. Selectores compartidos para garantizar consistencia entre vistas.

### E6 — Recursos e integraciones preparadas

1. Documentos con metadatos, carga/descarga y vista previa simuladas.
2. Constructor, plantillas, publicación y envíos de formularios, incluyendo páginas independientes para agendar citas y enviar facturas.
3. Catálogo de proveedores y relaciones con trabajo/recursos.
4. Centro de notificaciones y líneas de actividad.
5. Contratos HTTP/OpenAPI esperados y adaptador HTTP inicial.

### E7 — Informes, endurecimiento y entrega

1. Selectores y métricas calculadas desde tareas.
2. Tableros de informes por proyecto y generales del PH.
3. Cobertura de estados obligatorios, permisos y conflictos.
4. Auditoría responsive y experiencia móvil operativa.
5. Auditoría WCAG 2.2 AA y alternativas completas al arrastre.
6. Pruebas integrales, rendimiento, documentación y recorrido de aceptación.

## Orden y dependencias

```text
E0 → E1 → E2 → E3 → E4 → E5 → E6 → E7
                    └──────────────→ E7
```

Algunas tareas de E5 y E6 pueden avanzar en paralelo después de estabilizar el modelo de `WorkItem` y los contratos del repositorio en E4.

## Pendientes por definir antes del backend

- Matriz definitiva de permisos y excepciones por proyecto/tablero.
- Confirmar que “varios tableros (2)” significa exactamente dos tableros como mínimo.
- Confirmar que “HTML aparte” significa páginas con rutas independientes dentro de Next.js y no archivos HTML desconectados de la aplicación.
- Herencia de permisos y precedencia entre rol, membresía y asignación.
- Nombre comercial, logotipo y activos finales de PH Platform.
- Contrato exacto del maestro de proveedores.
- Política de retención, tamaño y tipos de archivo.
- Zona horaria por PH y reglas de días hábiles/feriados.
- Semántica del porcentaje de avance del cronograma.
- Reglas definitivas de recurrencia, edición de series y ocurrencias.
- Reglas fiscales y formato de RUC/DV, factura fiscal, precio e ITBMS para los formularios específicos.
- Exportación CSV y alcance de importaciones.
- Volúmenes esperados para paginación, virtualización y rendimiento.

## Criterio de corte para cada incremento

Cada incremento debe compilar, pasar lint y pruebas, mantener aislamiento por PH, incluir estados de interfaz aplicables, funcionar por teclado y en móvil, y no acoplar componentes a la persistencia concreta. La aceptación final exige completar los criterios 1–15 del PRD.
