import { z } from "zod";

/**
 * The shape of what the details action receives. Only the shape: the modules decide whether the
 * identifiers are well formed. Unknown keys are dropped without error (NFR-2).
 */
export const loadEntityDetailsInputSchema = z.object({
  universeId: z.string(),
  entityId: z.string(),
});
