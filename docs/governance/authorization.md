# Autorización de demostración

**Estado:** especificación de frontend
**Alcance:** E0-I2
**Referencia:** [PRD, sección 6](../../PRD.md)

## Invariantes

1. El actor debe estar activo, autorizado para el PH y coincidir con el `phId` del recurso.
2. El permiso se evalúa en repositorio antes de mutar; la UI solo mejora la experiencia al ocultar o explicar acciones denegadas.
3. Alcance de proyecto, tablero y equipo reduce permisos; nunca los amplía frente al PH.
4. El acceso a identificadores personales completos se concede exclusivamente a administración en los flujos que lo necesiten.

## Matriz de capacidades de demo

| Recurso / acción | Administrador | Colaborador |
| --- | --- | --- |
| Proyectos y tableros | Gestiona todo el PH | Consulta los autorizados |
| Columnas y políticas | Gestiona | Denegado |
| Crear y asignar tareas | Sí | Solo si el proyecto lo permite |
| Editar tarea propia | Sí | Campos operativos autorizados |
| Editar tarea de otro | Sí | Denegado |
| Mover, comentar o adjuntar evidencia | Sí | Solo tareas asignadas |
| Bloquear tarea | Sí | Solo tareas asignadas; exige motivo |
| Aprobar o rechazar | Sí | Denegado |
| Personas y equipos | Gestiona | Denegado |
| Identificador personal completo | Cuando el flujo lo exige | Denegado |
| Informes | Todo el PH | Resumen personal |
| Documentos, formularios y proveedores | Gestiona | Uso autorizado |
| Archivar o restaurar | Sí | Denegado |

## Contrato puro para E1/E2

La implementación vivirá en `packages/domain` y no conocerá React, rutas ni almacenamiento.

```ts
export type Role = 'ADMIN' | 'COLLABORATOR';
export type Action =
  | 'project.read' | 'project.manage' | 'board.manage' | 'task.create'
  | 'task.read' | 'task.update' | 'task.assign' | 'task.move'
  | 'task.block' | 'task.validate' | 'people.manage' | 'people.readNationalId'
  | 'team.manage' | 'report.read' | 'resource.manage' | 'entity.archive';

export interface Actor {
  id: string;
  phId: string;
  role: Role;
  status: 'ACTIVE' | 'INACTIVE';
  projectIds: string[];
  teamIds: string[];
}

export interface AuthorizationResource {
  phId: string;
  projectId?: string;
  teamId?: string;
  assigneeId?: string;
  projectAllowsCollaboratorCreate?: boolean;
}

export function can(
  actor: Actor,
  action: Action,
  resource: AuthorizationResource,
): boolean;
```

El primer guard obligatorio de `can` será `actor.status === 'ACTIVE' && actor.phId === resource.phId`. Después se evalúan rol, propiedad de la tarea y asignación de proyecto/equipo. La validación es exclusiva de administradores. La API devuelve solo `boolean`; las capas de aplicación pueden acompañarlo con un motivo localizado para explicar una denegación.

## Casos de prueba mínimos

- Actor inactivo o de otro PH: denegado para toda acción.
- Administrador del mismo PH: permitido para gestión dentro del PH.
- Colaborador no asignado: no puede mover ni bloquear la tarea.
- Colaborador asignado: puede mover y bloquear su tarea, pero no asignarla ni validarla.
- Solo un administrador del mismo PH puede validar.
- Lectura de identificador personal: solo administrador y solo recurso del mismo PH.
