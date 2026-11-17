"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Orbit } from "lucide-react";
import { en } from "@/messages/en";
import { cn } from "@/components/ui/cn";
import { chooseTabbableUniverseId, findUniverseIdToFocus } from "@/components/sidebar/universe-tree-navigation";
import { useWorkspaceLayout } from "@/components/workspace/workspace-layout";
import { useWorkspaceState } from "@/components/workspace/workspace-state";
import { UniverseNameText } from "@/components/universes/universe-name-text";
import { useUniverses } from "@/components/universes/universes-provider";

const ROW_CLASS_NAME = cn(
  "group rounded-control relative flex min-h-7 min-w-0 cursor-pointer items-start gap-1.5 py-1 pr-2 pl-2 text-sm select-none",
  "transition-colors duration-(--motion-fast) ease-standard hover:bg-hover aria-selected:bg-selection",
  "before:rounded-pill before:absolute before:inset-y-1 before:left-0 before:w-0.5 aria-selected:before:bg-accent",
  "focus-visible:-outline-offset-2",
);

// Implements the WAI-ARIA tree pattern for a list of universes: one tab stop, arrow keys to move.
// The names wrap instead of being cut, and the list has no limit: the sidebar scrolls around it.
export function SidebarTree() {
  const { state } = useWorkspaceState();
  const { closeSidebarAfterNavigation } = useWorkspaceLayout();
  const { universes, selectUniverse } = useUniverses();
  const treeItemElements = useRef(new Map<string, HTMLElement>());
  const [lastFocusedUniverseId, setLastFocusedUniverseId] = useState<string | null>(null);

  const universeIds = universes.map((universe) => universe.id);
  const tabbableUniverseId = chooseTabbableUniverseId(universeIds, lastFocusedUniverseId, state.selectedUniverseId);

  function chooseUniverse(universeId: string) {
    selectUniverse(universeId);
    closeSidebarAfterNavigation();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>, universeId: string) {
    if (event.key === "Enter" || event.key === " ") {
      chooseUniverse(universeId);
      event.preventDefault();
      return;
    }

    const universeIdToFocus = findUniverseIdToFocus(universeIds, universeId, event.key);
    if (universeIdToFocus === null) return;
    treeItemElements.current.get(universeIdToFocus)?.focus();
    event.preventDefault();
  }

  function registerTreeItem(universeId: string) {
    return (element: HTMLElement | null) => {
      if (element === null) return;
      treeItemElements.current.set(universeId, element);
      return () => {
        treeItemElements.current.delete(universeId);
      };
    };
  }

  return (
    <ul role="tree" aria-label={en.sidebar.treeLabel} className="flex flex-col gap-px p-1.5">
      {universes.map((universe) => (
        <li key={universe.id} role="none">
          <div
            role="treeitem"
            ref={registerTreeItem(universe.id)}
            aria-level={1}
            aria-selected={state.selectedUniverseId === universe.id}
            tabIndex={tabbableUniverseId === universe.id ? 0 : -1}
            onClick={() => chooseUniverse(universe.id)}
            onFocus={() => setLastFocusedUniverseId(universe.id)}
            onKeyDown={(event) => handleKeyDown(event, universe.id)}
            className={ROW_CLASS_NAME}
          >
            <Orbit aria-hidden className="text-ink-muted mt-0.5 size-4 shrink-0" />
            <UniverseNameText text={universe.name} className="min-w-0 font-serif text-base" />
          </div>
        </li>
      ))}
    </ul>
  );
}
