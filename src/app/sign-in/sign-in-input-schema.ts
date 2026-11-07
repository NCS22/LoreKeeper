import { z } from "zod";

/**
 * The shape of what the sign-in action receives. Only the shape: the domain decides what an
 * empty value is, and the credential check decides everything else (FR-15, NFR-1). A key that is
 * not listed, such as a `userId`, is a validation failure.
 */
export const signInInputSchema = z.strictObject({
  email: z.string(),
  password: z.string(),
});
