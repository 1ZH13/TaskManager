'use client';

import { useCallback, useEffect, useState } from 'react';
import type { WorkActivity, WorkItem } from '@task-manager/shared';
import type { RepositoryError } from '@task-manager/data';
import { useDemo } from './demo-context';

export function ActivityPage() {
  const { phId, repository } = useDemo(); const [activities, setActivities] = useState<WorkActivity[] | null>(null); const [items, setItems] = useState<WorkItem[]>([]); const [error, setError] = useState<RepositoryError | null>(null);
  const load = useCallback(() => { void Promise.all([repository.listActivity(phId), repository.listWorkItems({ phId })]).then(([nextActivities, page]) => { setActivities(nextActivities); setItems(page.items); }).catch(setError); }, [phId, repository]); useEffect(load, [load]);
  return <section className="workspace-page"><p className="eyebrow">Actividad</p><h1>Actividad del proyecto</h1><p>Historial derivado de acciones reales sobre tareas, evidencias, adjuntos y formularios.</p>{error && <p className="inline-error" role="alert">{error.message}</p>}{!activities ? <div className="tm-skeleton" /> : activities.length === 0 ? <section className="tm-state"><h2>Sin actividad</h2><p>Las próximas acciones aparecerán aquí.</p></section> : <ol className="entity-list">{activities.map((activity) => <li key={activity.id}><div><strong>{items.find((item) => item.id === activity.workItemId)?.title ?? 'Recurso eliminado'}</strong><span>{activity.message}</span><small>{new Date(activity.createdAt).toLocaleString('es-PA')}</small></div></li>)}</ol>}</section>;
}
