import { z } from "zod";

/**
 * The shape of what the name check receives. Unknown keys are dropped without error (FR-2). The
 * optional `excludedUniverseId` is the universe being edited (spec 007a FR-8); whether it is a
 * well-formed own universe is decided by the use case, never here.
 */
export const isUniverseNameInUseInputSchema = z.object({
  name: z.string(),
  excludedUniverseId: z.string().optional(),
});
