"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ChevronRight, Orbit } from "lucide-react";
import { en } from "@/messages/en";
import { cn } from "@/components/ui/cn";
import { WORK_MEDIUM_ICONS } from "@/components/sidebar/work-medium-config";
import { useWorkspaceLayout } from "@/components/workspace/workspace-layout";
import { useWorkspaceState } from "@/components/workspace/workspace-state";
import { useUniverses } from "@/components/universes/universes-provider";
import { getWorksOfUniverse } from "@/mocks/data/queries";

type TreeNode = {
  key: string;
  universeId: string;
  workId: string | null;
};

const universeKey = (universeId: string) => `universe:${universeId}`;
const workKey = (workId: string) => `work:${workId}`;

const ROW_CLASS_NAME = cn(
  "group rounded-control relative flex h-7 cursor-pointer items-center gap-1.5 pr-2 text-sm select-none",
  "transition-colors duration-(--motion-fast) ease-standard hover:bg-hover aria-selected:bg-selection",
  "before:rounded-pill before:absolute before:inset-y-1 before:left-0 before:w-0.5 aria-selected:before:bg-accent",
  "focus-visible:-outline-offset-2",
);

type SidebarTreeProps = {
  expandedUniverseIds: ReadonlySet<string>;
  setUniverseExpanded: (universeId: string, isExpanded: boolean) => void;
};

// Implements the WAI-ARIA tree pattern: one tab stop, arrow keys to move, right/left to expand.
export function SidebarTree({ expandedUniverseIds, setUniverseExpanded }: SidebarTreeProps) {
  const { state, dispatch } = useWorkspaceState();
  const { closeSidebarAfterNavigation } = useWorkspaceLayout();
  const groupIdPrefix = useId();
  const treeItemElements = useRef(new Map<string, HTMLElement>());
  const { universes } = useUniverses();

  const selectedKey =
    state.selectedWorkId !== null ? workKey(state.selectedWorkId) : universeKey(state.selectedUniverseId);
  const [lastFocusedKey, setLastFocusedKey] = useState(selectedKey);

  const visibleNodes = useMemo<TreeNode[]>(
    () =>
      universes.flatMap((universe) => [
        { key: universeKey(universe.id), universeId: universe.id, workId: null },
        ...(expandedUniverseIds.has(universe.id)
          ? getWorksOfUniverse(universe.id).map((work) => ({
              key: workKey(work.id),
              universeId: universe.id,
              workId: work.id,
            }))
          : []),
      ]),
    [universes, expandedUniverseIds],
  );

  // Exactly one item is tabbable; fall back to the first when the last focused one was collapsed away.
  const tabbableKey = visibleNodes.some((node) => node.key === lastFocusedKey)
    ? lastFocusedKey
    : visibleNodes[0].key;

  function focusNode(node: TreeNode | undefined) {
    if (node !== undefined) treeItemElements.current.get(node.key)?.focus();
  }

  function selectNode(node: TreeNode) {
    if (node.workId === null) dispatch({ type: "universeSelected", universeId: node.universeId });
    else dispatch({ type: "workSelected", universeId: node.universeId, workId: node.workId });
    closeSidebarAfterNavigation();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>, node: TreeNode) {
    const index = visibleNodes.findIndex((visibleNode) => visibleNode.key === node.key);
    const isExpanded = expandedUniverseIds.has(node.universeId);
    const isUniverse = node.workId === null;

    switch (event.key) {
      case "ArrowDown":
        focusNode(visibleNodes[index + 1]);
        break;
      case "ArrowUp":
        focusNode(visibleNodes[index - 1]);
        break;
      case "Home":
        focusNode(visibleNodes[0]);
        break;
      case "End":
        focusNode(visibleNodes[visibleNodes.length - 1]);
        break;
      case "ArrowRight":
        if (isUniverse && !isExpanded) setUniverseExpanded(node.universeId, true);
        else if (isUniverse) focusNode(visibleNodes[index + 1]);
        break;
      case "ArrowLeft":
        if (isUniverse && isExpanded) setUniverseExpanded(node.universeId, false);
        else if (!isUniverse) focusNode(visibleNodes.find((visibleNode) => visibleNode.key === universeKey(node.universeId)));
        break;
      case "Enter":
      case " ":
        selectNode(node);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  function registerTreeItem(key: string) {
    return (element: HTMLElement | null) => {
      if (element === null) return;
      treeItemElements.current.set(key, element);
      return () => {
        treeItemElements.current.delete(key);
      };
    };
  }

  return (
    <ul role="tree" aria-label={en.sidebar.treeLabel} className="flex flex-col gap-px p-1.5">
      {universes.map((universe) => {
        const isExpanded = expandedUniverseIds.has(universe.id);
        const works = getWorksOfUniverse(universe.id);
        const universeNode: TreeNode = { key: universeKey(universe.id), universeId: universe.id, workId: null };
        const groupId = `${groupIdPrefix}-${universe.id}`;

        return (
          <li key={universe.id} role="none">
            <div
              role="treeitem"
              ref={registerTreeItem(universeNode.key)}
              aria-level={1}
              aria-expanded={isExpanded}
              aria-selected={selectedKey === universeNode.key}
              aria-owns={groupId}
              tabIndex={tabbableKey === universeNode.key ? 0 : -1}
              onClick={() => selectNode(universeNode)}
              onFocus={() => setLastFocusedKey(universeNode.key)}
              onKeyDown={(event) => handleKeyDown(event, universeNode)}
              className={cn(ROW_CLASS_NAME, "pl-1")}
            >
              <ChevronRight
                aria-hidden
                className={cn(
                  "text-ink-muted size-4 shrink-0 transition-transform duration-(--motion-fast) ease-standard",
                  isExpanded && "rotate-90",
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  setUniverseExpanded(universe.id, !isExpanded);
                }}
              />
              <Orbit aria-hidden className="text-ink-muted size-4 shrink-0" />
              <span className="truncate font-serif text-base">{universe.name}</span>
            </div>
            <div
              data-expanded={isExpanded}
              inert={!isExpanded}
              className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-(--motion-base) ease-standard data-[expanded=true]:grid-rows-[1fr]"
            >
              <ul role="group" id={groupId} className="min-h-0 overflow-hidden">
                {works.map((work) => {
                  const workNode: TreeNode = { key: workKey(work.id), universeId: universe.id, workId: work.id };
                  const MediumIcon = WORK_MEDIUM_ICONS[work.medium];
                  return (
                    <li key={work.id} role="none">
                      <div
                        role="treeitem"
                        ref={registerTreeItem(workNode.key)}
                        aria-level={2}
                        aria-selected={selectedKey === workNode.key}
                        tabIndex={tabbableKey === workNode.key ? 0 : -1}
                        onClick={() => selectNode(workNode)}
                        onFocus={() => setLastFocusedKey(workNode.key)}
                        onKeyDown={(event) => handleKeyDown(event, workNode)}
                        className={cn(ROW_CLASS_NAME, "pl-7")}
                      >
                        <MediumIcon aria-hidden className="text-ink-muted size-4 shrink-0" />
                        <span className="truncate">{work.title}</span>
                        <span className="sr-only">{en.media[work.medium]}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
