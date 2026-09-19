import { AppShell } from '../../components/app-shell';
export default async function WorkspaceRoute({ params }: { params: Promise<{ segments: string[] }> }) {
  const { segments } = await params; const title = segments.at(-1)?.replaceAll('-', ' ') ?? 'Inicio';
  return <AppShell><section className="workspace-page"><p className="eyebrow">Vista de demostración</p><h2>{title.charAt(0).toUpperCase() + title.slice(1)}</h2><p>Esta ruta ya está preparada para recibir la funcionalidad del siguiente incremento.</p></section></AppShell>;
}
