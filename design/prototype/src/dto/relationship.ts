import type { InformationStatusDto, NarrativePositionDto } from "@/dto/shared";

export type RelationshipTypeDto = {
  id: string;
  key: string;
  label: string;
  inverseLabel: string;
  isSymmetric: boolean;
};

// Directed: source -type-> target.
export type RelationshipDto = {
  id: string;
  universeId: string;
  type: RelationshipTypeDto;
  sourceEntityId: string;
  targetEntityId: string;
  description: string | null;
  status: InformationStatusDto;
  revealedAt: NarrativePositionDto;
};
