import { createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ErrorPage from "@/app/error";
import { en } from "@/messages/en";

// The error boundary page cannot be reached in a browser test without a control inside the
// application (NFR-8): it shows only when a page fails to render after the guard let the request
// pass. Its markup and its action are checked here by rendering it on the server, with no DOM.

const INTERNAL_DETAIL = "connect ECONNREFUSED 10.0.0.7:5432 password=hunter2";

function renderErrorPage(retry: () => void = () => {}): string {
  return renderToStaticMarkup(createElement(ErrorPage, { error: new Error(INTERNAL_DETAIL), retry }));
}

/** Walks the element tree that the page returns and collects every `onClick` handler it finds. */
function collectClickHandlers(node: ReactNode): Array<() => void> {
  if (Array.isArray(node)) return node.flatMap(collectClickHandlers);
  if (!isValidElement<{ onClick?: () => void; children?: ReactNode }>(node)) return [];
  const ownHandler = node.props.onClick ? [node.props.onClick] : [];
  return [...ownHandler, ...collectClickHandlers(node.props.children)];
}

describe("the error boundary page (FR-24)", () => {
  it("shows the designed message with one h1 and the action to try again", () => {
    const markup = renderErrorPage();

    expect(markup).toContain(`<h1 class="text-xl">${en.errorPage.title}</h1>`);
    expect(markup).toContain(en.errorPage.description);
    expect(markup).toContain(en.errorPage.tryAgain);
    expect(markup.match(/<h1/g)).toHaveLength(1);
    expect(markup).toContain("<main");
  });

  it("never shows the error that was thrown", () => {
    const markup = renderErrorPage();

    expect(markup).not.toContain(INTERNAL_DETAIL);
    expect(markup).not.toContain("ECONNREFUSED");
    expect(markup).not.toContain("hunter2");
  });

  it("has no user menu, no workspace content and does not treat the person as signed out", () => {
    const markup = renderErrorPage();

    expect(markup).not.toContain(en.userMenu.triggerLabel);
    expect(markup).not.toContain(en.accountForms.signOut.submit);
    expect(markup).not.toContain(en.accountForms.signIn.emailLabel);
    expect(markup).not.toContain(en.accountForms.signIn.title);
    expect(markup).not.toContain("Ember Concordat");
    expect(markup.toLowerCase()).not.toContain("signed out");
  });

  it("asks the framework to fetch the page again when the action is activated", () => {
    const retry = vi.fn();
    const page = ErrorPage({ error: new Error(INTERNAL_DETAIL), retry });

    const clickHandlers = collectClickHandlers(page);

    expect(clickHandlers).toHaveLength(1);
    clickHandlers[0]();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("uses only design-token utility classes (no fixed colors)", () => {
    const markup = renderErrorPage();

    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(markup).not.toMatch(/\b(?:bg|text|border)-(?:red|green|blue|gray|slate|zinc|white|black)\b/);
  });
});
