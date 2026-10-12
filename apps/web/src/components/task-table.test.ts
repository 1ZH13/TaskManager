import { describe, expect, it } from 'vitest';
import { tableFields } from './task-table';

describe('tableFields', () => {
  it('normaliza campos no confiables y conserva identidad y acciones', () => {
    expect(tableFields('state,unknown,state,priority,title,actions')).toEqual([
      'key',
      'title',
      'state',
      'priority',
      'actions',
    ]);
    expect(tableFields('title')).toEqual(['key', 'title', 'actions']);
    expect(tableFields('unknown')).toEqual(tableFields(null));
    expect(tableFields('__proto__,constructor')).toEqual(tableFields(null));
  });
});
