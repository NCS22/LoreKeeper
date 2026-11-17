import { z } from "zod";

/**
 * The shape of what the create-universe action receives. Only the shape: the domain decides what a
 * valid name, description or mode is. A key that is not listed, such as an `ownerId`, is dropped
 * without error: the owner is always the account of the session (FR-2).
 */
export const createUniverseInputSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  mode: z.string(),
});
