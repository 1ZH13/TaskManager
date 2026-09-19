# PRD — Plataforma de gestión de trabajo para propiedades horizontales

**Estado:** Borrador aprobado para iniciar diseño y desarrollo del frontend  
**Versión:** 1.0  
**Fecha:** 18 de septiembre de 2026  
**Repositorio objetivo:** `TaskManager`  
**Idioma del producto:** Español (`es-PA`)  
**Responsabilidad de esta fase:** Frontend funcional y contratos listos para integrar el backend

---

## 1. Resumen ejecutivo

TaskManager será una plataforma de gestión de proyectos y trabajo para administradoras de propiedades horizontales. El producto toma como referencia los patrones de Jira —proyectos, tableros, tareas, calendario, cronograma, equipos, documentos, formularios e informes— y los adapta a la operación de edificios.

Cada propiedad horizontal (PH) constituye un contexto completamente independiente. Sus proyectos, equipos, usuarios, tableros, tareas, documentos, formularios, informes y referencias de proveedores no se mezclan con los de otro PH.

El primer desarrollo será un frontend completo y navegable. Todos los botones, formularios, filtros, modales, cambios de estado, movimientos por arrastre y flujos principales deberán funcionar con datos simulados persistentes. El backend se añadirá después mediante contratos y repositorios ya definidos, sin reescribir las pantallas ni la lógica de presentación.

El producto debe mantener la identidad visual de PH Platform y aplicar una experiencia de trabajo compacta, clara y familiar para usuarios que conocen Jira. No se copiarán la marca, logotipos, ilustraciones ni recursos propietarios de Atlassian.

---

## 2. Problema

La administración de un PH distribuye trabajo entre administración, operaciones, limpieza, mantenimiento, seguridad y contabilidad. Las actividades suelen manejarse por mensajería, hojas de cálculo o instrucciones verbales, lo que dificulta:

- Saber quién es responsable de cada tarea.
- Identificar trabajo atrasado o estancado.
- Conservar evidencia de ejecución.
- Coordinar tareas recurrentes.
- Supervisar la carga de cada persona y equipo.
- Organizar actividades sobre un calendario.
- Relacionar tareas con proveedores.
- Mantener documentos y formularios en el contexto del proyecto.
- Generar informes verificables de cumplimiento.

TaskManager centralizará estos flujos en una herramienta especializada en la operación de edificios.

---

## 3. Objetivos

### 3.1 Objetivos del producto

1. Organizar proyectos administrativos, operativos y contables de cada PH.
2. Permitir que administradores creen equipos, proyectos, tableros y flujos de trabajo.
3. Permitir que cada colaborador consulte y actualice exclusivamente el trabajo autorizado.
4. Representar las mismas tareas como tablero, lista, calendario y cronograma.
5. Registrar responsables, fechas, bloqueos, subtareas, evidencias y validaciones.
6. Mostrar informes de trabajo pendiente, vencido, terminado y distribuido por persona.
7. Preparar una integración limpia con el maestro de proveedores de PH Platform.
8. Permitir conectar posteriormente un backend sin cambiar la interfaz pública de los componentes.

### 3.2 Objetivos de esta fase

- Construir un frontend completamente interactivo.
- Cubrir todos los recorridos de demostración con datos simulados.
- Persistir localmente los cambios para sobrevivir recargas del navegador.
- Definir modelos Zod y TypeScript compartidos.
- Definir contratos de repositorio y endpoints esperados.
- Incluir estados de carga, vacío, error y permisos.
- Entregar diseño adaptable para escritorio, tableta y móvil.

### 3.3 Fuera de alcance en esta fase

- Base de datos de producción.
- Autenticación real.
- Sincronización real con PH Platform.
- Almacenamiento real de archivos.
- Envío de correos o notificaciones push.
- Automatizaciones ejecutadas por servidor.
- Auditoría jurídica o certificación de cumplimiento.
- Funciones de Jira relacionadas con desarrollo de software, código, despliegues o repositorios.

Estas capacidades tendrán simulaciones o puertos de integración cuando sean necesarias para completar el recorrido del frontend.

---

## 4. Principios del producto

1. **Aislamiento por PH:** ningún dato de un PH aparece en otro contexto.
2. **Una tarea, varias vistas:** tablero, lista, calendario, cronograma e informes leen la misma entidad.
3. **Permisos explícitos:** ocultar una pantalla no sustituye la autorización del backend futuro.
4. **Configuración antes que duplicación:** los módulos comparten componentes y cambian por configuración.
5. **Interacción completa:** ningún botón visible debe ser decorativo.
6. **Evidencia y trazabilidad:** los cambios relevantes producen eventos de actividad.
7. **Conexión reemplazable:** las pantallas consumen interfaces de repositorio, no `localStorage` ni `fetch` directamente.
8. **Accesibilidad:** teclado, foco visible, etiquetas, contraste y alternativas al arrastre.

