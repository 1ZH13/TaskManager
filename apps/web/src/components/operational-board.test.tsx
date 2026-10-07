import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Link from 'next/link';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDemoState, demoIds, LocalWorkManagementRepository } from '@task-manager/data';
import type { Actor } from '@task-manager/domain';
import type { BoardColumn } from '@task-manager/shared';
import type { useDemo } from './demo-context';
import { OperationalBoard } from './operational-board';
import { taskDrafts } from './task-drafts';

let context: ReturnType<typeof useDemo>;
let params: URLSearchParams;
const router = { replace: vi.fn(), push: vi.fn() };
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
  taskDrafts.clear();
  vi.clearAllMocks();
  setContext();
  params = new URLSearchParams();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('OperationalBoard UX', () => {
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
      screen.getByRole('region', { name: 'Detalle de Inspección semanal de bombas' }),
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
