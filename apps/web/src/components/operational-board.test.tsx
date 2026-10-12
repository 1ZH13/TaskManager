import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Link from 'next/link';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDemoState, demoIds, LocalWorkManagementRepository } from '@task-manager/data';
import type { Actor } from '@task-manager/domain';
import type { BoardColumn } from '@task-manager/shared';
import type { useDemo } from './demo-context';
import { OperationalBoard } from './operational-board';
import { taskDrafts } from './task-drafts';
import type { DragEndEvent, DragOverEvent } from '@dnd-kit/core';

const dnd = vi.hoisted(() => ({
  onDragEnd: undefined as ((event: DragEndEvent) => void) | undefined,
  onDragOver: undefined as ((event: DragOverEvent) => void) | undefined,
}));
vi.mock('@dnd-kit/core', async (importOriginal: <T>() => Promise<T>) => {
  const original = await importOriginal<typeof import('@dnd-kit/core')>();
  return {
    ...original,
    DndContext: (props: React.ComponentProps<typeof original.DndContext>) => {
      dnd.onDragEnd = props.onDragEnd;
      dnd.onDragOver = props.onDragOver;
      return <original.DndContext {...props} />;
    },
  };
});

let context: ReturnType<typeof useDemo>;
let params: URLSearchParams;
const router = { replace: vi.fn(), push: vi.fn() };
const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
vi.mock('./demo-context', () => ({ useDemo: () => context }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => params,
  usePathname: () => '/operaciones/tablero',
  useRouter: () => router,
}));

function setContext(phId: string = demoIds.vista, id: string = demoIds.admin) {
  const actor: Actor = { id, phId, role: 'ADMIN', status: 'ACTIVE', projectIds: [], teamIds: [] };
  context = {
    phId,
    actor,
    phName: 'PH',
    repository: new LocalWorkManagementRepository(undefined, () => actor),
    setPhId: vi.fn(),
    setActorId: vi.fn(),
    reset: vi.fn(),
  };
}

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    },
  });
  taskDrafts.clear();
  vi.clearAllMocks();
  setContext();
  params = new URLSearchParams();
});
afterEach(() => {
  cleanup();
  for (const [name, descriptor] of [
    ['showModal', originalShowModal],
    ['close', originalClose],
  ] as const) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
  vi.restoreAllMocks();
});

