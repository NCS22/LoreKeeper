"use client";

import type { ReactNode } from "react";
import { PanelRightClose } from "lucide-react";
import { en } from "@messages/en";
import { Button } from "@/components/ui/button";
import { useWorkspaceLayout } from "@/components/workspace/workspace-layout";

export function InspectorPanel({ children }: { children?: ReactNode }) {
  const { toggleInspector } = useWorkspaceLayout();

  return (
    <div className="flex h-full w-full min-w-[var(--inspector-min-width)] flex-col">
      <div className="border-line flex h-9 shrink-0 items-center justify-between border-b pr-1 pl-3">
        <h2 className="font-serif text-base">{en.workspace.inspectorLabel}</h2>
        <Button variant="ghost" size="icon-sm" aria-label={en.workspace.collapseInspector} onClick={toggleInspector}>
          <PanelRightClose aria-hidden />
        </Button>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
