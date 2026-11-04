import { en } from "@messages/en";
import { AccessibilityControl } from "@/components/topbar/accessibility-control";
import { AppMenuBar } from "@/components/topbar/app-menu-bar";
import { InspectorToggleButton } from "@/components/topbar/inspector-toggle-button";
import { SidebarToggleButton } from "@/components/topbar/sidebar-toggle-button";

export function Topbar() {
  return (
    <header className="border-line bg-surface flex h-(--topbar-height) shrink-0 items-center justify-between border-b px-2">
      <div className="flex min-w-0 items-center gap-1 md:gap-3">
        <SidebarToggleButton />
        <span className="truncate pl-1 font-serif text-lg font-semibold">{en.app.name}</span>
        <div className="hidden md:block">
          <AppMenuBar />
        </div>
      </div>
      <div className="flex items-center gap-1">
        <AccessibilityControl />
        <InspectorToggleButton />
      </div>
    </header>
  );
}
