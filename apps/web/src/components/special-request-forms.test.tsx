import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AppointmentRequestForm, InvoiceSubmissionForm } from './special-request-forms';

describe('Special request forms', () => {
  it('muestra un error recuperable y persiste una cita válida', async () => {
    const user = userEvent.setup(); render(<AppointmentRequestForm />);
    await user.click(screen.getByRole('button', { name: 'Solicitar cita' }));
    expect(screen.getByRole('alert')).toBeTruthy();
    await user.type(screen.getByLabelText('RUC'), '155-123-456');
    await user.type(screen.getByLabelText('Dígito verificador'), '7');
    await user.type(screen.getByLabelText('Persona que asistirá'), 'María Pérez');
    fireEvent.change(screen.getByLabelText('Día'), { target: { value: '2026-09-22' } });
    fireEvent.change(screen.getByLabelText('Hora'), { target: { value: '09:30' } });
    await user.click(screen.getByRole('button', { name: 'Solicitar cita' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Solicitud enviada'));
  });

  it('valida y persiste una factura simulada', async () => {
    const user = userEvent.setup(); render(<InvoiceSubmissionForm />);
    await user.type(screen.getByLabelText('Nombre de factura'), 'Factura septiembre.pdf');
    await user.upload(screen.getByLabelText('Adjuntar factura fiscal'), new File(['demo'], 'factura.pdf', { type: 'application/pdf' }));
    await user.type(screen.getByLabelText('Subtotal (B/.)'), '100');
    await user.click(screen.getByRole('button', { name: 'Enviar factura' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Total simulado: B/. 107.00'));
  });
});
