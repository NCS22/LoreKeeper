import { Suspense } from "react";
import { redirect } from "next/navigation";
import { en } from "@/messages/en";
import { PreferencesSync } from "@/components/accessibility/preferences-sync";
import { InspectorEmptyState } from "@/components/inspector/inspector-empty-state";
import { InspectorPanel } from "@/components/inspector/inspector-panel";
import { Sidebar } from "@/components/sidebar/sidebar";
import { Topbar } from "@/components/topbar/topbar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { buildUniverseFormVocabulary } from "@/components/universes/build-universe-form-vocabulary";
import { UniversesProvider } from "@/components/universes/universes-provider";
import { CentralArea } from "@/components/workspace/central-area";
import { loadWorkspaceUniversesForPage } from "@/components/workspace/load-workspace-universes-for-page";
import { WorkspaceLayout } from "@/components/workspace/workspace-layout";
import { WorkspaceLoading } from "@/components/workspace/workspace-loading";
import { WorkspaceStateProvider } from "@/components/workspace/workspace-state";
import { buildSignInAddress } from "@/modules/accounts";

// The data is read inside the boundary: the shell is static and the universes of the account stream
// in once they are loaded.
export function Workspace() {
  return (
    <Suspense fallback={<WorkspaceLoading />}>
      <WorkspaceWithUniverses />
    </Suspense>
  );
}

async function WorkspaceWithUniverses() {
  const pageLoad = await loadWorkspaceUniversesForPage();
  if (pageLoad.status === "signed-out") redirect(buildSignInAddress(null));

  return (
    <TooltipProvider>
      <WorkspaceStateProvider initialSelectedUniverseId={pageLoad.initialUniverseId}>
        <UniversesProvider
          initialUniverses={pageLoad.universes}
          accountKey={pageLoad.accountKey}
          signInAddress={buildSignInAddress(null)}
          vocabulary={buildUniverseFormVocabulary()}
        >
          <PreferencesSync />
          <a
            href="#main-content"
            className="bg-primary text-primary-foreground rounded-control sr-only z-50 px-3 py-1.5 focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
          >
            {en.workspace.skipToContent}
          </a>
          <WorkspaceLayout topbar={<Topbar />} sidebar={<Sidebar />} inspector={<InspectorPanel><InspectorEmptyState /></InspectorPanel>}>
            <CentralArea />
          </WorkspaceLayout>
        </UniversesProvider>
      </WorkspaceStateProvider>
    </TooltipProvider>
  );
}
