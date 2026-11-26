import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { PointField, proposePointForWork, type PointValue } from "@/components/knowledge/point-field";
import { en } from "@/messages/en";
import type { WorkDto } from "@/modules/knowledge";
import type { UniverseMode } from "@/modules/universes";

afterEach(cleanup);

const NOVEL: WorkDto = {
  id: "6c1e8a0f-2b3d-4c5e-9f7a-1b2c3d4e5f60",
  title: "The long saga",
  medium: "NOVEL",
  unitWording: "chapter",
  unitCount: 120,
  createdAt: "2026-11-26T10:00:00.000Z",
};

const ANIME: WorkDto = {
  id: "7d2f9b1a-3c4e-4d6f-8a9b-2c3d4e5f6a71",
  title: "The adaptation",
  medium: "ANIME",
  unitWording: "episode",
  unitCount: 24,
  createdAt: "2026-11-26T10:05:00.000Z",
};

const WORKS = [NOVEL, ANIME];
const LEGEND = "Introduced at";
const texts = en.unitPicker;

type PointHarnessProps = {
  readonly universeMode: UniverseMode;
  readonly initialPoint?: PointValue;
  readonly workErrorMessage?: string;
  readonly unitErrorMessage?: string;
};

// The point field is controlled by its form; this harness holds the point the way the form does and
// shows it as text, so a test can read what the form would send.
function PointHarness({ universeMode, initialPoint, workErrorMessage, unitErrorMessage }: PointHarnessProps) {
  const [point, setPoint] = useState<PointValue>(initialPoint ?? proposePointForWork(WORKS[0], universeMode));

  return (
    <>
      <PointField
        legend={LEGEND}
        works={WORKS}
        universeMode={universeMode}
        value={point}
        onChange={setPoint}
        workErrorMessage={workErrorMessage}
        unitErrorMessage={unitErrorMessage}
      />
      <output>{`Sent: ${point.workId} / "${point.typedUnitNumber}"`}</output>
    </>
  );
}

function findPointGroup(): HTMLElement {
  return screen.getByRole("group", { name: LEGEND });
}

function findWorkSelect(): HTMLSelectElement {
  return within(findPointGroup()).getByRole("combobox", { name: texts.workLabel });
}

function findUnitField(wordingLabel: string): HTMLInputElement {
  return within(findPointGroup()).getByRole("textbox", { name: wordingLabel });
}

function chooseWork(work: WorkDto) {
  fireEvent.change(findWorkSelect(), { target: { value: work.id } });
}

function readDescriptionIds(field: HTMLElement): string[] {
  return (field.getAttribute("aria-describedby") ?? "").split(" ").filter((describedById) => describedById !== "");
}

describe("proposePointForWork", () => {
  it("proposes the last unit of the work in an AUTHOR universe", () => {
    expect(proposePointForWork(NOVEL, "AUTHOR")).toEqual({ workId: NOVEL.id, typedUnitNumber: "120" });
  });

  it("leaves the unit to the person in a READER universe", () => {
    expect(proposePointForWork(NOVEL, "READER")).toEqual({ workId: NOVEL.id, typedUnitNumber: "" });
  });

  it("names no work when the universe has none", () => {
    expect(proposePointForWork(undefined, "AUTHOR")).toEqual({ workId: "", typedUnitNumber: "" });
  });
});

describe("PointField: the works", () => {
  it("is a group named by its legend with a native choice of the works by title and medium", () => {
    render(<PointHarness universeMode="READER" />);

    const workOptions = within(findWorkSelect()).getAllByRole("option");
    expect(workOptions.map((option) => option.textContent)).toEqual([
      texts.workOption(NOVEL.title, en.knowledge.mediums.NOVEL),
      texts.workOption(ANIME.title, en.knowledge.mediums.ANIME),
    ]);
    expect(findWorkSelect().value).toBe(NOVEL.id);
  });

  it("labels the unit field with the wording of the chosen work and checks the number against its units", () => {
    render(<PointHarness universeMode="READER" />);

    chooseWork(ANIME);
    fireEvent.change(findUnitField(texts.wordingLabels.episode), { target: { value: "25" } });

    expect(screen.getByText(texts.noUnit("episode", 24))).not.toBeNull();
    expect(within(findPointGroup()).queryByRole("textbox", { name: texts.wordingLabels.chapter })).toBeNull();
  });
});

describe("PointField: the unit proposed when the work changes (FR-4)", () => {
  it("proposes the last unit of the first work and then of each work chosen, in an AUTHOR universe", () => {
    render(<PointHarness universeMode="AUTHOR" />);

    expect(findUnitField(texts.wordingLabels.chapter).value).toBe("120");
    expect(screen.getByText(texts.resolvedPoint(texts.wordingLabels.chapter, 120, NOVEL.title))).not.toBeNull();

    chooseWork(ANIME);

    expect(findUnitField(texts.wordingLabels.episode).value).toBe("24");
    expect(screen.getByText(`Sent: ${ANIME.id} / "24"`)).not.toBeNull();
  });

  it("replaces a unit typed by the person with the last unit of the new work, in an AUTHOR universe", () => {
    render(<PointHarness universeMode="AUTHOR" />);

    fireEvent.change(findUnitField(texts.wordingLabels.chapter), { target: { value: "7" } });
    chooseWork(ANIME);

    expect(findUnitField(texts.wordingLabels.episode).value).toBe("24");
  });

  it("starts with no unit, and leaves the unit empty whenever the work changes, in a READER universe", () => {
    render(<PointHarness universeMode="READER" />);

    expect(findUnitField(texts.wordingLabels.chapter).value).toBe("");
    fireEvent.change(findUnitField(texts.wordingLabels.chapter), { target: { value: "7" } });
    expect(screen.getByText(`Sent: ${NOVEL.id} / "7"`)).not.toBeNull();

    chooseWork(ANIME);

    const episodeField = findUnitField(texts.wordingLabels.episode);
    expect(episodeField.value).toBe("");
    expect(episodeField.getAttribute("aria-invalid")).toBe("false");
    expect(screen.getByText(`Sent: ${ANIME.id} / ""`)).not.toBeNull();

    chooseWork(NOVEL);

    expect(findUnitField(texts.wordingLabels.chapter).value).toBe("");
  });
});

describe("PointField: errors of the server", () => {
  it("links the error of the work to the work choice and the error of the unit to the unit field", () => {
    render(
      <PointHarness
        universeMode="READER"
        workErrorMessage={en.entityCreation.issues.WORK_INVALID}
        unitErrorMessage={en.entityCreation.issues.UNIT_NUMBER_REQUIRED}
      />,
    );

    const workError = screen.getByText(en.entityCreation.issues.WORK_INVALID);
    const unitError = screen.getByText(en.entityCreation.issues.UNIT_NUMBER_REQUIRED);
    expect(findWorkSelect().getAttribute("aria-invalid")).toBe("true");
    expect(readDescriptionIds(findWorkSelect())).toContain(workError.id);
    const unitField = findUnitField(texts.wordingLabels.chapter);
    expect(unitField.getAttribute("aria-invalid")).toBe("true");
    expect(readDescriptionIds(unitField)).toContain(unitError.id);
  });
});
