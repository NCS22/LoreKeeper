"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePanelRef } from "react-resizable-panels";
import { en } from "@/messages/en";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsDesktop } from "@/components/workspace/use-is-desktop";

const PANEL_ANIMATION_MILLISECONDS = 300;

// "Collapsed" means a narrow rail or no panel on desktop, and a closed drawer on a small screen.
type WorkspaceLayoutState = {
  isSidebarCollapsed: boolean;
  // Only a desktop sidebar shrinks to a rail; a drawer is simply closed.
  showsSidebarRail: boolean;
  isInspectorCollapsed: boolean;
  toggleSidebar: () => void;
  toggleInspector: () => void;
  openInspector: () => void;
  // Drawers cover the content, so they close once the user has picked something; panels stay.
  closeSidebarAfterNavigation: () => void;
};

const WorkspaceLayoutContext = createContext<WorkspaceLayoutState | null>(null);

export function useWorkspaceLayout(): WorkspaceLayoutState {
  const layoutState = useContext(WorkspaceLayoutContext);
  if (layoutState === null) {
    throw new Error("useWorkspaceLayout must be used inside WorkspaceLayout");
  }
  return layoutState;
}

type WorkspaceLayoutProps = {
  topbar: ReactNode;
  sidebar: ReactNode;
  inspector: ReactNode;
  children: ReactNode;
};

export function WorkspaceLayout(props: WorkspaceLayoutProps) {
  const isDesktop = useIsDesktop();
  return isDesktop ? <DesktopWorkspaceLayout {...props} /> : <MobileWorkspaceLayout {...props} />;
}

function DesktopWorkspaceLayout({ topbar, sidebar, inspector, children }: WorkspaceLayoutProps) {
  const sidebarPanelRef = usePanelRef();
  const inspectorPanelRef = usePanelRef();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current !== null) clearTimeout(animationTimeoutRef.current);
    };
  }, []);

  // Panels only animate when opened or closed from a button, never while the user drags a handle.
  const animateNextResize = useCallback(() => {
    if (animationTimeoutRef.current !== null) clearTimeout(animationTimeoutRef.current);
    setIsAnimating(true);
    animationTimeoutRef.current = setTimeout(() => setIsAnimating(false), PANEL_ANIMATION_MILLISECONDS);
  }, []);

  const toggleSidebar = useCallback(() => {
    const sidebarPanel = sidebarPanelRef.current;
    if (sidebarPanel === null) return;
    animateNextResize();
    if (sidebarPanel.isCollapsed()) sidebarPanel.expand();
    else sidebarPanel.collapse();
  }, [animateNextResize, sidebarPanelRef]);

  const toggleInspector = useCallback(() => {
    const inspectorPanel = inspectorPanelRef.current;
    if (inspectorPanel === null) return;
    animateNextResize();
    if (inspectorPanel.isCollapsed()) inspectorPanel.expand();
    else inspectorPanel.collapse();
  }, [animateNextResize, inspectorPanelRef]);

  const openInspector = useCallback(() => {
    const inspectorPanel = inspectorPanelRef.current;
    if (inspectorPanel === null || !inspectorPanel.isCollapsed()) return;
    animateNextResize();
    inspectorPanel.expand();
  }, [animateNextResize, inspectorPanelRef]);

  const closeSidebarAfterNavigation = useCallback(() => {}, []);

  const layoutState = useMemo<WorkspaceLayoutState>(
    () => ({
      isSidebarCollapsed,
      showsSidebarRail: isSidebarCollapsed,
      isInspectorCollapsed,
      toggleSidebar,
      toggleInspector,
      openInspector,
      closeSidebarAfterNavigation,
    }),
    [isSidebarCollapsed, isInspectorCollapsed, toggleSidebar, toggleInspector, openInspector, closeSidebarAfterNavigation],
  );

  return (
    <WorkspaceLayoutContext.Provider value={layoutState}>
      <div className="flex h-dvh flex-col">
        {topbar}
        <ResizablePanelGroup
          id="workspace"
          orientation="horizontal"
          data-animating={isAnimating}
          className="workspace-group min-h-0 flex-1"
        >
          <ResizablePanel
            id="sidebar"
            panelRef={sidebarPanelRef}
            defaultSize="16.5rem"
            minSize="12.5rem"
            maxSize="25rem"
            collapsible
            collapsedSize="3rem"
            groupResizeBehavior="preserve-pixel-size"
            onResize={() => setIsSidebarCollapsed(sidebarPanelRef.current?.isCollapsed() ?? false)}
          >
            <nav
              aria-label={en.workspace.sidebarLabel}
              className="surface-grain bg-surface h-full overflow-hidden"
            >
              {sidebar}
            </nav>
          </ResizablePanel>
          <ResizableHandle aria-label={en.workspace.resizeSidebar} />
          <ResizablePanel id="main" minSize="20rem">
            <main
              id="main-content"
              tabIndex={-1}
              aria-label={en.workspace.mainLabel}
              className="surface-grain bg-canvas h-full min-w-0 overflow-hidden outline-none"
            >
              {children}
            </main>
          </ResizablePanel>
          <ResizableHandle aria-label={en.workspace.resizeInspector} />
          <ResizablePanel
            id="inspector"
            panelRef={inspectorPanelRef}
            defaultSize="23.75rem"
            minSize="18.75rem"
            maxSize="35rem"
            collapsible
            collapsedSize={0}
            groupResizeBehavior="preserve-pixel-size"
            onResize={() => setIsInspectorCollapsed(inspectorPanelRef.current?.isCollapsed() ?? false)}
          >
            <aside
              aria-label={en.workspace.inspectorLabel}
              inert={isInspectorCollapsed}
              className="surface-grain bg-surface h-full overflow-hidden"
            >
              {inspector}
            </aside>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </WorkspaceLayoutContext.Provider>
  );
}