---

## 5. Arquitectura de información

```text
Administradora
└── Propiedad horizontal (contexto aislado)
    ├── Gestión administrativa
        └── Proyecto
            ├── Resumen
            ├── Lista
            ├── Tablero
            ├── Calendario
            ├── Cronograma
            ├── Documentos
            ├── Formularios
            └── Informes
    ├── Gestión operativa
        └── Proyecto
            ├── Resumen
            ├── Lista
            ├── Tablero
            ├── Calendario
            ├── Cronograma
            ├── Documentos
            ├── Formularios
            └── Informes
    └── Gestión de contabilidad
        └── Proyecto
            ├── Resumen
            ├── Lista
            ├── Tablero
            ├── Calendario
            ├── Cronograma
            ├── Documentos
            ├── Formularios
            └── Informes
```

### 5.1 Módulos de gestión

Los tres módulos estarán separados en navegación, filtros, permisos e informes, pero utilizarán el mismo motor de trabajo.

#### Gestión administrativa


- Reuniones y actas.
- Permisos y trámites.
- Correspondencia.
- Seguimientos administrativos.
- Documentación del PH.

#### Gestión operativa

- Limpieza.
- Mantenimiento.
- Seguridad.
- Inspecciones.
- Reparaciones.
- Incidencias y evidencias.
- Actividades recurrentes.

#### Gestión de contabilidad

- Cierres mensuales.
- Conciliaciones pendientes.
- Revisión documental.
- Seguimiento de facturas.
- Validaciones.
- Entrega de informes.
- Tareas vinculadas con proveedores.
- Seguimientos de cobro.

El módulo contable organiza trabajo; no replica el motor contable de PH Platform.

### 5.2 Relación entre proyectos, equipos y tableros

- Un PH contiene múltiples proyectos.
- Cada proyecto pertenece a un módulo de gestión.
- Un proyecto puede incluir uno o varios equipos.
- Un proyecto puede tener uno o varios tableros.
- Un tablero puede asignarse a uno o varios equipos.
- Una persona puede pertenecer a varios equipos.
- Los permisos determinan qué proyectos y tableros puede consultar cada persona.

---

## 6. Usuarios y roles

### 6.1 Administrador del PH

Puede:

- Gestionar módulos, proyectos, tableros y columnas.
- Crear personas y equipos.
- Asignar líderes y miembros.
- Crear, editar, asignar y archivar tareas.
- Configurar formularios.
- Gestionar documentos.
- Consultar todos los informes del PH.
- Configurar políticas de validación.
- Consultar todos los proyectos y equipos del PH.
- Crear y asignar tareas.
- Revisar evidencias.
- Aprobar o rechazar trabajo terminado.
- Consultar todos los informes del PH.

### 6.2 Colaborador

Puede:

- Ver proyectos y tableros autorizados.
- Consultar sus tareas.
- Cambiar el estado de sus tareas.
- Informar un bloqueo con motivo.
- Añadir comentarios y evidencias.
- Enviar tareas a validación.

### 6.3 Perfiles especializados

Limpieza, mantenimiento, seguridad y contabilidad se modelarán como equipos o perfiles de colaborador con permisos configurables. No se duplicarán aplicaciones para cada oficio.

---

## 7. Navegación principal

### 7.1 Selector de PH

- Muestra los PH a los que el usuario tiene acceso.
- Conserva el último contexto seleccionado.
- Cambiar de PH reemplaza todos los proyectos, equipos y datos visibles.
- Una URL con un PH no autorizado muestra acceso denegado y vuelve a un contexto permitido.

### 7.2 Navegación global del PH

- Inicio.
- Gestión administrativa.
- Gestión operativa.
- Gestión de contabilidad.
- Personas.
- Equipos.
- Proveedores.
- Informes generales.
- Configuración.

### 7.3 Navegación del proyecto

- Resumen.
- Lista.
- Tablero.
- Calendario.
- Cronograma.
- Documentos.
- Formularios.
- Informes.

La pestaña activa debe representarse en la URL para permitir recargar y compartir enlaces.

---

## 8. Requisitos funcionales

## 8.1 Proyectos

El usuario autorizado podrá:

