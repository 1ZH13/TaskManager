import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceContent } from './workspace-content';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('phId=otra-ph') }));

describe('WorkspaceContent', () => {
  it('deniega una URL que intenta forzar otra PH', () => {
    render(<WorkspaceContent segments={['operaciones']} />);
    expect(screen.getByRole('alert').textContent).toContain('PH distinta');
  });
});
