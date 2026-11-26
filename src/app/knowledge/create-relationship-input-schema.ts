import { z } from "zod";
import { boundaryInputSchema } from "./boundary-input-schema";

/**
 * The shape of what the create-relationship action receives. Only the shape: the domain decides
 * what a valid identifier, status or unit number is, and a missing status reaches that rule. A key
 * that is not listed, such as a description, an owner or a unit identifier, is dropped without
 * error (FR-7, NFR-2).
 */
export const createRelationshipInputSchema = z.object({
  universeId: z.string(),
  sourceEntityId: z.string(),
  targetEntityId: z.string(),
  relationshipTypeId: z.string(),
  status: z.string().nullish(),
  boundary: boundaryInputSchema,
});
