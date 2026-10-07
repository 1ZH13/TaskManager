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
      'projectId=old-project&phId=old-ph&board=old-board&taskId=old-task&assignee=old-person&team=old-team';
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
});