// Small screens: the content takes the whole screen and both panels open as drawers.
function MobileWorkspaceLayout({ topbar, sidebar, inspector, children }: WorkspaceLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  // The drawers have no trigger element of their own, so the element that opened each one is
  // remembered and gets the focus back when it closes.
  const sidebarOpenerRef = useRef<HTMLElement | null>(null);
  const inspectorOpenerRef = useRef<HTMLElement | null>(null);

  const toggleSidebar = useCallback(() => {
    if (!isSidebarOpen) sidebarOpenerRef.current = document.activeElement as HTMLElement | null;
    setIsSidebarOpen(!isSidebarOpen);
  }, [isSidebarOpen]);
  const toggleInspector = useCallback(() => {
    if (!isInspectorOpen) inspectorOpenerRef.current = document.activeElement as HTMLElement | null;
    setIsInspectorOpen(!isInspectorOpen);
  }, [isInspectorOpen]);
  const openInspector = useCallback(() => {
    if (!isInspectorOpen) inspectorOpenerRef.current = document.activeElement as HTMLElement | null;
    setIsInspectorOpen(true);
  }, [isInspectorOpen]);
  const closeSidebarAfterNavigation = useCallback(() => setIsSidebarOpen(false), []);

  const returnFocusToSidebarOpener = useCallback((event: Event) => {
    event.preventDefault();
    sidebarOpenerRef.current?.focus();
  }, []);
  const returnFocusToInspectorOpener = useCallback((event: Event) => {
    event.preventDefault();
    inspectorOpenerRef.current?.focus();
  }, []);

  const layoutState = useMemo<WorkspaceLayoutState>(
    () => ({
      isSidebarCollapsed: !isSidebarOpen,
      showsSidebarRail: false,
      isInspectorCollapsed: !isInspectorOpen,
      toggleSidebar,
      toggleInspector,
      openInspector,
      closeSidebarAfterNavigation,
    }),
    [isSidebarOpen, isInspectorOpen, toggleSidebar, toggleInspector, openInspector, closeSidebarAfterNavigation],
  );

  return (
    <WorkspaceLayoutContext.Provider value={layoutState}>
      <div className="flex h-dvh flex-col">
        {topbar}
        <main
          id="main-content"
          tabIndex={-1}
          aria-label={en.workspace.mainLabel}
          className="surface-grain bg-canvas min-h-0 flex-1 overflow-hidden outline-none"
        >
          {children}
        </main>
      </div>
      <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
        <SheetContent
          side="left"
          title={en.workspace.sidebarLabel}
          onCloseAutoFocus={returnFocusToSidebarOpener}
        >
          <nav aria-label={en.workspace.sidebarLabel} className="surface-grain min-h-0 flex-1 overflow-hidden">
            {sidebar}
          </nav>
        </SheetContent>
      </Sheet>
      <Sheet open={isInspectorOpen} onOpenChange={setIsInspectorOpen}>
        <SheetContent
          side="right"
          title={en.workspace.inspectorLabel}
          onCloseAutoFocus={returnFocusToInspectorOpener}
        >
          <aside aria-label={en.workspace.inspectorLabel} className="surface-grain min-h-0 flex-1 overflow-hidden">
            {inspector}
          </aside>
        </SheetContent>
      </Sheet>
    </WorkspaceLayoutContext.Provider>
  );
}
