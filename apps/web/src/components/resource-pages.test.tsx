import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DocumentsPage, NotificationsPage, ProvidersPage } from './resource-pages';

describe('Resource pages', () => {
  it('muestra documentos con filtros de relación y metadatos', async () => {
    render(<DocumentsPage />);
    expect(await screen.findByText('Informe de bomba.pdf')).toBeTruthy();
    expect(screen.getAllByLabelText('Proyecto')).toHaveLength(2);
    expect(screen.getAllByLabelText('Tarea')).toHaveLength(2);
    expect(screen.getByText(/Responsable: Ana Martínez/)).toBeTruthy();
  });

  it('deriva referencias del proveedor y excluye el trabajo terminado', async () => {
    render(<ProvidersPage />);
    expect(await screen.findByText('Servicios del Istmo')).toBeTruthy();
    expect(screen.getByText(/1 trabajo abierto/)).toBeTruthy();
    expect(screen.getByText(/1 documentos/)).toBeTruthy();
  });

  it('vincula y permite marcar leída una notificación', async () => {
    const user = userEvent.setup(); render(<NotificationsPage />);
    expect(await screen.findByText('Evidencia pendiente')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Abrir recurso' }).getAttribute('href')).toContain('tablero?taskId=');
    await user.click(screen.getByRole('button', { name: 'Marcar leída' }));
    await waitFor(() => expect(screen.getByText('Leída')).toBeTruthy());
  });
});
