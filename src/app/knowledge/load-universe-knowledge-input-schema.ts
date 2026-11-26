import { z } from "zod";

/**
 * The shape of what the load action receives. Only the shape: the universes module decides whether
 * the identifier is well formed. Unknown keys are dropped without error (NFR-2).
 */
export const loadUniverseKnowledgeInputSchema = z.object({
  universeId: z.string(),
});
