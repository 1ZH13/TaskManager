'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { IconButton, Logo } from '../../../../packages/ui/src/index';
const navigation = [['home', '/'], ['administrative', '/administrativa'], ['operations', '/operaciones'], ['accounting', '/contabilidad'], ['people', '/personas'], ['teams', '/equipos'], ['providers', '/proveedores'], ['reports', '/informes'], ['settings', '/configuracion']] as const;
const projectTabs = [['overview', 'resumen'], ['list', 'lista'], ['board', 'tablero'], ['calendar', 'calendario'], ['timeline', 'cronograma'], ['documents', 'documentos'], ['forms', 'formularios'], ['projectReports', 'informes']] as const;
export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations('app'); const pathname = usePathname(); const [open, setOpen] = useState(false); const [collapsed, setCollapsed] = useState(false); const projectBase = pathname.startsWith('/operaciones/') ? '/operaciones/mantenimiento' : null;
  return <div className={`shell ${collapsed ? 'collapsed' : ''}`}><IconButton className="mobile-menu" label={t('menu')} aria-expanded={open} onClick={() => setOpen(!open)}>☰</IconButton><aside className={open ? 'open' : ''}><div className="brand"><Logo /><span>{t('name')}</span></div><IconButton className="collapse" label={t('collapse')} onClick={() => setCollapsed(!collapsed)}>‹</IconButton><nav aria-label="Navegación principal">{navigation.map(([key, href]) => <Link key={key} href={href} aria-current={pathname === href || (href !== '/' && pathname.startsWith(`${href}/`)) ? 'page' : undefined} onClick={() => setOpen(false)}>{t(key)}</Link>)}</nav></aside><main><header><div><strong>PH Vista Marina</strong><span> · Contexto de demostración</span></div><IconButton className="profile" label="Abrir perfil">AM</IconButton></header>{projectBase && <><section className="project-header"><p className="eyebrow">Gestión operativa</p><h1>Mantenimiento preventivo</h1></section><nav className="project-tabs" aria-label="Navegación del proyecto">{projectTabs.map(([key, slug]) => { const href = `${projectBase}/${slug}`; return <Link key={slug} href={href} aria-current={pathname === href ? 'page' : undefined}>{t(key)}</Link>; })}</nav></>}{children}</main></div>;
}
