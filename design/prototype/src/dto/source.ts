export type SourceTypeDto = "WORK_UNIT" | "SUPPLEMENTARY" | "USER_NOTE" | "EXTERNAL";

export type SourceDto = {
  id: string;
  universeId: string;
  type: SourceTypeDto;
  workId: string | null;
  narrativeUnitId: string | null;
  title: string;
  reference: string | null;
};

export type CitationDto = {
  sourceId: string;
  sourceTitle: string;
  locator: string | null;
};
