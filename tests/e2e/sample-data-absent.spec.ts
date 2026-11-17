import { randomUUID } from "node:crypto";
import { expect as baseExpect, test, type APIRequestContext, type Page } from "@playwright/test";
import { SAMPLE_DATA_MARKER_TEXTS } from "../support/sample-data-markers";
import { readUniversesOfAccountInDatabase } from "./support/read-universes-in-database";
import { seedAccountInDatabase } from "./support/seed-account-in-database";
import {
  fetchStaticFilesNamedBy,
  readServedAnswer,
  servedAnswerContains,
  type ServedAnswer,
} from "./support/served-files";
import { signInThroughTheForm as signInAndWaitForTheRoot } from "./support/sign-in-through-the-form";
import { createUniverseThroughTheForm } from "./support/universe-workspace-support";
import type { E2eAccount } from "./support/unique-account";
import { expectWorkspaceIsShown } from "./support/workspace-content";

// Nothing that is served carries the sample data of the earlier versions, and nothing served without
// a session carries the data of a stored universe (spec 004: FR-36, FR-37; the accepted risk of spec
// 003 about public files with sample data is closed here). The answers are read the way a crawler
// would, over HTTP without following redirects: the pages, their streamed (RSC) form, every static
// file the pages name (and the files those name), the icon and the image endpoint.

// Sign-in runs a deliberately slow password hash, and tests run in parallel.
const expect = baseExpect.configure({ timeout: 15_000 });

const PAGE_ADDRESSES = ["/", "/sign-in", "/sign-up", "/no-such-address", "/session-check-failed", "/confirm-session-started"];
const PUBLIC_RESOURCE_ADDRESSES = [
  "/favicon.ico",
  "/_next/image?url=%2Ffavicon.ico&w=64&q=75",
  "/_next/image?url=%2Ficon.png&w=64&q=75",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.json",
];
const STREAMED_PAGE_HEADERS = { rsc: "1" } as const;
// A hit on a page that names few static files would make the check empty: fail instead of passing.
const MINIMUM_STATIC_SCRIPTS_READ = 3;

type StoredUniverseToLookFor = {
  readonly name: string;
  readonly description: string;
  readonly universeId: string;
  readonly accountEmail: string;
};

async function signInThroughTheForm(page: Page, account: E2eAccount): Promise<void> {
  await signInAndWaitForTheRoot(page, account);
  await expectWorkspaceIsShown(page);
}

/** Signs in, stores a universe through the form and returns what a leak would show. */
async function createStoredUniverseThroughTheBrowser(page: Page, account: E2eAccount): Promise<StoredUniverseToLookFor> {
  const token = randomUUID().replaceAll("-", "");
  const name = `Stored${token}Name`;
  const description = `Stored${token}Description`;
  await signInThroughTheForm(page, account);
  await createUniverseThroughTheForm(page, { name, description });
  const storedUniverses = await readUniversesOfAccountInDatabase(account.email);
  expect(storedUniverses).toHaveLength(1);
  return { name, description, universeId: storedUniverses[0].id, accountEmail: account.email };
}

async function readPagesAndTheirStreamedForm(request: APIRequestContext): Promise<ServedAnswer[]> {
  const answers: ServedAnswer[] = [];
  for (const address of PAGE_ADDRESSES) {
    answers.push(await readServedAnswer(request, address));
    answers.push(await readServedAnswer(request, `${address}${address.includes("?") ? "&" : "?"}_rsc=e2e`, STREAMED_PAGE_HEADERS));
  }
  return answers;
}

async function readPublicResources(request: APIRequestContext): Promise<ServedAnswer[]> {
  const answers: ServedAnswer[] = [];
  for (const address of PUBLIC_RESOURCE_ADDRESSES) {
    answers.push(await readServedAnswer(request, address));
  }
  return answers;
}

function expectNoSampleData(answers: readonly ServedAnswer[]): void {
  for (const answer of answers) {
    for (const sampleMarker of SAMPLE_DATA_MARKER_TEXTS) {
      expect(servedAnswerContains(answer, sampleMarker), `${answer.address} carries the sample marker "${sampleMarker}"`).toBe(false);
    }
  }
}

