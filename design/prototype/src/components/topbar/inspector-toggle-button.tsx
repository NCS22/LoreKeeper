"use client";

import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { en } from "@messages/en";
import { Button } from "@/components/ui/button";
import { useWorkspaceLayout } from "@/components/workspace/workspace-layout";

export function InspectorToggleButton() {
  const { isInspectorCollapsed, toggleInspector } = useWorkspaceLayout();
  const Icon = isInspectorCollapsed ? PanelRightOpen : PanelRightClose;

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={en.workspace.detailsPanel}
      aria-expanded={!isInspectorCollapsed}
      onClick={toggleInspector}
    >
      <Icon aria-hidden />
    </Button>
  );
}
