"use client";

import { useRef } from "react";
import { en } from "@/messages/en";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { useWorkspaceState } from "@/components/workspace/workspace-state";

const PLACEHOLDER_MENUS = [en.menus.view, en.menus.help];

// Items for features that do not exist yet: every one is disabled on purpose.
function DisabledPlaceholderItems({ itemLabels }: { itemLabels: readonly string[] }) {
  return (
    <>
      <MenubarLabel>{en.menus.unavailable}</MenubarLabel>
      <MenubarSeparator />
      {itemLabels.map((itemLabel) => (
        <MenubarItem key={itemLabel} disabled>
          {itemLabel}
        </MenubarItem>
      ))}
    </>
  );
}

export function AppMenuBar() {
  const { dispatch } = useWorkspaceState();
  // Closing a menu normally gives the focus back to its trigger. After "New universe" the form has
  // already focused its name field, so that one return of focus is skipped (plan D13).
  const universeCreationStartedFromMenuRef = useRef(false);

  function startUniverseCreation() {
    universeCreationStartedFromMenuRef.current = true;
    dispatch({ type: "universeCreationStarted" });
  }

  function keepFocusOnFormAfterClosing(event: Event) {
    if (!universeCreationStartedFromMenuRef.current) return;
    universeCreationStartedFromMenuRef.current = false;
    event.preventDefault();
  }

  return (
    <Menubar aria-label={en.menus.label}>
      <MenubarMenu>
        <MenubarTrigger>{en.menus.universe.label}</MenubarTrigger>
        <MenubarContent onCloseAutoFocus={keepFocusOnFormAfterClosing}>
          <MenubarItem onSelect={startUniverseCreation}>{en.menus.universe.newUniverse}</MenubarItem>
          <MenubarSeparator />
          <DisabledPlaceholderItems itemLabels={en.menus.universe.items} />
        </MenubarContent>
      </MenubarMenu>
      {PLACEHOLDER_MENUS.map((menu) => (
        <MenubarMenu key={menu.label}>
          <MenubarTrigger>{menu.label}</MenubarTrigger>
          <MenubarContent>
            <DisabledPlaceholderItems itemLabels={menu.items} />
          </MenubarContent>
        </MenubarMenu>
      ))}
    </Menubar>
  );
}
