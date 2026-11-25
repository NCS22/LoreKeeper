import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TryAgainButton } from "@/app/session-check-failed/_components/try-again-button";
import { en } from "@/messages/en";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// jsdom does not let a test redefine `location.reload` (the property is unforgeable), so only the
// global `location` the component reads is replaced, with an object that carries just the reload
// it calls. `vi.unstubAllGlobals` puts the real one back after each test.
function replacePageReloadWithSpy() {
  const pageReloadSpy = vi.fn();
  vi.stubGlobal("location", { reload: pageReloadSpy });
  return pageReloadSpy;
}

describe("TryAgainButton", () => {
  it("reloads the page when the person activates it, and not before", () => {
    const pageReloadSpy = replacePageReloadWithSpy();
    render(<TryAgainButton />);

    const tryAgainButton = screen.getByRole("button", { name: en.sessionCheckFailed.tryAgain });
    expect(pageReloadSpy).not.toHaveBeenCalled();

    fireEvent.click(tryAgainButton);

    expect(pageReloadSpy).toHaveBeenCalledTimes(1);
  });
});
