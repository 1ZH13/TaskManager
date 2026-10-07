const taskViews = new Set(['tablero', 'lista', 'calendario', 'cronograma']);

/** Carry only filters that the destination exposes; board remembers the return selection. */
export function projectViewHref(base: string, view: string, search: { toString(): string }) {
  const current = new URLSearchParams(search.toString());
  const next = new URLSearchParams();
  const keys = ['projectId', 'phId'];
  if (taskViews.has(view)) keys.push('board', 'q', 'assignee');
  if (view === 'tablero')
    keys.push('priority', 'team', 'type', 'provider', 'dueFrom', 'dueTo', 'group');
  if (view === 'lista') keys.push('startsFrom', 'startsTo');
  for (const key of keys) {
    const value = current.get(key);
    if (value) next.set(key, value);
  }
  return `${base}/${view}${next.size ? `?${next}` : ''}`;
}
