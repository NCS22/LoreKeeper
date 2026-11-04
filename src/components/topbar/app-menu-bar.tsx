"use client";

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

const MENUS = [en.menus.universe, en.menus.view, en.menus.help];

// Placeholders for future features: every item is disabled on purpose.
export function AppMenuBar() {
  return (
    <Menubar aria-label={en.menus.label}>
      {MENUS.map((menu) => (
        <MenubarMenu key={menu.label}>
          <MenubarTrigger>{menu.label}</MenubarTrigger>
          <MenubarContent>
            <MenubarLabel>{en.menus.unavailable}</MenubarLabel>
            <MenubarSeparator />
            {menu.items.map((itemLabel) => (
              <MenubarItem key={itemLabel} disabled>
                {itemLabel}
              </MenubarItem>
            ))}
          </MenubarContent>
        </MenubarMenu>
      ))}
    </Menubar>
  );
}
