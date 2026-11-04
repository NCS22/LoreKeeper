"use client";

import { useCallback, useMemo } from "react";
import { PanelLeftClose, Plus } from "lucide-react";
import { en } from "@/messages/en";
import { Button } from "@/components/ui/button";
import { SidebarRail } from "@/components/sidebar/sidebar-rail";
import { SidebarTree } from "@/components/sidebar/sidebar-tree";
import { useWorkspaceLayout } from "@/components/workspace/workspace-layout";
import { useWorkspaceState } from "@/components/workspace/workspace-state";

export function Sidebar() {
  const { showsSidebarRail, toggleSidebar, closeSidebarAfterNavigation } = useWorkspaceLayout();
  const { state, dispatch } = useWorkspaceState();
  const expandedUniverseIds = useMemo(() => new Set(state.expandedUniverseIds), [state.expandedUniverseIds]);

  const setUniverseExpanded = useCallback(
    (universeId: string, isExpanded: boolean) => dispatch({ type: "universeExpansionSet", universeId, isExpanded }),
    [dispatch],
  );

  // Below the md breakpoint the sidebar is a drawer that covers the form, so it closes once the creation starts.
  const startUniverseCreation = useCallback(() => {
    dispatch({ type: "universeCreationStarted" });
    closeSidebarAfterNavigation();
  }, [dispatch, closeSidebarAfterNavigation]);

  if (showsSidebarRail) return <SidebarRail />;

  return (
    <div className="flex h-full flex-col">
      <div className="border-line flex h-9 shrink-0 items-center justify-between border-b pr-1 pl-3">
        <h2 className="font-serif text-base">{en.workspace.sidebarLabel}</h2>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon-sm" aria-label={en.sidebar.newUniverse} onClick={startUniverseCreation}>
            <Plus aria-hidden />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={en.workspace.collapseSidebar} onClick={toggleSidebar}>
            <PanelLeftClose aria-hidden />
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <SidebarTree expandedUniverseIds={expandedUniverseIds} setUniverseExpanded={setUniverseExpanded} />
      </div>
    </div>
  );
}
