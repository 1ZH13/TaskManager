'use client';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Logo } from '../../../../packages/ui/src/index';

const navigation = [['home', '/'], ['administrative', '/administrativa'], ['operations', '/operaciones'], ['accounting', '/contabilidad'], ['people', '/personas'], ['teams', '/equipos'], ['providers', '/proveedores'], ['reports', '/informes'], ['settings', '/configuracion']] as const;
export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations('app'); const [open, setOpen] = useState(false); const [collapsed, setCollapsed] = useState(false);
  return <div className={`shell ${collapsed ? 'collapsed' : ''}`}><button className="mobile-menu" aria-label={t('menu')} aria-expanded={open} onClick={() => setOpen(!open)}>☰</button><aside className={open ? 'open' : ''}><div className="brand"><Logo /><span>{t('name')}</span></div><button className="collapse" onClick={() => setCollapsed(!collapsed)} aria-label={t('collapse')}>‹</button><nav aria-label="Navegación principal">{navigation.map(([key, href]) => <Link key={key} href={href} onClick={() => setOpen(false)}>{t(key)}</Link>)}</nav></aside><main><header><div><strong>PH Vista Marina</strong><span> · Contexto de demostración</span></div><button className="profile" aria-label="Abrir perfil">AM</button></header>{children}</main></div>;
}
