import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { DemoProvider } from './demo-context';
import { FormsPage } from './forms-page';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('FormsPage submissions', () => {
  it('confirma y limpia un envío guardado sin un falso error asíncrono', async () => {
    const user = userEvent.setup();
    render(
      <DemoProvider>
        <FormsPage />
      </DemoProvider>,
    );
    const subject = await screen.findByRole('textbox', { name: 'Asunto' });
    const form = subject.closest('form')!;
    await user.type(subject, 'Revisar iluminación');
    await user.type(
      within(form).getByRole('textbox', { name: 'Detalles' }),
      'Pasillo del segundo piso',
    );
    await user.click(within(form).getByRole('button', { name: 'Enviar' }));
    await screen.findByText('Envío recibido y tarea creada.');
    expect((subject as HTMLInputElement).value).toBe('');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
