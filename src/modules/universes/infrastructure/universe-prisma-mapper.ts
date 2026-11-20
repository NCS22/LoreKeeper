import { InfrastructureError } from "@/shared/domain/error-kinds";
import type { Universe as StoredUniverse } from "@/shared/infrastructure/generated/prisma/client";
import type { Universe } from "../domain/universe";
import { parseUniverseMode } from "../domain/universe-mode";

/** Turns a stored row into the domain universe. Generated types never leave this folder. */
export function toDomainUniverse(storedUniverse: StoredUniverse): Universe {
  const mode = parseUniverseMode(storedUniverse.mode);
  if (mode === null) {
    throw new InfrastructureError("The stored universe has a mode this version does not know.");
  }

  return {
    id: storedUniverse.id,
    ownerId: storedUniverse.ownerId,
    name: storedUniverse.name,
    description: storedUniverse.description,
    mode,
    createdAt: storedUniverse.createdAt,
    updatedAt: storedUniverse.updatedAt,
  };
}
