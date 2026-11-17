"use client";

import { Orbit, PanelLeftOpen } from "lucide-react";
import { en } from "@/messages/en";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useWorkspaceLayout } from "@/components/workspace/workspace-layout";
import { useWorkspaceState } from "@/components/workspace/workspace-state";
import { UniverseNameText } from "@/components/universes/universe-name-text";
import { useUniverses } from "@/components/universes/universes-provider";

// Collapsed sidebar: the universes of the person as icons. Each one has the full name as its accessible
// label and as its tooltip; the list scrolls inside the rail when it is long.
export function SidebarRail() {
  const { toggleSidebar } = useWorkspaceLayout();
  const { state } = useWorkspaceState();
  const { universes, selectUniverse } = useUniverses();

  return (
    <div className="flex h-full flex-col items-center gap-1 py-2">
      <Button variant="ghost" size="icon" aria-label={en.workspace.expandSidebar} onClick={toggleSidebar}>
        <PanelLeftOpen aria-hidden />
      </Button>

      <div
        role="group"
        aria-label={en.sidebar.railUniverses}
        className="mt-1 flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto"
      >
        {universes.map((universe) => (
          <UniverseRailButton
            key={universe.id}
            universeName={universe.name}
            isSelected={state.selectedUniverseId === universe.id}
            onSelect={() => selectUniverse(universe.id)}
          />
        ))}
      </div>
    </div>
  );
}

type UniverseRailButtonProps = {
  universeName: string;
  isSelected: boolean;
  onSelect: () => void;
};

function UniverseRailButton({ universeName, isSelected, onSelect }: UniverseRailButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={universeName}
          aria-pressed={isSelected}
          onClick={onSelect}
          className="aria-pressed:bg-selection aria-pressed:before:bg-accent before:rounded-pill relative shrink-0 before:absolute before:inset-y-1 before:-left-2 before:w-0.5"
        >
          <Orbit aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-64">
        <UniverseNameText text={universeName} />
      </TooltipContent>
    </Tooltip>
  );
}
