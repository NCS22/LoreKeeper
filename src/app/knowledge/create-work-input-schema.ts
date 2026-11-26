import { z } from "zod";

/**
 * The shape of what the create-work action receives. Only the shape: the domain decides what a
 * valid title, medium or number of units is, and the number travels as text so that "1e3" or "+12"
 * reach that rule. A key that is not listed, such as an owner, unit labels or an order, is dropped
 * without error (FR-1, NFR-2).
 */
export const createWorkInputSchema = z.object({
  universeId: z.string(),
  title: z.string(),
  medium: z.string(),
  unitCount: z.string(),
});