- Crear un proyecto dentro de un PH y módulo.
- Definir nombre, clave, descripción, icono, color y fechas.
- Seleccionar equipos participantes.
- Crear el proyecto a partir de una plantilla.
- Archivar y restaurar proyectos.
- Cambiar entre proyectos desde la navegación.

Plantillas iniciales:

- Gestión administrativa.
- Gestión operativa.
- Gestión de contabilidad.
- Kanban vacío.

## 8.2 Tableros y columnas

Cada tablero nuevo incluirá cuatro columnas predeterminadas:

1. No empezada.
2. En proceso.
3. Estancada.
4. Terminada.

Las columnas son totalmente configurables. El administrador podrá:

- Crear columnas nuevas.
- Cambiar el nombre y color.
- Mover columnas entre las existentes mediante arrastre o controles de teclado.
- Eliminar cualquiera de las columnas, incluidas las cuatro predeterminadas.
- Elegir a qué columna se trasladan las tareas antes de eliminar una columna con contenido.
- Definir cuál columna representa el inicio, bloqueo o finalización para los informes.
- Impedir que un tablero quede sin columnas.

El sistema no debe depender de nombres visibles para calcular informes. Cada columna tendrá una categoría semántica:

```ts
type StatusCategory = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE';
```

Varias columnas pueden compartir una categoría. Ejemplo: “En revisión” y “En ejecución” pueden pertenecer a `IN_PROGRESS`.

### Interacciones del tablero

- Crear tarea dentro de una columna.
- Arrastrar tareas entre columnas.
- Reordenar tareas dentro de una columna.
- Mover mediante menú para usuarios que no arrastren.
- Buscar por clave o texto.
- Filtrar por responsable, equipo, prioridad, tipo, proveedor y fecha.
- Agrupar por responsable, equipo, prioridad o tipo.
- Abrir el detalle sin perder filtros ni posición.
- Mostrar conteo de tareas por columna.

## 8.3 Tareas

Campos iniciales:

- Identificador legible, por ejemplo `OPS-024`.
- Título.
- Descripción enriquecida básica.
- Tipo.
- Columna y categoría de estado.
- Prioridad.
- Responsable.
- Equipo.
- Creador.
- Proyecto y tablero.
- Proveedor opcional.
- Fecha de inicio.
- Fecha de vencimiento.
- Etiquetas.
- Subtareas.
- Archivos y evidencias.
- Comentarios.
- Regla de recurrencia opcional.
- Motivo de bloqueo.
- Historial de actividad.

Tipos iniciales:

- Tarea.
- Tarea recurrente.
- Incidencia.
- Subtarea.
- Hito.

Prioridades:

- Baja.
- Media.
- Alta.
- Urgente.

## 8.4 Flujo y validación

```text
Administrador crea y asigna tarea
→ colaborador inicia tarea
→ colaborador puede marcarla como estancada con motivo
→ colaborador adjunta evidencia
→ termina la tarea
→ si requiere validación, un administrador aprueba o rechaza
→ si es rechazada, regresa a una columna activa configurada
```

- Marcar como estancada exige un motivo.
- La política del proyecto determina si terminar exige evidencia.
- La política determina si terminar exige validación.
- La validación corresponde a los administradores autorizados del PH.
- El rechazo exige comentario.
- Todo cambio se registra en actividad.

## 8.5 Tareas recurrentes

- Frecuencia diaria, semanal, mensual o personalizada.
- Fecha de inicio obligatoria.
- Fecha final o número de repeticiones.
- Responsable o equipo obligatorio.
- La interfaz mostrará próximas ocurrencias.
- En esta fase, las ocurrencias podrán simularse en el repositorio local.

## 8.6 Lista

- Tabla de todas las tareas autorizadas.
- Columnas configurables.
- Ordenamiento y filtros.
- Edición rápida de estado, responsable, prioridad y fechas.
- Selección múltiple simulada.
- Exportación visual a CSV como mejora posterior; el contrato quedará previsto.

## 8.7 Calendario

- Vistas mensual, semanal y agenda.
- Navegación anterior, siguiente y hoy.
- Panel de tareas sin programar.
- Arrastrar una tarea al calendario asigna su fecha.
- Arrastrarla entre días cambia su fecha.
- Crear una tarea desde un día preasigna la fecha.
- Abrir el detalle desde el evento.
- Diferenciar visualmente atrasadas, bloqueadas y terminadas.
- Filtrar por proyecto, tablero, equipo, persona, tipo y estado.
- Mostrar recurrencias y vencimientos.
- Incluir alternativa accesible para cambiar fecha sin arrastrar.

## 8.8 Cronograma

