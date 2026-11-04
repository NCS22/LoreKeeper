import { en } from "@/messages/en";
import { PreferencesSync } from "@/components/accessibility/preferences-sync";
import { InspectorContent } from "@/components/inspector/inspector-content";
import { InspectorPanel } from "@/components/inspector/inspector-panel";
import { Sidebar } from "@/components/sidebar/sidebar";
import { Topbar } from "@/components/topbar/topbar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CentralArea } from "@/components/workspace/central-area";
import { WorkspaceLayout } from "@/components/workspace/workspace-layout";
import { WorkspaceStateProvider } from "@/components/workspace/workspace-state";

export function Workspace() {
  return (
    <TooltipProvider>
      <WorkspaceStateProvider>
        <PreferencesSync />
        <a
          href="#main-content"
          className="bg-primary text-primary-foreground rounded-control sr-only z-50 px-3 py-1.5 focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
        >
          {en.workspace.skipToContent}
        </a>
        <WorkspaceLayout topbar={<Topbar />} sidebar={<Sidebar />} inspector={<InspectorPanel><InspectorContent /></InspectorPanel>}>
          <CentralArea />
        </WorkspaceLayout>
      </WorkspaceStateProvider>
    </TooltipProvider>
  );
}
