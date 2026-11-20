import { expect as baseExpect, type Locator, type Page } from "@playwright/test";

// Measurements of the layout that the browser tests of spec 004 repeat (FR-19, FR-20, NFR-6): what
// sticks out of the width of the viewport, whether a text is shown whole, which area scrolls, and
// moving through the page with the keyboard only.

const expect = baseExpect.configure({ timeout: 15_000 });

// Sub-pixel rounding of boxes and scroll widths.
const LAYOUT_ROUNDING_TOLERANCE = 1;
const MAXIMUM_TAB_PRESSES_TO_REACH_A_CONTROL = 24;

/** The widths of the two viewports of the layout tests: the narrowest supported one and a desktop one. */
export const NARROWEST_VIEWPORT = { width: 320, height: 700 } as const;
export const DESKTOP_VIEWPORT = { width: 1280, height: 720 } as const;

export type ElementOutsideTheViewportWidth = {
  readonly description: string;
  readonly left: number;
  readonly right: number;
};

/**
 * Every rendered element under `rootSelector` (the whole page when omitted) that does not fit inside
 * the viewport width, and any horizontal scrolling of the document. Empty when nothing sticks out.
 * Containers that clip (`overflow: hidden`) would hide a sideways scroll from the document, so the
 * elements themselves are measured, not only the scroll widths.
 */
export async function findElementsOutsideTheViewportWidth(
  page: Page,
  rootSelector = "body",
): Promise<ElementOutsideTheViewportWidth[]> {
  return page.evaluate(
    ({ rootSelector: selector, tolerance }) => {
      const viewportWidth = document.documentElement.clientWidth;
      const outsideElements: { description: string; left: number; right: number }[] = [];
      if (document.documentElement.scrollWidth > viewportWidth + tolerance) {
        outsideElements.push({ description: "the document scrolls sideways", left: 0, right: document.documentElement.scrollWidth });
      }
      for (const root of document.querySelectorAll(selector)) {
        for (const element of root.querySelectorAll("*")) {
          const box = element.getBoundingClientRect();
          if (box.width === 0 && box.height === 0) continue;
          if (box.left >= -tolerance && box.right <= viewportWidth + tolerance) continue;
          const text = (element.textContent ?? "").trim().slice(0, 30);
          outsideElements.push({
            description: `${element.tagName.toLowerCase()} "${text}"`,
            left: Math.round(box.left),
            right: Math.round(box.right),
          });
        }
      }
      return outsideElements;
    },
    { rootSelector, tolerance: LAYOUT_ROUNDING_TOLERANCE },
  );
}

/** Nothing sticks out of the viewport width, also after a slide-in animation has ended. */
export async function expectNothingOutsideTheViewportWidth(page: Page, rootSelector?: string): Promise<void> {
  await expect.poll(() => findElementsOutsideTheViewportWidth(page, rootSelector)).toEqual([]);
}

/** The text of the element is laid out whole: no part is clipped sideways and nothing is replaced by an ellipsis. */
export async function expectTextIsShownWhole(textElement: Locator): Promise<void> {
  const measurements = await textElement.evaluate((element) => {
    const container = element.parentElement;
    const containerBox = container?.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    return {
      textOverflow: getComputedStyle(element).textOverflow,
      parentTextOverflow: container === null ? "clip" : getComputedStyle(container).textOverflow,
      isClippedSideways: element.scrollWidth > element.clientWidth + 1,
      leftOfContainer: containerBox === undefined ? 0 : box.left - containerBox.left,
      rightOfContainer: containerBox === undefined ? 0 : containerBox.right - box.right,
    };
  });
  expect(measurements.textOverflow).toBe("clip");
  expect(measurements.parentTextOverflow).toBe("clip");
  expect(measurements.isClippedSideways).toBe(false);
  expect(measurements.leftOfContainer).toBeGreaterThanOrEqual(-LAYOUT_ROUNDING_TOLERANCE);
  expect(measurements.rightOfContainer).toBeGreaterThanOrEqual(-LAYOUT_ROUNDING_TOLERANCE);
}

/** The element stays inside the width of the viewport (it waits for a slide-in animation to end). */
export async function expectBoxInsideTheViewportWidth(element: Locator, viewportWidth: number): Promise<void> {
  await expect
    .poll(async () => {
      const box = await element.boundingBox();
      if (box === null) return "the element has no box";
      if (box.x < -LAYOUT_ROUNDING_TOLERANCE) return `starts at ${box.x}`;
      if (box.x + box.width > viewportWidth + LAYOUT_ROUNDING_TOLERANCE) return `ends at ${box.x + box.width}`;
      return "inside";
    })
    .toBe("inside");
}

/**
 * The closest ancestor of the element that scrolls vertically on its own (`overflow-y` auto or
 * scroll), described by how much it holds and how much it shows. `null` when none scrolls.
 */
export async function measureScrollingAreaAround(element: Locator): Promise<{
  readonly contentHeight: number;
  readonly shownHeight: number;
  readonly contentWidth: number;
  readonly shownWidth: number;
} | null> {
  return element.evaluate((startElement) => {
    for (let ancestor = startElement.parentElement; ancestor !== null; ancestor = ancestor.parentElement) {
      const overflowY = getComputedStyle(ancestor).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") {
        return {
          contentHeight: ancestor.scrollHeight,
          shownHeight: ancestor.clientHeight,
          contentWidth: ancestor.scrollWidth,
          shownWidth: ancestor.clientWidth,
        };
      }
    }
    return null;
  });
}

/** Presses Tab until `target` has the focus; fails after a bounded number of presses. */
export async function tabUntilFocused(page: Page, target: Locator): Promise<void> {
  for (let pressCount = 0; pressCount < MAXIMUM_TAB_PRESSES_TO_REACH_A_CONTROL; pressCount += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => element === document.activeElement)) {
      return;
    }
  }
  throw new Error(`The control was not reached with Tab in ${MAXIMUM_TAB_PRESSES_TO_REACH_A_CONTROL} presses.`);
}
