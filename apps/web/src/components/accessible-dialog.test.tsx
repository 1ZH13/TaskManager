import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessibleDialog } from './accessible-dialog';

// JSDOM does not implement the native top layer. Browser QA covers focus containment/inert.
const showModalDescriptor = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  'showModal',
);
const closeDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    }),
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    }),
  });
});
afterEach(() => {
  cleanup();
  if (showModalDescriptor)
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModalDescriptor);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  if (closeDescriptor) Object.defineProperty(HTMLDialogElement.prototype, 'close', closeDescriptor);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

describe('AccessibleDialog', () => {
  it('abre modal nativo, enfoca el campo y devuelve foco al disparador al cancelar', async () => {
    function Example() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Editar</button>
          {open && (
            <AccessibleDialog labelledBy="title" onClose={() => setOpen(false)}>
              <h2 id="title">Editar tarea</h2>
              <input aria-label="Título" data-autofocus />
              <button onClick={() => setOpen(false)}>Cancelar</button>
            </AccessibleDialog>
          )}
        </>
      );
    }
    render(<Example />);
    const trigger = screen.getByRole('button', { name: 'Editar' });
    await userEvent.setup().click(trigger);
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Título' }));
    fireEvent(
      screen.getByRole('dialog', { name: 'Editar tarea' }),
      new Event('cancel', { cancelable: true }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('no reabre ni cambia el foco cuando cambian los props', () => {
    const { rerender } = render(
      <AccessibleDialog label="Confirmar" role="alertdialog" onClose={() => undefined}>
        <button>Cancelar</button>
      </AccessibleDialog>,
    );
    screen.getByRole('button').focus();
    rerender(
      <AccessibleDialog label="Confirmar" role="alertdialog" onClose={() => undefined}>
        <button>Cancelar</button>
        <p>Mensaje actualizado</p>
      </AccessibleDialog>,
    );
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(screen.getByRole('button'));
  });

  it('cierra el ciclo de Tab y Shift+Tab entre controles habilitados', () => {
    render(
      <AccessibleDialog label="Editar" onClose={() => undefined}>
        <button>Primero</button>
        <button disabled>Deshabilitado</button>
        <button>Último</button>
      </AccessibleDialog>,
    );
    const first = screen.getByRole('button', { name: 'Primero' });
    const last = screen.getByRole('button', { name: 'Último' });
    const rects = [new DOMRect(0, 0, 100, 40)] as unknown as DOMRectList;
    vi.spyOn(first, 'getClientRects').mockReturnValue(rects);
    vi.spyOn(last, 'getClientRects').mockReturnValue(rects);
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});
