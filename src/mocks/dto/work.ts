export type WorkMediumDto = "NOVEL" | "MANGA" | "COMIC" | "ANIME" | "TV_SERIES" | "FILM" | "OTHER";

// Wording the UI uses for the units of a work (chapter, episode...).
export type UnitKindDto = "CHAPTER" | "EPISODE" | "OTHER";

export type WorkDto = {
  id: string;
  universeId: string;
  title: string;
  medium: WorkMediumDto;
  unitKind: UnitKindDto;
  description: string | null;
  coverImageUrl: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type NarrativeUnitDto = {
  id: string;
  workId: string;
  label: string;
  groupLabel: string | null;
};
