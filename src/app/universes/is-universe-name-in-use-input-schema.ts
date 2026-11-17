import { z } from "zod";

/** The shape of what the name check receives. Unknown keys are dropped without error (FR-2). */
export const isUniverseNameInUseInputSchema = z.object({
  name: z.string(),
});