function expectNoStoredUniverseData(answers: readonly ServedAnswer[], universe: StoredUniverseToLookFor): void {
  const dataOfTheUniverse = [universe.name, universe.description, universe.universeId, universe.accountEmail];
  for (const answer of answers) {
    for (const dataItem of dataOfTheUniverse) {
      expect(servedAnswerContains(answer, dataItem), `${answer.address} carries "${dataItem}"`).toBe(false);
    }
  }
}

function expectEnoughScriptsWereRead(staticFiles: readonly ServedAnswer[]): void {
  const scriptsRead = staticFiles.filter((file) => file.status === 200 && file.address.split("?")[0].endsWith(".js"));
  expect(scriptsRead.length).toBeGreaterThanOrEqual(MINIMUM_STATIC_SCRIPTS_READ);
  // Every static file a page names is really served: a broken reference would make the check blind to it.
  const staticFilesNotServed = staticFiles.filter((file) => file.status !== 200).map((file) => `${file.status} ${file.address}`);
  expect(staticFilesNotServed).toEqual([]);
}

test.describe("without a session (FR-36, FR-37)", () => {
  test("no page, streamed answer, static file, icon or image carries sample data or the data of a stored universe", async ({
    page,
    request,
  }) => {
    const account = await seedAccountInDatabase();
    const universe = await createStoredUniverseThroughTheBrowser(page, account);

    // `request` is a client of its own: it has no cookie of the account that stored the universe.
    const pageAnswers = await readPagesAndTheirStreamedForm(request);
    const publicResources = await readPublicResources(request);
    const staticFiles = await fetchStaticFilesNamedBy(request, pageAnswers);

    expectEnoughScriptsWereRead(staticFiles);
    expectNoSampleData([...pageAnswers, ...publicResources, ...staticFiles]);
    expectNoStoredUniverseData([...pageAnswers, ...publicResources, ...staticFiles], universe);
    // The workspace itself is not served: the root sends a person without a session elsewhere.
    const workspaceAnswer = pageAnswers[0];
    expect(workspaceAnswer.status).toBeGreaterThanOrEqual(300);
    expect(workspaceAnswer.status).toBeLessThan(400);
  });
});

test.describe("with a session (FR-36, FR-37)", () => {
  test("no page or streamed answer carries sample data, and no static file, icon or image carries sample data or the data of the stored universe", async ({
    page,
  }) => {
    const account = await seedAccountInDatabase();
    const requestedByTheBrowser: string[] = [];
    page.on("request", (browserRequest) => {
      const requestedAddress = new URL(browserRequest.url());
      if (browserRequest.method() === "GET" && requestedAddress.pathname.startsWith("/_next/static/")) {
        requestedByTheBrowser.push(`${requestedAddress.pathname}${requestedAddress.search}`);
      }
    });
    const universe = await createStoredUniverseThroughTheBrowser(page, account);
    await page.reload();
    await expectWorkspaceIsShown(page);
    const sessionRequest = page.context().request;

    const pageAnswers = await readPagesAndTheirStreamedForm(sessionRequest);
    const publicResources = await readPublicResources(sessionRequest);
    const staticFiles = await fetchStaticFilesNamedBy(sessionRequest, pageAnswers, requestedByTheBrowser);

    // The session is real: the workspace answers with the person's own universe, so the checks below are not empty.
    const workspaceAnswer = pageAnswers[0];
    expect(workspaceAnswer.status).toBe(200);
    expect(servedAnswerContains(workspaceAnswer, universe.name)).toBe(true);
    expect(requestedByTheBrowser.length).toBeGreaterThan(0);
    expectEnoughScriptsWereRead(staticFiles);
    expectNoSampleData([...pageAnswers, ...publicResources, ...staticFiles]);
    // The person's own data is in the pages made for them (also the not-found page, which shows their menu),
    // never in a file that anyone can read: an icon, an image or a static script, style or font.
    const filesAnyoneCanRead = [...publicResources, ...staticFiles].filter((file) => !file.contentType.includes("text/html"));
    expect(filesAnyoneCanRead.length).toBeGreaterThan(staticFiles.length);
    expectNoStoredUniverseData(filesAnyoneCanRead, universe);
  });
});
