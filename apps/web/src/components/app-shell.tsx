'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Bell, BriefcaseBusiness, ChartNoAxesCombined, ChevronLeft, ChevronRight, ClipboardList, FileText, FolderKanban, House, LayoutDashboard, Menu, Settings, Users, UsersRound } from 'lucide-react';
import { IconButton } from '../../../../packages/ui/src/index';
import { demoIds } from '@task-manager/data';
import { demoSeed, useDemo } from './demo-context';
const navigation = [
  ['home', '/', LayoutDashboard], ['administrative', '/administrativa', BriefcaseBusiness], ['operations', '/operaciones', FolderKanban], ['accounting', '/contabilidad', ClipboardList], ['people', '/personas', Users], ['teams', '/equipos', UsersRound], ['providers', '/proveedores', House], ['reports', '/informes', ChartNoAxesCombined], ['settings', '/configuracion', Settings],
] as const;
const projectTabs = [['overview', 'resumen'], ['list', 'lista'], ['board', 'tablero'], ['calendar', 'calendario'], ['timeline', 'cronograma'], ['documents', 'documentos'], ['forms', 'formularios'], ['validations', 'validaciones'], ['projectReports', 'informes']] as const;
export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations('app'); const pathname = usePathname(); const searchParams = useSearchParams(); const [open, setOpen] = useState(false); const [collapsed, setCollapsed] = useState(false); const [confirming, setConfirming] = useState(false); const [resetNotice, setResetNotice] = useState(false); const { phId, phName, actor, repository, setPhId, setActorId, reset } = useDemo(); const section = ['administrativa', 'operaciones', 'contabilidad'].find((candidate) => pathname.startsWith(`/${candidate}/`)); const projectBase = section ? `/${section}` : null; const projectId = searchParams.get('projectId'); const projectName = demoSeed.projects.find((project) => project.id === projectId)?.name ?? 'Proyecto'; const moduleLabel = section === 'administrativa' ? 'Gestión administrativa' : section === 'contabilidad' ? 'Gestión de contabilidad' : 'Gestión operativa'; const demoMode = process.env.NODE_ENV !== 'production';
  const [pendingValidations, setPendingValidations] = useState(0);
  const activeProjectId = projectId ?? demoIds.opsProject;
  useEffect(() => {
    let current = true;
    void repository
      .listWorkItems({ phId, projectId: activeProjectId })
      .then((page) => {
        if (current)
          setPendingValidations(
            page.items.filter(
              (item) => item.requiresValidation && item.validationStatus === 'PENDING',
            ).length,
          );
      })
      .catch(() => current && setPendingValidations(0));
    return () => {
      current = false;
    };
  }, [activeProjectId, phId, repository]);
  const actors = demoSeed.people.filter((person) => person.phId === phId && person.status === 'ACTIVE');
  const currentPerson = actors.find((person) => person.id === actor.id);
  const actorName = currentPerson?.displayName ?? 'Usuario';
  return <div className={`shell ${collapsed ? 'collapsed' : ''}`}>
    <IconButton className="mobile-menu" label={t('menu')} aria-expanded={open} onClick={() => setOpen(!open)}><Menu size={22} /></IconButton>
    <aside className={open ? 'open' : ''}>
      <div className="brand"><Image src="/brand/vertical-logo.png" alt="Vertical Task Manager" width={232} height={74} priority /></div>
      <section className="workspace-switcher" aria-label="Unidad operativa">
        <span className="sidebar-label">Unidad operativa</span>
        <label className="workspace-card"><span className="workspace-avatar">PH</span><span><strong>{phName}</strong><small>Propiedad horizontal</small></span><select aria-label="Seleccionar propiedad horizontal" value={phId} onChange={(event) => setPhId(event.target.value)}>{demoSeed.contexts.map((context) => <option key={context.id} value={context.id}>{context.name}</option>)}</select></label>
      </section>
      <nav aria-label="Navegación principal">{navigation.map(([key, href, NavIcon]) => <Link key={key} href={href} aria-current={pathname === href || (href !== '/' && pathname.startsWith(`${href}/`)) ? 'page' : undefined} onClick={() => setOpen(false)}><NavIcon aria-hidden="true" size={19} /><span>{t(key)}</span></Link>)}</nav>
      <section className="sidebar-user"><span className="user-avatar">{actorName.split(' ').map((name) => name[0]).slice(0, 2).join('')}</span><span><strong>{actorName}</strong><small>{actor.role === 'ADMIN' ? 'Administrador' : 'Colaborador'}</small></span><Bell size={18} aria-label="Notificaciones" /></section>
    </aside>
    <IconButton className="collapse" label={collapsed ? 'Abrir barra lateral' : t('collapse')} onClick={() => setCollapsed(!collapsed)}>{collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}</IconButton>
    <main><header><div className="page-context"><FileText size={18} aria-hidden="true" /><span>{projectBase ? moduleLabel : 'Espacio de trabajo'}</span></div><div className="demo-controls"><label>Usuario<select aria-label="Seleccionar usuario de demostración" value={actor.id} onChange={(event) => setActorId(event.target.value)}>{actors.map((person) => <option key={person.id} value={person.id}>{person.displayName} · {person.role === 'ADMIN' ? 'Administrador' : 'Colaborador'}</option>)}</select></label></div>{demoMode && <IconButton className="profile" label="Restablecer datos de demostración" onClick={() => setConfirming(true)}>↺</IconButton>}</header>{resetNotice && <p role="status" className="reset-notice">Datos de demostración restablecidos.</p>}{confirming && <section className="reset-dialog" role="alertdialog" aria-modal="true" aria-label="Restablecer demostración"><p>¿Restablecer los datos de demostración? Se perderán los cambios locales.</p><button className="tm-button tm-button--secondary" onClick={() => setConfirming(false)}>Cancelar</button><button className="tm-button" onClick={() => { reset(); setConfirming(false); setResetNotice(true); }}>Restablecer</button></section>}{projectBase && <><section className="project-header"><p className="eyebrow">{moduleLabel}</p><h1>{projectName}</h1></section><nav className="project-tabs" aria-label="Navegación del proyecto">{projectTabs.map(([key, slug]) => { const href = `${projectBase}/${slug}${projectId ? `?projectId=${projectId}` : ''}`; const isValidations = key === 'validations'; return <Link key={slug} href={href} aria-current={pathname.endsWith(`/${slug}`) ? 'page' : undefined}>{t(key)}{isValidations && pendingValidations > 0 && <span className="project-tab-badge" aria-label={`${pendingValidations} validaciones pendientes`}>{pendingValidations}</span>}</Link>; })}</nav></>}{children}</main>
  </div>;
}