- Vista tipo Gantt.
- Fechas de inicio y fin.
- Fases e hitos.
- Dependencias entre tareas.
- Porcentaje de avance.
- Alertas de retraso.
- Cambio de fechas mediante controles y, si es viable, arrastre.
- Zoom por semana, mes y trimestre.

## 8.9 Personas

Cada ficha contendrá:

- Nombre.
- Apellido.
- Cédula o identificador.
- Nombre visible.
- Avatar o iniciales.
- Cargo.
- Rol.
- Equipos.
- Estado activo o inactivo.
- Carga de trabajo resumida.

La cédula completa no debe mostrarse en tarjetas generales. Solo se presenta donde el permiso y el flujo administrativo lo requieran.

## 8.10 Equipos

- Crear, editar y archivar equipos.
- Definir nombre, tipo, descripción, líder y miembros.
- Asociar proyectos y tableros.
- Mostrar carga y tareas pendientes.
- Permitir que una persona pertenezca a varios equipos.
- Tipos sugeridos: administración, operaciones, limpieza, mantenimiento, seguridad y contabilidad.

## 8.11 Documentos

- Lista y cuadrícula.
- Carga simulada de archivos.
- Nombre, tipo, tamaño, responsable y fecha.
- Relación con proyecto, tarea, proveedor o equipo.
- Búsqueda y filtros.
- Vista previa simulada cuando sea posible.
- Descargar y eliminar dentro del frontend simulado.

Los archivos se representarán como metadatos y URLs locales durante esta fase. El contrato futuro utilizará almacenamiento privado.

## 8.12 Formularios
- Formularios de agendar cita con administracion, tiene que tener RUC, DV, el nombre de la persona que va asistir, tiene que tener un calendario con dia y hora.
- Formulario de envio de facturas, el form tiene que tener una factura fiscal, precio y el ITBMS.
- crearlo en un HTML aparte.
- Crear formularios desde plantillas.
- Añadir campos de texto, texto largo, selección, fecha, persona, proveedor, archivo y prioridad.
- Marcar campos obligatorios.
- Vista previa y publicación simulada.
- Cada envío puede crear una tarea en un proyecto, tablero y columna configurados.

Plantillas iniciales:

- Reportar incidencia.
- Solicitar mantenimiento.
- Registrar inspección.
- Solicitar tarea administrativa.
- Solicitar revisión contable.

## 8.13 Informes

Indicadores:

- Pendientes.
- Terminadas en los últimos siete días.
- Creadas y actualizadas.
- Próximas a vencer.
- Atrasadas.
- Estancadas.
- Tiempo promedio de resolución.
- Porcentaje de cumplimiento.

Gráficas:

- Tareas por categoría de estado.
- Tareas por tipo.
- Tareas por responsable.
- Tareas por equipo.
- Tareas por prioridad.
- Carga por persona.
- Cumplimiento por periodo.

Filtros:

- PH.
- Módulo.
- Proyecto.
- Tablero.
- Equipo.
- Persona.
- Proveedor.
- Rango de fechas.

Los informes deben derivarse de los datos de tareas. No se mantendrán cifras simuladas independientes.

## 8.14 Proveedores

La navegación utilizará el nombre **Proveedores**. Los proveedores procederán en el futuro del maestro de proveedores de PH Platform.

Durante esta fase:

- Existirá un catálogo simulado con el mismo contrato esperado.
- Se podrá buscar y consultar un proveedor.
- Se podrá relacionar un proveedor con proyectos, tareas, documentos y formularios.
- Se mostrarán sus tareas abiertas y actividad relacionada.
- Se mostrará el estado de sincronización simulado.

La gestión financiera, facturas, cuentas bancarias y pagos permanecerán en PH Platform.

## 8.15 Actividad y notificaciones

- Línea de actividad por tarea y proyecto.
- Eventos de creación, edición, asignación, movimiento, comentario, evidencia y validación.
- Centro de notificaciones simulado.
- Marcar notificaciones como leídas.
- Contrato preparado para notificaciones reales posteriores.

---

## 9. Modelo de dominio

Todas las entidades de negocio incluirán `id`, `phId`, `createdAt`, `updatedAt` y, cuando aplique, `version`. `phId` será obligatorio para impedir cruces accidentales entre propiedades.

### 9.1 Entidades principales

