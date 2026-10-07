import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDemoState, demoIds, LocalWorkManagementRepository } from '@task-manager/data';
import type { Actor } from '@task-manager/domain';
import type { BoardColumn } from '@task-manager/shared';
import type { useDemo } from './demo-context';
import { OperationalBoard } from './operational-board';

let context: ReturnType<typeof useDemo>;
let params: URLSearchParams;
vi.mock('./demo-context', () => ({ useDemo: () => context }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => params,
  usePathname: () => '/operaciones/tablero',
  useRouter: () => ({ replace: vi.fn() }),
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
  setContext();
  params = new URLSearchParams();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('OperationalBoard UX', () => {
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
