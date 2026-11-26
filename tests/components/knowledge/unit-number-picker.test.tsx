import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { UnitNumberPicker } from "@/components/knowledge/unit-number-picker";
import { en } from "@/messages/en";

afterEach(cleanup);

const WORK_TITLE = "The long saga";
const texts = en.unitPicker;

type PickerHarnessProps = {
  readonly initialTypedUnitNumber?: string;
  readonly unitCount?: number;
  readonly serverErrorMessage?: string;
};

// The picker is controlled by its form; this harness holds the typed number the way the form does.
function PickerHarness({ initialTypedUnitNumber = "", unitCount = 120, serverErrorMessage }: PickerHarnessProps) {
  const [typedUnitNumber, setTypedUnitNumber] = useState(initialTypedUnitNumber);

  return (
    <UnitNumberPicker
      inputId="entity-point-unit"
      unitWording="chapter"
      unitCount={unitCount}
      workTitle={WORK_TITLE}
      typedUnitNumber={typedUnitNumber}
      onTypedUnitNumberChange={setTypedUnitNumber}
      serverErrorMessage={serverErrorMessage}
    />
  );
}

function findUnitField(): HTMLInputElement {
  return screen.getByRole("textbox", { name: texts.wordingLabels.chapter });
}

function readDescriptionIds(field: HTMLElement): string[] {
  return (field.getAttribute("aria-describedby") ?? "").split(" ").filter((describedById) => describedById !== "");
}

function typeUnitNumber(typedUnitNumber: string) {
  fireEvent.change(findUnitField(), { target: { value: typedUnitNumber } });
}

describe("UnitNumberPicker: typing a number", () => {
  it("is a text field labelled with the unit wording, for digits, with the range of the work linked as its hint", () => {
    render(<PickerHarness />);

    const unitField = findUnitField();
    const hint = screen.getByText(texts.range(120));
    expect(unitField.getAttribute("inputmode")).toBe("numeric");
    expect(readDescriptionIds(unitField)).toContain(hint.id);
    expect(unitField.getAttribute("aria-invalid")).toBe("false");
  });

  it("shows the point it picked for a number with spaces and leading zeros, linked to the field", () => {
    render(<PickerHarness />);

    typeUnitNumber(" 007 ");

    const resolvedPoint = screen.getByText(texts.resolvedPoint(texts.wordingLabels.chapter, 7, WORK_TITLE));
    expect(readDescriptionIds(findUnitField())).toContain(resolvedPoint.id);
    expect(findUnitField().getAttribute("aria-invalid")).toBe("false");
    expect(screen.queryByText(texts.noUnit("chapter", 120))).toBeNull();
  });

  it.each([
    ["a number above the units of the work", "121"],
    ["zero", "0"],
    ["an exponent", "1e3"],
    ["a sign", "+7"],
    ["a decimal", "7.0"],
  ])("picks nothing for %s and shows an error linked to the field", (_description, typedUnitNumber) => {
    render(<PickerHarness />);

    typeUnitNumber(typedUnitNumber);

    const unitField = findUnitField();
    const error = screen.getByText(texts.noUnit("chapter", 120));
    expect(unitField.getAttribute("aria-invalid")).toBe("true");
    expect(readDescriptionIds(unitField)).toContain(error.id);
    expect(screen.queryByText(/^Chapter \d+ of/u)).toBeNull();
    expect(unitField.value).toBe(typedUnitNumber);
  });

  it("shows neither a point nor an error while nothing is typed", () => {
    render(<PickerHarness initialTypedUnitNumber="12" />);

    typeUnitNumber("  ");

    expect(findUnitField().getAttribute("aria-invalid")).toBe("false");
    expect(screen.queryByText(texts.noUnit("chapter", 120))).toBeNull();
    expect(screen.queryByText(/^Chapter \d+ of/u)).toBeNull();
  });

  it("takes the error away as soon as the number matches a unit again", () => {
    render(<PickerHarness />);

    typeUnitNumber("1200");
    expect(screen.queryByText(texts.noUnit("chapter", 120))).not.toBeNull();

    typeUnitNumber("120");

    expect(screen.queryByText(texts.noUnit("chapter", 120))).toBeNull();
    expect(screen.getByText(texts.resolvedPoint(texts.wordingLabels.chapter, 120, WORK_TITLE))).not.toBeNull();
  });
});

describe("UnitNumberPicker: First and Last", () => {
  it("picks the first unit with First and the last unit of the work with Last", () => {
    render(<PickerHarness initialTypedUnitNumber="abc" unitCount={5000} />);

    fireEvent.click(screen.getByRole("button", { name: texts.firstLabel("chapter") }));
    expect(findUnitField().value).toBe("1");
    expect(screen.getByText(texts.resolvedPoint(texts.wordingLabels.chapter, 1, WORK_TITLE))).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: texts.lastLabel("chapter") }));
    expect(findUnitField().value).toBe("5000");
    expect(screen.getByText(texts.resolvedPoint(texts.wordingLabels.chapter, 5000, WORK_TITLE))).not.toBeNull();
    expect(findUnitField().getAttribute("aria-invalid")).toBe("false");
  });

  it("are buttons that never submit the form they are in", () => {
    render(<PickerHarness />);

    expect(screen.getByRole("button", { name: texts.firstLabel("chapter") }).getAttribute("type")).toBe("button");
    expect(screen.getByRole("button", { name: texts.lastLabel("chapter") }).getAttribute("type")).toBe("button");
  });
});

describe("UnitNumberPicker: an error of the server", () => {
  it("shows the message of the server linked to the field, in place of its own", () => {
    render(<PickerHarness serverErrorMessage={en.entityCreation.issues.UNIT_NUMBER_REQUIRED} />);

    const unitField = findUnitField();
    const serverError = screen.getByText(en.entityCreation.issues.UNIT_NUMBER_REQUIRED);
    expect(unitField.getAttribute("aria-invalid")).toBe("true");
    expect(readDescriptionIds(unitField)).toContain(serverError.id);
  });
});