```ts
type ManagementModule = 'ADMINISTRATIVE' | 'OPERATIONS' | 'ACCOUNTING';
type StatusCategory = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE';
type WorkItemType = 'TASK' | 'RECURRING_TASK' | 'INCIDENT' | 'SUBTASK' | 'MILESTONE';
type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

interface PropertyContext {
  id: string;
  name: string;
  code: string;
  status: 'ACTIVE' | 'INACTIVE';
}

interface Project {
  id: string;
  phId: string;
  module: ManagementModule;
  key: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  startsOn?: string;
  endsOn?: string;
  status: 'ACTIVE' | 'ARCHIVED';
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface Board {
  id: string;
  phId: string;
  projectId: string;
  name: string;
  teamIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface BoardColumn {
  id: string;
  phId: string;
  boardId: string;
  name: string;
  category: StatusCategory;
  color: string;
  position: number;
}

interface WorkItem {
  id: string;
  phId: string;
  projectId: string;
  boardId: string;
  columnId: string;
  key: string;
  type: WorkItemType;
  title: string;
  description?: string;
  priority: Priority;
  reporterId: string;
  assigneeId?: string;
  teamId?: string;
  providerId?: string;
  parentId?: string;
  startsOn?: string;
  dueOn?: string;
  blockedReason?: string;
  requiresEvidence: boolean;
  requiresValidation: boolean;
  position: number;
  labels: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface Person {
  id: string;
  phId: string;
  nationalId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatarUrl?: string;
  jobTitle?: string;
  role: 'ADMIN' | 'COLLABORATOR';
  status: 'ACTIVE' | 'INACTIVE';
}

interface Team {
  id: string;
  phId: string;
  name: string;
  type: 'ADMINISTRATION' | 'OPERATIONS' | 'CLEANING' | 'MAINTENANCE' | 'SECURITY' | 'ACCOUNTING' | 'OTHER';
  description?: string;
  leadId?: string;
  memberIds: string[];
  status: 'ACTIVE' | 'ARCHIVED';
}

interface ProviderReference {
  id: string;
  phId: string;
  externalId: string;
  source: 'PH_PLATFORM';
  name: string;
  legalName?: string;
  taxId?: string;
  status: 'ACTIVE' | 'INACTIVE';
  syncedAt?: string;
}
```

### 9.2 Entidades complementarias

- `ProjectMember`.
- `TeamMembership`.
- `WorkItemTransition`.
- `WorkItemComment`.
- `Attachment`.
- `RecurrenceRule`.
- `TaskValidation`.
- `Dependency`.
- `ActivityEvent`.
- `FormDefinition`.
- `FormField`.
- `FormSubmission`.
- `ProjectDocument`.
- `SavedFilter`.
- `Notification`.

Los contratos definitivos se declararán con Zod y sus tipos se inferirán con `z.infer` para evitar modelos duplicados.

---

## 10. Arquitectura del frontend

## 10.1 Stack

- Node.js 24.
- pnpm 11.
- pnpm workspaces.
- Turborepo.
- Next.js 16 con App Router.
- React 19.
- TypeScript 5.9 estricto.
- Tailwind CSS 4 y variables CSS.
- next-intl con locale inicial `es-PA`.
- Zod 4 para contratos.
- TanStack React Table para listas.
- `@dnd-kit/core` y `@dnd-kit/sortable` para arrastre accesible.
- `date-fns` para fechas.
- Recharts para gráficas.
- Lucide React para iconografía consistente.
- Vitest, Testing Library y jsdom.
- ESLint, Prettier, Husky y commitlint.

## 10.2 Estructura recomendada

```text
apps/
  web/                 Aplicación Next.js
packages/
  config/              TypeScript, ESLint y Prettier compartidos
  domain/              Reglas puras y selectores de informes
  shared/              Esquemas Zod, tipos y contratos API
  ui/                  Componentes visuales y tokens
  data/                Repositorios local y HTTP
docs/
  PRD.md
```

## 10.3 Patrón de datos reemplazable

Los componentes utilizarán servicios inyectables:

```ts
interface WorkManagementRepository {
  listProjects(query: ProjectQuery): Promise<Project[]>;
  getProject(id: string): Promise<Project>;
  listBoards(projectId: string): Promise<Board[]>;
  listWorkItems(query: WorkItemQuery): Promise<Page<WorkItem>>;
  createWorkItem(input: CreateWorkItemInput): Promise<WorkItem>;
  updateWorkItem(id: string, input: UpdateWorkItemInput): Promise<WorkItem>;
  moveWorkItem(input: MoveWorkItemInput): Promise<WorkItem>;
  listPeople(query: PeopleQuery): Promise<Person[]>;
  listTeams(query: TeamQuery): Promise<Team[]>;
  listProviders(query: ProviderQuery): Promise<ProviderReference[]>;
}
```

