import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createBrowserLocalRepository,
  createDemoState,
  DataError,
  demoIds,
  type Page,
} from '@task-manager/data';
import type { WorkItem } from '@task-manager/shared';
import { useDemo } from './demo-context';
import { SynchronizedViews } from './synchronized-views';

vi.mock('./demo-context', () => ({ useDemo: vi.fn() }));

let context: ReturnType<typeof useDemo>;
const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
const seed = createDemoState();
const task = seed.workItems.find((item) => item.projectId === demoIds.opsProject)!;
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

beforeEach(() => {
  localStorage.clear();
  const actor = {
    id: demoIds.admin,
    phId: demoIds.vista,
    role: 'ADMIN' as const,
    status: 'ACTIVE' as const,
    projectIds: [demoIds.opsProject],
    teamIds: [],
  };
  context = {
    actor,
    phId: demoIds.vista,
    phName: 'Vista Marina',
    repository: createBrowserLocalRepository(() => actor),
    setPhId: vi.fn(),
    setActorId: vi.fn(),
    reset: vi.fn(),
  };
  vi.mocked(useDemo).mockImplementation(() => context);
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
    },
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  for (const [name, descriptor] of [
    ['showModal', originalShowModal],
    ['close', originalClose],
  ] as const) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
});

describe('SynchronizedViews', () => {
  it('explica por qué no se puede completar una tarea y mantiene la lista', async () => {
    vi.spyOn(context.repository, 'moveWorkItem').mockRejectedValueOnce(
      new DataError('VALIDATION', 'Solo una tarea aprobada puede completarse.'),
    );
    render(<SynchronizedViews view="list" />);
    const state = await screen.findByLabelText(`Estado de ${task.title}`);
    const options = Array.from((state as HTMLSelectElement).options);
    fireEvent.change(state, { target: { value: options.at(-1)!.value } });
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Solo una tarea aprobada puede completarse.',
    );
    expect(screen.getByRole('table', { name: 'Lista de tareas' })).toBeTruthy();
  });
  it('conserva el motivo de dominio en una carga rechazada', async () => {
    vi.spyOn(context.repository, 'listWorkItems').mockRejectedValueOnce(
      new DataError('ACCESS_DENIED', 'No tienes acceso a este proyecto.'),
    );
    render(<SynchronizedViews view="list" />);
    expect((await screen.findByRole('alert')).textContent).toContain(
      'No tienes acceso a este proyecto.',
    );
  });

  it('distingue guardado confirmado de recarga fallida sin repetir la escritura', async () => {
    const user = userEvent.setup();
    const first = await context.repository.listWorkItems({
      phId: context.phId,
      projectId: demoIds.opsProject,
    });
    const list = vi
      .spyOn(context.repository, 'listWorkItems')
      .mockResolvedValueOnce(first)
      .mockRejectedValueOnce(new Error('offline'));
    const update = vi.spyOn(context.repository, 'updateWorkItem');
    render(<SynchronizedViews view="list" />);
    await screen.findByText(task.title);
    await user.click(screen.getByRole('button', { name: `Editar ${task.title}` }));
    await user.type(screen.getByLabelText('Nombre de la tarea'), ' guardada');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await screen.findByText(/El cambio se guardó, pero/);
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Volver a cargar' }));
    await screen.findByText(`${task.title} guardada`);
    expect(update).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledTimes(3);
  });
  it('preserva el borrador recurrente tras un fallo y limpia únicamente tras crearlo', async () => {
    const user = userEvent.setup();
    const create = vi
      .spyOn(context.repository, 'createWorkItem')
      .mockRejectedValueOnce(new Error('offline'));
    render(<SynchronizedViews view="list" />);
    await screen.findByText(task.title);
    await user.click(screen.getByText('Crear tarea recurrente'));
    await user.type(screen.getByLabelText('Título'), 'Revisión periódica');
    await user.click(screen.getByRole('button', { name: 'Crear recurrencia' }));
    await screen.findByRole('alert');
    expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('Revisión periódica');
    await user.click(screen.getByRole('button', { name: 'Crear recurrencia' }));
    await waitFor(() =>
      expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe(''),
    );
    expect(create).toHaveBeenCalledTimes(2);
    await screen.findByText('Revisión periódica');
  });

  it('no aplica recargas de una edición que termina después de cambiar de proyecto', async () => {
    const user = userEvent.setup();
    const save = deferred<WorkItem>();
    vi.spyOn(context.repository, 'updateWorkItem').mockReturnValue(save.promise);
    const list = vi.spyOn(context.repository, 'listWorkItems');
    const { rerender } = render(<SynchronizedViews view="list" />);
    await screen.findByText(task.title);
    await user.click(screen.getByRole('button', { name: `Editar ${task.title}` }));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    rerender(<SynchronizedViews view="list" projectId={demoIds.adminProject} />);
    await screen.findByRole('table');
    const reads = list.mock.calls.length;
    await act(async () => save.resolve(task));
    expect(list).toHaveBeenCalledTimes(reads);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('recupera la carga fallida al reintentar y presenta una sola tabla accesible', async () => {
    const list = vi
      .spyOn(context.repository, 'listWorkItems')
      .mockRejectedValueOnce(new Error('offline'));
    render(<SynchronizedViews view="list" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    await screen.findByText(task.title);
    expect(list).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(screen.getAllByRole('columnheader')).toHaveLength(6);
    expect(screen.getAllByRole('cell').length).toBeGreaterThan(0);
  });

  it('conserva filtro y edición tras error y cierra el modal solo después del éxito', async () => {
    const user = userEvent.setup();
    const update = vi
      .spyOn(context.repository, 'updateWorkItem')
      .mockRejectedValueOnce(
        new DataError('CONFLICT', 'La tarea cambió en otra sesión. Recarga antes de guardar.'),
      );
    render(<SynchronizedViews view="list" />);
    await screen.findByText(task.title);
    await user.type(screen.getByLabelText('Buscar o filtrar'), task.title);
    await user.click(screen.getByRole('button', { name: `Editar ${task.title}` }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Nombre de la tarea'), ' corregida');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));
    expect((await within(dialog).findByRole('alert')).textContent).toContain(
      'La tarea cambió en otra sesión. Recarga antes de guardar.',
    );
    expect((within(dialog).getByLabelText('Nombre de la tarea') as HTMLInputElement).value).toBe(
      `${task.title} corregida`,
    );
    expect((screen.getByLabelText('Buscar o filtrar') as HTMLInputElement).value).toBe(task.title);
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(update).toHaveBeenCalledTimes(2);
    await screen.findByText(`${task.title} corregida`);
  });

  it.each(['project', 'ph', 'actor'] as const)(
    'descarta resultados de un contexto %s anterior',
    async (change) => {
      const old = deferred<Page<WorkItem>>();
      vi.spyOn(context.repository, 'listBoards').mockResolvedValue([]);
      vi.spyOn(context.repository, 'listPeople').mockResolvedValue([]);
      vi.spyOn(context.repository, 'listWorkItems')
        .mockReturnValueOnce(old.promise)
        .mockResolvedValue({ items: [{ ...task, title: 'Contexto actual' }] });
      const { rerender } = render(<SynchronizedViews view="list" />);
      if (change === 'ph') context = { ...context, phId: demoIds.bahia };
      if (change === 'actor')
        context = { ...context, actor: { ...context.actor, id: demoIds.collab } };
      rerender(
        <SynchronizedViews
          view="list"
          projectId={change === 'project' ? demoIds.adminProject : demoIds.opsProject}
        />,
      );
      await screen.findByText('Contexto actual');
      await act(async () => old.resolve({ items: [{ ...task, title: 'Resultado anterior' }] }));
      expect(screen.queryByText('Resultado anterior')).toBeNull();
      expect(screen.getByText('Contexto actual')).toBeTruthy();
    },
  );

  it('muestra recurrencias en semana, mes y agenda sin duplicar la primera y limita el período', async () => {
    const recurring: WorkItem = {
      ...task,
      title: 'Inspección diaria',
      type: 'RECURRING_TASK',
      startsOn: '2026-09-19',
      recurrence: {
        frequency: 'DAILY',
        interval: 1,
        startsOn: '2026-09-19',
        occurrenceCount: 3,
        weekdays: [],
      },
    };
    vi.spyOn(context.repository, 'listWorkItems').mockResolvedValue({ items: [recurring] });
    render(<SynchronizedViews view="calendar" />);
    await waitFor(() => expect(screen.getAllByText('Inspección diaria')).toHaveLength(2));
    await userEvent.click(screen.getByRole('button', { name: 'Mes' }));
    expect(screen.getAllByText('Inspección diaria')).toHaveLength(3);
    await userEvent.click(screen.getByRole('button', { name: 'Agenda' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    await userEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('permite navegar meses completos y editar fechas sin arrastrar', async () => {
    vi.spyOn(context.repository, 'listWorkItems').mockResolvedValue({
      items: [{ ...task, startsOn: '2026-09-19', recurrence: undefined }],
    });
    const update = vi.spyOn(context.repository, 'updateWorkItem');
    render(<SynchronizedViews view="calendar" />);
    const date = await screen.findByLabelText(`Fecha de ${task.title}`);
    fireEvent.change(date, { target: { value: '2026-09-20' } });
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        task.id,
        expect.objectContaining({ startsOn: '2026-09-20' }),
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Mes' }));
    expect(screen.getAllByRole('button', { name: /Crear tarea el/ })).toHaveLength(30);
    await userEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    expect(screen.getAllByRole('button', { name: /Crear tarea el/ })).toHaveLength(31);
  });
});
