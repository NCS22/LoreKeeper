"use client";

import { Menu } from "lucide-react";
import { en } from "@/messages/en";
import { Button } from "@/components/ui/button";
import { useWorkspaceLayout } from "@/components/workspace/workspace-layout";

// Small screens only: on desktop the sidebar has its own collapse button and rail.
export function SidebarToggleButton() {
  const { isSidebarCollapsed, toggleSidebar } = useWorkspaceLayout();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={en.workspace.openSidebar}
      aria-expanded={!isSidebarCollapsed}
      onClick={toggleSidebar}
      className="md:hidden"
    >
      <Menu aria-hidden />
    </Button>
  );
}