Implementaciones:

- `LocalWorkManagementRepository`: fase actual, datos de demostración persistidos en IndexedDB o almacenamiento local versionado.
- `HttpWorkManagementRepository`: fase posterior, consume la API real.

Los componentes no importarán ninguna implementación concreta.

## 10.4 Estado del frontend

- Estado remoto simulado encapsulado en repositorios.
- Filtros representados en la URL cuando puedan compartirse.
- Preferencias visuales locales: sidebar, densidad y última vista.
- Semillas deterministas para restaurar la demostración.
- Acción visible “Restablecer datos de demostración” solo en modo desarrollo.

---

## 11. Contrato esperado del backend futuro

La API se diseñará con Hono, OpenAPI y Zod, siguiendo el patrón de PH Platform. Rutas sugeridas:

```text
GET    /api/me
GET    /api/properties
GET    /api/properties/{phId}/projects
POST   /api/properties/{phId}/projects
GET    /api/projects/{projectId}
PATCH  /api/projects/{projectId}
GET    /api/projects/{projectId}/boards
POST   /api/projects/{projectId}/boards
POST   /api/boards/{boardId}/columns
PATCH  /api/boards/{boardId}/columns/{columnId}
POST   /api/boards/{boardId}/columns/reorder
DELETE /api/boards/{boardId}/columns/{columnId}
GET    /api/projects/{projectId}/work-items
POST   /api/projects/{projectId}/work-items
GET    /api/work-items/{workItemId}
PATCH  /api/work-items/{workItemId}
POST   /api/work-items/{workItemId}/move
POST   /api/work-items/{workItemId}/comments
POST   /api/work-items/{workItemId}/attachments
POST   /api/work-items/{workItemId}/validation
GET    /api/properties/{phId}/people
GET    /api/properties/{phId}/teams
GET    /api/properties/{phId}/providers
GET    /api/projects/{projectId}/reports
GET    /api/projects/{projectId}/documents
GET    /api/projects/{projectId}/forms
POST   /api/forms/{formId}/submissions
```

### Reglas del contrato

- JSON en `camelCase`.
- Fechas ISO 8601.
- UUID interno y clave legible por proyecto.
- Paginación por cursor.
- Filtros mediante parámetros de consulta.
- Errores uniformes con `code`, `message`, `requestId` y `details`.
- Control de concurrencia mediante `version` o ETag.
- Idempotencia para movimientos y envíos de formularios.
- Toda respuesta de negocio mantiene `phId`.
- El backend verifica permisos y aislamiento aunque el frontend ya filtre.

---

## 12. Backend recomendado para la fase posterior

- Supabase PostgreSQL.
- Supabase Auth.
- Supabase Storage privado.
- Row Level Security forzada por PH.
- Hono dentro de Next.js para la API.
- OpenAPI generado desde Zod.
- Pino y OpenTelemetry.
- Historial de actividad append-only.

Tablas principales previstas:

- `properties`.
- `memberships`.
- `projects`.
- `project_members`.
- `boards`.
- `board_columns`.
- `work_items`.
- `work_item_transitions`.
- `comments`.
- `attachments`.
- `teams`.
- `team_memberships`.
- `recurrence_rules`.
- `task_validations`.
- `dependencies`.
- `documents`.
- `form_definitions`.
- `form_submissions`.
- `provider_references`.
- `activity_events`.

---

## 13. Sistema visual

## 13.1 Dirección

- Identidad de PH Platform.
- Densidad y claridad de una herramienta profesional de trabajo.
- Sidebar marino oscuro.
- Superficies blancas y grises suaves.
- Azul reservado para selección y acciones.
- Estados comunicados mediante texto, icono y color.
- Tarjetas compactas, bordes suaves y sombras discretas.

## 13.2 Tipografía

Familia principal:

```css
font-family: Inter, ui-sans-serif, system-ui, -apple-system,
  BlinkMacSystemFont, "Segoe UI", sans-serif;
```

Se cargará Inter mediante `next/font`.

Escala sugerida:

- 12 px: metadatos y etiquetas.
- 14 px: controles y contenido compacto.
- 16 px: cuerpo principal.
- 20 px: encabezados de sección.
- 24–28 px: título de página.

## 13.3 Tokens de color

