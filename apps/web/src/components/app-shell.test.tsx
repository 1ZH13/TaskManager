import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from './app-shell';

const { replace, route } = vi.hoisted(() => ({ replace: vi.fn(), route: { query: '' } }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/operaciones/mantenimiento/tablero',
  useSearchParams: () => new URLSearchParams(route.query),
  useRouter: () => ({ replace }),
}));
vi.mock('next-intl', () => ({ useTranslations: () => (_key: string) => _key }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  route.query = '';
});

describe('AppShell', () => {
  it('expone la pestaña del proyecto activa y navegación con nombre accesible', async () => {
    render(
      <AppShell>
        <p>Contenido</p>
      </AppShell>,
    );
    await screen.findByLabelText('1 validaciones pendientes');
    expect(screen.getByRole('navigation', { name: 'Navegación del proyecto' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'board' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: 'menu' })).toBeTruthy();
  });
  it('conserva nombres al contraer y ofrece un enlace real a notificaciones', async () => {
    render(
      <AppShell>
        <p>Contenido</p>
      </AppShell>,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'collapse' }));
    const home = screen.getByRole('link', { name: 'home' });
    expect(home.getAttribute('aria-label')).toBe('home');
    expect(home.getAttribute('title')).toBe('home');
    expect(screen.getByRole('link', { name: 'Notificaciones' }).getAttribute('href')).toBe(
      '/notificaciones',
    );
  });
  it('sale del proyecto al cambiar PH para no reutilizar su URL', async () => {
    route.query =
      'projectId=old-project&phId=old-ph&board=old-board&taskId=old-task&assignee=old-person&team=old-team&q=anterior&dueFrom=2026-09-01&startsFrom=2026-09-01';
    render(
      <AppShell>
        <p>Contenido</p>
      </AppShell>,
    );
    const select = screen.getByRole('combobox', {
      name: 'Seleccionar propiedad horizontal',
    }) as HTMLSelectElement;
    await userEvent.setup().selectOptions(select, select.options[1].value);
    expect(replace).toHaveBeenCalledWith('/operaciones');
  });
  it('conserva filtros compartidos y selección de tablero al ir a Lista y volver', () => {
    route.query =
      'projectId=proyecto&phId=ph&board=segundo&q=bomba&assignee=persona&priority=HIGH&dueFrom=2026-09-01&taskId=tarea';
    const { rerender } = render(
      <AppShell>
        <p>Contenido</p>
      </AppShell>,
    );
    const destination = new URL(
      screen.getByRole('link', { name: 'list' }).getAttribute('href')!,
      'http://local',
    );
    expect(Object.fromEntries(destination.searchParams)).toEqual({
      projectId: 'proyecto',
      phId: 'ph',
      board: 'segundo',
      q: 'bomba',
      assignee: 'persona',
    });
    route.query = `${destination.searchParams}&startsFrom=2026-09-10&startsTo=2026-09-20`;
    rerender(
      <AppShell>
        <p>Contenido</p>
      </AppShell>,
    );
    const returned = new URL(
      screen.getByRole('link', { name: 'board' }).getAttribute('href')!,
      'http://local',
    );
    expect(Object.fromEntries(returned.searchParams)).toEqual({
      projectId: 'proyecto',
      phId: 'ph',
      board: 'segundo',
      q: 'bomba',
      assignee: 'persona',
    });
    for (const name of ['calendar', 'timeline']) {
      const href = new URL(
        screen.getByRole('link', { name }).getAttribute('href')!,
        'http://local',
      );
      expect(Object.fromEntries(href.searchParams)).toEqual(
        Object.fromEntries(returned.searchParams),
      );
    }
    const documents = new URL(
      screen.getByRole('link', { name: 'documents' }).getAttribute('href')!,
      'http://local',
    );
    expect(Object.fromEntries(documents.searchParams)).toEqual({
      projectId: 'proyecto',
      phId: 'ph',
    });
  });
  it('ofrece volver al módulo sin la pestaña Resumen ficticia', async () => {
    render(
      <AppShell>
        <p>Contenido</p>
      </AppShell>,
    );
    await screen.findByLabelText('1 validaciones pendientes');
    expect(screen.queryByRole('link', { name: 'overview' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Volver a proyectos' }).getAttribute('href')).toBe(
      '/operaciones',
    );
  });
  it('reinicia proyecto y filtros al cambiar de usuario', async () => {
    route.query =
      'projectId=proyecto&board=segundo&q=privado&assignee=anterior&startsTo=2026-09-30';
    render(
      <AppShell>
        <p>Contenido</p>
      </AppShell>,
    );
    const select = screen.getByRole('combobox', {
      name: 'Seleccionar usuario de demostración',
    }) as HTMLSelectElement;
    await userEvent.setup().selectOptions(select, select.options[1].value);
    expect(replace).toHaveBeenCalledWith('/operaciones');
  });
});
