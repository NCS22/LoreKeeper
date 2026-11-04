import type { InformationStatusDto, NarrativePositionDto } from "@/dto/shared";

export type EventParticipantRoleDto = "PROTAGONIST" | "PARTICIPANT" | "AFFECTED" | "LOCATION" | "MENTIONED";

export type EventParticipantDto = {
  entityId: string;
  role: EventParticipantRoleDto;
};

// Chronological order (when it happens in the story) and discovery (`discoveredAt`) are independent.
export type EventDto = {
  id: string;
  universeId: string;
  title: string;
  description: string | null;
  chronologicalLabel: string | null;
  status: InformationStatusDto;
  discoveredAt: NarrativePositionDto;
  participants: EventParticipantDto[];
};