```css
:root {
  --color-brand-950: #071b33;
  --color-brand-900: #0b2037;
  --color-brand-700: #244e73;
  --color-brand-500: #4583bd;

  --color-surface: #ffffff;
  --color-surface-subtle: #f8fafc;
  --color-surface-muted: #f3f5f8;
  --color-border: #dce1e5;
  --color-border-subtle: #e3e8ef;

  --color-text: #0b2037;
  --color-text-muted: #526071;

  --color-success: #245e40;
  --color-success-bg: #eaf5ef;
  --color-warning: #795213;
  --color-warning-bg: #fff4d6;
  --color-danger: #912f28;
  --color-danger-bg: #fff0ee;
  --color-info: #244e73;
  --color-info-bg: #e9f1fb;
}
```

Colores iniciales del flujo:

- No empezada: gris azulado.
- En proceso: azul.
- Estancada: ámbar.
- Terminada: verde.

El administrador puede cambiar el color de una columna, manteniendo contraste accesible.

## 13.4 Forma y espaciado

- Unidad base: 4 px.
- Controles: 36–40 px de alto en escritorio; mínimo táctil 44 px en móvil.
- Radio pequeño: 6 px.
- Radio de controles: 8 px.
- Radio de tarjetas: 12 px.
- Paneles y modales: 14–16 px.
- Sombras de baja opacidad y sin relieve excesivo.
- Sidebar expandido: aproximadamente 272 px.
- Sidebar colapsado: aproximadamente 72 px.

## 13.5 Componentes base

- AppShell.
- Sidebar.
- ContextSwitcher.
- ProjectHeader.
- ProjectTabs.
- Button e IconButton.
- Input, Select, Combobox y DatePicker.
- Dialog y Drawer.
- DropdownMenu.
- DataTable.
- KanbanBoard, KanbanColumn y WorkItemCard.
- UserAvatar y TeamBadge.
- StatusBadge y PriorityBadge.
- Calendar y UnscheduledPanel.
- Timeline.
- FileDropzone.
- ChartCard y MetricCard.
- EmptyState, ErrorState y Skeleton.
- Toast y ConfirmDialog.

## 13.6 Diseño adaptable

- Escritorio: tablero horizontal completo y panel lateral.
- Tableta: sidebar colapsable y tablero desplazable.
- Móvil: navegación mediante drawer, columnas por selector o desplazamiento y detalle a pantalla completa.
- El trabajador operativo debe poder cambiar estado y adjuntar evidencia desde un teléfono.

---

## 14. Accesibilidad

- Cumplimiento objetivo WCAG 2.2 AA.
- Navegación completa por teclado.
- Foco visible.
- Etiquetas accesibles en iconos.
- Alternativa de menú para todas las acciones de arrastre.
- Anuncios para lectores de pantalla al mover una tarea.
- No comunicar estados solamente con color.
- Contraste mínimo verificable.
- Respeto a `prefers-reduced-motion`.

---

## 15. Estados de interfaz obligatorios

Cada superficie debe incluir:

- Cargando.
- Sin datos.
- Sin resultados de búsqueda.
- Error recuperable.
- Acceso denegado.
- Datos desactualizados o conflicto de versión.
- Confirmación antes de acciones destructivas.
- Éxito mediante mensaje no intrusivo.

La eliminación de una columna con tareas requiere elegir una columna destino antes de confirmar.

---

## 16. Datos de demostración

El frontend incluirá al menos:

- Dos PH para demostrar aislamiento.
- Tres módulos por PH.
- Tres proyectos, al menos uno por cada módulo.
- Dos equipos.
- Cuatro personas distribuidas entre administradores y colaboradores.
- Dos proveedores sincronizados simulados.
- Varios tableros(2) con configuraciones distintas.
- Una columna personalizada colocada entre columnas predeterminadas.
- Tareas normales, recurrentes, atrasadas, estancadas y terminadas.
- Evidencias simuladas.
- Documentos y formularios.
- Datos suficientes para alimentar todas las gráficas.

---

## 17. Criterios generales de aceptación

1. Cambiar de PH reemplaza completamente los datos visibles.
2. Los tres módulos muestran proyectos independientes.
3. Crear o modificar una tarea actualiza tablero, lista, calendario, cronograma e informes.
4. Las tareas pueden moverse por arrastre y mediante controles accesibles.
5. Las columnas pueden crearse, reordenarse, editarse y eliminarse.
6. Las cuatro columnas iniciales también pueden eliminarse.
7. No se puede eliminar una columna con tareas sin seleccionar un destino.
8. Los informes se calculan desde los mismos datos de trabajo.
9. Los filtros pueden combinarse y restablecerse.
10. Un colaborador solo ve los proyectos, tableros y tareas autorizados en el modo de demostración.
11. Los datos sobreviven una recarga.
12. Todos los botones visibles realizan una acción o explican por qué está deshabilitada.
13. La interfaz funciona en escritorio y móvil.
14. Los componentes no dependen directamente del mecanismo local de persistencia.
15. Sustituir el repositorio local por el HTTP no exige reescribir las vistas.