describe('OperationalBoard UX', () => {
  it('vuelve al encabezado al cerrar un detalle abierto directamente por URL', async () => {
    const task = createDemoState().workItems.find((item) => item.key === 'OPS-1')!;
    params = new URLSearchParams({
      taskId: task.id,
      projectId: demoIds.opsProject,
      board: demoIds.opsBoard,
    });
    render(<OperationalBoard />);
    const dialog = await screen.findByRole('dialog', { name: 'Detalle de Revisar bomba de agua' });
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }));
  });

  it('inserta antes de la tarjeta señalada y permite mover al final de la misma columna', async () => {
    const state = createDemoState();
    const original = state.workItems.find((item) => item.key === 'OPS-1')!;
    const sameColumn = [
      original,
      { ...original, id: 'drag-b', key: 'OPS-B', title: 'B' },
      { ...original, id: 'drag-c', key: 'OPS-C', title: 'C' },
    ].map((item, position) => ({ ...item, position }));
    vi.spyOn(context.repository, 'listWorkItems').mockResolvedValue({ items: sameColumn });
    const move = vi.spyOn(context.repository, 'moveWorkItem').mockResolvedValue(original);
    render(<OperationalBoard />);
    await screen.findByRole('button', { name: 'OPS-C · C' });
    await act(async () =>
      dnd.onDragEnd?.({ active: { id: original.id }, over: { id: 'drag-c' } } as DragEndEvent),
    );
    expect(move).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: original.id, position: 1 }),
    );
    await act(async () =>
      dnd.onDragEnd?.({
        active: { id: original.id },
        over: { id: original.columnId },
      } as DragEndEvent),
    );
    expect(move).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: original.id, position: 3 }),
    );
    move.mockClear();
    await act(async () =>
      dnd.onDragEnd?.({ active: { id: original.id }, over: { id: original.id } } as DragEndEvent),
    );
    expect(move).not.toHaveBeenCalled();
  });

  it('abre un diálogo modal y restaura el foco a la tarjeta al cerrar', async () => {
    const user = userEvent.setup();
    render(<OperationalBoard />);
    const trigger = await screen.findByRole('button', { name: 'OPS-1 · Revisar bomba de agua' });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Detalle de Revisar bomba de agua' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(document.activeElement).toBe(within(dialog).getByRole('heading', { name: 'OPS-1' }));
    await user.click(within(dialog).getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('muestra los errores de guardado dentro del modal y protege el borrador al cancelar Escape', async () => {
    const user = userEvent.setup();
    vi.spyOn(context.repository, 'updateWorkItem').mockRejectedValueOnce(
      new Error('No se pudo guardar'),
    );
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<OperationalBoard />);
    await user.click(await screen.findByRole('button', { name: 'OPS-1 · Revisar bomba de agua' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByRole('textbox', { name: 'Título' }), ' editada');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));
    expect((await within(dialog).findByRole('alert')).textContent).toBe('No se pudo guardar');
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(within(dialog).getByRole('textbox', { name: 'Título' })).toHaveProperty(
      'value',
      'Revisar bomba de agua editada',
    );
  });

  it('muestra una vista previa de tarea al arrastrar y la limpia al cancelar sin escribir', async () => {
    const user = userEvent.setup();
    const move = vi.spyOn(context.repository, 'moveWorkItem');
    const { container } = render(<OperationalBoard />);
    const grip = await screen.findByRole('button', { name: 'Arrastrar Revisar bomba de agua' });
    grip.focus();
    await user.keyboard('[Space]');
    expect(container.querySelector('.board-drag-preview')?.textContent).toContain(
      'Revisar bomba de agua',
    );
    expect(grip.closest('article')?.getAttribute('data-dragging')).toBe('true');
    expect(grip.closest('article')?.style.transform).toBe('');
    await user.keyboard('[Escape]');
    expect(container.querySelector('.board-drag-preview')).toBeNull();
    expect(move).not.toHaveBeenCalled();
  });

  it('muestra la columna flotante y marca el lado de inserción antes de soltar', async () => {
    const user = userEvent.setup();
    const reorder = vi.spyOn(context.repository, 'reorderBoardColumns');
    const { container } = render(<OperationalBoard />);
    const grip = await screen.findByRole('button', { name: 'Arrastrar Por hacer' });
    grip.focus();
    await user.keyboard('[Space]');
    expect(container.querySelector('.board-drag-preview--column')?.textContent).toContain(
      'Por hacer',
    );
    const target = createDemoState().boardColumns.find((column) => column.name === 'En progreso')!;
    act(() => dnd.onDragOver?.({ over: { id: target.id } } as DragOverEvent));
    const destination = screen
      .getByRole('button', { name: 'Renombrar columna En progreso' })
      .closest('section');
    expect(destination?.getAttribute('data-drop-side')).toBe('after');
    await user.keyboard('[Escape]');
    expect(destination?.hasAttribute('data-drop-side')).toBe(false);
    expect(reorder).not.toHaveBeenCalled();
  });

  it('crea en una columna sin navegar y conserva filtro, selección y borrador abierto', async () => {
    const user = userEvent.setup();
    params = new URLSearchParams({ q: 'bomba' });
    render(<OperationalBoard />);
    await user.click(await screen.findByRole('button', { name: 'OPS-1 · Revisar bomba de agua' }));
    await user.type(screen.getByRole('textbox', { name: 'Título' }), ' borrador');
    router.push.mockClear();
    const column = screen
      .getByRole('button', { name: 'Renombrar columna Por hacer' })
      .closest('section')!;
    await user.click(within(column).getByRole('button', { name: '＋ Crear' }));
    await user.type(
      within(column).getByRole('textbox', { name: 'Título de nueva tarea en Por hacer' }),
      'Otra bomba',
    );
    await user.click(within(column).getByRole('button', { name: 'Crear' }));
    await screen.findByRole('button', { name: 'OPS-4 · Otra bomba' });
    expect(screen.getByRole('textbox', { name: 'Título' })).toHaveProperty(
      'value',
      'Revisar bomba de agua borrador',
    );
    expect(screen.getByRole('textbox', { name: /^Buscar/ })).toHaveProperty('value', 'bomba');
    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('mantiene el título ante error al crear y bloquea el doble envío pendiente', async () => {
    const user = userEvent.setup();
    let reject!: (failure: Error) => void;
    const pending = new Promise<never>((_, fail) => {
      reject = fail;
    });
    const create = vi.spyOn(context.repository, 'createWorkItem').mockReturnValueOnce(pending);
    render(<OperationalBoard />);
    const column = (
      await screen.findByRole('button', { name: 'Renombrar columna Por hacer' })
    ).closest('section')!;
    await user.click(within(column).getByRole('button', { name: '＋ Crear' }));
    const title = within(column).getByRole('textbox', {
      name: 'Título de nueva tarea en Por hacer',
    });
    await user.type(title, 'No perder');
    await user.dblClick(within(column).getByRole('button', { name: 'Crear' }));
    expect(create).toHaveBeenCalledTimes(1);
    expect(title).toHaveProperty('disabled', true);
    await act(async () => {
      reject(new Error('Sin conexión'));
    });
    expect(await within(column).findByRole('alert')).toHaveProperty('textContent', 'Sin conexión');
    expect(title).toHaveProperty('value', 'No perder');
    expect(title).toHaveProperty('disabled', false);
    await user.click(within(column).getByRole('button', { name: 'Crear' }));
    await screen.findByRole('button', { name: 'OPS-4 · No perder' });
  });

  it('asigna inline sin cerrar el detalle ni perder su borrador', async () => {
    const user = userEvent.setup();
    render(<OperationalBoard />);
    await user.click(await screen.findByRole('button', { name: 'OPS-1 · Revisar bomba de agua' }));
    await user.type(screen.getByRole('textbox', { name: 'Título' }), ' borrador');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Asignar Inspección semanal de bombas' }),
      demoIds.admin,
    );
    await screen.findByText('Responsable actualizado.');
    expect(
      screen.getByRole('combobox', { name: 'Asignar Inspección semanal de bombas' }),
    ).toHaveProperty('value', demoIds.admin);
    expect(screen.getByRole('textbox', { name: 'Título' })).toHaveProperty(
      'value',
      'Revisar bomba de agua borrador',
    );
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('muestra error de asignación, mantiene responsable y bloquea durante la petición', async () => {
    const user = userEvent.setup();
    let reject!: (failure: Error) => void;
    vi.spyOn(context.repository, 'updateWorkItem').mockReturnValueOnce(
      new Promise((_, fail) => {
        reject = fail;
      }),
    );
    render(<OperationalBoard />);
    const assignment = await screen.findByRole('combobox', {
      name: 'Asignar Revisar bomba de agua',
    });
    await user.selectOptions(assignment, demoIds.admin);
    expect(assignment).toHaveProperty('disabled', true);
    await act(async () => {
      reject(new Error('No se pudo asignar'));
    });
    await screen.findByText('No se pudo asignar');
    expect(assignment).toHaveProperty('value', demoIds.collab);
    expect(assignment).toHaveProperty('disabled', false);
  });

  it('mueve con el selector accesible y comunica la columna destino', async () => {
    const user = userEvent.setup();
    const target = createDemoState().boardColumns.find((column) => column.name === 'En progreso')!;
    render(<OperationalBoard />);
    const move = await screen.findByRole('combobox', { name: 'Mover Revisar bomba de agua a' });
    await user.selectOptions(move, target.id);
    await screen.findByText('OPS-1 movida a En progreso.');
    expect(screen.getByRole('combobox', { name: 'Mover Revisar bomba de agua a' })).toHaveProperty(
      'value',
      target.id,
    );
    expect(document.activeElement).toBe(
      screen.getByRole('combobox', { name: 'Mover Revisar bomba de agua a' }),
    );
    const task = (await context.repository.listWorkItems({ phId: demoIds.vista })).items.find(
      (item) => item.key === 'OPS-1',
    )!;
    expect(task.columnId).toBe(target.id);
  });

  it('no salta la validación al mover y permite corregir el destino', async () => {
    const user = userEvent.setup();
    const columns = createDemoState().boardColumns;
    const move = vi.spyOn(context.repository, 'moveWorkItem');
    render(<OperationalBoard />);
    const select = await screen.findByRole('combobox', { name: 'Mover Revisar bomba de agua a' });
    await user.selectOptions(select, columns.find((column) => column.name === 'Completado')!.id);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(move).not.toHaveBeenCalled();
    expect(select).toHaveProperty('value', columns[0].id);
    await user.selectOptions(select, columns[1].id);
    await screen.findByText('OPS-1 movida a En progreso.');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('conserva tarea en origen al fallar movimiento y bloquea movimientos duplicados', async () => {
    const user = userEvent.setup();
    const columns = createDemoState().boardColumns;
    let reject!: (failure: Error) => void;
    const move = vi.spyOn(context.repository, 'moveWorkItem').mockReturnValueOnce(
      new Promise((_, fail) => {
        reject = fail;
      }),
    );
    render(<OperationalBoard />);
    const select = await screen.findByRole('combobox', { name: 'Mover Revisar bomba de agua a' });
    await user.selectOptions(select, columns[1].id);
    expect(select).toHaveProperty('disabled', true);
    await user.selectOptions(select, columns[2].id);
    expect(move).toHaveBeenCalledTimes(1);
    await act(async () => {
      reject(new Error('La columna alcanzó su límite.'));
    });
    await screen.findByText('La columna alcanzó su límite.');
    expect(select).toHaveProperty('value', columns[0].id);
    expect(select).toHaveProperty('disabled', false);
  });

  it('permite a colaboradores seleccionar tablero y mover tareas propias sin controles administrativos', async () => {
    const user = userEvent.setup();
    const actor: Actor = {
      ...context.actor,
      id: demoIds.collab,
      role: 'COLLABORATOR',
      projectIds: [demoIds.opsProject],
      teamIds: [demoIds.teamB],
    };
    const repository = new LocalWorkManagementRepository(undefined, () => actor);
    const boards = await context.repository.listBoards({
      phId: demoIds.vista,
      projectId: demoIds.opsProject,
    });
    vi.spyOn(repository, 'listBoards').mockResolvedValue([
      ...boards,
      { ...boards[0], id: 'other-board', name: 'Segundo tablero' },
    ]);
    context = { ...context, actor, repository };
    render(<OperationalBoard />);
    await screen.findByRole('button', { name: 'OPS-1 · Revisar bomba de agua' });
    expect(screen.getByRole('combobox', { name: 'Mover Revisar bomba de agua a' })).toBeTruthy();
    expect(
      screen.queryByRole('combobox', { name: /Mover Mantenimiento de septiembre/ }),
    ).toBeNull();
    expect(screen.queryByRole('combobox', { name: /Asignar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Administrar tablero' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Nuevo tablero' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Arrastrar Por hacer/ })).toBeNull();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tablero' }), 'other-board');
    expect(router.replace).toHaveBeenCalledWith('/operaciones/tablero?board=other-board');
  });

  it('reordena una columna soltándola sobre una tarjeta y comunica el resultado', async () => {
    const state = createDemoState();
    const first = state.boardColumns[0];
    const target = state.workItems.find((item) => item.key === 'OPS-2')!;
    const reorder = vi.spyOn(context.repository, 'reorderBoardColumns');
    render(<OperationalBoard />);
    await screen.findByRole('button', { name: 'OPS-1 · Revisar bomba de agua' });
    await act(async () => {
      dnd.onDragEnd?.({
        active: { id: `column:${first.id}` },
        over: { id: target.id },
      } as DragEndEvent);
    });
    await screen.findByText('Por hacer movida a la posición 2.');
    expect(reorder).toHaveBeenCalledWith(demoIds.vista, demoIds.opsBoard, [
      state.boardColumns[1].id,
      first.id,
      state.boardColumns[2].id,
      state.boardColumns[3].id,
    ]);
  });

  it('renombra columnas sin navegar ni borrar una creación en curso', async () => {
    const user = userEvent.setup();
    render(<OperationalBoard />);
    const title = await screen.findByRole('button', { name: 'Renombrar columna Por hacer' });
    const column = title.closest('section')!;
    await user.click(within(column).getByRole('button', { name: '＋ Crear' }));
    await user.type(
      within(column).getByRole('textbox', { name: /Título de nueva tarea/ }),
      'Borrador inline',
    );
    await user.dblClick(title);
    const name = screen.getByRole('textbox', { name: 'Nombre de la columna' });
    await user.clear(name);
    await user.type(name, 'Pendiente{Enter}');
    await screen.findByRole('button', { name: 'Renombrar columna Pendiente' });
    expect(within(column).getByRole('textbox', { name: /Título de nueva tarea/ })).toHaveProperty(
      'value',
      'Borrador inline',
    );
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('mantiene el nombre de columna ante error y bloquea solicitudes de renombrado duplicadas', async () => {
    const user = userEvent.setup();
    let reject!: (failure: Error) => void;
    const update = vi.spyOn(context.repository, 'updateBoardColumn').mockReturnValueOnce(
      new Promise((_, fail) => {
        reject = fail;
      }),
    );
    render(<OperationalBoard />);
    await user.dblClick(await screen.findByRole('button', { name: 'Renombrar columna Por hacer' }));
    const name = screen.getByRole('textbox', { name: 'Nombre de la columna' });
    await user.clear(name);
    await user.type(name, 'Pendientes{Enter}');
    expect(name).toHaveProperty('disabled', true);
    expect(update).toHaveBeenCalledTimes(1);
    await act(async () => {
      reject(new Error('No se pudo renombrar'));
    });
    await screen.findByText('No se pudo renombrar');
    expect(name).toHaveProperty('value', 'Pendientes');
    expect(name).toHaveProperty('disabled', false);
    await user.click(name);
    await user.keyboard('{Enter}');
    await screen.findByRole('button', { name: 'Renombrar columna Pendientes' });
  });

  it('descarta una asignación pendiente al cambiar de PH', async () => {
    const user = userEvent.setup();
    const task = createDemoState().workItems[0];
    let finish!: (item: typeof task) => void;
    vi.spyOn(context.repository, 'updateWorkItem').mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const oldList = vi.spyOn(context.repository, 'listBoards');
    const { rerender } = render(<OperationalBoard />);
    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Asignar Revisar bomba de agua' }),
      demoIds.admin,
    );
    oldList.mockClear();
    setContext(demoIds.bahia, demoIds.bahiaAdmin);
    rerender(<OperationalBoard />);
    await screen.findByText(/Este proyecto no tiene tableros/);
    await act(async () => {
      finish({ ...task, assigneeId: demoIds.admin });
    });
    expect(oldList).not.toHaveBeenCalled();
    expect(screen.queryByText('Responsable actualizado.')).toBeNull();
  });

  it('una asignación tardía refresca el taskId actual y no reabre el anterior', async () => {
    const user = userEvent.setup();
    const [task, , other] = createDemoState().workItems;
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const update = context.repository.updateWorkItem.bind(context.repository);
    vi.spyOn(context.repository, 'updateWorkItem').mockImplementationOnce(
      async (id: string, input: Parameters<typeof update>[1]) => {
        await pending;
        return update(id, input);
      },
    );
    const url = (id: string) =>
      new URLSearchParams({ projectId: task.projectId, board: task.boardId, taskId: id });
    params = url(task.id);
    const { rerender } = render(<OperationalBoard />);
    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Asignar Inspección semanal de bombas' }),
      demoIds.admin,
    );
    params = url(other.id);
    rerender(<OperationalBoard />);
    await screen.findByRole('heading', { name: other.key });
    await act(async () => {
      finish();
    });
    await screen.findByText('Responsable actualizado.');
    expect(screen.getByRole('heading', { name: other.key })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: task.key })).toBeNull();
  });

  it('bloquea acciones rápidas de la tarea abierta para no invalidar la versión del borrador', async () => {
    const user = userEvent.setup();
    const task = createDemoState().workItems[0];
    const update = vi.spyOn(context.repository, 'updateWorkItem');
    const move = vi.spyOn(context.repository, 'moveWorkItem');
    render(<OperationalBoard />);
    await user.click(await screen.findByRole('button', { name: 'OPS-1 · Revisar bomba de agua' }));
    expect(screen.getByText('Cierra el detalle para asignar o mover esta tarea.')).toBeTruthy();
    const assignment = screen.getByRole('combobox', { name: 'Asignar Revisar bomba de agua' });
    const movement = screen.getByRole('combobox', { name: 'Mover Revisar bomba de agua a' });
    expect(assignment).toHaveProperty('disabled', true);
    expect(movement).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Arrastrar Revisar bomba de agua' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(
      screen.getByRole('combobox', { name: 'Asignar Inspección semanal de bombas' }),
    ).toHaveProperty('disabled', false);
    await user.selectOptions(assignment, demoIds.admin);
    await user.selectOptions(movement, createDemoState().boardColumns[1].id);
    await act(async () => {
      dnd.onDragEnd?.({
        active: { id: task.id },
        over: { id: createDemoState().boardColumns[1].id },
      } as DragEndEvent);
    });
    expect(update).not.toHaveBeenCalled();
    expect(move).not.toHaveBeenCalled();
    await user.type(screen.getByRole('textbox', { name: 'Título' }), ' editado');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await screen.findByText('Cambios guardados.');
    expect(update).toHaveBeenCalledWith(
      task.id,
      expect.objectContaining({ version: task.version, title: 'Revisar bomba de agua editado' }),
    );
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(
      screen.getByRole('combobox', { name: 'Asignar Revisar bomba de agua editado' }),
    ).toHaveProperty('disabled', false);
  });

  it('distingue creación guardada de fallo al refrescar y reintenta solo la lectura', async () => {
    const user = userEvent.setup();
    const create = vi.spyOn(context.repository, 'createWorkItem');
    render(<OperationalBoard />);
    const column = (
      await screen.findByRole('button', { name: 'Renombrar columna Por hacer' })
    ).closest('section')!;
    await user.click(within(column).getByRole('button', { name: '＋ Crear' }));
    await user.type(
      within(column).getByRole('textbox', { name: /Título de nueva tarea/ }),
      'Tarea confirmada',
    );
    vi.spyOn(context.repository, 'listBoards').mockRejectedValueOnce(
      new Error('Lectura interrumpida'),
    );
    await user.click(within(column).getByRole('button', { name: 'Crear' }));
    await screen.findByText(
      'El cambio se guardó, pero no pudimos actualizar el tablero. Usa Reintentar.',
    );
    expect(within(column).queryByRole('textbox', { name: /Título de nueva tarea/ })).toBeNull();
    expect(create).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Reintentar actualización' }));
    await screen.findByRole('button', { name: 'OPS-4 · Tarea confirmada' });
    expect(create).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it.each(['delete', 'subtask'])(
    'ignora la respuesta tardía de %s tras abrir otra tarea',
    async (operation: string) => {
      const user = userEvent.setup();
      const [task, other] = createDemoState().workItems.filter(
        (item) => item.key === 'OPS-1' || item.key === 'OPS-2',
      );
      const url = (taskId: string) =>
        new URLSearchParams({ projectId: task.projectId, board: task.boardId, taskId });
      let finish!: () => void;
      const pending = new Promise<void>((resolve) => {
        finish = resolve;
      });
      if (operation === 'delete')
        vi.spyOn(context.repository, 'deleteWorkItem').mockReturnValue(pending);
      else
        vi.spyOn(context.repository, 'createWorkItem').mockImplementation(async () => {
          await pending;
          return task;
        });
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      params = url(task.id);
      const { rerender } = render(<OperationalBoard />);
      await screen.findByRole('heading', { name: task.key });
      if (operation === 'delete')
        await user.click(screen.getByRole('button', { name: 'Eliminar tarea' }));
      else {
        await user.click(screen.getByRole('button', { name: 'Crear subtarea' }));
        const submit = screen.getByRole('button', { name: 'Guardar subtarea' });
        const form = submit.closest('form')!;
        await user.type(within(form).getByRole('textbox', { name: 'Título' }), 'Subtarea');
        await user.click(submit);
      }
      params = url(other.id);
      rerender(<OperationalBoard />);
      await screen.findByRole('heading', { name: other.key });
      await act(async () => {
        finish();
        await pending;
      });
      expect(screen.getByRole('heading', { name: other.key })).toBeTruthy();
      expect(router.replace).not.toHaveBeenCalled();
    },
  );

  it('recupera borradores al volver por historial y conserva su versión para detectar conflictos', async () => {
    const user = userEvent.setup();
    const task = createDemoState().workItems.find((item) => item.key === 'OPS-1')!;
    const other = createDemoState().workItems.find((item) => item.key === 'OPS-2')!;
    const url = (taskId: string) =>
      new URLSearchParams({ projectId: task.projectId, board: task.boardId, taskId });
    params = url(task.id);
    const { rerender } = render(<OperationalBoard />);
    const title = await screen.findByRole('textbox', { name: 'Título' });
    await user.clear(title);
    await user.type(title, 'Borrador recuperable');
    params = url(other.id);
    rerender(<OperationalBoard />);
    await screen.findByRole('heading', { name: 'OPS-2' });
    await context.repository.updateWorkItem(task.id, {
      version: task.version,
      title: 'Cambio externo',
    });
    params = url(task.id);
    rerender(<OperationalBoard />);
    await screen.findByText(/Borrador recuperado/);
    expect((screen.getByRole('textbox', { name: 'Título' }) as HTMLInputElement).value).toBe(
      'Borrador recuperable',
    );
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await screen.findByText('El registro cambió en otra sesión.');
    const page = await context.repository.listWorkItems({ phId: demoIds.vista });
    expect(page.items.find((item) => item.id === task.id)?.title).toBe('Cambio externo');
  });

  it('un guardado tardío no reabre la tarea anterior ni sustituye la selección actual', async () => {
    const user = userEvent.setup();
    const [task, other] = createDemoState().workItems.filter(
      (item) => item.key === 'OPS-1' || item.key === 'OPS-2',
    );
    const url = (taskId: string) =>
      new URLSearchParams({ projectId: task.projectId, board: task.boardId, taskId });
    let finish!: (item: typeof task) => void;
    const pending = new Promise<typeof task>((resolve) => {
      finish = resolve;
    });
    vi.spyOn(context.repository, 'updateWorkItem').mockReturnValue(pending);
    params = url(task.id);
    const { rerender } = render(<OperationalBoard />);
    await screen.findByRole('textbox', { name: 'Título' });
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    params = url(other.id);
    rerender(<OperationalBoard />);
    expect(screen.queryByRole('heading', { name: task.key })).toBeNull();
    await act(async () => {
      finish({ ...task, version: task.version + 1 });
      await pending;
    });
    await screen.findByRole('heading', { name: other.key });
    expect(screen.getByRole('heading', { name: other.key })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: task.key })).toBeNull();
  });

  it('resuelve un enlace antiguo sin proyecto ni tablero y no abre otro tablero mientras busca', async () => {
    const task = createDemoState().workItems.find((item) => item.key === 'OPS-1')!;
    params = new URLSearchParams({ taskId: task.id });
    render(<OperationalBoard />);
    await waitFor(() => expect(router.replace).toHaveBeenCalled());
    const href = router.replace.mock.calls[0][0] as string;
    expect(href).toContain(`/operaciones/tablero?phId=${demoIds.vista}`);
    expect(href).toContain(`projectId=${task.projectId}`);
    expect(href).toContain(`board=${task.boardId}`);
    expect(href).toContain(`taskId=${task.id}`);
    expect(screen.queryByRole('button', { name: /OPS-1/ })).toBeNull();
  });

  it('abre el detalle por URL aunque los filtros oculten la tarjeta y lo cierra al volver a la URL base', async () => {
    const task = createDemoState().workItems.find((item) => item.key === 'OPS-1')!;
    params = new URLSearchParams({
      projectId: task.projectId,
      board: task.boardId,
      taskId: task.id,
      q: 'sin-coincidencia',
    });
    const { rerender } = render(<OperationalBoard />);
    const title = await screen.findByRole('textbox', { name: 'Título' });
    expect((title as HTMLInputElement).value).toBe(task.title);
    expect(screen.queryByRole('button', { name: `OPS-1 · ${task.title}` })).toBeNull();
    params = new URLSearchParams({
      projectId: task.projectId,
      board: task.boardId,
      q: 'sin-coincidencia',
    });
    rerender(<OperationalBoard />);
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Título' })).toBeNull());
  });

  it('rechaza una URL de otra PH antes de consultar o mostrar tareas', async () => {
    params = new URLSearchParams({ phId: demoIds.bahia, taskId: 'foreign-task' });
    const list = vi.spyOn(context.repository, 'listWorkItems');
    render(<OperationalBoard />);
    expect(screen.getByRole('heading', { name: 'Enlace de otra propiedad' })).toBeTruthy();
    expect(list).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox', { name: 'Título' })).toBeNull();
  });

  it('ofrece recuperación para una tarea inexistente sin redirigir al tablero predeterminado', async () => {
    params = new URLSearchParams({ taskId: 'missing' });
    render(<OperationalBoard />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Volver a notificaciones' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('abrir y cerrar conserva filtros y genera una URL compartible', async () => {
    const user = userEvent.setup();
    params = new URLSearchParams({ q: 'bomba' });
    render(<OperationalBoard />);
    await user.click(await screen.findByRole('button', { name: 'OPS-1 · Revisar bomba de agua' }));
    const href = router.push.mock.calls[0][0] as string;
    expect(href).toContain('q=bomba');
    expect(href).toContain('taskId=');
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    const closeHref = router.replace.mock.calls.at(-1)![0] as string;
    expect(closeHref).toContain('q=bomba');
    expect(closeHref).not.toContain('taskId=');
  });

  it('no abre un taskId ausente en el tablero indicado', async () => {
    const task = createDemoState().workItems.find((item) => item.key === 'OPS-1')!;
    params = new URLSearchParams({
      projectId: task.projectId,
      board: task.boardId,
      taskId: 'missing',
    });
    render(<OperationalBoard />);
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'La tarea no está disponible en este tablero o no tienes acceso.',
    );
    expect(screen.queryByRole('textbox', { name: 'Título' })).toBeNull();
  });

  it('descarta la resolución pendiente de un enlace al cambiar PH', async () => {
    let resolvePage!: (page: { items: ReturnType<typeof createDemoState>['workItems'] }) => void;
    vi.spyOn(context.repository, 'listWorkItems').mockReturnValue(
      new Promise((resolve) => {
        resolvePage = resolve;
      }),
    );
    const task = createDemoState().workItems.find((item) => item.key === 'OPS-1')!;
    params = new URLSearchParams({ taskId: task.id, phId: demoIds.vista });
    const { rerender } = render(<OperationalBoard />);
    setContext(demoIds.bahia, demoIds.bahiaAdmin);
    rerender(<OperationalBoard />);
    await act(async () => {
      resolvePage({ items: [task] });
    });
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Enlace de otra propiedad' })).toBeTruthy();
  });

  it('permite cancelar un enlace de navegación con borrador sin guardar', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Link href="/operaciones/lista">Lista</Link>
        <OperationalBoard />
      </>,
    );
    await user.click(await screen.findByRole('button', { name: 'OPS-1 · Revisar bomba de agua' }));
    await user.type(screen.getByRole('textbox', { name: 'Título' }), ' borrador');
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    screen.getByRole('link', { name: 'Lista' }).dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect((screen.getByRole('textbox', { name: 'Título' }) as HTMLInputElement).value).toContain(
      'borrador',
    );
  });
  it('preserva el borrador si se cancela el cambio y carga los campos de la nueva tarea al confirmar', async () => {
    const user = userEvent.setup();
    render(<OperationalBoard />);
    await user.click(await screen.findByRole('button', { name: 'OPS-1 · Revisar bomba de agua' }));
    const title = screen.getByRole('textbox', { name: 'Título' });
    await user.clear(title);
    await user.type(title, 'Borrador de OPS-1');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await user.click(screen.getByRole('button', { name: 'OPS-2 · Inspección semanal de bombas' }));
    expect((screen.getByRole('textbox', { name: 'Título' }) as HTMLInputElement).value).toBe(
      'Borrador de OPS-1',
    );
    expect(screen.getByRole('heading', { name: 'OPS-1' })).toBeTruthy();
    confirm.mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'OPS-2 · Inspección semanal de bombas' }));
    const detail = within(
      screen.getByRole('dialog', { name: 'Detalle de Inspección semanal de bombas' }),
    );
    expect((detail.getByRole('textbox', { name: 'Título' }) as HTMLInputElement).value).toBe(
      'Inspección semanal de bombas',
    );
    expect((detail.getByRole('combobox', { name: 'Prioridad' }) as HTMLSelectElement).value).toBe(
      'MEDIUM',
    );
    await user.click(detail.getByRole('button', { name: 'Guardar cambios' }));
    await screen.findByText('Cambios guardados.');
    const page = await context.repository.listWorkItems({ phId: demoIds.vista });
    expect(page.items.find((item) => item.key === 'OPS-1')?.title).toBe('Revisar bomba de agua');
    expect(page.items.find((item) => item.key === 'OPS-2')?.title).toBe(
      'Inspección semanal de bombas',
    );
  });

  it('limpia inmediatamente el tablero y editor al cambiar de PH', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<OperationalBoard />);
    await user.click(await screen.findByRole('button', { name: 'OPS-1 · Revisar bomba de agua' }));
    setContext(demoIds.bahia, demoIds.bahiaAdmin);
    rerender(<OperationalBoard />);
    expect(screen.queryByRole('button', { name: 'OPS-1 · Revisar bomba de agua' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Título' })).toBeNull();
    await screen.findByText(/Este proyecto no tiene tableros/);
  });

  it.each(['project', 'actor'])('limpia la selección cuando cambia %s', async (scope: string) => {
    const user = userEvent.setup();
    const { rerender } = render(<OperationalBoard />);
    await user.click(await screen.findByRole('button', { name: 'OPS-1 · Revisar bomba de agua' }));
    if (scope === 'project') params = new URLSearchParams(`projectId=${demoIds.adminProject}`);
    else {
      const actor: Actor = {
        ...context.actor,
        id: demoIds.cleaner,
        role: 'COLLABORATOR',
        projectIds: [],
        teamIds: [],
      };
      context = {
        ...context,
        actor,
        repository: new LocalWorkManagementRepository(undefined, () => actor),
      };
    }
    rerender(<OperationalBoard />);
    expect(screen.queryByRole('textbox', { name: 'Título' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'OPS-1 · Revisar bomba de agua' })).toBeNull();
    await waitFor(() => expect(screen.queryByText('Cargando tablero…')).toBeNull());
  });

  it('descarta una respuesta pendiente del contexto anterior', async () => {
    let resolveColumns!: (columns: BoardColumn[]) => void;
    const columns = new Promise<BoardColumn[]>((resolve) => {
      resolveColumns = resolve;
    });
    vi.spyOn(context.repository, 'listBoardColumns').mockReturnValue(columns);
    const { rerender } = render(<OperationalBoard />);
    await waitFor(() => expect(context.repository.listBoardColumns).toHaveBeenCalled());
    setContext(demoIds.bahia, demoIds.bahiaAdmin);
    rerender(<OperationalBoard />);
    await screen.findByText(/Este proyecto no tiene tableros/);
    await act(async () => {
      resolveColumns(createDemoState().boardColumns);
      await columns;
    });
    expect(screen.queryByText('OPS-1 · Revisar bomba de agua')).toBeNull();
    expect(screen.getByText(/Este proyecto no tiene tableros/)).toBeTruthy();
  });

  it('traduce todos los tipos del filtro y las tarjetas', async () => {
    render(<OperationalBoard />);
    await screen.findByRole('button', { name: 'OPS-1 · Revisar bomba de agua' });
    const options = within(screen.getByRole('combobox', { name: 'Tipo' })).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      'Todos',
      'Tarea',
      'Tarea recurrente',
      'Incidencia',
      'Subtarea',
      'Hito',
    ]);
    expect(screen.getByText('Media · Tarea recurrente')).toBeTruthy();
  });

  it('publica comentarios y adjuntos y limpia sus formularios tras guardar', async () => {
    const user = userEvent.setup();
    render(<OperationalBoard />);
    await user.click(await screen.findByRole('button', { name: 'OPS-1 · Revisar bomba de agua' }));
    const comment = screen.getByRole('textbox', { name: 'Comentario' });
    await user.type(comment, 'Revisión completada');
    await user.click(screen.getByRole('button', { name: 'Publicar comentario' }));
    await screen.findByText('Revisión completada');
    expect((comment as HTMLTextAreaElement).value).toBe('');
    const attachment = screen.getByRole('textbox', { name: 'Nombre del archivo' });
    await user.type(attachment, 'revision.pdf');
    await user.click(screen.getByRole('button', { name: 'Adjuntar' }));
    await screen.findByRole('link', { name: 'revision.pdf' });
    expect((attachment as HTMLInputElement).value).toBe('');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
