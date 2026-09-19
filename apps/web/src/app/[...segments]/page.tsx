import { AppShell } from '../../components/app-shell';
import { WorkspaceContent } from '../../components/workspace-content';
export default async function WorkspaceRoute({ params }: { params: Promise<{ segments: string[] }> }) {
  const { segments } = await params;
  return <AppShell><WorkspaceContent segments={segments} /></AppShell>;
}
