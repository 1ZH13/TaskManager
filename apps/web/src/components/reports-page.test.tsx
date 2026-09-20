import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

vi.mock('./demo-context', () => ({
  useDemo: () => ({
    phId: '10000000-0000-4000-8000-000000000001',
    actor: { role: 'ADMIN', projectIds: [] },
    repository: {
      listProjects: vi.fn().mockResolvedValue([{ id: '30000000-0000-4000-8000-000000000001', phId: '10000000-0000-4000-8000-000000000001', module: 'OPERATIONS', key: 'OPS', name: 'Operación', status: 'ACTIVE', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z', version: 1 }]),
      listWorkItems: vi.fn().mockResolvedValue({ items: [] }),
      listActivity: vi.fn().mockResolvedValue([]),
      listBoards: vi.fn().mockResolvedValue([]),
      listPeople: vi.fn().mockResolvedValue([]),
      listTeams: vi.fn().mockResolvedValue([]),
      listProviders: vi.fn().mockResolvedValue([]),
      listBoardColumns: vi.fn().mockResolvedValue([]),
    },
  }),
}));

import { ReportsPage } from './reports-page';

describe('ReportsPage', () => {
  it('expone los filtros del informe y bloquea el proyecto en la vista contextual', async () => {
    render(<ReportsPage projectId="30000000-0000-4000-8000-000000000001" />);
    await waitFor(() => expect(screen.getByText('Estado del trabajo')).toBeTruthy());
    expect((screen.getByLabelText('Proyecto') as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByLabelText('Tablero')).toBeTruthy();
    expect(screen.getByLabelText('Equipo')).toBeTruthy();
    expect(screen.getByText('Sin tareas para estos filtros')).toBeTruthy();
  });
});
