import { z } from "zod";

/**
 * The shape of what the edit-universe action receives. Only the shape: the use case decides what a
 * valid identifier, name or description is, after checking that the universe is an own one, so a
 * universe of another account is never answered with a validation error (spec 007a FR-9). A key
 * that is not listed, such as a `mode` or an `ownerId`, is dropped without error: an edit never
 * changes the mode, and the owner is always the account of the session (FR-4, FR-9).
 */
export const editUniverseInputSchema = z.object({
  universeId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
});
