'use client';
/* eslint-disable react-hooks/set-state-in-effect -- hydration reads browser-only persisted session. */

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { createBrowserLocalRepository, createDemoState, demoIds, loadBrowserDemoSession, saveBrowserDemoSession, type WorkManagementRepository } from '@task-manager/data';
import { useEffect } from 'react';
import type { Actor } from '@task-manager/domain';

type DemoContextValue = { phId: string; actor: Actor; phName: string; repository: WorkManagementRepository; setPhId: (id: string) => void; setActorId: (id: string) => void; reset: () => void; };
const DemoContext = createContext<DemoContextValue | null>(null);
const seed = createDemoState();
function actorFor(id: string, phId: string): Actor {
  const person = seed.people.find((item) => item.id === id && item.phId === phId) ?? seed.people.find((item) => item.phId === phId && item.role === 'ADMIN')!;
  const projectIds = person.role === 'ADMIN' ? seed.projects.filter((project) => project.phId === phId).map((project) => project.id) : seed.projectMembers.filter((member) => member.personId === person.id).map((member) => member.projectId);
  const teamIds = person.role === 'ADMIN' ? seed.teams.filter((team) => team.phId === phId).map((team) => team.id) : seed.teamMemberships.filter((membership) => membership.personId === person.id).map((membership) => membership.teamId);
  return { id: person.id, phId, role: person.role, status: person.status, projectIds, teamIds };
}
export function DemoProvider({ children }: { children: ReactNode }) {
  const [phId, setPhId] = useState<string>(demoIds.vista); const [actorId, setActorId] = useState<string>(demoIds.admin); const [hydrated, setHydrated] = useState(false);
  useEffect(() => { const session = loadBrowserDemoSession(); if (session && seed.contexts.some((context) => context.id === session.phId) && seed.people.some((person) => person.id === session.actorId && person.phId === session.phId)) { setPhId(session.phId); setActorId(session.actorId); } setHydrated(true); }, []);
  useEffect(() => { if (hydrated) saveBrowserDemoSession({ phId, actorId }); }, [hydrated, phId, actorId]);
  const actor = useMemo(() => actorFor(actorId, phId), [actorId, phId]);
  const repository = useMemo(() => createBrowserLocalRepository(() => actor), [actor]);
  const value = useMemo(() => ({ phId, actor, phName: seed.contexts.find((item) => item.id === phId)?.name ?? 'PH', repository, setPhId: (id: string) => { setPhId(id); setActorId(id === demoIds.bahia ? demoIds.bahiaAdmin : demoIds.admin); }, setActorId, reset: () => { void repository.resetDemo(); setPhId(demoIds.vista); setActorId(demoIds.admin); } }), [phId, actor, repository]);
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}
/** A deterministic fallback keeps isolated component tests and story-like renders usable. */
export function useDemo(): DemoContextValue { const value = useContext(DemoContext); const actor = actorFor(demoIds.admin, demoIds.vista); return value ?? { phId: demoIds.vista, actor, phName: 'PH Vista Marina', repository: createBrowserLocalRepository(() => actor), setPhId: () => undefined, setActorId: () => undefined, reset: () => undefined }; }
export { seed as demoSeed };
