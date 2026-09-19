import { describe, expect, it } from 'vitest';
import { projectSchema } from '../src/index.js';

const base = { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', phId: '2c1a7d30-5fbc-4b73-99d5-7b7b3cd92d2a', createdAt: '2026-09-18T00:00:00.000Z', updatedAt: '2026-09-18T00:00:00.000Z', version: 0, module: 'OPERATIONS', key: 'OPS', name: 'Operaciones', status: 'ACTIVE' };
describe('projectSchema', () => {
  it('rechaza un rango de fechas invertido', () => expect(projectSchema.safeParse({ ...base, startsOn: '2026-09-20', endsOn: '2026-09-19' }).success).toBe(false));
  it('acepta un proyecto válido', () => expect(projectSchema.safeParse(base).success).toBe(true));
});
