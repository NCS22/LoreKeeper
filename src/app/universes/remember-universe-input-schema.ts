import { z } from "zod";

/**
 * The shape of what the remember action receives. Only the shape: the domain decides whether the
 * identifier is well formed. Unknown keys are dropped without error (FR-2).
 */
export const rememberUniverseInputSchema = z.object({
  universeId: z.string(),
});
