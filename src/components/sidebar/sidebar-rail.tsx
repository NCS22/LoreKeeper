"use client";

import type { ComponentType, SVGProps } from "react";
import { Orbit, PanelLeftOpen } from "lucide-react";
import { en } from "@/messages/en";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { WORK_MEDIUM_ICONS } from "@/components/sidebar/work-medium-config";
import { useWorkspaceLayout } from "@/components/workspace/workspace-layout";
import { useWorkspaceState } from "@/components/workspace/workspace-state";
import { getUniverses, getWorksOfUniverse } from "@/mocks/data/queries";

// Collapsed sidebar: universes of the user, then the works of the selected universe, as icons.
export function SidebarRail() {
  const { toggleSidebar } = useWorkspaceLayout();
  const { state, dispatch } = useWorkspaceState();
  const worksOfSelectedUniverse = getWorksOfUniverse(state.selectedUniverseId);

  return (
    <div className="flex h-full flex-col items-center gap-1 py-2">
      <Button variant="ghost" size="icon" aria-label={en.workspace.expandSidebar} onClick={toggleSidebar}>
        <PanelLeftOpen aria-hidden />
      </Button>

      <div role="group" aria-label={en.sidebar.railUniverses} className="mt-1 flex flex-col items-center gap-1">
        {getUniverses().map((universe) => (
          <RailButton
            key={universe.id}
            label={universe.name}
            Icon={Orbit}
            isSelected={state.selectedUniverseId === universe.id && state.selectedWorkId === null}
            onSelect={() => dispatch({ type: "universeSelected", universeId: universe.id })}
          />
        ))}
      </div>

      <div className="bg-line my-1 h-px w-6" />

      <div role="group" aria-label={en.sidebar.railWorks} className="flex flex-col items-center gap-1">
        {worksOfSelectedUniverse.map((work) => (
          <RailButton
            key={work.id}
            label={`${work.title} (${en.media[work.medium]})`}
            Icon={WORK_MEDIUM_ICONS[work.medium]}
            isSelected={state.selectedWorkId === work.id}
            onSelect={() => dispatch({ type: "workSelected", universeId: work.universeId, workId: work.id })}
          />
        ))}
      </div>
    </div>
  );
}

type RailButtonProps = {
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  isSelected: boolean;
  onSelect: () => void;
};

function RailButton({ label, Icon, isSelected, onSelect }: RailButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          aria-pressed={isSelected}
          onClick={onSelect}
          className="aria-pressed:bg-selection aria-pressed:before:bg-accent before:rounded-pill relative before:absolute before:inset-y-1 before:-left-2 before:w-0.5"
        >
          <Icon aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
