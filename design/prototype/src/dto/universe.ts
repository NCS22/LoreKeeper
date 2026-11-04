export type UniverseModeDto = "READER" | "AUTHOR";

export type UniverseDto = {
  id: string;
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  mode: UniverseModeDto;
  createdAt: string;
  updatedAt: string;
};
