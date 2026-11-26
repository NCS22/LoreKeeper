import { z } from "zod";

/**
 * A point, as the entity and relationship actions receive it: a work and the number of one of its
 * units, as text so the domain rule reads it (D6). A unit identifier or any other key is dropped.
 */
export const boundaryInputSchema = z.object({
  workId: z.string(),
  unitNumber: z.string(),
});
