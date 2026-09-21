import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from './app-shell';

vi.mock('next/navigation', () => ({ usePathname: () => '/operaciones/mantenimiento/tablero', useSearchParams: () => new URLSearchParams() }));
vi.mock('next-intl', () => ({ useTranslations: () => (_key: string) => _key }));

describe('AppShell', () => {
  it('expone la pestaña del proyecto activa y navegación con nombre accesible', async () => {
    render(<AppShell><p>Contenido</p></AppShell>);
    await screen.findByLabelText('1 validaciones pendientes');
    expect(screen.getByRole('navigation', { name: 'Navegación del proyecto' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'board' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: 'menu' })).toBeTruthy();
  });
});
