'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowDown, ArrowUp, GripVertical, Pencil, SlidersHorizontal, Trash2 } from 'lucide-react';
import { can } from '@task-manager/domain';
import type { BoardColumn, Person, WorkItem } from '@task-manager/shared';
import { Button, IconButton } from '../../../../packages/ui/src/index';
import { AccessibleDialog } from './accessible-dialog';
import { useDemo } from './demo-context';

const fields = {
  key: 'ID de la tarea',
  title: 'Nombre de la tarea',
  description: 'Descripción de la tarea',
  recurrence: 'Recurrencia',
  state: 'Estado',
  assignee: 'Responsable',
  priority: 'Prioridad',
  startsOn: 'Inicio',
  dueOn: 'Vencimiento',
  actions: 'Acciones',
} as const;
type Field = keyof typeof fields;
const defaults: Field[] = ['key', 'title', 'description', 'recurrence', 'state', 'actions'];
const isField = (value: string): value is Field => Object.hasOwn(fields, value);
const priorities = { LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', URGENT: 'Urgente' };
const priorityRank = { LOW: 0, MEDIUM: 1, HIGH: 2, URGENT: 3 };
const frequencies = {
  DAILY: 'Diaria',
  WEEKLY: 'Semanal',
  MONTHLY: 'Mensual',
  ANNUAL: 'Anual',
  CUSTOM: 'Personalizada',
};

/** Ignore unknown/duplicate URL fields, but always retain identity and task actions. */
export function tableFields(value: string | null): Field[] {
  if (!value) return defaults;
  const selected = [...new Set(value.split(',').filter(isField))];
  if (!selected.length) return defaults;
  return [
    'key',
    'title',
    ...selected.filter((field) => !['key', 'title', 'actions'].includes(field)),
    'actions',
  ];
}

export function TaskTable({
  items,
  columns,
  people,
  pending,
  move,
  onEdit,
  onDelete,
  href,
}: {
  items: WorkItem[];
  columns: BoardColumn[];
  people: Person[];
  pending: boolean;
  move: (item: WorkItem, columnId: string) => void;
  onEdit: (item: WorkItem) => void;
  onDelete: (item: WorkItem) => void;
  href: (item: WorkItem) => string;
}) {
  const { actor } = useDemo();
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [configuring, setConfiguring] = useState(false);
  const dragging = useRef<Field | null>(null);
  const visible = tableFields(params.get('fields'));
  const sortParam = params.get('sort') ?? '';
  const sort = isField(sortParam) && sortParam !== 'actions' ? sortParam : null;
  const descending = params.get('direction') === 'desc';
  const changeQuery = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
  };
  const changeFields = (next: Field[]) => changeQuery({ fields: next.join(',') });
  const movable = (field: Field) => !['key', 'title', 'actions'].includes(field);
  const reorder = (field: Field, target: Field) => {
    if (!movable(field) || !movable(target) || field === target) return;
    const next = [...visible];
    const from = next.indexOf(field);
    const to = next.indexOf(target);
    if (from < 0 || to < 0) return;
    next.splice(from, 1);
    next.splice(to, 0, field);
    changeFields(next);
  };
  const value = (item: WorkItem, field: Field): string | number => {
    if (field === 'state') return columns.find((column) => column.id === item.columnId)?.name ?? '';
    if (field === 'assignee')
      return people.find((person) => person.id === item.assigneeId)?.displayName ?? '';
    if (field === 'priority') return priorityRank[item.priority];
    if (field === 'recurrence')
      return item.recurrence ? frequencies[item.recurrence.frequency] : 'No recurrente';
    if (field === 'actions') return '';
    return item[field] ?? '';
  };
  const sorted = sort
    ? [...items].sort((a, b) => {
        const left = value(a, sort);
        const right = value(b, sort);
        if (left === '' || right === '') return left === right ? 0 : left === '' ? 1 : -1;
        const comparison =
          typeof left === 'number' && typeof right === 'number'
            ? left - right
            : String(left).localeCompare(String(right), 'es', { numeric: true });
        return descending ? -comparison : comparison;
      })
    : items;
  const renderCell = (item: WorkItem, field: Field) => {
    if (field === 'key') return <span className="task-key">{item.key}</span>;
    if (field === 'title')
      return (
        <Link className="task-title-link" href={href(item)}>
          {item.title}
        </Link>
      );
    if (field === 'state')
      return (
        <select
          disabled={pending || !can(actor, 'task.move', item)}
          aria-label={`Estado de ${item.title}`}
          value={item.columnId}
          onChange={(event) => move(item, event.target.value)}
        >
          {columns
            .filter((column) => column.boardId === item.boardId)
            .map((column) => (
              <option key={column.id} value={column.id}>
                {column.name}
              </option>
            ))}
        </select>
      );
    if (field === 'actions')
      return (
        <div className="task-table__actions">
          {can(actor, 'task.update', item) && (
            <IconButton
              disabled={pending}
              label={`Editar ${item.title}`}
              onClick={() => onEdit(item)}
            >
              <Pencil size={16} />
            </IconButton>
          )}
          {can(actor, 'board.manage', item) && (
            <IconButton
              disabled={pending}
              label={`Eliminar ${item.title}`}
              onClick={() => {
                if (window.confirm(`¿Eliminar ${item.title}?`)) onDelete(item);
              }}
            >
              <Trash2 size={16} />
            </IconButton>
          )}
        </div>
      );
    if (field === 'priority')
      return (
        <span className="table-priority" data-priority={item.priority}>
          {priorities[item.priority]}
        </span>
      );
    if (field === 'startsOn' || field === 'dueOn')
      return item[field] ? (
        <time dateTime={item[field]}>
          {new Intl.DateTimeFormat('es-PA', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            timeZone: 'UTC',
          }).format(new Date(`${item[field]}T00:00:00Z`))}
        </time>
      ) : (
        'Sin fecha'
      );
    return String(value(item, field)) || (field === 'assignee' ? 'Sin asignar' : 'Sin descripción');
  };
  return (
    <>
      <div className="task-table-toolbar">
        <p role="status">
          {items.length ? `${items.length} tareas` : 'No hay tareas que coincidan con los filtros.'}
        </p>
        <div>
          {sort && (
            <Button
              variant="secondary"
              onClick={() => changeQuery({ sort: null, direction: null })}
            >
              Restablecer orden
            </Button>
          )}
          <Button variant="secondary" onClick={() => setConfiguring(true)}>
            <SlidersHorizontal size={16} aria-hidden="true" /> Columnas
          </Button>
        </div>
      </div>
      <div
        className="task-table task-table--configurable"
        role="region"
        aria-label="Tabla desplazable"
        tabIndex={0}
      >
        <table aria-label="Lista de tareas">
          <thead>
            <tr>
              {visible.map((field) => (
                <th
                  key={field}
                  scope="col"
                  data-field={field}
                  aria-sort={sort === field ? (descending ? 'descending' : 'ascending') : undefined}
                  onDragOver={(event) => {
                    if (dragging.current && movable(field)) event.preventDefault();
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (dragging.current) reorder(dragging.current, field);
                    dragging.current = null;
                  }}
                >
                  {movable(field) && (
                    <span
                      className="table-field-grip"
                      draggable
                      title="Arrastra para reordenar, o usa Columnas"
                      aria-hidden="true"
                      onDragStart={(event) => {
                        event.dataTransfer.setData('text/plain', field);
                        event.dataTransfer.effectAllowed = 'move';
                        dragging.current = field;
                      }}
                      onDragEnd={() => {
                        dragging.current = null;
                      }}
                    >
                      <GripVertical size={14} />
                    </span>
                  )}
                  {field === 'actions' ? (
                    fields[field]
                  ) : (
                    <button
                      className="table-sort"
                      onClick={() =>
                        changeQuery({
                          sort: field,
                          direction: sort === field && !descending ? 'desc' : 'asc',
                        })
                      }
                    >
                      {fields[field]}{' '}
                      {sort === field &&
                        (descending ? (
                          <ArrowDown size={13} aria-hidden="true" />
                        ) : (
                          <ArrowUp size={13} aria-hidden="true" />
                        ))}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => (
              <tr key={item.id}>
                {visible.map((field) => (
                  <td key={field} data-field={field}>
                    {renderCell(item, field)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {configuring && (
        <AccessibleDialog
          className="task-modal table-config-dialog"
          label="Configurar columnas"
          onClose={() => setConfiguring(false)}
        >
          <header>
            <h2>Columnas de la lista</h2>
            <IconButton label="Cerrar" onClick={() => setConfiguring(false)}>
              ×
            </IconButton>
          </header>
          <p>Elige qué información mostrar. ID, nombre y acciones permanecen fijos.</p>
          <ul className="table-column-options">
            {[
              ...visible.filter(movable),
              ...(Object.keys(fields) as Field[]).filter(
                (field) => movable(field) && !visible.includes(field),
              ),
            ].map((field) => {
              const index = visible.indexOf(field);
              return (
                <li key={field}>
                  <label>
                    <input
                      type="checkbox"
                      checked={visible.includes(field)}
                      onChange={(event) =>
                        changeFields(
                          event.target.checked
                            ? [...visible.slice(0, -1), field, 'actions']
                            : visible.filter((entry) => entry !== field),
                        )
                      }
                    />
                    {fields[field]}
                  </label>
                  <IconButton
                    label={`Mover ${fields[field]} a la izquierda`}
                    disabled={index < 3}
                    onClick={() => reorder(field, visible[index - 1]!)}
                  >
                    <ArrowUp size={16} />
                  </IconButton>
                  <IconButton
                    label={`Mover ${fields[field]} a la derecha`}
                    disabled={index < 0 || index >= visible.length - 2}
                    onClick={() => reorder(field, visible[index + 1]!)}
                  >
                    <ArrowDown size={16} />
                  </IconButton>
                </li>
              );
            })}
          </ul>
          <footer>
            <Button variant="secondary" onClick={() => changeQuery({ fields: null })}>
              Restablecer columnas
            </Button>
            <Button onClick={() => setConfiguring(false)}>Listo</Button>
          </footer>
        </AccessibleDialog>
      )}
    </>
  );
}