---

## 18. Fases de implementación del frontend

### Fase 0 — Base

- Monorepo y configuración.
- Tokens y componentes base.
- Modelos Zod.
- Repositorio local.
- Datos semilla.
- App shell y selector de PH.

### Fase 1 — Organización

- Módulos de gestión.
- Proyectos.
- Personas.
- Equipos.
- Permisos simulados.

### Fase 2 — Trabajo principal

- Tablero.
- Columnas configurables.
- CRUD de tareas.
- Detalle.
- Arrastre.
- Subtareas, comentarios y actividad.

### Fase 3 — Vistas sincronizadas

- Lista.
- Calendario.
- Cronograma.
- Recurrencias.

### Fase 4 — Recursos

- Documentos.
- Formularios.
- Proveedores simulados y contratos de integración.

### Fase 5 — Informes y cierre

- Métricas y gráficas.
- Estados vacíos y errores.
- Diseño adaptable.
- Accesibilidad.
- Recorrido integral de demostración.

---

## 19. Pruebas necesarias

Se priorizarán pruebas que protejan los contratos y recorridos críticos:

- Aislamiento de datos por PH.
- Movimiento de tareas entre columnas.
- Creación, reordenamiento y eliminación de columnas.
- Traslado obligatorio de tareas al eliminar una columna.
- Sincronización entre tablero, lista, calendario e informes.
- Restricciones visuales por rol.
- Persistencia y migración de datos locales.
- Validación de formularios.
- Cálculo de indicadores.

No se crearán pruebas triviales que solo repitan la implementación visual.

---

## 20. Riesgos y decisiones

| Riesgo | Decisión |
|---|---|
| Construir pantallas desconectadas entre sí | Una entidad de tarea y repositorio único para todas las vistas. |
| Acoplar componentes a datos simulados | Interfaces de repositorio y adaptadores separados. |
| Confundir nombres de columnas con estados de informes | Categoría semántica independiente del nombre visible. |
| Mezclar información entre PH | `phId` obligatorio y filtros de contexto en todas las consultas. |
| Depender exclusivamente de arrastrar | Menús y controles de teclado equivalentes. |
| Intentar copiar Jira literalmente | Usar patrones funcionales con identidad visual propia. |
| Integración difícil con proveedores | `externalId`, `source` y contrato de referencia desde el inicio. |
| Demo inconsistente después de recargar | Persistencia local versionada y restauración determinista. |

---

## 21. Definición de terminado de esta fase

El frontend se considera listo cuando:

- Todos los módulos y pestañas del alcance son navegables.
- Los recorridos principales funcionan de extremo a extremo con datos simulados.
- No existen controles principales sin comportamiento.
- El tablero admite columnas completamente configurables.
- Calendario, lista, cronograma e informes reflejan los mismos datos.
- Personas, equipos y permisos simulados afectan las vistas.
- Proveedores utilizan un contrato compatible con la integración futura.
- Los cambios sobreviven recargas.
- Existe una experiencia móvil utilizable.
- Los modelos y contratos están documentados y validados con Zod.
- La capa local puede sustituirse por una capa HTTP sin alterar los componentes de producto.

---

## 22. Decisiones confirmadas

- El producto está enfocado en la gestión de proyectos de edificios y PH.
- Cada PH es independiente.
- Existen módulos separados para gestión administrativa, operativa y contable.
- Se incluyen tablero, lista, calendario, cronograma, documentos, formularios, personas, equipos, informes y proveedores.
- Los tableros comienzan con cuatro columnas predeterminadas.
- El usuario puede crear columnas nuevas y colocarlas entre las existentes.
- Todas las columnas pueden moverse o eliminarse.
- Los tableros pueden vincularse con equipos diferentes.
- Los informes incluyen pendientes y distribución por persona, equipo, estado, tipo y prioridad.
- Proveedores se conectará posteriormente con el maestro de proveedores de PH Platform.
- Esta fase entrega exclusivamente el frontend funcional y la base contractual para el backend.

---

## 23. Pendientes de identidad que no bloquean el inicio

- Nombre comercial definitivo.
- Logotipo.
- Claves visibles definitivas de los módulos.
- Texto final de las cuatro columnas iniciales.
- Datos exactos del proveedor que expondrá PH Platform.

Estas decisiones pueden resolverse sin modificar la arquitectura descrita.
