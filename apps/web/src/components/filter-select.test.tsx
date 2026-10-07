import { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FilterSelect } from './filter-select';

afterEach(cleanup);
const options = [
  { value: '', label: 'Todos' },
  { value: 'HIGH', label: 'Alta' },
];

describe('FilterSelect', () => {
  it('expone etiqueta y valor seleccionado, participa en el formulario y conserva foco', async () => {
    function Example() {
      const [value, setValue] = useState('');
      return (
        <form aria-label="Filtros">
          <FilterSelect
            label="Prioridad"
            name="priority"
            value={value}
            options={options}
            onChange={setValue}
          />
        </form>
      );
    }
    const user = userEvent.setup();
    render(<Example />);
    const select = screen.getByRole('combobox', { name: 'Prioridad' });
    await user.tab();
    expect(document.activeElement).toBe(select);
    await user.selectOptions(select, 'HIGH');
    expect(screen.getByRole('option', { name: 'Alta', selected: true })).toBeTruthy();
    expect(new FormData(screen.getByRole('form') as HTMLFormElement).get('priority')).toBe('HIGH');
    expect(document.activeElement).toBe(select);
  });

  it('respeta disabled sin emitir cambios ni enviar un campo oculto', async () => {
    const change = vi.fn();
    render(
      <form aria-label="Filtros">
        <FilterSelect
          label="Prioridad"
          name="priority"
          value="HIGH"
          options={options}
          onChange={change}
          disabled
        />
      </form>,
    );
    await userEvent.setup().selectOptions(screen.getByRole('combobox'), '');
    expect(change).not.toHaveBeenCalled();
    expect(new FormData(screen.getByRole('form') as HTMLFormElement).has('priority')).toBe(false);
  });
});
